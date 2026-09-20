#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "════════════════════════════════════════"
echo "   FloodShield — Starting Services"
echo "════════════════════════════════════════"

# ── Backend ──────────────────────────────────
echo ""
echo "▶ Setting up Python backend..."
cd "$ROOT/backend"

if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  echo "  Created virtual environment"
fi
source .venv/bin/activate
pip install -q -r requirements.txt
echo "  Backend dependencies installed"

echo "  Starting FastAPI on http://localhost:8000"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# ── Frontend ─────────────────────────────────
echo ""
echo "▶ Setting up React frontend..."
cd "$ROOT/frontend"

if [ ! -d "node_modules" ]; then
  npm install
  echo "  Frontend dependencies installed"
fi

echo "  Starting React dev server on http://localhost:3000"
npm run dev &
FRONTEND_PID=$!

# ── Cleanup on exit ──────────────────────────
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "════════════════════════════════════════"
echo "  Backend:   http://localhost:8000"
echo "  Frontend:  http://localhost:3000"
echo "  API Docs:  http://localhost:8000/docs"
echo "════════════════════════════════════════"
echo ""
echo "Press Ctrl+C to stop both services."
echo ""

wait
