#!/bin/bash
# Embeds the next batch of chunks and rebuilds the 3D map, once a day.
#
# Gemini's free tier allows roughly 1,000 embeddings a day, so indexing a large catalogue takes
# several days of budgeted runs. This script is installed as a launchd job (see README) so those
# runs happen on their own.
set -uo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$HOME/Library/Logs/codebase-assistant-embed.log"

# launchd starts with a bare environment, so node has to be put on the PATH explicitly.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

mkdir -p "$(dirname "$LOG_FILE")"
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') daily indexing run"
  cd "$BACKEND_DIR" || exit 1
  npm run embed
  embed_status=$?
  # Rebuild the projection even after a partial run, so the visualization keeps up.
  npm run map
  echo "=== $(date '+%H:%M:%S') done (embed exit ${embed_status})"
  echo
} >>"$LOG_FILE" 2>&1
