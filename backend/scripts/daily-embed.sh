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
#
# These are deliberately loose. A healthy run waits out per-minute rate limits for hours: 2026-09-27
# took just over three. The cap exists to stop a hang outliving the next scheduled start, not to
# hurry a run that is making progress, so anything comfortably under a day does the job.
EMBED_LIMIT_SECONDS=21600
MAP_LIMIT_SECONDS=1800
EVAL_LIMIT_SECONDS=1800

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

  # Elapsed time is read from the clock, not counted in loop iterations: `sleep 5` is at least five
  # seconds, and across a machine suspending it can be very much more. Counting iterations made the
  # cap silently unreachable on 2026-09-27, when a three-hour run was never measured as one.
  local started=$SECONDS
  while [ $((SECONDS - started)) -lt "$limit" ] && kill -0 "$pid" 2>/dev/null; do
    sleep 5
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

# Runs one step, keeping its output so the verdict can report what the step achieved rather than
# what it returned. An exit code has said "0" three times this week for a run that did nothing.
STEP_OUTPUT=""
run_step() {
  local limit=$1
  shift
  STEP_OUTPUT=$(mktemp)
  run_capped "$limit" "$@" >"$STEP_OUTPUT" 2>&1
  local status=$?
  cat "$STEP_OUTPUT"
  return $status
}

mkdir -p "$(dirname "$LOG_FILE")"
{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S %Z') daily indexing run"
  cd "$BACKEND_DIR" || exit 1

  run_step "$EMBED_LIMIT_SECONDS" npm run embed
  embed_status=$?
  # The last progress line is what was really embedded, whether or not the step ended well; there
  # is no progress line at all when every document is already up to date, which is a success.
  embedded=$(grep -oE 'Progress: [0-9]+/' "$STEP_OUTPUT" | tail -1 | grep -oE '[0-9]+')
  pending=$(grep -oE '[0-9]+ chunks still pending' "$STEP_OUTPUT" | tail -1 | grep -oE '^[0-9]+')
  # Reaching its own closing summary is what distinguishes a finished step from a broken one. The
  # exit code does not: a run stopped by the daily quota exits 1 having embedded hundreds of chunks.
  if grep -q 'chunks still pending' "$STEP_OUTPUT"; then
    embed_result="${embedded:-0} chunks"
    [ -z "$embedded" ] && embed_result="nothing to do"
  else
    embed_result="${embedded:-0} chunks then FAILED"
  fi
  rm -f "$STEP_OUTPUT"

  # Rebuild the projection even after a partial run, so the visualization keeps up.
  run_step "$MAP_LIMIT_SECONDS" npm run map
  mapped=$(grep -oE 'Stored [0-9]+ points' "$STEP_OUTPUT" | tail -1 | grep -oE '[0-9]+')
  rm -f "$STEP_OUTPUT"

  # Re-score retrieval against the benchmark. Question vectors are cached after the first run, so
  # this normally costs no quota and keeps the scoreboard current as more of the catalogue indexes.
  run_step "$EVAL_LIMIT_SECONDS" npm run eval
  scored=$(grep -oE 'hit@5 [0-9.]+%' "$STEP_OUTPUT" | head -1)
  grep -q 'Saved;' "$STEP_OUTPUT" || scored=""
  rm -f "$STEP_OUTPUT"

  # One line saying what the run actually achieved. Anything a step failed to do reads as FAILED
  # here, so a glance at the tail of this log is enough to know whether a day was lost — and a step
  # with nothing left to do says so rather than crying wolf.
  echo "=== $(date '+%H:%M:%S') done (embed exit ${embed_status})"
  echo "=== verdict: embedded ${embed_result} · map ${mapped:-FAILED} points · benchmark ${scored:-FAILED}${pending:+ · ${pending} chunks left}"
  echo
} >>"$LOG_FILE" 2>&1
