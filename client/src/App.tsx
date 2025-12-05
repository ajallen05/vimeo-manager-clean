import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navigation from "@/components/navigation";
import { checkCredentials } from "@/lib/vimeo-api";
import { Skeleton } from "@/components/ui/skeleton";
import FolderCacheInitializer from "@/components/folder-cache-initializer";
import { ErrorBoundary, LoadingFallback } from "@/components/error-boundary";

// Lazy load pages for better initial load performance
const Download = lazy(() => import("@/pages/download"));
const Upload = lazy(() => import("@/pages/upload"));
const Setup = lazy(() => import("@/pages/setup"));
const NotFound = lazy(() => import("@/pages/not-found"));

function Router() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <Switch>
          <Route path="/" component={Download} />
          <Route path="/download" component={Download} />
          <Route path="/upload" component={Upload} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </ErrorBoundary>
  );
}

function AppContent() {
  const { data: credentialsCheck, isLoading, refetch } = useQuery({
    queryKey: ["/api/credentials/check"],
    queryFn: checkCredentials,
    retry: false,
  });

  const handleSetupComplete = () => {
    refetch();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 text-center">
          <Skeleton className="w-16 h-16 rounded-full mx-auto" />
          <Skeleton className="w-48 h-6 mx-auto" />
          <Skeleton className="w-32 h-4 mx-auto" />
        </div>
      </div>
    );
  }

  if (!credentialsCheck?.configured) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <Setup onSetupComplete={handleSetupComplete} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  return (
    <FolderCacheInitializer>
      <div className="min-h-screen text-foreground animate-fade-in">
        {/* App Header */}
        <header className="glass sticky top-0 z-50 border-b border-border/20">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.493 4.797l-.013.01z"/>
                    </svg>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></div>
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold gradient-text">Vimeo Manager</h1>
                  <p className="text-xs text-muted-foreground/80">Professional Video Management</p>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-3 px-4 py-2 rounded-full bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">API Connected</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                    <div className="w-2 h-2 bg-foreground rounded-full"></div>
                  </div>
                  <span className="hidden sm:inline">Ready to sync</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <Navigation />
        
        <main className="max-w-7xl mx-auto px-6 py-8">
          <Router />
        </main>
      </div>
    </FolderCacheInitializer>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
