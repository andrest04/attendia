#!/bin/sh
set -e

# firebase-admin needs a service account key file on disk (server/firebaseAdmin.ts
# require()s it directly). It's gitignored and never built into the image, so it's
# decoded from a runtime secret into the compiled server's working directory instead.
if [ -n "$FIREBASE_SERVICE_ACCOUNT_BASE64" ]; then
  echo "$FIREBASE_SERVICE_ACCOUNT_BASE64" | base64 -d > /app/server-build/serviceAccountKey.json
fi

exec "$@"
