import { type User, type InsertUser, type VimeoFolder, type InsertVimeoFolder, type VimeoVideo, type InsertVimeoVideo, type VideoCaption, type InsertVideoCaption, type VimeoCredentials, type InsertVimeoCredentials } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Vimeo folder methods
  getFolders(): Promise<VimeoFolder[]>;
  createFolder(folder: InsertVimeoFolder): Promise<VimeoFolder>;
  updateFolders(folders: VimeoFolder[]): Promise<void>;
  
  // Vimeo video methods
  getVideosByFolderId(folderId: string): Promise<VimeoVideo[]>;
  getVideoById(videoId: string): Promise<VimeoVideo | undefined>;
  createVideo(video: InsertVimeoVideo): Promise<VimeoVideo>;
  updateVideo(videoId: string, video: Partial<VimeoVideo>): Promise<VimeoVideo | undefined>;
  deleteVideo(videoId: string): Promise<boolean>;
  
  // Caption methods
  getCaptionsByVideoId(videoId: string): Promise<VideoCaption[]>;
  createCaption(caption: InsertVideoCaption): Promise<VideoCaption>;
  updateCaption(captionId: string, caption: Partial<VideoCaption>): Promise<VideoCaption | undefined>;
  
  // Vimeo credentials methods
  getActiveCredentials(): Promise<VimeoCredentials | undefined>;
  createCredentials(credentials: InsertVimeoCredentials): Promise<VimeoCredentials>;
  deleteAllCredentials(): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private folders: Map<string, VimeoFolder>;
  private videos: Map<string, VimeoVideo>;
  private captions: Map<string, VideoCaption>;
  private credentials: Map<string, VimeoCredentials>;

  constructor() {
    this.users = new Map();
    this.folders = new Map();
    this.videos = new Map();
    this.captions = new Map();
    this.credentials = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Vimeo folder methods
  async getFolders(): Promise<VimeoFolder[]> {
    return Array.from(this.folders.values());
  }

  async createFolder(insertFolder: InsertVimeoFolder): Promise<VimeoFolder> {
    const folder: VimeoFolder = { 
      ...insertFolder, 
      createdAt: new Date() 
    };
    this.folders.set(folder.id, folder);
    return folder;
  }

  async updateFolders(folders: VimeoFolder[]): Promise<void> {
    this.folders.clear();
    folders.forEach(folder => {
      this.folders.set(folder.id, folder);
    });
  }

  // Vimeo video methods
  async getVideosByFolderId(folderId: string): Promise<VimeoVideo[]> {
    const videos = Array.from(this.videos.values()).filter((video) => {
      // Handle different folder ID formats
      const matches = 
        video.folderId === folderId ||
        video.folderId === folderId.toString() ||
        video.folderId === folderId.replace('/folders/', '') ||
        `/folders/${video.folderId}` === folderId;
      
      return matches;
    });
    
    console.log(`Storage lookup: folderId=${folderId}, found ${videos.length} videos`);
    return videos;
  }

  async getVideoById(videoId: string): Promise<VimeoVideo | undefined> {
    return this.videos.get(videoId);
  }

  async createVideo(insertVideo: InsertVimeoVideo): Promise<VimeoVideo> {
    // Ensure all required fields have proper defaults and correct types
    const video: VimeoVideo = { 
      id: insertVideo.id,
      name: insertVideo.name,
      uri: insertVideo.uri,
      description: insertVideo.description ?? null,
      tags: Array.isArray(insertVideo.tags) 
        ? (insertVideo.tags as string[]).filter((tag): tag is string => typeof tag === 'string')
        : null,
      folderId: insertVideo.folderId ?? null,
      duration: insertVideo.duration ?? null,
      downloadUrl: insertVideo.downloadUrl ?? null,
      embedHtml: insertVideo.embedHtml ?? null,
      createdAt: new Date(),
      modifiedAt: insertVideo.modifiedAt ?? null,
      privacy: insertVideo.privacy ?? null,
      views: insertVideo.views ?? null,
      likes: insertVideo.likes ?? null,
      comments: insertVideo.comments ?? null,
      resolution: insertVideo.resolution ?? null,
      fileSize: insertVideo.fileSize ?? null,
      status: insertVideo.status ?? null,
      presetId: insertVideo.presetId ?? null
    };
    this.videos.set(video.id, video);
    return video;
  }

  async updateVideo(videoId: string, videoUpdate: Partial<VimeoVideo>): Promise<VimeoVideo | undefined> {
    const existingVideo = this.videos.get(videoId);
    if (!existingVideo) return undefined;
    
    const updatedVideo = { ...existingVideo, ...videoUpdate };
    this.videos.set(videoId, updatedVideo);
    return updatedVideo;
  }

  async deleteVideo(videoId: string): Promise<boolean> {
    return this.videos.delete(videoId);
  }

  // Caption methods
  async getCaptionsByVideoId(videoId: string): Promise<VideoCaption[]> {
    return Array.from(this.captions.values()).filter(
      (caption) => caption.videoId === videoId
    );
  }

  async createCaption(insertCaption: InsertVideoCaption): Promise<VideoCaption> {
    const id = randomUUID();
    const caption: VideoCaption = { 
      id,
      videoId: insertCaption.videoId,
      language: insertCaption.language,
      vttContent: insertCaption.vttContent ?? null,
      txtContent: insertCaption.txtContent ?? null,
      downloadUrl: insertCaption.downloadUrl ?? null,
      createdAt: new Date() 
    };
    this.captions.set(id, caption);
    return caption;
  }

  async updateCaption(captionId: string, captionUpdate: Partial<VideoCaption>): Promise<VideoCaption | undefined> {
    const existingCaption = this.captions.get(captionId);
    if (!existingCaption) return undefined;
    
    const updatedCaption = { ...existingCaption, ...captionUpdate };
    this.captions.set(captionId, updatedCaption);
    return updatedCaption;
  }

  // Vimeo credentials methods
  async getActiveCredentials(): Promise<VimeoCredentials | undefined> {
    return Array.from(this.credentials.values()).find(
      (cred) => cred.isActive === "true"
    );
  }

  async createCredentials(insertCredentials: InsertVimeoCredentials): Promise<VimeoCredentials> {
    // Clear existing credentials first
    this.credentials.clear();
    
    const id = randomUUID();
    const credentials: VimeoCredentials = { 
      ...insertCredentials, 
      id,
      isActive: "true",
      createdAt: new Date() 
    };
    this.credentials.set(id, credentials);
    return credentials;
  }

  async deleteAllCredentials(): Promise<void> {
    this.credentials.clear();
  }
}

export const storage = new MemStorage();
