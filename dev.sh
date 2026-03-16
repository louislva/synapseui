#!/usr/bin/env bash
set -e

cleanup() {
  echo ""
  echo "Shutting down..."
  kill 0
  wait
  exit 0
}

trap cleanup SIGINT SIGTERM

run_backend() {
  while true; do
    echo "[backend] Starting..."
    (cd backend && uv run uvicorn main:app --reload) || true
    echo "[backend] Crashed. Restarting in 2s..."
    sleep 2
  done
}

run_frontend() {
  while true; do
    echo "[frontend] Starting..."
    (cd frontend && npm run dev) || true
    echo "[frontend] Crashed. Restarting in 2s..."
    sleep 2
  done
}

run_backend &
run_frontend &
wait
