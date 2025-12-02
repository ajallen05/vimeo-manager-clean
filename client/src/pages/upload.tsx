import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import UploadForm from "@/components/upload-form";
import MetadataEditor from "@/components/metadata-editor";
import MetadataViewer from "@/components/metadata-viewer";
import { Plus, RefreshCw, Edit, Eye } from "lucide-react";
import { useFolderOperations } from "@/stores/folderStore";

type UploadMode = "new" | "replace" | "metadata" | "view";

export default function Upload() {
  const [uploadMode, setUploadMode] = useState<UploadMode>("new");

  const { folders } = useFolderOperations();

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <div className="relative mb-12 p-8 rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border border-purple-200/50 dark:border-purple-800/50">
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-bold gradient-text">Upload Center</h2>
              <p className="text-lg text-muted-foreground">Upload new videos or replace existing content with ease</p>
            </div>
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>MP4 Support</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span>Auto Metadata</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Folder Organization</span>
            </div>
          </div>
        </div>
        <div className="absolute top-4 right-4 opacity-10">
          <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
          </svg>
        </div>
      </div>

      {/* Upload Mode Selector */}
      <div className="mb-10">
        <h3 className="text-lg font-semibold mb-6 flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <span>Choose Upload Mode</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* New Upload Mode */}
          <div 
            className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 card-hover ${
              uploadMode === "new" 
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20 shadow-lg shadow-blue-500/20" 
                : "border-border hover:border-blue-300 dark:hover:border-blue-700 bg-card/50"
            }`}
            onClick={() => setUploadMode("new")}
            data-testid="mode-new"
          >
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                uploadMode === "new" 
                  ? "bg-blue-500 text-white" 
                  : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
              }`}>
                <Plus className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-2">Upload New Video</h4>
                <p className="text-muted-foreground text-sm mb-4">Upload a completely new video to your Vimeo account with custom metadata and folder organization.</p>
              </div>
              {uploadMode === "new" && (
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center absolute top-4 right-4">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Replace Upload Mode */}
          <div 
            className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 card-hover ${
              uploadMode === "replace" 
                ? "border-purple-500 bg-purple-50 dark:bg-purple-950/20 shadow-lg shadow-purple-500/20" 
                : "border-border hover:border-purple-300 dark:hover:border-purple-700 bg-card/50"
            }`}
            onClick={() => setUploadMode("replace")}
            data-testid="mode-replace"
          >
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                uploadMode === "replace" 
                  ? "bg-purple-500 text-white" 
                  : "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400"
              }`}>
                <RefreshCw className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-2">Replace Existing</h4>
                <p className="text-muted-foreground text-sm mb-4">Replace the content of an existing video while preserving its URL, views, and engagement metrics.</p>
              </div>
              {uploadMode === "replace" && (
                <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center absolute top-4 right-4">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Edit Metadata Mode */}
          <div 
            className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 card-hover ${
              uploadMode === "metadata" 
                ? "border-orange-500 bg-orange-50 dark:bg-orange-950/20 shadow-lg shadow-orange-500/20" 
                : "border-border hover:border-orange-300 dark:hover:border-orange-700 bg-card/50"
            }`}
            onClick={() => setUploadMode("metadata")}
            data-testid="mode-metadata"
          >
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                uploadMode === "metadata" 
                  ? "bg-orange-500 text-white" 
                  : "bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
              }`}>
                <Edit className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-2">Edit Metadata</h4>
                <p className="text-muted-foreground text-sm mb-4">Update titles, descriptions, tags, and presets for single videos or bulk edit via CSV.</p>
              </div>
              {uploadMode === "metadata" && (
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center absolute top-4 right-4">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* View Metadata Mode */}
          <div 
            className={`relative p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 card-hover ${
              uploadMode === "view" 
                ? "border-green-500 bg-green-50 dark:bg-green-950/20 shadow-lg shadow-green-500/20" 
                : "border-border hover:border-green-300 dark:hover:border-green-700 bg-card/50"
            }`}
            onClick={() => setUploadMode("view")}
            data-testid="mode-view"
          >
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                uploadMode === "view" 
                  ? "bg-green-500 text-white" 
                  : "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              }`}>
                <Eye className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-lg mb-2">View Metadata</h4>
                <p className="text-muted-foreground text-sm mb-4">View detailed metadata and preset information for any video by entering its ID.</p>
              </div>
              {uploadMode === "view" && (
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center absolute top-4 right-4">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <Card className="border-0 shadow-xl bg-card/50 backdrop-blur-sm animate-slide-in">
        <CardHeader className="pb-6">
          <div className="flex items-center space-x-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              uploadMode === "new" 
                ? "bg-gradient-to-br from-blue-500 to-purple-600" 
                : uploadMode === "replace"
                  ? "bg-gradient-to-br from-purple-500 to-pink-600"
                  : uploadMode === "metadata"
                    ? "bg-gradient-to-br from-orange-500 to-red-600"
                    : "bg-gradient-to-br from-green-500 to-teal-600"
            }`}>
              {uploadMode === "new" ? (
                <Plus className="w-5 h-5 text-white" />
              ) : uploadMode === "replace" ? (
                <RefreshCw className="w-5 h-5 text-white" />
              ) : uploadMode === "metadata" ? (
                <Edit className="w-5 h-5 text-white" />
              ) : (
                <Eye className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <CardTitle className="text-2xl">
                {uploadMode === "new" 
                  ? "Upload New Video" 
                  : uploadMode === "replace" 
                    ? "Replace Existing Video"
                    : uploadMode === "metadata"
                      ? "Edit Metadata"
                      : "View Metadata"
                }
              </CardTitle>
              <p className="text-muted-foreground mt-1">
                {uploadMode === "new" 
                  ? "Fill out the details below to upload your video" 
                  : uploadMode === "replace"
                    ? "Enter the Vimeo ID and upload your replacement file"
                    : uploadMode === "metadata"
                      ? "Manage metadata for one or multiple videos"
                      : "View detailed metadata and preset information"
                }
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {uploadMode === "metadata" ? (
            <MetadataEditor />
          ) : uploadMode === "view" ? (
            <MetadataViewer />
          ) : (
            <UploadForm mode={uploadMode as "new" | "replace"} folders={folders || []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
