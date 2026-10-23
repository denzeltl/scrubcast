# Scrubcast

All UI, design, and motion work in this project uses the elan skill; DESIGN.md is its source of truth.

## Development & Architecture Notes
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4.
- Pasted videos are private and in-memory only (`src/lib/episodes.ts`); only featured videos are listed. Per-visitor limits live in `src/lib/rateLimit.ts`. Deploy as a long-running server (Dockerfile), not serverless.
- Featured videos are frozen into `src/data/` by `npm run index` (scripts/build-index.ts); everything else is pasted in at runtime.
- Local Embeddings: `@xenova/transformers` running `Xenova/bge-small-en-v1.5`.
- Synthesis: `groq-sdk` with `openai/gpt-oss-120b` (override with `GROQ_MODEL`) grounded on top cosine-similarity transcript chunks.
- All Groq calls go through `src/lib/groqKeys.ts` (`createChatCompletion`), which fails over from `GROQ_API_KEY` to `GROQ_API_KEY_BACKUP` on 401/403/429.
- Whole-video summaries: `src/lib/summary.ts` map-reduces the transcript on `openai/gpt-oss-20b` in the background, paced under Groq's per-model tokens/minute cap. Job state is on `globalThis` because Next.js may load a module once per route.
- Video Playback: `react-youtube` / YouTube IFrame API with `.seekTo(seconds, true)`.
