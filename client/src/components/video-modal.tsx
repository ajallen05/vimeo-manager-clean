import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import type { VimeoVideo } from "@shared/schema";
import { useState, useEffect } from "react";

interface DownloadLink {
  quality: string;
  link: string;
  size?: number;
}

interface VideoModalProps {
  video: VimeoVideo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VideoModal({ video, open, onOpenChange }: VideoModalProps) {
  const [downloadLinks, setDownloadLinks] = useState<DownloadLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Fetch download links when modal opens or when video data changes
  useEffect(() => {
    if (open && video.id) {
      fetchDownloadLinks();
    }
  }, [open, video.id, video.modified_time]); // Re-fetch if modified_time changes

  const fetchDownloadLinks = async (forceRefresh = false) => {
    setIsLoadingLinks(true);
    setDownloadError(null);
    
    try {
      console.log(`Fetching download links for video: ${video.id}${forceRefresh ? ' (forced refresh)' : ''}`);
      
      // Add cache-busting if forced refresh or if video was recently replaced
      let url = `/api/videos/${video.id}/download-links`;
      if (forceRefresh) {
        url += `?_refresh=${Date.now()}`;
      } else {
        const cacheVersion = localStorage.getItem(`video-cache-version-${video.id}`);
        if (cacheVersion) {
          url += `?v=${cacheVersion}`;
        }
      }
      
      const response = await fetch(url, {
        headers: forceRefresh ? {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        } : {}
      });
      
      // Check if response is HTML (likely a 404 or error page)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error('Server error: Received HTML instead of JSON. Please check if the server is running properly.');
      }
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (jsonError) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        throw new Error('Invalid JSON response from server');
      }
      
      console.log('Received download links:', data.downloadLinks);
      setDownloadLinks(data.downloadLinks || []);
    } catch (error) {
      console.error("Failed to fetch download links:", error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch download links';
      setDownloadError(errorMessage);
    } finally {
      setIsLoadingLinks(false);
    }
  };

  const handleDownload = (quality: "source" | "hd" | "sd") => {
    console.log(`Initiating download for quality: ${quality}`);
    
    // Find the download link for the requested quality
    let downloadLink = downloadLinks.find(link => link.quality === quality);
    
    // Fallback logic
    if (!downloadLink) {
      if (quality === 'source') {
        // Try 'hd' then 'sd' as fallback
        downloadLink = downloadLinks.find(link => link.quality === 'hd') || 
                      downloadLinks.find(link => link.quality === 'sd') ||
                      downloadLinks[0];
      } else if (quality === 'hd') {
        // Try 'source' then 'sd' as fallback
        downloadLink = downloadLinks.find(link => link.quality === 'source') || 
                      downloadLinks.find(link => link.quality === 'sd') ||
                      downloadLinks[0];
      } else if (quality === 'sd') {
        // Try 'hd' then 'source' as fallback
        downloadLink = downloadLinks.find(link => link.quality === 'hd') || 
                      downloadLinks.find(link => link.quality === 'source') ||
                      downloadLinks[0];
      }
    }

    if (!downloadLink) {
      setDownloadError('No download link available for the requested quality');
      return;
    }

    console.log(`Using direct Vimeo download link: ${downloadLink.link}`);
    
    // Create a temporary anchor element and trigger download with direct Vimeo link
    const a = document.createElement('a');
    a.href = downloadLink.link;
    a.style.display = 'none';
    a.target = '_blank'; // Open in new tab to handle any redirects
    a.download = ''; // Suggest download instead of navigation
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    console.log(`Direct download initiated for quality: ${downloadLink.quality}`);
  };

  const getAvailableQuality = (quality: string): DownloadLink | null => {
    return downloadLinks.find(link => link.quality === quality) || null;
  };

  const clearError = () => {
    setDownloadError(null);
  };

  return (
    <>
      <style>
        {`
          .video-container iframe {
            width: 100% !important;
            height: 100% !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            border: none !important;
          }
        `}
      </style>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle data-testid="video-modal-title" className="truncate">{video.name}</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Error Display */}
            {downloadError && (
              <div className="mb-4 p-3 bg-destructive/15 border border-destructive/20 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-destructive">Download Error</p>
                  <p className="text-sm text-destructive/80 mt-1 break-words">{downloadError}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                  className="text-destructive hover:text-destructive/80 p-1 h-auto"
                >
                  ×
                </Button>
              </div>
            )}

            {/* Loading Links Display */}
            {isLoadingLinks && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                <p className="text-sm text-blue-600">Preparing download links...</p>
              </div>
            )}

            {/* Video Player */}
            <div className="bg-muted rounded-lg flex-1 flex items-center justify-center overflow-hidden relative min-h-0">
              {video.embedHtml ? (
                <div 
                  className="video-container w-full h-full flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: video.embedHtml }}
                  data-testid="video-player"
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    minHeight: '300px'
                  }}
                />
              ) : (
                <div className="text-center p-4" data-testid="video-placeholder">
                  <svg className="w-16 h-16 text-muted-foreground mb-4 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                  <p className="text-muted-foreground">Video Player</p>
                  <p className="text-sm text-muted-foreground">Unable to load video embed</p>
                </div>
              )}
            </div>

            {/* Video Info and Actions */}
            <div className="mt-4 border-t pt-4 flex-shrink-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Video ID: <span className="font-mono text-muted-foreground">{video.id}</span></p>
                  {video.duration && (
                    <p className="text-sm text-muted-foreground">
                      Duration: {Math.floor(Number(video.duration) / 60)}:{String(Math.floor(Number(video.duration) % 60)).padStart(2, '0')}
                    </p>
                  )}
                  {downloadLinks.length > 0 && (
                    <p className="text-sm text-green-600">
                      Download links ready ({downloadLinks.length} qualities available)
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
                  <Button 
                    variant="outline" 
                    onClick={() => onOpenChange(false)} 
                    data-testid="video-close"
                    className="flex-1 sm:flex-none"
                  >
                    Close
                  </Button>
                  <div className="flex flex-wrap gap-2 justify-end w-full sm:w-auto">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => fetchDownloadLinks(true)} 
                      disabled={isLoadingLinks}
                      className="flex-1 sm:flex-none"
                      title="Refresh video data (force update)"
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingLinks ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleDownload("source")} 
                      data-testid="video-download-source" 
                      disabled={isLoadingLinks || downloadLinks.length === 0}
                      className="flex-1 sm:flex-none"
                      title={getAvailableQuality('source') ? `Download original quality` : 'Original quality not available'}
                    >
                      {isLoadingLinks ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      Source
                      {getAvailableQuality('source') && (
                        <span className="ml-1 text-xs text-green-600">✓</span>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleDownload("hd")} 
                      data-testid="video-download-hd" 
                      disabled={isLoadingLinks || downloadLinks.length === 0}
                      className="flex-1 sm:flex-none"
                      title={getAvailableQuality('hd') ? `Download HD quality` : 'HD quality not available'}
                    >
                      {isLoadingLinks ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      HD
                      {getAvailableQuality('hd') && (
                        <span className="ml-1 text-xs text-green-600">✓</span>
                      )}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleDownload("sd")} 
                      data-testid="video-download-sd" 
                      disabled={isLoadingLinks || downloadLinks.length === 0}
                      className="flex-1 sm:flex-none"
                      title={getAvailableQuality('sd') ? `Download SD quality` : 'SD quality not available'}
                    >
                      {isLoadingLinks ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4 mr-2" />
                      )}
                      SD
                      {getAvailableQuality('sd') && (
                        <span className="ml-1 text-xs text-green-600">✓</span>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}