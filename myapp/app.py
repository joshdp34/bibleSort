import os
import json
from datetime import datetime, timezone

import requests
from flask import Flask, request, jsonify, render_template
from sqlalchemy import func

from models import db, Score, GameSession

# ----------------------------
# App & Database Configuration
# ----------------------------
app = Flask(__name__, static_folder="static", template_folder="templates")

# Expect DATABASE_URL in environment (e.g., from Elastic Beanstalk / RDS)
db_url = os.getenv("DATABASE_URL")

# Normalize Heroku-style postgres scheme for SQLAlchemy
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if not db_url:
    # Local/dev fallback (optional). Prefer setting DATABASE_URL.
    # Example: postgresql://user:pass@localhost:5432/mydb
    db_url = "sqlite:///app.db"

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)


# Optional: create tables at startup (handy for local/dev).
# In production, prefer Flask-Migrate/Alembic.
def _create_tables_if_needed():
    try:
        db.create_all()
    except Exception as e:
        app.logger.warning(f"create_all skipped/failed: {e}")


with app.app_context():
    _create_tables_if_needed()


# -----------
# Utilities
# -----------
def get_client_ip() -> str:
    """
    Best-effort client IP extraction (works behind reverse proxies/ALBs).
    """
    # X-Forwarded-For may contain a list like "client, proxy1, proxy2"
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        # take the left-most (original client)
        ip = xff.split(",")[0].strip()
        if ip:
            return ip
    # Fallback to direct remote address
    return request.remote_addr or "0.0.0.0"


def lookup_location(ip: str) -> str:
    """
    Look up a coarse location string from IP using ip-api.com (free tier).
    Note: free tier is best-effort and rate-limited; handle failures gracefully.
    """
    try:
        # If running locally (127.0.0.1) or private IP, skip lookup
        if ip.startswith("127.") or ip.startswith("10.") or ip.startswith("192.168.") or ip == "0.0.0.0":
            return "Local"

        resp = requests.get(f"https://ip-api.com/json/{ip}", timeout=3)
        data = resp.json()
        if data.get("status") == "success":
            city = data.get("city") or ""
            region = data.get("regionName") or ""
            country = data.get("country") or ""
            # Make a compact "City, Region, Country" (skip empties)
            parts = [p for p in (city, region, country) if p]
            return ", ".join(parts) if parts else "Unknown"
    except Exception:
        pass
    return "Unknown"


def to_iso(dt: datetime | None) -> str | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


# -------
# Routes
# -------
@app.route("/")
def index():
    # Assumes templates/index.html exists; if you serve a flat file, use send_from_directory.
    return render_template("index.html")


@app.route("/health")
def health():
    return jsonify({"status": "ok", "time": datetime.now(timezone.utc).isoformat()})


@app.route("/api/highscores")
def highscores():
    """
    Return top N scores sorted by score desc, then timestamp asc (older first for tie-break).
    Query params:
      - limit (int, default 25, max 100)
    Response: array[ { name, score, timestamp, location } ]
    """
    try:
        raw_limit = request.args.get("limit", "25").strip()
        limit = int(raw_limit)
    except Exception:
        limit = 25

    limit = max(1, min(limit, 100))

    q = (
        db.session.query(Score)
        .order_by(Score.score.desc(), Score.timestamp.asc())
        .limit(limit)
    )
    results = q.all()

    payload = [
        {
            "name": s.name,
            "score": s.score,
            "timestamp": to_iso(s.timestamp),
            "location": s.location,
        }
        for s in results
    ]
    return jsonify(payload)


@app.route("/api/submit-score", methods=["POST"])
def submit_score():
    """
    Accepts { name, score }, records:
      - GameSession (timestamp, location)
      - Score (name, score, timestamp, location)
    Returns:
      { status: "ok", rank: int, percentile: float }
    Ranking:
      rank = 1 + count(scores strictly greater than submitted score)
      (dense-style ranking for ties)
    Percentile:
      percentile = 100 * (count strictly below / total), rounded to 1 decimal
    """
    try:
        data = request.get_json(force=True, silent=True) or {}
        name = (data.get("name") or "").strip()
        score_val = data.get("score")

        if not name:
            return jsonify({"status": "error", "message": "Name is required."}), 400
        try:
            score_val = int(score_val)
        except Exception:
            return jsonify({"status": "error", "message": "Score must be an integer."}), 400

        # Derive IP & location
        ip = get_client_ip()
        location = lookup_location(ip)

        # Record session
        session = GameSession(location=location)
        db.session.add(session)

        # Record score
        score_row = Score(name=name, score=score_val, location=location)
        db.session.add(score_row)
        db.session.commit()  # commit so the new score is visible to ranking queries

        # Compute rank and percentile
        total = db.session.query(func.count(Score.id)).scalar() or 0

        # Rank: strictly greater ahead of you
        count_greater = (
            db.session.query(func.count(Score.id))
            .filter(Score.score > score_val)
            .scalar()
            or 0
        )
        rank = int(count_greater) + 1 if total > 0 else 1

        # Percentile: strictly below you
        count_less = (
            db.session.query(func.count(Score.id))
            .filter(Score.score < score_val)
            .scalar()
            or 0
        )
        percentile = round((count_less / total) * 100, 1) if total > 0 else 0.0

        return jsonify(
            {"status": "ok", "rank": rank, "percentile": percentile}
        )

    except Exception as e:
        app.logger.exception("submit-score failed")
        return jsonify({"status": "error", "message": "Internal server error."}), 500


# -------------
# Entry Point
# -------------
if __name__ == "__main__":
    # Handy for local dev: `python app.py`
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=bool(os.getenv("FLASK_DEBUG")))

