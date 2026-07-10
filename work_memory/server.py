from __future__ import annotations

import json
import mimetypes
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse

from .db import Database
from .gpu import create_job
from .ingest import ingest_manifest


STATIC_ROOT = Path(__file__).with_name("static")


def _today_prefix() -> str:
    return datetime.now().astimezone().date().isoformat()


class WorkMemoryServer(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], db: Database, config: dict[str, Any], root: Path):
        super().__init__(address, WorkMemoryHandler)
        self.db = db
        self.config = config
        self.root = root


class WorkMemoryHandler(BaseHTTPRequestHandler):
    server: WorkMemoryServer

    def log_message(self, format: str, *args: Any) -> None:
        return

    def _json(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(length) or b"{}")

    def _rows(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with self.server.db.connect() as connection:
            return [dict(row) for row in connection.execute(sql, params)]

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            return self._json({"ok": True, "version": "0.1.0"})
        if parsed.path == "/api/overview":
            return self._overview()
        if parsed.path == "/api/search":
            query = parse_qs(parsed.query).get("q", [""])[0]
            self.server.db.audit("local-user", "search", query)
            return self._json({"items": self.server.db.search(query), "query": query})
        if parsed.path == "/api/sessions":
            day = parse_qs(parsed.query).get("date", [_today_prefix()])[0]
            return self._json({"items": self._rows(
                "SELECT * FROM sessions WHERE date(started_at,'+9 hours')=? ORDER BY started_at DESC", (day,)
            )})
        if parsed.path == "/api/audit":
            return self._json({"items": self._rows("SELECT * FROM audit_log ORDER BY id DESC LIMIT 100")})
        if parsed.path.startswith("/api/frame/"):
            return self._frame(unquote(parsed.path.removeprefix("/api/frame/")))
        return self._static(parsed.path)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            body = self._read_json()
            if parsed.path == "/api/consent":
                employee = self.server.config["employee"]
                self.server.db.set_consent(employee["id"], employee["display_name"], bool(body.get("agreed")))
                return self._json({"ok": True, "agreed": bool(body.get("agreed"))})
            if parsed.path == "/api/ingest":
                manifest = Path(self.server.config["capture_root"]) / "raw_capture" / "manifest.jsonl"
                return self._json({"ok": True, "result": ingest_manifest(self.server.db, manifest, self.server.config)})
            if parsed.path == "/api/gpu/jobs":
                output = self.server.root / "gpu" / "jobs" / "latest.json"
                job = create_job(self.server.db, output, self.server.config, body.get("limit"))
                self.server.db.audit("local-user", "gpu.job.create", job["job_id"], {"input_count": job["input_count"]})
                return self._json({"ok": True, "job": job, "path": str(output)})
            self._json({"error": "not_found"}, 404)
        except PermissionError as error:
            self._json({"ok": False, "error": str(error)}, 403)
        except (ValueError, json.JSONDecodeError) as error:
            self._json({"ok": False, "error": str(error)}, 400)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/frame/"):
            return self._json({"error": "not_found"}, 404)
        frame_id = unquote(parsed.path.removeprefix("/api/frame/"))
        with self.server.db.connect() as connection:
            row = connection.execute("SELECT image_path FROM frames WHERE id=?", (frame_id,)).fetchone()
            connection.execute("DELETE FROM frames WHERE id=?", (frame_id,))
        self.server.db.audit("local-user", "frame.delete", frame_id, {"metadata_only": True, "image_path": row[0] if row else None})
        self._json({"ok": True, "deleted": frame_id, "note": "원본 이미지는 캡처 앱의 보존 정책으로 삭제됩니다."})

    def _overview(self) -> None:
        employee = self.server.config["employee"]
        with self.server.db.connect() as connection:
            frame_count = connection.execute("SELECT count(*) FROM frames").fetchone()[0]
            today_frames = connection.execute("SELECT count(*) FROM frames WHERE substr(captured_at_local,1,10)=?", (_today_prefix(),)).fetchone()[0]
            session_count = connection.execute("SELECT count(*) FROM sessions WHERE date(started_at,'+9 hours')=?", (_today_prefix(),)).fetchone()[0]
            first_last = connection.execute("SELECT min(captured_at_local),max(captured_at_local) FROM frames WHERE substr(captured_at_local,1,10)=?", (_today_prefix(),)).fetchone()
        capture_state_path = Path(self.server.config["capture_root"]) / "raw_capture" / "state.json"
        try:
            capture_state = json.loads(capture_state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            capture_state = {"paused": True, "last_saved_at": None, "saved_count": 0}
        self._json({
            "employee": employee, "consent": self.server.db.has_consent(employee["id"]),
            "capture": capture_state, "counts": {"all_frames": frame_count, "today_frames": today_frames, "today_sessions": session_count},
            "work_window": {"first": first_last[0], "last": first_last[1]}, "retention_days": self.server.config["retention_days"],
            "excluded_apps": self.server.config["excluded_apps"], "gpu": self.server.config["gpu"],
        })

    def _frame(self, frame_id: str) -> None:
        rows = self._rows("SELECT * FROM frames WHERE id=?", (frame_id,))
        if not rows:
            return self._json({"error": "not_found"}, 404)
        self.server.db.audit("local-user", "frame.view", frame_id)
        self._json(rows[0])

    def _static(self, request_path: str) -> None:
        name = "index.html" if request_path in {"", "/"} else request_path.lstrip("/")
        target = (STATIC_ROOT / name).resolve()
        if STATIC_ROOT.resolve() not in target.parents and target != STATIC_ROOT.resolve():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        if not target.exists() or not target.is_file():
            target = STATIC_ROOT / "index.html"
        body = target.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", mimetypes.guess_type(target.name)[0] or "application/octet-stream")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def serve(db: Database, config: dict[str, Any], root: Path) -> None:
    server = WorkMemoryServer((config["host"], int(config["port"])), db, config, root)
    print(f'Work Memory: http://{config["host"]}:{config["port"]}')
    server.serve_forever()
