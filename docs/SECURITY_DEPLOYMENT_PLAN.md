# Security review and Synology deployment plan

## Goal

Deploy the fork to the Synology DS923+ without exposing known critical flaws or
risking the existing local database, users, subscriptions, or media library.
Security changes and NAS deployment are separate phases: passing CI or building
an image does not authorize or prove a safe production deployment.

## Known-good baseline

- Reviewed source/image commit: `fd31fda` (`Repair security and backend workflows`)
- Immutable test image: `ghcr.io/madcat9k/youtubedl-material:sha-fd31fda`
- Image digest: `sha256:c2f10942f976460e15a097f6e20b8312bc03d5b84224de4ecc33bc507b7ce781`
- Published platforms: `linux/amd64` and `linux/arm64`
- Workflows passing at this baseline: backend tests, CodeQL, continuous
  integration, and multi-architecture image publishing

This baseline is reproducible, but it is not yet approved for production. The
first successful CodeQL upload reported a large inherited security backlog that
must be triaged before the NAS test.

## Safety boundaries

- Do not deploy, start, stop, or modify NAS containers during the security phase.
- Do not contact real subscription sites or download real media in automated
  tests.
- Use synthetic URLs, users, API keys, media names, and paths in source and tests.
- Never put runtime `appdata`, databases, users, subscriptions, cookies, logs,
  media, or NAS directory listings into Git.
- Never run two containers against the same writable database or media mounts.
- Keep the production service on port `8084`; use `18084` for the isolated test.
- Preserve `user: "0:0"` and the entrypoint UID/GID ownership flow unless a
  separate, tested permissions redesign is approved.

## Phase 1: triage the CodeQL backlog

Review each alert and record its source, untrusted input, sink, call path,
existing validation, exploit preconditions, and proposed disposition. Group
duplicates only when they share the same root cause.

Priority order:

1. Critical SSRF report around remote file retrieval.
2. High Zip Slip report in application-update archive extraction.
3. Clear-text logging of API keys, cookies, URLs, or other credentials.
4. Request-derived filesystem paths and archive paths.
5. SQL/filter injection and unsafe dynamic database queries.
6. Session-cookie and CSRF protections.
7. Missing rate limiting on authentication and mutation endpoints.
8. Prototype-pollution and remaining sanitization reports.

Classify each result as one of:

- confirmed and reachable;
- confirmed but not reachable in the supported deployment;
- already mitigated, with evidence;
- test-only or generated-code finding;
- false positive, with evidence;
- needs more investigation.

Do not dismiss GitHub alerts merely to obtain a green dashboard. Any dismissal
must have a written rationale and separate approval.

## Phase 2: fix confirmed deployment blockers

Make small, reviewable changes in the same priority order. Each change must:

- validate and normalize untrusted data at the boundary;
- keep filesystem access within configured roots;
- avoid logging secrets or full user-supplied URLs;
- preserve API response shapes and existing Synology startup behavior;
- include an offline regression test for the vulnerable and valid cases;
- avoid dependency modernization unless the fix cannot be made safely without it.

Remote fetches must use explicit allowed protocols and trusted destinations,
limit redirects, reject private/local addresses at every connection, set bounded
timeouts and response sizes, and avoid trusting a URL after only its initial DNS
resolution. Archive extraction must reject absolute paths, traversal, symlink
escapes, and any output outside its dedicated extraction directory.

## Phase 3: verification gate

Before producing a release candidate:

- no unreviewed critical alert remains;
- no confirmed exploitable high-severity alert remains in the supported path;
- remaining alerts have documented evidence and disposition;
- focused regression tests pass without external network access;
- the relevant backend suite and frontend tests/build pass;
- CodeQL completes and the alert delta is reviewed;
- cache-only image assembly succeeds for `linux/amd64` and `linux/arm64`;
- `git diff --check` passes;
- the exact staged paths and staged diff pass a PII/secrets/runtime-data review.

Only then publish a new immutable `sha-...` image. Record its commit, tag, digest,
platform manifests, workflow links, and any unresolved operational risks here or
in `docs/PROJECT_PLAN.md`.

## Phase 4: isolated Portainer test

Follow `docs/PORTAINER_TEST.md` with the verified release candidate:

1. Confirm the DS923+ architecture, DSM/Container Manager versions, free space,
   and that test port `18084` is unused.
2. Back up the small irreplaceable state first: production `appdata` and `users`.
   Verify that the backup can be opened and contains the expected database and
   configuration files.
3. Prepare independent test roots below `/volume1/docker/youtubedl-test` and
   `/volume1/downloads/youtubedl-test`. They must not be symlinks or bind mounts
   back to production.
4. Use an empty test media tree when copying the full subscription library is
   impractical. Keep automatic subscription checks disabled initially.
5. Deploy the test Stack on `18084`, inspect startup/health logs, and confirm the
   application, database, permissions, yt-dlp impersonation, and restart behavior.
6. Verify thumbnails, direct subscription switching, new-tab navigation,
   persistence after restart, and any reverse-proxy subpath.
7. Enable and test one disposable subscription only after the offline checks
   pass. Remove it afterward and confirm production data was untouched.

## Phase 5: production cutover and rollback

After the isolated test passes and the user explicitly approves deployment:

1. Create and verify a fresh backup or snapshot of production `appdata` and
   `users`; snapshot media metadata/directories where practical.
2. Record the old image, Compose configuration, container settings, and current
   health so rollback is deterministic.
3. Stop the old container before attaching the production writable mounts to the
   new container.
4. Deploy the immutable reviewed image on the existing production port `8084`.
5. Check health, logs, login, subscriptions, files, thumbnails, playback,
   permissions, restart persistence, and reverse-proxy access.
6. If a blocker appears, stop the new container and restore the previous image
   and Compose definition. Restore state from backup only if the persistent data
   was changed incompatibly.

Keep the backup and old immutable image until the new deployment has completed a
normal subscription cycle and a deliberate container restart without regression.

## Initial alert disposition

| Area | Current disposition | Evidence / next action |
| --- | --- | --- |
| Remote-file SSRF | Confirmed weakness; draft fix implemented | Current callers use fixed GitHub repositories, but the generic helper previously trusted redirects and DNS. Focused tests now cover host/protocol restrictions, per-hop validation, private addresses, size limits, failed responses, and atomic replacement. Re-run CodeQL before closing. |
| Update archive traversal | Confirmed and reachable; draft fix implemented | The updater previously joined archive paths directly to the backend root. Tests now cover traversal, absolute/foreign roots, release-tag traversal, persistent `appdata`, valid extraction, and existing symlink escapes. Re-run CodeQL before closing. |
| Clear-text logging | Three confirmed sites; draft fix implemented | API keys and downloader argument values are no longer included. Fixed-message tests use synthetic secret values. Re-run CodeQL before closing. |
| Database query/filter injection | Confirmed; draft central guard implemented | This project uses MongoDB-style filters and a local JSON equivalent, not SQL. Request-shaped object conditions could alter MongoDB queries, while an unknown object condition could match the first local record. Both paths now reject object/operator filters unless server code constructs an allowlisted condition. Update objects also reject MongoDB operator and prototype-related keys. Add endpoint-specific field allowlists separately. |
| Session cookie / CSRF | Alert is secondary to the actual credential design | The Angular client sends a fixed public token on every API request. In multi-user mode it additionally stores a JWT in local storage and sends it as a query parameter; sessions are initialized but are not the primary API authorization mechanism. Cookie flags alone would not fix token leakage or the single-user trust model. Keep the test deployment LAN-only and require reverse-proxy access control or a dedicated authentication redesign before internet exposure. |
| Request-derived paths | Mixed; needs individual review | The fork already has configured-root, realpath, and symlink containment for media and thumbnails. Remaining updater, upload, Twitch, subscription, task, and download paths must be traced individually rather than dismissed as one group. |
| Missing rate limiting | Architectural backlog | The alert count is dominated by route-level reports. Prioritize login, registration, token/API-key generation, Telegram, uploads, update, and other mutation endpoints; choose limits compatible with subscription polling and reverse proxies. |
| Prototype pollution | Needs investigation | Review request-controlled object keys in category, task, configuration, and nested-object helpers. Apply allowlists and forbidden-key checks at the boundary, then add local and MongoDB-mode tests. |

## Current work log

- 2026-10-24: workflow failures repaired at `fd31fda`; all four workflows passed
  and the multi-architecture GHCR image was published.
- 2026-10-24: initial CodeQL result contained 167 inherited alerts: 1 critical,
  157 high, and 9 medium. Counts are a triage input, not proof that every report
  is reachable or distinct.
- 2026-10-24: security triage started. No NAS or production container changes
  have been made.
- 2026-10-24: confirmed the updater archive-path alert is reachable. Archive
  entries were joined to the backend directory without containment validation,
  and the requested release tag was used in a local filename without validation.
  A draft fix now validates release tags, rejects absolute/traversal/foreign-root
  and non-file archive entries, rejects duplicate destinations and symlink
  components, preserves all `appdata`, and clears/replaces only the generated
  public tree after the complete entry list passes validation.
- 2026-10-24: confirmed all three clear-text logging alerts. Rejected API
  requests logged the supplied API key, normal downloader startup logged the
  complete argument list, and argument-injection failures logged both argument
  arrays. A draft fix replaces them with fixed messages or a boolean indicating
  only whether an API key was supplied; it never includes keys, headers, cookie
  values, downloader arguments, or request-controlled paths.
- 2026-10-24: the generic remote-file helper is called only by the application
  updater and the downloader updater; both currently construct GitHub URLs from
  fixed repository mappings. The critical SSRF alert therefore has constrained
  current call sites, but the helper followed redirects and performed no
  protocol, address, response, timeout, or size validation.
- 2026-10-25: a draft SSRF fix now permits only HTTPS downloads from GitHub and
  GitHubusercontent hostnames, rejects credentials and non-default ports,
  resolves and pins a public address for every redirect hop, caps redirects,
  response time, and response size, requires a successful HTTP response, and
  atomically replaces the destination only after a complete bounded download.
  The shared address-validation code is also used by the existing remote
  thumbnail fetcher.
- 2026-10-25: 24 focused offline security/thumbnail/downloader tests pass. The broader
  backend suite reports 105 passing and 30 intentionally pending tests; its only
  two failures are the existing host limitation that FFmpeg is not installed.
  No external subscription or media site was contacted.
- 2026-10-25: confirmed MongoDB-style operator injection also affects the
  supported local JSON mode: an untrusted object condition can change query
  meaning or match the first record. A draft central database guard now accepts
  only scalar filters and explicitly server-created operators, rejects unsafe
  update keys recursively, and preserves the existing internal search, age, and
  non-null filters. Four focused database-safety tests pass. The full offline
  backend result is now 111 passing and 30 intentionally pending, with only the
  same two missing-FFmpeg failures.
- 2026-10-25: mapped the browser authentication path. Single-user mode relies on
  a public fixed client token, and multi-user mode sends local-storage JWTs in
  query strings. Treat the current application as trusted-LAN-only until token
  transport and route authorization are redesigned or a reverse proxy enforces
  authentication and network restrictions.
