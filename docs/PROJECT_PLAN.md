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
- The Dockerfile installs the latest Angular CLI and PM2 globally. PM2 7 reports
  a Node 18 requirement while this application uses Node 16, although its runtime
  smoke test currently succeeds. Pinning build tools is a near-term reproducibility
  task.
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

#### Implementation status (2026-10-06)

- File-list loading now verifies stored local thumbnail paths and re-resolves a
  missing path from the media filename. Repairs are returned immediately and
  persisted to the database for subsequent requests.
- The resolver and repair path cover `.jpg`, `.webp`, and `.png`, including
  filenames containing spaces and Unicode characters.
- Missing thumbnail endpoint files produce a focused warning containing the
  local path but no request query or authentication data.
- File cards try the stored local thumbnail first, the remote thumbnail once on
  error, and finally a bundled deterministic placeholder. Further placeholder
  errors do not change the source, preventing an error loop.

Verification:

- Backend thumbnail tests: 4 passing (three extension/path cases and one stale
  database repair case).
- Focused Angular card fallback test: 1 passing in headless Chrome.
- Production frontend build: completed successfully with the existing
  `file-saver` CommonJS warning.

Remaining risks:

- The repair is lazy and runs as affected file-list pages are loaded; records on
  pages that are never opened remain unchanged until a later repair task scans
  them.
- Synology validation is still required with an actual historical stale record,
  a container restart, and a browser cache clear.
- The thumbnail endpoint still accepts the legacy encoded local path. Restricting
  it to configured media roots is a separate security-hardening task because it
  could affect existing stored paths and reverse-proxy deployments.

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
- TwitchDownloader release discovery now fails clearly when the GitHub response
  contains no matching release, and its smoke test validates the emitted version
  text. The CLI returns status 1 even when its `version` command succeeds, so the
  test intentionally validates output rather than that nonstandard status.
- The Docker utility stage copies each fetch script separately so changing the
  TwitchDownloader logic does not invalidate a completed FFmpeg layer.
- PM2 is pinned to `5.4.3`, whose declared Node requirement includes the image's
  Node 16 runtime. An unpinned install had begun resolving PM2 7, which requires
  Node 18.

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
