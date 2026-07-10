# Use Cases

## Priority 1: Product-label and evidence intake

The two safety-engine projects already have deterministic rules, evidence schemas, fixtures, and tests. That makes them the best place to measure whether cloud OCR and structured extraction are actually better than manual entry.

- Input: 30 non-sensitive product-label images.
- Output: ingredient, amount, unit, serving basis, evidence location, confidence.
- Gate: at least 90% field accuracy before any automatic knowledge-pack update.
- Provider: NCP CLOVA OCR, then HyperCLOVA X only for schema normalization.

## Priority 2: Research / TIPS Work

Likely source folder:

```text
C:\Users\hjyeo\Desktop\웰박\10 TIPS
```

Useful cloud-credit experiments:

- OCR and text extraction from PDFs, HWP-exported PDFs, images, and scanned documents.
- Summarization of R&D plans, research plans, evaluation comments, and supporting evidence.
- Structured extraction into tables: task, requirement, evidence, deadline, status.
- Generated artifact storage for processed files and review outputs.
- Batch jobs for repeated document checks.

## Priority 3: R&D compute

`C:\dev\wellnessbox-rnd` has a 480-case synthetic cohort, frozen evaluation, replay reports, and deterministic safety fallbacks. Use KakaoCloud GPU/Kubeflow only for one fixed replay or training job at a time. The cloud result must reproduce the local metrics before scaling.

## Priority 4: Company-Internal Utilities

Keep experiments reusable for company needs even when they start from research files.

Candidate utilities:

- Document intake and cleanup.
- File storage and signed download links.
- Admin-only batch processing.
- AI-assisted classification, summarization, and search.
- Lightweight dashboards after enough data exists.

## Priority 5: Cloud Provider Comparison

Do not build a large multi-cloud abstraction first. Compare providers through small
experiments with the same shape:

- What did it do?
- How much credit did it use?
- Was it easier than local/Vercel-only tooling?
- Is it reusable for research or company workflows?

## Deliberate non-goals

- Do not move `attendance`, `toeic-word-roulette`, or the safety-engine web UIs from Vercel just to spend credits.
- Do not add TTS to `n8n-youtube-shorts-automation`; its local contract forbids it.
- Do not upload private recordings, `.env` files, databases, or credential stores to shared Object Storage.
