"use client";

import { useCallback, useRef, useState } from "react";

export interface AIAnalysis {
  status: "sleeping" | "crying" | "fussing" | "babbling" | "coughing" | "noise";
  confidence: "high" | "medium" | "low";
  description: string;
  timestamp: number;
}

const AI_BRIDGE_PORT = 9877;
const SOUND_THRESHOLD = 8; // audio level 0-100 — above this = "sound detected"
const BUFFER_DURATION = 5000; // 5 seconds of audio to send
const COOLDOWN = 10000; // 10 seconds between analyses

export function useAIMonitor() {
  const [available, setAvailable] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<AIAnalysis | null>(null);
  const [mode, setMode] = useState("notify_crying");
  const [log, setLog] = useState<AIAnalysis[]>([]);

  const bridgeUrlRef = useRef<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingRef = useRef(false);
  const cooldownRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  // Check if the AI bridge is running on the local network
  const detectBridge = useCallback(async () => {
    // Try localhost first (same machine)
    const urls = [`http://localhost:${AI_BRIDGE_PORT}`];

    // Also try the page's hostname (if accessing via LAN IP)
    const hostname = window.location.hostname;
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
      urls.push(`http://${hostname}:${AI_BRIDGE_PORT}`);
    }

    for (const url of urls) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        const data = await res.json();
        if (data.service === "baby-monitor-ai") {
          bridgeUrlRef.current = url;
          setAvailable(true);
          setMode(data.mode || "notify_crying");
          return true;
        }
      } catch {
        // Not available at this URL
      }
    }
    setAvailable(false);
    return false;
  }, []);

  // Start monitoring — pass the audio stream from WebRTC
  const startMonitoring = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    setEnabled(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    recordingRef.current = false;
    streamRef.current = null;
    setEnabled(false);
    setAnalyzing(false);
  }, []);

  // Called by the receiver when audio level changes
  // Triggers recording when sound is above threshold
  const onAudioLevel = useCallback(
    (level: number) => {
      if (!enabled || !streamRef.current || cooldownRef.current) return;

      if (level > SOUND_THRESHOLD && !recordingRef.current) {
        // Sound detected — start recording
        recordingRef.current = true;
        chunksRef.current = [];

        try {
          const recorder = new MediaRecorder(streamRef.current, {
            mimeType: "audio/webm;codecs=opus",
          });
          mediaRecorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
          };

          recorder.onstop = async () => {
            recordingRef.current = false;
            if (chunksRef.current.length === 0) return;

            const blob = new Blob(chunksRef.current, { type: "audio/webm" });
            chunksRef.current = [];
            await analyzeAudio(blob);
          };

          recorder.start();

          // Stop after BUFFER_DURATION
          setTimeout(() => {
            if (recorder.state === "recording") {
              recorder.stop();
            }
          }, BUFFER_DURATION);
        } catch {
          recordingRef.current = false;
        }
      }
    },
    [enabled]
  );

  const analyzeAudio = async (blob: Blob) => {
    if (!bridgeUrlRef.current) return;

    setAnalyzing(true);
    cooldownRef.current = true;

    try {
      // Convert blob to base64
      const buffer = await blob.arrayBuffer();
      const b64 = btoa(
        new Uint8Array(buffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      const res = await fetch(`${bridgeUrlRef.current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audio: b64,
          contentType: blob.type,
        }),
      });

      const analysis: AIAnalysis = {
        ...(await res.json()),
        timestamp: Date.now(),
      };

      setLastAnalysis(analysis);
      setLog((prev) => [analysis, ...prev].slice(0, 50));

      // Browser notification for concerning events
      if (
        (mode === "notify_crying" &&
          ["crying", "fussing"].includes(analysis.status)) ||
        (mode === "notify_any" && analysis.status !== "sleeping")
      ) {
        if (Notification.permission === "granted") {
          new Notification("Baby Monitor AI", {
            body: analysis.description,
            icon: "/icon-192x192.png",
            tag: "baby-monitor-ai",
          });
        }
      }
    } catch {
      // Bridge unavailable
    }

    setAnalyzing(false);
    setTimeout(() => {
      cooldownRef.current = false;
    }, COOLDOWN);
  };

  const changeMode = useCallback(
    async (newMode: string) => {
      setMode(newMode);
      if (bridgeUrlRef.current) {
        try {
          await fetch(`${bridgeUrlRef.current}/config?mode=${newMode}`);
        } catch {
          // Bridge might be unavailable
        }
      }
    },
    []
  );

  return {
    available,
    enabled,
    analyzing,
    lastAnalysis,
    mode,
    log,
    detectBridge,
    startMonitoring,
    stopMonitoring,
    onAudioLevel,
    changeMode,
  };
}
