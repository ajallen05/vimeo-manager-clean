// routes.ts
import type { Express, Request, Response as ExpressResponse } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import {
  uploadVideoSchema,
  replaceVideoSchema,
  vimeoCredentialsSetupSchema,
  type VimeoCredentials
} from "@shared/schema";
import { Readable } from "stream";
import { VimeoUploader, type VimeoVideo } from "./vimeo";
import { z } from "zod";
import archiver from "archiver";
import ExcelJS from 'exceljs';
import { registerOptimizedExportRoutes } from './export-routes-optimized';
import fs from "fs/promises"; // Unified import for fs promises
import { registerExportRoutes } from "./export-routes";

// Type definitions for video downloads
interface VideoDownloadResult {
  success: boolean;
  name?: string;
  buffer?: ArrayBuffer;
  error?: string;
}

interface DownloadProgress {
  successCount: number;
  errorCount: number;
  total: number;
}

// Type for download link
interface DownloadLink {
  quality: string;
  size: number;
  link: string;
}

// Express request with file
interface FileRequest extends Request {
  file?: Express.Multer.File;
}

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB limit
});

// Constants
const DOWNLOAD_TIMEOUT = 60000; // 60 seconds timeout
const CONCURRENCY = 3; // Maximum concurrent downloads
const API_TIMEOUT = 30000; // 30 seconds for API calls

// Utility function for file cleanup
async function cleanupFile(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
    await fs.unlink(filePath);
    console.log(`Cleaned up file: ${filePath}`);
  } catch (error) {
    if ((error as any).code !== 'ENOENT') {
      console.error(`Failed to clean up file ${filePath}:`, error);
    }
  }
}

// Utility function for Vimeo API fetch with timeout
async function vimeoFetch(
  url: string,
  options: RequestInit = {},
  credentials: VimeoCredentials,
  timeoutMs: number = API_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.vimeo.*+json;version=3.4",
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Vimeo API error ${response.status}: ${errorText}`);
    }

    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Type for video metadata row
interface VideoMetadataRow {
  id: string;
  name: string;
  description: string;
  tags: string;
  duration: number;
  created_time: string;
  modified_time: string;
  privacy: string;
  views: number;
  likes: number;
  comments: number;
  resolution: string;
  fileSize: number;
  status: string;
}

// Helper functions
function formatDate(date: string | null | undefined): string {
  if (!date) return '[Date not available]';
  try {
    return new Date(date).toLocaleString();
  } catch {
    return '[Invalid date format]';
  }
}

// Fixed: Unified getVimeoCredentials function
async function getVimeoCredentials(): Promise<VimeoCredentials> {
  const credentials = await storage.getActiveCredentials();
  if (!credentials) {
    throw new Error("Vimeo credentials not configured");
  }
  return credentials;
}

export default async function registerRoutes(app: Express): Promise<Server> {
  // Error handler middleware
  const errorHandler = (err: Error, req: Request, res: ExpressResponse, next: Function) => {
    console.error('Unhandled error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
    next(err);
  };
  
  app.use(errorHandler);
  const httpServer = createServer(app);

  // Register export routes (both original and optimized)
  registerExportRoutes(app);
  registerOptimizedExportRoutes(app);

  // Upload new video with improved error handling and logging
  app.post("/api/videos/upload", upload.single("video"), async (req: FileRequest, res: ExpressResponse) => {
    const videoFile = req.file;

    if (!videoFile) {
      return res.status(400).json({ message: "Video file is required" });
    }

    try {
      const credentials = await getVimeoCredentials();
      const validation = uploadVideoSchema.safeParse(req.body);

      if (!validation.success) {
        await cleanupFile(videoFile.path);
        return res.status(400).json({
          message: "Invalid request data",
          errors: validation.error.errors,
        });
      }

      const { title, description, tags, folderId } = validation.data;
      console.log("Uploading video:", { title, description: description?.substring(0, 50) + '...', tags, folderId });
      const uploader = new VimeoUploader(credentials.accessToken);

      console.log(`Starting upload for video: ${title}, folderId: ${folderId}`);

      const result = await uploader.uploadVideo(
        videoFile.path,
        title,
        description,
        folderId,
        tags
      );
      const videoId = result.videoUri.split("/").pop();

      console.log(`✅ Video uploaded: ${videoId}, folderId: ${folderId}`);

      // Wait longer for Vimeo to process and index the video
      if (videoId && folderId) {
        try {
          // Increased initial delay to 10 seconds
          console.log("Waiting for Vimeo to process video (10s)...");
          await new Promise((resolve) => setTimeout(resolve, 10000));

          // Try to fetch video details with retry logic
          let videoData: any;
          let retries = 3;
          let lastError: Error | undefined;

          while (retries > 0) {
            try {
              console.log(`Fetching video details (${4 - retries}/3)...`);
              const videoResponse = await vimeoFetch(
                `https://api.vimeo.com/videos/${videoId}?fields=uri,name,description,tags,duration,download,embed,created_time`,
                {},
                credentials
              );

              videoData = await videoResponse.json();
              console.log("Successfully fetched video details");
              break;
            } catch (error) {
              lastError = error as Error;
              retries--;
              if (retries > 0) {
                const delay = 5000; // 5 second delay between retries
                console.log(`Retrying in ${delay}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          }

          if (!videoData) {
            throw lastError || new Error("Failed to fetch video details after multiple attempts");
          }

          const cleanFolderId = folderId.toString(); // Ensure it's a string, don't modify

          console.log(
            `Adding video ${videoId} to local storage with folderId: ${cleanFolderId}`
          );

          const videoRecord = {
            id: videoId,
            name: videoData.name,
            uri: videoData.uri,
            description: videoData.description || null,
            tags: videoData.tags?.map((tag: any) => tag.name) || [],
            folderId: cleanFolderId,
            duration: videoData.duration?.toString() || null,
            downloadUrl:
              videoData.download?.find((d: any) => d.quality === "source")
                ?.link || null,
            embedHtml: videoData.embed?.html || null,
            createdAt: new Date(videoData.created_time),
          };

          // Remove any existing video with this ID first
          await storage.deleteVideo(videoId);

          try {
            // Add the new video
            await storage.createVideo(videoRecord);
            console.log(`✅ Added video ${videoId} to local storage`);

            // Verify it was stored
            const storedVideo = await storage.getVideoById(videoId);
            console.log(
              `✅ Verification - stored video:`,
              storedVideo ? "Found" : "Not found"
            );

            res.json({
              message: folderId
                ? "Video uploaded and added to folder successfully"
                : "Video uploaded successfully",
              videoUri: result.videoUri,
              videoId: videoId,
              folderId: folderId,
            });
          } catch (error) {
            console.warn(
              "Failed to update local storage with new video:",
              error
            );
            const errMsg =
              error && (error as any).message
                ? (error as any).message
                : String(error);
            res
              .status(500)
              .json({ message: `Failed to upload video: ${errMsg}` });
          }
        } catch (error) {
          console.error("Error uploading video:", error);
          const errMsg =
            error && (error as any).message
              ? (error as any).message
              : String(error);
          res
            .status(500)
            .json({ message: `Failed to upload video: ${errMsg}` });
        }
      }
    } catch (error) {
      console.error("Error during upload process:", error);
      const errMsg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ message: `Failed to upload video: ${errMsg}` });
    } finally {
      // Clean up the uploaded file
      if (videoFile) {
        await cleanupFile(videoFile.path);
      }
    }
  });

  // Debug endpoint to check token scopes
  app.get("/api/debug/token-scopes", async (req: Request, res: ExpressResponse) => {
    try {
      const credentials = await getVimeoCredentials();
      const response = await vimeoFetch("https://api.vimeo.com/oauth/verify", {}, credentials);

      if (response.ok) {
        const data = await response.json();
        res.json({
          scopes: data.scope,
          hasInteract: data.scope && data.scope.includes("interact"),
          hasEdit: data.scope && data.scope.includes("edit"),
          hasUpload: data.scope && data.scope.includes("upload"),
        });
      } else {
        res.status(response.status).json({ error: "Failed to verify token" });
      }
    } catch (error) {
      res.status(500).json({ error: (error as any).message });
    }
  });

  // Debug endpoint to check local storage
  app.get("/api/debug/videos/:folderId", async (req: Request, res: ExpressResponse) => {
    try {
      const { folderId } = req.params;
      const localVideos = await storage.getVideosByFolderId(folderId);
      const allVideos = await storage.getVideosByFolderId(""); // Get all videos

      // Get unique folder IDs using Array methods instead of Set spread
      const uniqueFolderIds = allVideos
        .map((v) => v.folderId)
        .filter(
          (value, index, self) =>
            value !== null && self.indexOf(value) === index
        );

      res.json({
        folderId,
        localVideosInFolder: localVideos.length,
        localVideos: localVideos.map((v) => ({
          id: v.id,
          name: v.name,
          folderId: v.folderId,
          description: v.description,
          duration: v.duration,
        })),
        totalLocalVideos: allVideos.length,
        allLocalVideosFolderIds: uniqueFolderIds,
      });
    } catch (error) {
      res.status(500).json({ error: (error as any).message });
    }
  });

  // Replace existing video
  app.post(
    "/api/videos/:videoId/replace",
    upload.single("video"),
    async (req: FileRequest, res: ExpressResponse) => {
      const videoFile = req.file;
      const { videoId } = req.params;

      if (!videoFile) {
        return res.status(400).json({ message: "Video file is required" });
      }

      try {
        const credentials = await getVimeoCredentials();

        // Extract and validate data from request body
        const validation = replaceVideoSchema.safeParse(req.body);
        if (!validation.success) {
          await cleanupFile(videoFile.path);
          return res.status(400).json({
            message: "Invalid request data",
            errors: validation.error.errors,
          });
        }
        const { title, description, tags } = validation.data;

        console.log(`Starting replacement for video: ${videoId}`);
        const uploader = new VimeoUploader(credentials.accessToken);

        // Extract the current video details
        const videoResponse = await vimeoFetch(
          `https://api.vimeo.com/videos/${videoId}`,
          {},
          credentials
        );

        const videoData = await videoResponse.json();

        // Extract folder ID if it exists
        const folderId = videoData.parent_folder?.uri.split("/").pop() || null;

        // Replace the video
        const replaceResponse = await vimeoFetch(
          `https://api.vimeo.com/videos/${videoId}/versions`,
          {
            method: "POST",
            body: JSON.stringify({
              file_name: videoFile.originalname || "replaced_video.mp4",
              upload: {
                approach: "tus",
                size: videoFile.size,
              },
            }),
          },
          credentials
        );

        const replaceData = await replaceResponse.json();
        const uploadLink = replaceData.upload.upload_link;

        // Upload the new file
        const fileBuffer = await fs.readFile(videoFile.path);
        const uploadResponse = await fetch(uploadLink, {
          method: "PATCH",
          headers: {
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": "0",
            "Content-Type": "application/offset+octet-stream",
          },
          body: new Uint8Array(fileBuffer),
        });

        if (!uploadResponse.ok) {
          throw new Error(`File upload failed: ${uploadResponse.status}`);
        }

        // If title or description or tags were provided, update the video metadata
        if (title || description || tags) {
          const updateBody: Record<string, any> = {};
          if (title) updateBody["name"] = title;
          if (description) updateBody["description"] = description;
          if (tags) {
            updateBody["tags"] = tags
              .split(",")
              .map((t: string) => t.trim())
              .filter(Boolean);
          }

          const updateResponse = await vimeoFetch(
            `https://api.vimeo.com/videos/${videoId}`,
            {
              method: "PATCH",
              body: JSON.stringify(updateBody),
            },
            credentials
          );

          if (!updateResponse.ok) {
            console.warn(
              "Failed to update video metadata:",
              await updateResponse.text()
            );
          }
        }

        res.json({
          message: "Video replaced successfully",
          videoId: videoId,
        });
      } catch (error) {
        console.error("Error replacing video:", error);
        res.status(500).json({
          message: `Failed to replace video: ${
            (error as any).message || "Unknown error"
          }`,
        });
      } finally {
        // Clean up the uploaded file
        if (videoFile) {
          await cleanupFile(videoFile.path);
        }
      }
    }
  );

  // Get video captions
  app.get("/api/videos/:videoId/captions", async (req: Request, res: ExpressResponse) => {
    try {
      const { videoId } = req.params;
      const credentials = await getVimeoCredentials();
      const response = await vimeoFetch(
        `https://api.vimeo.com/videos/${videoId}/texttracks`,
        {},
        credentials
      );
      const data = await response.json();
      const captions = data.data.map((track: any) => ({
        id: track.uri.split("/").pop(),
        language: track.language,
        name: track.name,
        type: track.type,
        link: track.link,
        active: track.active,
      }));
      res.json({
        message: "Captions fetched successfully",
        captions,
      });
    } catch (error) {
      console.error(`Error fetching captions for video ${req.params.videoId}:`, error);
      res.status(500).json({ 
        message: 'Failed to fetch captions',
        error: (error as any).message 
      });
    }
  });

  // Get videos for a specific folder
  app.get("/api/folders/:folderId/videos", async (req: Request, res: ExpressResponse) => {
    try {
      const { folderId } = req.params;
      console.log(`Fetching videos for folder ${folderId}...`);
      
      const credentials = await getVimeoCredentials();
      const uploader = new VimeoUploader(credentials.accessToken);
      
      // First try the videos endpoint
      const response = await vimeoFetch(
        `https://api.vimeo.com/me/projects/${folderId}/videos?fields=uri,name,description,duration,created_time,modified_time,pictures.sizes,stats,metadata,privacy,files,download,embed,tags`, 
        {},
        credentials
      );

      const data = await response.json();
      const videos = data.data.map((video: any) => ({
        id: video.uri.split('/').pop(),
        uri: video.uri,
        name: video.name,
        description: video.description || null,
        tags: video.tags?.map((tag: any) => tag.name) || [],
        duration: video.duration?.toString() || null,
        downloadUrl: video.download?.find((d: any) => d.quality === 'source')?.link || null,
        embedHtml: video.embed?.html || null,
        created_time: video.created_time,
        modified_time: video.modified_time,
        privacy: video.privacy?.view || 'unknown',
        views: video.stats?.plays || 0,
        likes: video.metadata?.connections?.likes?.total || 0,
        comments: video.metadata?.connections?.comments?.total || 0,
        resolution: video.files ? 
          `${video.files[0]?.width}x${video.files[0]?.height}` : 
          'unknown',
        fileSize: video.files?.[0]?.size || 0,
        status: video.status || 'unknown',
        thumbnailUrl: video.pictures?.sizes?.[0]?.link || null,
        folderId
      }));

      console.log(`Found ${videos.length} videos in folder ${folderId}`);
      res.json(videos);

    } catch (error) {
      console.error('Error in folder videos endpoint:', error);
      res.status(500).json({ 
        message: 'Failed to fetch folder videos',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Check if credentials are configured
  app.get("/api/credentials/check", async (req: Request, res: ExpressResponse) => {
    try {
      const credentials = await storage.getActiveCredentials();
      res.json({ configured: !!credentials });
    } catch (error) {
      res.json({ configured: false });
    }
  });

  // Setup Vimeo credentials
  app.post("/api/credentials/setup", async (req: Request, res: ExpressResponse) => {
    try {
      const validation = vimeoCredentialsSetupSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid credentials data",
          errors: validation.error.errors,
        });
      }
      const { accessToken, clientId, clientSecret } = validation.data;
      const testResponse = await vimeoFetch("https://api.vimeo.com/me", {}, { accessToken, clientId, clientSecret });
      await storage.createCredentials({ accessToken, clientId, clientSecret });
      res.json({ message: "Credentials saved successfully" });
    } catch (error) {
      console.error("Error setting up credentials:", error);
      res.status(500).json({ message: "Failed to setup credentials" });
    }
  });

  // Interface for folder hierarchy
  interface FolderHierarchy {
    id: string;
    name: string;
    uri: string;
    parent_id?: string;
    hasChildren: boolean;
    path?: string;
    children?: FolderHierarchy[];
  }
  
  // Helper to fetch all pages for a Vimeo collection endpoint
  async function fetchAllPages(urlBase: string, credentials: VimeoCredentials): Promise<any[]> {
    let results: any[] = [];
    let page = 1;
    const per_page = 100; // use largest page size

    while (true) {
      const url = `${urlBase}${urlBase.includes('?') ? '&' : '?'}page=${page}&per_page=${per_page}`;
      const resp = await vimeoFetch(url, {}, credentials);
      const data = await resp.json();
      const items = Array.isArray(data.data) ? data.data : [];
      results = results.concat(items);
      // pagination
      const paging = data.paging || {};
      if (!paging.next || items.length === 0) break;
      page += 1;
    }
    return results;
  }

  // Helper function to fetch folders with hierarchy information (recursive, paginated)
  async function fetchFoldersWithHierarchy(
    credentials: VimeoCredentials,
    parentId?: string,
    parentPath?: string,
    currentDepth: number = 0,
    maxDepth: number = 2  // Reduced from 50 to 2 for initial load performance
  ): Promise<FolderHierarchy[]> {
    const baseUrl = parentId
      ? `https://api.vimeo.com/me/folders/${parentId}/folders`
      : "https://api.vimeo.com/me/folders";

    try {
      const items = await fetchAllPages(baseUrl, credentials);
      const folders: FolderHierarchy[] = [];

      for (const folder of items) {
        const id = String(folder.uri.split("/").pop() || "");
        const folderData: FolderHierarchy = {
          id,
          name: folder.name,
          uri: folder.uri,
          parent_id: parentId,
          hasChildren: false,
          path: parentPath ? `${parentPath}/${folder.name}` : folder.name,
          children: []
        };

        if (currentDepth < maxDepth) {
          // Recursively fetch children
          const childItems = await fetchFoldersWithHierarchy(
            credentials,
            id,
            folderData.path,
            currentDepth + 1,
            maxDepth
          );
          if (childItems.length > 0) {
            folderData.hasChildren = true;
            folderData.children = childItems;
          }
        } else {
          // Depth limit reached, just check if there are any children
          const checkUrl = `https://api.vimeo.com/me/folders/${id}/folders`;
          try {
            const check = await vimeoFetch(checkUrl, {}, credentials);
            const checkJson = await check.json();
            folderData.hasChildren = Array.isArray(checkJson.data) && checkJson.data.length > 0;
          } catch {}
        }

        folders.push(folderData);
      }

      return folders;
    } catch (error) {
      console.error('Error fetching folders:', error);
      return [];
    }
  }

  // Helper function to recursively fetch all folders (flattened) - DEEP RECURSIVE with pagination
  async function fetchAllFolders(
    credentials: VimeoCredentials,
    parentId?: string,
    parentPath?: string,
    depth: number = 0
  ): Promise<any[]> {
    const baseUrl = parentId
      ? `https://api.vimeo.com/me/folders/${parentId}/folders`
      : "https://api.vimeo.com/me/folders";
    
    try {
      console.log(`Fetching folders at depth ${depth}, parent: ${parentId || 'root'}, path: ${parentPath || 'root'}`);
      
      // Use paginated fetch to get ALL folders at this level
      const items = await fetchAllPages(baseUrl, credentials);
      let allFolders: any[] = [];
      
      console.log(`Found ${items.length} folders at depth ${depth}`);
      
      for (const folder of items) {
        const folderId = folder.uri.split("/").pop();
        const folderPath = parentPath ? `${parentPath} / ${folder.name}` : folder.name;
        
        console.log(`Processing folder: "${folder.name}" at depth ${depth}, full path: "${folderPath}"`);
        
        const folderData = {
          id: folderId,
          name: folder.name,
          displayName: folderPath,
          path: folderPath,
          uri: folder.uri,
          depth: depth, // Add depth for debugging
          parent_path: parentPath || null // Add parent path for debugging
        };
        
        // Add this folder to results
        allFolders.push(folderData);
        
        // Recursively fetch ALL subfolders (no depth limit)
        try {
          const subfolders = await fetchAllFolders(
            credentials,
            folderId,
            folderPath,
            depth + 1
          );
          allFolders = allFolders.concat(subfolders);
        } catch (subError) {
          console.warn(`Failed to fetch subfolders for ${folderId}:`, subError);
          // Continue with other folders even if one fails
        }
      }
      
      console.log(`Total folders collected at depth ${depth}: ${allFolders.length}`);
      return allFolders;
    } catch (error) {
      console.error(`Error fetching folders at depth ${depth}:`, error);
      return [];
    }
  }

  // ALGORITHMIC: Efficient single-API-call folder path construction
  class VimeoFolderPathBuilder {
    private folderMap: Map<string, any>;
    private pathCache: Map<string, string>;

    constructor(allFolders: any[]) {
      this.folderMap = new Map();
      this.pathCache = new Map();
      
      console.log(`📋 Initializing path builder with ${allFolders.length} folders...`);
      
      // Build lookup map using folder URI as key
      allFolders.forEach(folder => {
        this.folderMap.set(folder.uri, folder);
      });
      
      console.log(`✅ Folder lookup map built with ${this.folderMap.size} entries`);
    }
    
    getPath(folderUri: string): string {
      // Check cache first for performance
      if (this.pathCache.has(folderUri)) {
        return this.pathCache.get(folderUri)!;
      }
      
      // Build path algorithmically
      const path = this._buildPathRecursive(folderUri);
      this.pathCache.set(folderUri, path);
      
      return path;
    }
    
    private _buildPathRecursive(folderUri: string): string {
      const folder = this.folderMap.get(folderUri);
      if (!folder) return 'Unknown';
      
      // Check if folder has parent folder metadata
      const parentUri = folder.metadata?.connections?.parent_folder?.uri;
      
      if (!parentUri) {
        // Root folder - no parent
        return folder.name;
      }
      
      // Recursive case - build parent path first
      const parentPath = this.getPath(parentUri);
      return `${parentPath} / ${folder.name}`;
    }
    
    getAllPaths(): Record<string, string> {
      const paths: Record<string, string> = {};
      let processed = 0;
      
      this.folderMap.forEach((folder, uri) => {
        paths[uri] = this.getPath(uri);
        processed++;
        if (processed % 50 === 0) {
          console.log(`Processed ${processed}/${this.folderMap.size} folder paths...`);
        }
      });
      
      console.log(`✅ Generated paths for all ${processed} folders`);
      return paths;
    }
  }

  async function fetchAllFoldersWithAlgorithmicPaths(credentials: VimeoCredentials): Promise<any[]> {
    console.log('🚀 Using algorithmic approach - single paginated API call for ALL folders...');
    
    try {
      // Get ALL folders with pagination using the existing fetchAllPages function
      const baseUrl = 'https://api.vimeo.com/me/projects';
      const allFolders = await fetchAllPages(`${baseUrl}?fields=uri,name,metadata.connections.parent_folder.uri`, credentials);
      
      console.log(`📥 Retrieved ${allFolders.length} folders from paginated API calls`);
      
      if (allFolders.length === 0) {
        console.log('⚠️ No folders found, trying alternative endpoint...');
        // Try the folders endpoint instead
        const foldersUrl = 'https://api.vimeo.com/me/folders';
        const alternativeFolders = await fetchAllPages(`${foldersUrl}?fields=uri,name,metadata.connections.parent_folder.uri`, credentials);
        console.log(`📥 Retrieved ${alternativeFolders.length} folders from alternative endpoint`);
        if (alternativeFolders.length > 0) {
          allFolders.push(...alternativeFolders);
        }
      }
      
      if (allFolders.length === 0) {
        throw new Error('No folders found from any endpoint');
      }
      
      // Initialize path builder
      const pathBuilder = new VimeoFolderPathBuilder(allFolders);
      
      // Generate all paths
      const allPaths = pathBuilder.getAllPaths();
      
      // Create final folder list with proper paths
      const finalFolders = allFolders.map(folder => {
        const folderId = folder.uri.split('/').pop();
        const fullPath = allPaths[folder.uri] || folder.name;
        
        return {
          id: folderId,
          name: folder.name,
          displayName: fullPath,
          path: fullPath,
          uri: folder.uri,
          parent_uri: folder.metadata?.connections?.parent_folder?.uri || null
        };
      });
      
      console.log(`✅ Built ${finalFolders.length} folders with algorithmic paths`);
      return finalFolders;
      
    } catch (error) {
      console.error('❌ Error in algorithmic folder fetching:', error);
      // Fallback to the original recursive method
      console.log('🔄 Falling back to recursive method...');
      return await fetchAllFolders(credentials);
    }
  }

  // Get all folders from Vimeo API (with optional hierarchy)
  app.get("/api/folders", async (req: Request, res: ExpressResponse) => {
    try {
      const { hierarchical } = req.query;
      const credentials = await getVimeoCredentials();
      
      // Add caching headers for browser caching
      res.setHeader('Cache-Control', 'private, max-age=300'); // Cache for 5 minutes
      
      if (hierarchical === 'true') {
        // Return hierarchical structure for tree view with limited depth for performance
        const folders = await fetchFoldersWithHierarchy(credentials, undefined, undefined, 0, 2);
        res.json(folders);
      } else {
        // Return flattened list for backward compatibility - GET ALL FOLDERS RECURSIVELY
        console.log('Starting recursive fetch of ALL folders...');
        const folders = await fetchAllFolders(credentials);
        console.log(`✅ TOTAL FOLDERS FETCHED: ${folders.length}`);
        await storage.updateFolders(folders);
        res.json(folders);
      }
    } catch (error) {
      console.error("Error fetching folders:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch folders from Vimeo API" });
    }
  });
  
  // Get subfolders of a specific folder
  app.get("/api/folders/:folderId/subfolders", async (req: Request, res: ExpressResponse) => {
    try {
      const { folderId } = req.params;
      const credentials = await getVimeoCredentials();
      
      const subfolders = await fetchFoldersWithHierarchy(
        credentials,
        folderId,
        undefined,
        0,
        1  // Only fetch immediate children for performance
      );
      
      res.json(subfolders);
    } catch (error) {
      console.error("Error fetching subfolders:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch subfolders from Vimeo API" });
    }
  });

  // Search folders by name and path - RECURSIVE SEARCH THROUGH ALL FOLDERS
  app.get("/api/folders/search", async (req: Request, res: ExpressResponse) => {
    try {
      const { q } = req.query;
      const credentials = await getVimeoCredentials();
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ message: "Search query 'q' is required" });
      }
      
      const searchQuery = q.toLowerCase().trim();
      console.log(`🔍 Searching for: "${searchQuery}"`);
      
      // Get ALL folders recursively (flattened) with absolute paths
      const allFolders = await fetchAllFolders(credentials);
      console.log(`📁 Total folders available for search: ${allFolders.length}`);
      
      // Filter folders that match the search query in BOTH name and path
      const matchingFolders = allFolders.filter(folder => 
        folder.name.toLowerCase().includes(searchQuery) ||
        folder.path.toLowerCase().includes(searchQuery)
      );
      
      console.log(`✅ Found ${matchingFolders.length} matching folders for "${searchQuery}"`);
      
      // Add cache headers
      res.setHeader('Cache-Control', 'private, max-age=60'); // Cache for 1 minute
      
      res.json(matchingFolders);
    } catch (error) {
      console.error("❌ Error searching folders:", error);
      res
        .status(500)
        .json({ message: "Failed to search folders" });
    }
  });

  // Get ALL folders recursively - for search component
  app.get("/api/folders/all", async (req: Request, res: ExpressResponse) => {
    try {
      const credentials = await getVimeoCredentials();
      
      console.log('📥 Request for ALL folders (recursive with proper paths)');
      
      // Set longer cache since this is expensive
      res.setHeader('Cache-Control', 'private, max-age=600'); // Cache for 10 minutes
      
      // Get ALL folders with ALGORITHMIC PATH CONSTRUCTION (single API call)
      const allFolders = await fetchAllFoldersWithAlgorithmicPaths(credentials);
      
      console.log(`📤 Returning ${allFolders.length} total folders with absolute paths`);
      res.json(allFolders);
    } catch (error) {
      console.error("❌ Error fetching all folders:", error);
      res
        .status(500)
        .json({ message: "Failed to fetch all folders from Vimeo API" });
    }
  });

  // DEBUG: Get first 10 folders to check structure
  app.get("/api/folders/debug", async (req: Request, res: ExpressResponse) => {
    try {
      const credentials = await getVimeoCredentials();
      
      console.log('🔍 DEBUG: Testing new path resolution...');
      
      // Get ALL folders with algorithmic path resolution
      const allFolders = await fetchAllFoldersWithAlgorithmicPaths(credentials);
      
      // Return first 10 folders with detailed info
      const debugFolders = allFolders.slice(0, 10).map(folder => ({
        id: folder.id,
        name: folder.name,
        path: folder.path,
        parent_id: folder.parent_id,
        uri: folder.uri
      }));
      
      // Also look for all "Week 3" folders to see their different paths
      const week3Folders = allFolders.filter(folder => 
        folder.name.toLowerCase().includes('week 3')
      ).slice(0, 20).map(folder => ({
        id: folder.id,
        name: folder.name,
        path: folder.path,
        parent_id: folder.parent_id
      }));
      
      res.json({
        total_folders: allFolders.length,
        sample_folders: debugFolders,
        week3_examples: week3Folders
      });
    } catch (error) {
      console.error("❌ Error in debug endpoint:", error);
      res.status(500).json({ message: "Debug failed" });
    }
  });

  // TEST: Algorithmic path construction
  app.get("/api/test/algorithmic-paths", async (req: Request, res: ExpressResponse) => {
    try {
      const credentials = await getVimeoCredentials();
      
      console.log('🧪 TESTING: Algorithmic path construction...');
      
      // Test the new algorithmic approach
      const folders = await fetchAllFoldersWithAlgorithmicPaths(credentials);
      
      // Find some example folders to show the path construction
      const examples = folders.slice(0, 10).map(folder => ({
        id: folder.id,
        name: folder.name,
        path: folder.path,
        parent_uri: folder.parent_uri
      }));
      
      // Look for "Week 3" examples specifically
      const week3Examples = folders
        .filter(folder => folder.name.toLowerCase().includes('week 3'))
        .slice(0, 10)
        .map(folder => ({
          id: folder.id,
          name: folder.name,
          path: folder.path,
          parent_uri: folder.parent_uri
        }));
      
      res.json({
        success: true,
        total_folders: folders.length,
        examples,
        week3_examples: week3Examples,
        message: 'Algorithmic path construction test completed'
      });
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Export metadata as CSV
  app.post("/api/videos/export-csv", async (req: Request, res: ExpressResponse) => {
    try {
      const { videoIds } = req.body;
      
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        return res.status(400).json({ message: 'No video IDs provided' });
      }

      // Limit videos for CSV as well
      if (videoIds.length > 100) {
        return res.status(400).json({ 
          message: 'Too many videos requested. Please limit to 100 videos per export.' 
        });
      }

      console.log(`Starting CSV export for ${videoIds.length} videos...`);

      const credentials = await getVimeoCredentials();
      const uploader = new VimeoUploader(credentials.accessToken);
      const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || '5000'}`;
      
      // Updated CSV headers with download links
      const headers = [
        'Video ID', 'Title', 'Description', 'Tags', 'Duration (min)', 
        'Created Date', 'Modified Date', 'Privacy', 'Views', 'Likes', 
        'Comments', 'Resolution', 'File Size (MB)', 'Status',
        'Video Download URL', 'Thumbnail Download URL', 'Caption Download URL',
        'Available Qualities', 'Available Captions'
      ];
      
      let csvContent = headers.join(',') + '\n';
      let successCount = 0;
      let errorCount = 0;
      
      // Process videos with same batching logic as Excel export
      const BATCH_SIZE = 8; // 🚀 OPTIMIZED: Increased from 3 to 8
      const batches = [];
      for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
        batches.push(videoIds.slice(i, i + BATCH_SIZE));
      }

      // Helper function to escape CSV values
      const escapeCSV = (value: string | null | undefined): string => {
        if (!value) return '""';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`Processing CSV batch ${batchIndex + 1}/${batches.length} (${batch.length} videos)...`);
        
        for (const videoId of batch) {
          try {
            const video = await uploader.getVideoDetails(videoId);
            
            if (video) {
              // Get download links and metadata like in Excel export
              let downloadQualities = '';
              let videoDownloadUrl = '';
              let thumbnailDownloadUrl = '';
              let captionDownloadUrl = '';
              let captionLanguages: string[] = [];

              // Get video download info
              try {
                const infoResp = await vimeoFetch(
                  `https://api.vimeo.com/videos/${videoId}?fields=download,pictures.sizes`,
                  {},
                  credentials
                );
                
                const info = await infoResp.json();
                
                // Process download links
                if (Array.isArray(info.download) && info.download.length > 0) {
                  const bestDownload = info.download.reduce((best: any, current: any) => {
                    if (!best) return current;
                    return (current.size || 0) > (best.size || 0) ? current : best;
                  }, null);
                  
                  if (bestDownload) {
                    videoDownloadUrl = bestDownload.link || `https://vimeo.com/${videoId}/download`;
                  }
                  
                  downloadQualities = info.download.map((d: any) => {
                    const sizeMb = d.size ? `${Math.round(d.size / 1024 / 1024)}MB` : 'unknown';
                    return `${d.quality}${d.height ? ` (${d.height}p)` : ''} - ${sizeMb}`;
                  }).join('; ');
                }
                
                // Process thumbnail
                const sizes = info.pictures?.sizes || [];
                if (Array.isArray(sizes) && sizes.length > 0) {
                  const largestThumbnail = sizes.reduce((largest, current) => {
                    return current.width > largest.width ? current : largest;
                  });
                  if (largestThumbnail?.link) {
                    // Add cache-busting for better reliability after video replacement
                    const separator = largestThumbnail.link.includes('?') ? '&' : '?';
                    thumbnailDownloadUrl = `${largestThumbnail.link}${separator}_export=${Date.now()}`;
                  }
                }
              } catch (e) {
                console.warn(`Failed to fetch download info for ${videoId}:`, e);
              }

              // Get caption info
              try {
                const txResp = await vimeoFetch(
                  `https://api.vimeo.com/videos/${videoId}/texttracks`,
                  {},
                  credentials
                );
                
                const txData = await txResp.json();
                const tracks = Array.isArray(txData.data) ? txData.data : [];
                captionLanguages = tracks.map((t: any) => `${t.language}${t.default ? ' (default)' : ''}`);
                
                if (tracks.length > 0) {
                  const defaultTrack = tracks.find((t: any) => t.default) || tracks[0];
                  if (defaultTrack?.link) {
                    captionDownloadUrl = defaultTrack.link;
                  }
                }
              } catch (e) {
                console.warn(`Failed to fetch captions for ${videoId}:`, e);
              }

              const row = [
                videoId,
                escapeCSV(video.name || ''),
                escapeCSV(video.description || ''),
                escapeCSV(Array.isArray(video.tags) ? video.tags.join(', ') : video.tags || ''),
                Math.round((typeof video.duration === 'number' ? video.duration : 0) / 60),
                escapeCSV(video.created_time || ''),
                escapeCSV(video.modified_time || ''),
                escapeCSV(video.privacy || ''),
                video.views || 0,
                video.likes || 0,
                video.comments || 0,
                escapeCSV(video.resolution || ''),
                Math.round((video.fileSize || 0) / 1024 / 1024),
                escapeCSV(video.status || ''),
                videoDownloadUrl || '[No download available]',
                thumbnailDownloadUrl || '[No thumbnail available]',
                captionDownloadUrl || '[No captions available]',
                escapeCSV(downloadQualities || '[No qualities available]'),
                escapeCSV(captionLanguages.join(', ') || '[No captions]')
              ];
              
              csvContent += row.join(',') + '\n';
              successCount++;
            }
          } catch (error) {
            errorCount++;
            console.warn(`Failed to fetch details for video ${videoId}:`, error);
            const errorRow = [
              videoId,
              '"Error"',
              '"Failed to fetch video details"',
              '""', '0', '""', '""', '""', '0', '0', '0', '""', '0', '"Error"',
              '""', '"[Error]"', '"[Error]"', '"[Error]"', '"[Error]"', '"[Error]"'
            ];
            csvContent += errorRow.join(',') + '\n';
          }
        }
        
        // Add delay between batches
        // 🚀 OPTIMIZED: Reduced delay between batches  
        if (batchIndex < batches.length - 1) {
          console.log('Waiting 300ms before next batch...');
          await new Promise(resolve => setTimeout(resolve, 300)); // Reduced from 1000ms to 300ms
        }
      }
      
      // Add summary at the end of CSV
      csvContent += '\n';
      csvContent += 'EXPORT SUMMARY\n';
      csvContent += `Total Videos Requested,${videoIds.length}\n`;
      csvContent += `Successfully Processed,${successCount}\n`;
      csvContent += `Failed to Process,${errorCount}\n`;
      csvContent += `Export Date,"${new Date().toLocaleString()}"\n`;
      csvContent += '\n';
      csvContent += 'DOWNLOAD INSTRUCTIONS:\n';
      csvContent += '"• Copy the download URLs and paste them into your browser to download files"\n';
      csvContent += '"• Video downloads stream through your server to avoid CORS issues"\n';
      csvContent += '"• Thumbnail downloads get the highest quality available"\n';
      csvContent += '"• Caption downloads are converted to plain text format"\n';
      
      console.log(`CSV export complete. Success: ${successCount}, Errors: ${errorCount}`);
      
      // Send CSV file
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=vimeo-metadata.csv');
      res.send(csvContent);
      
    } catch (error) {
      console.error('Error generating CSV:', error);
      res.status(500).json({ 
        message: 'Failed to generate CSV',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Direct caption download endpoint
  app.get("/api/videos/:videoId/captions.txt", async (req: Request, res: ExpressResponse) => {
    try {
      const { videoId } = req.params;
      const { v } = req.query; // Cache-busting parameter
      const credentials = await getVimeoCredentials();

      // Get caption tracks from Vimeo with cache-busting
      const captionsResponse = await vimeoFetch(
        `https://api.vimeo.com/videos/${videoId}/texttracks${v ? `?_cb=${v}&_t=${Date.now()}` : ''}`,
        {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        },
        credentials
      );
      
      const captionsData = await captionsResponse.json();
      const tracks = Array.isArray(captionsData.data) ? captionsData.data : [];
      
      if (tracks.length === 0) {
        // Set headers for file download
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=captions-${videoId}${v ? `-v${v}` : ''}.txt`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send('No captions available for this video');
        return;
      }

      // Get the default track or first available track
      const defaultTrack = tracks.find((t: any) => t.default) || tracks[0];
      
      if (!defaultTrack?.link) {
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=captions-${videoId}${v ? `-v${v}` : ''}.txt`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send('No caption download link available');
        return;
      }

      // Add cache-busting to caption URL if version parameter provided
      let captionUrl = defaultTrack.link;
      if (v) {
        const separator = captionUrl.includes('?') ? '&' : '?';
        captionUrl += `${separator}_cb=${v}&_t=${Date.now()}`;
      }

      // Fetch the actual caption content from Vimeo with cache-busting headers
      const captionContentResponse = await fetch(captionUrl, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!captionContentResponse.ok) {
        throw new Error('Failed to fetch caption content from Vimeo');
      }

      const captionContent = await captionContentResponse.text();

      // Set headers for file download with cache control
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename=captions-${videoId}${v ? `-v${v}` : ''}.txt`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Send the actual captions content
      res.send(captionContent || 'No caption content available');

    } catch (error) {
      console.error(`Error fetching captions for video ${req.params.videoId}:`, error);
      res.status(500).json({ 
        message: 'Failed to fetch captions',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get video download links endpoint
  app.get("/api/videos/:videoId/download-links", async (req: Request, res: ExpressResponse) => {
    try {
      const { videoId } = req.params;
      const credentials = await getVimeoCredentials();

      // Get download links from Vimeo
      const response = await vimeoFetch(
        `https://api.vimeo.com/videos/${videoId}?fields=download,name`,
        {},
        credentials
      );
      const data = await response.json();
      
      if (!data.download || !data.download.length) {
        throw new Error('No download available for this video');
      }

      // Transform download data to include all available qualities
      const downloadLinks = data.download.map((download: any) => ({
        quality: download.quality,
        size: download.size,
        link: download.link,
        width: download.width,
        height: download.height
      }));

      res.json({
        videoName: data.name || `video-${videoId}`,
        downloadLinks
      });

    } catch (error) {
      console.error(`Error fetching download links for video ${req.params.videoId}:`, error);
      res.status(500).json({ 
        message: 'Failed to fetch download links',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Direct video download endpoint (now simplified to redirect to Vimeo)
  app.get("/api/videos/:videoId/download", async (req: Request, res: ExpressResponse) => {
    try {
      const { videoId } = req.params;
      const { quality = 'source' } = req.query;
      const credentials = await getVimeoCredentials();

      // Get download links from Vimeo
      const response = await vimeoFetch(
        `https://api.vimeo.com/videos/${videoId}?fields=download,name`,
        {},
        credentials
      );
      const data = await response.json();
      
      if (!data.download || !data.download.length) {
        throw new Error('No download available for this video');
      }

      // Find the requested quality or best available
      let downloadLink = data.download.find((d: any) => d.quality === quality);
      if (!downloadLink) {
        // Fallback to highest quality
        downloadLink = data.download.reduce((best: any, current: any) => 
          (current.size || 0) > (best.size || 0) ? current : best
        );
      }

      if (!downloadLink?.link) {
        throw new Error('Download link not available');
      }

      // Redirect directly to Vimeo's download URL
      res.redirect(302, downloadLink.link);

    } catch (error) {
      console.error(`Error downloading video ${req.params.videoId}:`, error);
      res.status(500).json({ 
        message: 'Failed to download video',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Direct thumbnail download endpoint
  app.get("/api/videos/:videoId/thumbnail", async (req: Request, res: ExpressResponse) => {
    try {
      const { videoId } = req.params;
      const { v } = req.query; // Cache-busting parameter
      const credentials = await getVimeoCredentials();
      const uploader = new VimeoUploader(credentials.accessToken);

      // Get video details to get the thumbnail URL
      const video = await uploader.getVideoDetails(videoId);
      
      if (!video || !video.pictures || !video.pictures.sizes.length) {
        throw new Error('Thumbnail not found');
      }

      // Get the highest quality thumbnail
      const thumbnail = video.pictures.sizes.reduce((prev: any, curr: any) => 
        curr.width > prev.width ? curr : prev
      );

      // Add cache-busting to thumbnail URL if version parameter provided
      let thumbnailUrl = thumbnail.link;
      if (v) {
        const separator = thumbnailUrl.includes('?') ? '&' : '?';
        thumbnailUrl += `${separator}_cb=${v}&_t=${Date.now()}`;
      }

      // Fetch the thumbnail with cache-busting headers
      const thumbnailResponse = await fetch(thumbnailUrl, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      
      if (!thumbnailResponse.ok) {
        throw new Error('Failed to fetch thumbnail');
      }

      // Set headers for image download with cache control
      res.setHeader('Content-Type', thumbnailResponse.headers.get('content-type') || 'image/jpeg');
      res.setHeader('Content-Disposition', `attachment; filename=thumbnail-${videoId}${v ? `-v${v}` : ''}.jpg`);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Convert the ReadableStream to a Buffer and send it
      const buffer = Buffer.from(await thumbnailResponse.arrayBuffer());
      res.send(buffer);

    } catch (error) {
      console.error(`Error fetching thumbnail for video ${req.params.videoId}:`, error);
      res.status(500).json({ 
        message: 'Failed to fetch thumbnail',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Bulk download videos - Simple memory-based approach
  app.post("/api/videos/bulk-download", async (req: Request, res: ExpressResponse) => {
    req.setTimeout(0);
    res.setTimeout(0);
    
    try {
      const { videoIds, quality } = req.body as { videoIds: string[]; quality?: 'source' | 'hd' | 'sd' };
      
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        res.status(400).json({ message: 'No video IDs provided' });
        return;
      }

      console.log(`Starting bulk download for ${videoIds.length} videos...`);
      const credentials = await getVimeoCredentials();
      
      // New approach: Download to memory first, then send complete archive
      const archiver = require('archiver');
      const archive = archiver('zip', { 
        zlib: { level: 1 },  // Minimal compression for speed
      });
      
      // Collect archive data in memory
      const chunks: Buffer[] = [];
      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      
      let archiveError: Error | null = null;
      archive.on('error', (err: Error) => {
        archiveError = err;
        console.error('Archive error:', err);
      });

      // Handle client disconnect 
      const handleDisconnect = () => {
        if (!isClientDisconnected) {
          isClientDisconnected = true;
          console.log(`Client disconnected at ${new Date().toLocaleString()}, aborting...`);
        }
      };
      
      req.on('close', handleDisconnect);
      req.on('error', handleDisconnect);
      res.on('close', handleDisconnect);
      res.on('error', handleDisconnect);

      // Helper to select download link by requested quality or best available
      const selectDownloadLink = (downloads: any[], preferred?: 'source' | 'hd' | 'sd') => {
        if (!Array.isArray(downloads) || downloads.length === 0) return null;
        if (preferred) {
          const match = downloads.find((d: any) => d.quality === preferred);
          if (match) return match;
        }
        // Fallback: pick largest by size
        return downloads.reduce((best: any, curr: any) => (curr.size > (best?.size || 0) ? curr : best), null) || downloads[0];
      };

      let successCount = 0;
      let errorCount = 0;

      // Step 1: Resolve download links in parallel (limit concurrency to be nice to API)
      const linkConcurrency = 5;
      let index = 0;
      const tasks: { videoId: string; name: string; link: string }[] = [];

      const fetchLinkWorker = async () => {
        while (index < videoIds.length && !isClientDisconnected) {
          const i = index++;
          const vid = videoIds[i];
          try {
            const videoResponse = await vimeoFetch(
              `https://api.vimeo.com/videos/${vid}?fields=download,name`,
              {},
              credentials
            );
            const videoData = await videoResponse.json();
            const selected = selectDownloadLink(videoData.download, quality);
            if (!selected?.link) {
              throw new Error('No valid download link found');
            }
            tasks.push({ videoId: vid, name: videoData.name || vid, link: selected.link });
          } catch (err) {
            errorCount++;
            const msg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`Failed to prepare ${vid}:`, msg);
            archive.append(`Error preparing video ${vid}: ${msg}\n`, { name: `ERROR_${vid}.txt` });
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(linkConcurrency, videoIds.length) }, fetchLinkWorker));

      if (isClientDisconnected) {
        console.log('Client disconnected before downloads started');
        return;
      }

      // Step 2: Download and append to archive concurrently
      const downloadConcurrency = 3;
      let dIndex = 0;

      const downloadWorker = async () => {
        while (dIndex < tasks.length && !isClientDisconnected) {
          const t = tasks[dIndex++];
          
          // Double-check client connection before starting each download
          if (isClientDisconnected) {
            console.log('Client disconnected, worker exiting...');
            break;
          }
          
          try {
            const fileName = (t.name || t.videoId).toString().replace(/[^a-z0-9\-_\. ]/gi, '_') + '.mp4';
            console.log(`Downloading ${fileName}...`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT);
            const downloadResponse = await fetch(t.link, {
              headers: {
                Authorization: `Bearer ${credentials.accessToken}`,
                'Connection': 'keep-alive'
              },
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!downloadResponse.ok || !downloadResponse.body) {
              throw new Error(`Failed to download video: ${downloadResponse.status}`);
            }

            const webStream: any = downloadResponse.body;
            let nodeStream: any = (webStream && typeof webStream.pipe === 'function') ? webStream : null;
            if (!nodeStream) {
              try {
                nodeStream = Readable.fromWeb(webStream as any);
              } catch (convErr) {
                if (!isClientDisconnected) {
                const buf = Buffer.from(await downloadResponse.arrayBuffer());
                archive.append(buf, { name: fileName });
                successCount++;
                console.log(`✓ Added ${fileName}`);
                }
                continue;
              }
            }

            if (!isClientDisconnected) {
            archive.append(nodeStream, { name: fileName });
            successCount++;
            console.log(`✓ Queued ${fileName}`);
            }

          } catch (err) {
            errorCount++;
            const msg = err instanceof Error ? err.message : 'Unknown error';
            console.error(`✗ Failed: ${t?.videoId || 'unknown'} - ${msg}`);
            if (!isClientDisconnected) {
            archive.append(`Error downloading video ${t?.videoId}: ${msg}\n`, { name: `ERROR_${t?.videoId || 'unknown'}.txt` });
            }
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(downloadConcurrency, tasks.length) }, downloadWorker));

      if (!isClientDisconnected) {
        console.log(`Download complete. Success: ${successCount}, Errors: ${errorCount}`);
        console.log('Finalizing archive...');

        const summary = [
          'Vimeo Bulk Download Summary',
          '='.repeat(30),
          `Total videos requested: ${videoIds.length}`,
          `Successfully queued/downloaded: ${successCount}`,
          `Errors encountered: ${errorCount}`,
          `Download date: ${new Date().toLocaleString()}`,
          '',
          successCount === videoIds.length
            ? '✓ All videos downloaded successfully!'
            : `⚠ ${errorCount} video(s) failed to download. Check ERROR files for details.`
        ].join('\n');

        archive.append(summary, { name: 'download_summary.txt' });
        
        // Add a small delay to ensure all streams are flushed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await archive.finalize();
        console.log('Archive finalized and sent to client');
        
        // Add another small delay to ensure transmission
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log('Download transmission completed');
      }

    } catch (error) {
      console.error('Error in bulk download:', error);
      // Only send error response if headers haven't been sent yet
      if (!res.headersSent) {
        res.status(500).json({ 
          message: 'Failed to download videos',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    } finally {
      // Clean up resources if needed
      if (archive && !archive.finalized && !isClientDisconnected) {
        try {
          archive.abort();
        } catch (e) {
          // Ignore abort errors in cleanup
        }
      }
    }
  });

  // Simple bulk download - downloads everything to memory first, then sends complete archive
  app.post("/api/videos/bulk-download-simple", async (req: Request, res: ExpressResponse) => {
    req.setTimeout(0);
    res.setTimeout(0);
    
    try {
      // Handle both JSON and form data
      let videoIds: string[];
      
      if (req.body.videoIds && typeof req.body.videoIds === 'string') {
        // Form data - parse JSON string
        videoIds = JSON.parse(req.body.videoIds);
      } else if (Array.isArray(req.body.videoIds)) {
        // Direct JSON array
        videoIds = req.body.videoIds;
      } else {
        res.status(400).json({ message: 'No video IDs provided' });
        return;
      }
      
      if (!Array.isArray(videoIds) || videoIds.length === 0) {
        res.status(400).json({ message: 'Invalid video IDs format' });
        return;
      }

      console.log(`🚀 Starting simple bulk download for ${videoIds.length} videos...`);
      const credentials = await getVimeoCredentials();
      
      // Create archive with direct streaming (better for large files)
      const archive = archiver('zip', { zlib: { level: 1 } });
      
      // Set response headers immediately
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename=vimeo-videos.zip');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      
      // Stream directly to response
      archive.pipe(res);
      
      // Handle archive errors
      archive.on('error', (err: Error) => {
        console.error('❌ Archive streaming error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Archive creation failed', error: err.message });
        }
      });
      
      let successCount = 0;
      let errorCount = 0;
      
      // Download each video and add to archive
      for (const videoId of videoIds) {
        try {
          console.log(`📥 Processing video ${videoId}...`);
          
          // Get video info
          const uploader = new VimeoUploader(credentials.accessToken);
          const videoInfo = await uploader.getVideoDetails(videoId);
          
          if (!videoInfo.files || videoInfo.files.length === 0) {
            throw new Error('No download files available');
          }
          
          // Get best quality download
          const bestDownload = videoInfo.files.reduce((best: any, current: any) => 
            (current.size || 0) > (best.size || 0) ? current : best
          );
          
          if (!bestDownload?.link) {
            throw new Error('No download link available');
          }
          
          const fileName = (videoInfo.name || `video-${videoId}`)
            .replace(/[^\w\s\-\.]/g, '_') + '.mp4';
          
          console.log(`⬇️ Downloading ${fileName}...`);
          
          // Download video
          const response = await fetch(bestDownload.link, {
            headers: { 'User-Agent': 'VimeoManager/1.0' }
          });
          
          if (!response.ok) {
            throw new Error(`Download failed: ${response.status}`);
          }
          
          const videoBuffer = Buffer.from(await response.arrayBuffer());
          archive.append(videoBuffer, { name: fileName });
          
          successCount++;
          console.log(`✅ Added ${fileName} (${(videoBuffer.length / 1024 / 1024).toFixed(1)} MB)`);
          
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`❌ Failed ${videoId}: ${msg}`);
          
          // Add error file to archive
          archive.append(`Error downloading video ${videoId}: ${msg}\n`, {
            name: `ERROR_${videoId}.txt`
          });
        }
      }
      
      // Add summary
      const summary = [
        'Vimeo Bulk Download Summary',
        '='.repeat(30),
        `Total videos: ${videoIds.length}`,
        `Downloaded: ${successCount}`,
        `Errors: ${errorCount}`,
        `Date: ${new Date().toLocaleString()}`,
        '',
        successCount > 0 ? '✅ Download completed!' : '❌ No videos downloaded'
      ].join('\n');
      
      archive.append(summary, { name: 'download_summary.txt' });
      
      console.log('📦 Finalizing archive for streaming...');
      
      // Finalize archive - this will trigger the stream to complete
      await archive.finalize();
      
      console.log('🎉 Archive finalized and streaming to client!');
      
    } catch (error) {
      console.error('💥 Bulk download error:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          message: 'Failed to download videos',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
  });

  return httpServer;
}