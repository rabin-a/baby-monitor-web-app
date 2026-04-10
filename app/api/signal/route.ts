import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

interface SignalData {
  payload: string;
  timestamp: number;
}

interface ListenerInfo {
  id: string;
  ip: string;
  device: string;
  timestamp: number;
  status: "pending" | "approved" | "rejected";
}

interface SessionData {
  offer?: SignalData;
  answer?: SignalData;
  ice?: SignalData[];
  listeners?: ListenerInfo[];
  locked?: boolean;
  senderIp?: string;
  networkOnly?: boolean;
  babyName?: string;
  pin?: string;
}

// --- Storage layer ---

const redis =
  process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    ? new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
      })
    : null;

const globalForSignal = globalThis as typeof globalThis & {
  __signalSessions?: Map<string, SessionData>;
};
if (!globalForSignal.__signalSessions) {
  globalForSignal.__signalSessions = new Map<string, SessionData>();
}
const localSessions = globalForSignal.__signalSessions;

const SESSION_TTL_SECONDS = 1800; // 30 minutes

async function getSession(sessionId: string): Promise<SessionData | null> {
  if (redis) {
    return await redis.get<SessionData>(`signal:${sessionId}`);
  }
  return localSessions.get(sessionId) ?? null;
}

async function setSession(
  sessionId: string,
  data: SessionData
): Promise<void> {
  if (redis) {
    await redis.set(`signal:${sessionId}`, data, { ex: SESSION_TTL_SECONDS });
  } else {
    localSessions.set(sessionId, data);
  }
}

async function deleteSession(sessionId: string): Promise<void> {
  if (redis) {
    // Remove from discovery index
    const session = await getSession(sessionId);
    if (session?.senderIp) {
      await redis.srem(`discover:${session.senderIp}`, sessionId);
    }
    await redis.del(`signal:${sessionId}`);
  } else {
    localSessions.delete(sessionId);
  }
}

async function addToDiscoveryIndex(
  senderIp: string,
  sessionId: string
): Promise<void> {
  if (redis) {
    await redis.sadd(`discover:${senderIp}`, sessionId);
    await redis.expire(`discover:${senderIp}`, SESSION_TTL_SECONDS);
  }
  // In-memory: no index needed, we iterate the Map
}

async function getDiscoverableSessions(
  ip: string
): Promise<{ sessionId: string; babyName: string }[]> {
  const results: { sessionId: string; babyName: string }[] = [];

  if (redis) {
    const sessionIds = await redis.smembers(`discover:${ip}`);
    for (const sid of sessionIds) {
      const session = await getSession(sid as string);
      if (session?.networkOnly && session.senderIp === ip) {
        results.push({
          sessionId: sid as string,
          babyName: session.babyName || "Baby Monitor",
        });
      }
    }
  } else {
    for (const [sid, session] of localSessions.entries()) {
      if (session.networkOnly && session.senderIp === ip) {
        results.push({
          sessionId: sid,
          babyName: session.babyName || "Baby Monitor",
        });
      }
    }
  }

  return results;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

// In local dev (no proxy), all clients get "local" as IP — they always match.
// On Vercel, x-forwarded-for provides the real public IP.

function parseDevice(ua: string): string {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown device";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, type, payload } = body;

    if (!sessionId || !type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const session = (await getSession(sessionId)) ?? {};

    switch (type) {
      case "offer":
      case "answer":
      case "ice": {
        if (!payload) {
          return NextResponse.json(
            { error: "Missing payload" },
            { status: 400 }
          );
        }
        const signalData: SignalData = { payload, timestamp: Date.now() };
        if (type === "offer") {
          session.offer = signalData;
          session.senderIp = getClientIp(request);
        } else if (type === "answer") session.answer = signalData;
        else {
          if (!session.ice) session.ice = [];
          session.ice.push(signalData);
        }
        break;
      }

      case "network-only": {
        session.networkOnly = true;
        if (session.senderIp) {
          await addToDiscoveryIndex(session.senderIp, sessionId);
        }
        break;
      }

      case "set-metadata": {
        const meta = payload ? JSON.parse(payload) : {};
        if (meta.babyName) session.babyName = meta.babyName;
        if (meta.pin) session.pin = meta.pin;
        // Add to discovery index if networkOnly
        if (session.networkOnly && session.senderIp) {
          await addToDiscoveryIndex(session.senderIp, sessionId);
        }
        break;
      }

      case "listen-request": {
        const ip = getClientIp(request);
        const ua = request.headers.get("user-agent") || "";

        // Parse payload: "listenerId" or "listenerId:pin"
        const parts = (payload || "").split(":");
        const listenerId = parts[0] || Math.random().toString(36).substring(2, 10);
        const submittedPin = parts[1] || "";

        if (!session.listeners) session.listeners = [];

        // Network restriction
        if (session.networkOnly && session.senderIp && ip !== session.senderIp) {
          await setSession(sessionId, session);
          return NextResponse.json(
            { error: "Session not found" },
            { status: 404 }
          );
        }

        // PIN check — wrong PIN returns 404 (don't reveal session exists)
        if (session.pin && session.pin !== submittedPin) {
          // Allow previously approved listeners to reconnect without PIN
          const existing = session.listeners.find((l) => l.id === listenerId);
          if (!existing || existing.status !== "approved") {
            await setSession(sessionId, session);
            return NextResponse.json(
              { error: "Session not found" },
              { status: 404 }
            );
          }
        }

        const existing = session.listeners.find((l) => l.id === listenerId);
        if (existing) {
          if (existing.status === "approved") {
            session.answer = undefined;
          }
          break;
        }

        if (session.locked) {
          session.listeners.push({
            id: listenerId,
            ip,
            device: parseDevice(ua),
            timestamp: Date.now(),
            status: "rejected",
          });
          break;
        }

        session.listeners.push({
          id: listenerId,
          ip,
          device: parseDevice(ua),
          timestamp: Date.now(),
          status: "pending",
        });
        break;
      }

      case "approve":
      case "reject": {
        const listenerId = payload;
        if (!listenerId || !session.listeners) {
          return NextResponse.json(
            { error: "Listener not found" },
            { status: 404 }
          );
        }
        const listener = session.listeners.find((l) => l.id === listenerId);
        if (listener) {
          listener.status = type === "approve" ? "approved" : "rejected";
          if (type === "approve") {
            session.locked = true;
          }
        }
        break;
      }

      case "delete": {
        await deleteSession(sessionId);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: "Invalid signal type" },
          { status: 400 }
        );
    }

    await setSession(sessionId, session);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const type = searchParams.get("type");

  if (!type) {
    return NextResponse.json(
      { error: "Missing required parameters" },
      { status: 400 }
    );
  }

  // Discovery endpoint — no sessionId needed
  if (type === "discover") {
    const clientIp = getClientIp(request);
    const sessions = await getDiscoverableSessions(clientIp);
    return NextResponse.json({ sessions });
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing sessionId" },
      { status: 400 }
    );
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    );
  }

  // For receiver-facing endpoints, enforce network restriction
  const receiverTypes = ["offer", "approval", "audio-level"];
  if (
    session.networkOnly &&
    session.senderIp &&
    receiverTypes.includes(type)
  ) {
    const clientIp = getClientIp(request);
    if (clientIp !== session.senderIp) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }
  }

  switch (type) {
    case "offer":
      return NextResponse.json({
        payload: session.offer?.payload ?? null,
      });
    case "answer":
      return NextResponse.json({
        payload: session.answer?.payload ?? null,
      });
    case "ice":
      return NextResponse.json({
        payload: session.ice
          ? JSON.stringify(session.ice.map((i) => i.payload))
          : null,
      });
    case "listeners":
      return NextResponse.json({
        listeners: session.listeners ?? [],
        senderIp: session.senderIp ?? null,
      });
    case "approval": {
      const listenerId = searchParams.get("listenerId");
      const listener = session.listeners?.find((l) => l.id === listenerId);
      return NextResponse.json({
        status: listener?.status ?? "unknown",
      });
    }
    default:
      return NextResponse.json(
        { error: "Invalid signal type" },
        { status: 400 }
      );
  }
}
