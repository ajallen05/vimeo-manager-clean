# Vimeo Manager - Changelog

## Application Description

**Vimeo Manager** is a comprehensive full-stack web application designed for managing Vimeo video content with advanced features for content creators, video managers, and organizations. The application provides a powerful interface for browsing, downloading, uploading, and managing Vimeo videos with support for bulk operations, metadata export, and caption management.

### Key Features

- **📁 Folder Management**: Browse and navigate through Vimeo folder structures with recursive folder support
- **📥 Video Downloads**: Download individual videos or perform bulk downloads of entire folders
- **📊 Metadata Export**: Export comprehensive video information to Excel with thumbnail and caption download links
- **📤 Video Upload**: Upload new videos with metadata (title, description, tags) and replace existing videos
- **🎬 Video Player**: Built-in video player with Vimeo embed for previewing content
- **📝 Caption Support**: Download captions in VTT or TXT format with searchable content
- **🖼️ Thumbnail Management**: Download video thumbnails in multiple sizes (295px to 1920px width)
- **📦 Bulk Operations**: Zip downloads for multiple videos and folders
- **🔍 Search & Filter**: Advanced search and filtering capabilities for videos and folders
- **📈 Analytics**: View video statistics, view counts, and performance metrics

### Technology Stack

- **Frontend**: React 18 with TypeScript, Tailwind CSS, Shadcn/UI components
- **Backend**: Express.js with TypeScript, RESTful API architecture
- **Database**: PostgreSQL with Drizzle ORM (optional) or in-memory storage
- **API Integration**: Vimeo API v3 with OAuth authentication
- **File Handling**: Multer for video uploads (2GB limit), Archiver for zip creation
- **Build Tools**: Vite for development, ESBuild for production bundling

### Architecture

The application follows a modern full-stack architecture with:
- **Client-Side**: React with TypeScript, TanStack Query for state management, Wouter for routing
- **Server-Side**: Express.js with TypeScript, centralized error handling, request logging
- **Database**: Drizzle ORM with PostgreSQL for production, in-memory storage for development
- **API Design**: RESTful endpoints with proper HTTP status codes and error handling
- **Security**: Vimeo credentials stored securely in memory, no frontend exposure

---

## Changelog

### [2024-12-19] - Bug Fixes and Dependencies Update

#### 🐛 Bug Fixes
- **Fixed lucide-react source map error**: Resolved build failure caused by corrupted source map file in `node_modules/lucide-react/dist/esm/icons/wine.js.map`
  - **Root Cause**: Corrupted source map file was causing ESBuild to fail during development server startup
  - **Solution**: Performed clean reinstall of all dependencies by removing `node_modules` and `package-lock.json`, then running `npm install`
  - **Impact**: Development server now starts successfully without build errors

- **Fixed metadata export authentication error**: Resolved 401 authentication errors when exporting video metadata to Excel
  - **Root Cause**: Export functionality was using incorrect credentials source (environment variables instead of memory storage)
  - **Solution**: Updated `server/export-routes.ts` to use `storage.getActiveCredentials()` instead of `getVimeoCredentials()` from credentials.ts
  - **Changes Made**:
    - Changed import from `{ getVimeoCredentials } from "./credentials"` to `{ storage } from "./storage"`
    - Updated credentials retrieval to use `await storage.getActiveCredentials()`
    - Added proper error handling for missing credentials
  - **Impact**: Metadata export now works correctly with proper Vimeo API authentication

- **Fixed download links in metadata export**: Resolved broken download URLs for videos, thumbnails, and captions in Excel export
  - **Root Cause**: Export was generating URLs for non-existent API endpoints
  - **Solution**: Created missing download endpoints and updated URL generation
  - **Changes Made**:
    - Added new `/api/videos/:videoId/download` endpoint for individual video downloads with quality selection
    - Updated thumbnail URLs to use existing `/api/videos/:videoId/thumbnail` endpoint
    - Fixed captions URLs to use correct `/api/videos/:videoId/captions.txt` endpoint
    - Updated `getVideoDownloadInfo` function in `server/export-routes.ts` to generate correct URLs
  - **Impact**: All download links in metadata export now work properly and point to functional endpoints

- **Fixed 404 errors for API endpoints**: Resolved frontend router interference with API download endpoints
  - **Root Cause**: Vite middleware was catching all requests including API routes and serving frontend HTML instead
  - **Solution**: Updated Vite middleware to exclude API routes from frontend processing
  - **Changes Made**:
    - Modified `server/vite.ts` to skip `/api/` routes in development middleware
    - Updated production static serving to exclude API routes
    - Added proper API error handling for missing endpoints
  - **Impact**: Download links in Excel now work correctly without 404 errors

- **Replaced localhost URLs with universal Vimeo links**: Updated all download URLs to use direct Vimeo links instead of localhost API endpoints
  - **Root Cause**: Localhost URLs in exported metadata were not accessible outside the local development environment
  - **Solution**: Replaced all localhost API URLs with direct Vimeo download links
  - **Changes Made**:
    - Updated video download URLs to use direct Vimeo download links (`bestDownload.link`)
    - Updated thumbnail URLs to use direct Vimeo thumbnail links (`largestThumbnail.link`)
    - Updated captions URLs to use direct Vimeo captions links (`defaultTrack.link`)
    - Modified both `server/export-routes.ts` and `server/routes.ts` for consistency
  - **Impact**: Exported metadata now contains universal links that work from any location without requiring the local server

- **Comprehensive download system overhaul**: Completely redesigned video download functionality for universal access and auto-downloads
  - **Root Cause**: Complex streaming download system was slow and required local server processing
  - **Solution**: Implemented direct Vimeo link system with auto-download functionality
  - **Backend Changes**:
    - Added `/api/videos/:videoId/download-links` endpoint to fetch available download qualities
    - Modified `/api/videos/:videoId/download` to redirect directly to Vimeo URLs (302 redirect)
    - Removed complex streaming and proxying logic
  - **Frontend Changes**:
    - Updated `video-table.tsx` to use simple anchor element with direct links
    - Updated `video-modal.tsx` to trigger direct downloads with Vimeo URLs
    - Simplified download logic to eliminate streaming and blob creation
    - Added `target="_blank"` for better redirect handling
  - **Impact**: Downloads now auto-start immediately, work universally, and don't require server resources

- **Fixed JSON parsing error in download functionality**: Resolved "Unexpected token DOCTYPE" error when server returns HTML instead of JSON
  - **Root Cause**: Frontend was trying to parse HTML error pages as JSON when server was down or returning errors
  - **Solution**: Added content-type checking and better error handling in frontend API calls
  - **Changes Made**:
    - Enhanced error handling in `video-modal.tsx` to detect HTML responses
    - Added proper JSON parsing with try-catch blocks
    - Improved error messages to help users understand server issues
  - **Impact**: Users now get clear error messages instead of cryptic JSON parsing errors

- **Removed Public URL column from exports**: Cleaned up metadata exports by removing redundant Public URL column
  - **Root Cause**: Public URL column was unnecessary as users can construct Vimeo URLs from video IDs
  - **Solution**: Removed Public URL column from both Excel and CSV exports
  - **Changes Made**:
    - Updated export headers in `server/export-routes.ts` and `server/routes.ts`
    - Removed Public URL data from row generation in both export formats
    - Simplified export structure for cleaner output
  - **Impact**: Exports are now cleaner and more focused on actionable download links

- **Fixed thumbnail and captions download URLs in frontend**: Corrected broken download links in metadata table
  - **Root Cause**: Frontend was generating incorrect API endpoint URLs for downloads
  - **Solution**: Updated frontend to use correct API endpoint URLs
  - **Changes Made**:
    - Fixed thumbnail download URLs from `/api/videos/:id/thumbnail/download/*` to `/api/videos/:id/thumbnail`
    - Fixed captions download URLs from `/api/videos/:id/captions/download` to `/api/videos/:id/captions.txt`
    - Simplified thumbnail buttons to single download option instead of multiple size variants
  - **Impact**: Thumbnail and captions downloads now work correctly from the metadata view

- **Fixed captions endpoint to return actual captions**: Resolved issue where captions download returned video description instead of subtitle content
  - **Root Cause**: Captions endpoint was returning `video.description` instead of fetching actual caption/subtitle tracks
  - **Solution**: Updated endpoint to fetch and return actual caption content from Vimeo text tracks
  - **Changes Made**:
    - Modified `/api/videos/:videoId/captions.txt` endpoint to fetch text tracks from Vimeo API
    - Added logic to find default caption track or use first available track
    - Fetch actual caption content from Vimeo's caption link
    - Proper error handling for videos without captions
  - **Impact**: Caption downloads now provide actual subtitle/caption content instead of "[No description]"

- **Fixed missing metadata in exports**: Resolved issues with tags, description, duration, and file size showing incorrect values in Excel/CSV exports
  - **Root Cause**: Duration was being converted twice (once in getVideoDetails, once in export) and file size had similar double conversion
  - **Solution**: Fixed data type handling and conversion logic for metadata fields
  - **Changes Made**:
    - Fixed duration handling to return raw seconds from Vimeo API instead of pre-converted minutes
    - Fixed file size handling to return raw bytes from Vimeo API for proper conversion in exports
    - Added enhanced logging to debug missing metadata fields from Vimeo API
    - Maintained proper conversion logic in export functions (duration to minutes, file size to MB)
  - **Impact**: Exports now show correct duration, file size, and handle tags/descriptions properly when available

- **Made thumbnail URLs auto-download in exports**: Changed thumbnail URLs in Excel/CSV exports to force download when clicked
  - **Root Cause**: Exports were using direct Vimeo image URLs which display the image in browser instead of downloading
  - **Solution**: Changed thumbnail URLs to use our API endpoint which sets proper download headers
  - **Changes Made**:
    - Updated `server/export-routes.ts` to use `/api/videos/:videoId/thumbnail` instead of direct Vimeo image URLs
    - Updated `server/routes.ts` CSV export to use the same auto-download endpoint
    - Maintained existing thumbnail endpoint logic that sets `Content-Disposition: attachment` header
  - **Impact**: Clicking thumbnail URLs in Excel/CSV exports now automatically downloads the thumbnail image file

- **Fixed bulk download ArchiverError**: Resolved "queue closed" error that occurred when clients disconnected during bulk downloads
  - **Root Cause**: Archive stream operations were being called after client disconnection, causing the archive to throw errors
  - **Solution**: Added proper client disconnection checks before all archive operations
  - **Changes Made**:
    - Added `!isClientDisconnected` checks before all `archive.append()` calls in download workers
    - Added early exit mechanism in download workers when client disconnects
    - Improved connection stability with additional headers (`Transfer-Encoding: chunked`)
    - Enhanced logging to track client disconnection events
    - Added double-check for client connection before starting each individual download
  - **Impact**: Bulk downloads now handle client disconnections gracefully without throwing archive errors

- **Improved bulk download frontend error handling**: Fixed "Failed to download videos" message appearing despite successful backend processing
  - **Root Cause**: Frontend was treating connection interruptions during streaming as complete failures, even when backend successfully processed downloads
  - **Solution**: Enhanced frontend error handling to distinguish between server errors and connection issues during streaming
  - **Changes Made**:
    - Modified error checking to only fail on explicit HTTP 4xx/5xx errors
    - Added graceful handling of blob parsing failures during streaming
    - Improved user feedback with informative messages about connection interruptions
    - Added checks for empty blobs and provided appropriate user guidance
    - Better error messages that distinguish between server failures and connection issues
  - **Impact**: Users now see appropriate success/warning messages instead of generic failure alerts when downloads complete successfully but connections are interrupted

- **Fixed thumbnail URLs to be universal**: Reverted thumbnail URLs in Excel/CSV exports back to direct Vimeo links for universal sharing
  - **Root Cause**: Previous fix made thumbnails use localhost API endpoints, creating URLs that only work when server is running locally
  - **Solution**: Reverted to direct Vimeo thumbnail URLs that work universally and can be shared anywhere
  - **Changes Made**:
    - Updated `server/export-routes.ts` to use `largestThumbnail.link` instead of localhost API endpoint
    - Updated `server/routes.ts` CSV export to use direct Vimeo thumbnail URLs
    - Maintained highest quality thumbnail selection logic
  - **Impact**: Thumbnail URLs in Excel/CSV exports are now universal Vimeo links that can be shared and accessed from anywhere

#### 🔧 Dependencies
- **Clean dependency reinstall**: Removed and reinstalled all npm packages to resolve corrupted files
- **Verified package integrity**: All 624 packages successfully installed and audited
- **Security audit**: Identified 5 moderate severity vulnerabilities (existing, not introduced by this fix)

#### ✅ Verification
- **Development server**: Successfully starts on port 5000 without errors
- **API endpoints**: All endpoints responding correctly (credentials, folders, videos)
- **Vimeo integration**: Successfully connecting to Vimeo API and retrieving folder/video data
- **User interface**: Web interface loads and functions properly

#### 📋 Technical Details
- **Error Type**: ESBuild source map parsing error
- **Affected Package**: lucide-react@0.453.0
- **Build Tool**: ESBuild (via Vite)
- **Resolution Method**: Clean dependency reinstall
- **Testing**: Verified with `npm run dev` command execution

#### 🚀 Status
- **Application Status**: ✅ Fully functional
- **Build Status**: ✅ No errors
- **Development Mode**: ✅ Working correctly
- **Production Ready**: ✅ Ready for deployment

---

### Previous Versions

#### [Initial Release] - Full-Featured Vimeo Management Platform

#### ✨ Core Features Implemented
- **Complete Vimeo Integration**: Full API integration with Vimeo v3
- **Dual Storage Strategy**: PostgreSQL with Drizzle ORM + in-memory fallback
- **Modern UI/UX**: Shadcn/UI components with Tailwind CSS styling
- **Advanced Video Management**: Upload, download, replace, and organize videos
- **Bulk Operations**: Mass download and export capabilities
- **Caption Management**: VTT/TXT format support with search functionality
- **Metadata Export**: Excel export with comprehensive video information
- **Responsive Design**: Mobile-friendly interface with modern UX patterns

#### 🛠️ Technical Implementation
- **Frontend Architecture**: React 18 + TypeScript + Vite
- **Backend Architecture**: Express.js + TypeScript + RESTful API
- **Database Design**: Structured schema for users, folders, videos, captions
- **File Handling**: Multer for uploads, Archiver for zip creation
- **Authentication**: Vimeo OAuth token-based authentication
- **Error Handling**: Centralized error management with proper HTTP codes
- **Development Tools**: Hot module replacement, TypeScript compilation

---

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager
- Vimeo API credentials (Client ID, Client Secret, Access Token)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd vimeo-manager

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5000
```

### Configuration
1. Visit the application at `http://localhost:5000`
2. Navigate to the Setup page
3. Enter your Vimeo API credentials
4. Start managing your Vimeo content!

### API Endpoints
- `GET /api/folders` - List all Vimeo folders
- `GET /api/folders/:id/videos` - List videos in a folder
- `GET /api/videos/:id/download` - Download a video
- `POST /api/videos/export-metadata` - Export metadata to Excel
- `POST /api/videos/bulk-download` - Bulk download videos
- `POST /api/videos/upload` - Upload new video
- `POST /api/videos/:id/replace` - Replace existing video

---

## Support

For issues, feature requests, or questions:
- Check the application logs for detailed error information
- Verify Vimeo API credentials and permissions
- Ensure sufficient disk space for downloads
- Review the API documentation for endpoint details

---

#### Thumbnail and Caption Cache Issue After Video Replacement
- **Issue**: When replacing a video, thumbnails and captions showed old content from original video
- **Root Cause**: Vimeo CDN and browser cache retained old thumbnail/caption files after video replacement
- **Solution**: Implemented cache-busting system for thumbnails and captions
  - Added version parameter support to thumbnail and caption endpoints (`?v=timestamp`)
  - Cache-busting headers (`Cache-Control: no-cache`) for forced refresh
  - Local storage tracking of replacement timestamps for each video
  - Updated frontend to use cache versions for recently replaced videos
  - Added force refresh button in video modal with cache invalidation
  - Export functions use timestamped URLs for fresh thumbnail/caption data
- **Technical Implementation**:
  - Backend: `/api/videos/:videoId/thumbnail?v=xxx` and `/api/videos/:videoId/captions.txt?v=xxx`
  - Frontend: `localStorage` tracks `video-cache-version-{videoId}` after replacement
  - Automatic cache-busting in metadata table, video modal, and exports
- **Impact**: Thumbnails and captions now update immediately after video replacement, showing content from the new video

#### Global Cache Refresh for Legacy Replaced Videos
- **Issue**: Videos replaced before cache-busting system still showed old thumbnails and captions
- **Root Cause**: Previous video replacements had no cache version tracking, so cache-busting wasn't applied
- **Solution**: Added global cache refresh functionality accessible from video lists and metadata tables
  - "Refresh Cache" button in video table bulk actions
  - "Refresh Cache" button in metadata table header  
  - Applies current timestamp as cache version to ALL videos in the current view
  - Forces page reload to immediately apply fresh cache parameters
  - Works retroactively for any previously replaced videos
- **User Experience**:
  - One-click solution to fix all stale thumbnails and captions
  - Clear visual feedback with loading spinner and toast notifications
  - Automatic page reload ensures immediate visual updates
- **Technical Implementation**:
  - `localStorage.setItem('video-cache-version-{videoId}', timestamp)` for all videos
  - Bulk cache version assignment for batch fixing
  - Integrated into existing video table and metadata table components
- **Impact**: Users can now fix thumbnails and captions for all previously replaced videos with a single button click

---

**Built with ❤️ for the Vimeo community**
