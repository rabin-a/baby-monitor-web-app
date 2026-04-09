"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import type { ConnectionStatus } from "@/components/status-indicator";

const STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

interface SignalMessage {
  type: "offer" | "answer" | "ice";
  payload: string;
}

async function sendSignal(
  sessionId: string,
  type: SignalMessage["type"],
  payload: string
) {
  const response = await fetch("/api/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, type, payload }),
  });
  return response.json();
}

async function pollSignal(sessionId: string, type: SignalMessage["type"]) {
  const response = await fetch(
    `/api/signal?sessionId=${sessionId}&type=${type}`
  );
  if (!response.ok) return null;
  const data = await response.json();
  return data.payload || null;
}

export function useWebRTCSender() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average =
      dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    setAudioLevel(Math.min(100, (average / 128) * 100));

    animationRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const start = useCallback(async () => {
    try {
      setStatus("connecting");
      setError(null);

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Set up audio level analysis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;
      updateAudioLevel();

      // Create peer connection
      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      peerConnectionRef.current = pc;

      // Add audio track
      stream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Generate session ID
      const newSessionId = Math.random().toString(36).substring(2, 10);
      setSessionId(newSessionId);

      // Handle ICE candidates
      const iceCandidates: RTCIceCandidate[] = [];
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          iceCandidates.push(event.candidate);
        }
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
          setStatus("error");
          setError("Connection lost");
        }
      };

      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === "complete") {
              resolve();
            }
          };
        }
      });

      // Send offer with ICE candidates
      await sendSignal(
        newSessionId,
        "offer",
        JSON.stringify({
          sdp: pc.localDescription,
          iceCandidates,
        })
      );

      setStatus("waiting");

      // Poll for answer
      pollingRef.current = setInterval(async () => {
        const answerData = await pollSignal(newSessionId, "answer");
        if (answerData) {
          const { sdp, iceCandidates: remoteIceCandidates } =
            JSON.parse(answerData);
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));

          for (const candidate of remoteIceCandidates) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }

          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }, 1000);
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to start microphone"
      );
    }
  }, [updateAudioLevel]);

  const stop = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
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
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setStatus("idle");
    setSessionId(null);
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { status, sessionId, audioLevel, error, start, stop };
}

export function useWebRTCReceiver() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationRef = useRef<number | null>(null);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    const average =
      dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
    setAudioLevel(Math.min(100, (average / 128) * 100));

    animationRef.current = requestAnimationFrame(updateAudioLevel);
  }, []);

  const connect = useCallback(
    async (sessionId: string) => {
      try {
        setStatus("connecting");
        setError(null);

        // Create peer connection
        const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
        peerConnectionRef.current = pc;

        // Handle incoming audio track
        pc.ontrack = (event) => {
          const [stream] = event.streams;

          // Create audio element for playback
          const audio = new Audio();
          audio.srcObject = stream;
          audio.autoplay = true;
          audioRef.current = audio;

          // Set up audio level analysis
          const audioContext = new AudioContext();
          audioContextRef.current = audioContext;
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 256;
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          analyserRef.current = analyser;
          updateAudioLevel();
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

        // Get the offer
        const offerData = await pollSignal(sessionId, "offer");
        if (!offerData) {
          throw new Error("Session not found or expired");
        }

        const { sdp, iceCandidates: remoteIceCandidates } =
          JSON.parse(offerData);

        // Set remote description
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));

        // Add remote ICE candidates
        for (const candidate of remoteIceCandidates) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }

        // Create answer
        const iceCandidates: RTCIceCandidate[] = [];
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            iceCandidates.push(event.candidate);
          }
        };

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Wait for ICE gathering
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            pc.onicegatheringstatechange = () => {
              if (pc.iceGatheringState === "complete") {
                resolve();
              }
            };
          }
        });

        // Send answer
        await sendSignal(
          sessionId,
          "answer",
          JSON.stringify({
            sdp: pc.localDescription,
            iceCandidates,
          })
        );
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : "Failed to connect");
      }
    },
    [updateAudioLevel]
  );

  const disconnect = useCallback(() => {
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
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    setStatus("idle");
    setAudioLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return { status, audioLevel, error, connect, disconnect };
}
