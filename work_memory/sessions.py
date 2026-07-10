from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Any

from .db import Database


def _dt(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def rebuild_sessions(db: Database, gap_minutes: int = 12) -> int:
    with db.connect() as connection:
        frames = [dict(row) for row in connection.execute("SELECT * FROM frames ORDER BY employee_id,captured_at")]
        connection.execute("DELETE FROM sessions")
        groups: list[list[dict[str, Any]]] = []
        for frame in frames:
            if not groups:
                groups.append([frame])
                continue
            previous = groups[-1][-1]
            gap = (_dt(frame["captured_at"]) - _dt(previous["captured_at"])).total_seconds()
            same_context = frame["employee_id"] == previous["employee_id"] and frame.get("app") == previous.get("app")
            if same_context and 0 <= gap <= gap_minutes * 60:
                groups[-1].append(frame)
            else:
                groups.append([frame])
        for group in groups:
            first, last = group[0], group[-1]
            duration = max(0, int((_dt(last["captured_at"]) - _dt(first["captured_at"])).total_seconds()))
            sid = "ws_" + hashlib.sha256(f'{first["employee_id"]}|{first["captured_at"]}|{first.get("app")}'.encode()).hexdigest()[:20]
            titles = [item.get("title") for item in group if item.get("title")]
            title = max(titles, key=titles.count) if titles else "제목 없음"
            summary = f'{first.get("app") or "알 수 없는 앱"}에서 {title}'
            connection.execute(
                "INSERT INTO sessions VALUES(?,?,?,?,?,?,?,?,?)",
                (sid, first["employee_id"], first["captured_at"], last["captured_at"], first.get("app"), title, len(group), duration, summary),
            )
    return len(groups)

