# syntax=docker/dockerfile:1

# ---- deps: full install (postinstall needs devDependencies for patch-package/copyfiles) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY patches ./patches
RUN npm ci

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

# ---- runtime: prune devDependencies, no source, no build tools ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
RUN npm prune --omit=dev

COPY --from=build /app/build ./build
COPY --from=build /app/server-build ./server-build
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh

EXPOSE 8081
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server-build/index.js"]
