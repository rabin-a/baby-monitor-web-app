"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusIndicator } from "@/components/status-indicator";
import { AudioWaveform } from "@/components/audio-waveform";
import { useWebRTCReceiver } from "@/hooks/use-webrtc";
import { useAIMonitor } from "@/hooks/use-ai-monitor";
import {
  ArrowLeft,
  Baby,
  Bot,
  Headphones,
  Link as LinkIcon,
  Radar,
  Volume2,
  VolumeOff,
} from "lucide-react";

interface DiscoveredMonitor {
  sessionId: string;
  babyName: string;
}

function ReceiverContent() {
  const searchParams = useSearchParams();
  const sessionFromUrl = searchParams.get("session");

  const {
    status,
    audioLevel,
    audioStream,
    error,
    muted,
    sessionEnded,
    connect,
    disconnect,
    toggleMute,
  } = useWebRTCReceiver();

  const ai = useAIMonitor();
  const [sessionInput, setSessionInput] = useState("");
  const [lastSession, setLastSession] = useState<string | null>(null);

  // Discovery state
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<DiscoveredMonitor[] | null>(
    null
  );
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");

  // Detect AI bridge on mount
  useEffect(() => {
    ai.detectBridge();
    // Request notification permission early
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [ai.detectBridge]);

  // Feed audio level to AI monitor for VAD
  useEffect(() => {
    if (ai.enabled) ai.onAudioLevel(audioLevel);
  }, [audioLevel, ai.enabled, ai.onAudioLevel]);

  // Start AI monitoring when connected and stream is available
  useEffect(() => {
    if (status === "connected" && audioStream && ai.enabled) {
      ai.startMonitoring(audioStream);
    }
  }, [status, audioStream, ai.enabled, ai.startMonitoring]);

  const handleConnect = useCallback(
    (sid?: string, pin?: string) => {
      const session = sid || sessionFromUrl || lastSession;
      if (session) {
        setLastSession(session);
        connect(session, pin || undefined);
      } else {
        let sessionId = sessionInput.trim();
        const urlMatch = sessionId.match(/session=([a-zA-Z0-9]+)/);
        if (urlMatch) sessionId = urlMatch[1];
        if (sessionId) {
          setLastSession(sessionId);
          connect(sessionId, pin || undefined);
        }
      }
    },
    [sessionFromUrl, lastSession, sessionInput, connect]
  );

  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscovered(null);
    try {
      const res = await fetch("/api/signal?type=discover");
      const data = await res.json();
      setDiscovered(data.sessions ?? []);
    } catch {
      setDiscovered([]);
    }
    setDiscovering(false);
  };

  const handlePinSubmit = () => {
    if (selectedSession && pinInput.length === 4) {
      handleConnect(selectedSession, pinInput);
      setSelectedSession(null);
      setPinInput("");
    }
  };

  const hasSession = sessionFromUrl || lastSession;

  return (
    <main className="min-h-screen flex flex-col p-4 sm:p-6 bg-gradient-warm">
      {/* Header */}
      <header className="flex items-center gap-4 mb-8">
        <Link href="/">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-card shadow-sm border border-border/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">Parent Side</h1>
          <p className="text-sm text-muted-foreground">Receiver Mode</p>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-md mx-auto w-full">
        {/* Idle — has session: show connect/reconnect */}
        {status === "idle" && hasSession && !selectedSession && (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in-up">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/15 to-warm-amber/10 flex items-center justify-center shadow-lg shadow-primary/10 animate-glow-pulse">
              <Headphones className="w-12 h-12 text-primary" />
            </div>
            <p className="text-base text-muted-foreground text-center">
              {lastSession
                ? "Disconnected — tap to reconnect"
                : "Ready to connect to baby device"}
            </p>
            <Button
              size="lg"
              onClick={() => handleConnect()}
              className="group w-full h-16 text-lg rounded-3xl gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all duration-200"
            >
              <Headphones className="w-6 h-6 group-hover:scale-110 transition-transform" />
              {lastSession ? "Reconnect" : "Tap to Listen"}
            </Button>
          </div>
        )}

        {/* Idle — no session: show discover + manual input */}
        {status === "idle" && !hasSession && !selectedSession && (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in-up">
            {/* Discover button */}
            <Button
              size="lg"
              onClick={handleDiscover}
              disabled={discovering}
              className="group w-full h-16 text-lg rounded-3xl gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all duration-200"
            >
              <Radar
                className={`w-6 h-6 ${discovering ? "animate-spin" : "group-hover:scale-110 transition-transform"}`}
              />
              {discovering ? "Searching..." : "Find nearby monitors"}
            </Button>

            {/* Discovery results */}
            {discovered !== null && (
              <div className="w-full flex flex-col gap-3 animate-fade-in-up">
                {discovered.length === 0 ? (
                  <div className="p-5 bg-muted/50 rounded-2xl border border-border/30 text-center">
                    <p className="text-sm text-muted-foreground">
                      No monitors found on your network
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Make sure the baby device has started monitoring
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-foreground">
                      Found on your network:
                    </p>
                    {discovered.map((m) => (
                      <button
                        key={m.sessionId}
                        onClick={() => {
                          setSelectedSession(m.sessionId);
                          setPinInput("");
                        }}
                        className="w-full p-4 bg-card rounded-2xl border border-border/50 shadow-sm flex items-center gap-4 hover:bg-muted/30 active:scale-[0.98] transition-all text-left"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-warm-amber/10 flex items-center justify-center">
                          <Baby className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {m.babyName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Tap to connect
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Manual input */}
            <div className="w-full flex flex-col gap-3">
              <Input
                type="text"
                placeholder="Paste session link here..."
                value={sessionInput}
                onChange={(e) => setSessionInput(e.target.value)}
                className="h-14 rounded-2xl border-border/50 shadow-sm"
              />
              <Button
                size="lg"
                onClick={() => handleConnect()}
                disabled={!sessionInput.trim()}
                className="h-14 rounded-3xl text-lg gap-2 shadow-md active:scale-[0.98] transition-all"
              >
                <Headphones className="w-5 h-5" />
                Connect
              </Button>
            </div>
          </div>
        )}

        {/* PIN entry for discovered monitor */}
        {status === "idle" && selectedSession && (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in-up">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/15 to-warm-amber/10 flex items-center justify-center shadow-lg shadow-primary/10">
              <Baby className="w-10 h-10 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground text-center">
              Enter PIN to connect
            </p>
            <Input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="4-digit PIN"
              value={pinInput}
              onChange={(e) =>
                setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              className="h-14 rounded-2xl border-border/50 shadow-sm text-center text-2xl tracking-[0.5em] font-bold"
            />
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setSelectedSession(null)}
                className="flex-1 h-14 rounded-3xl text-lg"
              >
                Back
              </Button>
              <Button
                size="lg"
                onClick={handlePinSubmit}
                disabled={pinInput.length !== 4}
                className="flex-1 h-14 rounded-3xl text-lg gap-2 bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all"
              >
                <Headphones className="w-5 h-5" />
                Connect
              </Button>
            </div>
          </div>
        )}

        {/* Connecting State */}
        {status === "connecting" && (
          <div className="flex flex-col items-center gap-6 animate-fade-in-up">
            <StatusIndicator status={status} />
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/15 to-warm-amber/10 flex items-center justify-center animate-gentle-pulse">
              <Headphones className="w-12 h-12 text-primary" />
            </div>
            <p className="text-base text-muted-foreground text-center">
              Waiting for sender to approve...
            </p>
          </div>
        )}

        {/* Connected State */}
        {status === "connected" && (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in-up">
            <StatusIndicator status={status} />

            <div className="w-full p-5 bg-warm-green/10 border border-warm-green/20 rounded-2xl text-center">
              <p className="text-warm-green-foreground font-semibold">
                Connected to baby device!
              </p>
              <p className="text-sm text-warm-green-foreground/70 mt-1">
                {muted
                  ? "Audio muted — tap unmute to listen"
                  : "Listening live"}
              </p>
            </div>

            <div className="w-full p-6 bg-card rounded-3xl border border-border/50 shadow-sm">
              <div className="flex items-center justify-center gap-2 mb-4">
                {muted ? (
                  <VolumeOff className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <Volume2 className="w-4 h-4 text-primary" />
                )}
                <p className="text-sm font-medium text-muted-foreground">
                  Incoming Audio
                </p>
              </div>
              <AudioWaveform level={audioLevel} />
            </div>

            <Button
              size="lg"
              onClick={toggleMute}
              className={`w-full h-14 rounded-3xl text-lg gap-2 active:scale-[0.98] transition-all duration-200 ${
                muted
                  ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25"
                  : "bg-card border-2 border-primary/20 text-foreground shadow-sm hover:bg-muted/50"
              }`}
            >
              {muted ? (
                <>
                  <Volume2 className="w-5 h-5" />
                  Unmute
                </>
              ) : (
                <>
                  <VolumeOff className="w-5 h-5" />
                  Mute
                </>
              )}
            </Button>

            {/* AI Monitor */}
            {ai.available && (
              <div className="w-full p-5 bg-card rounded-3xl border border-border/50 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    <p className="text-sm font-semibold text-foreground">
                      AI Monitor
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      ai.enabled
                        ? ai.stopMonitoring()
                        : audioStream && ai.startMonitoring(audioStream)
                    }
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      ai.enabled
                        ? "bg-warm-green/15 text-warm-green-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {ai.enabled ? "Active" : "Enable"}
                  </button>
                </div>

                {ai.enabled && (
                  <div className="flex flex-col gap-3">
                    {/* Mode selector */}
                    <div className="flex rounded-full bg-muted/60 p-1">
                      <button
                        onClick={() => ai.changeMode("notify_crying")}
                        className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-all ${
                          ai.mode === "notify_crying"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground"
                        }`}
                      >
                        Crying only
                      </button>
                      <button
                        onClick={() => ai.changeMode("notify_any")}
                        className={`flex-1 py-1.5 rounded-full text-xs font-medium transition-all ${
                          ai.mode === "notify_any"
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground"
                        }`}
                      >
                        Any sound
                      </button>
                    </div>

                    {/* Status */}
                    {ai.analyzing && (
                      <p className="text-xs text-primary animate-gentle-pulse text-center">
                        Analyzing audio...
                      </p>
                    )}

                    {ai.lastAnalysis && (
                      <div
                        className={`p-3 rounded-xl text-center text-sm ${
                          ["crying", "fussing"].includes(ai.lastAnalysis.status)
                            ? "bg-destructive/10 text-destructive font-semibold"
                            : ai.lastAnalysis.status === "sleeping"
                              ? "bg-warm-green/10 text-warm-green-foreground"
                              : "bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        {ai.lastAnalysis.description}
                      </div>
                    )}

                    {/* Recent log */}
                    {ai.log.length > 1 && (
                      <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                        {ai.log.slice(1, 5).map((entry, i) => (
                          <p
                            key={i}
                            className="text-xs text-muted-foreground truncate"
                          >
                            {new Date(entry.timestamp).toLocaleTimeString()} —{" "}
                            {entry.description}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!ai.enabled && (
                  <p className="text-xs text-muted-foreground">
                    Claude Code detects sounds and notifies you when baby needs
                    attention
                  </p>
                )}
              </div>
            )}

            <Button
              variant="destructive"
              size="lg"
              onClick={() => {
                ai.stopMonitoring();
                disconnect();
              }}
              className="w-full h-14 rounded-3xl text-lg gap-2 shadow-md active:scale-[0.98] transition-all"
            >
              Disconnect
            </Button>
          </div>
        )}

        {/* Session ended by sender */}
        {sessionEnded && status === "error" && (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in-up">
            <div className="w-24 h-24 rounded-full bg-muted/50 border border-border/30 flex items-center justify-center">
              <VolumeOff className="w-12 h-12 text-muted-foreground" />
            </div>
            <div className="p-5 bg-muted/50 rounded-2xl border border-border/30 shadow-sm text-center w-full">
              <p className="text-foreground font-semibold">Session ended</p>
              <p className="text-sm text-muted-foreground mt-1">
                The monitoring session is no longer available
              </p>
            </div>
          </div>
        )}

        {/* Error State (not session ended) */}
        {error && status === "error" && !sessionEnded && (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in-up">
            <StatusIndicator status={status} />
            <div className="p-4 bg-destructive/10 text-destructive rounded-2xl text-sm text-center w-full">
              {error}
            </div>
            <Button
              size="lg"
              onClick={() => handleConnect()}
              className="w-full h-14 rounded-3xl text-lg shadow-md active:scale-[0.98] transition-all"
            >
              Try Again
            </Button>
            <Link href="/" className="w-full">
              <Button
                variant="outline"
                size="lg"
                className="w-full h-14 rounded-3xl text-lg"
              >
                Back to Home
              </Button>
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ReceiverPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gradient-warm">
          <div className="animate-gentle-pulse text-muted-foreground">
            Loading...
          </div>
        </main>
      }
    >
      <ReceiverContent />
    </Suspense>
  );
}
