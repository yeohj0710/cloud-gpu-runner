from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from work_memory.config import DEFAULT_CONFIG
from work_memory.db import Database
from work_memory.gpu import create_job, validate_job
from work_memory.ingest import ingest_manifest


class WorkMemoryTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.db = Database(self.root / "memory.db")
        self.db.initialize()
        self.config = json.loads(json.dumps(DEFAULT_CONFIG))
        self.config["employee"] = {"id": "e1", "display_name": "테스트 직원"}
        self.manifest = self.root / "manifest.jsonl"

    def tearDown(self):
        self.temp.cleanup()

    def write_frames(self):
        records = [
            {"image_id":"f1","captured_at":"2026-07-10T00:00:00Z","captured_at_local":"2026-07-10T09:00:00+09:00","image":{"path":"a.png","sha256":"aaa"},"capture":{"active_app":"Code.exe","active_window_title":"배포 오류 수정","diff_score":0.3}},
            {"image_id":"f2","captured_at":"2026-07-10T00:05:00Z","captured_at_local":"2026-07-10T09:05:00+09:00","image":{"path":"b.png","sha256":"bbb"},"capture":{"active_app":"Code.exe","active_window_title":"배포 오류 수정","diff_score":0.4}},
            {"image_id":"f3","captured_at":"2026-07-10T00:06:00Z","captured_at_local":"2026-07-10T09:06:00+09:00","image":{"path":"secret.png","sha256":"ccc"},"capture":{"active_app":"1Password.exe","active_window_title":"password","diff_score":0.5}},
        ]
        self.manifest.write_text("".join(json.dumps(row, ensure_ascii=False)+"\n" for row in records), encoding="utf-8")

    def test_consent_required_then_incremental_ingest_search_and_sessions(self):
        self.write_frames()
        with self.assertRaises(PermissionError):
            ingest_manifest(self.db, self.manifest, self.config)
        self.db.set_consent("e1", "테스트 직원", True)
        result = ingest_manifest(self.db, self.manifest, self.config)
        self.assertEqual(result, {"imported": 2, "excluded": 1, "invalid": 0})
        self.assertEqual(self.db.search("배포")[0]["id"], "f2")
        with self.db.connect() as connection:
            session = connection.execute("SELECT frame_count FROM sessions").fetchone()
            self.assertEqual(session[0], 2)
        self.assertEqual(ingest_manifest(self.db, self.manifest, self.config)["imported"], 0)

    def test_gpu_job_is_bounded_private_and_dry_run(self):
        self.write_frames(); self.db.set_consent("e1", "테스트 직원", True)
        ingest_manifest(self.db, self.manifest, self.config)
        job = create_job(self.db, self.root / "job.json", self.config, 999999)
        validate_job(job)
        self.assertEqual(job["mode"], "dry-run")
        self.assertLessEqual(job["max_runtime_minutes"], 240)
        self.assertFalse(job["output_policy"]["public"])
        self.assertTrue(job["output_policy"]["delete_vm_after_run"])

    def test_consent_revoke_and_audit(self):
        self.db.set_consent("e1", "테스트 직원", True)
        self.db.set_consent("e1", "테스트 직원", False)
        self.assertFalse(self.db.has_consent("e1"))
        with self.db.connect() as connection:
            self.assertEqual(connection.execute("SELECT count(*) FROM audit_log").fetchone()[0], 2)


if __name__ == "__main__":
    unittest.main()

