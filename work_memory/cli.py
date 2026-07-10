from __future__ import annotations

import argparse
import json
import webbrowser
from pathlib import Path

from .config import load_config, resolve_path
from .db import Database
from .gpu import create_job, validate_job
from .ingest import ingest_manifest
from .server import serve
from .billing import add_usage, overview as billing_overview


def context(config_path: Path):
    root = Path(__file__).resolve().parents[1]
    config = load_config(config_path)
    config["capture_root"] = str(resolve_path(config["capture_root"], root))
    db = Database(resolve_path(config["database_path"], root))
    db.initialize()
    return root, config, db


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="work-memory")
    parser.add_argument("--config", default="config.json")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init")
    consent = sub.add_parser("consent")
    consent.add_argument("value", choices=["agree", "revoke"])
    sub.add_parser("ingest")
    serve_parser = sub.add_parser("serve")
    serve_parser.add_argument("--no-browser", action="store_true")
    search = sub.add_parser("search")
    search.add_argument("query", nargs="?", default="")
    gpu = sub.add_parser("gpu-job")
    gpu.add_argument("--limit", type=int, default=None)
    gpu.add_argument("--output", default="gpu/jobs/latest.json")
    sub.add_parser("billing")
    usage = sub.add_parser("add-usage")
    usage.add_argument("provider", choices=["naver", "kakao"])
    usage.add_argument("service")
    usage.add_argument("amount_krw", type=int)
    usage.add_argument("--kind", choices=["actual", "estimated", "adjustment"], default="actual")
    usage.add_argument("--note", default="")
    args = parser.parse_args(argv)
    config_path = Path(args.config).resolve()
    root, config, db = context(config_path)
    if args.command == "init":
        print(json.dumps({"ok": True, "database": str(db.path)}, ensure_ascii=False))
    elif args.command == "consent":
        employee = config["employee"]
        db.set_consent(employee["id"], employee["display_name"], args.value == "agree")
        print(json.dumps({"ok": True, "agreed": args.value == "agree"}, ensure_ascii=False))
    elif args.command == "ingest":
        print(json.dumps(ingest_manifest(db, Path(config["capture_root"]) / "raw_capture" / "manifest.jsonl", config), ensure_ascii=False))
    elif args.command == "search":
        print(json.dumps(db.search(args.query), ensure_ascii=False, indent=2))
    elif args.command == "gpu-job":
        job = create_job(db, resolve_path(args.output, root), config, args.limit)
        validate_job(job)
        print(json.dumps(job, ensure_ascii=False, indent=2))
    elif args.command == "billing":
        print(json.dumps(billing_overview(db), ensure_ascii=False, indent=2))
    elif args.command == "add-usage":
        print(json.dumps({"id": add_usage(db, args.provider, args.service, args.amount_krw, args.kind, args.note)}, ensure_ascii=False))
    elif args.command == "serve":
        if not args.no_browser:
            webbrowser.open(f'http://{config["host"]}:{config["port"]}')
        serve(db, config, root)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
