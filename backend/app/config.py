import os
from pathlib import Path

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).parent.parent))
STORAGE_DIR = DATA_DIR / "storage"
