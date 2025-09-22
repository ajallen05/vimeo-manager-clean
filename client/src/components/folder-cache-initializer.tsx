import { useEffect } from 'react';
import { useFolderOperations } from '../stores/folderStore';
import { Loader2 } from 'lucide-react';

interface FolderCacheInitializerProps {
  children: React.ReactNode;
}

export default function FolderCacheInitializer({ children }: FolderCacheInitializerProps) {
  const { isLoading, error, isInitialized, initializeIfNeeded } = useFolderOperations();

  useEffect(() => {
    // Initialize folder cache on app startup
    initializeIfNeeded();
  }, []);

  // Show loading overlay during initial folder fetch
  if (!isInitialized && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Initializing Vimeo Manager</h2>
            <p className="text-muted-foreground">Loading folder structure...</p>
            <div className="text-sm text-muted-foreground">
              This happens once to cache all folders for better performance
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if initial load fails
  if (!isInitialized && error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-destructive text-xl">⚠</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Failed to Initialize</h2>
            <p className="text-muted-foreground">Could not load folder structure</p>
            <div className="text-sm text-muted-foreground bg-destructive/5 p-3 rounded border">
              {error}
            </div>
          </div>
          <button 
            onClick={() => initializeIfNeeded()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render children once initialized
  return <>{children}</>;
}
