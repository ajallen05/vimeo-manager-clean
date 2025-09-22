import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface FolderHierarchy {
  id: string;
  name: string;
  uri: string;
  parent_id?: string;
  hasChildren: boolean;
  path?: string;
  children?: FolderHierarchy[];
}

interface HierarchicalFolderSelectorProps {
  onFolderSelect: (folderId: string, folderName: string) => void;
  selectedFolderId?: string;
}

interface FolderNodeProps {
  folder: FolderHierarchy;
  level: number;
  onSelect: (folderId: string, folderName: string) => void;
  selectedFolderId?: string;
  onLoadSubfolders?: (folderId: string) => Promise<FolderHierarchy[]>;
}

function FolderNode({ 
  folder, 
  level, 
  onSelect, 
  selectedFolderId,
  onLoadSubfolders 
}: FolderNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FolderHierarchy[]>(folder.children || []);
  const [isLoading, setIsLoading] = useState(false);
  const isSelected = folder.id === selectedFolderId;
  
  const handleExpand = async () => {
    if (!isExpanded && folder.hasChildren && children.length === 0 && onLoadSubfolders) {
      setIsLoading(true);
      try {
        const subfolders = await onLoadSubfolders(folder.id);
        setChildren(subfolders);
      } catch (error) {
        console.error('Failed to load subfolders:', error);
      } finally {
        setIsLoading(false);
      }
    }
    setIsExpanded(!isExpanded);
  };
  
  const handleFolderClick = () => {
    onSelect(folder.id, folder.path || folder.name);
    if (folder.hasChildren) {
      handleExpand();
    }
  };
  
  
  return (
    <div className="select-none">
      <div 
        className={cn(
          "flex items-center py-1.5 px-2 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group",
          isSelected && "bg-accent"
        )}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        <Button
          variant="ghost"
          size="sm"
          className="p-0 h-5 w-5 mr-1"
          onClick={(e) => {
            e.stopPropagation();
            handleExpand();
          }}
          disabled={!folder.hasChildren || isLoading}
        >
          {isLoading ? (
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
          ) : folder.hasChildren ? (
            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <div className="w-4" />
          )}
        </Button>
        
        <div 
          className="flex items-center flex-1 min-w-0"
          onClick={handleFolderClick}
        >
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          ) : (
            <Folder className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          )}
          <span className={cn(
            "truncate text-sm flex-1",
            isSelected && "font-semibold"
          )}>
            {folder.name}
          </span>
        </div>
        
        {/* View Videos Button */}
        <Button
          variant={isSelected ? "default" : "ghost"}
          size="sm"
          className={cn(
            "h-6 px-2 ml-2 opacity-0 group-hover:opacity-100 transition-opacity",
            isSelected && "opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(folder.id, folder.path || folder.name);
          }}
        >
          <Video className="h-3 w-3 mr-1" />
          <span className="text-xs">View</span>
        </Button>
        
      </div>
      
      {isExpanded && children.length > 0 && (
        <div className="mt-0.5">
          {/* Render subfolders */}
          {children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              level={level + 1}
              onSelect={onSelect}
              selectedFolderId={selectedFolderId}
              onLoadSubfolders={onLoadSubfolders}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Cache for loaded subfolders
const subfoldersCache = new Map<string, FolderHierarchy[]>();

export default function HierarchicalFolderSelector({ 
  onFolderSelect,
  selectedFolderId 
}: HierarchicalFolderSelectorProps) {
  const [folders, setFolders] = useState<FolderHierarchy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    // Check if we have cached data first
    const cachedData = sessionStorage.getItem('vimeo-folders-hierarchy');
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        // Check if cache is less than 5 minutes old
        if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
          setFolders(parsed.folders);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        // Invalid cache, continue with fetch
      }
    }
    loadRootFolders();
  }, []);
  
  const loadRootFolders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/folders?hierarchical=true');
      if (!response.ok) {
        throw new Error('Failed to load folders');
      }
      const data = await response.json();
      setFolders(data);
      
      // Cache the data in sessionStorage
      sessionStorage.setItem('vimeo-folders-hierarchy', JSON.stringify({
        folders: data,
        timestamp: Date.now()
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadSubfolders = async (folderId: string): Promise<FolderHierarchy[]> => {
    // Check cache first
    if (subfoldersCache.has(folderId)) {
      return subfoldersCache.get(folderId)!;
    }
    
    const response = await fetch(`/api/folders/${folderId}/subfolders`);
    if (!response.ok) {
      throw new Error('Failed to load subfolders');
    }
    const data = await response.json();
    
    // Cache the result
    subfoldersCache.set(folderId, data);
    
    return data;
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={loadRootFolders}
        >
          Retry
        </Button>
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-[400px] w-full rounded-lg border bg-card p-2">
      <div className="space-y-0.5">
        {folders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No folders available
          </div>
        ) : (
          folders.map((folder) => (
            <FolderNode
              key={folder.id}
              folder={folder}
              level={0}
              onSelect={onFolderSelect}
              selectedFolderId={selectedFolderId}
              onLoadSubfolders={loadSubfolders}
            />
          ))
        )}
      </div>
    </ScrollArea>
  );
}
