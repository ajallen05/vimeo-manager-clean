import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, Info, AlertTriangle } from "lucide-react";

interface AnimatedToastProps {
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
  className?: string;
}

export function AnimatedToast({ 
  type, 
  title, 
  description, 
  className 
}: AnimatedToastProps) {
  const typeConfig = {
    success: {
      icon: CheckCircle,
      bgColor: "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20",
      borderColor: "border-green-200 dark:border-green-800",
      iconColor: "text-green-600 dark:text-green-400",
      titleColor: "text-green-800 dark:text-green-200"
    },
    error: {
      icon: XCircle,
      bgColor: "bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/20 dark:to-rose-950/20",
      borderColor: "border-red-200 dark:border-red-800",
      iconColor: "text-red-600 dark:text-red-400",
      titleColor: "text-red-800 dark:text-red-200"
    },
    warning: {
      icon: AlertTriangle,
      bgColor: "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20",
      borderColor: "border-yellow-200 dark:border-yellow-800",
      iconColor: "text-yellow-600 dark:text-yellow-400",
      titleColor: "text-yellow-800 dark:text-yellow-200"
    },
    info: {
      icon: Info,
      bgColor: "bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20",
      borderColor: "border-blue-200 dark:border-blue-800",
      iconColor: "text-blue-600 dark:text-blue-400",
      titleColor: "text-blue-800 dark:text-blue-200"
    }
  };

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <div className={cn(
      "p-4 rounded-2xl border backdrop-blur-sm animate-slide-in shadow-lg",
      config.bgColor,
      config.borderColor,
      className
    )}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <Icon className={cn("w-5 h-5", config.iconColor)} />
        </div>
        <div className="flex-1">
          <h3 className={cn("font-semibold text-sm", config.titleColor)}>
            {title}
          </h3>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

interface FloatingActionButtonProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
  color?: "primary" | "secondary" | "success" | "danger";
}

export function FloatingActionButton({ 
  onClick, 
  icon, 
  label, 
  className,
  color = "primary" 
}: FloatingActionButtonProps) {
  const colorClasses = {
    primary: "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700",
    secondary: "bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700",
    success: "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700",
    danger: "bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700"
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 w-14 h-14 rounded-2xl text-white shadow-2xl transition-all duration-200 hover:shadow-3xl hover:scale-105 active:scale-95 z-50 group",
        colorClasses[color],
        className
      )}
      title={label}
    >
      <div className="flex items-center justify-center">
        {icon}
      </div>
      <div className="absolute bottom-full right-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs px-2 py-1 rounded-lg whitespace-nowrap">
          {label}
        </div>
      </div>
    </button>
  );
}

interface PulseEffectProps {
  children: React.ReactNode;
  className?: string;
  color?: "blue" | "green" | "purple" | "red";
}

export function PulseEffect({ children, className, color = "blue" }: PulseEffectProps) {
  const colorClasses = {
    blue: "shadow-blue-500/50",
    green: "shadow-green-500/50",
    purple: "shadow-purple-500/50",
    red: "shadow-red-500/50"
  };

  return (
    <div className={cn(
      "relative",
      className
    )}>
      {children}
      <div className={cn(
        "absolute inset-0 rounded-full animate-ping opacity-20",
        colorClasses[color]
      )} />
    </div>
  );
}
