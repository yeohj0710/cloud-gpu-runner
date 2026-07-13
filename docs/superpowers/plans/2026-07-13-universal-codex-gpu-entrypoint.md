# Universal Codex GPU Entrypoint

## Goal

Make this repository a self-contained GPU execution backend that Codex can use from any project after a single instruction naming `C:\dev\cloud-gpu-runner-console`.

## Tasks

1. Add a root `AGENTS.md` contract covering target-repository analysis, data safety, conservative default approval bounds, NAVER-first provider selection, retries, artifact retrieval, and cleanup verification.
2. Add `scripts\cloud-gpu.ps1` as the stable status/run entrypoint without dependencies on a specific application repository.
3. Extend `Submit-GpuJob.ps1` with a hard estimated-cost ceiling, terminal-state polling, timeout cancellation, log/result download, execution evidence, and GPU/public-IP cleanup verification.
4. Prefer this repository's `.env.local` while retaining the legacy credential-file fallback without exposing or changing credentials.
5. Add contract/parser tests and update README with the one-line Codex workflow and direct commands.
6. Run the full test suite and read-only production status check; review the diff; commit and push.
7. Deploy the production console and verify its public health endpoint. Do not allocate a paid GPU for deployment verification.
