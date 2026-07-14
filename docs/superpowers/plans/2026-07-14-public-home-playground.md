# Public Homepage AI Playground

## Goal

Place the ready-to-run Qwen 7B training and saved-model inference experience directly on the public homepage. Browsing remains public; only paid execution asks for password `0903` through the existing server-side authentication and execution guards.

## Implementation

1. Add a sanitized saved-model projection to `/api/public-dashboard` without storage bucket or artifact keys.
2. Add a homepage playground section between usage and job history with one-click training, accumulated models, prompt input, execution status, and a compact password dialog.
3. Reuse the existing protected storage, estimate, jobs, and provider launch APIs after password login. Resolve private model artifact details only after authentication.
4. Remove visible administrator navigation from the public page; keep the existing `/jobs` route available for operations.
5. Add focused contract tests, run the complete test suite, visually verify desktop/mobile, then deploy and smoke-check production without starting a paid GPU.

