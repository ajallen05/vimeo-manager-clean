import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const vimeoFolders = pgTable("vimeo_folders", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  uri: text("uri").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vimeoVideos = pgTable("vimeo_videos", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  uri: text("uri").notNull(),
  description: text("description"),
  tags: json("tags").$type<string[]>(),
  folderId: varchar("folder_id"),
  duration: text("duration"),
  downloadUrl: text("download_url"),
  embedHtml: text("embed_html"),
  createdAt: timestamp("created_at").defaultNow(),
  modifiedAt: timestamp("modified_at"),
  privacy: text("privacy"),
  views: text("views"),
  likes: text("likes"),
  comments: text("comments"),
  resolution: text("resolution"),
  fileSize: text("file_size"),
  status: text("status"),
});

export const videoCaptions = pgTable("video_captions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  videoId: varchar("video_id").notNull(),
  language: text("language").notNull(),
  vttContent: text("vtt_content"),
  txtContent: text("txt_content"),
  downloadUrl: text("download_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vimeoCredentials = pgTable("vimeo_credentials", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  accessToken: text("access_token").notNull(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  isActive: varchar("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertVimeoFolderSchema = createInsertSchema(vimeoFolders).omit({
  createdAt: true,
});

export const insertVimeoVideoSchema = createInsertSchema(vimeoVideos).omit({
  createdAt: true,
});

export const insertVideoCaptionSchema = createInsertSchema(videoCaptions).omit({
  id: true,
  createdAt: true,
});

export const insertVimeoCredentialsSchema = createInsertSchema(
  vimeoCredentials
).omit({
  id: true,
  createdAt: true,
  isActive: true,
});

// Vimeo credentials setup schema
export const vimeoCredentialsSetupSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  clientId: z.string().min(1, "Client ID is required"),
  clientSecret: z.string().min(1, "Client secret is required"),
});

// Upload schemas
export const uploadVideoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  tags: z.string().optional(),
  folderId: z.string().optional(),
});

export const replaceVideoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertVimeoFolder = z.infer<typeof insertVimeoFolderSchema>;
export type VimeoFolder = typeof vimeoFolders.$inferSelect;

export type InsertVimeoVideo = z.infer<typeof insertVimeoVideoSchema>;
export type VimeoVideo = typeof vimeoVideos.$inferSelect;

export type InsertVideoCaption = z.infer<typeof insertVideoCaptionSchema>;
export type VideoCaption = typeof videoCaptions.$inferSelect & {
  tracks?: Array<{
    id: string;
    language: string;
    name: string;
    type: string;
    link: string;
    active: boolean;
    default: boolean;
  }>;
};

export type UploadVideo = z.infer<typeof uploadVideoSchema>;
export type ReplaceVideo = z.infer<typeof replaceVideoSchema>;

export type InsertVimeoCredentials = z.infer<
  typeof insertVimeoCredentialsSchema
>;
export type VimeoCredentials = typeof vimeoCredentials.$inferSelect;
export type VimeoCredentialsSetup = z.infer<typeof vimeoCredentialsSetupSchema>;
