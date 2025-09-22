import { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

interface FolderTreeProps {
  folders: FolderHierarchy[];
  onSelectFolder: (folderId: string, folderName: string) => void;
  selectedFolderId?: string;
  level?: number;
}

export function FolderTree({ 
  folders, 
  onSelectFolder, 
  selectedFolderId,
  level = 0 
}: FolderTreeProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [loadingFolders, setLoadingFolders] = useState<Set<string>>(new Set());

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  return (
    <div className="w-full">
      {folders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          level={level}
          isExpanded={expandedFolders.has(folder.id)}
          isSelected={selectedFolderId === folder.id}
          isLoading={loadingFolders.has(folder.id)}
          onToggle={() => toggleFolder(folder.id)}
          onSelectFolder={onSelectFolder}
          expandedFolders={expandedFolders}
          setExpandedFolders={setExpandedFolders}
          loadingFolders={loadingFolders}
          setLoadingFolders={setLoadingFolders}
          selectedFolderId={selectedFolderId}
        />
      ))}
    </div>
  );
}

interface FolderNodeProps {
  folder: FolderHierarchy;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  isLoading: boolean;
  onToggle: () => void;
  onSelectFolder: (folderId: string, folderName: string) => void;
  expandedFolders: Set<string>;
  setExpandedFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  loadingFolders: Set<string>;
  setLoadingFolders: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedFolderId?: string;
}

function FolderNode({
  folder,
  level,
  isExpanded,
  isSelected,
  isLoading,
  onToggle,
  onSelectFolder,
  expandedFolders,
  setExpandedFolders,
  loadingFolders,
  setLoadingFolders,
  selectedFolderId
}: FolderNodeProps) {
  const hasChildren = folder.hasChildren || (folder.children && folder.children.length > 0);
  const indent = level * 24;

  return (
    <div className="select-none">
      <div
        className={cn(
          "group flex items-center gap-2 py-2 px-3 hover:bg-accent/50 rounded-lg transition-all duration-200",
          isSelected && "bg-accent border-l-4 border-primary",
          "cursor-pointer"
        )}
        style={{ paddingLeft: `${indent + 12}px` }}
      >
        {/* Expand/Collapse Button */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className="p-0.5 hover:bg-accent rounded transition-colors"
            aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <div className="w-5" /> // Spacer for alignment
        )}

        {/* Folder Icon */}
        <div className="flex items-center gap-2 flex-1">
          {isExpanded && hasChildren ? (
            <FolderOpen className="h-4 w-4 text-blue-500" />
          ) : (
            <Folder className="h-4 w-4 text-blue-500" />
          )}
          
          {/* Folder Name */}
          <span 
            className={cn(
              "text-sm font-medium truncate flex-1",
              isSelected && "text-primary font-semibold"
            )}
            title={folder.path || folder.name}
          >
            {folder.name}
          </span>
        </div>

        {/* View Videos Button */}
        <Button
          size="sm"
          variant={isSelected ? "default" : "ghost"}
          className={cn(
            "h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity",
            isSelected && "opacity-100"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onSelectFolder(folder.id, folder.name);
          }}
        >
          <Video className="h-3 w-3 mr-1" />
          <span className="text-xs">View Videos</span>
        </Button>
      </div>

      {/* Children */}
      {isExpanded && folder.children && folder.children.length > 0 && (
        <div className="animate-in slide-in-from-top-1 duration-200">
          {folder.children.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              level={level + 1}
              isExpanded={expandedFolders.has(child.id)}
              isSelected={selectedFolderId === child.id}
              isLoading={loadingFolders.has(child.id)}
              onToggle={() => {
                setExpandedFolders(prev => {
                  const newSet = new Set(prev);
                  if (newSet.has(child.id)) {
                    newSet.delete(child.id);
                  } else {
                    newSet.add(child.id);
                  }
                  return newSet;
                });
              }}
              onSelectFolder={onSelectFolder}
              expandedFolders={expandedFolders}
              setExpandedFolders={setExpandedFolders}
              loadingFolders={loadingFolders}
              setLoadingFolders={setLoadingFolders}
              selectedFolderId={selectedFolderId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default FolderTree;
