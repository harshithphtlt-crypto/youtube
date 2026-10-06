import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        post_data = self.rfile.read(content_length) if content_length > 0 else b"{}"
        
        try:
            body = json.loads(post_data.decode("utf-8"))
        except Exception:
            body = {}

        niche = body.get("niche", "Psychology Facts")
        auto_upload = bool(body.get("auto_upload", True))

        github_token = os.environ.get("GITHUB_PAT", "")
        repo_owner = os.environ.get("GITHUB_OWNER", "harshithphtlt-crypto")
        repo_name = os.environ.get("GITHUB_REPO", "youtube")

        if not github_token or not repo_owner or not repo_name:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            response = {
                "success": False,
                "message": "To trigger GitHub Actions from Vercel, set GITHUB_PAT, GITHUB_OWNER, and GITHUB_REPO in your Vercel Environment Variables."
            }
            self.wfile.write(json.dumps(response).encode("utf-8"))
            return

        url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/actions/workflows/autopilot.yml/dispatches"
        headers = {
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AutoShorts-Vercel",
            "Content-Type": "application/json"
        }
        data = {
            "ref": "main",
            "inputs": {
                "niche": niche,
                "auto_upload": "true" if auto_upload else "false"
            }
        }

        req = urllib.request.Request(url, data=json.dumps(data).encode("utf-8"), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req) as resp:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True,
                    "message": f"Successfully triggered Short generation on GitHub Actions for '{niche}'!"
                }).encode("utf-8"))
        except Exception as e:
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": False, "message": str(e)}).encode("utf-8"))
