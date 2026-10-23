# Scrubcast needs a long-running Node server, not serverless functions: summaries run
# as background jobs after a request returns, and pasted videos are held in memory.
# Runs on Railway, Render, Fly.io, or any VPS with Docker.

# Debian slim (glibc), because onnxruntime-node ships glibc binaries
FROM node:22-slim

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && node scripts/warm-model.mjs

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Set GROQ_API_KEY (and optionally GROQ_API_KEY_BACKUP) in the host's environment settings
CMD ["npm", "start"]
