import { Link, useLocation } from "wouter";
import { Download, Upload } from "lucide-react";
import { memo } from "react";

function Navigation() {
  const [location] = useLocation();
  
  const isDownload = location === "/" || location === "/download";
  const isUpload = location === "/upload";

  return (
    <nav className="glass border-b border-border/10 bg-card/50" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-6 py-2">
        <div className="flex space-x-2">
          {/* Fixed: Removed button inside Link - Link itself is the interactive element */}
          <Link 
            href="/download"
            className={`relative px-6 py-3 rounded-xl font-medium transition-colors duration-200 group inline-flex items-center ${
              isDownload 
                ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-download"
            aria-current={isDownload ? "page" : undefined}
          >
            <div className="flex items-center space-x-2">
              <Download className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                isDownload ? "" : "group-hover:text-blue-500"
              }`} aria-hidden="true" />
              <span>Download</span>
            </div>
          </Link>
          <Link 
            href="/upload"
            className={`relative px-6 py-3 rounded-xl font-medium transition-colors duration-200 group inline-flex items-center ${
              isUpload 
                ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/25" 
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            data-testid="nav-upload"
            aria-current={isUpload ? "page" : undefined}
          >
            <div className="flex items-center space-x-2">
              <Upload className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                isUpload ? "" : "group-hover:text-purple-500"
              }`} aria-hidden="true" />
              <span>Upload</span>
            </div>
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default memo(Navigation);
