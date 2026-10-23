# Scrubcast

Ask a question about a podcast episode and get an answer with clickable timestamps. Click a timestamp and the YouTube player jumps to the moment the speaker said it.

It's a small RAG (retrieval-augmented generation) app over podcast transcripts. You don't scrub through three hours of audio looking for the part about tokenizers. You ask "why does Karpathy blame tokenizers for spelling bugs?" and land on that answer.

## What it does today, and what it doesn't

**Any YouTube video with captions.** Paste a link and Scrubcast fetches the video's captions with their timestamps, groups them into 30 to 45 second passages, embeds each passage, and saves the result to `data/library/<id>.json`. The video then shows up in the episode picker and you can ask it questions. A 3.5-hour episode (Lex Fridman #333) took 18 seconds and produced 376 passages. Pasting the same link again reuses the saved index.

Captions don't say who is talking, so ingested passages are labeled "Speaker". Auto-generated captions work but have no punctuation, so passage breaks fall on time limits instead of sentence ends.

**Two built-in demo episodes** also ship with the repo (Karpathy on Lex Fridman, Hassabis on Dwarkesh). Their transcripts in [`src/data/raw-episodes.ts`](./src/data/raw-episodes.ts) are short hand-written paraphrases with approximate timestamps, not real captions. To search the real transcript of either one, paste its YouTube link.

It does **not** yet:

- work on videos without captions (that needs audio transcription)
- take a podcast RSS feed or audio file
- search across several episodes at once

## How a question gets answered

1. **Index (once per video).** `POST /api/ingest` takes a YouTube link, fetches the captions through YouTube's InnerTube player endpoint (no API key), chunks them, and embeds every chunk with `Xenova/bge-small-en-v1.5`. The model runs locally in Node, so embeddings cost nothing. Each video's 384-number vectors go into `data/library/`. The built-in demo episodes are indexed the same way by `npm run index` into `src/data/indexed-episodes.json`.
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

### By hand (for demo transcripts)

1. Add an entry to `RAW_EPISODES` in [`src/data/raw-episodes.ts`](./src/data/raw-episodes.ts) with the YouTube video ID, optional `suggestedQueries`, and a list of chunks. Each chunk has `startTime`, `endTime` (seconds), `speaker` and `text`.
2. Rebuild the index:

```bash
npm run index
```

The episode then appears in the header's episode picker.

## Project layout

```
scrubcast/
├── data/library/                 # Ingested YouTube episodes (git-ignored, created at runtime)
├── data/summaries/               # Whole-video summaries (git-ignored, created at runtime)
├── scripts/build-index.ts        # Embeds raw transcripts into indexed-episodes.json
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
│   │   ├── raw-episodes.ts       # Source transcripts
│   │   └── indexed-episodes.json # Generated: transcripts plus embeddings
│   ├── lib/
│   │   ├── embeddings.ts         # bge-small pipeline and cosine similarity
│   │   ├── episodes.ts           # Episode lookup and the data/library store (server only)
│   │   ├── youtube.ts            # Parse YouTube links, fetch metadata and timed captions
│   │   ├── ingest.ts             # Captions to chunks to embeddings to saved episode
│   │   ├── summary.ts            # Background whole-video summary: chapters, overview, key points
│   │   ├── search.ts             # Vector search over one episode
│   │   ├── groq.ts               # Prompt, Groq call, citation parsing, fallback
│   │   ├── groqKeys.ts           # Primary/backup key failover for every Groq call
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
