# Fork stabilization plan

## Goal

Provide a small, maintainable YoutubeDL-Material fork for the existing Synology
installation. Preserve the current bind-mounted data and avoid one-off patches
that race with application startup.

## Baseline

- Upstream: `Tzahi12345/YoutubeDL-Material`
- Initial upstream commit: `28234c0`
- Frontend: Angular 15
- Backend: Node.js 16 / Express
- Deployment: Docker Compose on Synology, local JSON database
- External port: `8084`; container port: `17442`

The upstream image's `nightly` tag was last published in 2025. Building this
fork from source makes every code change explicit and reproducible.

### Baseline risks discovered during the first build

- The frontend install reports 107 dependency advisories and the backend reports
  48. These are inherited from upstream and need a separate, tested dependency
  modernization effort; running `npm audit fix --force` is not safe here.
- Earlier Docker builds installed the latest Angular CLI and PM2 globally. The
  fork now uses the lockfile's Angular CLI and pins PM2 to a Node-16-compatible
  release; the remaining dependency modernization is tracked separately.
- Node 16 is end-of-life. Upgrading Node and the application dependencies should
  follow the functional fixes rather than be combined with them.

## Findings

### 1. Startup yt-dlp fix

The original script downloads `yt-dlp.real`, writes a wrapper to `yt-dlp`, and
rewrites that wrapper once per second for 40 seconds. This is compensating for
`backend/youtube-dl.js`, which checks for updates during application startup and
can replace `appdata/bin/yt-dlp`.

Risks in the script:

- `/app/appdata/bin` is not created before `curl -o` uses it.
- `curl` does not use `--fail` and writes directly to the live target.
- pip and GitHub are required on every restart, making restarts network-dependent.
- the background rewrite loop is a timing race and can modify the executable
  while it is being used.
- `Chrome-136:Macos-15` is currently a deprioritized yt-dlp impersonation target.

Initial solution: install a compatible `curl-cffi` in the image and inject the
target in the backend for every yt-dlp subprocess. The existing updater may then
replace the binary without removing the behavior. A user-provided
`--impersonate` argument wins over the environment default.

Acceptance criteria:

- Container startup does not write a wrapper in a timed loop.
- yt-dlp can list at least one available Chrome target.
- Logs show successful downloads after both a cold start and a second restart.
- Startup remains functional if GitHub is temporarily unavailable and a working
  yt-dlp binary already exists in `appdata`.

### 2. Missing thumbnails

Relevant flow:

1. yt-dlp writes a thumbnail when `include_thumbnail` is enabled.
2. `backend/files.js` stores a local `thumbnailPath` during registration.
3. The Angular card prefers `/api/thumbnail/<local path>` whenever that property
   is present; it falls back to the remote `thumbnailURL` only when it is absent.
4. The thumbnail endpoint returns `404` if the stored path no longer exists.

Most likely failure classes are a stale database path, an extension/conversion
change after registration, or file permissions. The current frontend does not
fall back to `thumbnailURL` after a local image request fails.

Implementation plan:

1. Add backend tests covering `.jpg`, `.webp`, and `.png` discovery and paths
   containing spaces/non-ASCII characters.
2. Add structured logging for local thumbnail misses without logging JWTs.
3. Re-resolve the local thumbnail from the video path when records are loaded or
   during the existing database repair task; update stale DB values.
4. Add an image error handler that tries the remote thumbnail once, then shows a
   deterministic placeholder.
5. Test before/after restart and after moving from an older yt-dlp version.

Acceptance criteria:

- A downloaded thumbnail remains visible after container restart and browser
  cache clear.
- Missing local thumbnails fall back without an infinite request/error loop.
- The repair path handles all supported thumbnail extensions.

#### Implementation status (2026-10-07)

- File-list loading now verifies stored local thumbnail paths and re-resolves a
  missing path from the media filename. Repairs are returned immediately and
  persisted to the database for subsequent requests.
- The resolver and repair path cover `.jpg`, `.webp`, and `.png`, including
  filenames containing spaces and Unicode characters.
- The thumbnail endpoint canonicalizes requested files and serves only regular
  files beneath the configured audio, video, subscription, or user media roots.
  Traversal, arbitrary absolute paths, and symlink escapes are rejected without
  logging the requested path.
- File cards try the stored local thumbnail first, the remote thumbnail once on
  error, and finally a bundled deterministic placeholder. Cards with a local
  thumbnail but no remote URL render correctly, and missing thumbnail metadata
  selects the placeholder immediately. Further placeholder errors do not change
  the source, preventing an error loop.

Verification:

- Focused backend thumbnail/path tests: 6 passing, including extension/path
  discovery, stale database repair, root containment, traversal rejection, and
  symlink-escape rejection.
- The changed-area Angular suite passed 11 tests in headless Chrome, including
  card fallback/rendering and auxiliary-click filtering.
- Production frontend build: completed successfully with the existing
  `file-saver` CommonJS warning.

Remaining risks:

- The repair is lazy and runs as affected file-list pages are loaded; records on
  pages that are never opened remain unchanged until a later repair task scans
  them.
- Synology validation is still required with an actual historical stale record,
  a container restart, and a browser cache clear.
- A custom installation that intentionally stored thumbnails outside all four
  configured media roots will now receive a placeholder until those files or
  paths are migrated beneath a configured root.

### 3. Switching subscriptions does not reload files

The parent subscription component observes route parameter changes. Its child
`RecentVideosComponent` reads `sub_id` in `ngOnInit`, but does not react to later
input changes. Angular reuses both components when navigating from one
`/subscription;id=...` route to another, leaving the old list visible until a
full page refresh.

Implementation plan:

1. Make `RecentVideosComponent` implement `OnChanges` and reload when `sub_id`
   changes after initialization.
2. Reset pagination, search result state, skeleton state, and cached counts for
   the new subscription.
3. Replace unmanaged subscriptions/intervals with teardown-aware RxJS patterns
   where needed to prevent duplicate requests.
4. Add a component test that changes `sub_id` from A to B without destroying the
   component and verifies a request for B.

Acceptance criteria:

- Clicking A, then B, updates the heading and list without browser refresh.
- No request for A overwrites B if responses arrive out of order.
- Only one polling/request stream remains after repeated navigation.

#### Implementation status (2026-10-06)

Implemented on `codex/initial-fork-plan`:

- `RecentVideosComponent` now handles `sub_id` changes on the same component
  instance. It resets the paginator, search/list/loading state, and reads/writes
  the file-count cache under a subscription-specific key before requesting the
  newly selected subscription.
- A newly started file request cancels its predecessor. A request generation and
  captured subscription ID also guard the response handler, so a stale response
  cannot replace the current subscription's files even if its source ignores
  cancellation.
- Component event subscriptions, search debounce work, playlist requests, and
  delayed filter refreshes are torn down with the component. Initial
  `BehaviorSubject` values are skipped for change-event streams to avoid a
  duplicate initial fetch.
- `SubscriptionComponent` now owns one route subscription, one polling interval,
  and at most one subscription request. Route changes cancel the old request and
  interval; a slow active poll is not overlapped by the next timer tick.
- The Angular 15 test bootstrap now leaves test discovery/startup to the CLI. A
  stale directive smoke test was updated to provide its required `ElementRef`,
  which was necessary for any selected Karma spec to compile.

Verification:

- Focused Karma run: 4 specs passed in headless Chrome, covering A-to-B input
  changes on one `RecentVideosComponent`, state/cache reset, out-of-order
  responses, repeated navigation, polling, and teardown.
- Production frontend build: completed successfully with the existing Angular
  Material theme and `file-saver` CommonJS warnings.

Remaining risks:

- A manual browser pass against real subscriptions is still needed to confirm
  the heading/list transition and observe backend cancellation behavior over the
  deployed network path.
- `package.json` and `package-lock.json` are already out of sync for `ajv`, so
  current npm cannot use `npm ci`. Verification required installing the exact
  frontend versions recorded in the lockfile without changing dependency
  metadata. Dependency reproducibility remains a separate project task.
- Karma 6 prints a post-result "full page reload" message with the installed
  Chrome after reporting all specs successful; the command exits successfully,
  but the runner/browser compatibility should be cleaned up with the planned
  dependency modernization.

### 4. Open videos in a new tab

Current upstream already includes "Open file in new tab" in the card context
menu and Ctrl-click behavior in `RecentVideosComponent`. This may be absent from
the deployed nightly image, or its synthetic `window.open('/#/...')` route may
not work under a reverse-proxy subpath.

Implementation status (completed in the fork):

- `RecentVideosComponent` now creates the player `UrlTree` with Angular's
  router, serializes it, and passes it through `LocationStrategy`. New-tab URLs
  therefore use the configured application base path instead of hard-coding
  `/#/`.
- Ctrl-click, Cmd-click, and middle-click all request a new tab. The existing
  card context-menu action uses the same routing path.
- The file card handles the browser's auxiliary-click event so middle-click
  reaches the navigation handler.
- Focused tests cover root hosting, reverse-proxy subpath hosting, Cmd-click,
  and middle-click.

Verification:

- Focused Karma suite: 5 tests passed in Chrome Headless 154.
- Production frontend build: completed successfully with the existing
  `file-saver` CommonJS warning.
- Visible Chrome smoke test: opening a subscription card in a new tab produced
  the Angular player URL while the original subscription page remained open.

Acceptance criteria:

- Native Ctrl/Cmd-click, middle-click, and the menu item open the correct video
  in a new tab.
- The current tab stays on the file list.
- Authentication and reverse-proxy base paths continue to work.

Remaining risks:

- The local smoke fixture intentionally has no playable media file, so this
  pass verified routing and tab behavior rather than video playback.
- The serialized subpath behavior is covered by a focused test, but the actual
  Synology reverse-proxy configuration still needs verification during the
  deployment phase.
- A real anchor was not introduced because the card also supports download-only
  mode and multiple actions; the explicit auxiliary-click handler preserves the
  current interaction model with a smaller change.

### 5. Multi-architecture image validation

Implementation status (build verification completed locally):

- The external FFmpeg and TwitchDownloader fetch scripts now fail immediately
  on command errors, reject HTTP failures, retry transient transfer failures,
  and validate downloaded archives before extracting them.
- TwitchDownloader is pinned to a reviewed release and checksum for each
  supported architecture, and its smoke test validates the emitted version text.
  The CLI returns status 1 even when its `version` command succeeds, so the test
  intentionally validates output rather than that nonstandard status.
- The Docker utility stage copies each fetch script separately so changing the
  TwitchDownloader logic does not invalidate a completed FFmpeg layer.
- PM2 is pinned to `5.4.3`, whose declared Node requirement includes the image's
  Node 16 runtime. An unpinned install had begun resolving PM2 7, which requires
  Node 18.
- The image now pins `curl-cffi` and `pycryptodomex`. TwitchDownloader is pinned
  to release `1.56.5`, with an architecture-specific SHA-256 check before
  extraction rather than resolving the latest release during every build.
- The frontend build uses the Angular CLI installed from the project lockfile;
  it no longer installs an unbounded global CLI.

Verification:

- `sh -n` passed for both utility scripts.
- A cache-only Buildx build completed successfully for both `linux/amd64` and
  `linux/arm64`. It compiled the frontend and backend layers and validated both
  architecture-specific FFmpeg and TwitchDownloader artifacts.
- The build produced no pushed, tagged, running, or deployed image.

Remaining risks:

- The dependency installation reports the upstream project's existing npm audit
  findings and legacy Node/npm engine warnings. Dependency modernization remains
  separate work.
- A cache-only build proves both image graphs can be assembled but does not test
  container startup, health checks, bind-mount ownership, or Synology's CPU and
  reverse-proxy environment.
- Before deployment, confirm the Synology architecture and registry destination,
  load or publish the matching image, and run it on a test port with copied data
  directories. Do not share writable production mounts with the old container.
- `docker-compose.synology.test.yml` provides the isolated port `18084` and
  dedicated `youtubedl-test` mount roots; populate those roots with verified
  copies before starting it.

## Review follow-up (2026-10-07)

The full fork delta was re-reviewed under the repository's current agent and
privacy rules. In addition to the thumbnail containment and card fixes above:

- the local Ollama runner records and rechecks Git `HEAD` as well as the complete
  working-tree snapshot before writing a draft, so a concurrent commit or
  checkout aborts the run;
- right-click no longer triggers player navigation, while middle-click retains
  the intended new-tab behavior;
- the isolated Synology test Compose definition uses port `18084`, a distinct
  container/image name, and dedicated copied-data roots; and
- Docker build inputs added by the fork are pinned, with TwitchDownloader
  downloads verified against architecture-specific SHA-256 digests.

Validation completed locally:

- focused backend tests: 9 passing;
- changed-area Angular tests: 11 passing in headless Chrome;
- production frontend build: passed with the inherited `file-saver` CommonJS
  warning;
- cache-only Docker build: passed for `linux/amd64` and `linux/arm64` without
  loading, tagging, pushing, or deploying an image;
- production and isolated-test Compose configuration checks: passed; and
- local Ollama runner dry-run: passed without sending a model request.

The full backend suite reported 64 passing, 22 pending, and 10 failing. The ten
failures are inherited environment/integration checks that require GitHub DNS,
a yt-dlp-supported local Python version, FFmpeg, or TwitchDownloader; none are
in the focused changed paths. They remain a reason to rely on the verified
container build and to run the isolated Synology acceptance pass before
production migration.

## Subscription creation repair (2026-10-08)

- Subscription creation now falls back from missing `uploader` metadata to
  other stable yt-dlp channel identity fields. If no valid single-directory
  name can be determined, the API requests a custom name instead of passing
  `null` to `path.join`.
- Downloader warnings on stderr no longer turn successfully parsed subscription
  metadata into a failure. This is required while the pinned image runtime
  still produces yt-dlp's Python 3.10 deprecation warning.
- Creation is rollback-safe: downloader, name-validation, and metadata-write
  failures remove the newly inserted database record. A retry also removes an
  earlier nameless partial record for the same URL before proceeding.
- Custom and extracted names reject path separators, traversal segments, and
  null bytes before filesystem use. Duplicate and downloader errors no longer
  log or return the full subscription URL.
- Startup metadata rewriting skips legacy nameless records without crashing;
  the next retry for that URL performs the bounded cleanup.
- Docker build input now excludes ignored `backend/appdata` runtime files while
  retaining the tracked default configuration, preventing local databases,
  logs, downloader binaries, and URLs from being baked into an image.

Verification:

- focused subscription-creation tests: 9 passing locally and in the rebuilt
  container;
- existing subscription suite: 9 passing;
- rebuilt local validation image contains only `default.json` under its baked
  `/app/appdata` directory;
- redeployed validation container: healthy with zero restarts, HTTP 200 on port
  `18084`, and yt-dlp Chrome impersonation targets available.

## Delivery sequence

1. Baseline and startup hardening (included in this initial scaffold).
2. Reproduce and fix subscription navigation; add focused frontend tests.
3. Instrument, reproduce, and repair thumbnail persistence; add fallback UI.
4. Verify and harden new-tab navigation.
5. Build a multi-architecture image, deploy to a test port, then migrate port
   `8084` after acceptance checks.

## Test matrix

- Architectures: the Synology CPU architecture, plus `linux/amd64` in CI.
- Lifecycle: fresh install, existing bind mounts, restart, forced yt-dlp update.
- Browsers: current Chrome and Firefox; Safari if used by the household.
- Paths: spaces, Unicode, long titles, subscription channel and playlist paths.
- Data: local JSON database now; MongoDB behavior should remain unchanged.

## Open deployment details

Before publishing an image or automating deployment, record:

- Synology model/CPU architecture and DSM/Container Manager versions.
- Whether access is direct at `http://NAS:8084` or through a reverse proxy and
  URL subpath.
- Whether disappearing thumbnails affect subscription downloads only or also
  one-off downloads, plus one failing video's `.info.json`, thumbnail filename,
  and the corresponding browser Network request status.
- Desired image registry/repository for Synology to pull from.
