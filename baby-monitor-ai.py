#!/usr/bin/env python3
"""
Baby Monitor AI — local bridge to Claude Code CLI.

Runs a small HTTP server that receives audio from the baby monitor
receiver page and pipes it to Claude for classification.

Usage:
    python baby-monitor-ai.py
    python baby-monitor-ai.py --port 9877

Requires:
    - Claude Code CLI installed (`claude` command available)
    - Same network as the baby monitor sender
"""

import argparse
import json
import subprocess
import tempfile
import os
import base64
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DEFAULT_PORT = 9877

SYSTEM_PROMPT = """You are monitoring a baby via an audio baby monitor.
Analyze the audio and classify what you hear. Respond with ONLY a JSON object:

{"status": "sleeping" | "crying" | "fussing" | "babbling" | "coughing" | "noise", "confidence": "high" | "medium" | "low", "description": "brief one-line description"}

Rules:
- "sleeping" = silence or very quiet background noise
- "crying" = distressed baby crying
- "fussing" = mild whimpering or unsettled sounds
- "babbling" = happy baby sounds, cooing, talking
- "coughing" = coughing or sneezing
- "noise" = non-baby sounds (TV, adults talking, etc.)
"""


class BridgeHandler(BaseHTTPRequestHandler):
    monitoring_mode = "notify_crying"  # default

    def log_message(self, format, *args):
        # Quieter logging
        print(f"[baby-monitor-ai] {args[0]}")

    def _cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        """Health check + config endpoint"""
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path == "/config" and "mode" in params:
            BridgeHandler.monitoring_mode = params["mode"][0]
            self.send_response(200)
            self._cors_headers()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps({"mode": BridgeHandler.monitoring_mode}).encode()
            )
            return

        self.send_response(200)
        self._cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(
            json.dumps(
                {
                    "alive": True,
                    "service": "baby-monitor-ai",
                    "mode": BridgeHandler.monitoring_mode,
                }
            ).encode()
        )

    def do_POST(self):
        """Receive audio, analyze with Claude CLI"""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
            audio_b64 = data.get("audio", "")
            content_type = data.get("contentType", "audio/webm")

            if not audio_b64:
                self._respond(400, {"error": "No audio data"})
                return

            # Save audio to temp file
            suffix = ".webm" if "webm" in content_type else ".wav"
            with tempfile.NamedTemporaryFile(
                suffix=suffix, delete=False
            ) as f:
                f.write(base64.b64decode(audio_b64))
                temp_path = f.name

            try:
                # Call claude CLI with the audio file
                prompt = f"""Analyze this baby monitor audio recording.
Current monitoring mode: {BridgeHandler.monitoring_mode}
Classify what you hear. Respond with ONLY a JSON object: {{"status": "sleeping"|"crying"|"fussing"|"babbling"|"coughing"|"noise", "confidence": "high"|"medium"|"low", "description": "brief description"}}"""

                result = subprocess.run(
                    [
                        "claude",
                        "-p",
                        prompt,
                        "--allowedTools",
                        "",
                        temp_path,
                    ],
                    capture_output=True,
                    text=True,
                    timeout=30,
                )

                output = result.stdout.strip()

                # Try to parse JSON from the output
                try:
                    # Find JSON in the output
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

            finally:
                os.unlink(temp_path)

        except Exception as e:
            self._respond(500, {"error": str(e)})

    def _respond(self, code, data):
        self.send_response(code)
        self._cors_headers()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())


def main():
    parser = argparse.ArgumentParser(description="Baby Monitor AI Bridge")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    # Check claude CLI is available
    try:
        subprocess.run(
            ["claude", "--version"], capture_output=True, check=True
        )
    except FileNotFoundError:
        print("Error: 'claude' CLI not found. Install Claude Code first.")
        print("  npm install -g @anthropic-ai/claude-code")
        return

    server = HTTPServer(("0.0.0.0", args.port), BridgeHandler)
    print(f"[baby-monitor-ai] Running on http://0.0.0.0:{args.port}")
    print(f"[baby-monitor-ai] Mode: {BridgeHandler.monitoring_mode}")
    print(f"[baby-monitor-ai] Open babymonitor.online/receiver to connect")
    print(f"[baby-monitor-ai] Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[baby-monitor-ai] Stopped")
        server.server_close()


if __name__ == "__main__":
    main()
