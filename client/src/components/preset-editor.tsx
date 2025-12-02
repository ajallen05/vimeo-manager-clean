import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Settings, Eye, Save, Palette } from "lucide-react";
import { fetchPresets, fetchPresetDetails, applyModifiedPreset } from "@/lib/vimeo-api";
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
  const [presets, setPresets] = useState<any[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [presetDetails, setPresetDetails] = useState<any>(null);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [videoId, setVideoId] = useState("");
  
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
      // Initialize modifications with current settings
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
    if (actualId) {
      loadPresetDetails(actualId);
    } else {
      setPresetDetails(null);
      setModifications({});
    }
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

  const handleApplyModifiedPreset = async () => {
    if (!videoId.trim()) {
      toast({
        title: "Video ID Required",
        description: "Please enter a video ID to apply the preset to.",
        variant: "destructive",
      });
      return;
    }

    setIsApplying(true);
    try {
      const result = await applyModifiedPreset(
        videoId.trim(),
        selectedPresetId || null,
        modifications
      );
      
      toast({
        title: "Success",
        description: result.message || "Modified preset applied successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: (error as Error).message || "Failed to apply modified preset",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
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
        <div className="space-y-2">
          <Label htmlFor="color-text">Text/Icons Color</Label>
          <div className="flex gap-2">
            <Input
              id="color-text"
              type="color"
              value={modifications.colors?.color_three || "#ffffff"}
              onChange={(e) => updateModification('colors.color_three', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <Input
              value={modifications.colors?.color_three || "#ffffff"}
              onChange={(e) => updateModification('colors.color_three', e.target.value)}
              className="flex-1"
              placeholder="#ffffff"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="color-bg">Background Color</Label>
          <div className="flex gap-2">
            <Input
              id="color-bg"
              type="color"
              value={modifications.colors?.color_four || "#000000"}
              onChange={(e) => updateModification('colors.color_four', e.target.value)}
              className="w-12 h-10 p-1"
            />
            <Input
              value={modifications.colors?.color_four || "#000000"}
              onChange={(e) => updateModification('colors.color_four', e.target.value)}
              className="flex-1"
              placeholder="#000000"
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

  const renderTitleSettings = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">Title Display</h4>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Video Title</Label>
          <Select
            value={modifications.title?.name || "show"}
            onValueChange={(value) => updateModification('title.name', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="show">Show</SelectItem>
              <SelectItem value="hide">Hide</SelectItem>
              <SelectItem value="user">User Choice</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Owner Name</Label>
          <Select
            value={modifications.title?.owner || "show"}
            onValueChange={(value) => updateModification('title.owner', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="show">Show</SelectItem>
              <SelectItem value="hide">Hide</SelectItem>
              <SelectItem value="user">User Choice</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Portrait</Label>
          <Select
            value={modifications.title?.portrait || "show"}
            onValueChange={(value) => updateModification('title.portrait', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="show">Show</SelectItem>
              <SelectItem value="hide">Hide</SelectItem>
              <SelectItem value="user">User Choice</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  const renderLogoSettings = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">Logo Settings</h4>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="vimeo-logo">Show Vimeo Logo</Label>
          <Switch
            id="vimeo-logo"
            checked={modifications.logos?.vimeo ?? true}
            onCheckedChange={(checked) => updateModification('logos.vimeo', checked)}
          />
        </div>
      </div>
    </div>
  );

  const renderOutroSettings = () => (
    <div className="space-y-4">
      <h4 className="font-medium text-sm text-muted-foreground">Outro/End Screen</h4>
      <div className="space-y-2">
        <Label>Outro Type</Label>
        <Select
          value={modifications.outro || "nothing"}
          onValueChange={(value) => updateModification('outro', value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nothing">Nothing</SelectItem>
            <SelectItem value="loop">Loop</SelectItem>
            <SelectItem value="share">Share Options</SelectItem>
            <SelectItem value="videos">Video Recommendations</SelectItem>
            <SelectItem value="text">Custom Text</SelectItem>
            <SelectItem value="link">Custom Link</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Preset Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Edit Preset Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Base Preset (Optional)</Label>
              <Select
                value={selectedPresetId || "none"}
                onValueChange={handlePresetSelect}
                disabled={isLoadingPresets}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset to modify..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Start from scratch</SelectItem>
                  {presets.map((preset) => (
                    <SelectItem key={preset.uri} value={preset.uri.split('/').pop()}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select an existing preset to use as a base, or start from scratch
              </p>
            </div>
            <div className="space-y-2">
              <Label>Video ID to Apply To</Label>
              <Input
                placeholder="Enter Vimeo Video ID"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The video that will receive the modified preset
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Customize Settings
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
              <TabsList className="grid w-full grid-cols-6 mb-6">
                <TabsTrigger value="buttons">Buttons</TabsTrigger>
                <TabsTrigger value="colors">Colors</TabsTrigger>
                <TabsTrigger value="player">Player</TabsTrigger>
                <TabsTrigger value="title">Title</TabsTrigger>
                <TabsTrigger value="logo">Logo</TabsTrigger>
                <TabsTrigger value="outro">Outro</TabsTrigger>
              </TabsList>

              <ScrollArea className="h-[300px] pr-4">
                <TabsContent value="buttons">{renderButtonSettings()}</TabsContent>
                <TabsContent value="colors">{renderColorSettings()}</TabsContent>
                <TabsContent value="player">{renderPlayerSettings()}</TabsContent>
                <TabsContent value="title">{renderTitleSettings()}</TabsContent>
                <TabsContent value="logo">{renderLogoSettings()}</TabsContent>
                <TabsContent value="outro">{renderOutroSettings()}</TabsContent>
              </ScrollArea>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Current Settings Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Settings Preview (JSON)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            <pre className="text-xs bg-muted p-4 rounded-lg overflow-auto">
              {JSON.stringify(modifications, null, 2)}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Apply Button */}
      <Button
        onClick={handleApplyModifiedPreset}
        disabled={isApplying || !videoId.trim()}
        className="w-full"
        size="lg"
      >
        {isApplying ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Applying Modified Preset...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            Apply Modified Preset to Video
          </>
        )}
      </Button>

      <p className="text-xs text-muted-foreground text-center">
        This will create a temporary preset with your modifications, apply it to the video, then delete the temporary preset.
      </p>
    </div>
  );
}

