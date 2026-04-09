"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/status-indicator";
import { AudioLevelMeter } from "@/components/audio-level-meter";
import { QRDisplay } from "@/components/qr-display";
import { useWebRTCSender } from "@/hooks/use-webrtc";
import { ArrowLeft, Mic, MicOff, Square } from "lucide-react";

export default function SenderPage() {
  const { status, sessionId, audioLevel, error, start, stop } =
    useWebRTCSender();
  const [receiverUrl, setReceiverUrl] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId && typeof window !== "undefined") {
      const baseUrl = window.location.origin;
      setReceiverUrl(`${baseUrl}/receiver?session=${sessionId}`);
    } else {
      setReceiverUrl(null);
    }
  }, [sessionId]);

  const handleStart = async () => {
    await start();
  };

  const handleStop = () => {
    stop();
  };

  return (
    <main className="min-h-screen flex flex-col p-6">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <Link href="/">
          <Button variant="ghost" size="icon" className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Baby Side</h1>
          <p className="text-sm text-muted-foreground">Sender Mode</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-md mx-auto w-full">
        {/* Status */}
        <StatusIndicator status={status} />

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        {/* Idle State - Start Button */}
        {status === "idle" && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic className="w-12 h-12 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              Tap the button below to start broadcasting. This will request
              microphone access.
            </p>
            <Button
              size="lg"
              onClick={handleStart}
              className="h-14 px-8 rounded-2xl text-lg gap-2"
            >
              <Mic className="w-5 h-5" />
              Start Broadcasting
            </Button>
          </div>
        )}

        {/* Connecting State */}
        {status === "connecting" && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Mic className="w-12 h-12 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Requesting microphone access...
            </p>
          </div>
        )}

        {/* Waiting/Connected State - Show QR Code and Audio Meter */}
        {(status === "waiting" || status === "connected") && receiverUrl && (
          <div className="flex flex-col items-center gap-8 w-full">
            {/* QR Code */}
            {status === "waiting" && <QRDisplay url={receiverUrl} />}

            {/* Connected Message */}
            {status === "connected" && (
              <div className="p-4 bg-green-500/10 rounded-xl text-center">
                <p className="text-green-700 font-medium">
                  Parent device connected!
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Audio is now streaming
                </p>
              </div>
            )}

            {/* Audio Level */}
            <div className="w-full p-6 bg-card rounded-2xl border border-border">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Audio Level
              </p>
              <AudioLevelMeter level={audioLevel} />
            </div>

            {/* Stop Button */}
            <Button
              variant="destructive"
              size="lg"
              onClick={handleStop}
              className="h-14 px-8 rounded-2xl text-lg gap-2"
            >
              <Square className="w-5 h-5" />
              Stop
            </Button>
          </div>
        )}

        {/* Error State */}
        {status === "error" && (
          <div className="flex flex-col items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center">
              <MicOff className="w-12 h-12 text-destructive" />
            </div>
            <Button
              size="lg"
              onClick={handleStart}
              className="h-14 px-8 rounded-2xl text-lg gap-2"
            >
              Try Again
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
