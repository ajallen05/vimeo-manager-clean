import type { Express, Request, Response } from "express";
import ExcelJS from 'exceljs';
import { VimeoUploader } from "./vimeo";
import { storage } from "./storage";
import { formatDuration, escapeCSV, logger } from "./utils";
import { BATCH_SIZE, VIMEO_API_BASE } from "./constants";

// Helper function to get video download info
async function getVideoDownloadInfo(videoId: string, credentials: any, baseUrl: string) {
  try {
    const infoResp = await fetch(
      `https://api.vimeo.com/videos/${videoId}?fields=download,pictures.sizes,texttracks`,
      { 
        headers: { 
          Authorization: `Bearer ${credentials.accessToken}`, 
          Accept: 'application/vnd.vimeo.*+json;version=3.4' 
        }
      }
    );
    
    if (!infoResp.ok) {
      return {
        downloadQualities: '',
        videoDownloadUrl: '',
        thumbnailDownloadUrl: '',
        captionDownloadUrl: '',
        captionLanguages: [],
        thumbnailBuffer: null,
        captionText: ''
      };
    }

    const info = await infoResp.json();
    let downloadQualities = '';
    let videoDownloadUrl = '';
    let thumbnailDownloadUrl = '';
    let captionDownloadUrl = '';
    let captionLanguages: string[] = [];
    let thumbnailBuffer: Buffer | null = null;
    let captionText = '';

    // Process download links
    if (Array.isArray(info.download) && info.download.length > 0) {
      const bestDownload = info.download.reduce((best: any, current: any) => {
        if (!best) return current;
        return (current.size || 0) > (best.size || 0) ? current : best;
      }, null);
      
      if (bestDownload) {
        // Use direct Vimeo download link
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
      const largestThumbnail = sizes.reduce((largest, current) => {
        return current.width > largest.width ? current : largest;
      });
      if (largestThumbnail?.link) {
        // Use direct Vimeo thumbnail link for universal access
        // Add cache-busting for better reliability after video replacement
        const separator = largestThumbnail.link.includes('?') ? '&' : '?';
        thumbnailDownloadUrl = `${largestThumbnail.link}${separator}_export=${Date.now()}`;
      }
    }

    // Get caption info
    try {
      const txResp = await fetch(
        `https://api.vimeo.com/videos/${videoId}/texttracks`,
        { 
          headers: { 
            Authorization: `Bearer ${credentials.accessToken}`, 
            Accept: 'application/vnd.vimeo.*+json;version=3.4' 
          }
        }
      );
      
      if (txResp.ok) {
        const txData = await txResp.json();
        const tracks = Array.isArray(txData.data) ? txData.data : [];
        captionLanguages = tracks.map((t: any) => `${t.language}${t.default ? ' (default)' : ''}`);
        
        if (tracks.length > 0) {
          const defaultTrack = tracks.find((t: any) => t.default) || tracks[0];
          if (defaultTrack?.link) {
            // Use direct Vimeo captions link
            captionDownloadUrl = defaultTrack.link;
            // Fetch caption text
            try {
              const captionResp = await fetch(defaultTrack.link);
              if (captionResp.ok) {
                captionText = await captionResp.text();
                // Truncate to Excel cell limit (32,767 characters)
                if (captionText.length > 32767) {
                  captionText = captionText.slice(0, 32764) + '...';
                }
              }
            } catch (e) {
              console.warn(`Failed to fetch caption text for ${videoId}:`, e);
            }
          }
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch captions for ${videoId}:`, e);
    }

    return {
      downloadQualities,
      videoDownloadUrl,
      thumbnailDownloadUrl,
      captionDownloadUrl,
      captionLanguages,
      thumbnailBuffer,
      captionText
    };
  } catch (e) {
    console.warn(`Failed to fetch download info for ${videoId}:`, e);
    return {
      downloadQualities: '',
      videoDownloadUrl: '',
      thumbnailDownloadUrl: '',
      captionDownloadUrl: '',
      captionLanguages: [],
      thumbnailBuffer: null,
      captionText: ''
    };
  }
}

// escapeCSV and formatDuration imported from ./utils

export function registerExportRoutes(app: Express) {
  // Unified export endpoint for both Excel and CSV
  app.post("/api/videos/export-metadata", async (req: Request, res: Response) => {
    const format = req.body.format || 'excel';
    const videoIds = req.body.videoIds;

    try {
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ message: 'No video IDs provided' });
      }

      // Limit the number of videos to prevent memory issues
      if (videoIds.length > 100) {
        return res.status(400).json({ message: 'Too many videos requested. Please limit to 100 videos per export.' });
      }

      const credentials = await storage.getActiveCredentials();
      if (!credentials) {
        return res.status(400).json({ message: 'Vimeo credentials not configured' });
      }
      const uploader = new VimeoUploader(credentials.accessToken);
      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || '5000'}`;

      // Setup headers
      const headers = [
        'Video ID', 'Title', 'Description', 'Tags', 'Duration', 
        'Created Date', 'Modified Date', 'Privacy', 'Views', 'Likes', 
        'Comments', 'Resolution', 'File Size (MB)', 'Status',
        'Video Download', format === 'excel' ? 'Thumbnail' : 'Thumbnail Download', 
        format === 'excel' ? 'Captions' : 'Caption Download',
        'Available Qualities', 'Available Captions'
      ];

      // Initialize Excel workbook if needed
      let workbook: ExcelJS.Workbook | undefined;
      let worksheet: ExcelJS.Worksheet | undefined;
      if (format === 'excel') {
        workbook = new ExcelJS.Workbook();
        workbook.creator = 'Vimeo Manager';
        workbook.created = new Date();

        // Add metadata sheet
        worksheet = workbook.addWorksheet('Video Metadata');
        worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
        
        // Add headers with formatting
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
      let successCount = 0;
      let errorCount = 0;

      // Process videos in batches to avoid rate limiting (BATCH_SIZE imported from constants)
      const batches = [];
      for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
        batches.push(videoIds.slice(i, i + BATCH_SIZE));
      }

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} videos)...`);
        
        for (const videoId of batch) {
          try {
            // Get basic video info
            const video = await uploader.getVideoDetails(videoId);
            
            if (video) {
              // Get download links and other metadata
              const {
                downloadQualities,
                videoDownloadUrl,
                thumbnailDownloadUrl,
                captionDownloadUrl,
                captionLanguages,
                thumbnailBuffer,
                captionText
              } = await getVideoDownloadInfo(videoId, credentials, baseUrl);

              const rowData = [
                video.id || videoId,
                video.name || '',
                video.description || '',
                Array.isArray(video.tags) ? video.tags.join(', ') : video.tags || '',
                formatDuration(typeof video.duration === 'number' ? video.duration : 0),
                video.created_time || '',
                video.modified_time || '',
                video.privacy || '',
                video.views || 0,
                video.likes || 0,
                video.comments || 0,
                video.resolution || '',
                Math.round((video.fileSize || 0) / 1024 / 1024),
                video.status || '',
                videoDownloadUrl || '[No download available]',
                format === 'excel' ? thumbnailDownloadUrl || '[No thumbnail available]' : thumbnailDownloadUrl || '[No thumbnail available]',
                format === 'excel' ? captionText || '[No captions]' : captionDownloadUrl || '[No captions available]',
                downloadQualities || '[No qualities available]',
                captionLanguages.join(', ') || '[No captions]'
              ];

              if (format === 'excel' && worksheet) {
                const row = worksheet.addRow(rowData);

                // Insert thumbnail URL into Excel sheet
                if (thumbnailDownloadUrl) {
                  const cell = row.getCell(headers.indexOf('Thumbnail') + 1);
                  cell.value = {
                    text: thumbnailDownloadUrl,
                    hyperlink: thumbnailDownloadUrl
                  };
                  cell.font = { color: { argb: 'FF0066CC' }, underline: true };
                }

                // Style the cells
                row.eachCell((cell, colNumber) => {
                  // Add borders
                  cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                  };

                  // Format URLs with underlined blue text (excluding thumbnail and captions columns for Excel)
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

                  // Format numbers
                  if (typeof cell.value === 'number') {
                    cell.numFmt = '#,##0';
                  }
                });
              } else {
                csvContent += rowData.map(escapeCSV).join(',') + '\n';
              }
              successCount++;
            }
          } catch (error) {
            errorCount++;
            console.warn(`Failed to process video ${videoId}:`, error);
            
            const errorRow = [
              videoId, 'Error', 'Failed to fetch video details', '', '0', '', '', '', '0', '0', '0', '', 
              '0', 'Error', '', '[Error]', '[Error]', '[Error]', '[Error]', '[Error]'
            ];

            if (format === 'excel' && worksheet) {
              const row = worksheet.addRow(errorRow);
              row.eachCell(cell => {
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
        
        // 🚀 OPTIMIZED: Reduced delay between batches
        if (batchIndex < batches.length - 1) {
          console.log('Waiting 300ms before next batch...');
          await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 1000ms to 300ms
        }
      }

      // Add summary information
      const summaryData = [
        ['EXPORT SUMMARY'],
        ['Total Videos Requested', videoIds.length],
        ['Successfully Processed', successCount],
        ['Failed to Process', errorCount],
        ['Export Date', new Date().toLocaleString()],
        [''],
        ['DOWNLOAD INSTRUCTIONS'],
        ['• Copy the download URLs and paste them into your browser to download files'],
        ['• Video downloads stream through your server to avoid CORS issues'],
        format === 'excel' ? ['• Thumbnails are embedded as images in the Excel file'] : ['• Thumbnail downloads get the highest quality available'],
        format === 'excel' ? ['• Captions are included as text in the Excel file'] : ['• Caption downloads are converted to plain text format']
      ];

      if (format === 'excel' && workbook) {
        // Add summary worksheet
        const summarySheet = workbook.addWorksheet('Summary');
        summaryData.forEach(row => {
          const excelRow = summarySheet.addRow(row);
          if (row.length === 1) {
            excelRow.font = { bold: true, size: 12 };
          }
        });

        // Auto-fit columns in summary sheet
        summarySheet.columns.forEach(column => {
          column.width = 50;
        });

        // Generate Excel file
        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=vimeo-metadata.xlsx');
        res.send(buffer);
      } else {
        // Add summary to CSV
        csvContent += '\n' + summaryData.map(row => row.map(escapeCSV).join(',')).join('\n');
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename=vimeo-metadata.csv');
        res.send(csvContent);
      }
    } catch (error) {
      console.error('Error generating export:', error);
      res.status(500).json({ 
        message: `Failed to generate ${format === 'excel' ? 'Excel' : 'CSV'} export`,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Route to export metadata as CSV (legacy route for backward compatibility)
  app.post("/api/videos/export-csv", (req: Request, res: Response) => {
    if (req.body && typeof req.body === 'object') {
      req.body.format = 'csv';
    }
    const exportReq = { ...req, body: { ...req.body, format: 'csv' } };
    return app._router.handle(exportReq, res);
  });
}

// Fix for index.ts: Return the Express app instead of an HTTP server
export default function registerRoutes(app: Express) {
  registerExportRoutes(app);
  return Promise.resolve(app);
}