#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baby Monitor AI - local bridge using Claude API for audio analysis.

Runs a small HTTP server that receives audio from the baby monitor
receiver page and sends it to Claude for classification.

Usage:
    pip install anthropic
    python3 baby-monitor-ai.py

Requires:
    - ANTHROPIC_API_KEY environment variable set
    - Same network as the baby monitor sender
"""

import argparse
import json
import base64
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

try:
    import anthropic
except ImportError:
    print("Error: 'anthropic' package not found.")
    print("  pip install anthropic")
    sys.exit(1)

DEFAULT_PORT = 9877


class BridgeHandler(BaseHTTPRequestHandler):
    monitoring_mode = "notify_crying"
    client = None

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

            # Determine media type for Claude API
            media_type = "audio/webm"
            if "wav" in content_type:
                media_type = "audio/wav"
            elif "ogg" in content_type:
                media_type = "audio/ogg"
            elif "mp3" in content_type or "mpeg" in content_type:
                media_type = "audio/mp3"

            print(f"[baby-monitor-ai] Analyzing {len(audio_b64)} bytes of audio...")

            prompt = (
                f"Monitoring mode: {BridgeHandler.monitoring_mode}. "
                "Classify what you hear from this baby monitor. "
                'Respond with ONLY a JSON object: '
                '{"status": "sleeping"|"crying"|"fussing"|"babbling"|"coughing"|"noise", '
                '"confidence": "high"|"medium"|"low", '
                '"description": "brief one-line description"}'
            )

            response = BridgeHandler.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=200,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": prompt,
                            },
                            {
                                "type": "document",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": audio_b64,
                                },
                            },
                        ],
                    }
                ],
            )

            output = response.content[0].text.strip()
            print(f"[baby-monitor-ai] Result: {output}")

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

        except anthropic.APIError as e:
            print(f"[baby-monitor-ai] API error: {e}")
            self._respond(500, {"error": f"Claude API error: {str(e)}"})
        except Exception as e:
            print(f"[baby-monitor-ai] Error: {e}")
            self._respond(500, {"error": str(e)})


def main():
    parser = argparse.ArgumentParser(description="Baby Monitor AI Bridge")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY environment variable not set.")
        print("  export ANTHROPIC_API_KEY=sk-ant-...")
        sys.exit(1)

    BridgeHandler.client = anthropic.Anthropic(api_key=api_key)
    print(f"[baby-monitor-ai] Claude API connected")

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
