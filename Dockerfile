# syntax=docker/dockerfile:1

# ---- deps: full install (postinstall needs devDependencies for patch-package/copyfiles) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches ./patches
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- build: CRA build (REACT_APP_* is inlined at build time) + server tsc build ----
FROM deps AS build
WORKDIR /app
COPY . .

ARG REACT_APP_FIREBASE_API_KEY
ARG REACT_APP_FIREBASE_AUTH_DOMAIN
ARG REACT_APP_FIREBASE_DATABASE_URL
ARG REACT_APP_FIREBASE_STORAGE_BUCKET
ARG REACT_APP_FIREBASE_MESSAGING_SENDER_ID
ARG REACT_APP_TWILIO_ENVIRONMENT
ARG REACT_APP_DISABLE_TWILIO_CONVERSATIONS
ARG REACT_APP_ENABLE_ATTENTION_CV
ARG REACT_APP_TOKEN_ENDPOINT
ARG REACT_APP_COMPLETE_ROOM_ENDPOINT
ARG REACT_APP_GIT_TAG
ARG REACT_APP_GIT_COMMIT
ENV CI=true \
    GENERATE_SOURCEMAP=false \
    REACT_APP_FIREBASE_API_KEY=$REACT_APP_FIREBASE_API_KEY \
    REACT_APP_FIREBASE_AUTH_DOMAIN=$REACT_APP_FIREBASE_AUTH_DOMAIN \
    REACT_APP_FIREBASE_DATABASE_URL=$REACT_APP_FIREBASE_DATABASE_URL \
    REACT_APP_FIREBASE_STORAGE_BUCKET=$REACT_APP_FIREBASE_STORAGE_BUCKET \
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID=$REACT_APP_FIREBASE_MESSAGING_SENDER_ID \
    REACT_APP_TWILIO_ENVIRONMENT=$REACT_APP_TWILIO_ENVIRONMENT \
    REACT_APP_DISABLE_TWILIO_CONVERSATIONS=$REACT_APP_DISABLE_TWILIO_CONVERSATIONS \
    REACT_APP_ENABLE_ATTENTION_CV=$REACT_APP_ENABLE_ATTENTION_CV \
    REACT_APP_TOKEN_ENDPOINT=$REACT_APP_TOKEN_ENDPOINT \
    REACT_APP_COMPLETE_ROOM_ENDPOINT=$REACT_APP_COMPLETE_ROOM_ENDPOINT \
    REACT_APP_GIT_TAG=$REACT_APP_GIT_TAG \
    REACT_APP_GIT_COMMIT=$REACT_APP_GIT_COMMIT

RUN npm run build \
 && npx tsc -p server/tsconfig.json

# ---- server-deps: production dependencies, trimmed to what the compiled server loads ----
# Installed fresh instead of copying the build stage's node_modules and pruning:
# a prune in a later layer cannot shrink the layer that already holds the dev
# dependencies. --ignore-scripts skips postinstall (patch-package/copyfiles are
# devDependencies and only matter for the client build). `dependencies` is mostly
# the React client (already compiled into build/), so the full install is ~1.1 GB;
# server-runtime-deps.js keeps only the packages the server requires (~110 MB) —
# a layer that big timed out on its final commit to ACR.
FROM node:22-alpine AS server-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --ignore-scripts
COPY scripts/server-runtime-deps.js ./scripts/server-runtime-deps.js
COPY --from=build /app/server-build ./server-build
RUN node scripts/server-runtime-deps.js /app /app/server-build /out

# ---- runtime: the server's dependencies only, no source, no build tools ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY --from=server-deps /out/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/server-build ./server-build
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 8081
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server-build/index.js"]
