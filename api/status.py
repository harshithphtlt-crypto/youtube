import json
import os
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        github_token = os.environ.get("GITHUB_PAT", "")
        repo_owner = os.environ.get("GITHUB_OWNER", "harshithphtlt-crypto")
        repo_name = os.environ.get("GITHUB_REPO", "youtube")

        is_configured = bool(github_token and repo_owner and repo_name)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

        response = {
            "is_vercel": True,
            "github_configured": is_configured,
            "repo_owner": repo_owner,
            "repo_name": repo_name,
            "gemini_configured": True,
            "ffmpeg_ready": True,
            "youtube_configured": is_configured
        }
        self.wfile.write(json.dumps(response).encode("utf-8"))
