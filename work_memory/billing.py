from __future__ import annotations

from datetime import date
from typing import Any

from .db import Database, utc_now


DEFAULT_GRANTS = [
    ("ncp-new-2026", "naver", "신규 고객 Plus", 300_000, "2026-07-31"),
    ("ncp-greenhouse-1", "naver", "Greenhouse 1차", 5_000_000, "2027-04-30"),
    ("kakao-boost-1", "kakao", "Rocket Launcher Boost", 10_000_000, "2027-05-31"),
]


def seed_grants(db: Database) -> None:
    with db.connect() as connection:
        for grant in DEFAULT_GRANTS:
            connection.execute(
                "INSERT OR IGNORE INTO credit_grants(id,provider,name,amount_krw,expires_on) VALUES(?,?,?,?,?)", grant
            )


def add_usage(db: Database, provider: str, service: str, amount_krw: int, kind: str, note: str = "", source: str = "manual") -> int:
    if provider not in {"naver", "kakao"} or kind not in {"actual", "estimated", "adjustment"}:
        raise ValueError("지원하지 않는 공급자 또는 사용액 종류입니다.")
    if amount_krw < 0:
        raise ValueError("사용액은 0원 이상이어야 합니다.")
    with db.connect() as connection:
        cursor = connection.execute(
            "INSERT INTO usage_entries(incurred_on,provider,service,amount_krw,kind,source,note,created_at) VALUES(?,?,?,?,?,?,?,?)",
            (date.today().isoformat(), provider, service.strip() or "기타", amount_krw, kind, source, note.strip(), utc_now()),
        )
        entry_id = int(cursor.lastrowid)
    db.audit("local-user", "billing.usage.add", str(entry_id), {"provider": provider, "amount_krw": amount_krw, "kind": kind})
    return entry_id


def overview(db: Database) -> dict[str, Any]:
    seed_grants(db)
    with db.connect() as connection:
        grants = [dict(row) for row in connection.execute("SELECT * FROM credit_grants ORDER BY expires_on")]
        usage = [dict(row) for row in connection.execute(
            "SELECT provider,kind,sum(amount_krw) amount_krw FROM usage_entries GROUP BY provider,kind"
        )]
        recent = [dict(row) for row in connection.execute("SELECT * FROM usage_entries ORDER BY incurred_on DESC,id DESC LIMIT 30")]
        daily = [dict(row) for row in connection.execute(
            "SELECT incurred_on,sum(CASE WHEN kind='actual' THEN amount_krw ELSE 0 END) actual_krw,sum(CASE WHEN kind='estimated' THEN amount_krw ELSE 0 END) estimated_krw FROM usage_entries GROUP BY incurred_on ORDER BY incurred_on DESC LIMIT 14"
        )]
    by_provider: dict[str, dict[str, int]] = {name: {"credit": 0, "actual": 0, "estimated": 0, "adjustment": 0} for name in ("naver", "kakao")}
    for grant in grants:
        by_provider[grant["provider"]]["credit"] += grant["amount_krw"]
    for item in usage:
        by_provider[item["provider"]][item["kind"]] = item["amount_krw"] or 0
    for values in by_provider.values():
        values["remaining"] = values["credit"] + values["adjustment"] - values["actual"]
        values["usage_percent"] = round(values["actual"] / values["credit"] * 100, 2) if values["credit"] else 0
    totals = {key: sum(values[key] for values in by_provider.values()) for key in ("credit", "actual", "estimated", "adjustment", "remaining")}
    return {"totals": totals, "providers": by_provider, "grants": grants, "recent": recent, "daily": list(reversed(daily))}

