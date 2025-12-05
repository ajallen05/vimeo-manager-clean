// Centralized type definitions for the Vimeo Manager server
import type { Request } from "express";

// Vimeo API response types
export interface VimeoDownloadLink {
  quality: string;
  size: number;
  link: string;
  width?: number;
  height?: number;
}

export interface VimeoPictureSize {
  width: number;
  height: number;
  link: string;
  link_with_play_button?: string;
}

export interface VimeoTag {
  uri: string;
  name: string;
  tag?: string;
}

export interface VimeoTextTrack {
  uri: string;
  language: string;
  name: string;
  type: string;
  link: string;
  active: boolean;
  default: boolean;
}

export interface VimeoPrivacy {
  view: string;
  embed?: string;
  download?: boolean;
  comments?: string;
  password?: string;
}

export interface VimeoEmbedSettings {
  html?: string;
  uri?: string;
  color?: string;
  playbar?: boolean;
  volume?: boolean;
  speed?: boolean;
  autoplay?: boolean;
  loop?: boolean;
}

export interface VimeoVideoFile {
  quality: string;
  width: number;
  height: number;
  size: number;
  link?: string;
}

export interface VimeoApiVideo {
  uri: string;
  name: string;
  description: string | null;
  tags: VimeoTag[];
  duration: number;
  created_time: string;
  modified_time: string;
  privacy: VimeoPrivacy;
  stats?: { plays: number };
  metadata?: {
    connections: {
      likes: { total: number };
      comments: { total: number };
      parent_folder?: { uri: string };
    };
  };
  files?: VimeoVideoFile[];
  download?: VimeoDownloadLink[];
  status: string;
  embed?: VimeoEmbedSettings;
  pictures?: {
    base_link: string;
    sizes: VimeoPictureSize[];
  };
  parent_folder?: { uri: string };
}

export interface VimeoFolder {
  uri: string;
  name: string;
  metadata?: {
    connections?: {
      parent_folder?: { uri: string };
    };
  };
}

export interface VimeoPreset {
  uri: string;
  name: string;
  settings?: Record<string, unknown>;
}

// Request types
export interface FileRequest extends Request {
  file?: Express.Multer.File;
}

// Video download result type
export interface VideoDownloadResult {
  success: boolean;
  name?: string;
  buffer?: ArrayBuffer;
  error?: string;
}

// Download progress tracking
export interface DownloadProgress {
  successCount: number;
  errorCount: number;
  total: number;
}

// Video metadata row for export
export interface VideoMetadataRow {
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

// Folder hierarchy type
export interface FolderHierarchy {
  id: string;
  name: string;
  uri: string;
  parent_id?: string;
  hasChildren: boolean;
  path?: string;
  children?: FolderHierarchy[];
}

// Download info result type
export interface VideoDownloadInfo {
  downloadQualities: string;
  videoDownloadUrl: string;
  thumbnailDownloadUrl: string;
  captionDownloadUrl: string;
  captionLanguages: string[];
  captionText: string;
}

