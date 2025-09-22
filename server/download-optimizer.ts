import { EventEmitter } from 'events';
import { createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import archiver from 'archiver';

interface DownloadOptions {
  quality?: 'source' | 'hd' | 'sd' | 'auto';
  maxConcurrent?: number;
  maxRetries?: number;
  chunkSize?: number;
  enableCache?: boolean;
  enableResume?: boolean;
}

interface DownloadProgress {
  videoId: string;
  videoName: string;
  status: 'pending' | 'downloading' | 'completed' | 'error' | 'cancelled';
  progress: number; // 0-100
  bytesDownloaded: number;
  totalBytes: number;
  speed: number; // bytes per second
  error?: string;
}

interface DownloadJob {
  id: string;
  videoId: string;
  videoName: string;
  downloadUrl: string;
  filePath: string;
  quality: string;
  size: number;
  priority: number;
  retryCount: number;
}

export class DownloadOptimizer extends EventEmitter {
  private accessToken: string;
  private options: Required<DownloadOptions>;
  private activeDownloads = new Map<string, DownloadProgress>();
  private downloadQueue: DownloadJob[] = [];
  private runningJobs = new Set<string>();
  private cacheDir: string;
  private tempDir: string;

  constructor(accessToken: string, options: DownloadOptions = {}) {
    super();
    this.accessToken = accessToken;
    this.options = {
      quality: options.quality || 'auto',
      maxConcurrent: Math.min(options.maxConcurrent || 8, 20), // Limit to prevent API rate limiting
      maxRetries: options.maxRetries || 3,
      chunkSize: options.chunkSize || 8192, // 8KB chunks
      enableCache: options.enableCache ?? true,
      enableResume: options.enableResume ?? true,
    };

    // Setup directories
    this.cacheDir = join(process.cwd(), 'cache', 'downloads');
    this.tempDir = join(process.cwd(), 'temp', 'downloads');
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    [this.cacheDir, this.tempDir].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    });
  }

  async getOptimalDownloadLink(videoId: string): Promise<{
    url: string;
    quality: string;
    size: number;
    videoName: string;
  } | null> {
    try {
      const response = await fetch(
        `https://api.vimeo.com/videos/${videoId}?fields=download,name,files`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: "application/vnd.vimeo.*+json;version=3.4",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.download || !Array.isArray(data.download) || data.download.length === 0) {
        return null;
      }

      let selectedDownload;
      const downloads = data.download.sort((a: any, b: any) => (b.size || 0) - (a.size || 0));

      switch (this.options.quality) {
        case 'source':
          selectedDownload = downloads.find((d: any) => d.quality === 'source') || downloads[0];
          break;
        case 'hd':
          selectedDownload = downloads.find((d: any) => d.quality === 'hd') || 
                           downloads.find((d: any) => d.quality === 'source') || 
                           downloads[0];
          break;
        case 'sd':
          selectedDownload = downloads.find((d: any) => d.quality === 'sd') || 
                           downloads.find((d: any) => d.quality === 'hd') || 
                           downloads[0];
          break;
        case 'auto':
        default:
          // Smart selection based on file size (prefer HD if reasonable size)
          const hdDownload = downloads.find((d: any) => d.quality === 'hd');
          const sourceDownload = downloads.find((d: any) => d.quality === 'source');
          
          if (hdDownload && sourceDownload) {
            // If HD is less than 80% of source size, prefer HD for faster download
            selectedDownload = (hdDownload.size < sourceDownload.size * 0.8) ? hdDownload : sourceDownload;
          } else {
            selectedDownload = hdDownload || sourceDownload || downloads[0];
          }
          break;
      }

      return {
        url: selectedDownload.link,
        quality: selectedDownload.quality,
        size: selectedDownload.size || 0,
        videoName: data.name || videoId,
      };
    } catch (error) {
      console.error(`Error getting download link for video ${videoId}:`, error);
      return null;
    }
  }

  async downloadSingleVideo(
    videoId: string,
    outputPath?: string
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const downloadInfo = await this.getOptimalDownloadLink(videoId);
      if (!downloadInfo) {
        return { success: false, error: 'No download link available' };
      }

      const fileName = this.sanitizeFileName(downloadInfo.videoName) + '.mp4';
      const filePath = outputPath || join(this.cacheDir, fileName);

      // Check cache first
      if (this.options.enableCache && existsSync(filePath)) {
        const stats = statSync(filePath);
        if (stats.size === downloadInfo.size) {
          console.log(`Using cached file for ${videoId}: ${filePath}`);
          return { success: true, filePath };
        }
      }

      const progress: DownloadProgress = {
        videoId,
        videoName: downloadInfo.videoName,
        status: 'downloading',
        progress: 0,
        bytesDownloaded: 0,
        totalBytes: downloadInfo.size,
        speed: 0,
      };

      this.activeDownloads.set(videoId, progress);
      this.emit('progress', progress);

      const success = await this.performDownload(
        downloadInfo.url,
        filePath,
        downloadInfo.size,
        progress
      );

      if (success) {
        progress.status = 'completed';
        progress.progress = 100;
        this.emit('progress', progress);
        return { success: true, filePath };
      } else {
        progress.status = 'error';
        progress.error = 'Download failed';
        this.emit('progress', progress);
        return { success: false, error: 'Download failed' };
      }
    } catch (error) {
      const progress = this.activeDownloads.get(videoId);
      if (progress) {
        progress.status = 'error';
        progress.error = error instanceof Error ? error.message : 'Unknown error';
        this.emit('progress', progress);
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      this.activeDownloads.delete(videoId);
    }
  }

  async downloadMultipleVideos(
    videoIds: string[],
    outputDir?: string
  ): Promise<{ success: number; failed: number; results: Array<{ videoId: string; success: boolean; filePath?: string; error?: string }> }> {
    const results: Array<{ videoId: string; success: boolean; filePath?: string; error?: string }> = [];
    let success = 0;
    let failed = 0;

    // Prepare download jobs
    const jobs: DownloadJob[] = [];
    
    for (let i = 0; i < videoIds.length; i++) {
      const videoId = videoIds[i];
      const downloadInfo = await this.getOptimalDownloadLink(videoId);
      
      if (downloadInfo) {
        const fileName = this.sanitizeFileName(downloadInfo.videoName) + '.mp4';
        const filePath = outputDir ? join(outputDir, fileName) : join(this.cacheDir, fileName);
        
        jobs.push({
          id: `${videoId}-${Date.now()}`,
          videoId,
          videoName: downloadInfo.videoName,
          downloadUrl: downloadInfo.url,
          filePath,
          quality: downloadInfo.quality,
          size: downloadInfo.size,
          priority: i,
          retryCount: 0,
        });
      } else {
        results.push({ videoId, success: false, error: 'No download link available' });
        failed++;
      }
    }

    // Process downloads in parallel batches
    const batches = this.createBatches(jobs, this.options.maxConcurrent);
    
    for (const batch of batches) {
      const batchPromises = batch.map(async (job) => {
        try {
          // Check cache first
          if (this.options.enableCache && existsSync(job.filePath)) {
            const stats = statSync(job.filePath);
            if (stats.size === job.size) {
              console.log(`Using cached file for ${job.videoId}: ${job.filePath}`);
              return { videoId: job.videoId, success: true, filePath: job.filePath };
            }
          }

          const progress: DownloadProgress = {
            videoId: job.videoId,
            videoName: job.videoName,
            status: 'downloading',
            progress: 0,
            bytesDownloaded: 0,
            totalBytes: job.size,
            speed: 0,
          };

          this.activeDownloads.set(job.videoId, progress);
          this.emit('progress', progress);

          const downloadSuccess = await this.performDownload(
            job.downloadUrl,
            job.filePath,
            job.size,
            progress
          );

          if (downloadSuccess) {
            progress.status = 'completed';
            progress.progress = 100;
            this.emit('progress', progress);
            return { videoId: job.videoId, success: true, filePath: job.filePath };
          } else {
            progress.status = 'error';
            progress.error = 'Download failed';
            this.emit('progress', progress);
            return { videoId: job.videoId, success: false, error: 'Download failed' };
          }
        } catch (error) {
          const progress = this.activeDownloads.get(job.videoId);
          if (progress) {
            progress.status = 'error';
            progress.error = error instanceof Error ? error.message : 'Unknown error';
            this.emit('progress', progress);
          }
          return { 
            videoId: job.videoId, 
            success: false, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          };
        } finally {
          this.activeDownloads.delete(job.videoId);
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Update counters
      batchResults.forEach(result => {
        if (result.success) success++;
        else failed++;
      });

      // Small delay between batches to be nice to the API
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return { success, failed, results };
  }

  private async performDownload(
    url: string,
    filePath: string,
    expectedSize: number,
    progress: DownloadProgress
  ): Promise<boolean> {
    let retries = 0;
    const maxRetries = this.options.maxRetries;

    while (retries <= maxRetries) {
      try {
        const startTime = Date.now();
        let bytesDownloaded = 0;

        // Support for resume if enabled
        let headers: Record<string, string> = {};
        if (this.options.enableResume && existsSync(filePath)) {
          const stats = statSync(filePath);
          bytesDownloaded = stats.size;
          if (bytesDownloaded < expectedSize) {
            headers['Range'] = `bytes=${bytesDownloaded}-`;
            console.log(`Resuming download from byte ${bytesDownloaded}`);
          } else {
            // File already complete
            return true;
          }
        }

        const response = await fetch(url, { headers });
        
        if (!response.ok && response.status !== 206) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Convert Web ReadableStream to Node.js Readable
        const webStream = response.body;
        const nodeStream = Readable.fromWeb(webStream as any);

        const writeStream = createWriteStream(filePath, { 
          flags: bytesDownloaded > 0 ? 'a' : 'w' 
        });

        let lastProgressUpdate = Date.now();

        nodeStream.on('data', (chunk: Buffer) => {
          bytesDownloaded += chunk.length;
          
          // Update progress at most every 500ms to avoid too frequent updates
          const now = Date.now();
          if (now - lastProgressUpdate > 500) {
            const elapsed = (now - startTime) / 1000;
            const speed = elapsed > 0 ? bytesDownloaded / elapsed : 0;
            
            progress.bytesDownloaded = bytesDownloaded;
            progress.progress = Math.min(100, (bytesDownloaded / expectedSize) * 100);
            progress.speed = speed;
            
            this.emit('progress', progress);
            lastProgressUpdate = now;
          }
        });

        await pipeline(nodeStream, writeStream);

        // Verify download
        const finalStats = statSync(filePath);
        if (finalStats.size === expectedSize || (expectedSize === 0 && finalStats.size > 0)) {
          console.log(`Successfully downloaded ${filePath} (${finalStats.size} bytes)`);
          return true;
        } else {
          console.warn(`Size mismatch: expected ${expectedSize}, got ${finalStats.size}`);
          if (retries < maxRetries) {
            unlinkSync(filePath); // Remove incomplete file
            throw new Error('Size mismatch, retrying...');
          }
          return false;
        }

      } catch (error) {
        retries++;
        console.error(`Download attempt ${retries} failed:`, error);
        
        if (retries <= maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retries - 1), 10000); // Exponential backoff, max 10s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return false;
  }

  async createBulkDownloadArchive(
    videoIds: string[],
    archiveName: string = 'vimeo-videos.zip'
  ): Promise<{ success: boolean; archivePath?: string; error?: string }> {
    try {
      const archivePath = join(this.tempDir, archiveName);
      
      // Download all videos first
      console.log(`Starting bulk download of ${videoIds.length} videos...`);
      const downloadResults = await this.downloadMultipleVideos(videoIds, this.tempDir);
      
      console.log(`Download complete: ${downloadResults.success} successful, ${downloadResults.failed} failed`);

      // Create archive
      const archive = archiver('zip', { zlib: { level: 6 } });
      const output = createWriteStream(archivePath);

      return new Promise((resolve, reject) => {
        output.on('close', () => {
          console.log(`Archive created: ${archivePath} (${archive.pointer()} bytes)`);
          
          // Clean up individual video files
          downloadResults.results.forEach(result => {
            if (result.success && result.filePath && result.filePath !== archivePath) {
              try {
                unlinkSync(result.filePath);
              } catch (e) {
                console.warn(`Failed to clean up ${result.filePath}:`, e);
              }
            }
          });

          resolve({ success: true, archivePath });
        });

        archive.on('error', (err) => {
          reject({ success: false, error: err.message });
        });

        archive.pipe(output);

        // Add successful downloads to archive
        let addedCount = 0;
        downloadResults.results.forEach(result => {
          if (result.success && result.filePath && existsSync(result.filePath)) {
            const fileName = `${this.sanitizeFileName(result.videoId)}.mp4`;
            archive.file(result.filePath, { name: fileName });
            addedCount++;
          } else if (!result.success) {
            // Add error file for failed downloads
            const errorContent = `Error downloading video ${result.videoId}: ${result.error || 'Unknown error'}`;
            archive.append(errorContent, { name: `ERROR_${result.videoId}.txt` });
          }
        });

        // Add summary
        const summary = `Vimeo Bulk Download Summary\n` +
                       `Total videos requested: ${videoIds.length}\n` +
                       `Successfully downloaded: ${downloadResults.success}\n` +
                       `Errors encountered: ${downloadResults.failed}\n` +
                       `Files in archive: ${addedCount}\n` +
                       `Download date: ${new Date().toLocaleString()}`;

        archive.append(summary, { name: 'download_summary.txt' });

        archive.finalize();
      });

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-z0-9\-_\. ]/gi, '_').substring(0, 200);
  }

  getActiveDownloads(): DownloadProgress[] {
    return Array.from(this.activeDownloads.values());
  }

  cancelDownload(videoId: string): boolean {
    const progress = this.activeDownloads.get(videoId);
    if (progress) {
      progress.status = 'cancelled';
      this.emit('progress', progress);
      this.activeDownloads.delete(videoId);
      return true;
    }
    return false;
  }

  clearCache(): void {
    try {
      if (existsSync(this.cacheDir)) {
        const files = require('fs').readdirSync(this.cacheDir);
        files.forEach((file: string) => {
          unlinkSync(join(this.cacheDir, file));
        });
        console.log('Download cache cleared');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}
