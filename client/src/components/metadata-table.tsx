import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, FileSpreadsheet, FileText, ExternalLink, Image, Subtitles, RefreshCw, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface VideoMetadata {
  id: string;
  name: string;
  description: string;
  tags: string;
  duration: number;
  created_time: string;
  modified_time: string;
  privacy: string;
  views: number;
  likes: number;
  comments: number;
  resolution: string;
  fileSize: number;
  status: string;
  public_url: string;
  download_qualities: string;
  caption_languages: string;
  captions_text: string;
  thumb_small: string;
  thumb_medium: string;
  thumb_large: string;
  thumb_max: string;
  caption_download_txt: string;
}

interface MetadataTableProps {
  videos: any[];
  isLoading: boolean;
}

export default function MetadataTable({ videos, isLoading }: MetadataTableProps) {
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [refreshingCache, setRefreshingCache] = useState(false);
  // Removed thumbnail and caption modal states since they're no longer used in the frontend view
  // const [showThumbnailModal, setShowThumbnailModal] = useState(false);
  // const [showCaptionModal, setShowCaptionModal] = useState(false);
  // const [selectedVideo, setSelectedVideo] = useState<any>(null);
  // const [captionContent, setCaptionContent] = useState<string>("");
  // const [loadingCaption, setLoadingCaption] = useState(false);
  const { toast } = useToast();

  const handleGlobalCacheRefresh = async () => {
    setRefreshingCache(true);
    
    try {
      const currentTime = Date.now();
      
      // Apply cache-busting version to ALL videos (including legacy replaced ones)
      videos.forEach(video => {
        localStorage.setItem(`video-cache-version-${video.id}`, currentTime.toString());
      });
      
      toast({
        title: "Cache Refreshed",
        description: `Updated cache for ${videos.length} videos. Thumbnails and captions will now show fresh content.`,
      });
      
      // Force a page reload to apply changes immediately
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error('Failed to refresh cache:', error);
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh cache. Please try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshingCache(false);
    }
  };

  // Removed preview functions since columns are no longer displayed in frontend view
  // These functions are kept for potential future use but commented out
  /*
  const handleViewThumbnail = (video: any) => {
    setSelectedVideo(video);
    setShowThumbnailModal(true);
  };

  const handleViewCaption = async (video: any) => {
    setSelectedVideo(video);
    setShowCaptionModal(true);
    setLoadingCaption(true);
    setCaptionContent("");

    try {
      const cacheVersion = localStorage.getItem(`video-cache-version-${video.id}`);
      const versionParam = cacheVersion ? `?v=${cacheVersion}` : '';
      
      const response = await fetch(`/api/videos/${video.id}/captions.txt${versionParam}`);
      if (response.ok) {
        const text = await response.text();
        setCaptionContent(text || "No captions available for this video.");
      } else {
        setCaptionContent("Failed to load captions for this video.");
      }
    } catch (error) {
      console.error("Error loading captions:", error);
      setCaptionContent("Error loading captions. Please try again.");
    } finally {
      setLoadingCaption(false);
    }
  };

  const handleDownloadThumbnail = (video: any) => {
    const cacheVersion = localStorage.getItem(`video-cache-version-${video.id}`);
    const versionParam = cacheVersion ? `?v=${cacheVersion}` : '';
    window.open(`/api/videos/${video.id}/thumbnail${versionParam}`, "_blank");
  };

  const handleDownloadCaption = (video: any) => {
    const cacheVersion = localStorage.getItem(`video-cache-version-${video.id}`);
    const versionParam = cacheVersion ? `?v=${cacheVersion}` : '';
    window.open(`/api/videos/${video.id}/captions.txt${versionParam}`, "_blank");
  };
  */

  // Moved into unified handleExportMetadata function

  const handleExportMetadata = async (format: 'excel' | 'csv') => {
    try {
      if (format === 'excel') {
        setExportingExcel(true);
      } else {
        setExportingCsv(true);
      }

      const videoIds = videos.map(v => v.id);
      
      const response = await fetch("/api/videos/export-metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videoIds, format }),
      });

      if (!response.ok) {
        throw new Error("Failed to export metadata");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === 'excel' ? "vimeo-metadata.xlsx" : "vimeo-metadata.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: `Exported metadata for ${videoIds.length} videos to ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: `Failed to export metadata to ${format.toUpperCase()}`,
        variant: "destructive",
      });
    } finally {
      if (format === 'excel') {
        setExportingExcel(false);
      } else {
        setExportingCsv(false);
      }
    }
  };

  const handleExportCsv = () => handleExportMetadata('csv');
  const handleExportExcel = () => handleExportMetadata('excel');

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            <p className="text-muted-foreground">Loading metadata...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!videos || videos.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border shadow-xl bg-card">
      <CardHeader className="bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">Video Metadata</CardTitle>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleGlobalCacheRefresh}
              disabled={refreshingCache}
              variant="outline"
              size="sm"
              className="gap-2 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
              title="Refresh thumbnails and captions for all videos"
            >
              <RefreshCw className={`h-4 w-4 ${refreshingCache ? 'animate-spin' : ''}`} />
              {refreshingCache ? "Refreshing..." : "Refresh Cache"}
            </Button>
            
            <div className="w-px h-6 bg-gray-200" />
            
            <Button
              onClick={handleExportExcel}
              disabled={exportingExcel}
              variant="outline"
              size="sm"
              className="gap-2 border-green-300 text-green-700 hover:border-green-400 hover:bg-green-50 font-medium"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {exportingExcel ? "Exporting..." : "Excel"}
            </Button>
            
            <Button
              onClick={handleExportCsv}
              disabled={exportingCsv}
              variant="outline"
              size="sm"
              className="gap-2 border-blue-300 text-blue-700 hover:border-blue-400 hover:bg-blue-50"
            >
              <FileText className="h-4 w-4" />
              {exportingCsv ? "Exporting..." : "CSV"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[1500px]">
            <table className="w-full border-collapse">
              <thead className="bg-muted/50 sticky top-0 z-10">
                <tr>
                  <th className="text-left p-3 font-semibold text-sm border-b">ID</th>
                  <th className="text-left p-3 font-semibold text-sm border-b">Title</th>
                  <th className="text-left p-3 font-semibold text-sm border-b">Description</th>
                  <th className="text-left p-3 font-semibold text-sm border-b">Tags</th>
                  <th className="text-left p-3 font-semibold text-sm border-b">Duration</th>
                  <th className="text-left p-3 font-semibold text-sm border-b">Created</th>
                  <th className="text-left p-3 font-semibold text-sm border-b">Privacy</th>
                  <th className="text-center p-3 font-semibold text-sm border-b">Views</th>
                  <th className="text-center p-3 font-semibold text-sm border-b">Likes</th>
                  <th className="text-left p-3 font-semibold text-sm border-b">Resolution</th>
                  <th className="text-left p-3 font-semibold text-sm border-b">Size</th>
                </tr>
              </thead>
              <tbody>
                {videos.map((video, index) => (
                  <tr key={video.id} className={index % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <td className="p-3 text-sm font-mono">{video.id}</td>
                    <td className="p-3">
                      <div className="max-w-[200px]">
                        <p className="font-medium truncate">{video.name || "Untitled"}</p>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="max-w-[250px]">
                        <p className="text-sm text-muted-foreground truncate">
                          {video.description || "No description"}
                        </p>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="max-w-[150px]">
                        <p className="text-sm truncate">
                          {Array.isArray(video.tags) ? video.tags.join(", ") : video.tags || "No tags"}
                        </p>
                      </div>
                    </td>
                    <td className="p-3 text-sm">
                      {video.duration ? formatDuration(video.duration) : "N/A"}
                    </td>
                    <td className="p-3 text-sm">
                      {video.created_time ? new Date(video.created_time).toLocaleDateString() : "N/A"}
                    </td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {video.privacy || "unknown"}
                      </span>
                    </td>
                    <td className="p-3 text-center text-sm">{video.views || 0}</td>
                    <td className="p-3 text-center text-sm">{video.likes || 0}</td>
                    <td className="p-3 text-sm">{video.resolution || "N/A"}</td>
                    <td className="p-3 text-sm">{formatFileSize(video.fileSize)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>

      {/* Modals removed since columns are no longer displayed in frontend view */}
      {/* These modals are kept for potential future use but commented out */}
      {/*
      <Dialog open={showThumbnailModal} onOpenChange={setShowThumbnailModal}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Thumbnail Preview - {selectedVideo?.name}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleDownloadThumbnail(selectedVideo)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowThumbnailModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
            {selectedVideo && (
              <img
                src={`/api/videos/${selectedVideo.id}/thumbnail${localStorage.getItem(`video-cache-version-${selectedVideo.id}`) ? `?v=${localStorage.getItem(`video-cache-version-${selectedVideo.id}`)}` : ''}`}
                alt={`Thumbnail for ${selectedVideo.name}`}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="400" height="300" fill="%23f3f4f6"/><text x="200" y="150" text-anchor="middle" dy=".3em" fill="%236b7280">Thumbnail not available</text></svg>';
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCaptionModal} onOpenChange={setShowCaptionModal}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <span>Captions Preview - {selectedVideo?.name}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleDownloadCaption(selectedVideo)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCaptionModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                {loadingCaption ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <span className="ml-2">Loading captions...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap text-sm font-mono break-words">
                    {captionContent}
                  </pre>
                )}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
      */}
    </>
  );
}
