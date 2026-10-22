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

## Test deployment

1. Back up these host directories before changing images:
   `/volume1/docker/youtubedl/appdata`, `/volume1/docker/youtubedl/users`, and
   `/volume1/downloads/youtubedl`.
2. Create independent copies beneath `/volume1/docker/youtubedl-test` and
   `/volume1/downloads/youtubedl-test`. Verify the copied directories are not
   symlinks or bind mounts back to production. Never attach the old and new
   containers to the same writable directories.
3. Build and start the isolated test service on host port `18084`:

   ```sh
   docker compose -f docker-compose.synology.test.yml build
   docker compose -f docker-compose.synology.test.yml up -d
   ```

4. Watch startup and health status:

   ```sh
   docker compose -f docker-compose.synology.test.yml logs -f youtubedownloader-test
   docker inspect --format '{{json .State.Health}}' YouTube-Downloader-Test
   ```

5. Confirm yt-dlp sees an impersonation implementation:

   ```sh
   docker exec YouTube-Downloader-Test /app/appdata/bin/yt-dlp --list-impersonate-targets
   ```

6. Exercise subscription switching, historical thumbnails, playback, restart,
   permissions, persistence, and any configured reverse-proxy subpath against
   the test instance. Stop the test container when validation is complete.

### Portainer test Stack

[`docker-compose.synology.portainer.test.yml`](docker-compose.synology.portainer.test.yml)
provides the same isolated test layout without a local image build. It pulls the
public, immutable GHCR image `ghcr.io/madcat9k/youtubedl-material:sha-e603edc`
and defaults to port `18084` and the dedicated test roots listed above.

Before deploying the Stack, populate those roots with independent copies of the
production data and verify the copies are not symlinks or bind mounts back to
production. In Portainer, upload the Compose file under **Stacks**, or paste its
contents into the web editor. No registry credentials are required.

If the restored NAS account IDs or paths differ, define these Stack environment
variables before deployment:

- `YTDLM_UID` and `YTDLM_GID` for the account that owns the copied data;
- `YTDLM_TEST_PORT` if `18084` is unavailable;
- `YTDLM_TEST_DOCKER_ROOT` for the copied `appdata` and `users` parent;
- `YTDLM_TEST_DOWNLOAD_ROOT` for the copied media parent.

The application checks subscriptions after startup. Because the Stack uses
copied writable data, any resulting database updates or downloads remain in the
test roots rather than production.

For the complete low-space backup, deployment, isolation, and acceptance
procedure, follow the
[Portainer test runbook](docs/PORTAINER_TEST.md). It keeps automatic subscription
checks disabled while a copied database is tested without a duplicate media
library.

## Production migration

Only after the test deployment passes and a fresh production backup is verified,
stop the old container before starting `docker-compose.synology.yml` on port
`8084`. Do not keep the test and production containers attached to the same
writable directories. Preserve the previous image and Compose definition for
rollback.

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
