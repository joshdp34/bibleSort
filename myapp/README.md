# Bible Sort Flask App

This project is a small Flask application that can run with Docker or Docker Compose.

## Running with Docker Compose

1. **Start Docker Desktop** (Windows/macOS) or the Docker daemon (Linux) before running any commands.
2. From this directory run:
   ```bash
   docker compose up --build
   ```
   This builds the web image, starts PostgreSQL, and waits for the database before launching the app on port 5000.
3. Visit <http://localhost:5000>.
4. Stop the stack with `docker compose down` (add `-v` to drop the database volume).

### Troubleshooting on Windows
- If you see an error such as `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`, Docker Desktop is not running or WSL 2 integration is disabled. Start Docker Desktop and ensure the WSL backend is enabled.
- Run `docker info` to confirm the daemon is reachable before running Compose.
- Use the v2 syntax (`docker compose` with a space). The `version` field is removed from `docker-compose.yml` to avoid the deprecation warning seen in Docker Compose v2.

## Running a single container
If you already have a PostgreSQL instance available, you can build and run the web container alone:
```bash
docker build -t bible-sort .
docker run --rm -p 5000:5000 \
  -e DATABASE_URL=postgresql://user:pass@dbhost:5432/dbname \
  -e FLASK_ENV=production \
  bible-sort
```

The app will be available at <http://localhost:5000>.
