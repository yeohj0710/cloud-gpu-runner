# Agent Notes

This repo is a cloud-credit experiment workspace.

Rules:
- Do not commit or print real API keys.
- Keep provider credentials in `.env.local`; keep only variable names in docs.
- Before adding paid or credit-consuming calls, add a dry-run or minimal-call path.
- Record each meaningful experiment in `experiments/` using `_template.md`.
- Add a Next.js app only when there is enough data to visualize; use `apps/dashboard`.

GPU agent workflow:
- This environment is named **Cloud GPU Runner**. It uses granted NAVER Cloud and KakaoCloud credits for bounded GPU workloads.
- Never copy cloud keys into source, prompts, logs, commits, or other projects. Credentials stay in this repository's ignored `.env.local` and the protected backend.
- Before every GPU run, execute `powershell -NoProfile -ExecutionPolicy Bypass -File C:\dev\cloud-credit-lab\scripts\cloud-gpu.ps1 status -Provider <naver|kakao> -Minutes <minutes>`.
- Show the estimated maximum cost and remaining credit, then ask the user for fresh explicit approval.
- Do not upload code/data or create resources before approval. After approval, use `cloud-gpu.ps1 run ... -ApproveEstimatedCost`.
- Prefer NAVER until its 2026-07-31 credit expires; use Kakao when NAVER is unavailable or Kakao hardware is more suitable.
- Always bound runtime and preserve automatic server/public-IP cleanup and cost recording.
- Do not use GPU for ordinary coding, browsing, document work, or small CPU tasks.
- Credentials are already connected. Ask for replacement keys only when readiness fails due to revocation, expiry, or permission loss.
