# YoutubeDL-Material fork

This repository starts from `Tzahi12345/YoutubeDL-Material` and is intended to
stabilize the Synology deployment described in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).
The original Compose and startup script review is in
[docs/COMPOSE_REVIEW.md](docs/COMPOSE_REVIEW.md).

## Current scope

- Apply yt-dlp browser impersonation reliably, even when the application updates
  its yt-dlp binary during startup.
- Diagnose and fix thumbnails that disappear after download.
- Reload the file list when navigating directly between subscriptions.
- Verify and preserve opening a video in a new browser tab.

## First deployment

1. Back up these host directories before changing images:
   `/volume1/docker/youtubedl/appdata`, `/volume1/docker/youtubedl/users`, and
   `/volume1/downloads/youtubedl`.
2. Build and start the fork from this repository:

   ```sh
   docker compose -f docker-compose.synology.yml build
   docker compose -f docker-compose.synology.yml up -d
   ```

3. Watch startup and health status:

   ```sh
   docker compose -f docker-compose.synology.yml logs -f youtubedownloader
   docker inspect --format '{{json .State.Health}}' YouTube-Downloader
   ```

4. Confirm yt-dlp sees an impersonation implementation:

   ```sh
   docker exec YouTube-Downloader /app/appdata/bin/yt-dlp --list-impersonate-targets
   ```

The application still owns `/app/appdata/bin/yt-dlp` and may update it at
startup. The fork injects `--impersonate chrome` at process invocation time,
so no wrapper-repatch loop is required. `curl-cffi` is installed in the image.

## Rollback

Stop this image and start the previous Compose definition using
`tzahi12345/youtubedl-material:nightly`. The fork does not introduce a database
migration in this initial phase, so the same bind mounts can be reused. Keep the
backup until thumbnail and subscription behavior has been verified.

## Configuration notes

- `UID` and `GID` are strings deliberately. The upstream entrypoint starts as
  root only long enough to correct ownership, then runs the app as that identity.
- `YTDLP_IMPERSONATE` can be removed to disable the runtime fix or changed to a
  target reported by `--list-impersonate-targets`.
- The fixed `Chrome-136:Macos-15` target from the original script is avoided:
  current yt-dlp marks that profile as deprioritized.
- Compose's top-level `version` key is omitted because current Compose ignores it.

## Development

See the upstream [README.md](README.md) for the Angular/Node development setup.
The fork plan, acceptance criteria, and investigation notes live in
[docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).
