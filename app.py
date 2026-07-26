import sys
import os

# Absolute path to backend directory and app module directory
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
app_dir = os.path.join(backend_dir, "app")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if app_dir not in sys.path:
    sys.path.insert(0, app_dir)

# Load environment variables from backend/.env
env_file = os.path.join(backend_dir, ".env")
if os.path.exists(env_file):
    from dotenv import load_dotenv
    load_dotenv(env_file)

# Import backend/app/main.py directly to avoid module name collision with app.py
import main as backend_main
from a2wsgi import ASGIMiddleware

# WSGI callable expected by Toolforge uWSGI
app = ASGIMiddleware(backend_main.app)
