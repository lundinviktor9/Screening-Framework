#!/bin/bash
# Start the deal pipeline FastAPI server

set -e

# Ensure dependencies are installed
echo "Installing dependencies..."
pip install -r extractor/requirements.txt > /dev/null 2>&1

# Start server
echo "Starting deal pipeline server on http://localhost:8787"
echo "API docs available at http://localhost:8787/docs"
uvicorn extractor.server:app --host 0.0.0.0 --port 8787 --reload
