// Centralized constants for the Vimeo Manager application
// This eliminates magic numbers scattered throughout the codebase

// API Configuration
export const API_TIMEOUT = 30_000; // 30 seconds for API calls
export const DOWNLOAD_TIMEOUT = 60_000; // 60 seconds for downloads
export const UPLOAD_TIMEOUT = 300_000; // 5 minutes for uploads

// Concurrency Limits
export const DOWNLOAD_CONCURRENCY = 3; // Maximum concurrent downloads
export const API_CONCURRENCY = 10; // Maximum concurrent API calls
export const BATCH_SIZE = 8; // Default batch size for bulk operations

// File Size Limits
export const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024; // 2GB
export const MAX_THUMBNAIL_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_CAPTION_SIZE = 5 * 1024 * 1024; // 5MB

// Pagination
export const DEFAULT_PAGE_SIZE = 100; // Vimeo API max per page

// Retry Configuration
export const MAX_RETRIES = 3;
export const RETRY_DELAY_BASE = 1000; // Base delay in ms (exponential backoff)

// Cache Configuration
export const FOLDER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
export const VIDEO_CACHE_TTL = 60 * 1000; // 1 minute

// Vimeo API Base URL
export const VIMEO_API_BASE = 'https://api.vimeo.com';

// Environment helpers
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';

// Default server port
export const DEFAULT_PORT = 5000;

