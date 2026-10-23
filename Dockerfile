# Scrubcast needs a long-running Node server, not serverless functions: summaries run
# as background jobs after a request returns, and pasted videos are held in memory.
# Runs on Hugging Face Spaces, Railway, Render, Fly.io, or any VPS with Docker.

# Debian slim (glibc), because onnxruntime-node ships glibc binaries
FROM node:22-slim

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Build and run as the unprivileged "node" user (UID 1000, which Hugging Face Spaces
# requires). It owns /app so Next's cache and the model cache are writable.
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
# Build, then download the embedding model into the image so the first visitor
# after a deploy doesn't wait for it
RUN npm run build && node scripts/warm-model.mjs

ENV NODE_ENV=production
# Hugging Face Spaces: set app_port in the Space's README to match (see README "Deploying")
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Set GROQ_API_KEY (and optionally GROQ_API_KEY_BACKUP, SITE_URL) in the host's settings
CMD ["npm", "start"]
