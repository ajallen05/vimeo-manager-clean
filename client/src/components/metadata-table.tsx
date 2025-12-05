import { useState, memo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileSpreadsheet, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { VimeoVideo } from "@shared/schema";

interface MetadataTableProps {
  videos: VimeoVideo[];
  isLoading: boolean;
}

function MetadataTable({ videos, isLoading }: MetadataTableProps) {
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const { toast } = useToast();

  const handleExportMetadata = async (format: 'excel' | 'csv') => {
    try {
      if (format === 'excel') {
        setExportingExcel(true);
      } else {
        setExportingCsv(true);
      }

      const videoIds = videos.map(v => v.id);
      
      // Use optimized endpoint for better performance
      const response = await fetch("/api/videos/export-metadata-optimized", {
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
                  <th className="text-left p-3 font-semibold text-sm border-b">Preset ID</th>
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
                    <td className="p-3 text-sm font-mono">
                      {video.presetId || "N/A"}
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
    </>
  );
}

export default memo(MetadataTable);
