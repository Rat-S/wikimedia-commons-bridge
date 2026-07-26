import sys
import os

# Add backend directory to sys.path so 'app' package inside backend/ is imported
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "backend"))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Load environment variables from backend/.env
env_file = os.path.join(backend_path, ".env")
if os.path.exists(env_file):
    from dotenv import load_dotenv
    load_dotenv(env_file)

from app.main import app as fastapi_app
from a2wsgi import ASGIMiddleware

# WSGI entrypoint for Toolforge uWSGI runner
app = ASGIMiddleware(fastapi_app)
