import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFolders, fetchVideosByFolder } from "@/lib/vimeo-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import VideoTable from "@/components/video-table";
import HierarchicalFolderSelector from "@/components/hierarchical-folder-selector";
import SearchableFolderSelector from "@/components/searchable-folder-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderTree, List, Search } from "lucide-react";
import type { VimeoVideo } from "@shared/schema";

export default function Download() {
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");
  const [selectedFolderName, setSelectedFolderName] = useState<string>("");
  const [selectedFolderPath, setSelectedFolderPath] = useState<string>("");
  const [viewMode, setViewMode] = useState<"hierarchy" | "list" | "search">("search");

  const { data: folders, isLoading: foldersLoading, error: foldersError } = useQuery({
    queryKey: ["/api/folders"],
    queryFn: fetchFolders,
    enabled: viewMode === "list",
  });

  const { data: videos, isLoading: videosLoading, error: videosError } = useQuery({
    queryKey: ["/api/folders", selectedFolderId, "videos"],
    queryFn: () => fetchVideosByFolder(selectedFolderId),
    enabled: !!selectedFolderId,
  });
  
  const handleFolderSelect = (folderId: string, folderName: string, folderPath?: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
    setSelectedFolderPath(folderPath || folderName);
  };

  const handleSearchFolderSelect = (folderId: string, folderName: string, folderPath: string) => {
    setSelectedFolderId(folderId);
    setSelectedFolderName(folderName);
    setSelectedFolderPath(folderPath);
  };

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <div className="relative mb-12 p-8 rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border border-blue-200/50 dark:border-blue-800/50">
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-bold gradient-text">Download Center</h2>
              <p className="text-lg text-muted-foreground">Access and download your Vimeo content with ease</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Videos & Captions</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Bulk Downloads</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Metadata Export</span>
            </div>
          </div>
        </div>
        <div className="absolute top-4 right-4 opacity-10">
          <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        </div>
      </div>

      {/* Folder Selector */}
      <Card className="mb-8 border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                </svg>
              </div>
              <label className="text-lg font-semibold">Choose Your Folder</label>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "search" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("search")}
                className="gap-2"
              >
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button
                variant={viewMode === "hierarchy" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("hierarchy")}
                className="gap-2"
              >
                <FolderTree className="h-4 w-4" />
                Tree View
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="gap-2"
              >
                <List className="h-4 w-4" />
                List View
              </Button>
            </div>
          </div>
          
          {viewMode === "search" ? (
            <div className="space-y-3">
              <SearchableFolderSelector
                onFolderSelect={handleSearchFolderSelect}
                selectedFolderId={selectedFolderId}
              />
            </div>
          ) : viewMode === "hierarchy" ? (
            <div className="space-y-3">
              <HierarchicalFolderSelector
                onFolderSelect={handleFolderSelect}
                selectedFolderId={selectedFolderId}
              />
              {selectedFolderName && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                  </svg>
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    Selected: {selectedFolderName}
                  </span>
                  <br />
                  <span className="text-xs text-blue-600 dark:text-blue-300">
                    Path: {selectedFolderPath}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {foldersLoading ? (
                <div className="space-y-3">
                  <Skeleton className="w-full max-w-lg h-12 rounded-xl" />
                  <Skeleton className="w-48 h-4" />
                </div>
              ) : foldersError ? (
                <div className="p-6 rounded-xl bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 rounded-full bg-destructive/20 flex items-center justify-center">
                      <svg className="w-3 h-3 text-destructive" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-destructive">Connection Error</p>
                      <p className="text-sm text-destructive/80">Failed to load folders. Please check your Vimeo API connection.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Select 
                    value={selectedFolderId} 
                    onValueChange={(value) => {
                      const folder = folders?.find(f => f.id === value);
                      handleFolderSelect(value, folder?.name || "", folder?.path || folder?.name || "");
                    }}
                    data-testid="folder-select"
                  >
                    <SelectTrigger className="w-full max-w-lg h-12 rounded-xl border-2 hover:border-blue-300 transition-colors">
                      <SelectValue placeholder="🗂️  Select a folder to get started" />
                    </SelectTrigger>
                    <SelectContent>
                      {folders?.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id} className="cursor-pointer">
                          <div className="flex items-start space-x-2">
                            <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                            </svg>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium">{folder.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{folder.path || folder.displayName}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">Choose from {folders?.length || 0} available folders</p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Table */}
      {selectedFolderId && (
        <Card className="border-0 shadow-xl bg-card/50 backdrop-blur-sm animate-slide-in">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z"/>
                  </svg>
                </div>
                <CardTitle className="text-xl">Video Collection</CardTitle>
              </div>
              {videos && videos.length > 0 && (
                <div className="px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {videos.length} {videos.length === 1 ? 'video' : 'videos'}
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {videosLoading ? (
              <div className="p-8 space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="w-16 h-16 rounded-xl" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="w-3/4 h-4" />
                      <Skeleton className="w-1/2 h-3" />
                    </div>
                    <Skeleton className="w-24 h-8 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : videosError ? (
              <div className="p-8">
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Failed to Load Videos</h3>
                  <p className="text-muted-foreground">There was an error loading the videos. Please try again.</p>
                </div>
              </div>
            ) : videos && videos.length > 0 ? (
              <VideoTable videos={videos} />
            ) : (
              <div className="p-8">
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-muted/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Videos Found</h3>
                  <p className="text-muted-foreground">This folder doesn't contain any videos yet.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
