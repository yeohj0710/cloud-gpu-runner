# Architecture

## Purpose

This repo tracks cloud credits, available APIs, experiment ideas, and concrete results.
It is intentionally lightweight until the service direction is clearer.

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

- NCP Object Storage: store generated artifacts, PDFs, images, or audio output.
- NCP CLOVA Studio: test summarization, extraction, or classification workflows.
- NCP OCR / document AI: compare against local PDF/OCR workflows if credits allow.
- CDN/static hosting: serve generated assets cheaply.
- Kakao Cloud later: compare object storage, VM, database, and AI-related options.

## Decision log

- 2026-05-12: Started without Next.js. Dashboard is deferred until experiment data exists.
