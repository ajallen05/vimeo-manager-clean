import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Upload, FileText, Edit, Save, Settings, Eye, Lock, Image, MessageSquare, Download, Globe, Palette, List, Subtitles, RefreshCw, FolderOpen } from "lucide-react";
import { bulkUpdateVideos, updateVideo, fetchPresets } from "@/lib/vimeo-api";
import type { UpdateVideo } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import PresetEditor from "./preset-editor";
import { useFolderOperations } from "@/stores/folderStore";

interface ExtendedUpdateVideo extends UpdateVideo {
  privacy?: "anybody" | "nobody" | "password" | "unlisted" | "disable";
  password?: string;
  commentsEnabled?: boolean;
  downloadEnabled?: boolean;
  embedDomains?: string;
  playerColor?: string;
  playbar?: boolean;
  volume?: boolean;
  speed?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  thumbnailTime?: number;
}

export default function MetadataEditor() {
  const [activeTab, setActiveTab] = useState<"bulk" | "single" | "folder" | "preset">("bulk");
  const { toast } = useToast();
  const [presets, setPresets] = useState<any[]>([]);
  const [showcases, setShowcases] = useState<any[]>([]);
  
  // Folder preset state
  const { folders } = useFolderOperations();
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [selectedFolderPresetId, setSelectedFolderPresetId] = useState("");
  const [folderVideos, setFolderVideos] = useState<any[]>([]);
  const [isLoadingFolderVideos, setIsLoadingFolderVideos] = useState(false);
  const [isApplyingFolderPreset, setIsApplyingFolderPreset] = useState(false);
  const [folderPresetResults, setFolderPresetResults] = useState<{
    successCount: number;
    errorCount: number;
    errors: any[];
  } | null>(null);

  useEffect(() => {
    fetchPresets().then(setPresets).catch(console.error);
    // Fetch showcases
    fetch("/api/showcases")
      .then(res => res.json())
      .then(setShowcases)
      .catch(console.error);
  }, []);
  
  // Load videos when folder is selected
  const loadFolderVideos = async (folderId: string) => {
    if (!folderId) {
      setFolderVideos([]);
      return;
    }
    
    setIsLoadingFolderVideos(true);
    try {
      const response = await fetch(`/api/folders/${folderId}/videos`);
      if (!response.ok) throw new Error("Failed to load videos");
      const videos = await response.json();
      setFolderVideos(videos);
      toast({
        title: "Folder Loaded",
        description: `Found ${videos.length} videos in folder`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load folder videos",
        variant: "destructive",
      });
      setFolderVideos([]);
    } finally {
      setIsLoadingFolderVideos(false);
    }
  };
  
  const handleApplyPresetToFolder = async () => {
    if (!selectedFolderPresetId || folderVideos.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select a folder with videos and a preset",
        variant: "destructive",
      });
      return;
    }
    
    setIsApplyingFolderPreset(true);
    setFolderPresetResults(null);
    
    try {
      const response = await fetch("/api/folders/apply-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId: selectedFolderId,
          presetId: selectedFolderPresetId,
          videoIds: folderVideos.map(v => v.id),
        }),
      });
      
      if (!response.ok) throw new Error("Failed to apply preset");
      
      const result = await response.json();
      setFolderPresetResults({
        successCount: result.successCount || 0,
        errorCount: result.errorCount || 0,
        errors: result.errors || [],
      });
      
      toast({
        title: "Preset Applied",
        description: `Applied to ${result.successCount} videos. Failed: ${result.errorCount}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply preset to folder",
        variant: "destructive",
      });
    } finally {
      setIsApplyingFolderPreset(false);
    }
  };

  // Bulk State
  const [csvContent, setCsvContent] = useState<string>("");
  const [parsedUpdates, setParsedUpdates] = useState<UpdateVideo[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkResults, setBulkResults] = useState<{
    successCount: number;
    errorCount: number;
    errors: any[];
  } | null>(null);

  // Single State
  const [singleVideoId, setSingleVideoId] = useState("");
  const [singleVideoData, setSingleVideoData] = useState<ExtendedUpdateVideo>({ videoId: "" });
  const [isUpdatingSingle, setIsUpdatingSingle] = useState(false);
  
  // File uploads
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [captionFile, setCaptionFile] = useState<File | null>(null);
  const [captionLanguage, setCaptionLanguage] = useState("en");
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isUploadingCaption, setIsUploadingCaption] = useState(false);
  
  // Chapters
  const [chapters, setChapters] = useState<{ time: string; title: string }[]>([]);
  const [isAddingChapters, setIsAddingChapters] = useState(false);
  
  // Showcase
  const [selectedShowcase, setSelectedShowcase] = useState("");
  const [isAddingToShowcase, setIsAddingToShowcase] = useState(false);

  // CSV Parser
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  // Parse a CSV line handling quoted fields properly
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const parseCSV = (text: string) => {
    try {
      const lines = text.split(/\r\n|\n/);
      const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
      
      const updates: UpdateVideo[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = parseCSVLine(lines[i]);
        const update: any = {};
        
        headers.forEach((header, index) => {
          const value = values[index]?.trim();
          if (value && value.toLowerCase() !== 'null' && value !== '') {
             if (header === 'video_id' || header === 'id') update.videoId = value;
             else if (header === 'title' || header === 'name') update.name = value;
             else if (header === 'description') update.description = value;
             else if (header === 'tags') update.tags = value;
             else if (header === 'preset' || header === 'preset_id') update.presetId = value;
             else if (header === 'privacy') update.privacy = value;
          }
        });

        if (update.videoId) {
          updates.push(update);
        }
      }
      
      setParsedUpdates(updates);
      setBulkResults(null);
      
      toast({
        title: "CSV Parsed Successfully",
        description: `Found ${updates.length} videos to update`,
      });
    } catch (error) {
      console.error("CSV Parse Error:", error);
      toast({
        title: "Error parsing CSV",
        description: "Please check the file format.",
        variant: "destructive",
      });
    }
  };

  const handleBulkUpdate = async () => {
    if (parsedUpdates.length === 0) return;
    
    setIsProcessing(true);
    try {
      const result = await bulkUpdateVideos(parsedUpdates);
      setBulkResults({
        successCount: result.results?.length || 0,
        errorCount: result.errors?.length || 0,
        errors: result.errors || []
      });
      
      toast({
        title: "Bulk Update Complete",
        description: `Updated ${result.results?.length || 0} videos. Failed: ${result.errors?.length || 0}`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSingleUpdate = async () => {
    if (!singleVideoData.videoId) return;
    
    setIsUpdatingSingle(true);
    try {
      await updateVideo(singleVideoData as any);
      toast({
        title: "Video Updated",
        description: "Metadata has been successfully updated.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingSingle(false);
    }
  };

  const handleThumbnailUpload = async () => {
    if (!thumbnailFile || !singleVideoId) return;
    
    setIsUploadingThumbnail(true);
    try {
      const formData = new FormData();
      formData.append("thumbnail", thumbnailFile);
      
      const response = await fetch(`/api/videos/${singleVideoId}/thumbnail`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Failed to upload thumbnail");
      
      toast({ title: "Thumbnail uploaded successfully" });
      setThumbnailFile(null);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleCaptionUpload = async () => {
    if (!captionFile || !singleVideoId) return;
    
    setIsUploadingCaption(true);
    try {
      const formData = new FormData();
      formData.append("caption", captionFile);
      formData.append("language", captionLanguage);
      
      const response = await fetch(`/api/videos/${singleVideoId}/captions`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Failed to upload caption");
      
      toast({ title: "Caption uploaded successfully" });
      setCaptionFile(null);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingCaption(false);
    }
  };

  const handleAddChapters = async () => {
    if (!singleVideoId || chapters.length === 0) return;
    
    setIsAddingChapters(true);
    try {
      const chaptersData = chapters
        .filter(c => c.time && c.title)
        .map(c => ({
          time: parseTimeToSeconds(c.time),
          title: c.title
        }));
      
      const response = await fetch(`/api/videos/${singleVideoId}/chapters`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chapters: chaptersData }),
      });
      
      if (!response.ok) throw new Error("Failed to add chapters");
      
      toast({ title: "Chapters added successfully" });
      setChapters([]);
    } catch (error) {
      toast({
        title: "Failed to add chapters",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsAddingChapters(false);
    }
  };

  const parseTimeToSeconds = (time: string): number => {
    const parts = time.split(":").map(Number);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return Number(time) || 0;
  };

  const handleAddToShowcase = async () => {
    if (!singleVideoId || !selectedShowcase) return;
    
    setIsAddingToShowcase(true);
    try {
      const response = await fetch(`/api/videos/${singleVideoId}/showcases/${selectedShowcase}`, {
        method: "POST",
      });
      
      if (!response.ok) throw new Error("Failed to add to showcase");
      
      toast({ title: "Video added to showcase successfully" });
    } catch (error) {
      toast({
        title: "Failed to add to showcase",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsAddingToShowcase(false);
    }
  };

  const addChapterRow = () => {
    setChapters([...chapters, { time: "", title: "" }]);
  };

  const updateChapter = (index: number, field: "time" | "title", value: string) => {
    const updated = [...chapters];
    updated[index][field] = value;
    setChapters(updated);
  };

  const removeChapter = (index: number) => {
    setChapters(chapters.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-8">
          <TabsTrigger value="bulk" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Bulk Edit (CSV)
          </TabsTrigger>
          <TabsTrigger value="single" className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Individual Edit
          </TabsTrigger>
          <TabsTrigger value="folder" className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Folder Preset
          </TabsTrigger>
          <TabsTrigger value="preset" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Edit Preset
          </TabsTrigger>
        </TabsList>

        {/* Bulk Edit Tab */}
        <TabsContent value="bulk" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Metadata Update</CardTitle>
              <CardDescription>Upload a CSV file to update multiple videos at once</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 border-2 border-dashed rounded-lg bg-muted/50 text-center">
                <Input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer block space-y-2">
                  <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
                  <span className="text-sm text-muted-foreground block">
                    Click to upload CSV file
                  </span>
                  <span className="text-xs text-muted-foreground block">
                    Headers: video_id (required), title, description, tags, privacy, preset_id
                  </span>
                </label>
              </div>

              {parsedUpdates.length > 0 && (
                <div className="space-y-4">
                  {/* Main Update Button - Highly Visible */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
                    <Button 
                      onClick={handleBulkUpdate} 
                      disabled={isProcessing}
                      className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                      size="lg"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing {parsedUpdates.length} videos...
                        </>
                      ) : (
                        <>
                          <Save className="w-5 h-5 mr-2" />
                          Update All {parsedUpdates.length} Videos
                        </>
                      )}
                    </Button>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <h3 className="font-medium">Preview ({parsedUpdates.length} videos)</h3>
                  </div>
                  
                  <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Video ID</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Tags</TableHead>
                          <TableHead>Preset ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedUpdates.slice(0, 100).map((update, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono">{update.videoId}</TableCell>
                            <TableCell>{update.name || <span className="text-muted-foreground italic">No change</span>}</TableCell>
                            <TableCell className="truncate max-w-[200px]">{update.description || <span className="text-muted-foreground italic">No change</span>}</TableCell>
                            <TableCell>{update.tags || <span className="text-muted-foreground italic">No change</span>}</TableCell>
                            <TableCell>{update.presetId || <span className="text-muted-foreground italic">No change</span>}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  
                </div>
              )}

              {bulkResults && (
                <div className="p-4 rounded-lg bg-muted space-y-2">
                  <h4 className="font-medium">Results</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-green-600">Success: {bulkResults.successCount}</div>
                    <div className="text-red-600">Failed: {bulkResults.errorCount}</div>
                  </div>
                  {bulkResults.errors.length > 0 && (
                    <div className="mt-4 max-h-[200px] overflow-y-auto text-xs text-red-500 space-y-1">
                      {bulkResults.errors.map((err, i) => (
                        <div key={i}>{err.videoId}: {err.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Single Edit Tab */}
        <TabsContent value="single" className="space-y-6">
          {/* Video ID Input */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit className="w-5 h-5" />
                Edit Video
              </CardTitle>
              <CardDescription>Enter the video ID to edit its metadata and settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Input
                  placeholder="Enter Video ID (e.g., 123456789)"
                  value={singleVideoId}
                  onChange={(e) => {
                    setSingleVideoId(e.target.value);
                    setSingleVideoData(prev => ({ ...prev, videoId: e.target.value }));
                  }}
                  className="flex-1"
                />
              </div>
            </CardContent>
          </Card>

          {singleVideoId && (
            <div className="flex flex-col">
              <ScrollArea className="h-[calc(100vh-450px)]">
              <Accordion type="multiple" defaultValue={["basic", "privacy"]} className="space-y-4">
                {/* Basic Metadata */}
                <AccordionItem value="basic" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      <span>Basic Metadata</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        placeholder="Video Title"
                        value={singleVideoData.name || ""}
                        onChange={(e) => setSingleVideoData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        placeholder="Video Description"
                        value={singleVideoData.description || ""}
                        onChange={(e) => setSingleVideoData(prev => ({ ...prev, description: e.target.value }))}
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Tags</Label>
                      <Input
                        placeholder="Comma separated tags (e.g., tutorial, demo, product)"
                        value={singleVideoData.tags || ""}
                        onChange={(e) => setSingleVideoData(prev => ({ ...prev, tags: e.target.value }))}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Privacy Settings */}
                <AccordionItem value="privacy" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      <span>Privacy Settings</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Privacy</Label>
                      <Select
                        value={singleVideoData.privacy || "no-change"}
                        onValueChange={(value) => setSingleVideoData(prev => ({ 
                          ...prev, 
                          privacy: value === "no-change" ? undefined : value as any 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select privacy setting" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no-change">No change</SelectItem>
                          <SelectItem value="anybody">Public (Anybody)</SelectItem>
                          <SelectItem value="nobody">Private (Nobody)</SelectItem>
                          <SelectItem value="password">Password Protected</SelectItem>
                          <SelectItem value="unlisted">Unlisted</SelectItem>
                          <SelectItem value="disable">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {singleVideoData.privacy === "password" && (
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <Input
                          type="password"
                          placeholder="Enter password"
                          value={singleVideoData.password || ""}
                          onChange={(e) => setSingleVideoData(prev => ({ ...prev, password: e.target.value }))}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Comments</Label>
                        <p className="text-xs text-muted-foreground">Allow comments on this video</p>
                      </div>
                      <Switch
                        checked={singleVideoData.commentsEnabled ?? true}
                        onCheckedChange={(checked) => setSingleVideoData(prev => ({ ...prev, commentsEnabled: checked }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Downloads</Label>
                        <p className="text-xs text-muted-foreground">Allow viewers to download this video</p>
                      </div>
                      <Switch
                        checked={singleVideoData.downloadEnabled ?? false}
                        onCheckedChange={(checked) => setSingleVideoData(prev => ({ ...prev, downloadEnabled: checked }))}
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Player Settings */}
                <AccordionItem value="player" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4" />
                      <span>Player Settings</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Embed Preset</Label>
                      <Select
                        value={singleVideoData.presetId || "no-change"}
                        onValueChange={(value) => setSingleVideoData(prev => ({ 
                          ...prev, 
                          presetId: value === "no-change" ? undefined : value 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a preset" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="no-change">No change</SelectItem>
                          {presets.map(preset => (
                            <SelectItem key={preset.uri} value={preset.uri.split('/').pop()}>
                              {preset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Player Color</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={singleVideoData.playerColor || "#00adef"}
                          onChange={(e) => setSingleVideoData(prev => ({ ...prev, playerColor: e.target.value }))}
                          className="w-12 h-10 p-1"
                        />
                        <Input
                          value={singleVideoData.playerColor || ""}
                          onChange={(e) => setSingleVideoData(prev => ({ ...prev, playerColor: e.target.value }))}
                          placeholder="#00adef"
                          className="flex-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center justify-between">
                        <Label>Playbar</Label>
                        <Switch
                          checked={singleVideoData.playbar ?? true}
                          onCheckedChange={(checked) => setSingleVideoData(prev => ({ ...prev, playbar: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Volume</Label>
                        <Switch
                          checked={singleVideoData.volume ?? true}
                          onCheckedChange={(checked) => setSingleVideoData(prev => ({ ...prev, volume: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Speed Controls</Label>
                        <Switch
                          checked={singleVideoData.speed ?? false}
                          onCheckedChange={(checked) => setSingleVideoData(prev => ({ ...prev, speed: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Autoplay</Label>
                        <Switch
                          checked={singleVideoData.autoplay ?? false}
                          onCheckedChange={(checked) => setSingleVideoData(prev => ({ ...prev, autoplay: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label>Loop</Label>
                        <Switch
                          checked={singleVideoData.loop ?? false}
                          onCheckedChange={(checked) => setSingleVideoData(prev => ({ ...prev, loop: checked }))}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Embedding Rules */}
                <AccordionItem value="embedding" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      <span>Embedding Rules</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Allowed Domains</Label>
                      <Input
                        placeholder="Comma separated domains (e.g., example.com, mysite.org)"
                        value={singleVideoData.embedDomains || ""}
                        onChange={(e) => setSingleVideoData(prev => ({ ...prev, embedDomains: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">Leave empty to allow embedding anywhere</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Thumbnail */}
                <AccordionItem value="thumbnail" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Image className="w-4 h-4" />
                      <span>Thumbnail</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Thumbnail Time (seconds)</Label>
                      <Input
                        type="number"
                        placeholder="Time in seconds for auto-generated thumbnail"
                        value={singleVideoData.thumbnailTime || ""}
                        onChange={(e) => setSingleVideoData(prev => ({ ...prev, thumbnailTime: Number(e.target.value) }))}
                      />
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label>Upload Custom Thumbnail</Label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleThumbnailUpload} 
                          disabled={!thumbnailFile || isUploadingThumbnail}
                          size="sm"
                        >
                          {isUploadingThumbnail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Captions/Subtitles */}
                <AccordionItem value="captions" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Subtitles className="w-4 h-4" />
                      <span>Subtitles/Captions</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select value={captionLanguage} onValueChange={setCaptionLanguage}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Spanish</SelectItem>
                          <SelectItem value="fr">French</SelectItem>
                          <SelectItem value="de">German</SelectItem>
                          <SelectItem value="it">Italian</SelectItem>
                          <SelectItem value="pt">Portuguese</SelectItem>
                          <SelectItem value="ja">Japanese</SelectItem>
                          <SelectItem value="ko">Korean</SelectItem>
                          <SelectItem value="zh">Chinese</SelectItem>
                          <SelectItem value="ar">Arabic</SelectItem>
                          <SelectItem value="hi">Hindi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Caption File (VTT or SRT)</Label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept=".vtt,.srt"
                          onChange={(e) => setCaptionFile(e.target.files?.[0] || null)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleCaptionUpload} 
                          disabled={!captionFile || isUploadingCaption}
                          size="sm"
                        >
                          {isUploadingCaption ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Chapters */}
                <AccordionItem value="chapters" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <List className="w-4 h-4" />
                      <span>Chapters</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    {chapters.map((chapter, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <Input
                          placeholder="Time (e.g., 1:30 or 90)"
                          value={chapter.time}
                          onChange={(e) => updateChapter(index, "time", e.target.value)}
                          className="w-32"
                        />
                        <Input
                          placeholder="Chapter title"
                          value={chapter.title}
                          onChange={(e) => updateChapter(index, "title", e.target.value)}
                          className="flex-1"
                        />
                        <Button variant="ghost" size="sm" onClick={() => removeChapter(index)}>
                          ✕
                        </Button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={addChapterRow}>
                        + Add Chapter
                      </Button>
                      {chapters.length > 0 && (
                        <Button 
                          size="sm" 
                          onClick={handleAddChapters}
                          disabled={isAddingChapters}
                        >
                          {isAddingChapters ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                          Save Chapters
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Collections/Showcases */}
                <AccordionItem value="showcases" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <span>Collections/Showcases</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <div className="flex gap-2">
                      <Select value={selectedShowcase} onValueChange={setSelectedShowcase}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select a showcase" />
                        </SelectTrigger>
                        <SelectContent>
                          {showcases.map(showcase => (
                            <SelectItem key={showcase.uri} value={showcase.uri.split('/').pop()}>
                              {showcase.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={handleAddToShowcase}
                        disabled={!selectedShowcase || isAddingToShowcase}
                        size="sm"
                      >
                        {isAddingToShowcase ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add"}
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Replace Video */}
                <AccordionItem value="replace" className="border rounded-lg px-4">
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4" />
                      <span>Replace Video File</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-4">
                    <p className="text-sm text-muted-foreground">
                      To replace the video file while keeping the same URL, go to the <strong>Replace Existing</strong> mode 
                      on the Upload page and enter this video ID: <code className="bg-muted px-1 rounded">{singleVideoId}</code>
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              </ScrollArea>
              
              {/* Save Button - Outside ScrollArea so always visible */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
                <Button 
                  onClick={handleSingleUpdate}
                  disabled={isUpdatingSingle || !singleVideoData.videoId}
                  className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                  size="lg"
                >
                  {isUpdatingSingle ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Saving to Vimeo...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Save Changes to Vimeo
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Folder Preset Tab */}
        <TabsContent value="folder" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5" />
                Apply Preset to Entire Folder
              </CardTitle>
              <CardDescription>
                Select a folder and apply a preset to all videos in that folder at once
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1: Select Folder */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">Step 1: Select Folder</Label>
                <Select
                  value={selectedFolderId}
                  onValueChange={(id) => {
                    setSelectedFolderId(id);
                    setFolderPresetResults(null);
                    if (id) loadFolderVideos(id);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a folder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name} ({folder.path || folder.name})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Videos in folder */}
              {selectedFolderId && (
                <div className="space-y-2">
                  {isLoadingFolderVideos ? (
                    <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Loading videos...</span>
                    </div>
                  ) : folderVideos.length > 0 ? (
                    <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="font-medium text-blue-800 dark:text-blue-200">
                        {folderVideos.length} videos found in folder
                      </p>
                      <ScrollArea className="h-32 mt-2">
                        <div className="space-y-1">
                          {folderVideos.map((video) => (
                            <div key={video.id} className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                              <span className="font-mono text-xs">{video.id}</span>
                              <span>-</span>
                              <span className="truncate">{video.name}</span>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  ) : (
                    <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <p className="text-orange-700 dark:text-orange-300">No videos found in this folder</p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Select Preset */}
              {folderVideos.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Step 2: Select Preset</Label>
                  <Select
                    value={selectedFolderPresetId}
                    onValueChange={setSelectedFolderPresetId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a preset to apply..." />
                    </SelectTrigger>
                    <SelectContent>
                      {presets.map((preset) => (
                        <SelectItem key={preset.uri} value={preset.uri.split('/').pop()}>
                          {preset.name} (ID: {preset.uri.split('/').pop()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedFolderPresetId && (
                    <p className="text-sm text-muted-foreground">
                      Preset ID: <code className="bg-muted px-1 rounded">{selectedFolderPresetId}</code>
                    </p>
                  )}
                </div>
              )}

              {/* Apply Button */}
              {folderVideos.length > 0 && selectedFolderPresetId && (
                <div className="p-4 bg-green-50 dark:bg-green-950/30 border-2 border-green-200 dark:border-green-800 rounded-xl">
                  <Button
                    onClick={handleApplyPresetToFolder}
                    disabled={isApplyingFolderPreset}
                    className="w-full h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white"
                    size="lg"
                  >
                    {isApplyingFolderPreset ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Applying to {folderVideos.length} videos...
                      </>
                    ) : (
                      <>
                        <Palette className="w-5 h-5 mr-2" />
                        Apply Preset to All {folderVideos.length} Videos
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Results */}
              {folderPresetResults && (
                <div className="p-4 rounded-lg bg-muted space-y-2">
                  <h4 className="font-medium">Results</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-green-600 dark:text-green-400">
                      ✓ Success: {folderPresetResults.successCount}
                    </div>
                    <div className="text-red-600 dark:text-red-400">
                      ✗ Failed: {folderPresetResults.errorCount}
                    </div>
                  </div>
                  {folderPresetResults.errors.length > 0 && (
                    <div className="mt-4 max-h-[150px] overflow-y-auto text-xs text-red-500 space-y-1">
                      {folderPresetResults.errors.map((err, i) => (
                        <div key={i}>{err.videoId}: {err.error}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Edit Preset Tab */}
        <TabsContent value="preset" className="space-y-6">
          <PresetEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
