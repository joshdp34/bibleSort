#!/usr/bin/env bash
set -euo pipefail

# If a PostgreSQL DATABASE_URL is provided, wait until the database is reachable
if [[ "${DATABASE_URL:-}" == postgresql* ]]; then
  echo "Waiting for database to be ready..."
  python <<'PY'
import os
import sys
import time
from sqlalchemy import create_engine, text

url = os.environ["DATABASE_URL"]
engine = create_engine(url, pool_pre_ping=True)
last_err = None
for attempt in range(30):
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Database is ready.")
        break
    except Exception as exc:  # pragma: no cover - startup helper
        last_err = exc
        time.sleep(1)
else:
    print(f"Database not ready after waiting: {last_err}", file=sys.stderr)
    sys.exit(1)
PY
fi

exec "$@"