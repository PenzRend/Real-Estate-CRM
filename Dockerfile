# Flavio production image: `next build` with standalone output, run as a
# non-root user. Build variables (NEXT_PUBLIC_*, PRIVACY_*) are baked into the
# app at build time; everything else is read at runtime. See docs/DEPLOY.md.

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts skips the Supabase CLI download (dev-only tool).
RUN npm ci --ignore-scripts

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG PRIVACY_CONTROLLER
ARG PRIVACY_EMAIL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    PRIVACY_CONTROLLER=$PRIVACY_CONTROLLER \
    PRIVACY_EMAIL=$PRIVACY_EMAIL \
    NEXT_TELEMETRY_DISABLED=1
RUN npx next build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
