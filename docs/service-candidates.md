# Service Candidates

## High-value candidates

| Use case | Candidate services | Why it matters |
| --- | --- | --- |
| Generated artifact storage | Object Storage, CDN | Useful across PDF, audio, image, and report workflows |
| Document/OCR experiments | OCR, document AI | Directly reusable for scanned PDFs and course/research documents |
| LLM extraction/summarization | CLOVA Studio or similar | Useful for note generation, research extraction, and summarization |
| Batch jobs | Server/Container/Cloud Functions | Run credit-bounded experiments without keeping a local machine busy |
| Small database | Managed DB or serverless DB | Track experiments, costs, provider metadata |
| Dashboard later | Next.js on Vercel | Visualize credits and experiment results after data exists |

## Not first priority

- Full production app architecture before the experiment shape is clear.
- Complex multi-cloud abstraction before at least two providers are actively used.
- GPU/server experiments unless there is a concrete workload and cost cap.
