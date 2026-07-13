# Cloud GPU Runner Console agent contract

This repository is the canonical, project-independent Cloud GPU Runner entrypoint.

When a user working in another repository says to use `C:\dev\cloud-gpu-runner-console` for training or inference, treat that instruction as a request to complete the following workflow autonomously:

1. Read the target repository's agent instructions and inspect its environment, dependency files, training/inference entrypoints, tests, and non-sensitive sample data.
2. Run the cheapest relevant local validation first. Derive the remote command from the project; never assume `train.py` exists.
3. Use `C:\dev\cloud-gpu-runner-console\scripts\cloud-gpu.ps1`. Use provider `auto`, which prefers NAVER and falls back to Kakao when NAVER is not ready.
4. For a bare one-line request with no explicit budget, the request pre-approves at most one GPU instance, 60 minutes, and 2,000 KRW estimated cost excluding VAT. Pass `-ApproveEstimatedCost` only inside those bounds. Stop and request approval before exceeding either bound.
5. Upload only public data or non-sensitive project samples. Exclude secrets, local environments, Git metadata, dependencies, prior artifacts, and `etc`. Never change or issue API keys, credentials, or payment methods.
6. Wait for completion, download the log and result, record estimated and actual usage, and verify GPU instance cleanup. Verify public-IP cleanup when one was allocated. If a timeout occurs, cancel the job and verify cleanup.
7. Store evidence under `<target-project>\artifacts\cloud-gpu\<job-id>\`. Diagnose failures from downloaded evidence, make the narrowest project fix, run local regression checks, and retry only while the approved budget and runtime remain.
8. Before reporting completion, confirm no paid GPU remains and report provider, job ID, duration, estimate, actual cost, remaining credit, artifact path, and cleanup state.

An explicit user budget, duration, provider, data restriction, or retry policy overrides the conservative defaults above. Never infer approval beyond the current request.

