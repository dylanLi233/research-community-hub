# Agent Development Rules

## Scope

This repository implements a membership research-content website. The website receives already-processed content from Hermes and does not parse, translate, summarize, or repair source PDFs.

## Architecture

- Next.js App Router and TypeScript
- Cloudflare Workers through `@opennextjs/cloudflare`
- Cloudflare D1 for relational data
- Cloudflare R2 for images and other assets
- Route Handlers for browser, admin, and Hermes APIs

## Mandatory rules

1. Work on one task card at a time.
2. Use one branch and one pull request per task card.
3. Do not implement later-task features early.
4. Membership content must be removed on the server before a response is returned.
5. Never send full member HTML to an unauthorized browser and hide it with CSS or JavaScript.
6. Import APIs perform deterministic validation only. Missing or invalid Hermes fields must produce machine-readable errors.
7. Every write endpoint must define authentication, authorization, validation, idempotency, and audit behavior.
8. Cloudflare production compatibility must be checked with `npm run cf:build`, not only `next dev`.
9. Do not add PostgreSQL, Redis, a standalone Go service, or Docker as V1 runtime dependencies.
10. Do not add payments, self-registration, social login, stock quotes, selection, backtesting, comments, or original-PDF downloads unless a later approved task explicitly requires them.
