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
}
