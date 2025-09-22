# Vimeo Manager

A powerful web application for managing Vimeo videos with bulk download, metadata export, and upload capabilities.

## 🚀 One-Click Deploy

Deploy this app instantly to Render:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## ✨ Features

- 📁 **Browse Vimeo Folders**: Navigate through your Vimeo folder structure
- 📥 **Download Videos**: Download individual videos or bulk download entire folders
- 📊 **Export Metadata**: Export video information to Excel with thumbnail and caption download links
- 📤 **Upload Videos**: Upload new videos or replace existing ones
- 🎬 **Video Player**: Built-in video player with Vimeo embed
- 📝 **Captions Support**: Download captions in VTT or TXT format
- 🖼️ **Thumbnail Downloads**: Download video thumbnails in multiple sizes

## 🛠️ Technology Stack

- **Frontend**: React 18 with TypeScript, Tailwind CSS, Shadcn/UI
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL (optional) or in-memory storage
- **API**: Vimeo API v3

## 📦 Installation

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/your-username/vimeo-manager.git
cd vimeo-manager
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run dev
```

4. Open http://localhost:5000 and complete the Vimeo setup

### Production Build

```bash
npm run build
npm start
```

## 🔧 Configuration

The app requires Vimeo API credentials which are configured through the web UI:

1. Visit the deployed app
2. Go to the Setup page
3. Enter your Vimeo credentials:
   - Access Token
   - Client ID
   - Client Secret

To get Vimeo API credentials:
1. Go to https://developer.vimeo.com/apps
2. Create a new app
3. Generate an access token with required scopes

## 🌍 Environment Variables

- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)
- `PUBLIC_BASE_URL`: Your app's public URL (auto-configured on Render)
- `DATABASE_URL`: PostgreSQL connection string (optional)

## 📝 API Endpoints

- `GET /api/folders` - List all Vimeo folders
- `GET /api/folders/:id/videos` - List videos in a folder
- `GET /api/videos/:id/download` - Download a video
- `POST /api/videos/export-metadata` - Export metadata to Excel
- `POST /api/videos/bulk-download` - Bulk download videos
- `POST /api/videos/upload` - Upload new video
- `POST /api/videos/:id/replace` - Replace existing video

## 🔒 Security

- Vimeo credentials are stored securely in memory
- No credentials are exposed in the frontend
- All API calls are proxied through the backend

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 🐛 Issues

If you find a bug or have a feature request, please open an issue on GitHub.

---

Built with ❤️ for the Vimeo community
