import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      // Skip internal and non-IPv4
      if (iface.internal || iface.family !== "IPv4") continue;
      addresses.push(iface.address);
    }
  }

  return NextResponse.json({ addresses });
}
