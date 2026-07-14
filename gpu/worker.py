from __future__ import annotations

import json
import os
import sys
from pathlib import Path


def main() -> int:
    job_path = Path(os.environ.get("WORK_MEMORY_JOB", "/input/job.json"))
    output_path = Path(os.environ.get("WORK_MEMORY_OUTPUT", "/output/result.json"))
    job = json.loads(job_path.read_text(encoding="utf-8"))
    if job.get("mode") != "execute" or os.environ.get("WORK_MEMORY_ALLOW_EXECUTE") != "YES":
        print("Blocked: execute mode and WORK_MEMORY_ALLOW_EXECUTE=YES are both required.", file=sys.stderr)
        return 2
    if int(job.get("max_runtime_minutes", 0)) > 240 or job.get("output_policy", {}).get("public"):
        print("Blocked: unsafe job limits.", file=sys.stderr)
        return 3
    # Provider image installs the selected OCR/embedding model. This base worker preserves
    # the input/output contract and refuses accidental paid execution by default.
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps({"job_id": job["job_id"], "processed": 0, "status": "model-image-required"}, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

