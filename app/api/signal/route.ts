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
  locked?: boolean; // true after first approval — no new listeners accepted
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
    await redis.del(`signal:${sessionId}`);
  } else {
    localSessions.delete(sessionId);
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

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
        if (type === "offer") session.offer = signalData;
        else if (type === "answer") session.answer = signalData;
        else {
          if (!session.ice) session.ice = [];
          session.ice.push(signalData);
        }
        break;
      }

      case "listen-request": {
        const ip = getClientIp(request);
        const ua = request.headers.get("user-agent") || "";
        const listenerId =
          payload || Math.random().toString(36).substring(2, 10);
        if (!session.listeners) session.listeners = [];

        const existing = session.listeners.find((l) => l.id === listenerId);
        if (existing) {
          // Same listener reconnecting — auto-approve if previously approved
          if (existing.status === "approved") {
            // Clear old answer so fresh WebRTC handshake can happen
            session.answer = undefined;
          }
          break;
        }

        // Session is locked after first approval — reject new listeners
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
            session.locked = true; // Lock session — no new listeners
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

  if (!sessionId || !type) {
    return NextResponse.json(
      { error: "Missing required parameters" },
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
