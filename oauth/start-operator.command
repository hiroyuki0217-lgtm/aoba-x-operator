#!/bin/zsh
set -eu
umask 077
SCRIPT_DIR=${0:A:h}
cd "$SCRIPT_DIR"
if [[ -d .secrets ]]; then
  chmod 700 .secrets
  find .secrets -maxdepth 1 -type f -exec chmod 600 {} +
fi
node operator-server.mjs &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM
sleep 1
open "http://127.0.0.1:3001/app/"
wait "$SERVER_PID"
