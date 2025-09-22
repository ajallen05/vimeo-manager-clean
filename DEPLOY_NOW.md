# 🚀 DEPLOY YOUR VIMEO MANAGER - INSTANT DEPLOYMENT

## ⚡ QUICK DEPLOY (2 MINUTES)

### Option 1: Automatic Script (Recommended)
Run this single command in PowerShell:
```powershell
.\deploy.ps1
```

This will:
1. Install Git and GitHub CLI if needed
2. Create a GitHub repository
3. Push your code
4. Open the Render deployment page
5. Give you your app URL

### Option 2: Manual Steps

#### Step 1: Push to GitHub
```bash
# If you haven't installed GitHub CLI
winget install --id GitHub.cli

# Login to GitHub
gh auth login

# Create and push repository
gh repo create vimeo-manager --public --source=. --push
```

#### Step 2: Deploy to Render
1. Go to: https://render.com
2. Sign up/Login (FREE - no credit card required)
3. Click "New +" → "Web Service"
4. Connect your GitHub account
5. Select your `vimeo-manager` repository
6. Click "Create Web Service"

#### Step 3: Wait for Build
- Takes 5-10 minutes
- Render will automatically:
  - Install dependencies
  - Build your app
  - Start the server

#### Step 4: Access Your App
Your app will be live at:
```
https://vimeo-manager.onrender.com
```

## 📝 POST-DEPLOYMENT SETUP

1. **Visit your app URL**
2. **Complete Vimeo Setup:**
   - Click "Setup" in the navigation
   - Enter your Vimeo credentials:
     - Access Token
     - Client ID  
     - Client Secret
3. **Start using your app!**

## 🔑 GET VIMEO CREDENTIALS

1. Go to: https://developer.vimeo.com/apps
2. Click "Create App"
3. Fill in app details
4. Go to "Authentication" tab
5. Generate Personal Access Token with these scopes:
   - `private` - View private videos
   - `video_files` - Access video files
   - `upload` - Upload videos
   - `edit` - Edit video metadata
   - `delete` - Delete videos (optional)

## 🆓 FREE HOSTING DETAILS

**Render Free Tier Includes:**
- ✅ Unlimited deployments
- ✅ Automatic HTTPS/SSL
- ✅ Custom domains (optional)
- ✅ 750 hours/month runtime
- ⚠️ App sleeps after 15 min inactivity (wakes on request)
- ⚠️ 512MB RAM limit

## 🚨 TROUBLESHOOTING

### If deployment fails:
```bash
# Check logs on Render dashboard
# Or rebuild manually:
npm run build
```

### If app doesn't start:
- Check Render logs
- Ensure PORT is set to 10000
- Verify NODE_ENV is "production"

### If Excel downloads show localhost:
- Render automatically sets PUBLIC_BASE_URL
- If not, manually set in Render Environment

## 📊 YOUR DEPLOYED APP FEATURES

✅ Browse Vimeo folders
✅ Download videos (single & bulk)
✅ Export metadata to Excel
✅ Upload new videos
✅ Replace existing videos
✅ Download thumbnails
✅ Download captions
✅ Secure credential storage

## 🎉 DEPLOYMENT COMPLETE!

Your Vimeo Manager is now live and accessible from anywhere!

**App URL:** `https://vimeo-manager.onrender.com`
**Status Page:** `https://dashboard.render.com`

---

Need help? Check the logs in Render dashboard or open an issue on GitHub.
