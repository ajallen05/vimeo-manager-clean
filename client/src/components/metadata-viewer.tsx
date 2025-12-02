import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Eye, Settings } from "lucide-react";
import { fetchPresets } from "@/lib/vimeo-api";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface VideoDetails {
  id: string;
  name: string;
  description: string;
  tags: string[];
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
  presetId: string | null;
  embedHtml: string | null;
}

interface PresetDetails {
  uri: string;
  name: string;
  settings?: any;
}

export default function MetadataViewer() {
  const [videoId, setVideoId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null);
  const [presetDetails, setPresetDetails] = useState<PresetDetails | null>(null);
  const [allPresets, setAllPresets] = useState<PresetDetails[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // Fetch all presets on mount for reference
    fetchPresets()
      .then(setAllPresets)
      .catch(console.error);
  }, []);

  const handleFetchVideo = async () => {
    if (!videoId.trim()) {
      toast({
        title: "Video ID Required",
        description: "Please enter a valid Vimeo video ID.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setVideoDetails(null);
    setPresetDetails(null);

    try {
      // Fetch video details from our API
      const response = await fetch(`/api/videos/${videoId.trim()}/details`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch video details");
      }

      const data = await response.json();
      setVideoDetails(data);

      // If video has a preset, find it in allPresets
      if (data.presetId && allPresets.length > 0) {
        const preset = allPresets.find(p => p.uri.includes(data.presetId));
        if (preset) {
          setPresetDetails(preset);
        }
      }

      toast({
        title: "Video Found",
        description: `Loaded metadata for "${data.name}"`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to fetch video details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "N/A";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "N/A";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Find Video
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleFetchVideo();
            }}
            className="flex gap-4"
          >
            <Input
              placeholder="Enter Vimeo Video ID (e.g., 123456789)"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  View Metadata
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Video Metadata Section */}
      {videoDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Video Metadata
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Property</TableHead>
                    <TableHead>Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Video ID</TableCell>
                    <TableCell className="font-mono">{videoDetails.id}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Title</TableCell>
                    <TableCell>{videoDetails.name || "Untitled"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Description</TableCell>
                    <TableCell className="max-w-md">
                      <p className="whitespace-pre-wrap">{videoDetails.description || "No description"}</p>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Tags</TableCell>
                    <TableCell>
                      {videoDetails.tags && videoDetails.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {videoDetails.tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "No tags"
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Duration</TableCell>
                    <TableCell>{formatDuration(videoDetails.duration)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Created</TableCell>
                    <TableCell>
                      {videoDetails.created_time
                        ? new Date(videoDetails.created_time).toLocaleString()
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Modified</TableCell>
                    <TableCell>
                      {videoDetails.modified_time
                        ? new Date(videoDetails.modified_time).toLocaleString()
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Privacy</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        {videoDetails.privacy || "Unknown"}
                      </span>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Views</TableCell>
                    <TableCell>{videoDetails.views?.toLocaleString() || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Likes</TableCell>
                    <TableCell>{videoDetails.likes?.toLocaleString() || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Comments</TableCell>
                    <TableCell>{videoDetails.comments?.toLocaleString() || 0}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Resolution</TableCell>
                    <TableCell>{videoDetails.resolution || "N/A"}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">File Size</TableCell>
                    <TableCell>{formatFileSize(videoDetails.fileSize)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Status</TableCell>
                    <TableCell>
                      <span className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                        {videoDetails.status || "Unknown"}
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Preset Section */}
      {videoDetails && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Embed Preset
            </CardTitle>
          </CardHeader>
          <CardContent>
            {videoDetails.presetId ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Preset ID</p>
                      <p className="font-mono font-medium">{videoDetails.presetId}</p>
                    </div>
                    {presetDetails && (
                      <div>
                        <p className="text-sm text-muted-foreground">Preset Name</p>
                        <p className="font-medium">{presetDetails.name}</p>
                      </div>
                    )}
                  </div>
                </div>
                {presetDetails?.settings && (
                  <div className="p-4 rounded-lg bg-muted/30">
                    <p className="text-sm font-medium mb-2">Preset Settings</p>
                    <pre className="text-xs overflow-auto max-h-[200px] p-2 bg-background rounded">
                      {JSON.stringify(presetDetails.settings, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No embed preset applied to this video</p>
                <p className="text-sm mt-2">
                  You can apply a preset using the "Edit Metadata" section
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Available Presets Reference */}
      {allPresets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Available Presets ({allPresets.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Preset ID</TableHead>
                    <TableHead>Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPresets.map((preset) => (
                    <TableRow key={preset.uri}>
                      <TableCell className="font-mono text-sm">
                        {preset.uri.split("/").pop()}
                      </TableCell>
                      <TableCell>{preset.name}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

