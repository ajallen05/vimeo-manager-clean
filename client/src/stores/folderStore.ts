import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface VimeoFolder {
  id: string;
  name: string;
  uri: string;
  created_time: string;
  modified_time: string;
  resource_key: string;
  user: {
    name: string;
    uri: string;
  };
  privacy: {
    view: string;
  };
  metadata: {
    connections: {
      videos: {
        total: number;
      };
    };
  };
  path?: string; // Full hierarchical path
}

interface FolderStore {
  // State
  folders: VimeoFolder[];
  isLoading: boolean;
  isInitialized: boolean;
  lastFetch: number | null;
  error: string | null;
  
  // Actions
  setFolders: (folders: VimeoFolder[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;
  
  // Cache management
  fetchFolders: () => Promise<void>;
  refreshCache: () => Promise<void>;
  clearCache: () => void;
  
  // Utility functions
  getFolderById: (id: string) => VimeoFolder | undefined;
  getFoldersByName: (name: string) => VimeoFolder[];
  getTopLevelFolders: () => VimeoFolder[];
  getFoldersWithVideos: () => VimeoFolder[];
  isCacheValid: () => boolean;
}

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export const useFolderStore = create<FolderStore>()(
  persist(
    (set, get) => ({
      // Initial state
      folders: [],
      isLoading: false,
      isInitialized: false,
      lastFetch: null,
      error: null,

      // Actions
      setFolders: (folders) => set({ 
        folders, 
        lastFetch: Date.now(),
        isInitialized: true,
        error: null 
      }),
      
      setLoading: (isLoading) => set({ isLoading }),
      
      setError: (error) => set({ error, isLoading: false }),
      
      setInitialized: (isInitialized) => set({ isInitialized }),

      // Fetch folders from API
      fetchFolders: async () => {
        const { setLoading, setFolders, setError } = get();
        
        try {
          setLoading(true);
          setError(null);
          
          console.log('📁 Fetching all folders from API...');
          
          const response = await fetch('/api/folders/all');
          
          if (!response.ok) {
            throw new Error(`Failed to fetch folders: ${response.status} ${response.statusText}`);
          }
          
          const folders = await response.json() as VimeoFolder[];
          
          console.log(`✅ Loaded ${folders.length} folders into cache`);
          setFolders(folders);
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('❌ Failed to fetch folders:', errorMessage);
          setError(errorMessage);
        } finally {
          setLoading(false);
        }
      },

      // Refresh cache by re-fetching
      refreshCache: async () => {
        console.log('🔄 Refreshing folder cache...');
        await get().fetchFolders();
      },

      // Clear cache
      clearCache: () => {
        console.log('🗑️ Clearing folder cache...');
        set({
          folders: [],
          isInitialized: false,
          lastFetch: null,
          error: null
        });
      },

      // Utility functions
      getFolderById: (id) => {
        return get().folders.find(folder => folder.id === id);
      },

      getFoldersByName: (name) => {
        const searchTerm = name.toLowerCase();
        return get().folders.filter(folder => 
          folder.name.toLowerCase().includes(searchTerm)
        );
      },

      getTopLevelFolders: () => {
        return get().folders.filter(folder => 
          !folder.path || folder.path.split('/').length <= 2
        );
      },

      getFoldersWithVideos: () => {
        return get().folders.filter(folder => 
          folder.metadata?.connections?.videos?.total > 0
        );
      },

      isCacheValid: () => {
        const { lastFetch } = get();
        if (!lastFetch) return false;
        return (Date.now() - lastFetch) < CACHE_DURATION;
      }
    }),
    {
      name: 'vimeo-folder-cache', // localStorage key
      partialize: (state) => ({
        folders: state.folders,
        lastFetch: state.lastFetch,
        isInitialized: state.isInitialized
      })
    }
  )
);

// Helper hook for common folder operations
export const useFolderOperations = () => {
  const store = useFolderStore();
  
  return {
    ...store,
    
    // Initialize cache if needed
    initializeIfNeeded: async () => {
      if (!store.isInitialized || !store.isCacheValid()) {
        await store.fetchFolders();
      }
    },
    
    // Get folder options for dropdowns
    getFolderOptions: () => {
      return store.folders.map(folder => ({
        value: folder.id,
        label: folder.path || folder.name,
        videoCount: folder.metadata?.connections?.videos?.total || 0
      }));
    },
    
    // Search folders
    searchFolders: (query: string) => {
      if (!query) return store.folders;
      
      const searchTerm = query.toLowerCase();
      return store.folders.filter(folder =>
        folder.name.toLowerCase().includes(searchTerm) ||
        (folder.path && folder.path.toLowerCase().includes(searchTerm))
      );
    }
  };
};
