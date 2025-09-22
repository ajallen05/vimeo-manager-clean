import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchVideoCaptions } from "@/lib/vimeo-api";
import { Download, FileText, Subtitles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { VimeoVideo, VideoCaption } from "@shared/schema";

interface CaptionModalProps {
  video: VimeoVideo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CaptionFormat = "vtt" | "txt";

export default function CaptionModal({ video, open, onOpenChange }: CaptionModalProps) {
  const [captionFormat, setCaptionFormat] = useState<CaptionFormat>("vtt");

  const { data: caption, isLoading, error } = useQuery({
    queryKey: ["/api/videos", video.id, "captions"],
    queryFn: () => fetchVideoCaptions(video.id),
    enabled: open,
  });

  const handleDownload = () => {
    if (!caption) return;

    const content = captionFormat === "vtt" ? caption.vttContent : caption.txtContent;
    const filename = `${video.name}_captions.${captionFormat}`;
    
    const blob = new Blob([content || ""], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const displayContent = caption 
    ? (captionFormat === "vtt" ? caption.vttContent : caption.txtContent)
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Video Captions</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex space-x-4">
            <Button
              variant={captionFormat === "vtt" ? "default" : "secondary"}
              size="sm"
              onClick={() => setCaptionFormat("vtt")}
              data-testid="format-vtt"
            >
              <Subtitles className="w-4 h-4 mr-1" />
              VTT Format
            </Button>
            <Button
              variant={captionFormat === "txt" ? "default" : "secondary"}
              size="sm"
              onClick={() => setCaptionFormat("txt")}
              data-testid="format-txt"
            >
              <FileText className="w-4 h-4 mr-1" />
              TXT Format
            </Button>
          </div>

          <div className="bg-muted rounded-lg p-4 h-64 overflow-auto">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : error ? (
              <div className="text-destructive text-sm">
                Failed to load captions for this video.
              </div>
            ) : !caption ? (
              <div className="text-muted-foreground text-sm">
                No captions available for this video.
              </div>
            ) : (
              <pre className="text-sm font-mono whitespace-pre-wrap" data-testid="caption-content">
                {displayContent}
              </pre>
            )}
          </div>

          <div className="flex justify-end space-x-3">
            <Button variant="secondary" onClick={() => onOpenChange(false)} data-testid="caption-close">
              Close
            </Button>
            {caption && (
              <Button onClick={handleDownload} data-testid="caption-download">
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
