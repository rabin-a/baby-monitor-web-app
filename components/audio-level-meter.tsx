"use client";

import { cn } from "@/lib/utils";

interface AudioLevelMeterProps {
  level: number; // 0-100
  className?: string;
}

export function AudioLevelMeter({ level, className }: AudioLevelMeterProps) {
  const bars = 10;
  const activeBars = Math.round((level / 100) * bars);

  return (
    <div className={cn("flex items-end justify-center gap-1 h-16", className)}>
      {Array.from({ length: bars }).map((_, i) => {
        const isActive = i < activeBars;
        const height = 20 + (i * 60) / bars;

        return (
          <div
            key={i}
            className={cn(
              "w-3 rounded-full transition-all duration-75",
              isActive
                ? "bg-primary"
                : "bg-muted"
            )}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
}
