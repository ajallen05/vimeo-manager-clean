import { apiRequest } from "./queryClient";
import type {
  VimeoFolder,
  VimeoVideo,
  VideoCaption,
  UploadVideo,
  ReplaceVideo,
  UpdateVideo,
} from "@shared/schema";

export async function checkCredentials(): Promise<{ configured: boolean }> {
  const response = await apiRequest("GET", "/api/credentials/check");
  return response.json();
}

export interface FolderHierarchy {
  id: string;
  name: string;
  uri: string;
  parent_id?: string;
  hasChildren: boolean;
  path?: string;
  children?: FolderHierarchy[];
}

export async function fetchFolders(): Promise<VimeoFolder[]> {
  const response = await apiRequest("GET", "/api/folders");
  return response.json();
}

export async function fetchFoldersHierarchical(): Promise<FolderHierarchy[]> {
  const response = await apiRequest("GET", "/api/folders?hierarchical=true");
  return response.json();
}

export async function fetchPresets(): Promise<any[]> {
  const response = await apiRequest("GET", "/api/presets");
  return response.json();
}

export async function fetchVideosByFolder(
  folderId: string
): Promise<VimeoVideo[]> {
  const response = await apiRequest("GET", `/api/folders/${folderId}/videos`);
  return response.json();
}

export async function fetchVideoCaptions(
  videoId: string
): Promise<VideoCaption | null> {
  const response = await apiRequest("GET", `/api/videos/${videoId}/captions`);
  return response.json();
}

export async function uploadVideo(
  data: UploadVideo,
  file: File
): Promise<{ message: string; videoId: string }> {
  const formData = new FormData();
  formData.append("title", data.title);
  if (data.description) formData.append("description", data.description);
  if (data.tags) formData.append("tags", data.tags);
  if (data.folderId) formData.append("folderId", data.folderId);
  formData.append("video", file);

  const response = await fetch("/api/videos/upload", {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Upload failed");
  }

  return response.json();
}

export async function replaceVideo(
  videoId: string,
  data: Omit<ReplaceVideo, "videoId">,
  file: File
): Promise<{ message: string }> {
  const formData = new FormData();
  if (data.title) formData.append("title", data.title);
  if (data.description) formData.append("description", data.description);
  if (data.tags) formData.append("tags", data.tags);
  formData.append("video", file);

  const response = await fetch(`/api/videos/${videoId}/replace`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Replace failed");
  }

  return response.json();
}

export async function updateVideo(
  data: UpdateVideo
): Promise<{ message: string }> {
  const { videoId, ...rest } = data;
  const response = await apiRequest("PATCH", `/api/videos/${videoId}`, rest);
  return response.json();
}

export async function bulkUpdateVideos(
  updates: UpdateVideo[]
): Promise<{ message: string; results: any[]; errors: any[] }> {
  const response = await apiRequest("POST", "/api/videos/bulk-metadata", { updates });
  return response.json();
}

export async function fetchPresetDetails(presetId: string): Promise<any> {
  const response = await apiRequest("GET", `/api/presets/${presetId}`);
  return response.json();
}

export async function applyModifiedPreset(
  videoId: string,
  basePresetId: string | null,
  modifications: any
): Promise<{ message: string; appliedSettings?: any }> {
  const response = await apiRequest("POST", `/api/videos/${videoId}/apply-modified-preset`, {
    basePresetId,
    modifications
  });
  return response.json();
}

export async function updateVideoEmbed(
  videoId: string,
  embedSettings: any
): Promise<{ message: string }> {
  const response = await apiRequest("PATCH", `/api/videos/${videoId}/embed`, embedSettings);
  return response.json();
}
