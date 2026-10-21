#!/usr/bin/env bash
set -euo pipefail
: "${CONSTRUCTOR_SSH_HOST:?Set SSH host}"
: "${CONSTRUCTOR_DEPLOY_DIR:?Set existing deployment directory}"
images="${1:?Usage: deploy.sh release-images.env}"
test -f "$images"
[[ "$CONSTRUCTOR_DEPLOY_DIR" =~ ^/[a-zA-Z0-9_./-]+$ ]] || { echo 'Invalid deployment directory' >&2; exit 1; }
scp -- "$images" "$CONSTRUCTOR_SSH_HOST:$CONSTRUCTOR_DEPLOY_DIR/release-images.next.env"
ssh -- "$CONSTRUCTOR_SSH_HOST" bash -s -- "$CONSTRUCTOR_DEPLOY_DIR" <<'REMOTE'
set -euo pipefail
cd -- "$1"
# Pull before changing the active pair. Runtime Compose has no npm build secrets.
docker compose --env-file .env --env-file release-images.next.env pull web api
if test -f release-images.env; then cp release-images.env release-images.previous.env; fi
mv release-images.next.env release-images.env
if ! docker compose --env-file .env --env-file release-images.env up -d --no-build --wait web api; then
  if test -f release-images.previous.env; then
    cp release-images.previous.env release-images.env
    docker compose --env-file .env --env-file release-images.env up -d --no-build --wait web api
  fi
  exit 1
fi
REMOTE
