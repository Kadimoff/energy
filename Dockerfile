# Smart Industry Energy — energy.munsif.im
# Build: lint/typecheck/test/build must pass, otherwise no image (Coolify keeps the running version).
FROM node:22-alpine AS build
WORKDIR /src/app
ENV NODE_ENV=development
COPY app/package.json app/package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY app/ ./
RUN npm run typecheck && npm test && npm run build

FROM node:22-alpine
WORKDIR /srv
ENV NODE_ENV=production PORT=3000
COPY deploy/serve.mjs ./serve.mjs
COPY --from=build /src/app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "serve.mjs"]
