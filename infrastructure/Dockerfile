FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY apps ./apps
COPY database ./database
RUN npm run build -w @nam/web
FROM node:22-slim
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production PORT=8080 WEB_DIST=/app/apps/web/dist
WORKDIR /app/apps/server
EXPOSE 8080
CMD ["npx","tsx","src/index.ts"]
