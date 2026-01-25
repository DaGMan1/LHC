FROM node:20-slim AS builder
WORKDIR /app

# Build arg for API URL - MUST be passed at build time for Next.js
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
COPY turbo.json ./
COPY apps/web/package*.json ./apps/web/
COPY packages/tsconfig/package*.json ./packages/tsconfig/
COPY packages/tsconfig/base.json ./packages/tsconfig/
RUN npm install
COPY . .
RUN npm run build -w web

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV production
# Set the correct architecture for Cloud Run
ENV NEXT_TELEMETRY_DISABLED 1

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
ENV PORT 3000
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD ["node", "apps/web/server.js"]
