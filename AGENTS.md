# Cloud GPU Runner agent contract

This repository is the canonical, project-independent NAVER/Kakao GPU entrypoint. It also preserves the original credit research and experiment history.

When a user working in another repository says to use `C:\dev\cloud-gpu-runner` for training or inference:

1. Read the target repository instructions and inspect its environment, dependencies, entrypoints, tests, and non-sensitive sample data.
2. Run the cheapest relevant local validation first. This workstation has an RTX 5070 Ti with 16GB VRAM. Do not use paid cloud GPU when that local GPU can reasonably complete the work. Derive the remote command from the project; never assume `train.py` exists.
3. Use `C:\dev\cloud-gpu-runner\scripts\cloud-gpu.ps1` with provider `auto`. Cloud GPUs must materially exceed the local machine: NVIDIA only, at least 48GB VRAM per GPU. NAVER L4 and Kakao T4 are blocked; NAVER L40S and Kakao A100 are eligible. Prefer NAVER while its credits are usable (300,000 KRW expires 2026-07-31; 5,000,000 KRW expires 2027-04-30); fall back to Kakao when NAVER is unavailable or Kakao hardware is more suitable.
4. For a bare request without an explicit budget, treat it as pre-approval for one GPU instance, at most 60 minutes, and at most 2,000 KRW estimated cost excluding VAT. Since eligible 48GB+ GPUs normally exceed 2,000 KRW/hour, stop and request a task-specific budget before paid execution. Pass `-ApproveEstimatedCost` only inside the explicitly approved bounds.
5. Upload only public data or non-sensitive project samples. Exclude secrets, local environments, Git metadata, dependencies, prior artifacts, and `etc`.
6. Never print, commit, copy to another project, replace, issue, or change cloud credentials. Credentials stay in ignored `.env.local` and the protected backend.
7. Wait for completion, download logs and results, record estimated and actual usage, and verify GPU, public-IP, and temporary-disk cleanup. On timeout, cancel and verify cleanup.
8. Store evidence under `<target-project>\artifacts\cloud-gpu\<job-id>\`. Diagnose failures from evidence, make the narrowest fix, run regression checks, and retry only within the approved budget and runtime.
9. Before reporting completion, confirm no paid GPU remains and report provider, job ID, duration, estimate, actual cost, remaining credit, artifact path, and cleanup state.

Additional rules:

- Add a dry-run or minimal-call path before new paid operations.
- Record meaningful research experiments in `experiments/` using `_template.md`.
- Never use GPU for ordinary coding, browsing, document work, or small CPU tasks.
- An explicit user budget, duration, provider, data restriction, or retry policy overrides the conservative defaults above. Never infer approval beyond the current request.
