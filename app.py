import sys
import os
import importlib.util

# Root and backend paths
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, "backend")

if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Load environment variables
env_file = os.path.join(backend_dir, ".env")
if os.path.exists(env_file):
    from dotenv import load_dotenv
    load_dotenv(env_file)

# Explicitly bind module 'app' to backend/app package
backend_app_dir = os.path.join(backend_dir, "app")
backend_app_init = os.path.join(backend_app_dir, "__init__.py")

spec = importlib.util.spec_from_file_location(
    "app", 
    backend_app_init, 
    submodule_search_locations=[backend_app_dir]
)
backend_app = importlib.util.module_from_spec(spec)
sys.modules["app"] = backend_app
spec.loader.exec_module(backend_app)

# Import backend/app/main.py cleanly
import app.main as backend_main
from a2wsgi import ASGIMiddleware

# WSGI callable for Toolforge uWSGI
app = ASGIMiddleware(backend_main.app)
