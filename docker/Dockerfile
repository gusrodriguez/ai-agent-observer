FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/dashboard/package.json packages/dashboard/
RUN npm ci --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared/ packages/shared/
COPY packages/dashboard/ packages/dashboard/

RUN npx prisma generate --schema packages/shared/src/prisma/schema.prisma
RUN npm run build -w packages/shared
RUN npm run build -w packages/dashboard

FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/packages/dashboard/dist ./dist
COPY --from=builder /app/packages/dashboard/dist-server ./dist-server
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=3080
EXPOSE 3080

CMD ["node", "dist-server/index.js"]
