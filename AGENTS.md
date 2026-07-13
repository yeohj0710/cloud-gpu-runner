# Agent Notes

This repo is a cloud-credit experiment workspace.

Rules:
- Do not commit or print real API keys.
- Keep provider credentials in `.env.local`; keep only variable names in docs.
- Before adding paid or credit-consuming calls, add a dry-run or minimal-call path.
- Record each meaningful experiment in `experiments/` using `_template.md`.
- Add a Next.js app only when there is enough data to visualize; use `apps/dashboard`.

GPU agent workflow:
- Follow `C:\dev\AGENTS.md` for agent-native NAVER/Kakao GPU execution.
- Use `C:\dev\cloud-credit-lab-console\scripts\Get-CloudCreditStatus.ps1` before each run.
- Use `C:\dev\cloud-credit-lab-console\scripts\Submit-GpuJob.ps1` to submit code; the website is optional.
