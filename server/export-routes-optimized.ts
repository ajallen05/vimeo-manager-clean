// OPTIMIZED EXPORT ROUTES - MUCH FASTER PROCESSING
import ExcelJS from 'exceljs';
import { VimeoUploader } from './vimeo';
import { storage } from './storage';

// Optimized video processing with parallel requests and intelligent batching
async function getVideoDownloadInfoOptimized(videoId: string, credentials: any, baseUrl: string) {
  try {
    // Use Promise.all to fetch all data in parallel
    const [infoResp, captionsResp] = await Promise.all([
      fetch(`https://api.vimeo.com/videos/${videoId}?fields=download,pictures.sizes`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      }),
      fetch(`https://api.vimeo.com/videos/${videoId}/texttracks`, {
        headers: {
          'Authorization': `Bearer ${credentials.accessToken}`,
          'Accept': 'application/vnd.vimeo.*+json;version=3.4'
        }
      }).catch(() => null) // Don't fail if captions fail
    ]);

    if (!infoResp.ok) {
      return {
        downloadQualities: '',
        videoDownloadUrl: '',
        thumbnailDownloadUrl: '',
        captionDownloadUrl: '',
        captionLanguages: [],
        captionText: ''
      };
    }

    const info = await infoResp.json();
    let downloadQualities = '';
    let videoDownloadUrl = '';
    let thumbnailDownloadUrl = '';
    let captionDownloadUrl = '';
    let captionLanguages: string[] = [];
    let captionText = '';

    // Process download links
    if (Array.isArray(info.download) && info.download.length > 0) {
      const bestDownload = info.download.reduce((best: any, current: any) => {
        if (!best) return current;
        return (current.size || 0) > (best.size || 0) ? current : best;
      }, null);
      
      if (bestDownload) {
        videoDownloadUrl = bestDownload.link || `https://vimeo.com/${videoId}/download`;
      }
      
      downloadQualities = info.download.map((d: any) => {
        const sizeMb = d.size ? `${Math.round(d.size / 1024 / 1024)}MB` : 'unknown';
        return `${d.quality}${d.height ? ` (${d.height}p)` : ''} - ${sizeMb}`;
      }).join('; ');
    }

    // Process thumbnail
    const sizes = info.pictures?.sizes || [];
    if (Array.isArray(sizes) && sizes.length > 0) {
      const largestThumbnail = sizes.reduce((largest: any, current: any) => {
        return current.width > largest.width ? current : largest;
      });
      
      if (largestThumbnail?.link) {
        const separator = largestThumbnail.link.includes('?') ? '&' : '?';
        thumbnailDownloadUrl = `${largestThumbnail.link}${separator}_export=${Date.now()}`;
      }
    }

    // Process captions if available
    if (captionsResp?.ok) {
      try {
        const txData = await captionsResp.json();
        const tracks = Array.isArray(txData.data) ? txData.data : [];
        captionLanguages = tracks.map((t: any) => `${t.language}${t.default ? ' (default)' : ''}`);
        
        if (tracks.length > 0) {
          const defaultTrack = tracks.find((t: any) => t.default) || tracks[0];
          if (defaultTrack?.link) {
            captionDownloadUrl = defaultTrack.link;
            
            // Fetch caption content (with timeout)
            try {
              const captionResp = await Promise.race([
                fetch(defaultTrack.link),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
              ]) as Response;
              
              if (captionResp.ok) {
                captionText = await captionResp.text();
                if (captionText.length > 32767) {
                  captionText = captionText.slice(0, 32764) + '...';
                }
              }
            } catch (e) {
              // Ignore caption text fetch errors
            }
          }
        }
      } catch (e) {
        // Ignore caption processing errors
      }
    }

    return {
      downloadQualities,
      videoDownloadUrl,
      thumbnailDownloadUrl,
      captionDownloadUrl,
      captionLanguages,
      captionText
    };
  } catch (e) {
    return {
      downloadQualities: '',
      videoDownloadUrl: '',
      thumbnailDownloadUrl: '',
      captionDownloadUrl: '',
      captionLanguages: [],
      captionText: ''
    };
  }
}

// Optimized batch processor with controlled concurrency
class OptimizedVideoProcessor {
  private uploader: VimeoUploader;
  private credentials: any;
  private baseUrl: string;
  private concurrentLimit: number;
  private retryLimit: number;

  constructor(uploader: VimeoUploader, credentials: any, baseUrl: string) {
    this.uploader = uploader;
    this.credentials = credentials;
    this.baseUrl = baseUrl;
    this.concurrentLimit = 10; // Process up to 10 videos simultaneously
    this.retryLimit = 2;
  }

  async processVideo(videoId: string): Promise<any> {
    for (let attempt = 0; attempt <= this.retryLimit; attempt++) {
      try {
        // Fetch video details and download info in parallel
        const [video, downloadInfo] = await Promise.all([
          this.uploader.getVideoDetails(videoId),
          getVideoDownloadInfoOptimized(videoId, this.credentials, this.baseUrl)
        ]);
        
        return {
          success: true,
          video,
          downloadInfo,
          videoId
        };
      } catch (error) {
        if (attempt === this.retryLimit) {
          console.warn(`❌ Failed to process video ${videoId} after ${attempt + 1} attempts:`, error);
          return {
            success: false,
            videoId,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    }
  }

  async processVideoBatch(videoIds: string[]): Promise<any[]> {
    const results = [];
    
    // Process videos with controlled concurrency
    for (let i = 0; i < videoIds.length; i += this.concurrentLimit) {
      const batch = videoIds.slice(i, i + this.concurrentLimit);
      const batchPromises = batch.map(videoId => this.processVideo(videoId));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
}

function escapeCSV(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function registerOptimizedExportRoutes(app: any) {
  app.post('/api/videos/export-metadata-optimized', async (req: any, res: any) => {
    const format = req.body.format || 'excel';
    const videoIds = req.body.videoIds;
    
    try {
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ message: 'No video IDs provided' });
      }
      
      if (videoIds.length > 200) {
        return res.status(400).json({ 
          message: 'Too many videos requested. Please limit to 200 videos per export.' 
        });
      }
      
      const credentials = await storage.getActiveCredentials();
      if (!credentials) {
        return res.status(400).json({ message: 'Vimeo credentials not configured' });
      }
      
      const uploader = new VimeoUploader(credentials.accessToken);
      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || '5000'}`;
      
      const startTime = Date.now();
      console.log(`🚀 Starting OPTIMIZED export for ${videoIds.length} videos...`);
      
      // Headers for the export
      const headers = [
        'Video ID', 'Title', 'Description', 'Tags', 'Duration (min)', 
        'Created Date', 'Modified Date', 'Privacy', 'Views', 'Likes', 'Comments',
        'Resolution', 'File Size (MB)', 'Status', 'Video Download',
        format === 'excel' ? 'Thumbnail' : 'Thumbnail Download',
        format === 'excel' ? 'Captions' : 'Caption Download',
        'Available Qualities', 'Available Captions'
      ];
      
      // Initialize Excel workbook if needed
      let workbook, worksheet;
      if (format === 'excel') {
        workbook = new ExcelJS.Workbook();
        workbook.creator = 'Vimeo Manager - Optimized';
        workbook.created = new Date();
        worksheet = workbook.addWorksheet('Video Metadata');
        worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
        
        const headerRow = worksheet.addRow(headers);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        worksheet.getRow(1).height = 30;
        
        // Set column widths
        headers.forEach((_, index) => {
          const col = worksheet!.getColumn(index + 1);
          col.width = 20;
          if (['Title', 'Description', 'Tags', 'Available Qualities', 'Captions'].includes(headers[index])) {
            col.width = 40;
          }
        });
      }
      
      let csvContent = format === 'csv' ? headers.join(',') + '\n' : '';
      
      // Process videos with optimized batch processing
      const processor = new OptimizedVideoProcessor(uploader, credentials, baseUrl);
      const results = await processor.processVideoBatch(videoIds);
      
      let successCount = 0;
      let errorCount = 0;
      
      // Process results
      for (const result of results) {
        if (result.success) {
          const { video, downloadInfo } = result;
          
          const rowData = [
            video.id || result.videoId,
            video.name || '',
            video.description || '',
            Array.isArray(video.tags) ? video.tags.join(', ') : video.tags || '',
            Math.round((typeof video.duration === 'number' ? video.duration : 0) / 60),
            video.created_time || '',
            video.modified_time || '',
            video.privacy || '',
            video.views || 0,
            video.likes || 0,
            video.comments || 0,
            video.resolution || '',
            Math.round((video.fileSize || 0) / 1024 / 1024),
            video.status || '',
            downloadInfo.videoDownloadUrl || '[No download available]',
            format === 'excel' ? 
              (downloadInfo.thumbnailDownloadUrl || '[No thumbnail available]') : 
              (downloadInfo.thumbnailDownloadUrl || '[No thumbnail available]'),
            format === 'excel' ? 
              (downloadInfo.captionText || '[No captions]') : 
              (downloadInfo.captionDownloadUrl || '[No captions available]'),
            downloadInfo.downloadQualities || '[No qualities available]',
            downloadInfo.captionLanguages.join(', ') || '[No captions]'
          ];
          
          if (format === 'excel' && worksheet) {
            const row = worksheet.addRow(rowData);
            
            // Add thumbnail hyperlink
            if (downloadInfo.thumbnailDownloadUrl) {
              const cell = row.getCell(headers.indexOf('Thumbnail') + 1);
              cell.value = {
                text: downloadInfo.thumbnailDownloadUrl,
                hyperlink: downloadInfo.thumbnailDownloadUrl
              };
              cell.font = { color: { argb: 'FF0066CC' }, underline: true };
            }
            
            // Style the row
            row.eachCell((cell, colNumber) => {
              cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
              };
              
              // Convert URLs to hyperlinks
              if (colNumber !== headers.indexOf('Thumbnail') + 1 && 
                  colNumber !== headers.indexOf('Captions') + 1 &&
                  cell.value && typeof cell.value === 'string' && 
                  (cell.value.startsWith('http://') || cell.value.startsWith('https://'))) {
                cell.value = {
                  text: cell.value,
                  hyperlink: cell.value
                };
                cell.font = { color: { argb: 'FF0066CC' }, underline: true };
              }
              
              if (typeof cell.value === 'number') {
                cell.numFmt = '#,##0';
              }
            });
          } else {
            csvContent += rowData.map(escapeCSV).join(',') + '\n';
          }
          
          successCount++;
        } else {
          errorCount++;
          
          const errorRow = [
            result.videoId, 'Error', `Failed to fetch: ${result.error}`, '', '0', 
            '', '', '', '0', '0', '0', '', '0', 'Error', '', '[Error]', '[Error]', 
            '[Error]', '[Error]'
          ];
          
          if (format === 'excel' && worksheet) {
            const row = worksheet.addRow(errorRow);
            row.eachCell((cell) => {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFE0E0' }
              };
            });
          } else {
            csvContent += errorRow.map(escapeCSV).join(',') + '\n';
          }
        }
      }
      
      const totalTime = Date.now() - startTime;
      const videosPerSecond = (videoIds.length / totalTime * 1000).toFixed(1);
      
      console.log(`✅ OPTIMIZED export completed in ${totalTime}ms (${videosPerSecond} videos/sec)`);
      console.log(`📊 Results: ${successCount} successful, ${errorCount} errors`);
      
      // Add summary
      const summaryData = [
        ['OPTIMIZED EXPORT SUMMARY'],
        ['Total Videos Requested', videoIds.length],
        ['Successfully Processed', successCount],
        ['Failed to Process', errorCount],
        ['Processing Time', `${totalTime}ms`],
        ['Speed', `${videosPerSecond} videos/second`],
        ['Export Date', new Date().toLocaleString()],
        [''],
        ['PERFORMANCE IMPROVEMENTS'],
        ['• Parallel processing with controlled concurrency'],
        ['• Intelligent batching and retry logic'],
        ['• Optimized API calls with Promise.all'],
        ['• Reduced network overhead'],
        ['• Enhanced error handling']
      ];
      
      if (format === 'excel' && workbook) {
        const summarySheet = workbook.addWorksheet('Performance Summary');
        summaryData.forEach((row) => {
          const excelRow = summarySheet.addRow(row);
          if (row.length === 1) {
            excelRow.font = { bold: true, size: 12 };
          }
        });
        summarySheet.columns.forEach((column) => {
          column.width = 50;
        });
        
        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=vimeo-metadata-optimized.xlsx');
        res.send(buffer);
      } else {
        csvContent += '\n' + summaryData.map(row => row.map(escapeCSV).join(',')).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=vimeo-metadata-optimized.csv');
        res.send(csvContent);
      }
      
    } catch (error) {
      console.error('❌ Error in optimized export:', error);
      res.status(500).json({
        message: `Failed to generate optimized ${format === 'excel' ? 'Excel' : 'CSV'} export`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
