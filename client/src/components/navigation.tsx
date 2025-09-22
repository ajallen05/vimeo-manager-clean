import { Link, useLocation } from "wouter";
import { Download, Upload } from "lucide-react";

export default function Navigation() {
  const [location] = useLocation();
  
  const isDownload = location === "/" || location === "/download";
  const isUpload = location === "/upload";

  return (
    <nav className="glass border-b border-border/10 bg-card/50">
      <div className="max-w-7xl mx-auto px-6 py-2">
        <div className="flex space-x-2">
          <Link href="/download">
            <button 
              className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 group ${
                isDownload 
                  ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              data-testid="nav-download"
            >
              <div className="flex items-center space-x-2">
                <Download className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                  isDownload ? "" : "group-hover:text-blue-500"
                }`} />
                <span>Download</span>
              </div>
              {isDownload && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
              )}
            </button>
          </Link>
          <Link href="/upload">
            <button 
              className={`relative px-6 py-3 rounded-xl font-medium transition-all duration-200 group ${
                isUpload 
                  ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/25" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              data-testid="nav-upload"
            >
              <div className="flex items-center space-x-2">
                <Upload className={`w-4 h-4 transition-transform group-hover:scale-110 ${
                  isUpload ? "" : "group-hover:text-purple-500"
                }`} />
                <span>Upload</span>
              </div>
              {isUpload && (
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 to-pink-700 opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
              )}
            </button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
