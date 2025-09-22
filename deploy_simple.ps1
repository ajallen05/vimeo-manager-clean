# Simple Deployment Script for Vimeo Manager
Write-Host "Starting Vimeo Manager Deployment..." -ForegroundColor Cyan
Write-Host ""

# Create GitHub repository
$repoName = "vimeo-manager-app"
Write-Host "Creating GitHub repository: $repoName" -ForegroundColor Yellow

# Check if gh is available
$ghExists = Get-Command gh -ErrorAction SilentlyContinue
if (-not $ghExists) {
    Write-Host "Installing GitHub CLI..." -ForegroundColor Yellow
    winget install --id GitHub.cli -e --source winget
}

# Create and push repository
Write-Host "Pushing code to GitHub..." -ForegroundColor Yellow
gh auth login --web
gh repo create $repoName --public --source=. --remote=origin --push

Write-Host ""
Write-Host "Repository created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "1. Go to: https://render.com" -ForegroundColor Yellow
Write-Host "2. Sign up or login (FREE)" -ForegroundColor White
Write-Host "3. Click 'New +' then 'Web Service'" -ForegroundColor White
Write-Host "4. Connect GitHub and select: $repoName" -ForegroundColor White
Write-Host "5. Click 'Create Web Service'" -ForegroundColor White
Write-Host ""
Write-Host "Your app will be live at: https://$repoName.onrender.com" -ForegroundColor Green
Write-Host ""
Write-Host "Opening Render.com in your browser..." -ForegroundColor Cyan
Start-Process "https://render.com"
