from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .db import Database


def create_job(db: Database, output: Path, config: dict[str, Any], limit: int | None = None) -> dict[str, Any]:
    gpu = config["gpu"]
    max_frames = min(int(limit or gpu["max_frames"]), int(gpu["max_frames"]))
    with db.connect() as connection:
        rows = [dict(row) for row in connection.execute(
            "SELECT id,captured_at,image_path,image_sha256 FROM frames WHERE image_path IS NOT NULL ORDER BY captured_at DESC LIMIT ?", (max_frames,)
        )]
    created = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    fingerprint = hashlib.sha256("|".join(row["id"] for row in rows).encode()).hexdigest()[:16]
    job = {
        "schema_version": "work-memory.gpu-job.v1", "job_id": f"gpu_{fingerprint}", "created_at": created,
        "mode": "dry-run", "provider": gpu["provider"], "max_runtime_minutes": min(int(gpu["max_runtime_minutes"]), 240),
        "tasks": ["ocr", "visual-embedding", "sensitive-region-detection"], "input_count": len(rows), "inputs": rows,
        "output_policy": {"public": False, "include_raw_images": False, "delete_vm_after_run": True},
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(job, ensure_ascii=False, indent=2), encoding="utf-8")
    return job


def validate_job(job: dict[str, Any]) -> None:
    if job.get("mode") != "dry-run":
        raise ValueError("직접 실행은 별도 승인 경로에서만 허용됩니다.")
    if not 1 <= int(job.get("max_runtime_minutes", 0)) <= 240:
        raise ValueError("GPU 작업 제한은 1~240분이어야 합니다.")
    policy = job.get("output_policy") or {}
    if policy.get("public") or not policy.get("delete_vm_after_run"):
        raise ValueError("비공개 출력과 작업 후 VM 삭제가 필수입니다.")

