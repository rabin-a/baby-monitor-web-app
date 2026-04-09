"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import type { ConnectionStatus } from "@/components/status-indicator";

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export interface ListenerInfo {
  id: string;
  ip: string;
  device: string;
  timestamp: number;
  status: "pending" | "approved" | "rejected";
}

async function postSignal(sessionId: string, type: string, payload?: string) {
  const response = await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, type, payload }),
  });
  return response.json();
}

async function getSignal(sessionId: string, type: string, extra?: string) {
  const url = `/api/signal?sessionId=${sessionId}&type=${type}${extra || ""}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

// ─── SENDER ───

export function useWebRTCSender() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [listeners, setListeners] = useState<ListenerInfo[]>([]);
  const [senderIp, setSenderIp] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const listenerPollingRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average =
      dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    const level = Math.min(100, (average / 128) * 100);
    setAudioLevel(level);
    animationRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const approveListener = useCallback(
    async (listenerId: string) => {
      if (!sessionIdRef.current) return;
      await postSignal(sessionIdRef.current, "approve", listenerId);
      setListeners((prev) =>
        prev.map((l) =>
          l.id === listenerId ? { ...l, status: "approved" as const } : l
        )
      );
    },
    []
  );

  const rejectListener = useCallback(
    async (listenerId: string) => {
      if (!sessionIdRef.current) return;
      await postSignal(sessionIdRef.current, "reject", listenerId);
      setListeners((prev) =>
        prev.map((l) =>
          l.id === listenerId ? { ...l, status: "rejected" as const } : l
        )
      );
    },
    []
  );

  // Use a ref so the reconnect callback is never stale
  const createOffer = useRef(async (sid: string) => {
    const stream = streamRef.current;
    if (!stream) return;

    // Clean up old peer connection + polling + data channel
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Clear old answer on server so we don't pick it up again
    await postSignal(sid, "answer", "");

    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    peerConnectionRef.current = pc;

    // Create data channel for sending audio level to receiver
    const dc = pc.createDataChannel("audio-level");
    dataChannelRef.current = dc;

    dc.onopen = () => {
      // Send audio level every 100ms via data channel
      audioLevelIntervalRef.current = setInterval(() => {
        if (analyserRef.current && dc.readyState === "open") {
          const dataArray = new Uint8Array(
            analyserRef.current.frequencyBinCount
          );
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg =
            dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100));
          dc.send(String(level));
        }
      }, 100);
    };

    dc.onclose = () => {
      if (audioLevelIntervalRef.current) {
        clearInterval(audioLevelIntervalRef.current);
        audioLevelIntervalRef.current = null;
      }
    };

    stream.getAudioTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });

    const iceCandidates: RTCIceCandidate[] = [];
    pc.onicecandidate = (event) => {
      if (event.candidate) iceCandidates.push(event.candidate);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        setStatus("connected");
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      } else if (
        pc.connectionState === "failed" ||
        pc.connectionState === "disconnected"
      ) {
        setStatus("waiting");
        createOffer.current(sid);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") {
        resolve();
      } else {
        const timeout = setTimeout(() => resolve(), 5000);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            clearTimeout(timeout);
            resolve();
          }
        };
      }
    });

    await postSignal(
      sid,
      "offer",
      JSON.stringify({ sdp: pc.localDescription, iceCandidates })
    );

    // Poll for answer
    pollingRef.current = setInterval(async () => {
      const data = await getSignal(sid, "answer");
      if (data?.payload && data.payload !== "") {
        try {
          const { sdp, iceCandidates: remoteIce } = JSON.parse(data.payload);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          for (const candidate of remoteIce) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch {
          // SDP mismatch — ignore stale answer
        }
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    }, 1000);
  });

  const start = useCallback(async () => {
    const newSessionId = Math.random().toString(36).substring(2, 10);
    sessionIdRef.current = newSessionId;
    setSessionId(newSessionId);
    setStatus("waiting");
    setError(null);
    setListeners([]);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;
      updateAudioLevel();

      await createOffer.current(newSessionId);

      // Poll for listeners
      listenerPollingRef.current = setInterval(async () => {
        const data = await getSignal(newSessionId, "listeners");
        if (data?.listeners) setListeners(data.listeners);
        if (data?.senderIp) setSenderIp(data.senderIp);
      }, 2000);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to start microphone"
      );
    }
  }, [updateAudioLevel]);

  const stop = useCallback(() => {
    if (sessionIdRef.current) {
      postSignal(sessionIdRef.current, "delete");
      sessionIdRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (listenerPollingRef.current) {
      clearInterval(listenerPollingRef.current);
      listenerPollingRef.current = null;
    }
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    if (dataChannelRef.current) {
      dataChannelRef.current.close();
      dataChannelRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setStatus("idle");
    setSessionId(null);
    setAudioLevel(0);
    setListeners([]);
    setSenderIp(null);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
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
  };
}

// ─── RECEIVER ───

export function useWebRTCReceiver() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [sessionEnded, setSessionEnded] = useState(false);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const sessionCheckRef = useRef<NodeJS.Timeout | null>(null);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    const average =
      dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    setAudioLevel(Math.min(100, (average / 128) * 100));
    animationRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (audioRef.current) audioRef.current.muted = next;
      return next;
    });
  }, []);

  const cleanupConnection = useCallback(() => {
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current);
      sessionCheckRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, []);

  const connect = useCallback(
    async (sessionId: string) => {
      try {
        setStatus("connecting");
        setError(null);
        setSessionEnded(false);

        // Create AudioContext NOW (during user gesture) so it's not suspended
        const audioContext = new AudioContext();
        if (audioContext.state === "suspended") await audioContext.resume();
        audioContextRef.current = audioContext;

        // Reuse listener ID from localStorage so reconnects skip approval
        const storageKey = `listener-${sessionId}`;
        let listenerId = localStorage.getItem(storageKey);
        const isReconnect = !!listenerId;
        if (!listenerId) {
          listenerId = Math.random().toString(36).substring(2, 10);
          localStorage.setItem(storageKey, listenerId);
        }

        await postSignal(sessionId, "listen-request", listenerId);

        if (!isReconnect) {
          let approved = false;
          for (let i = 0; i < 60; i++) {
            const data = await getSignal(
              sessionId,
              "approval",
              `&listenerId=${listenerId}`
            );
            if (!data) {
              setSessionEnded(true);
              throw new Error("Session ended by sender");
            }
            if (data.status === "approved") {
              approved = true;
              break;
            }
            if (data.status === "rejected") {
              throw new Error("Connection rejected by sender");
            }
            await new Promise((r) => setTimeout(r, 1000));
          }
          if (!approved) {
            throw new Error("Approval timed out — sender did not respond");
          }
        }

        // Proceed with WebRTC
        const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
        peerConnectionRef.current = pc;

        // Listen for sender's audio level data channel
        pc.ondatachannel = (event) => {
          const dc = event.channel;
          if (dc.label === "audio-level") {
            dc.onmessage = (msg) => {
              setAudioLevel(Number(msg.data) || 0);
            };
          }
        };

        pc.ontrack = async (event) => {
          const [stream] = event.streams;
          const audio = new Audio();
          audio.srcObject = stream;
          audio.muted = true;
          audioRef.current = audio;
          try {
            await audio.play();
          } catch {
            // muted playback usually succeeds
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") {
            setStatus("connected");
          } else if (
            pc.connectionState === "failed" ||
            pc.connectionState === "disconnected"
          ) {
            setStatus("error");
            setError("Connection lost");
          }
        };

        // Get the offer (retry — sender might be recreating it)
        let offerData: string | null = null;
        for (let i = 0; i < 15; i++) {
          const data = await getSignal(sessionId, "offer");
          if (!data) {
            setSessionEnded(true);
            throw new Error("Session ended by sender");
          }
          offerData = data.payload ?? null;
          if (offerData) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (!offerData) throw new Error("Session not found or expired");

        const { sdp, iceCandidates: remoteIce } = JSON.parse(offerData);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        for (const candidate of remoteIce) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        const iceCandidates: RTCIceCandidate[] = [];
        pc.onicecandidate = (event) => {
          if (event.candidate) iceCandidates.push(event.candidate);
        };

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            const timeout = setTimeout(() => resolve(), 5000);
            pc.onicegatheringstatechange = () => {
              if (pc.iceGatheringState === "complete") {
                clearTimeout(timeout);
                resolve();
              }
            };
          }
        });

        await postSignal(
          sessionId,
          "answer",
          JSON.stringify({ sdp: pc.localDescription, iceCandidates })
        );

        // Periodically check if session still exists
        sessionCheckRef.current = setInterval(async () => {
          const data = await getSignal(sessionId, "offer");
          if (!data) {
            cleanupConnection();
            setSessionEnded(true);
            setStatus("error");
            setError("Monitoring session ended by sender");
          }
        }, 5000);
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to connect");
      }
    },
    [updateAudioLevel, cleanupConnection]
  );

  const disconnect = useCallback(() => {
    cleanupConnection();
    setStatus("idle");
    setAudioLevel(0);
    setMuted(true);
  }, [cleanupConnection]);

  useEffect(() => {
    return () => {
      cleanupConnection();
    };
  }, [cleanupConnection]);

  return {
    status,
    audioLevel,
    error,
    muted,
    sessionEnded,
    connect,
    disconnect,
    toggleMute,
  };
}
