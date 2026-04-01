#!/usr/bin/env python3
"""
GitHub Webhook Listener for auto-deploy.
Listens for push events and triggers deploy.sh.
Zero GitHub Minutes — just a plain HTTP webhook.
"""

import hashlib
import hmac
import http.server
import json
import os
import subprocess
import sys

PORT = int(os.environ.get("WEBHOOK_PORT", "9000"))
SECRET = os.environ.get("WEBHOOK_SECRET", "")
DEPLOY_SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deploy.sh")
DEPLOY_BRANCH = os.environ.get("DEPLOY_BRANCH", "main")


def verify_signature(payload: bytes, signature: str) -> bool:
    if not SECRET:
        return True
    expected = "sha256=" + hmac.new(
        SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


class WebhookHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != "/webhook":
            self.send_response(404)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", 0))
        payload = self.rfile.read(content_length)

        signature = self.headers.get("X-Hub-Signature-256", "")
        if SECRET and not verify_signature(payload, signature):
            print("[WEBHOOK] Invalid signature — rejected")
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"Invalid signature")
            return

        event = self.headers.get("X-GitHub-Event", "")
        if event == "ping":
            print("[WEBHOOK] Ping received — OK")
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"pong")
            return

        if event != "push":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"Ignored event")
            return

        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            self.send_response(400)
            self.end_headers()
            return

        ref = data.get("ref", "")
        branch = ref.replace("refs/heads/", "")

        if branch != DEPLOY_BRANCH:
            print(f"[WEBHOOK] Push to {branch} — ignored (deploy branch: {DEPLOY_BRANCH})")
            self.send_response(200)
            self.end_headers()
            self.wfile.write(f"Ignored branch {branch}".encode())
            return

        pusher = data.get("pusher", {}).get("name", "unknown")
        commits = len(data.get("commits", []))
        print(f"[WEBHOOK] Push from {pusher} on {branch} ({commits} commits) — deploying...")

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Deploy triggered")

        subprocess.Popen(
            ["bash", DEPLOY_SCRIPT],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    def log_message(self, format, *args):
        print(f"[WEBHOOK] {args[0]}")


if __name__ == "__main__":
    if not os.path.isfile(DEPLOY_SCRIPT):
        print(f"[ERROR] deploy.sh not found at {DEPLOY_SCRIPT}")
        sys.exit(1)

    print(f"[WEBHOOK] Listening on port {PORT}")
    print(f"[WEBHOOK] Deploy branch: {DEPLOY_BRANCH}")
    print(f"[WEBHOOK] Secret: {'configured' if SECRET else 'NONE (no signature check)'}")

    server = http.server.HTTPServer(("0.0.0.0", PORT), WebhookHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[WEBHOOK] Stopped")
