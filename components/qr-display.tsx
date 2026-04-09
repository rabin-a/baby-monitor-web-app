"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

interface QRDisplayProps {
  url: string;
  className?: string;
}

export function QRDisplay({ url, className }: QRDisplayProps) {
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
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="p-4 bg-card rounded-2xl shadow-sm border border-border">
        <QRCodeSVG
          value={url}
          size={180}
          level="M"
          bgColor="transparent"
          fgColor="currentColor"
          className="text-foreground"
        />
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        Scan this QR code with the parent device or share the link below
      </p>
      <div className="flex items-center gap-2 w-full max-w-xs">
        <code className="flex-1 px-3 py-2 text-xs bg-muted rounded-lg truncate">
          {url}
        </code>
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          className="shrink-0"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
