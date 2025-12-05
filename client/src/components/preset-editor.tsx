import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Settings, Eye, Save, Palette, Plus, Trash2, Copy } from "lucide-react";
import { fetchPresets, fetchPresetDetails } from "@/lib/vimeo-api";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface PresetSettings {
  buttons?: {
    like?: boolean;
    watchlater?: boolean;
    share?: boolean;
    embed?: boolean;
    hd?: boolean;
    fullscreen?: boolean;
    scaling?: boolean;
  };
  logos?: {
    vimeo?: boolean;
    custom?: {
      active?: boolean;
      link?: string;
      sticky?: boolean;
    };
  };
  title?: {
    name?: string;
    owner?: string;
    portrait?: string;
  };
  playbar?: boolean;
  volume?: boolean;
  speed?: boolean;
  color?: string;
  colors?: {
    color_one?: string;
    color_two?: string;
    color_three?: string;
    color_four?: string;
  };
  outro?: string;
  [key: string]: any;
}

export default function PresetEditor() {
  const [mode, setMode] = useState<"manage" | "apply">("manage");
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [presetDetails, setPresetDetails] = useState<any>(null);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  
  // New preset name
  const [newPresetName, setNewPresetName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  
  // Video to apply preset to
  const [videoId, setVideoId] = useState("");
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  
  // Editable settings
  const [modifications, setModifications] = useState<PresetSettings>({});
  
  const { toast } = useToast();

  useEffect(() => {
    loadPresets();
  }, []);

  const loadPresets = async () => {
    setIsLoadingPresets(true);
    try {
      const data = await fetchPresets();
      setPresets(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load presets",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPresets(false);
    }
  };

  const loadPresetDetails = async (presetId: string) => {
    if (!presetId) return;
    
    setIsLoadingDetails(true);
    try {
      const data = await fetchPresetDetails(presetId);
      setPresetDetails(data);
      setModifications(data.settings || {});
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load preset details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handlePresetSelect = (presetId: string) => {
    const actualId = presetId === "none" ? "" : presetId;
    setSelectedPresetId(actualId);
    setIsCreatingNew(false);
    if (actualId) {
      loadPresetDetails(actualId);
    } else {
      setPresetDetails(null);
      setModifications({});
    }
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedPresetId("");
    setPresetDetails(null);
    setModifications({
      buttons: { like: true, watchlater: true, share: true, embed: true, fullscreen: true },
      logos: { vimeo: true },
      playbar: true,
      volume: true,
      speed: false,
    });
    setNewPresetName("");
  };

  const updateModification = (path: string, value: any) => {
    setModifications(prev => {
      const newMods = { ...prev };
      const keys = path.split('.');
      let current: any = newMods;
      
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newMods;
    });
  };

  const handleSavePreset = async () => {
    if (isCreatingNew && !newPresetName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for the new preset",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const endpoint = isCreatingNew ? "/api/presets" : `/api/presets/${selectedPresetId}`;
      const method = isCreatingNew ? "POST" : "PATCH";
      
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: isCreatingNew ? newPresetName : presetDetails?.name,
          settings: modifications,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save preset");
      }

      const savedPreset = await response.json();
      
      toast({
        title: "Preset Saved",
        description: isCreatingNew 
          ? `Created preset "${newPresetName}" (ID: ${savedPreset.uri?.split('/').pop() || 'unknown'})`
          : `Updated preset "${presetDetails?.name}"`,
      });

      // Refresh presets list
      await loadPresets();
      
      if (isCreatingNew) {
        setIsCreatingNew(false);
        const newId = savedPreset.uri?.split('/').pop();
        if (newId) {
          setSelectedPresetId(newId);
          await loadPresetDetails(newId);
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePreset = async () => {
    if (!selectedPresetId) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/presets/${selectedPresetId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete preset");

      toast({
        title: "Preset Deleted",
        description: `Deleted preset "${presetDetails?.name}"`,
      });

      setSelectedPresetId("");
      setPresetDetails(null);
      setModifications({});
      await loadPresets();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete preset",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const loadVideoDetails = async (id: string) => {
    if (!id.trim()) {
      setVideoInfo(null);
      return;
    }
    
    setIsLoadingVideo(true);
    try {
      const response = await fetch(`/api/videos/${id.trim()}/details`);
      if (!response.ok) throw new Error("Video not found");
      
      const data = await response.json();
      setVideoInfo(data);
      
      toast({
        title: "Video Found",
        description: data.name,
      });
    } catch (error) {
      setVideoInfo(null);
      toast({
        title: "Error",
        description: "Could not find video with that ID",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVideo(false);
    }
  };

  const handleApplyPresetToVideo = async () => {
    if (!selectedPresetId || !videoId.trim()) {
      toast({
        title: "Missing Information",
        description: "Please select a preset and enter a video ID",
        variant: "destructive",
      });
      return;
    }

    setIsApplying(true);
    try {
      const response = await fetch(`/api/videos/${videoId.trim()}/preset/${selectedPresetId}`, {
        method: "PUT",
      });

      if (!response.ok) throw new Error("Failed to apply preset");

      toast({
        title: "Preset Applied",
        description: `Applied "${presetDetails?.name || selectedPresetId}" to video`,
      });
      
      // Reload video info to show updated preset
      await loadVideoDetails(videoId);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply preset to video",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const copyPresetId = () => {
    if (selectedPresetId) {
      navigator.clipboard.writeText(selectedPresetId);
      toast({
        title: "Copied",
        description: `Preset ID "${selectedPresetId}" copied to clipboard`,
      });
    }
  };

  const renderButtonSettings = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">Button Visibility</h4>
      <div className="grid grid-cols-2 gap-4">
        {['like', 'watchlater', 'share', 'embed', 'hd', 'fullscreen', 'scaling'].map((btn) => (
          <div key={btn} className="flex items-center justify-between">
            <Label htmlFor={`btn-${btn}`} className="capitalize">{btn}</Label>
            <Switch
              id={`btn-${btn}`}
              checked={modifications.buttons?.[btn as keyof typeof modifications.buttons] ?? true}
              onCheckedChange={(checked) => updateModification(`buttons.${btn}`, checked)}
            />
          </div>
        ))}
      </div>
    </div>
  );

  const renderColorSettings = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">Colors</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color-primary">Primary Color</Label>
          <div className="flex gap-2">
            <Input
              id="color-primary"
              type="color"
              value={modifications.colors?.color_one || modifications.color || "#00adef"}
              onChange={(e) => updateModification('colors.color_one', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <Input
              value={modifications.colors?.color_one || modifications.color || "#00adef"}
              onChange={(e) => updateModification('colors.color_one', e.target.value)}
              className="flex-1"
              placeholder="#00adef"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="color-accent">Accent Color</Label>
          <div className="flex gap-2">
            <Input
              id="color-accent"
              type="color"
              value={modifications.colors?.color_two || "#ffffff"}
              onChange={(e) => updateModification('colors.color_two', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <Input
              value={modifications.colors?.color_two || "#ffffff"}
              onChange={(e) => updateModification('colors.color_two', e.target.value)}
              className="flex-1"
              placeholder="#ffffff"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlayerSettings = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">Player Controls</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="playbar">Show Playbar</Label>
          <Switch
            id="playbar"
            checked={modifications.playbar ?? true}
            onCheckedChange={(checked) => updateModification('playbar', checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="volume">Show Volume</Label>
          <Switch
            id="volume"
            checked={modifications.volume ?? true}
            onCheckedChange={(checked) => updateModification('volume', checked)}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="speed">Speed Controls</Label>
          <Switch
            id="speed"
            checked={modifications.speed ?? false}
            onCheckedChange={(checked) => updateModification('speed', checked)}
          />
        </div>
      </div>
    </div>
  );

  const renderLogoSettings = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">Logo Settings</h4>
      <div className="flex items-center justify-between">
        <Label htmlFor="vimeo-logo">Show Vimeo Logo</Label>
        <Switch
          id="vimeo-logo"
          checked={modifications.logos?.vimeo ?? true}
          onCheckedChange={(checked) => updateModification('logos.vimeo', checked)}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Mode Selector */}
      <div className="flex gap-2">
        <Button
          variant={mode === "manage" ? "default" : "outline"}
          onClick={() => setMode("manage")}
          className="flex-1"
        >
          <Settings className="w-4 h-4 mr-2" />
          Manage Presets
        </Button>
        <Button
          variant={mode === "apply" ? "default" : "outline"}
          onClick={() => setMode("apply")}
          className="flex-1"
        >
          <Palette className="w-4 h-4 mr-2" />
          Apply Preset to Video
        </Button>
      </div>

      {mode === "manage" && (
        <>
          {/* Preset Selection / Creation */}
          <Card>
            <CardHeader>
              <CardTitle>Manage Presets</CardTitle>
              <CardDescription>Create new presets or edit existing ones. Presets are permanent and can be reused across videos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Select
                    value={isCreatingNew ? "creating" : (selectedPresetId || "none")}
                    onValueChange={handlePresetSelect}
                    disabled={isLoadingPresets}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a preset to edit..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select a preset...</SelectItem>
                      {presets.map((preset) => (
                        <SelectItem key={preset.uri} value={preset.uri.split('/').pop()}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateNew} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  New Preset
                </Button>
              </div>

              {/* Preset ID Display */}
              {selectedPresetId && !isCreatingNew && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium">Preset ID:</span>
                  <code className="text-sm bg-background px-2 py-1 rounded">{selectedPresetId}</code>
                  <Button variant="ghost" size="sm" onClick={copyPresetId}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {/* New Preset Name Input */}
              {isCreatingNew && (
                <div className="space-y-2">
                  <Label>New Preset Name</Label>
                  <Input
                    placeholder="Enter a name for your new preset"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settings Editor */}
          {(selectedPresetId || isCreatingNew) && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {isCreatingNew ? "Configure New Preset" : `Edit: ${presetDetails?.name || "Loading..."}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingDetails ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span>Loading preset settings...</span>
                  </div>
                ) : (
                  <Tabs defaultValue="buttons" className="w-full">
                    <TabsList className="grid w-full grid-cols-4 mb-6">
                      <TabsTrigger value="buttons">Buttons</TabsTrigger>
                      <TabsTrigger value="colors">Colors</TabsTrigger>
                      <TabsTrigger value="player">Player</TabsTrigger>
                      <TabsTrigger value="logo">Logo</TabsTrigger>
                    </TabsList>

                    <ScrollArea className="h-[250px] pr-4">
                      <TabsContent value="buttons">{renderButtonSettings()}</TabsContent>
                      <TabsContent value="colors">{renderColorSettings()}</TabsContent>
                      <TabsContent value="player">{renderPlayerSettings()}</TabsContent>
                      <TabsContent value="logo">{renderLogoSettings()}</TabsContent>
                    </ScrollArea>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {(selectedPresetId || isCreatingNew) && (
            <div className="flex gap-4">
              <Button
                onClick={handleSavePreset}
                disabled={isSaving}
                className="flex-1 h-12 bg-green-600 hover:bg-green-700"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isCreatingNew ? "Create Preset" : "Save Changes"}
              </Button>
              
              {!isCreatingNew && selectedPresetId && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" disabled={isDeleting}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Preset?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{presetDetails?.name}". Videos using this preset will keep their current settings but won't be linked to this preset anymore.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeletePreset}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </>
      )}

      {mode === "apply" && (
        <>
          {/* Select Preset to Apply */}
          <Card>
            <CardHeader>
              <CardTitle>Apply Preset to Video</CardTitle>
              <CardDescription>Select a preset and apply it to any video by ID</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Preset</Label>
                <Select
                  value={selectedPresetId || "none"}
                  onValueChange={(id) => {
                    setSelectedPresetId(id === "none" ? "" : id);
                    if (id !== "none") loadPresetDetails(id);
                  }}
                  disabled={isLoadingPresets}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a preset..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Select a preset...</SelectItem>
                    {presets.map((preset) => (
                      <SelectItem key={preset.uri} value={preset.uri.split('/').pop()}>
                        {preset.name} (ID: {preset.uri.split('/').pop()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPresetId && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    Selected: {presetDetails?.name || selectedPresetId}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Preset ID: {selectedPresetId}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Video ID Input */}
          <Card>
            <CardHeader>
              <CardTitle>Target Video</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Enter Vimeo Video ID"
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadVideoDetails(videoId)}
                />
                <Button 
                  onClick={() => loadVideoDetails(videoId)}
                  disabled={isLoadingVideo || !videoId.trim()}
                  variant="outline"
                >
                  {isLoadingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
                </Button>
              </div>

              {videoInfo && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="font-medium text-blue-800 dark:text-blue-200">{videoInfo.name}</p>
                  <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                    ID: {videoInfo.id} | Current Preset: {videoInfo.presetId || "None"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Apply Button */}
          <Button
            onClick={handleApplyPresetToVideo}
            disabled={isApplying || !selectedPresetId || !videoId.trim()}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700"
          >
            {isApplying ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Applying Preset...
              </>
            ) : (
              <>
                <Palette className="w-5 h-5 mr-2" />
                Apply Preset to Video
              </>
            )}
          </Button>
        </>
      )}
    </div>
  );
}
