# Use Cases

## Priority 1: Research / TIPS Work

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

## Priority 2: Company-Internal Utilities

Keep experiments reusable for company needs even when they start from research files.

Candidate utilities:

- Document intake and cleanup.
- File storage and signed download links.
- Admin-only batch processing.
- AI-assisted classification, summarization, and search.
- Lightweight dashboards after enough data exists.

## Priority 3: Cloud Provider Comparison

Do not build a large multi-cloud abstraction first. Compare providers through small
experiments with the same shape:

- What did it do?
- How much credit did it use?
- Was it easier than local/Vercel-only tooling?
- Is it reusable for research or company workflows?
