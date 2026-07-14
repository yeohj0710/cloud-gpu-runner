from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .db import Database, utc_now
from .sessions import rebuild_sessions


def _get(record: dict[str, Any], *keys: str) -> Any:
    value: Any = record
    for key in keys:
        if not isinstance(value, dict):
            return None
        value = value.get(key)
    return value


def ingest_manifest(db: Database, manifest: Path, config: dict[str, Any]) -> dict[str, int]:
    employee = config["employee"]["id"]
    if not db.has_consent(employee):
        raise PermissionError("직원 동의가 기록되기 전에는 캡처를 수집하지 않습니다.")
    if not manifest.exists():
        return {"imported": 0, "excluded": 0, "invalid": 0}
    excluded_apps = {item.casefold() for item in config.get("excluded_apps", [])}
    title_keywords = [item.casefold() for item in config.get("excluded_title_keywords", [])]
    counts = {"imported": 0, "excluded": 0, "invalid": 0}
    source = str(manifest.resolve())
    with db.connect() as connection:
        state = connection.execute("SELECT byte_offset FROM ingest_state WHERE source_path=?", (source,)).fetchone()
        offset = int(state[0]) if state else 0
        size = manifest.stat().st_size
        if offset > size:
            offset = 0
        with manifest.open("r", encoding="utf-8") as handle:
            handle.seek(offset)
            while line := handle.readline():
                try:
                    record = json.loads(line)
                    capture = record.get("capture") or {}
                    app = capture.get("active_app") or "알 수 없는 앱"
                    title = capture.get("active_window_title") or ""
                    if app.casefold() in excluded_apps or any(keyword in title.casefold() for keyword in title_keywords):
                        counts["excluded"] += 1
                        continue
                    frame_id = record.get("image_id") or record.get("event_id")
                    captured_at = record.get("captured_at")
                    if not frame_id or not captured_at:
                        counts["invalid"] += 1
                        continue
                    cursor = connection.execute(
                        """INSERT OR IGNORE INTO frames(id,captured_at,captured_at_local,employee_id,app,title,image_path,image_sha256,diff_score,imported_at)
                        VALUES(?,?,?,?,?,?,?,?,?,?)""",
                        (frame_id, captured_at, record.get("captured_at_local"), employee, app, title,
                         _get(record, "image", "path"), _get(record, "image", "sha256"), capture.get("diff_score"), utc_now()),
                    )
                    counts["imported"] += cursor.rowcount
                except (json.JSONDecodeError, TypeError, ValueError):
                    counts["invalid"] += 1
            new_offset = handle.tell()
        connection.execute(
            "INSERT INTO ingest_state VALUES(?,?,?) ON CONFLICT(source_path) DO UPDATE SET byte_offset=excluded.byte_offset,updated_at=excluded.updated_at",
            (source, new_offset, utc_now()),
        )
    rebuild_sessions(db, int(config.get("session_gap_minutes", 12)))
    db.audit(employee, "manifest.ingest", source, counts)
    return counts

