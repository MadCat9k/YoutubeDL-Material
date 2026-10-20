# UI/UX improvement plan

## Purpose

This document records a prioritized review of the existing web interface. It is
a planning artifact, not approval to implement every item. Changes should be
delivered in small, independently tested phases without altering unrelated
download, subscription, navigation, or storage behavior.

The review covered the Home, Downloads, Subscriptions, Tasks, and Settings
pages, the global navigation shell, and their relevant Angular components. The
live narrow-screen review used a viewport approximately 455 pixels wide.

## Product principles

- Translate backend workflow into user-facing states rather than exposing
  implementation terminology.
- Keep the current task and its next safe action obvious.
- Prefer responsive content structures over compressed desktop tables.
- Make destructive actions explicit, scoped, and confirmable.
- Provide useful, sanitized errors without requiring routine server-log access.
- Treat keyboard, screen-reader, and narrow-screen support as core behavior.
- Preserve reverse-proxy subpath hosting and the existing localization model.

## Priority 1: workflow clarity and accessibility

### Accurate download states

- Label downloads waiting for a concurrency slot as `Queued`, rather than
  `Creating download`.
- Distinguish queued, fetching information, downloading, post-processing,
  paused, failed, cancelled, and completed states.
- Show queue position and the active-download limit when available.
- Show speed, estimated time remaining, and meaningful progress where the
  downloader provides reliable values.
- Give each state a text label; do not rely on color alone.

Acceptance criteria:

- A user can tell whether an item is waiting or actively doing work.
- Every displayed state maps deterministically from backend data.
- Missing metadata uses a neutral placeholder and does not collapse the row.

### Mobile Tasks redesign

The current five-column task table loses essential information at narrow
widths: titles become fragments, status consumes most of the row, and several
icon actions repeat without visible labels.

- Use a compact card or disclosure-row layout below the mobile breakpoint.
- Show the full task name, current status, last run, and next invocation.
- Move secondary actions into a labelled menu.
- Separate routine actions from database or filesystem maintenance actions.
- Explain the effect and scope of a maintenance task before it runs.

Acceptance criteria:

- Task names and states remain readable without horizontal scrolling at 320,
  375, and 455 pixels.
- Every action has an accessible name and a visible label in its menu.
- Potentially destructive tasks state what data they can modify.

### Accessible controls and feedback

- Add accessible names to the app-logo button, back button, notifications,
  overflow menu, subscription edit/info controls, floating add buttons, and row
  action menus.
- Retain tooltips as supplemental help, not as the only action label.
- Provide visible keyboard focus styles and logical focus order.
- Announce completed operations, validation failures, and status changes through
  an appropriate live region.
- Verify contrast and touch-target size in both supported themes.

Acceptance criteria:

- All interactive controls expose a meaningful accessible name.
- Primary workflows are usable with keyboard navigation alone.
- Automated accessibility checks have no critical violations on primary pages.

### Actionable error handling

- Replace generic `See server logs` messages with a concise cause and a useful
  next action when the application knows the reason.
- Offer Retry for recoverable operations.
- Offer sanitized Details and a copyable diagnostic identifier when deeper
  investigation is needed.
- Show an unobtrusive connection state when polling cannot reach the backend.
- Never expose authentication values, full private URLs, filesystem paths, or
  cookie content in client diagnostics.

## Priority 2: primary workflows

### Subscription creation and scanning

- Show explicit stages: validating, creating, scanning, and queueing downloads.
- Report discovered-item and queued-item counts.
- Preview the likely initial import scope before a large queue is created, where
  the extractor can provide this information.
- Clearly distinguish duplicate subscriptions, unsupported URLs, extractor
  failures, and temporary network failures.
- Provide a visible `Check now` action and last successful check time.
- Preserve the user-entered form after a recoverable failure.

### Home and library controls

- Combine search, sort field, sort direction, and media filters into one
  responsive toolbar.
- Make selected filter-chip state visually unambiguous.
- Add `Clear filters` when any non-default filter is active.
- Keep search and filters visible while browsing long result sets.
- Use consistent loading, empty, no-results, and error states.

### Downloads management

- Add search and status filters.
- Add bulk selection with clearly scoped operations.
- Provide a direct `Clear completed` action while retaining the more detailed
  clear-by-type dialog.
- Preserve sorting, filters, and pagination while polling refreshes data.
- Keep bulk actions responsive and full-width where necessary on narrow screens.

### Notifications

- Distinguish unread notifications from history.
- Include timestamp, severity, and affected entity.
- Link a notification to its related download, subscription, or task.
- Provide clear empty and connection-error states.

## Priority 3: information architecture and consistency

### Settings

- Replace or supplement the eight horizontally scrolling tabs with grouped
  navigation suitable for narrow screens.
- Add settings search for labels and help text.
- Group related fields under descriptive section headings.
- Reserve layout space for Save and Cancel so fixed actions never obscure form
  content.
- Mark settings that require a restart and validate values inline.
- Place destructive administrative operations in a clearly separated danger
  section.

### Navigation drawer

- Separate application destinations from individual subscriptions with a
  labelled section.
- Allow a large subscription list to collapse and be searched.
- Truncate long visible names while retaining accessible full text.
- Preserve a clear active-page indicator.

### Shared visual system

- Establish shared page widths, responsive padding, headings, toolbars,
  paginators, and bottom-action layouts.
- Prefer mobile cards or disclosure rows when reducing a table would hide its
  meaning.
- Reduce inline styles in favor of reusable component classes and breakpoint
  rules.
- Standardize loading skeletons, empty states, validation text, and success/error
  feedback.

## Reliability and privacy supporting the UI

- Prevent overlapping polling requests; use completion-aware scheduling or an
  RxJS polling pipeline with teardown and retry/backoff.
- Surface polling failure instead of silently retaining stale data.
- Tear down initialization subscriptions, timers, and in-flight work when a
  component is destroyed or its inputs change.
- Guard asynchronous responses so older requests cannot overwrite newer route,
  filter, subscription, or pagination state.
- Remove logging of complete download objects from the browser console. Log only
  sanitized diagnostic fields when logging is necessary.

## Proposed delivery phases

1. **Quick clarity and accessibility:** download labels, accessible control
   names, keyboard focus, sanitized client logging, and focused tests.
2. **Responsive Tasks:** mobile task presentation, labelled actions, task risk
   descriptions, and viewport tests.
3. **Operational feedback:** actionable errors, backend connection state,
   non-overlapping polling, and retry behavior.
4. **Subscription workflow:** creation stages, scan results, import scope, and
   manual check feedback.
5. **Content discovery:** unified Home toolbar plus Downloads search, filters,
   selection, and persistent view state.
6. **Information architecture:** Settings navigation/search, drawer organization,
   notifications, and shared responsive components.

## Implementation progress

### Phase 1 started (2026-10-09)

- Downloads waiting for a worker are labelled `Queued`, with the existing
  localization key updated in every locale that previously translated the old
  state.
- The Home, notifications, and settings controls in the global shell, plus
  download, subscription, and task actions, now expose accessible names instead
  of relying on icons or hover tooltips.
- The remaining top-bar side-navigation and player back controls now expose
  localized accessible names, and the menu button no longer suppresses its
  keyboard focus outline.
- Player actions for playlist and file downloads, sharing, file information, and
  Twitch chat now expose localized accessible names instead of relying on icons.
- Home custom-argument, selection-order, and selected-item removal actions now
  expose localized accessible names instead of relying on icons.
- The reusable Home library sort selector and direction control now expose
  localized accessible names, including the current direction.
- Category rule editing actions now expose localized accessible names for
  moving, removing, and adding rules.
- Subscription custom-argument editing and RSS URL copying now expose localized
  accessible names by reusing existing translations.
- Video-information editing, favorite toggling, and source-link actions now
  expose localized accessible names that follow their current state.
- Full download records are no longer written to the browser console when an
  error dialog is opened.
- Focused Downloads tests cover the queued-state label in addition to the
  existing merge and narrow-layout behavior.

Verification:

- all tracked XLF files passed XML validation;
- focused Downloads component suite: 4 passing in Chrome Headless;
- production frontend build: passed with the inherited `file-saver` CommonJS
  warning;
- localization extraction confirmed that the queued state retains its stable
  message identifier and new accessible labels reuse existing translations.

Remaining Phase 1 work includes visible keyboard-focus review, live-region
announcements, broader accessibility testing, and actionable error messages.

#### Keyboard focus follow-up (2026-10-18)

- Shared keyboard-focus styling now provides a high-contrast visible outline for
  links, buttons, form controls, and custom tab stops in both light and dark
  themes, while leaving pointer focus unaffected through `:focus-visible`.
- The media player's native focus outline and the Material switch focus state
  are no longer suppressed.
- The decorative theme switch inside the already interactive theme menu item is
  removed from the keyboard order and accessibility tree, avoiding a nested
  duplicate control.
- File and playlist card overflow menus now expose the existing localized
  `Actions` name instead of relying on the three-dot icon.
- The floating create-playlist action now exposes the existing localized
  `Create a playlist` name instead of relying on the plus icon.
- The cookie-file upload action now exposes the existing localized `Upload`
  name instead of relying on its icon and hover tooltip.
- The archive-import upload action now exposes the same localized `Upload`
  name instead of relying on its icon and hover tooltip.
- User-management row actions for saving, cancelling, editing, managing, and
  deleting users now expose their existing localized names instead of relying
  on icons and hover tooltips.
- Custom-argument autocomplete information actions now expose the existing
  localized `Info` name instead of relying on the icon and hover tooltip.
- The player description's `See more` disclosure now uses a native button with
  expanded-state semantics instead of a fake router link, preserving keyboard
  activation without triggering navigation.
- The reusable text-entry dialog now renders its prompt as a persistent form
  label instead of relying on disappearing placeholder text.
- The primary Home URL/search field now uses a persistent Material form label,
  reusing the existing localized `URL` and `Search` strings instead of relying
  on placeholder text that disappears after input.
- Existing snackbars and asynchronous connection/progress states already use
  Angular Material announcements or polite live regions; the remaining live
  announcement work is limited to workflows that do not use either mechanism.

### Phase 2 started (2026-10-09)

- Tasks use a compact card presentation below 650 pixels while retaining the
  sortable table at wider viewports.
- Compact cards show the full task title, last-run and last-confirmed values,
  schedule status, pending confirmation action, and one labelled action menu.
- Restore and reset controls stack to the available width on narrow screens.

Verification:

- focused Tasks component suite: 3 passing in Chrome Headless, covering 320,
  375, 455, 649, and 650 CSS-pixel layout decisions;
- production frontend build: passed with the inherited `file-saver` CommonJS
  warning.

The rebuilt validation container was checked at 455 and 1280 CSS-pixel widths.
Tasks use cards without horizontal overflow at 455 pixels and return to the
desktop table at 1280 pixels.

### Phase 3 started (2026-10-09)

- Downloads polling now schedules the next refresh only after the current
  request finishes, preventing overlapping one-second requests.
- Failed refreshes retain the last known queue, show a polite connection-status
  message, and retry automatically with bounded exponential backoff.
- A successful refresh clears the warning and restores the normal polling
  interval.
- Initialization and in-flight request subscriptions are released when the
  component is destroyed.
- Tasks use the same serialized polling, failure banner, bounded backoff,
  recovery, and teardown behavior while preserving table sorting and paging.
- Subscription details now schedule each refresh after the prior request ends,
  preserve route-change cancellation, back off after failures, and keep stale
  content visible with a connection-status message.
- Subscription floating actions are not created until subscription data exists,
  preventing null-state template errors during loading and route transitions.
- Home-page progress refreshes for the active download are serialized, ignore
  responses for a replaced download, back off after failures, recover to the
  normal interval after success, and release initialization, configuration,
  argument-change, timer, and request resources on destruction.
- The updater progress dialog no longer reads an empty status from a fixed
  interval, overlaps status requests, or leaves polling active after it closes.
  It keeps polling only while an update is active, retries connection failures
  with bounded backoff, and retains the last known update status.
- Watch Together now serializes both stream discovery checks and host updates,
  cancels discovery work when hosting starts, resets work when the active file
  changes, and releases requests, timers, and temporary playback-rate changes
  when stopped or destroyed.
- Skip Ad now tracks SponsorBlock lookups per video so its periodic check cannot
  start duplicate requests, safely handles the interval before a video is
  available, and cancels in-flight lookups when the video changes or the control
  is destroyed.
- Twitch Chat now prevents duplicate stored-chat and download requests, cancels
  stale work when the active file or subscription changes, replaces rather than
  accumulates playback timers, and rejects unsupported VOD URLs before starting
  a download request.
- Player now reacts to reused-route parameter changes, cancels stale file,
  playlist, subscription, view-count, and download requests, and replaces media
  event subscriptions and volume timers when the player is readied again.
- The Downloads, Tasks, Subscription, active-download, updater, and Watch
  Together connection statuses are present in every tracked locale source.

Verification:

- all 31 tracked XLF files passed XML validation;
- focused Downloads component suite: 7 passing in Chrome Headless, covering
  overlap prevention, backoff, recovery, and request teardown;
- focused Tasks component suite: 7 passing in Chrome Headless, covering layout
  selection, overlap prevention, view-state preservation, backoff, recovery, and
  request teardown;
- focused Subscription component suite: 2 passing in Chrome Headless, covering
  route replacement, request cancellation, serialized polling, backoff, and
  recovery;
- focused Main component suite: 6 passing in Chrome Headless, covering overlap
  prevention, stale-response protection, bounded backoff, recovery, and
  active-request teardown, plus the localized custom-arguments action name;
- focused Update Progress Dialog component suite: 6 passing in Chrome Headless,
  covering overlap prevention, active/finished polling decisions, bounded
  backoff, recovery, and active-request teardown;
- focused Concurrent Stream component suite: 8 passing in Chrome Headless,
  covering serialized discovery and host updates, mode transitions, bounded
  backoff, recovery, input replacement, and active-request teardown;
- focused Skip Ad Button component suite: 6 passing in Chrome Headless, covering
  pre-input safety, duplicate-request prevention, per-video caching, input
  replacement, and active-request teardown;
- focused Twitch Chat component suite: 8 passing in Chrome Headless, covering
  pre-input safety, duplicate-request prevention, timer replacement, VOD URL
  validation, input replacement, and active-request teardown;
- focused Player component suite: 8 passing in Chrome Headless, covering reused
  route parameters, delayed and already-complete initialization, route and
  initialization teardown, media-event replacement, and active-request teardown;
- production frontend build: passed with the inherited `file-saver` CommonJS
  warning;
- rebuilt validation container: healthy with zero restarts and HTTP 200 on port
  `18084`;
- deployed browser smoke check: Home, Downloads, Tasks, and Subscriptions had no
  horizontal overflow at 455 or 1280 CSS pixels and produced no browser-console
  errors; Downloads retained a full-width paginator and 439-pixel bulk actions
  at 455 pixels.

The periodic network-refresh audit is complete for the current Phase 3 scope.
Normal-state live verification is complete; forced backend-failure presentation
remains covered by focused tests rather than a destructive live outage exercise.

### Phase 4 started (2026-10-10)

- Subscription creation now exposes an in-dialog creating state, prevents
  duplicate submissions, and cancels the active request if the dialog closes.
- Recoverable backend and connection failures keep the completed form open and
  show an inline error. The API now returns stable, non-sensitive reason codes
  for duplicate URLs, invalid names, unavailable metadata, and preparation
  failures; the dialog maps those codes to actionable guidance while retaining
  compatibility with older text-only responses. Unknown server details are
  replaced with a sanitized fallback.
- Manual subscription checks now show starting, scanning, cancelling, cancelled,
  failed, and completed states in a polite live region. Completed checks report
  the number of newly visible items and completion time for the current view.
- Check and cancel actions prevent duplicate requests, release active work on
  route replacement or destruction, and no longer print raw request errors to
  the browser console. Their API handlers now await the existing boolean result
  before responding.

Verification:

- focused Subscribe Dialog component suite: 8 passing in Chrome Headless,
  covering duplicate-submit prevention, form preservation, structured and
  legacy creation errors, sanitized connection failures, successful completion,
  and active-request teardown;
- focused backend subscription-creation suite: 9 passing, including the stable
  error codes and the existing rollback and privacy behavior;
- the OpenAPI source and generated `SubscribeResponse` model include the optional
  `error_code` field;
- all 31 tracked XLF files passed XML validation and include the new stable
  creation-progress, fallback, and reason-specific messages. New reason-specific
  non-English messages use safe English fallbacks until translated;
- production frontend build: passed with the inherited `file-saver` CommonJS
  warning;
- focused Subscription component suite: 8 passing in Chrome Headless, including
  manual-check progress, fast completion, failure, cancellation, duplicate-action
  prevention, pre-data safety, route replacement, polling backoff, and teardown;
- backend syntax check: passed;
- backend suite: 73 passing and 22 pending; 10 inherited environment-dependent
  tests failed because network access, ffmpeg, TwitchDownloaderCLI, and a
  yt-dlp-compatible local Python are unavailable. The subscription creation,
  subscription, media-path, thumbnail-repair, and runtime-argument tests passed;
- all 31 tracked XLF files passed XML validation and contain the stable manual
  check status messages. Non-English locales retain safe English fallbacks until
  those new messages are translated.

### Phase 5 started (2026-10-12)

- Downloads can now be searched by title or subscription name and filtered by
  queued, active, paused, completed, failed, or cancelled status.
- Status mapping is deterministic, including precedence for failed and cancelled
  records, and the toolbar provides a direct Clear filters action plus a distinct
  no-results state.
- Search and status selections survive polling refreshes and navigation. Filter
  changes reset the paginator, while background refreshes preserve the current
  page, sort, and filter state.
- The toolbar collapses to a single-column layout at the existing mobile
  breakpoint. Embedded per-item Downloads views remain unchanged.
- Downloads now provides a direct Clear completed action. It requires explicit
  confirmation, explains its scope, and removes only successful completed
  entries while retaining failed, cancelled, paused, and active downloads. The
  detailed clear-by-type dialog remains available.
- Downloads rows now support stable ID-based selection, including select/deselect
  across the currently filtered results. Selection survives polling object
  replacement and automatically drops entries that disappear from the queue.
- The first bulk operation clears selected completed or paused entries after an
  explicit scope confirmation. Selected active entries are retained, partial
  failures remain selected, and embedded per-item Downloads views do not expose
  the queue-wide selection controls.
- Home library search, sorting, media filters, and filter clearing now share one
  responsive toolbar. Changing discovery criteria returns to the first page,
  while Clear filters removes search and media filters without changing sort.

Verification:

- focused Downloads component suite: 15 passing in Chrome Headless, including
  combined search/status filtering, deterministic state mapping, saved-state
  restoration, polling refreshes, filter clearing, and the confirmed completed
  cleanup workflow, plus filtered selection, selection pruning, and scoped bulk
  clearing;
- focused Recent Videos component suite: 9 passing in Chrome Headless, including
  first-page reset for discovery changes and one-step clearing that preserves
  sort settings, plus localized selection action names;
- focused Sort Property component suite: 2 passing in Chrome Headless, covering
  localized selector and current-direction names;
- focused Edit Category Dialog component suite: 2 passing in Chrome Headless,
  including localized category-rule action names;
- focused Edit Subscription Dialog component suite: 2 passing in Chrome
  Headless, including the localized custom-arguments action name;
- focused Generate RSS URL component suite: 2 passing in Chrome Headless,
  including the localized copy-action name;
- focused Video Info Dialog component suite: 2 passing in Chrome Headless,
  including state-specific edit and favorite names plus the source-link name;
- focused backend download-clearing suite: 2 passing, covering the new scoped
  completed filter and the existing detailed clear filters;
- the OpenAPI source and generated `ClearDownloadsRequest` model include the
  optional `clear_completed` field;
- production frontend build: passed with the inherited `file-saver` CommonJS
  warning;
- all 31 tracked XLF files passed XML validation and contain the stable Downloads
  discovery and clear-completed messages. Non-English locales use safe English
  fallbacks until translated.

### Phase 6 started (2026-10-12)

- Settings replaces the horizontally scrolling eight-tab header with a compact
  section selector below 650 pixels while retaining the existing desktop tabs,
  route-linked sections, translations, and disabled Users-section behavior.
- The Settings Save/Cancel bar now reserves space inside every tab, stays
  reachable at the bottom of the view, and uses equal-width actions on narrow
  screens instead of absolutely covering form content.
- Settings no longer constrains its tab content to a second viewport-relative
  scroll area; the application content pane owns vertical page scrolling.
- Settings now places the download-termination and server-restart controls in
  visually separated danger sections with explicit impact text. Restarting the
  server requires confirmation before the request is sent, matching the existing
  confirmation protection for terminating downloads.
- The server port now states that a restart is required, accepts only integer
  TCP ports from 1 through 65535, presents an inline validation error, and keeps
  Save disabled while the value is invalid.
- Main Settings now groups its fields under Server connection, User access,
  Subscriptions, and Appearance headings so related controls remain scannable
  without changing their existing behavior.
- Settings search now indexes section labels plus field and help concepts across
  all eight sections. Matching is case-insensitive, supports independent
  multi-word terms, exposes clear and empty states, and navigates directly to an
  enabled matching section.
- Downloader Settings now groups its existing controls under Paths and naming,
  Categories, Archive and sidecar files, and Limits headings, improving scanability
  without changing downloader behavior.
- Extra Settings now groups its existing controls under Interface and playback,
  Public API, Media integrations, RSS feed, and Browser tools headings without
  changing configuration behavior.
- Database Settings now separates status and record counts, MongoDB connection
  controls, and data transfer under descriptive headings without changing
  database behavior.
- Notification Settings now separates notification scope, webhook endpoints,
  and push-service configuration under descriptive headings without changing
  delivery behavior.
- Advanced Settings now separates download-engine controls, runtime and session
  options, download authentication, and application updates while retaining the
  existing restart danger section and behavior.
- Users Settings now separates registration, authentication method, LDAP
  directory configuration, and user management while preserving the existing
  multi-user-mode guard and behavior.
- Logs Settings now uses the application content pane for vertical scrolling,
  allows long lines to wrap, and reflows its line selector and actions on narrow
  screens instead of relying on fixed-height and absolutely positioned controls.
- Icon-only Settings controls for custom arguments, category management, and log
  copying now expose localized accessible names.
- The navigation drawer now separates individual subscriptions under a labelled
  section that can be collapsed, adds search when the list is long, truncates
  long visible names while retaining a full-name tooltip, and marks the active
  destination.
- Notification cards now expose related actions and removal in a labelled menu,
  keep removal available when no related action exists, use a neutral placeholder
  for missing affected-item metadata, and show an explicit filtered-empty state.
- Notification loading now cancels superseded menu-open requests, ignores stale
  results, releases initialization and active request subscriptions on teardown,
  and safely handles the menu closing before data has loaded.
- Unread notification cards now use a structural accent and stronger title weight
  in addition to the existing dot. Deleting notifications updates the local list
  and unread badge deterministically, while delete-all waits for server success
  before clearing the visible history and badge.
- Notification request failures now show an explicit connection-error state with
  a retry action; retrying clears the stale error immediately while the guarded
  request lifecycle prevents superseded responses from replacing current state.

Verification:

- focused Settings component suite: 17 passing in Chrome Headless, covering 320,
  649, and 650 CSS-pixel navigation modes, route updates, the disabled Users
  section, single-scroll ownership, cancelled and confirmed server restarts, and
  valid and invalid TCP port values, Main-section grouping labels, search
  matching, search-result navigation, and Main, Downloader, Extra, Database,
  Notifications, Advanced, and Users grouping labels plus accessible names for
  icon-only Settings actions;
- focused Logs viewer suite: 2 passing in Chrome Headless, covering initial log
  retrieval, page-owned scrolling, rendered log rows, the responsive toolbar,
  and its localized copy-action name;
- focused application-shell suite: 5 passing in Chrome Headless, covering
  case-insensitive subscription filtering, empty searches, records without a
  visible name, subscription-section disclosure state, and localized top-bar
  navigation action names;
- focused notification-list suite: 3 passing in Chrome Headless, covering
  missing and present affected-item details plus emitted related/removal actions;
- focused Notifications component suite: 7 passing in Chrome Headless, covering
  superseded requests, teardown, closing before the initial load completes,
  connection-error recovery, unread counts, individual deletion, and confirmed
  delete-all state;
- production frontend build: passed with the inherited `file-saver` CommonJS
  warning;
- validation image at commit `e366231` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, while the previous container and a
  verified appdata/users archive remain available for rollback;
- validation image at commit `7d561ca` rebuilt and redeployed on port `18084`;
  the container again remained healthy with HTTP 200 and all five persistent
  volumes attached after a deliberate restart, with its prior container and
  verified appdata/users archive retained for rollback;
- validation image at commit `d4db6c9` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `3f9bc41` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `1c00010` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `a2ccd6c` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `025328e` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `99999fc` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `8bc8acf` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `38d78cd` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `e51750c` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `2368d90` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `f4641e4` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `ffbdce5` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `aa33d4a` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `15a8cf6` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `e3373de` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `658b1e0` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- all 31 tracked XLF files passed XML validation; existing translated section
  labels are reused by both navigation presentations, while new danger-section
  copy, category-action names, top-bar navigation names, and player action names
  plus Home library action, sort-control, category-rule, and video-information
  action names use safe English fallbacks until translated.

Each phase should remain independently reviewable and should include focused
Jasmine/Karma coverage plus a production frontend build. Responsive phases
should also be manually checked at representative phone, tablet, and desktop
widths. Browser smoke checks supplement rather than replace automated tests.

## Out of scope for this plan

- Dependency modernization or Angular upgrades.
- Changes to downloader extraction behavior.
- Database or media-storage migration.
- Thumbnail or player redesign.
- Deployment changes unrelated to serving the reviewed frontend.
