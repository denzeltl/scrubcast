// Downloads the embedding model into the image at build time, so the first visitor
// after a deploy doesn't wait ~30 MB of download before their question is answered.
import { pipeline } from "@xenova/transformers";

const embed = await pipeline("feature-extraction", "Xenova/bge-small-en-v1.5", { quantized: true });
const out = await embed("warm up", { pooling: "mean", normalize: true });
console.log(`Embedding model ready (${out.data.length} dimensions)`);
