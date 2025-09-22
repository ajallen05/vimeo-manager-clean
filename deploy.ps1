# Automated Deployment Script for Vimeo Manager
# This script will deploy your app to Render with minimal interaction

Write-Host "🚀 Starting Vimeo Manager Deployment" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Check if git is installed
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Git is not installed. Installing Git..." -ForegroundColor Yellow
    winget install --id Git.Git -e --source winget
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Initialize git repository if not already initialized
if (!(Test-Path .git)) {
    Write-Host "📁 Initializing Git repository..." -ForegroundColor Yellow
    git init
    git add .
    git commit -m "Initial commit: Vimeo Manager application"
}

# Check if GitHub CLI is installed
if (!(Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing GitHub CLI..." -ForegroundColor Yellow
    winget install --id GitHub.cli -e --source winget
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Create GitHub repository
Write-Host "🔧 Creating GitHub repository..." -ForegroundColor Yellow
$repoName = "vimeo-manager-$(Get-Random -Maximum 9999)"

# Check if user is logged in to GitHub
try {
    $ghAuthStatus = gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "🔐 Please login to GitHub..." -ForegroundColor Yellow
        gh auth login --web
    }
} catch {
    Write-Host "🔐 Please login to GitHub..." -ForegroundColor Yellow
    gh auth login --web
}

# Create the repository
Write-Host "📝 Creating repository: $repoName" -ForegroundColor Green
gh repo create $repoName --public --source=. --remote=origin --push

# Get the repository URL
$repoUrl = gh repo view --json url -q .url

Write-Host "✅ GitHub repository created: $repoUrl" -ForegroundColor Green

# Create Render deployment URL
$renderDeployUrl = "https://render.com/deploy?repo=$repoUrl"

Write-Host "`n🎉 Deployment Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host "`n📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Click the following link to deploy to Render:" -ForegroundColor White
Write-Host "   $renderDeployUrl" -ForegroundColor Yellow
Write-Host "`n2. On Render:" -ForegroundColor White
Write-Host "   - Click 'Connect GitHub account' if prompted" -ForegroundColor Gray
Write-Host "   - Review the settings (they're pre-configured)" -ForegroundColor Gray
Write-Host "   - Click 'Create Web Service'" -ForegroundColor Gray
Write-Host "`n3. Wait for deployment (5-10 minutes)" -ForegroundColor White
Write-Host "`n4. Your app will be available at:" -ForegroundColor White
Write-Host "   https://$repoName.onrender.com" -ForegroundColor Yellow
Write-Host "`n5. Visit the app and complete the Vimeo setup" -ForegroundColor White

# Open the deployment URL in browser
Write-Host "`n🌐 Opening deployment page in browser..." -ForegroundColor Cyan
Start-Process $renderDeployUrl

Write-Host "`n✨ Deployment script complete!" -ForegroundColor Green
