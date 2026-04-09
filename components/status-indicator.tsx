"use client";

import { cn } from "@/lib/utils";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "waiting"
  | "connected"
  | "error";

interface StatusIndicatorProps {
  status: ConnectionStatus;
  className?: string;
}

const statusConfig: Record<
  ConnectionStatus,
  { label: string; dotClass: string; textClass: string }
> = {
  idle: {
    label: "Ready",
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
  connecting: {
    label: "Connecting...",
    dotClass: "bg-primary animate-pulse",
    textClass: "text-primary",
  },
  waiting: {
    label: "Waiting for connection...",
    dotClass: "bg-accent animate-pulse",
    textClass: "text-accent-foreground",
  },
  connected: {
    label: "Connected",
    dotClass: "bg-green-500",
    textClass: "text-green-700",
  },
  error: {
    label: "Connection failed",
    dotClass: "bg-destructive",
    textClass: "text-destructive",
  },
};

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "h-3 w-3 rounded-full transition-colors duration-300",
          config.dotClass
        )}
      />
      <span
        className={cn(
          "text-sm font-medium transition-colors duration-300",
          config.textClass
        )}
      >
        {config.label}
      </span>
    </div>
  );
}
