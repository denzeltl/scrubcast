export interface TranscriptChunk {
  id: string;
  episodeId: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  speaker: string;
  text: string;
  embedding?: number[];
}

export interface PodcastEpisode {
  id: string;
  title: string;
  showTitle: string;
  host: string;
  guest: string;
  youtubeId: string;
  duration: number; // in seconds
  coverImage?: string;
  suggestedQueries?: string[];
  chunks: TranscriptChunk[];
}

export interface SummaryChapter {
  startTime: number; // seconds
  title: string;
  summary: string;
}

export interface EpisodeSummary {
  overview: string;
  mainArgument: string;
  keyPoints: { seconds: number; text: string }[];
  chapters: SummaryChapter[];
  model: string;
  createdAt: string;
}

export type SummaryStatus =
  | { state: "ready"; summary: EpisodeSummary }
  | { state: "running"; done: number; total: number }
  | { state: "error"; error: string }
  | { state: "none" } // not generated yet
  | { state: "unavailable" }; // no Groq key

export interface Citation {
  timestamp: string; // e.g. "04:12"
  seconds: number;
  speaker: string;
  chunkId: string;
  snippet: string;
}

export interface SearchMatch {
  chunk: TranscriptChunk;
  score: number; // 0 to 1 cosine similarity
}

export interface SearchResult {
  query: string;
  answer: string;
  citations: Citation[];
  topChunks: SearchMatch[];
  latencyMs: {
    embedding: number;
    search: number;
    synthesis: number;
    total: number;
  };
  isFallbackGroq?: boolean;
  model?: string; // Groq model that wrote the answer
  usedSummary?: boolean; // whole-video summary was part of the context
}
