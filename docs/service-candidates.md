# Service Candidates

## Best use order

The shortest-expiry grant decides the first work. The goal is not to consume credits quickly. Every spend should leave a reusable dataset, evaluation report, or production-ready adapter.

| Priority | Projects | Provider/service | First measurable result |
| ---: | --- | --- | --- |
| 1 | `nutrition-safety-engine`, `otc-nutrient-safety-engine` | NCP CLOVA OCR + Studio | Ingredient/amount/unit accuracy on 30 product-label images |
| 2 | `company-work-capture`, TIPS documents | NCP OCR + Studio + Object Storage | Task/evidence/deadline extraction on 20 non-sensitive documents |
| 3 | `wellnessbox-rnd` | KakaoCloud GPU + Object Storage | One fixed 480-case replay with identical frozen-eval metrics |
| 4 | `insane-search-testbed` | KakaoCloud Advanced Managed Search | Recall and latency on 100 fixed Korean queries |
| 5 | `window-back-recorder` | NCP CLOVA Speech | Searchable transcripts for three non-sensitive recordings |
| 6 | `n8n-youtube-shorts-automation` | NCP Object Storage | Restore test for ten already-published MP4/metadata sets |

| Use case | Candidate services | Why it matters |
| --- | --- | --- |
| Generated artifact storage | Object Storage, CDN | Useful across PDF, audio, image, and report workflows |
| Document/OCR experiments | OCR, document AI | Directly reusable for scanned PDFs and course/research documents |
| LLM extraction/summarization | CLOVA Studio or similar | Useful for note generation, research extraction, and summarization |
| Batch jobs | Server/Container/Cloud Functions | Run credit-bounded experiments without keeping a local machine busy |
| Small database | Managed DB or serverless DB | Track experiments, costs, provider metadata |
| Dashboard later | Next.js on Vercel | Visualize credits and experiment results after data exists |

## NCP subscription order

Subscribe only to services that have a bounded smoke test and cleanup path.

| Priority | NCP service | Subscribe now? | First test |
| --- | --- | --- | --- |
| 1 | Object Storage | Done | Create one bucket/object, verify, delete |
| 2 | CLOVA Studio | Yes, before 2026-07-31 | One Korean structured-extraction prompt with a 120-token cap |
| 3 | OCR | Yes, before 2026-07-31 | Product-label benchmark with a fixed answer key |
| 4 | Cloud Functions | Yes | Hello-world function, invoke once, delete |
| 5 | Cloud DB / DB service | Not yet | Create/delete only after cost cap is written |
| 6 | Server / VPC / Load Balancer | Not yet | Higher persistent cost risk |
| 7 | Kubernetes / GPU / Data analytics | Not yet | Skip until there is a concrete workload |

## Not first priority

- Full production app architecture before the experiment shape is clear.
- Complex multi-cloud abstraction before at least two providers are actively used.
- GPU/server experiments unless there is a fixed dataset, baseline runtime, automatic shutdown, and cost cap.
- Moving existing Vercel apps to VMs only to consume credits.
- CLOVA Speech/Voice for the current n8n Shorts workflow. Its source of truth explicitly keeps static cards, BGM, and no TTS.

## KakaoCloud gate

Do not create a VM, Kubernetes cluster, or Kubeflow resource until all four are true:

1. IAM access key and S3 credentials work.
2. The workload runs locally with a fixed input and metrics.
3. The resource has a maximum runtime and deletion command.
4. The first run is capped at 500,000 KRW.
