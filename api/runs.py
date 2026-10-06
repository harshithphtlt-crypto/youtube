import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_GET(self):
        github_token = os.environ.get("GITHUB_PAT", "")
        repo_owner = os.environ.get("GITHUB_OWNER", "harshithphtlt-crypto")
        repo_name = os.environ.get("GITHUB_REPO", "youtube")

        if not github_token or not repo_owner or not repo_name:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "configured": False,
                "message": "GITHUB_PAT, GITHUB_OWNER, and GITHUB_REPO are not configured in Vercel environment variables.",
                "runs": []
            }).encode("utf-8"))
            return

        url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/actions/workflows/autopilot.yml/runs?per_page=10"
        headers = {
            "Authorization": f"Bearer {github_token}",
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "AutoShorts-Vercel"
        }

        try:
            req = urllib.request.Request(url, headers=headers, method="GET")
            with urllib.request.urlopen(req) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                runs = []
                for r in data.get("workflow_runs", []):
                    runs.append({
                        "id": r.get("id"),
                        "name": r.get("name"),
                        "status": r.get("status"),
                        "conclusion": r.get("conclusion"),
                        "created_at": r.get("created_at"),
                        "html_url": r.get("html_url")
                    })
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({
                    "configured": True,
                    "runs": runs
                }).encode("utf-8"))
        except Exception as e:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"configured": False, "error": str(e), "runs": []}).encode("utf-8"))
