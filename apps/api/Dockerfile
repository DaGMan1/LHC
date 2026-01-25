FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/tsconfig/package*.json ./packages/tsconfig/
COPY packages/tsconfig/base.json ./packages/tsconfig/
RUN npm install
COPY . .
RUN npm run build -w api

FROM node:20-slim AS runner
WORKDIR /app
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3001
ENV PORT 3001
CMD ["node", "dist/index.js"]
