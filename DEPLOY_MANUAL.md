# 🚀 DEPLOY YOUR APP IN 5 MINUTES - MANUAL STEPS

## Step 1: Push to GitHub (2 min)

### Option A: Using GitHub Desktop (Easiest)
1. Download GitHub Desktop: https://desktop.github.com/
2. Sign in to GitHub
3. Click "Add" → "Add Existing Repository"
4. Browse to: `C:\Users\ADMIN\Downloads\VimeoManager_francis\VimeoManager_francis`
5. Click "Publish repository"
6. Name it: `vimeo-manager`
7. Click "Publish Repository"

### Option B: Using GitHub Website
1. Go to: https://github.com/new
2. Name: `vimeo-manager`
3. Click "Create repository"
4. Upload files:
   - Click "uploading an existing file"
   - Drag ALL files from your folder
   - Click "Commit changes"

## Step 2: Deploy to Render (3 min)

1. **Go to:** https://dashboard.render.com/register
2. **Sign up** with GitHub (FREE, no credit card)
3. **Click:** "New +" → "Web Service"
4. **Connect:** Your GitHub account
5. **Select:** `vimeo-manager` repository
6. **Configure:**
   - Name: `vimeo-manager`
   - Environment: `Node`
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm start`
7. **Click:** "Create Web Service"

## Step 3: Wait (5-10 min)
Render will:
- Install dependencies
- Build your app
- Deploy it

## Step 4: Access Your App
Your app is live at:
```
https://vimeo-manager.onrender.com
```

## Step 5: Setup Vimeo
1. Visit your app URL
2. Click "Setup"
3. Enter your Vimeo credentials

---

## 🎯 QUICK LINKS

- **GitHub:** https://github.com
- **Render:** https://render.com
- **Your App:** https://vimeo-manager.onrender.com
- **Vimeo Dev:** https://developer.vimeo.com/apps

## ✅ THAT'S IT!
Your app is now live and accessible from anywhere!
