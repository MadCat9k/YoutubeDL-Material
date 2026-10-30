# YoutubeDL-Material fork

This repository starts from `Tzahi12345/YoutubeDL-Material` and is intended to
stabilize the Synology deployment described in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md).
The original Compose and startup script review is in
[docs/COMPOSE_REVIEW.md](docs/COMPOSE_REVIEW.md).

## What this fork changes

This fork keeps the upstream application and data model while concentrating on
reliable operation on the existing Synology installation:

- **Container and downloader reliability:** multi-architecture image builds for
  `linux/amd64` and `linux/arm64`, invocation-time yt-dlp impersonation, and
  validated architecture-specific standalone yt-dlp updates that preserve an
  existing working binary when an update fails.
- **Thumbnail and media integrity:** stale thumbnail-path repair, safe local and
  remote thumbnail fallbacks, generated video previews, finished-file duration
  verification, and an idempotent maintenance task for existing duration data.
- **Subscription reliability:** route-safe list refreshes, bounded flat-playlist
  discovery, sanitized scan progress, rollback-safe creation, and deletion that
  reports success only after the requested work completes.
- **Recoverable workflows:** visible retryable results for archive, export,
  playlist, sharing, authentication, cookie, category, task, and library
  operations instead of silent or premature success.
- **Responsive and accessible UI:** mobile-friendly Downloads, Tasks, Settings,
  and subscription views; reliable polling and stale-response protection;
  persistent discovery controls; accessible control names; and announced
  success, progress, and failure feedback.
- **Navigation:** subscription changes update reused Angular components safely,
  while Ctrl/Cmd-click, middle-click, and menu actions open player routes that
  respect root and reverse-proxy subpath hosting.

Detailed implementation evidence, verification results, and remaining risks are
recorded in [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) and
[docs/UI_UX_PLAN.md](docs/UI_UX_PLAN.md).

## Status and limitations

The functional stabilization and six-phase UI/UX plan are complete. Focused
frontend and backend suites, production frontend builds, two-platform cache-only
image builds, and an isolated validation container have exercised the changed
areas. These checks do not replace validation on the target Synology NAS.

- The application still uses the inherited Node.js 16 stack, which is end of
  life, and the inherited dependency advisories have not been modernized.
- Runtime observation of the `linux/arm64` image on the target NAS is still
  required; cache-only Buildx validation proves image assembly, not runtime
  health or bind-mount permissions.
- Production migration still requires an isolated test using copied data,
  followed by a fresh backup and a controlled cutover. Do not run old and new
  containers against the same writable mounts.
- This fork is maintained for the deployment described here. The upstream
  project remains the source for general project documentation and support.

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
so no wrapper-repatch loop is required. On `linux/amd64` and `linux/arm64`, the
updater selects yt-dlp's matching standalone release binary, validates it before
an atomic replacement, and leaves an existing working binary in place if the
download fails. `curl-cffi` is installed in the image.

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
