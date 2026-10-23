import { getAllEpisodes, stripEmbeddings } from "@/lib/episodes";
import { Workbench } from "@/components/Workbench";

// Ingested episodes are added at runtime, so render per request instead of once at build
export const dynamic = "force-dynamic";

export default function ScrubcastPage() {
  // Embeddings stay on the server; the browser only needs text and timestamps
  const episodes = getAllEpisodes().map(stripEmbeddings);
  return <Workbench episodes={episodes} />;
}
