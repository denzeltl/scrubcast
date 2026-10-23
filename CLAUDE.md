# Scrubcast

All UI, design, and motion work in this project uses the elan skill; DESIGN.md is its source of truth.

## Development & Architecture Notes
- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4.
- Local Embeddings: `@xenova/transformers` running `Xenova/bge-small-en-v1.5`.
- Synthesis: `groq-sdk` with `llama-3.3-70b-versatile` grounded on top cosine-similarity transcript chunks.
- Video Playback: `react-youtube` / YouTube IFrame API with `.seekTo(seconds, true)`.
