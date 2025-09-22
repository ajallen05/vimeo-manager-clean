import { useState, useEffect, useMemo } from "react";
import { Search, FolderOpen, Eye, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFolderOperations } from "@/stores/folderStore";

interface Folder {
  id: string;
  name: string;
  displayName?: string;
  path: string;
  uri: string;
}

interface SearchableFolderSelectorProps {
  onFolderSelect: (folderId: string, folderName: string, folderPath: string) => void;
  selectedFolderId?: string;
}

export default function SearchableFolderSelector({ 
  onFolderSelect, 
  selectedFolderId 
}: SearchableFolderSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);

  // Use cached folders from store
  const { 
    folders: allFolders, 
    isLoading, 
    error: folderError, 
    refreshCache, 
    searchFolders 
  } = useFolderOperations();
  
  const error = folderError;

  // Filter folders based on search query using cached search
  const filteredFolders = useMemo(() => {
    if (!searchQuery.trim()) return allFolders;
    return searchFolders(searchQuery);
  }, [allFolders, searchQuery, searchFolders]);

  // Update selected folder when selectedFolderId changes
  useEffect(() => {
    if (selectedFolderId && allFolders.length > 0) {
      const folder = allFolders.find(f => f.id === selectedFolderId);
      setSelectedFolder(folder || null);
    }
  }, [selectedFolderId, allFolders]);

  const handleFolderClick = (folder: Folder) => {
    setSelectedFolder(folder);
    onFolderSelect(folder.id, folder.name, folder.path);
    setSearchQuery(""); // Clear search after selection
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 h-10 bg-muted animate-pulse rounded-md"></div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center space-x-2">
            <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
              🔄 Loading cached folders...
            </p>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
            Initializing folder cache for faster access
          </p>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-md"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/20 bg-destructive/5">
        <CardContent className="p-4">
          <p className="text-sm text-destructive">
            Failed to load folders. Please try refreshing the page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Box */}
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-blue-500" />
          <Input
            type="text"
            placeholder="Search cached folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-20 h-12 text-base border-2 border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 rounded-xl font-medium placeholder:text-gray-400"
          />
          <Button 
            variant="ghost" 
            size="sm" 
            className="absolute right-2 top-2 h-8 w-16 text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200"
            onClick={() => setSearchQuery("")}
          >
            Clear
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refreshCache()}
          className="h-12 px-3 border-2 border-gray-200 hover:border-gray-300"
          title="Refresh folder cache"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Selected Folder Display */}
      {selectedFolder && !searchQuery && (
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FolderOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    {selectedFolder.name}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {selectedFolder.path}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFolderClick(selectedFolder)}
                className="text-blue-600 border-blue-200 hover:bg-blue-100 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-900/20"
              >
                <Eye className="h-4 w-4 mr-1" />
                View
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Folder Results Table */}
      {(searchQuery || (!selectedFolder && allFolders.length > 0)) && (
        <Card className="max-h-[600px] overflow-hidden border shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-y-auto max-h-[600px]">
              <table className="w-full border-collapse">
                <thead className="bg-blue-50 dark:bg-blue-950/30 sticky top-0 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-blue-900 dark:text-blue-100 border-r">Folder Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-sm text-blue-900 dark:text-blue-100 border-r">Path</th>
                    <th className="text-center py-3 px-4 font-semibold text-sm text-blue-900 dark:text-blue-100 w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFolders.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-12 text-muted-foreground bg-gray-50 dark:bg-gray-900/20">
                        {searchQuery ? "No folders found matching your search." : "No folders available."}
                      </td>
                    </tr>
                  ) : (
                    filteredFolders.map((folder, index) => (
                      <tr 
                        key={folder.id}
                        className={cn(
                          "border-b hover:bg-blue-50 dark:hover:bg-blue-950/20 cursor-pointer transition-all duration-200",
                          folder.id === selectedFolderId && "bg-blue-100 dark:bg-blue-900/40",
                          index % 2 === 0 ? "bg-white dark:bg-gray-950" : "bg-gray-50/50 dark:bg-gray-900/20"
                        )}
                        onClick={() => handleFolderClick(folder)}
                      >
                        <td className="py-3 px-4 border-r border-gray-200 dark:border-gray-700">
                          <div className="flex items-center space-x-3">
                            <FolderOpen className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <span className="font-medium text-gray-900 dark:text-gray-100">{folder.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-gray-200 dark:border-gray-700">
                          <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                            {folder.path}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Button
                            variant={folder.id === selectedFolderId ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "h-7 px-3 text-xs font-medium transition-all",
                              folder.id === selectedFolderId 
                                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                                : "border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950/20"
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFolderClick(folder);
                            }}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Info */}
      {searchQuery && (
        <p className="text-xs text-muted-foreground">
          Found {filteredFolders.length} folder{filteredFolders.length !== 1 ? 's' : ''} matching "{searchQuery}"
        </p>
      )}
      
      {!searchQuery && allFolders.length > 0 && (
        <p className="text-xs text-muted-foreground bg-green-50 dark:bg-green-950/20 p-2 rounded border border-green-200 dark:border-green-800">
          ✅ Loaded {allFolders.length} folders from your entire Vimeo account (including all subfolders)
        </p>
      )}
    </div>
  );
}
