# Scrubcast

Ask a question about a podcast episode and get an answer with clickable timestamps. Click a timestamp and the YouTube player jumps to the moment the speaker said it.

It's a small RAG (retrieval-augmented generation) app over podcast transcripts. You don't scrub through three hours of audio looking for the part about tokenizers. You ask "why does Karpathy blame tokenizers for spelling bugs?" and land on that answer.

## What it does today, and what it doesn't

**Any YouTube video with captions, up to 60 minutes.** Paste a link and Scrubcast fetches the video's captions with their timestamps, groups them into 30 to 45 second passages, embeds each passage, and starts a whole-video summary. Pasted videos are private to the visitor who pasted them: they're held in server memory (the 20 most recent), never shown to other visitors and never written to disk. If the server forgets one (restart, or newer videos pushed it out), the next question re-indexes it automatically.

Captions don't say who is talking, so ingested passages are labeled "Speaker". Auto-generated captions work but have no punctuation, so passage breaks fall on time limits instead of sentence ends.

**Three featured videos** ship with the repo, indexed and summarized from their real captions (see [Featured videos](#featured-videos)). Anything else, paste a link.

It does **not** yet:

- work on videos without captions (that needs audio transcription)
- take a podcast RSS feed or audio file
- search across several episodes at once

## How a question gets answered

1. **Index (once per video).** `POST /api/ingest` takes a YouTube link, fetches the captions through YouTube's InnerTube player endpoint (no API key), chunks them, and embeds every chunk with `Xenova/bge-small-en-v1.5`. The model runs locally in Node, so embeddings cost nothing. Each video's 384-number vectors are kept in server memory. The featured videos are frozen into `src/data/` by `npm run index`.
2. **Retrieve.** `POST /api/search` embeds your question with the same model and ranks the episode's chunks by cosine similarity. The top 5 come back.
3. **Generate.** Those 5 chunks, each labeled with its `[MM:SS]` start time, go to Groq's `openai/gpt-oss-120b` (set `GROQ_MODEL` to use another). The prompt tells it to answer only from the excerpts and cite the timestamps.
4. **Seek.** The UI turns every `[MM:SS]` in the answer into a button. Clicking it calls the YouTube IFrame API's `seekTo(seconds, true)`. Matching chunks also show up as pins on the player's timeline, and the transcript panel follows playback.

### Backup key

Set `GROQ_API_KEY_BACKUP` in `.env.local` and every Groq call (answers and summaries) fails over to it when the primary key is rejected (401/403: revoked, expired, mistyped) or rate-limited (429). A rejected key is skipped until the server restarts. A rate-limited key is retried after Groq's `retry-after`. If both keys are rate-limited, answers wait up to 10 seconds and summaries up to 2 minutes for one to free up.

Groq counts rate limits per organization, not per key. A second key from the same account protects you from a bad key but adds no capacity. For more capacity, the backup has to be on a different plan, such as a paid developer tier. Opening extra free accounts to stack free limits is the kind of thing provider terms usually forbid, so check Groq's terms before you do it.

Without a `GROQ_API_KEY`, or if the Groq call fails, step 3 falls back to quoting the two best-matching passages verbatim. Search and seeking still work.

## Whole-video questions

Retrieval only shows the answer model 5 passages, which is fine for "why did Tesla drop radar?" but useless for "what's the main argument?". So after a video is indexed, a background job reads the whole transcript and writes:

- an overview and the main argument
- 5 to 8 key points with timestamps
- chapters with titles, one-line summaries and start times

It's saved to `data/summaries/<id>.json` (git-ignored). Every answer then gets the overview, main argument, key points and chapter titles alongside the retrieved passages, and can cite chapter and key-point timestamps too.

**It's slow on Groq's free tier.** Each model is capped at 8,000 tokens per minute, and a single request can't exceed that. So the job summarizes the transcript about 3,500 tokens at a time and paces itself under the cap. A 20-minute video takes about a minute. The 3.5-hour Lex Fridman episode takes about 15 minutes. Questions work the whole time; they just don't use the summary until it's done. The job runs on `openai/gpt-oss-20b` so it has its own token budget and doesn't slow down live questions on `gpt-oss-120b`.

Summaries are built one at a time. If the server restarts mid-job, the job is lost and starts again the next time someone opens that video.

## Quickstart

```bash
npm install
```

Optional. For written answers, get a free key at [console.groq.com](https://console.groq.com) and put it in `.env.local`:

```bash
cp .env.local.example .env.local
```

```env
GROQ_API_KEY=gsk_your_key_here
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The first search downloads the embedding model (about 30 MB) into the Hugging Face cache, so it takes a few seconds. Later searches embed in tens of milliseconds.

## Adding an episode

Paste a YouTube link into the app. Or call the API directly:

```bash
curl -X POST localhost:3000/api/ingest -H "Content-Type: application/json" -d '{"url":"https://youtu.be/cdiD-9MMpb0"}'
```

### Featured videos

Three videos ship with the repo so a fresh deploy has something to try right away, with transcripts, embeddings and summaries already built:

- Marques Brownlee, "The NEW Tesla Roadster: My Honest Reaction" (23 min)
- Tim Urban, TED, "Inside the Mind of a Master Procrastinator" (14 min)
- Kurzgesagt, "How We Make Money on YouTube with 20M Subs" (10 min)

To change them, run the app locally with `SCRUBCAST_SAVE_LIBRARY=1` (so pasted videos are also written to `data/library/` and `data/summaries/`), paste the new links, and wait for each "About this video" card to fill in. Then edit `FEATURED` (ids and suggested questions) in [`scripts/build-index.ts`](./scripts/build-index.ts) and run:

```bash
npm run index
```

That copies them from `data/library/` and `data/summaries/` into `src/data/indexed-episodes.json` and `src/data/built-in-summaries.json`.

## Public use and limits

The defaults are set for a small public site. Each can be changed with an env var:

| Limit | Default | Env var |
|---|---|---|
| New videos per visitor | 5 per hour | `RATE_LIMIT_INGEST_PER_HOUR` |
| Questions per visitor | 30 per 10 minutes | `RATE_LIMIT_SEARCH_PER_10_MIN` |
| Longest video | 60 minutes | `MAX_VIDEO_MINUTES` |
| Videos indexing at once (all visitors) | 2 | `MAX_CONCURRENT_INGESTS` |
| Summaries waiting in line | 3 | `MAX_QUEUED_SUMMARIES` |
| Pasted videos kept in memory | 20 | `MAX_CACHED_VIDEOS` |

Visitors are told the limit and when to try again. Limits are counted per IP, in memory, per server instance.

## Deploying

Scrubcast needs a **long-running Node server**, not serverless functions (Vercel, Netlify): summaries run as background jobs after the request returns, and pasted videos live in server memory. Either of those breaks when each request is a separate short-lived function.

The repo has a `Dockerfile` that builds the app and pre-downloads the embedding model. It runs anywhere that takes a Docker image: Railway, Render, Fly.io, or a VPS. Give it about 1 GB of RAM; the embedding model and onnxruntime use a few hundred MB. Set `GROQ_API_KEY` (and optionally `GROQ_API_KEY_BACKUP`) in the host's environment settings. Run one instance, since rate limits and pasted videos are per instance.

**Check caption fetching on your host before launch.** YouTube sometimes blocks requests from datacenter IP ranges. After deploying, paste a link. If you get "YouTube won't serve this video" for videos that work locally, the host's IPs are blocked. The featured videos keep working either way, since they're bundled. The fixes are a different host or region, or routing YouTube requests through a residential proxy (a paid service).

## Brand

The look is "Broadcast × halftone": a near-black deck, amber for timecodes and actions, and a halftone sound wave cut by a red playhead as the logo. The same wave is the scrub bar under the video. Tokens and rules are in [`DESIGN.md`](./DESIGN.md), and the logo files and usage page are in [`brand/`](./brand/index.html). The mark is generated by `src/lib/brandMark.ts`. Regenerate the files with:

```bash
npx tsx scripts/build-brand.ts
```

## Project layout

```
scrubcast/
├── data/                         # Only with SCRUBCAST_SAVE_LIBRARY=1, for curating featured videos (git-ignored)
├── brand/                        # Logo, mark, favicon SVGs and the brand usage page
├── Dockerfile                    # Production image: build + pre-downloaded embedding model
├── scripts/build-index.ts        # Freezes the featured videos into src/data/
├── scripts/warm-model.mjs        # Downloads the embedding model (used by the Dockerfile)
├── src/
│   ├── app/
│   │   ├── api/ingest/route.ts   # YouTube link in, searchable episode out
│   │   ├── api/summary/route.ts  # Summary status, and start a summary job
│   │   ├── api/search/route.ts   # Retrieve top chunks, then synthesize an answer
│   │   ├── layout.tsx
│   │   └── page.tsx              # Server page; strips embeddings before sending episodes to the browser
│   ├── components/
│   │   ├── Workbench.tsx         # Client state: current episode, query, results, playback time
│   │   ├── StudioHeader.tsx      # Brand and episode picker
│   │   ├── SearchBar.tsx         # Question input and suggested questions
│   │   ├── SynthesizedAnswer.tsx # Answer with clickable [MM:SS] chips
│   │   ├── SemanticMatches.tsx   # Top retrieved chunks with similarity scores
│   │   ├── PlayerDeck.tsx        # YouTube player, timeline pins, transport controls
│   │   └── TranscriptFeed.tsx    # Full transcript that follows playback
│   ├── data/
│   │   ├── indexed-episodes.json # Featured videos: passages plus embeddings
│   │   └── built-in-summaries.json # Featured videos: whole-video summaries
│   ├── lib/
│   │   ├── embeddings.ts         # bge-small pipeline and cosine similarity
│   │   ├── episodes.ts           # Featured list + in-memory cache of pasted videos (server only)
│   │   ├── youtube.ts            # Parse YouTube links, fetch metadata and timed captions
│   │   ├── ingest.ts             # Captions to chunks to embeddings to saved episode
│   │   ├── summary.ts            # Background whole-video summary: chapters, overview, key points
│   │   ├── search.ts             # Vector search over one episode
│   │   ├── groq.ts               # Prompt, Groq call, citation parsing, fallback
│   │   ├── groqKeys.ts           # Primary/backup key failover for every Groq call
│   │   ├── rateLimit.ts          # Per-visitor limits for indexing and questions
│   │   └── time.ts               # [MM:SS] formatting and parsing
│   └── types/podcast.ts
├── DESIGN.md                     # Visual design contract (elan skill)
└── CLAUDE.md
```

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, `@xenova/transformers` for local embeddings, `groq-sdk` for generation, `react-youtube` for the player.

## Roadmap

YouTube links with captions work now. What's left for "paste any YouTube link or podcast, then ask it anything":

1. **Podcast ingestion.** Accept an RSS feed or audio URL, transcribe with Whisper (Groq hosts `whisper-large-v3-turbo` on the same API key), then chunk and embed the same way. Play audio with an `<audio>` element instead of YouTube.
2. **Storage.** One JSON file per video is fine for dozens of videos. Past that, move to SQLite with a vector extension.
3. **Videos without captions.** Fall back to downloading the audio and running it through the Whisper path.
