from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any


DEFAULT_CONFIG: dict[str, Any] = {
    "capture_root": "C:\\dev\\company-work-capture\\data",
    "database_path": "data/work-memory.db",
    "host": "127.0.0.1",
    "port": 8765,
    "retention_days": 7,
    "session_gap_minutes": 12,
    "excluded_apps": ["1Password.exe", "KeePass.exe", "CredentialUIBroker.exe"],
    "excluded_title_keywords": ["비밀번호", "password", "인증번호", "카드번호"],
    "employee": {"id": "local-user", "display_name": "내 PC"},
    "gpu": {"provider": "kakao-cloud", "max_runtime_minutes": 240, "max_frames": 5000},
}


def _merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge(result[key], value)
        else:
            result[key] = value
    return result


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        return deepcopy(DEFAULT_CONFIG)
    return _merge(DEFAULT_CONFIG, json.loads(path.read_text(encoding="utf-8")))


def resolve_path(value: str, root: Path) -> Path:
    path = Path(value)
    return path if path.is_absolute() else (root / path).resolve()

