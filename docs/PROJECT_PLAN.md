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

### 4. Open videos in a new tab

Current upstream already includes "Open file in new tab" in the card context
menu and Ctrl-click behavior in `RecentVideosComponent`. This may be absent from
the deployed nightly image, or its synthetic `window.open('/#/...')` route may
not work under a reverse-proxy subpath.

Implementation plan:

1. Verify the existing item in the fork image on Synology.
2. Generate the player URL through Angular's router and serialize it relative to
   the configured base URL instead of hard-coding `/#/`.
3. Prefer a real anchor where practical so the browser provides its native
   context menu and middle-click behavior.
4. Add tests for root hosting and a reverse-proxy subpath.

Acceptance criteria:

- Native Ctrl/Cmd-click, middle-click, and the menu item open the correct video
  in a new tab.
- The current tab stays on the file list.
- Authentication and reverse-proxy base paths continue to work.

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
