FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY tsconfig.json ./
COPY prisma/ prisma/
COPY src/ src/

RUN npx prisma generate
RUN vite build --config src/dashboard/vite.config.ts
RUN tsc

FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/src/dashboard/dist ./dist
COPY --from=builder /app/dist/dashboard/server ./dist-server
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3080
EXPOSE 3080

CMD ["node", "dist-server/index.js"]
