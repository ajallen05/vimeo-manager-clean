import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { uploadVideo, replaceVideo } from "@/lib/vimeo-api";
import { uploadVideoSchema, replaceVideoSchema } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { CloudUpload, Upload } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import type { VimeoFolder } from "@shared/schema";
import { z } from "zod";

interface UploadFormProps {
  mode: "new" | "replace";
  folders: { id: string; name: string }[];
}

const newVideoFormSchema = uploadVideoSchema.extend({
  file: z
    .instanceof(File)
    .refine((file) => file.type === "video/mp4", {
      message: "Only MP4 files are allowed",
    })
    .refine((file) => file.size <= 2 * 1024 * 1024 * 1024, {
      message: "File size must be less than 2GB",
    }),
});

const replaceVideoFormSchema = replaceVideoSchema.extend({
  videoId: z.string().optional(),
  file: z
    .instanceof(File)
    .refine((file) => file.type === "video/mp4", {
      message: "Only MP4 files are allowed",
    })
    .refine((file) => file.size <= 2 * 1024 * 1024 * 1024, {
      message: "File size must be less than 2GB",
    }),
});

export default function UploadForm({ mode, folders }: UploadFormProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const newVideoForm = useForm<z.infer<typeof newVideoFormSchema>>({
    resolver: zodResolver(newVideoFormSchema),
    defaultValues: {
      title: "",
      description: "",
      tags: "",
      folderId: "",
      file: undefined as File | undefined,
    },
  });

  const [videoIdInputValue, setVideoIdInputValue] = useState("");

  const replaceVideoForm = useForm<z.infer<typeof replaceVideoFormSchema>>({
    resolver: zodResolver(replaceVideoFormSchema),
    defaultValues: {
      videoId: "",
      title: "",
      description: "",
      tags: "",
      file: undefined as unknown as File,
    },
    mode: "onSubmit", // Only validate on submit
  });

  const uploadMutation = useMutation({
    mutationFn: ({ data, file }: { data: any; file: File }) =>
      uploadVideo(data, file),
    onSuccess: (response) => {
      toast({
        title: "Success",
        description: "Video uploaded successfully",
      });
      // Reset the form
      newVideoForm.reset();
      setSelectedFile(null);
      
      // Invalidate and refetch the folders query to update the UI
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      
      // If we have a folderId, also invalidate the videos query for that folder
      if (newVideoForm.getValues("folderId")) {
        queryClient.invalidateQueries({ 
          queryKey: [`/api/folders/${newVideoForm.getValues("folderId")}/videos`] 
        });
      }
      
      // REMOVED: window.location.reload() - query invalidation handles cache refresh
      // Using reload causes poor UX and wastes network requests
    },
    onError: (error: Error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const replaceMutation = useMutation({
    mutationFn: ({
      videoId,
      data,
      file,
    }: {
      videoId: string;
      data: any;
      file: File;
    }) => replaceVideo(videoId, data, file),
    onSuccess: async (response, variables) => {
      const { videoId } = variables;
      const cacheVersion = Date.now(); // Unique version for cache-busting
      
      toast({
        title: "Success",
        description: "Video replaced successfully",
      });
      
      // Reset the form
      replaceVideoForm.reset();
      setSelectedFile(null);
      
      // Comprehensive cache invalidation with cache-busting - no page reload needed!
      await Promise.all([
        // Invalidate all folder-related queries (video lists)
        queryClient.invalidateQueries({ 
          queryKey: ["/api/folders"],
          refetchType: "active" 
        }),
        
        // Invalidate specific video queries
        queryClient.invalidateQueries({ 
          queryKey: ["/api/videos", videoId],
          refetchType: "active"
        }),
        
        // Invalidate download links for this video
        queryClient.invalidateQueries({ 
          queryKey: ["/api/videos", videoId, "download-links"],
          refetchType: "active"
        }),
        
        // Invalidate any video detail queries with cache-busting
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            return query.queryKey.includes(videoId) || 
                   (Array.isArray(query.queryKey) && query.queryKey.some(key => 
                     typeof key === 'string' && key.includes(videoId)
                   ));
          }
        }),

        // Force refresh thumbnails and captions with cache-busting
        queryClient.invalidateQueries({ 
          queryKey: ["/api/videos", videoId, "thumbnail", cacheVersion]
        }),
        queryClient.invalidateQueries({ 
          queryKey: ["/api/videos", videoId, "captions", cacheVersion]
        })
      ]);

      // Store the cache version for this video to force fresh data
      localStorage.setItem(`video-cache-version-${videoId}`, cacheVersion.toString());
      
      // Show success message with instructions
      setTimeout(() => {
        toast({
          title: "Video & Media Updated",
          description: "Video, thumbnails, and captions have been refreshed with the new content.",
        });
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "Replace Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (mode === "new") {
        newVideoForm.setValue("file", file, { shouldValidate: true });
      } else {
        replaceVideoForm.setValue("file", file, { shouldValidate: true });
      }
    }
  };

  const onNewVideoSubmit = (data: z.infer<typeof newVideoFormSchema>) => {
    if (!data.file) {
      newVideoForm.setError("file", { message: "Video file is required" });
      return;
    }
    const { file, ...videoData } = data;
    uploadMutation.mutate({ data: videoData, file });
  };

  const onReplaceVideoSubmit = async (
    data: z.infer<typeof replaceVideoFormSchema>
  ) => {
    try {

      // Use our local state instead of form value
      const videoId = videoIdInputValue;

      const { file, ...videoData } = data;
      replaceVideoForm.clearErrors("videoId");

      if (!videoId?.trim()) {
        replaceVideoForm.setError("videoId", {
          type: "manual",
          message: "Please enter a Vimeo video ID or URL",
        });
        return;
      }

      // Validate Vimeo ID format
      const value = videoId.trim();
      if (
        !(
          /^\d+$/.test(value) ||
          /^https?:\/\/(www\.)?vimeo\.com\/\d+$/.test(value)
        )
      ) {
        replaceVideoForm.setError("videoId", {
          type: "manual",
          message:
            "Please enter a valid Vimeo ID (e.g. 1234567) or Vimeo URL (e.g. https://vimeo.com/1234567)",
        });
        return;
      }

      if (!file) {
        replaceVideoForm.setError("file", {
          type: "manual",
          message: "Please select a video file",
        });
        return;
      }

      const normalizedVideoId =
        videoId.match(/\/(\d+)$/)?.[1] || // Extract ID from URL if present
        videoId.match(/^(\d+)$/)?.[1] || // Use ID directly if it's just a number
        videoId.trim(); // Fallback to trimmed input

      await replaceMutation.mutateAsync({
        videoId: normalizedVideoId,
        data: videoData,
        file,
      });
    } catch (error) {
      console.error("Error in form submission:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred while replacing the video",
        variant: "destructive",
      });
    }
  };

  if (mode === "new") {
    return (
      <Form {...newVideoForm}>
        <form
          onSubmit={newVideoForm.handleSubmit(onNewVideoSubmit)}
          className="space-y-6"
        >
          <FormField
            control={newVideoForm.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Video Title</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter video title"
                    {...field}
                    data-testid="input-title"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={newVideoForm.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter video description"
                    {...field}
                    data-testid="input-description"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={newVideoForm.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter tags (comma separated)"
                    {...field}
                    data-testid="input-tags"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={newVideoForm.control}
            name="folderId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Folder (Optional)</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger data-testid="select-folder">
                      <SelectValue placeholder="Select a folder" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={newVideoForm.control}
            name="file"
            render={() => (
              <FormItem>
                <FormLabel className="text-base font-semibold flex items-center space-x-2">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span>Video File</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                      selectedFile 
                        ? 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-950/20' 
                        : 'border-blue-200 hover:border-blue-400 bg-blue-50/30 dark:border-blue-700 dark:hover:border-blue-500 dark:bg-blue-950/10'
                    }`}>
                      <div className="flex flex-col items-center space-y-6">
                        {selectedFile ? (
                          <div className="w-20 h-20 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                            <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center">
                            <CloudUpload className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                        <div className="space-y-2">
                          {selectedFile ? (
                            <>
                              <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                                File Ready to Upload!
                              </p>
                              <p className="text-base text-green-600 dark:text-green-400 font-medium">
                                {selectedFile.name}
                              </p>
                              <p className="text-sm text-green-600/80 dark:text-green-400/80">
                                Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-lg font-semibold text-foreground">
                                Drop your video here, or click to browse
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Support for MP4 files up to 2GB
                              </p>
                            </>
                          )}
                        </div>
                        <input
                          type="file"
                          accept=".mp4,video/mp4"
                          onChange={handleFileSelect}
                          className="hidden"
                          id="new-video-file"
                          data-testid="input-video-file"
                        />
                        <Button
                          type="button"
                          variant={selectedFile ? "outline" : "default"}
                          size="lg"
                          onClick={() =>
                            document.getElementById("new-video-file")?.click()
                          }
                          data-testid="button-select-file"
                          className={`h-12 px-8 rounded-xl font-medium transition-all ${
                            selectedFile 
                              ? 'hover:bg-green-50 dark:hover:bg-green-950/20 border-green-300 dark:border-green-700'
                              : 'btn-gradient hover:shadow-lg'
                          }`}
                        >
                          {selectedFile ? (
                            <>
                              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                              </svg>
                              Change File
                            </>
                          ) : (
                            <>
                              <CloudUpload className="w-4 h-4 mr-2" />
                              Select Video File
                            </>
                          )}
                        </Button>
                        {selectedFile && (
                          <div className="flex items-center space-x-4 mt-4">
                            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs font-medium text-green-700 dark:text-green-300">Ready</span>
                            </div>
                            <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30">
                              <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14,6L10.25,11L13.1,14.8L11.5,16C9.81,13.75 7,10 7,10L1,18H23L14,6Z"/>
                              </svg>
                              <span className="text-xs font-medium text-blue-700 dark:text-blue-300">MP4</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-6">
            <Button
              type="submit"
              disabled={uploadMutation.isPending || !selectedFile}
              data-testid="button-upload"
              size="lg"
              className="h-12 px-8 rounded-xl font-semibold btn-gradient disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploadMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-3" />
                  <span>Uploading to Vimeo...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-3" />
                  <span>Upload Video</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    );
  }

  return (
    <Form {...replaceVideoForm}>
      <form
        // We'll handle submission manually
        onSubmit={(e) => {
          e.preventDefault();
          // Set the form value first
          replaceVideoForm.setValue("videoId", videoIdInputValue);
          // Then submit
          replaceVideoForm.handleSubmit(onReplaceVideoSubmit)(e);
        }}
        className="space-y-6"
      >
        <FormField
          control={replaceVideoForm.control}
          name="videoId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Vimeo ID or URL</FormLabel>
              <FormControl>
                <div className="relative">
                  <input
                    type="text"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={videoIdInputValue}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setVideoIdInputValue(newValue);

                      // Update the form value
                      field.onChange(newValue);

                      // Clear any errors
                      replaceVideoForm.clearErrors("videoId");
                    }}
                    placeholder="Enter Vimeo ID or URL (e.g., 1115842842)"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-testid="input-video-id"
                  />
                  {field.value && (
                    <div className="absolute right-2 top-2 text-xs text-muted-foreground">
                      {field.value.length} chars
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={replaceVideoForm.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Leave empty to keep existing"
                    {...field}
                    data-testid="input-replace-title"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={replaceVideoForm.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Leave empty to keep existing"
                    {...field}
                    data-testid="input-replace-tags"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={replaceVideoForm.control}
          name="file"
          render={() => (
            <FormItem>
              <FormLabel className="text-base font-semibold flex items-center space-x-2">
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <span>Replacement Video File</span>
              </FormLabel>
              <FormControl>
                <div className="relative">
                  <div className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                    selectedFile 
                      ? 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-950/20' 
                      : 'border-purple-200 hover:border-purple-400 bg-purple-50/30 dark:border-purple-700 dark:hover:border-purple-500 dark:bg-purple-950/10'
                  }`}>
                    <div className="flex flex-col items-center space-y-6">
                      {selectedFile ? (
                        <div className="w-20 h-20 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center">
                          <svg className="w-10 h-10 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                      )}
                      <div className="space-y-2">
                        {selectedFile ? (
                          <>
                            <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                              Ready to Replace!
                            </p>
                            <p className="text-base text-green-600 dark:text-green-400 font-medium">
                              {selectedFile.name}
                            </p>
                            <p className="text-sm text-green-600/80 dark:text-green-400/80">
                              Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                            <div className="mt-3 p-3 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                              <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                                ⚠️ This will replace the existing video content while preserving the URL and analytics
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-semibold text-foreground">
                              Select replacement video file
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Upload MP4 file to replace existing content
                            </p>
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        accept=".mp4,video/mp4"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="replace-video-file"
                        data-testid="input-replace-video-file"
                      />
                      <Button
                        type="button"
                        variant={selectedFile ? "outline" : "default"}
                        size="lg"
                        onClick={() =>
                          document.getElementById("replace-video-file")?.click()
                        }
                        data-testid="button-select-replace-file"
                        className={`h-12 px-8 rounded-xl font-medium transition-all ${
                          selectedFile 
                            ? 'hover:bg-green-50 dark:hover:bg-green-950/20 border-green-300 dark:border-green-700'
                            : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:shadow-lg hover:from-purple-600 hover:to-pink-700'
                        }`}
                      >
                        {selectedFile ? (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            Change File
                          </>
                        ) : (
                          <>
                            <CloudUpload className="w-4 h-4 mr-2" />
                            Select Replacement File
                          </>
                        )}
                      </Button>
                      {selectedFile && (
                        <div className="flex items-center space-x-4 mt-4">
                          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-xs font-medium text-green-700 dark:text-green-300">Ready</span>
                          </div>
                          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30">
                            <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Replace</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-6">
          <Button
            type="submit"
            disabled={replaceMutation.isPending || !selectedFile || !videoIdInputValue.trim()}
            size="lg"
            className="h-12 px-8 rounded-xl font-semibold bg-gradient-to-r from-purple-500 to-pink-600 text-white hover:shadow-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="button-replace"
          >
            {replaceMutation.isPending ? (
              <>
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-3" />
                <span>Replacing Video...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Replace Video</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
