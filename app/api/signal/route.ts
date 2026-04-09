import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

interface SignalData {
  payload: string;
  timestamp: number;
}

interface SessionData {
  offer?: SignalData;
  answer?: SignalData;
  ice?: SignalData[];
}

// --- Storage layer: Redis when deployed, in-memory for local dev ---

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

// In-memory fallback for local dev (persists across HMR reloads)
const globalForSignal = globalThis as typeof globalThis & {
  __signalSessions?: Map<string, SessionData>;
};
if (!globalForSignal.__signalSessions) {
  globalForSignal.__signalSessions = new Map<string, SessionData>();
}
const localSessions = globalForSignal.__signalSessions;

const SESSION_TTL_SECONDS = 120; // 2 minutes

async function getSession(sessionId: string): Promise<SessionData | null> {
  if (redis) {
    return await redis.get<SessionData>(`signal:${sessionId}`);
  }
  return localSessions.get(sessionId) ?? null;
}

async function setSession(sessionId: string, data: SessionData): Promise<void> {
  if (redis) {
    await redis.set(`signal:${sessionId}`, data, { ex: SESSION_TTL_SECONDS });
  } else {
    localSessions.set(sessionId, data);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, type, payload } = body;

    if (!sessionId || !type || !payload) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const session = (await getSession(sessionId)) ?? {};

    const signalData: SignalData = {
      payload,
      timestamp: Date.now(),
    };

    switch (type) {
      case "offer":
        session.offer = signalData;
        break;
      case "answer":
        session.answer = signalData;
        break;
      case "ice":
        if (!session.ice) session.ice = [];
        session.ice.push(signalData);
        break;
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

  let payload: string | null = null;

  switch (type) {
    case "offer":
      payload = session.offer?.payload ?? null;
      break;
    case "answer":
      payload = session.answer?.payload ?? null;
      break;
    case "ice":
      payload = session.ice
        ? JSON.stringify(session.ice.map((i) => i.payload))
        : null;
      break;
    default:
      return NextResponse.json(
        { error: "Invalid signal type" },
        { status: 400 }
      );
  }

  if (!payload) {
    return NextResponse.json({ payload: null });
  }

  return NextResponse.json({ payload });
}
