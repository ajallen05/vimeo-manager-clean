// video-table.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Captions, Play, Download, Loader2, FileSpreadsheet, Eye } from "lucide-react";
import CaptionModal from "./caption-modal";
import VideoModal from "./video-modal";
import MetadataTable from "./metadata-table";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { VimeoVideo } from "@shared/schema";

interface VideoTableProps {
  videos: VimeoVideo[];
}

export default function VideoTable({ videos }: VideoTableProps) {
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [showCaptions, setShowCaptions] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [downloadingVideoId, setDownloadingVideoId] = useState<string | null>(null);
  const [selectedVideos, setSelectedVideos] = useState<string[]>([]);
  const [isDownloadingMetadata, setIsDownloadingMetadata] = useState(false);
  const [isDownloadingBulk, setIsDownloadingBulk] = useState(false);
  const [showMetadataTable, setShowMetadataTable] = useState(false);
  const [metadataVideos, setMetadataVideos] = useState<VimeoVideo[]>([]);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { toast } = useToast();

  // Reset pagination when videos change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedVideos([]);
  }, [videos.length, itemsPerPage]); // Reset when video count changes or page size changes

  // Calculate pagination
  const totalPages = Math.ceil(videos.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentVideos = videos.slice(startIndex, endIndex);

  const handleShowCaptions = (videoId: string) => {
    setSelectedVideoId(videoId);
    setShowCaptions(true);
  };

  const handleShowVideo = (videoId: string) => {
    setSelectedVideoId(videoId);
    setShowVideo(true);
  };

  const handleToggleSelect = (videoId: string) => {
    setSelectedVideos((prev) =>
      prev.includes(videoId)
        ? prev.filter((id) => id !== videoId)
        : [...prev, videoId]
    );
  };

  const handleToggleSelectAll = () => {
    setSelectedVideos((prev) =>
      prev.length === videos.length ? [] : videos.map((v) => v.id)
    );
  };

  const handleShowMetadata = (selectedIds: string[] = []) => {
    const videosToShow = selectedIds.length 
      ? videos.filter(v => selectedIds.includes(v.id))
      : videos;
    setMetadataVideos(videosToShow);
    setShowMetadataTable(true);
  };

  const handleBulkDownloadVideos = async (selectedIds: string[] = []) => {
    const idsToDownload = selectedIds.length ? selectedIds : videos.map(v => v.id);
    setIsDownloadingBulk(true);
    
    try {
      console.log('🚀 Starting bulk download for videos:', idsToDownload);
      
      // For large files, use a simple approach: trigger download directly with a form
      // This bypasses fetch API limitations for large file downloads
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/videos/bulk-download-simple';
      form.style.display = 'none';
      
      // Add video IDs as form data
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'videoIds';
      input.value = JSON.stringify(idsToDownload);
      form.appendChild(input);
      
      // Add content type
      const contentTypeInput = document.createElement('input');
      contentTypeInput.type = 'hidden';
      contentTypeInput.name = 'contentType';
      contentTypeInput.value = 'application/json';
      form.appendChild(contentTypeInput);
      
      document.body.appendChild(form);
      
      console.log('📤 Submitting download request...');
      form.submit();
      
      // Clean up
      document.body.removeChild(form);
      
      console.log('✅ Download request sent - file should start downloading automatically');
      alert('Download started! The ZIP file will be downloaded automatically once the server finishes processing.');
      
    } catch (error) {
      console.error("Bulk download failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to download videos";
      alert(errorMessage);
    } finally {
      setIsDownloadingBulk(false);
    }
  };

  const handleDownloadVideo = async (video: VimeoVideo, quality?: "source" | "hd" | "sd") => {
    if (downloadingVideoId === video.id) return;

    setDownloadingVideoId(video.id);
    try {
      console.log(`Starting download for video: ${video.id}`);
      const qs = quality ? `?quality=${quality}` : "";
      
      // Create a temporary anchor element that points to our API endpoint
      // Our API endpoint now redirects directly to Vimeo's download URL
      const downloadUrl = `/api/videos/${video.id}/download${qs}`;
      
      console.log(`Triggering download via: ${downloadUrl}`);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.style.display = 'none';
      a.target = '_blank'; // Open in new tab to handle redirect properly
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      console.log(`Download initiated successfully`);
    } catch (error) {
      console.error("Download failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Download failed";
      alert(`Download failed: ${errorMessage}. Please check your Vimeo API credentials.`);
    } finally {
      setDownloadingVideoId(null);
    }
  };

  const selectedVideo = videos.find((v) => v.id === selectedVideoId);

  return (
    <>
      <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/10 dark:to-purple-950/10 rounded-2xl border border-blue-200/50 dark:border-blue-800/50">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg flex items-center space-x-2">
              <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Download className="w-3 h-3 text-blue-600 dark:text-blue-400" />
              </div>
              <span>Bulk Actions</span>
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedVideos.length > 0 
                ? `${selectedVideos.length} videos selected`
                : `Download content for ${videos.length} videos`
              }
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleShowMetadata(selectedVideos)}
            className="gap-2 border-blue-300 text-blue-700 hover:border-blue-400 hover:bg-blue-50"
          >
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">{selectedVideos.length > 0 ? 'View Metadata (Selected)' : 'View Metadata'}</span>
            <span className="sm:hidden">Meta</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkDownloadVideos(selectedVideos)}
            disabled={isDownloadingBulk}
            className="gap-2 border-purple-300 text-purple-700 hover:border-purple-400 hover:bg-purple-50"
          >
            {isDownloadingBulk ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">{selectedVideos.length > 0 ? 'Selected ' : ''}Videos</span>
            <span className="sm:hidden">Vids</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleShowMetadata()}
            className="gap-2 border-green-300 text-green-700 hover:border-green-400 hover:bg-green-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">View Metadata (All)</span>
            <span className="sm:hidden">View All</span>
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkDownloadVideos()}
            disabled={isDownloadingBulk}
            className="gap-2 border-orange-300 text-orange-700 hover:border-orange-400 hover:bg-orange-50"
          >
            {isDownloadingBulk ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">All Videos</span>
            <span className="sm:hidden">All V</span>
          </Button>
        </div>
      </div>
      <div className="bg-white dark:bg-gray-900/50 rounded-2xl border border-border/50 overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20 border-b-2 border-border/20">
                <TableHead className="text-muted-foreground font-semibold w-12 text-center">
                  <Checkbox
                    checked={selectedVideos.length === videos.length}
                    onCheckedChange={() => handleToggleSelectAll()}
                    className="rounded-md"
                  />
                </TableHead>
                <TableHead className="text-muted-foreground font-semibold w-32">Video ID</TableHead>
                <TableHead className="text-muted-foreground font-semibold min-w-[200px]">Title</TableHead>
                <TableHead className="text-muted-foreground font-semibold w-32">Tags</TableHead>
                <TableHead className="text-muted-foreground font-semibold w-24 text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentVideos.map((video, index) => {
                const isSelected = selectedVideos.includes(video.id);
                // Adjust index for global counting
                const globalIndex = startIndex + index;
                return (
                <TableRow 
                  key={video.id} 
                  className={cn(
                    "group transition-all duration-200 border-b border-border/30",
                    isSelected 
                      ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 dark:from-blue-400/15 dark:to-purple-400/15" 
                      : "hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-purple-50/30 dark:hover:from-blue-950/10 dark:hover:to-purple-950/10"
                  )}
                >
                  <TableCell className="w-12 py-4 px-4 text-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleSelect(video.id)}
                      className={cn(
                        "rounded-md transition-all group-hover:scale-110",
                        isSelected && "border-white bg-white text-blue-600 dark:border-blue-300 dark:bg-blue-300"
                      )}
                    />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-mono text-sm py-4 px-4",
                      isSelected ? "text-foreground" : "text-muted-foreground"
                    )}
                    data-testid={`video-id-${video.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0",
                        isSelected 
                          ? "bg-gradient-to-br from-blue-500 to-purple-500 dark:from-blue-400 dark:to-purple-400"
                          : "bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30"
                      )}>
                        <span className={cn(
                          "text-xs font-bold",
                          isSelected ? "text-white" : "text-blue-600 dark:text-blue-400"
                        )}>{globalIndex + 1}</span>
                      </div>
                      <div className="truncate max-w-[100px]" title={video.id}>
                        <span className={cn(
                          "text-xs font-mono",
                          isSelected && "font-semibold"
                        )}>{video.id}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell
                    className="font-medium text-sm py-4 px-4"
                    data-testid={`video-title-${video.id}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-12 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                        isSelected
                          ? "bg-gradient-to-br from-blue-500 to-purple-500 dark:from-blue-400 dark:to-purple-400"
                          : "bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900"
                      )}>
                        <svg className={cn(
                          "w-4 h-4",
                          isSelected ? "text-white" : "text-gray-600 dark:text-gray-400"
                        )} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8,5.14V19.14L19,12.14L8,5.14Z" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={cn(
                          "truncate max-w-[250px] font-medium",
                          isSelected && "text-blue-700 dark:text-blue-300"
                        )} title={video.name}>
                          {video.name}
                        </div>
                        <div className={cn(
                          "text-xs mt-1",
                          isSelected ? "text-blue-600/80 dark:text-blue-400/80" : "text-muted-foreground"
                        )}>
                          Video • {video.id}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground text-sm py-4 px-4"
                    data-testid={`video-tags-${video.id}`}
                  >
                    <div className="space-y-1">
                      {video.tags && video.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {video.tags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              {tag}
                            </span>
                          ))}
                          {video.tags.length > 2 && (
                            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400">
                              +{video.tags.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex space-x-1">
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400">
                            default
                          </span>
                          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 dark:bg-gray-900/30 text-gray-600 dark:text-gray-400">
                            video
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 px-4">
                    <div className="flex items-center justify-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShowCaptions(video.id)}
                        data-testid={`caption-${video.id}`}
                        className="h-8 w-8 p-0 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 group/btn"
                        title="View Captions"
                      >
                        <Captions className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover/btn:scale-110 transition-transform" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShowVideo(video.id)}
                        data-testid={`view-video-${video.id}`}
                        className="h-8 w-8 p-0 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/30 group/btn"
                        title="View Video"
                      >
                        <Play className="w-4 h-4 text-purple-600 dark:text-purple-400 group-hover/btn:scale-110 transition-transform" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="p-4 border-t border-border/20 bg-muted/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Show</span>
              <Select
                value={itemsPerPage.toString()}
                onValueChange={(value) => {
                  setItemsPerPage(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[70px] h-8">
                  <SelectValue placeholder={itemsPerPage} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value={videos.length.toString()}>All</SelectItem>
                </SelectContent>
              </Select>
              <span>videos per page</span>
              <span className="ml-4">
                Showing {startIndex + 1}-{Math.min(endIndex, videos.length)} of {videos.length}
              </span>
            </div>

            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={cn("cursor-pointer", currentPage === 1 && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }).map((_, i) => {
                    const pageNumber = i + 1;
                    // Simple pagination logic: show first, last, current, and surrounding
                    if (
                      pageNumber === 1 ||
                      pageNumber === totalPages ||
                      (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={pageNumber}>
                          <PaginationLink
                            isActive={currentPage === pageNumber}
                            onClick={() => setCurrentPage(pageNumber)}
                            className="cursor-pointer"
                          >
                            {pageNumber}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (
                      (pageNumber === currentPage - 2 && currentPage > 3) ||
                      (pageNumber === currentPage + 2 && currentPage < totalPages - 2)
                    ) {
                      return <PaginationItem key={pageNumber}><PaginationEllipsis /></PaginationItem>;
                    }
                    return null;
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={cn("cursor-pointer", currentPage === totalPages && "pointer-events-none opacity-50")}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </div>
        </div>
      </div>

      {selectedVideo && (
        <>
          <CaptionModal
            video={selectedVideo}
            open={showCaptions}
            onOpenChange={setShowCaptions}
          />
          <VideoModal
            video={selectedVideo}
            open={showVideo}
            onOpenChange={setShowVideo}
          />
        </>
      )}

      {showMetadataTable && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
          <div className="container max-w-7xl mx-auto py-8 px-4">
            <div className="mb-4 flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm">
              <h2 className="text-3xl font-bold">Video Metadata Table</h2>
              <Button
                variant="outline"
                onClick={() => setShowMetadataTable(false)}
                className="gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </Button>
            </div>
            <MetadataTable videos={metadataVideos} isLoading={false} />
          </div>
        </div>
      )}
    </>
  );
}
