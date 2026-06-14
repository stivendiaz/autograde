#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting LiveTest MVP..."

# Backend
echo "[backend] Installing deps..."
cd "$SCRIPT_DIR/backend"
if [ ! -d venv ]; then
  /opt/homebrew/bin/python3.13 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt -q

echo "[backend] Starting server on http://localhost:8000..."
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --log-level debug &
BACKEND_PID=$!

# Frontend
echo "[frontend] Installing deps..."
cd "$SCRIPT_DIR/frontend"
npm install --silent 2>/dev/null

echo "[frontend] Starting dev server on http://localhost:5173..."
npx vite --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

echo ""
echo "  Backend:  http://localhost:8000"
echo "  Frontend: http://localhost:5173"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
