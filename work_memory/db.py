from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator


SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS frames (
  id TEXT PRIMARY KEY, captured_at TEXT NOT NULL, captured_at_local TEXT,
  employee_id TEXT NOT NULL, app TEXT, title TEXT, image_path TEXT, image_sha256 TEXT,
  diff_score REAL, ocr_text TEXT NOT NULL DEFAULT '', imported_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS frames_time ON frames(captured_at);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, employee_id TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT NOT NULL,
  app TEXT, title TEXT, frame_count INTEGER NOT NULL, duration_seconds INTEGER NOT NULL,
  summary TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS consents (
  employee_id TEXT PRIMARY KEY, display_name TEXT NOT NULL, policy_version TEXT NOT NULL,
  agreed INTEGER NOT NULL, agreed_at TEXT, revoked_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, target TEXT, detail_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS ingest_state (source_path TEXT PRIMARY KEY, byte_offset INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);
CREATE VIRTUAL TABLE IF NOT EXISTS frame_search USING fts5(id UNINDEXED, app, title, ocr_text, content='frames', content_rowid='rowid');
CREATE TRIGGER IF NOT EXISTS frames_ai AFTER INSERT ON frames BEGIN
  INSERT INTO frame_search(rowid,id,app,title,ocr_text) VALUES(new.rowid,new.id,new.app,new.title,new.ocr_text);
END;
CREATE TRIGGER IF NOT EXISTS frames_ad AFTER DELETE ON frames BEGIN
  INSERT INTO frame_search(frame_search,rowid,id,app,title,ocr_text) VALUES('delete',old.rowid,old.id,old.app,old.title,old.ocr_text);
END;
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class Database:
    def __init__(self, path: Path):
        self.path = path

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        try:
            yield connection
            connection.commit()
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(SCHEMA)

    def audit(self, actor: str, action: str, target: str = "", detail: dict[str, Any] | None = None) -> None:
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO audit_log(occurred_at,actor,action,target,detail_json) VALUES(?,?,?,?,?)",
                (utc_now(), actor, action, target, json.dumps(detail or {}, ensure_ascii=False)),
            )

    def set_consent(self, employee_id: str, display_name: str, agreed: bool, policy_version: str = "2026-07-10") -> None:
        now = utc_now()
        with self.connect() as connection:
            connection.execute(
                """INSERT INTO consents(employee_id,display_name,policy_version,agreed,agreed_at,revoked_at)
                VALUES(?,?,?,?,?,?) ON CONFLICT(employee_id) DO UPDATE SET display_name=excluded.display_name,
                policy_version=excluded.policy_version,agreed=excluded.agreed,
                agreed_at=CASE WHEN excluded.agreed=1 THEN excluded.agreed_at ELSE consents.agreed_at END,
                revoked_at=CASE WHEN excluded.agreed=0 THEN excluded.revoked_at ELSE NULL END""",
                (employee_id, display_name, policy_version, int(agreed), now if agreed else None, None if agreed else now),
            )
        self.audit(employee_id, "consent.agree" if agreed else "consent.revoke", employee_id)

    def has_consent(self, employee_id: str) -> bool:
        with self.connect() as connection:
            row = connection.execute("SELECT agreed FROM consents WHERE employee_id=?", (employee_id,)).fetchone()
            return bool(row and row["agreed"])

    def search(self, query: str, limit: int = 50) -> list[dict[str, Any]]:
        with self.connect() as connection:
            if query.strip():
                safe = " ".join(f'"{part.replace(chr(34), "")}"' for part in query.split())
                rows = connection.execute(
                    """SELECT f.* FROM frame_search s JOIN frames f ON f.rowid=s.rowid
                    WHERE frame_search MATCH ? ORDER BY f.captured_at DESC LIMIT ?""", (safe, limit)
                ).fetchall()
            else:
                rows = connection.execute("SELECT * FROM frames ORDER BY captured_at DESC LIMIT ?", (limit,)).fetchall()
            return [dict(row) for row in rows]

