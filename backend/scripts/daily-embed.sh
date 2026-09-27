#!/bin/bash
# Embeds the next batch of chunks, rebuilds the 3D map, and re-runs the retrieval benchmark, daily.
#
# Gemini's free tier allows roughly 1,000 embeddings a day, so indexing a large catalogue takes
# several days of budgeted runs. This script is installed as a launchd job (see README) so those
# runs happen on their own.
set -uo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$HOME/Library/Logs/codebase-assistant-embed.log"

# Wall-clock caps. Node enforces its own per-request deadline, but launchd will not start tomorrow's
# run while today's is still alive, so one wedged process would silently stop indexing for good —
# which is exactly what happened on 2026-09-25. A run that overshoots is killed instead.
EMBED_LIMIT_SECONDS=5400
MAP_LIMIT_SECONDS=900
EVAL_LIMIT_SECONDS=900

# launchd starts with a bare environment, so node has to be put on the PATH explicitly.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

# Runs a command, killing it (and its children, since npm wraps the real work) if it overruns.
#
# This polls rather than arming a background timer: a subshell sitting in `sleep` does not act on
# TERM until that sleep returns, so a timer-based watchdog outlives the command it was guarding and
# makes the whole run take an unpredictable amount of time to finish.
run_capped() {
  local limit=$1
  shift
  "$@" &
  local pid=$!

  local waited=0
  while [ "$waited" -lt "$limit" ] && kill -0 "$pid" 2>/dev/null; do
    sleep 5
    waited=$((waited + 5))
  done

  if kill -0 "$pid" 2>/dev/null; then
    echo "!!! '$*' exceeded ${limit}s — killing it so tomorrow's run is not blocked"
    pkill -TERM -P "$pid" 2>/dev/null
    kill -TERM "$pid" 2>/dev/null
    sleep 10
    pkill -KILL -P "$pid" 2>/dev/null
    kill -KILL "$pid" 2>/dev/null
  fi

  wait "$pid"
  return $?
}

mkdir -p "$(dirname "$LOG_FILE")"
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') daily indexing run"
  cd "$BACKEND_DIR" || exit 1
  run_capped "$EMBED_LIMIT_SECONDS" npm run embed
  embed_status=$?
  # Rebuild the projection even after a partial run, so the visualization keeps up.
  run_capped "$MAP_LIMIT_SECONDS" npm run map
  # Re-score retrieval against the benchmark. Question vectors are cached after the first run, so
  # this normally costs no quota and keeps the scoreboard current as more of the catalogue indexes.
  run_capped "$EVAL_LIMIT_SECONDS" npm run eval
  echo "=== $(date '+%H:%M:%S') done (embed exit ${embed_status})"
  echo
} >>"$LOG_FILE" 2>&1
