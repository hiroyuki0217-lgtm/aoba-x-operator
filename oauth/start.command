#!/bin/zsh
set -eu
umask 077
SCRIPT_DIR=${0:A:h}
cd "$SCRIPT_DIR"
node server.mjs &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM
sleep 1
open "http://127.0.0.1:3000/"
wait "$SERVER_PID"
