// vimeo.ts
import fs from "fs/promises";
import { createReadStream, statSync } from "fs";

export interface VimeoVideo {
  id: string;
  uri: string;
  name: string;
  description: string | null;
  tags: string[];
  duration: string | null;
  downloadUrl: string | null;
  embedHtml: string | null;
  created_time: string;
  pictures?: {
    base_link: string;
    sizes: Array<{
      width: number;
      height: number;
      link: string;
      link_with_play_button: string;
    }>;
  };
  files?: Array<{
    quality: string;
    width: number;
    height: number;
    size: number;
  }>;
  download?: Array<{
    quality: string;
    size: number;
    link: string;
  }>;
}

interface UploadBody {
  upload: {
    approach: string;
    size: number;
  };
  name: string;
  description: string;
  privacy: {
    view: string;
    embed: string;
  };
  folder_uri?: string;
}

import { getEnhancedVideoDetails } from './vimeo-helper';

export class VimeoUploader {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getDownloadLink(videoId: string): Promise<string | null> {
    try {
      const response = await fetch(`https://api.vimeo.com/videos/${videoId}?fields=download`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      if (!data.download || !data.download.length) {
        return null;
      }

      // Get the highest quality download link
      const downloads = data.download.sort((a: any, b: any) => b.size - a.size);
      return downloads[0].link;
    } catch (error) {
      console.error("Error getting download link:", error);
      return null;
    }
  }

  async getVideoDetails(videoId: string): Promise<VimeoVideo & {
    modified_time: string;
    privacy: string;
    views: number;
    likes: number;
    comments: number;
    resolution: string;
    fileSize: number;
    status: string;
  }> {
    interface VimeoResponse {
      uri: string;
      name: string;
      description: string | null;
      tags: Array<{ uri: string; name: string; }>;
      duration: number;
      created_time: string;
      modified_time: string;
      privacy: { view: string };
      stats: { plays: number };
      metadata: {
        connections: {
          likes: { total: number };
          comments: { total: number };
        };
      };
      files: Array<{
        quality: string;
        width: number;
        height: number;
        size: number;
      }>;
      status: string;
      embed?: {
        html: string;
      };
      pictures?: {
        base_link: string;
        sizes: Array<{
          width: number;
          height: number;
          link: string;
          link_with_play_button: string;
        }>;
      };
      download?: Array<{
        quality: string;
        size: number;
        link: string;
      }>;
    }

    console.log(`Fetching details for video ${videoId}...`);
    
    // Request all needed fields for metadata export
    const response = await fetch(
      `https://api.vimeo.com/videos/${videoId}?fields=uri,name,description,tags,duration,created_time,modified_time,privacy,stats,metadata.connections.likes.total,metadata.connections.comments.total,files,status,embed,pictures.sizes,width,height,size,download.quality,download.size,download.link`, 
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/vnd.vimeo.*+json;version=3.4",
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to fetch video details for ${videoId}: ${response.status} - ${errorText}`);
      throw new Error(`Failed to fetch video details: ${response.status}`);
    }

    const data = await response.json() as VimeoResponse;
    
    console.log(`Raw API response for video ${videoId}:`, {
      description: data.description ? 'present' : 'missing',
      descriptionLength: data.description ? data.description.length : 0,
      tags: data.tags ? `${data.tags.length} tags` : 'missing',
      tagNames: data.tags?.map(t => t.name) || [],
      duration: data.duration || 'missing',
      fileSize: data.files?.[0]?.size || 'missing',
      files: data.files?.length || 0
    });
    
    // Get the highest quality file details
    const files = data.files || [];
    const highestQualityFile = files.reduce((prev: any, current: any) => {
      const prevHeight = prev?.height || 0;
      const currentHeight = current?.height || 0;
      return currentHeight > prevHeight ? current : prev;
    }, null);

    // Process description - ensure we handle null/empty properly
    const processedDescription = data.description && data.description.trim() 
      ? data.description.trim() 
      : null;

    // Process tags - ensure we extract names properly (check both 'name' and 'tag' fields)
    const processedTags = data.tags && Array.isArray(data.tags) 
      ? data.tags.map((tag: any) => tag.name || tag.tag).filter(Boolean) 
      : [];

    console.log(`Processed data for video ${videoId}:`, {
      description: processedDescription ? 'present' : 'missing',
      tags: processedTags.length > 0 ? `${processedTags.length} tags` : 'no tags',
      tagList: processedTags
    });

    // Organize metadata with better formatting and data handling
    return {
      id: videoId,
      uri: data.uri,
      name: data.name || '[Untitled]',
      description: processedDescription || '[No description]',
      tags: processedTags,
      duration: data.duration?.toString() || null,
      downloadUrl: null, // We'll handle download URLs in the export endpoints
      embedHtml: data.embed?.html || null,
      created_time: data.created_time ? new Date(data.created_time).toLocaleString() : '[No date]',
      modified_time: data.modified_time ? new Date(data.modified_time).toLocaleString() : '[No date]',
      privacy: data.privacy?.view || 'unknown',
      views: typeof data.stats?.plays === 'number' ? data.stats.plays : 0,
      likes: data.metadata?.connections?.likes?.total || 0,
      comments: data.metadata?.connections?.comments?.total || 0,
      resolution: highestQualityFile ? `${highestQualityFile.width}x${highestQualityFile.height}` : '[Unknown]',
      fileSize: highestQualityFile ? highestQualityFile.size : 0,
      status: data.status || 'unknown',
      // Add picture sizes info for thumbnail handling
      pictures: data.pictures,
      // Add file info for download handling
      files: data.files || [],
      // Add download info
      download: Array.isArray(data.download) ? data.download : []
    };
  }

  async uploadVideo(
    filePath: string,
    videoName: string,
    description: string | undefined,
    folderId?: string,
    tags?: string
  ) {
    try {
      // Step 1: Create upload session (include folder_uri if provided)
      const uploadSession = await this.createUploadSession(
        filePath,
        videoName,
        description,
        folderId
      );

      // Step 2: Upload file
      await this.uploadFile(filePath, uploadSession.upload.upload_link);

      // Step 3: No need for retry logic if folder is specified during upload, but verify assignment
      if (folderId) {
        try {
          // Wait a moment for the video to be processed
          await new Promise((resolve) => setTimeout(resolve, 3000));

          // Verify the folder assignment
          const videoId = uploadSession.uri.split("/").pop();
          const verifyResponse = await fetch(
            `https://api.vimeo.com/videos/${videoId}?fields=parent_folder.uri`,
            {
              headers: {
                Authorization: `Bearer ${this.accessToken}`,
                Accept: "application/vnd.vimeo.video;version=3.4",
              },
            }
          );

          if (!verifyResponse.ok) {
            throw new Error(`Verification failed: ${verifyResponse.status}`);
          }

          const verifyData = await verifyResponse.json();
          const actualFolderUri = verifyData.parent_folder?.uri || null;
          const expectedFolderUri = `/folders/${folderId.replace(
            "/folders/",
            ""
          )}`;

          if (actualFolderUri !== expectedFolderUri) {
            console.warn(
              `Folder assignment failed. Falling back to retry method.`
            );
            await this.addVideoToProjectOrFolderWithRetry(
              uploadSession.uri,
              folderId
            );
          } else {
            console.log(
              "✅ Video successfully assigned to folder during upload"
            );
          }
        } catch (verifyError) {
          console.warn(
            "Verification failed, attempting fallback:",
            verifyError
          );
          await this.addVideoToProjectOrFolderWithRetry(
            uploadSession.uri,
            folderId
          );
        }
      }

      // Step 4: Add tags if specified
      if (tags) {
        try {
          await this.addTagsToVideo(uploadSession.uri, tags);
        } catch (tagError) {
          console.warn("Failed to add tags:", tagError);
        }
      }

      return {
        success: true,
        videoUri: uploadSession.uri,
        link: uploadSession.link,
      };
    } catch (error) {
      console.error("Vimeo upload failed:", error);
      throw error;
    }
  }

  async fetchAllVideosWithTags(folderId?: string): Promise<VimeoVideo[]> {
    try {
      const videos: VimeoVideo[] = [];
      let page = 1;
      const perPage = 50; // Adjust based on Vimeo API limits
      let hasMore = true;

      console.log(`Fetching videos for folder: ${folderId || 'all'}`);

      while (hasMore) {
        // Construct the API endpoint with explicit field requests for tags and description
        const endpoint = folderId
          ? `https://api.vimeo.com/me/folders/${folderId.replace(
              "/folders/",
              ""
            )}/videos?fields=uri,name,description,tags,duration,download,embed,created_time&page=${page}&per_page=${perPage}`
          : `https://api.vimeo.com/me/videos?fields=uri,name,description,tags,duration,download,embed,created_time&page=${page}&per_page=${perPage}`;

        console.log(`Fetching page ${page} from: ${endpoint}`);

        const response = await fetch(endpoint, {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: "application/vnd.vimeo.*+json;version=3.4",
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            message: "No JSON response",
          }));
          throw new Error(
            `Failed to fetch videos: ${response.status} - ${JSON.stringify(
              errorData
            )}`
          );
        }

        const data = await response.json();
        const fetchedVideos = data.data || [];
        
        console.log(`Fetched ${fetchedVideos.length} videos from page ${page}`);

        // Log a sample video to check data structure
        if (fetchedVideos.length > 0) {
          console.log('Sample video data:', {
            name: fetchedVideos[0].name,
            description: fetchedVideos[0].description ? 'present' : 'missing',
            tags: fetchedVideos[0].tags ? `${fetchedVideos[0].tags.length} tags` : 'missing',
            tagNames: fetchedVideos[0].tags?.map((t: any) => t.name) || []
          });
        }

        // Map the videos to VimeoVideo with proper processing
        const processedVideos = fetchedVideos.map((video: any) => {
          const processedDescription = video.description && video.description.trim() 
            ? video.description.trim() 
            : null;
          
          const processedTags = video.tags && Array.isArray(video.tags) 
            ? video.tags.map((t: any) => t.name || t.tag).filter(Boolean)
            : [];
          
          return {
            id: video.uri.split("/").pop() || "",
            uri: video.uri,
            name: video.name,
            description: processedDescription,
            tags: processedTags,
            duration: video.duration?.toString() || null,
            downloadUrl: video.download?.find((d: any) => d.quality === "source")?.link || null,
            embedHtml: video.embed?.html || null,
            created_time: video.created_time || new Date().toISOString(),
          };
        });

        videos.push(...processedVideos);

        // Check for pagination
        hasMore = !!data.paging?.next;
        page++;

        // Add delay to avoid rate limiting
        if (hasMore) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      console.log(`Total fetched: ${videos.length} videos`);
      
      // Log summary of tags and descriptions
      const videosWithDescription = videos.filter(v => v.description).length;
      const videosWithTags = videos.filter(v => v.tags && v.tags.length > 0).length;
      console.log(`Videos with descriptions: ${videosWithDescription}/${videos.length}`);
      console.log(`Videos with tags: ${videosWithTags}/${videos.length}`);
      
      return videos;
    } catch (error) {
      console.error("Error fetching videos with tags:", error);
      throw error;
    }
  }

  async addVideoToProjectOrFolderWithRetry(
    videoUri: string,
    folderId: string,
    maxRetries = 5
  ) {
    const videoId = videoUri.split("/").pop();
    const numericFolderId = folderId.replace("/folders/", "");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 15000);
          console.log(
            `Attempt ${attempt}: Waiting ${delay}ms for video processing...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const response = await this.assignVideoToFolder(
          videoId!,
          numericFolderId
        );
        console.log(
          `Successfully added video ${videoId} to folder ${numericFolderId}`
        );
        return response;
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        if (attempt === maxRetries) {
          throw new Error(
            `Failed to add video to folder after ${maxRetries} attempts: ${
              (error as any).message || error
            }`
          );
        }
      }
    }
  }

  private async assignVideoToFolder(videoId: string, folderId: string) {
    console.log(`Assigning video ${videoId} to folder ${folderId}`);

    try {
      const response = await fetch(`https://api.vimeo.com/videos/${videoId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.vimeo.video;version=3.4",
        },
        body: JSON.stringify({ folder_uri: `/folders/${folderId}` }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: "No JSON response" }));
        console.warn(`PATCH approach failed: ${JSON.stringify(errorData)}`);

        console.log("Trying legacy folder assignment approach...");
        return await this.addToFolderLegacy(videoId, folderId);
      }
    } catch (error) {
      console.warn("PATCH approach failed with exception:", error);
      return await this.addToFolderLegacy(videoId, folderId);
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const verifyResponse = await fetch(
      `https://api.vimeo.com/videos/${videoId}?fields=parent_folder.uri`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/vnd.vimeo.video;version=3.4",
        },
      }
    );

    if (!verifyResponse.ok) {
      const errorData = await verifyResponse.json().catch(() => ({}));
      console.warn(
        `Failed to verify folder assignment: ${verifyResponse.status}`,
        errorData
      );
      return {};
    }

    const verifyData = await verifyResponse.json();
    const actualFolderUri = verifyData.parent_folder?.uri || null;
    const expectedFolderUri = `/folders/${folderId}`;

    console.log(`Folder assignment verification:`, {
      videoId,
      expectedFolder: expectedFolderUri,
      actualFolder: actualFolderUri,
    });

    if (actualFolderUri !== expectedFolderUri) {
      console.warn(
        `Video ${videoId} was not assigned to the expected folder. Expected: ${expectedFolderUri}, Actual: ${
          actualFolderUri || "undefined"
        }`
      );
      try {
        console.log("Trying legacy folder assignment approach...");
        await this.addToFolderLegacy(videoId, folderId);
        console.log("Legacy folder assignment succeeded");
      } catch (legacyError) {
        console.warn("Legacy folder assignment also failed:", legacyError);
      }
    }

    return verifyData;
  }

  private async addToFolderLegacy(videoId: string, folderId: string) {
    console.log(
      `Using legacy API to add video ${videoId} to folder ${folderId}`
    );
    const response = await fetch(
      `https://api.vimeo.com/me/folders/${folderId}/videos/${videoId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/json;version=3.4",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "No JSON response" }));
      throw new Error(
        `Legacy Folders API failed: ${response.status} - ${JSON.stringify(
          errorData
        )}`
      );
    }

    return response.json().catch(() => ({}));
  }

  private async addToProject(videoId: string, projectId: string) {
    const response = await fetch(
      `https://api.vimeo.com/me/projects/${projectId}/videos/${videoId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          Accept: "application/vnd.vimeo.*+json;version=3.4",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "No JSON response" }));
      throw new Error(
        `Projects API failed: ${response.status} - ${JSON.stringify(errorData)}`
      );
    }

    return response.json().catch(() => ({}));
  }

  private async createUploadSession(
    filePath: string,
    videoName: string,
    description: string | undefined,
    folderId?: string
  ) {
    const fileStats = await fs.stat(filePath);
    const body: UploadBody = {
      upload: {
        approach: "tus",
        size: fileStats.size,
      },
      name: videoName,
      description: description || "",
      privacy: {
        view: "anybody",
        embed: "public",
      }
    };

    if (folderId) {
      const numericFolderId = folderId.replace("/folders/", "");
      body.folder_uri = `/folders/${numericFolderId}`;
      console.log(`Uploading directly to folder_uri: ${body.folder_uri}`);
    }

    const response = await fetch("https://api.vimeo.com/me/videos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.vimeo.*+json;version=3.4",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Failed to create upload session: ${JSON.stringify(error)}`
      );
    }

    return response.json();
  }

  private async uploadFile(filePath: string, uploadUrl: string) {
    const fileBuffer = await fs.readFile(filePath);

    const response = await fetch(uploadUrl, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream",
      },
      body: new Uint8Array(fileBuffer),
    });

    if (!response.ok) {
      throw new Error(`File upload failed: ${response.status}`);
    }
  }

  private async addTagsToVideo(videoUri: string, tags: string) {
    console.log(`Attempting to add tags to video ${videoUri}: ${tags}`);

    const tagArray = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    console.log(`Processed tag array:`, tagArray);

    try {
      const videoId = videoUri.split("/").pop();

      if (!videoId) {
        console.error("Could not extract video ID from URI:", videoUri);
        return false;
      }

      console.log(`Adding tags to video ${videoId} using PATCH method`);
      const patchResponse = await fetch(
        `https://api.vimeo.com/videos/${videoId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.vimeo.*+json;version=3.4",
          },
          body: JSON.stringify({ tags: tagArray }),
        }
      );

      console.log(`PATCH tags response status: ${patchResponse.status}`);

      if (!patchResponse.ok) {
        console.log(`PATCH failed, trying PUT to tags endpoint`);
        const putResponse = await fetch(
          `https://api.vimeo.com/videos/${videoId}/tags`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              "Content-Type": "application/json",
              Accept: "application/vnd.vimeo.*+json;version=3.4",
            },
            body: JSON.stringify({ tags: tagArray }),
          }
        );

        console.log(`PUT tags response status: ${putResponse.status}`);

        if (!putResponse.ok) {
          const errorData = await putResponse
            .json()
            .catch(() => ({ message: "No JSON response" }));
          console.warn(
            `Failed to add tags using PUT: ${JSON.stringify(errorData)}`
          );

          return await this.addTagsOneByOne(videoId, tagArray);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 5000));

      const tagsAdded = await this.verifyTags(videoId, tagArray);

      if (!tagsAdded) {
        console.log(
          "Tags verification failed, trying one-by-one method as fallback"
        );
        return await this.addTagsOneByOne(videoId, tagArray);
      }

      return true;
    } catch (error) {
      console.error("Error adding tags:", error);
      return false;
    }
  }

  private async addTagsOneByOne(
    videoId: string,
    tags: string[]
  ): Promise<boolean> {
    console.log(`Trying to add tags one by one for video ${videoId}`);
    let addedCount = 0;

    for (const tag of tags) {
      try {
        const response = await fetch(
          `https://api.vimeo.com/videos/${videoId}/tags/${encodeURIComponent(
            tag
          )}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${this.accessToken}`,
              Accept: "application/vnd.vimeo.*+json;version=3.4",
            },
          }
        );

        console.log(`Adding tag "${tag}" response status: ${response.status}`);

        if (response.ok) {
          addedCount++;
        } else {
          console.warn(`Failed to add tag "${tag}": ${response.status}`);

          try {
            const altResponse = await fetch(
              `https://api.vimeo.com/videos/${videoId}`,
              {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${this.accessToken}`,
                  "Content-Type": "application/json",
                  Accept: "application/vnd.vimeo.*+json;version=3.4",
                },
                body: JSON.stringify({ tags: [tag] }),
              }
            );

            if (altResponse.ok) {
              console.log(`Successfully added tag "${tag}" using PATCH method`);
              addedCount++;
            }
          } catch (altError) {
            console.error(
              `Alternative method failed for tag "${tag}":`,
              altError
            );
          }
        }
      } catch (tagError) {
        console.error(`Error adding tag "${tag}":`, tagError);
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    console.log(`Added ${addedCount}/${tags.length} tags one by one`);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    return await this.verifyTags(videoId, tags);
  }

  private async verifyTags(
    videoId: string,
    expectedTags: string[]
  ): Promise<boolean> {
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const response = await fetch(
        `https://api.vimeo.com/videos/${videoId}?fields=tags`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: "application/vnd.vimeo.*+json;version=3.4",
          },
        }
      );

      if (!response.ok) {
        console.warn(`Failed to verify tags: ${response.status}`);
        return false;
      }

      const videoData = await response.json();
      const actualTags = videoData.tags?.map((t: any) => t.name) || [];

      console.log(`Tag verification:`, {
        videoId,
        expectedTags,
        actualTags,
      });

      const missingTags = expectedTags.filter(
        (tag) => !actualTags.includes(tag)
      );
      if (missingTags.length > 0) {
        console.warn(`Some tags were not added: ${missingTags.join(", ")}`);
        return false;
      } else {
        console.log(`✅ All tags were successfully added to video ${videoId}`);
        return true;
      }
    } catch (error) {
      console.error("Error verifying tags:", error);
      return false;
    }
  }

  async getAllPresets(): Promise<any[]> {
    try {
      const response = await fetch("https://api.vimeo.com/me/presets", {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.vimeo.*+json;version=3.4",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch presets: ${response.status}`);
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error("Error fetching presets:", error);
      throw error;
    }
  }

  async applyPresetToVideo(videoId: string, presetId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.vimeo.com/videos/${videoId}/presets/${presetId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.vimeo.*+json;version=3.4",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Failed to apply preset ${presetId} to video ${videoId}: ${response.status} - ${errorText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error applying preset ${presetId} to video ${videoId}:`, error);
      return false;
    }
  }

  async getPresetDetails(presetId: string): Promise<any> {
    try {
      const response = await fetch(
        `https://api.vimeo.com/me/presets/${presetId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.vimeo.*+json;version=3.4",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch preset details: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error fetching preset details:", error);
      throw error;
    }
  }

  async createPreset(name: string, settings: any): Promise<any> {
    try {
      const response = await fetch(
        `https://api.vimeo.com/me/presets`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.vimeo.*+json;version=3.4",
          },
          body: JSON.stringify({
            name,
            ...settings
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create preset: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Error creating preset:", error);
      throw error;
    }
  }

  async deletePreset(presetId: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.vimeo.com/me/presets/${presetId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: "application/vnd.vimeo.*+json;version=3.4",
          },
        }
      );

      if (!response.ok && response.status !== 204) {
        const errorText = await response.text();
        console.warn(`Failed to delete preset ${presetId}: ${response.status} - ${errorText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error deleting preset ${presetId}:`, error);
      return false;
    }
  }

  async updateVideoEmbed(videoId: string, embedSettings: any): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.vimeo.com/videos/${videoId}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.vimeo.*+json;version=3.4",
          },
          body: JSON.stringify({
            embed: embedSettings
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Failed to update video embed settings: ${response.status} - ${errorText}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`Error updating video embed settings:`, error);
      return false;
    }
  }
}