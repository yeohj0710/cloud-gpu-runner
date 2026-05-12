# Architecture

## Purpose

This repo tracks cloud credits, available APIs, experiment ideas, and concrete results.
It is intentionally lightweight until the service direction is clearer.

The most likely first use is research/TIPS work under:

```text
C:\Users\hjyeo\Desktop\웰박\10 TIPS
```

The same patterns should also stay reusable for company-internal features such as
document processing, file storage, batch jobs, admin tooling, and AI-assisted
summarization or extraction.

## Layers

1. Provider inventory
   - Credit amount
   - Expiration date
   - Available services
   - Required credentials

2. Experiment records
   - Goal
   - Provider/service used
   - Expected credit usage
   - Minimal verification method
   - Result and next action

3. Optional dashboard
   - Add later as `apps/dashboard`
   - Next.js + Vercel is a good fit once there is data worth filtering or visualizing

## Suggested first experiments

- NCP Object Storage: store generated TIPS/research artifacts, PDFs, images, or audio output.
- NCP CLOVA Studio: test summarization, extraction, or classification workflows for research documents.
- NCP OCR / document AI: compare against local PDF/OCR workflows for TIPS/R&D files if credits allow.
- CDN/static hosting: serve generated assets cheaply.
- Batch compute/functions: run repeatable document jobs without tying them to a local machine.
- Kakao Cloud later: compare object storage, VM, database, and AI-related options.

## Decision log

- 2026-05-12: Started without Next.js. Dashboard is deferred until experiment data exists.
- 2026-05-12: Marked research/TIPS work as the highest-probability use case and recorded NCP credit at about 5,300,000 KRW.
