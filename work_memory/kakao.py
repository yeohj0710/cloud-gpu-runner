from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


TOKEN_URL = "https://iam.kakaocloud.com/identity/v3/auth/tokens"


def load_local_env(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def connection_status(root: Path) -> dict[str, Any]:
    load_local_env(root / ".env.local")
    required = ("KAKAO_ACCESS_KEY_ID", "KAKAO_SECRET_KEY", "KAKAO_PROJECT_ID", "KAKAO_REGION")
    return {"configured": all(os.environ.get(key) for key in required), "present": {key: bool(os.environ.get(key)) for key in required}}


def issue_token(root: Path, timeout: int = 15) -> dict[str, Any]:
    load_local_env(root / ".env.local")
    access_key = os.environ.get("KAKAO_ACCESS_KEY_ID", "")
    secret = os.environ.get("KAKAO_SECRET_KEY", "")
    if not access_key or not secret:
        raise RuntimeError("KakaoCloud IAM credentials are not configured.")
    payload = {"auth": {"identity": {"methods": ["application_credential"], "application_credential": {"id": access_key, "secret": secret}}}}
    request = urllib.request.Request(TOKEN_URL, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            token = response.headers.get("X-Subject-Token")
            body = json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"KakaoCloud token request failed: HTTP {error.code} {detail}") from error
    if not token:
        raise RuntimeError("KakaoCloud did not return X-Subject-Token.")
    token_info = body.get("token") or {}
    return {"ok": True, "expires_at": token_info.get("expires_at"), "project": (token_info.get("project") or {}).get("id"), "token": token}

