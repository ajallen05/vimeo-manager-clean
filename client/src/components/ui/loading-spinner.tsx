import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  color?: "primary" | "secondary" | "white";
}

export function LoadingSpinner({ 
  size = "md", 
  className,
  color = "primary" 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-6 h-6", 
    lg: "w-8 h-8"
  };

  const colorClasses = {
    primary: "border-primary",
    secondary: "border-muted-foreground",
    white: "border-white"
  };

  return (
    <div className={cn(
      "animate-spin rounded-full border-2 border-t-transparent",
      sizeClasses[size],
      colorClasses[color],
      className
    )} />
  );
}

interface PulsingDotProps {
  className?: string;
  color?: "primary" | "green" | "blue" | "purple";
}

export function PulsingDot({ className, color = "primary" }: PulsingDotProps) {
  const colorClasses = {
    primary: "bg-primary",
    green: "bg-green-500",
    blue: "bg-blue-500", 
    purple: "bg-purple-500"
  };

  return (
    <div className={cn(
      "w-2 h-2 rounded-full animate-pulse",
      colorClasses[color],
      className
    )} />
  );
}

interface SkeletonLoaderProps {
  className?: string;
  variant?: "text" | "card" | "avatar" | "button";
}

export function SkeletonLoader({ className, variant = "text" }: SkeletonLoaderProps) {
  const variantClasses = {
    text: "h-4 w-full",
    card: "h-32 w-full",
    avatar: "h-10 w-10 rounded-full",
    button: "h-10 w-24"
  };

  return (
    <div className={cn(
      "bg-gradient-to-r from-muted via-muted/50 to-muted rounded-lg animate-pulse",
      variantClasses[variant],
      className
    )} />
  );
}

interface LoadingOverlayProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  loadingText?: string;
}

export function LoadingOverlay({ 
  isLoading, 
  children, 
  className,
  loadingText = "Loading..." 
}: LoadingOverlayProps) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 rounded-lg">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <LoadingSpinner size="md" color="white" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">{loadingText}</p>
              <p className="text-sm text-muted-foreground mt-1">Please wait...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
  color?: "primary" | "green" | "blue" | "purple";
}

export function ProgressBar({ 
  progress, 
  className, 
  showPercentage = false,
  color = "primary" 
}: ProgressBarProps) {
  const colorClasses = {
    primary: "bg-gradient-to-r from-blue-500 to-purple-600",
    green: "bg-green-500",
    blue: "bg-blue-500",
    purple: "bg-purple-500"
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showPercentage && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full transition-all duration-300 ease-out rounded-full",
            colorClasses[color]
          )}
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
    </div>
  );
}
