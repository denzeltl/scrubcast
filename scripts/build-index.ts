import fs from "fs";
import path from "path";

// Freezes the featured videos into src/data so a fresh deploy has them ready:
// transcript passages + embeddings in indexed-episodes.json, whole-video summaries in
// built-in-summaries.json.
//
// To change the featured videos:
//   1. Run the app with SCRUBCAST_SAVE_LIBRARY=1, paste each link, and wait for "About this video" to fill in
//      (that writes data/library/<id>.json and data/summaries/<id>.json)
//   2. Update FEATURED below (ids are "yt-" + the YouTube video id)
//   3. npm run index

const FEATURED: { id: string; suggestedQueries: string[] }[] = [
  {
    id: "yt-scwlR0QHGOk", // Marques Brownlee: The new Tesla Roadster, my honest reaction (23 min)
    suggestedQueries: [
      "What's MKBHD's honest reaction to the new Roadster?",
      "Will the Roadster ever be street-legal?",
      "How does the fan-powered downforce work?",
      "Was the flying demo real?",
    ],
  },
  {
    id: "yt-1x-i9z617z4", // Kurzgesagt: How we make money on YouTube (10 min)
    suggestedQueries: [
      "How does Kurzgesagt make most of its money?",
      "How much do YouTube ads actually pay them?",
      "Does Bill Gates influence their videos?",
      "How did the channel get started?",
    ],
  },
  {
    id: "yt-arj7oStGLkU", // Tim Urban, TED: Inside the mind of a master procrastinator (14 min)
    suggestedQueries: [
      "What is the Instant Gratification Monkey?",
      "When does the Panic Monster show up?",
      "Why is procrastination without deadlines so dangerous?",
      "What's the Life Calendar at the end of the talk?",
    ],
  },
  {
    id: "yt-UF8uR6Z6KLc", // Steve Jobs: 2005 Stanford Commencement Address (15 min)
    suggestedQueries: [
      "What are the three stories Jobs tells?",
      "Why did he drop out of college?",
      "How did getting fired from Apple turn out to be good?",
      "What does \"stay hungry, stay foolish\" mean here?",
    ],
  },
  {
    id: "yt-qp0HIF3SfI4", // Simon Sinek, TED: How great leaders inspire action (19 min)
    suggestedQueries: [
      "What is the Golden Circle?",
      "Why does Apple sell more than its competitors?",
      "What happened to TiVo?",
      "What does the brain have to do with \"start with why\"?",
    ],
  },
  {
    id: "yt-aircAruvnKk", // 3Blue1Brown: But what is a neural network? (19 min)
    suggestedQueries: [
      "What does a single neuron hold?",
      "Why are there hidden layers?",
      "What are weights and biases for?",
      "Why use ReLU instead of sigmoid?",
    ],
  },
  {
    id: "yt-iCvmsMzlF7o", // Brené Brown, TED: The power of vulnerability (21 min)
    suggestedQueries: [
      "What do wholehearted people have in common?",
      "How does she define shame?",
      "Why can't we selectively numb emotions?",
      "What did her breakdown teach her?",
    ],
  },
];

const root = path.resolve(__dirname, "..");
const read = (file: string) => JSON.parse(fs.readFileSync(path.join(root, file), "utf-8"));

// Already-bundled videos are kept as they are, so data/ only needs the new ones
const bundledEpisodes: { id: string }[] = read("src/data/indexed-episodes.json");
const bundledSummaries: Record<string, unknown> = read("src/data/built-in-summaries.json");

const episodes = [];
const summaries: Record<string, unknown> = {};

for (const { id, suggestedQueries } of FEATURED) {
  const bundled = bundledEpisodes.find((ep) => ep.id === id);
  if (bundled && bundledSummaries[id]) {
    episodes.push({ ...bundled, suggestedQueries });
    summaries[id] = bundledSummaries[id];
    console.log(`✓ ${id} (already bundled)`);
    continue;
  }

  const episodeFile = `data/library/${id}.json`;
  const summaryFile = `data/summaries/${id}.json`;
  for (const file of [episodeFile, summaryFile]) {
    if (!fs.existsSync(path.join(root, file))) {
      throw new Error(`${file} is missing. Paste the video into the app and let its summary finish first.`);
    }
  }
  const episode = read(episodeFile);
  episodes.push({ ...episode, suggestedQueries });
  summaries[id] = read(summaryFile);
  console.log(`✓ ${episode.title} (${episode.chunks.length} passages)`);
}

fs.writeFileSync(path.join(root, "src/data/indexed-episodes.json"), JSON.stringify(episodes), "utf-8");
fs.writeFileSync(path.join(root, "src/data/built-in-summaries.json"), JSON.stringify(summaries, null, 2), "utf-8");
console.log(`\nWrote ${episodes.length} featured episodes to src/data/`);
