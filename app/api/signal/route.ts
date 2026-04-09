import { NextRequest, NextResponse } from "next/server";

interface SignalData {
  payload: string;
  timestamp: number;
}

interface SessionData {
  offer?: SignalData;
  answer?: SignalData;
  ice?: SignalData[];
}

// Persist across HMR reloads in dev mode
const globalForSignal = globalThis as typeof globalThis & {
  __signalSessions?: Map<string, SessionData>;
};
if (!globalForSignal.__signalSessions) {
  globalForSignal.__signalSessions = new Map<string, SessionData>();
}
const sessions = globalForSignal.__signalSessions;

// Session expiry time (2 minutes)
const SESSION_EXPIRY_MS = 2 * 60 * 1000;

// Clean up expired sessions
function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, data] of sessions.entries()) {
    const lastActivity = Math.max(
      data.offer?.timestamp ?? 0,
      data.answer?.timestamp ?? 0,
      ...(data.ice?.map((i) => i.timestamp) ?? [0])
    );
    if (now - lastActivity > SESSION_EXPIRY_MS) {
      sessions.delete(sessionId);
    }
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

    // Clean up expired sessions
    cleanupExpiredSessions();

    // Get or create session
    let session = sessions.get(sessionId);
    if (!session) {
      session = {};
      sessions.set(sessionId, session);
    }

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
        if (!session.ice) {
          session.ice = [];
        }
        session.ice.push(signalData);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid signal type" },
          { status: 400 }
        );
    }

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

  // Clean up expired sessions
  cleanupExpiredSessions();

  const session = sessions.get(sessionId);
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
      payload = session.ice ? JSON.stringify(session.ice.map((i) => i.payload)) : null;
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
