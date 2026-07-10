#!/bin/bash

# Wikimedia Commons Bridge Dev Startup Script
# Starts FastAPI backend and Vite React frontend concurrently.

# Trap EXIT signals to clean up all background processes on shell exit
trap "kill 0" EXIT

echo "=========================================================="
echo " Starting Wikimedia Commons Bridge Local Environment"
echo "=========================================================="

# 1. Setup Backend
echo "--> Initializing Backend Service..."
cd backend
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment .venv..."
    python3 -m venv .venv
fi

source .venv/bin/activate
echo "Installing backend dependencies..."
pip install -r requirements.txt

echo "Starting FastAPI backend on http://localhost:8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 2. Setup Frontend
echo "--> Initializing Frontend Service..."
cd ../frontend

echo "Starting Vite dev server on http://localhost:5173..."
npm run dev &
FRONTEND_PID=$!

echo "=========================================================="
echo " All services running. Press [CTRL+C] to stop."
echo "=========================================================="

# Wait for background jobs
wait
