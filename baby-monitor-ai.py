#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baby Monitor AI - local bridge using Claude Code CLI for audio analysis.

Converts audio to a spectrogram image, then uses claude CLI to
visually analyze it (Claude can read images via the Read tool).

Usage:
    python3 baby-monitor-ai.py

Requires:
    - Claude Code CLI (claude command)
    - ffmpeg (brew install ffmpeg)
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
WORK_DIR = "/tmp/baby-monitor"


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
            audio_path = os.path.join(WORK_DIR, f"capture{suffix}")
            spectrogram_path = os.path.join(WORK_DIR, "spectrogram.png")

            # Save audio
            os.makedirs(WORK_DIR, exist_ok=True)
            with open(audio_path, "wb") as f:
                f.write(base64.b64decode(audio_b64))

            size = os.path.getsize(audio_path)
            print(f"[baby-monitor-ai] Saved {size} bytes to {audio_path}")

            # Convert to spectrogram image using ffmpeg
            print("[baby-monitor-ai] Generating spectrogram...")
            ffmpeg_result = subprocess.run(
                [
                    "ffmpeg", "-y", "-i", audio_path,
                    "-lavfi", "showspectrumpic=s=800x400:mode=combined",
                    spectrogram_path,
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )

            if ffmpeg_result.returncode != 0 or not os.path.exists(spectrogram_path):
                # Fallback: get audio stats as text
                print("[baby-monitor-ai] Spectrogram failed, using volume stats...")
                stats_result = subprocess.run(
                    ["ffmpeg", "-i", audio_path, "-af", "volumedetect", "-f", "null", "-"],
                    capture_output=True,
                    text=True,
                    timeout=10,
                )
                audio_info = stats_result.stderr[-500:] if stats_result.stderr else "No stats available"

                prompt = (
                    f"You are a baby monitor AI. Monitoring mode: {BridgeHandler.monitoring_mode}. "
                    f"Here are volume statistics from a baby monitor audio recording:\n\n{audio_info}\n\n"
                    "Based on these volume levels, classify the audio. "
                    'Respond with ONLY a JSON object: '
                    '{"status": "sleeping"|"crying"|"fussing"|"babbling"|"coughing"|"noise", '
                    '"confidence": "high"|"medium"|"low", '
                    '"description": "brief one-line description"}'
                )

                result = subprocess.run(
                    ["claude", "-p", prompt, "--allowedTools", ""],
                    capture_output=True, text=True, timeout=30,
                )
            else:
                print(f"[baby-monitor-ai] Spectrogram: {spectrogram_path}")

                # Also get volume stats for extra context
                stats_result = subprocess.run(
                    ["ffmpeg", "-i", audio_path, "-af", "volumedetect", "-f", "null", "-"],
                    capture_output=True, text=True, timeout=10,
                )
                volume_info = ""
                if stats_result.stderr:
                    for line in stats_result.stderr.split("\n"):
                        if "mean_volume" in line or "max_volume" in line:
                            volume_info += line.strip() + " "

                prompt = (
                    f"Read the spectrogram image at {spectrogram_path}. "
                    f"This is from a baby monitor. Mode: {BridgeHandler.monitoring_mode}. "
                    f"{('Volume info: ' + volume_info) if volume_info else ''} "
                    "The spectrogram shows frequency (vertical) over time (horizontal). "
                    "Baby crying shows as bright horizontal bands in 300-600Hz range with harmonics. "
                    "Silence is dark. Background noise is diffuse low-frequency energy. "
                    'Respond with ONLY a JSON object: '
                    '{"status": "sleeping"|"crying"|"fussing"|"babbling"|"coughing"|"noise", '
                    '"confidence": "high"|"medium"|"low", '
                    '"description": "brief one-line description"}'
                )

                result = subprocess.run(
                    ["claude", "-p", prompt, "--allowedTools", "Read"],
                    capture_output=True, text=True, timeout=30,
                )

            output = result.stdout.strip()
            print(f"[baby-monitor-ai] Claude: {output[:200]}")

            # Clean up
            for f in [audio_path, spectrogram_path]:
                try:
                    os.unlink(f)
                except OSError:
                    pass

            # Parse JSON
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
            print("[baby-monitor-ai] Timed out")
            self._respond(500, {"error": "Analysis timed out"})
        except Exception as e:
            print(f"[baby-monitor-ai] Error: {e}")
            self._respond(500, {"error": str(e)})


def main():
    parser = argparse.ArgumentParser(description="Baby Monitor AI Bridge")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    if not shutil.which("claude"):
        print("Error: 'claude' CLI not found.")
        print("  npm install -g @anthropic-ai/claude-code")
        sys.exit(1)

    if not shutil.which("ffmpeg"):
        print("Error: 'ffmpeg' not found.")
        print("  brew install ffmpeg")
        sys.exit(1)

    os.makedirs(WORK_DIR, exist_ok=True)

    server = HTTPServer(("0.0.0.0", args.port), BridgeHandler)
    print("[baby-monitor-ai] Running on http://0.0.0.0:%d" % args.port)
    print("[baby-monitor-ai] Mode: %s" % BridgeHandler.monitoring_mode)
    print("[baby-monitor-ai] Using: claude CLI + ffmpeg spectrogram")
    print("[baby-monitor-ai] Open babymonitor.online/receiver to connect")
    print("[baby-monitor-ai] Press Ctrl+C to stop")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[baby-monitor-ai] Stopped")
        shutil.rmtree(WORK_DIR, ignore_errors=True)
        server.server_close()


if __name__ == "__main__":
    main()
