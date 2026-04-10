"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/status-indicator";
import type { ConnectionStatus } from "@/components/status-indicator";
import { Check, Copy } from "lucide-react";

interface QRDisplayProps {
  url: string;
  status?: ConnectionStatus;
  babyName?: string;
  className?: string;
}

export function QRDisplay({ url, status, babyName, className }: QRDisplayProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      console.error("Failed to copy URL");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-4 w-full animate-fade-in-up",
        className
      )}
    >
      <div className="p-6 bg-card rounded-3xl shadow-lg shadow-primary/5 border border-border/50 w-full flex flex-col items-center">
        {babyName && (
          <p className="text-lg font-bold text-foreground mb-1">{babyName}</p>
        )}
        {status && (
          <div className="mb-4">
            <StatusIndicator status={status} />
          </div>
        )}
        <div className="p-4 bg-white rounded-2xl">
          <QRCodeSVG
            value={url}
            size={180}
            level="M"
            bgColor="white"
            fgColor="#1a1a1a"
          />
        </div>
        <p className="text-sm text-muted-foreground text-center mt-4 leading-relaxed">
          Scan with the parent device or share the link
        </p>
        <div className="flex items-center gap-2 w-full max-w-xs mt-3">
          <code className="flex-1 px-4 py-2.5 text-xs bg-muted/50 rounded-xl border border-border/30 truncate">
            {url}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            className="shrink-0 rounded-xl"
          >
            {copied ? (
              <Check className="h-4 w-4 text-warm-green" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
