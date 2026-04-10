#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baby Monitor AI - local bridge using Claude Code CLI for audio analysis.

Runs a small HTTP server that receives audio from the baby monitor
receiver page, saves it to /tmp/baby-monitor/, and pipes it to
claude CLI for classification.

Usage:
    python3 baby-monitor-ai.py

Requires:
    - Claude Code CLI installed (claude command available)
    - Same network as the baby monitor sender
"""

import argparse
import json
import base64
import os
import subprocess
import sys
import shutil
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DEFAULT_PORT = 9877
AUDIO_DIR = "/tmp/baby-monitor"


class BridgeHandler(BaseHTTPRequestHandler):
    monitoring_mode = "notify_crying"

    def log_message(self, format, *args):
        print(f"[baby-monitor-ai] {args[0]}")

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _respond(self, code, data):
        try:
            self.send_response(code)
            self._cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data).encode())
        except BrokenPipeError:
            pass

    def do_OPTIONS(self):
        try:
            self.send_response(204)
            self._cors_headers()
            self.end_headers()
        except BrokenPipeError:
            pass

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/config" and "mode" in params:
            BridgeHandler.monitoring_mode = params["mode"][0]
            self._respond(200, {"mode": BridgeHandler.monitoring_mode})
            return

        self._respond(200, {
            "alive": True,
            "service": "baby-monitor-ai",
            "mode": BridgeHandler.monitoring_mode,
        })

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
            audio_b64 = data.get("audio", "")
            content_type = data.get("contentType", "audio/webm")

            if not audio_b64:
                self._respond(400, {"error": "No audio data"})
                return

            suffix = ".webm" if "webm" in content_type else ".wav"
            audio_path = os.path.join(AUDIO_DIR, f"capture{suffix}")

            # Write audio to /tmp/baby-monitor/
            os.makedirs(AUDIO_DIR, exist_ok=True)
            with open(audio_path, "wb") as f:
                f.write(base64.b64decode(audio_b64))

            print(f"[baby-monitor-ai] Saved {os.path.getsize(audio_path)} bytes to {audio_path}")

            prompt = (
                f"I have a baby monitor audio recording at {audio_path}. "
                f"Read this file. Monitoring mode: {BridgeHandler.monitoring_mode}. "
                "Classify what you hear. "
                'Respond with ONLY a JSON object: '
                '{"status": "sleeping"|"crying"|"fussing"|"babbling"|"coughing"|"noise", '
                '"confidence": "high"|"medium"|"low", '
                '"description": "brief one-line description"}'
            )

            print(f"[baby-monitor-ai] Calling claude CLI...")

            result = subprocess.run(
                ["claude", "-p", prompt, "--allowedTools", "Read"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            output = result.stdout.strip()
            print(f"[baby-monitor-ai] Claude: {output[:200]}")

            # Clean up audio file
            try:
                os.unlink(audio_path)
            except OSError:
                pass

            # Parse JSON from output
            try:
                start = output.index("{")
                end = output.rindex("}") + 1
                analysis = json.loads(output[start:end])
            except (ValueError, json.JSONDecodeError):
                analysis = {
                    "status": "noise",
                    "confidence": "low",
                    "description": output[:200] if output else "No response",
                }

            self._respond(200, analysis)

        except subprocess.TimeoutExpired:
            print("[baby-monitor-ai] Claude CLI timed out")
            self._respond(500, {"error": "Analysis timed out"})
        except Exception as e:
            print(f"[baby-monitor-ai] Error: {e}")
            self._respond(500, {"error": str(e)})


def main():
    parser = argparse.ArgumentParser(description="Baby Monitor AI Bridge")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    # Check claude CLI is available
    if not shutil.which("claude"):
        print("Error: 'claude' CLI not found. Install Claude Code first.")
        print("  npm install -g @anthropic-ai/claude-code")
        sys.exit(1)

    # Create audio dir
    os.makedirs(AUDIO_DIR, exist_ok=True)

    server = HTTPServer(("0.0.0.0", args.port), BridgeHandler)
    print(f"[baby-monitor-ai] Running on http://0.0.0.0:{args.port}")
    print(f"[baby-monitor-ai] Audio dir: {AUDIO_DIR}")
    print(f"[baby-monitor-ai] Mode: {BridgeHandler.monitoring_mode}")
    print(f"[baby-monitor-ai] Open babymonitor.online/receiver to connect")
    print(f"[baby-monitor-ai] Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[baby-monitor-ai] Stopped")
        # Clean up audio dir
        shutil.rmtree(AUDIO_DIR, ignore_errors=True)
        server.server_close()


if __name__ == "__main__":
    main()
