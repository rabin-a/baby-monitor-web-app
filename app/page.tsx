"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusIndicator } from "@/components/status-indicator";
import { AudioWaveform } from "@/components/audio-waveform";
import { QRDisplay } from "@/components/qr-display";
import { useWebRTCSender } from "@/hooks/use-webrtc";
import type { ListenerInfo } from "@/hooks/use-webrtc";
import Link from "next/link";
import {
  Baby,
  Check,
  Globe,
  Mic,
  MicOff,
  Radar,
  Smartphone,
  Square,
  Users,
  Wifi,
  X,
} from "lucide-react";

export default function HomePage() {
  const {
    status,
    sessionId,
    audioLevel,
    error,
    listeners,
    senderIp,
    start,
    stop,
    approveListener,
    rejectListener,
  } = useWebRTCSender();
  const [receiverUrl, setReceiverUrl] = useState<string | null>(null);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [networkOnly, setNetworkOnly] = useState(true);
  const [babyName, setBabyName] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("babymonitor-name") || ""
      : ""
  );
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      fetch("/api/network")
        .then((res) => res.json())
        .then((data) => {
          if (data.addresses?.length > 0) setLocalIp(data.addresses[0]);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setReceiverUrl(null);
      return;
    }
    const hostname = window.location.hostname;
    if ((hostname === "localhost" || hostname === "127.0.0.1") && localIp) {
      const port = window.location.port;
      setReceiverUrl(
        `http://${localIp}${port ? `:${port}` : ""}/receiver?session=${sessionId}`
      );
    } else {
      setReceiverUrl(`${window.location.origin}/receiver?session=${sessionId}`);
    }
  }, [sessionId, localIp]);

  const pendingListeners = listeners.filter((l) => l.status === "pending");
  const approvedListeners = listeners.filter((l) => l.status === "approved");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-gradient-warm">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        {/* Logo / Title — full on idle, compact on monitoring */}
        {status === "idle" ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-warm-amber/10 flex items-center justify-center shadow-lg shadow-primary/10 animate-glow-pulse">
              <Baby className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Baby Monitor
            </h1>
            <p className="text-muted-foreground text-sm max-w-xs text-balance leading-relaxed">
              Privacy-first audio monitoring. Secure peer-to-peer, no accounts needed.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-warm-amber/10 flex items-center justify-center shadow-sm">
              <Baby className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-lg font-bold tracking-tight text-foreground">
              Baby Monitor
            </h1>
          </div>
        )}

        {/* Idle */}
        {status === "idle" && (
          <div className="w-full flex flex-col gap-5 animate-fade-in-up">
            {/* Network restriction toggle — pill shape */}
            <div className="w-full flex rounded-full bg-muted/60 p-1">
              <button
                onClick={() => setNetworkOnly(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-sm font-medium transition-all duration-300 ${
                  networkOnly
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Wifi className="w-4 h-4" />
                Same network
              </button>
              <button
                onClick={() => setNetworkOnly(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-sm font-medium transition-all duration-300 ${
                  !networkOnly
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe className="w-4 h-4" />
                Any network
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {networkOnly
                ? "Only devices on the same WiFi can connect"
                : "Any device with the link can request to connect"}
            </p>

            {/* Baby name — optional, remembered */}
            <Input
              type="text"
              placeholder="Baby name (optional, e.g., Emma's Room)"
              value={babyName}
              onChange={(e) => {
                setBabyName(e.target.value);
                localStorage.setItem("babymonitor-name", e.target.value);
              }}
              className="h-12 rounded-2xl border-border/50 shadow-sm"
            />

            {/* Optional PIN toggle + input */}
            {!showPin ? (
              <button
                onClick={() => setShowPin(true)}
                className="text-xs text-primary font-medium hover:underline"
              >
                + Add a PIN for extra security
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground text-center">
                  Enter a 4-digit PIN (required to connect)
                </p>
                <div className="flex justify-center gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <input
                      key={i}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={pin[i] || ""}
                      onChange={(e) => {
                        const digit = e.target.value.replace(/\D/g, "");
                        const newPin = pin.split("");
                        newPin[i] = digit;
                        setPin(newPin.join("").slice(0, 4));
                        if (digit && i < 3) {
                          const next = e.target
                            .parentElement?.children[i + 1] as HTMLInputElement;
                          next?.focus();
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !pin[i] && i > 0) {
                          const prev = (e.target as HTMLElement)
                            .parentElement?.children[i - 1] as HTMLInputElement;
                          prev?.focus();
                        }
                      }}
                      className="w-14 h-14 text-center text-2xl font-bold rounded-2xl border border-border/50 bg-card shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  ))}
                </div>
                <button
                  onClick={() => {
                    setShowPin(false);
                    setPin("");
                  }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Remove PIN
                </button>
              </div>
            )}

            <Button
              size="lg"
              onClick={() =>
                start(
                  networkOnly,
                  babyName.trim() || undefined,
                  showPin && pin.length === 4 ? pin : undefined
                )
              }
              disabled={showPin && pin.length !== 4}
              className="group w-full h-16 text-lg rounded-3xl gap-3 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 active:scale-[0.98] transition-all duration-200"
            >
              <Mic className="w-6 h-6 group-hover:scale-110 transition-transform" />
              Start Monitoring
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3 w-full">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            {/* Find nearby monitors */}
            <Link href="/receiver" className="w-full">
              <Button
                variant="outline"
                size="lg"
                className="w-full h-14 rounded-3xl text-lg gap-2"
              >
                <Radar className="w-5 h-5" />
                Find nearby monitors
              </Button>
            </Link>
          </div>
        )}

        {/* Waiting / Connected */}
        {(status === "waiting" || status === "connected") && (
          <div className="flex flex-col items-center gap-6 w-full animate-fade-in-up">
            {status === "waiting" && receiverUrl && (
              <QRDisplay url={receiverUrl} status="waiting" babyName={babyName.trim() || undefined} />
            )}

            {status === "connected" && (
              <>
                <StatusIndicator status={status} />
                <div className="w-full p-5 bg-warm-green/10 border border-warm-green/20 rounded-2xl text-center animate-fade-in-up">
                  <p className="text-warm-green-foreground font-semibold">
                    Parent device connected!
                  </p>
                  <p className="text-sm text-warm-green-foreground/70 mt-1">
                    Audio is now streaming
                  </p>
                </div>
              </>
            )}

            {/* Pending listener requests */}
            {pendingListeners.length > 0 && (
              <div className="w-full flex flex-col gap-3 animate-fade-in-up">
                <p className="text-sm font-semibold text-foreground">
                  Connection requests:
                </p>
                {pendingListeners.map((l) => (
                  <ListenerCard
                    key={l.id}
                    listener={l}
                    sameNetwork={!!senderIp && l.ip === senderIp}
                    onApprove={() => approveListener(l.id)}
                    onReject={() => rejectListener(l.id)}
                  />
                ))}
              </div>
            )}

            {/* Approved / active listeners */}
            {approvedListeners.length > 0 && (
              <div className="w-full p-4 bg-card rounded-2xl border border-border/50 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Listening ({approvedListeners.length})
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {approvedListeners.map((l) => (
                    <div
                      key={l.id}
                      className="flex items-center justify-between text-xs text-muted-foreground"
                    >
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-3 h-3" />
                        <span>{l.device}</span>
                      </div>
                      <span className="font-mono">{l.ip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audio Waveform */}
            <div className="w-full p-6 bg-card rounded-3xl border border-border/50 shadow-sm">
              <p className="text-sm font-medium text-muted-foreground text-center mb-4">
                Audio Level
              </p>
              <AudioWaveform level={audioLevel} />
            </div>

            <Button
              variant="destructive"
              size="lg"
              onClick={stop}
              className="w-full h-14 rounded-3xl text-lg gap-2 shadow-md active:scale-[0.98] transition-all"
            >
              <Square className="w-5 h-5" />
              Stop
            </Button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="w-full p-4 bg-destructive/10 text-destructive rounded-2xl text-sm text-center animate-fade-in-up">
            {error}
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center gap-4 animate-fade-in-up">
            <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
              <MicOff className="w-10 h-10 text-destructive" />
            </div>
            <Button
              size="lg"
              onClick={() => start()}
              className="h-14 px-8 rounded-3xl text-lg gap-2 shadow-md active:scale-[0.98] transition-all"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Footer */}
        <footer className="flex items-center justify-center gap-4 pt-4 border-t border-border/30 text-xs text-muted-foreground">
          <a
            href="/privacy"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>
          <span>|</span>
          <a
            href="https://github.com/rabin-a/baby-monitor-web-app"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}

function ListenerCard({
  listener,
  sameNetwork,
  onApprove,
  onReject,
}: {
  listener: ListenerInfo;
  sameNetwork: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="w-full p-4 bg-warm-amber/10 border border-warm-amber/20 rounded-2xl shadow-sm animate-fade-in-up">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-warm-amber-foreground" />
          <span className="text-sm font-medium text-foreground">
            {listener.device}
          </span>
        </div>
        {sameNetwork && (
          <span className="text-xs bg-warm-green/15 text-warm-green-foreground px-2.5 py-0.5 rounded-full font-medium">
            Same network
          </span>
        )}
      </div>
      <p className="text-xs font-mono text-muted-foreground mb-3">
        {listener.ip}
      </p>
      <div className="flex gap-3">
        <Button
          onClick={onApprove}
          className="flex-1 h-10 gap-1.5 bg-warm-green hover:bg-warm-green/90 text-white rounded-xl"
        >
          <Check className="w-4 h-4" />
          Allow
        </Button>
        <Button
          variant="destructive"
          onClick={onReject}
          className="flex-1 h-10 gap-1.5 rounded-xl"
        >
          <X className="w-4 h-4" />
          Reject
        </Button>
      </div>
    </div>
  );
}
