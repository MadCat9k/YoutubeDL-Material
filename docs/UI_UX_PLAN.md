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

#### Subscription removal feedback (2026-10-21)

- Subscription removal now waits for an explicit successful API result before
  closing the information dialog or removing the subscription from the view.
- A rejected or failed request leaves the dialog open, restores the removal
  action for retry, and announces a localized failure message in a snackbar.
- Repeated activation while a removal request is pending is ignored and the
  dialog actions are disabled, preventing duplicate deletion requests or a
  dismissal that would hide the eventual result.
- Focused component tests cover success, rejected responses, transport errors,
  duplicate activation, and destruction while a request is pending.

Verification:

- focused subscription-information dialog suite: 5 passing in Chrome Headless;
- all 31 tracked XLF files passed XML validation, and localization extraction
  confirmed the new stable message identifier;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning;
- validation image at commit `771017e` rebuilt and redeployed on port `18084`;
  the container returned HTTP 200 and remained healthy with restart count zero
  after a deliberate restart, with a verified appdata/users archive and the
  previous container retained for rollback.

#### Settings save feedback (2026-10-21)

- Settings saves now report both success and failure through announced
  snackbars instead of failing silently or writing only to the browser console.
- A rejected or failed save leaves the edited values intact for retry, while a
  successful response records the exact submitted snapshot so edits made during
  the request are not incorrectly treated as saved.
- Save and Cancel are disabled while a request is pending, and duplicate save
  requests are ignored.

Verification:

- focused Settings component suite: 22 passing in Chrome Headless, including
  successful, rejected, failed, duplicate, stale-edit, and destroyed-component
  save paths;
- all 31 tracked XLF files passed XML validation;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning;
- validation image at commit `1f7e238` rebuilt and redeployed on port `18084`;
  the container returned HTTP 200 and remained healthy with restart count zero
  after a deliberate restart, with a verified appdata/users archive and the
  previous container retained for rollback.

#### Subscription update feedback (2026-10-21)

- The update endpoint now waits for persistence and returns a real boolean
  result instead of serializing an unresolved Promise as a false success.
- The subscription editor reports successful, rejected, and failed updates,
  keeps rejected edits available for retry, and blocks duplicate saves.
- Successful updates record the exact submitted snapshot, so edits made while
  the request is pending remain visibly unsaved.

Verification:

- focused backend subscription-update suite: 3 passing;
- focused subscription-editor suite: 7 passing in Chrome Headless;
- full backend suite: 92 passing and 22 pending, with the same 10
  host-environment failures caused by unavailable network access, unsupported
  host Python, missing FFmpeg, or missing TwitchDownloader;
- all 31 tracked XLF files passed XML validation;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning;
- validation image at commit `bb24620` rebuilt and redeployed on port `18084`;
  the container returned HTTP 200 and remained healthy with restart count zero
  after a deliberate restart, with a verified appdata/users archive and the
  previous container retained for rollback.

#### Download action feedback (2026-10-21)

- Pause, resume, restart, cancel, and clear actions now announce both completion
  and failure instead of silently ignoring transport errors or directing users
  to server logs.
- Failure messages identify the attempted action and offer a direct retry cue;
  the incorrect pause message previously shown for a failed clear is removed.
- Dialog, bulk-action, clipboard, and per-download action streams now stop when
  the Downloads component is destroyed.

Verification:

- focused Downloads component suite: 19 passing in Chrome Headless, covering
  successful, rejected, transport-failed, restart-replacement, and destroyed
  action requests alongside existing polling and responsive behavior;
- all 31 tracked XLF files passed XML validation, including the shared action
  placeholder in both new messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning;
- validation image at commit `6000824` rebuilt and redeployed on port `18084`;
  the container returned HTTP 200 and remained healthy with restart count zero
  after a deliberate restart, with a verified appdata/users archive and the
  previous container retained for rollback.

#### Database restore feedback (2026-10-21)

- Database restore no longer enters a stuck loading state when no backup is
  selected, and repeated activation while a restore is pending is ignored.
- The backup selection, Cancel action, and Restore action remain disabled while
  the request is pending so the result cannot be hidden or changed mid-request.
- A rejected or failed restore keeps the dialog open, restores its actions for
  retry, and announces a localized failure message without exposing the raw
  request error in the browser console.
- Backup-list and restore requests stop updating the dialog after it is
  destroyed.

Verification:

- focused Restore DB Dialog component suite: 7 passing in Chrome Headless,
  covering missing selection, success, rejected and transport-failed restores,
  duplicate activation, and backup-list and restore teardown;
- all 31 tracked XLF files passed XML validation and contain the stable database
  restore failure message;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning;
- validation image at commit `f39bb4e` rebuilt and redeployed on port `18084`;
  the container returned HTTP 200 and remained healthy with restart count zero
  after a deliberate restart, with a verified appdata/users archive and the
  previous container retained for rollback.

#### Stop-all-downloads feedback (2026-10-21)

- The destructive stop-all-downloads action now waits for confirmation through
  the dialog result and prevents another request while the first is pending.
- Successful requests retain the existing completion message, while rejected or
  failed requests show a localized retry cue instead of directing users to
  server logs.
- Confirmation and request subscriptions stop when Settings is destroyed, and
  the action is re-enabled after every completed request.

Verification:

- focused Settings component suite: 28 passing in Chrome Headless, including
  cancelled, successful, rejected, transport-failed, duplicate, and destroyed
  stop-all-downloads paths;
- all 31 tracked XLF files passed XML validation and contain the stable
  stop-all-downloads failure message;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning;
- validation image at commit `43aadb7` rebuilt and redeployed on port `18084`;
  the container returned HTTP 200 and remained healthy with restart count zero
  after a deliberate restart, with a verified appdata/users archive and the
  previous container retained for rollback.

#### Database transfer feedback (2026-10-21)

- Database transfer now ignores repeated activation while a request is pending
  and releases both confirmation and request subscriptions when Settings is
  destroyed.
- Successful transfers still refresh database status, while rejected and failed
  transfers restore the action for retry and announce a localized failure
  message.
- Raw server errors and request objects are no longer exposed in the snackbar or
  browser console.

Verification:

- focused Settings component suite: 34 passing in Chrome Headless, including
  cancelled, successful, rejected, transport-failed, duplicate, and destroyed
  database-transfer paths;
- all 31 tracked XLF files passed XML validation and contain the stable database
  transfer failure message;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning;
- validation image at commit `059a39a` rebuilt and redeployed on port `18084`;
  the container returned HTTP 200 and remained healthy with restart count zero
  after a deliberate restart, with a verified appdata/users archive and the
  previous container retained for rollback.

#### Database connection-test feedback (2026-10-21)

- Empty MongoDB connection strings no longer start a test, and the action stays
  disabled while a request is pending so duplicate tests cannot overlap.
- Successful tests retain their existing confirmation, while rejected and
  failed tests restore the action for retry and show a localized corrective
  message.
- Raw backend errors are no longer displayed, preventing connection details from
  leaking through feedback, and pending results are ignored after Settings is
  destroyed.

Verification:

- focused Settings component suite: 40 passing in Chrome Headless, including
  empty, successful, rejected, transport-failed, duplicate, and destroyed
  database connection-test paths;
- all 31 tracked XLF files passed XML validation and contain the stable database
  connection-test failure message;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning;
- validation image at commit `5e3ac15` rebuilt and redeployed on port `18084`;
  the container returned HTTP 200 and remained healthy with restart count zero
  after a deliberate restart, with a verified appdata/users archive and the
  previous container retained for rollback.

#### Server restart feedback (2026-10-21)

- Server restart now ignores repeated activation while a request is pending and
  disables its danger-zone action until the request completes.
- Successful responses retain the existing restart notice, while rejected and
  failed responses restore the action for retry and announce a localized
  failure message.
- Confirmation and restart request subscriptions stop when Settings is
  destroyed, preventing late feedback after navigation.

Verification:

- focused Settings component suite: 44 passing in Chrome Headless, including
  cancelled, successful, rejected, transport-failed, duplicate, and destroyed
  server-restart paths;
- all 31 tracked XLF files passed XML validation and contain the stable server
  restart failure message;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Database status feedback (2026-10-22)

- Database status now distinguishes loading from failure instead of immediately
  directing users to server logs while the request is still in progress.
- Failed status requests show sanitized connection guidance and a direct Retry
  action. Retrying clears the stale error while the request is pending.
- Overlapping status requests are prevented, and pending initialization and
  status work is released when Settings is destroyed.

Verification:

- focused Settings component suite: 50 passing in Chrome Headless, including
  successful, failed, overlapping, retried, and destroyed database-status
  request paths;
- all 31 tracked XLF files passed XML validation and contain the stable loading
  and failure messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning;
- validation image at commit `2e6bbf0` rebuilt and redeployed on port `18084`;
  the container returned HTTP 200 and remained healthy with restart count zero
  after a deliberate restart, with a verified appdata/users archive and the
  previous container retained for rollback.

#### Public API key feedback (2026-10-22)

- Public API key generation now disables its action while the request is
  pending and ignores repeated activation.
- Successful generation announces completion without exposing the key, while a
  rejected or failed request leaves the previous key intact and shows a
  localized retry cue.
- Pending key-generation work is released when Settings is destroyed.

Verification:

- focused Settings component suite: 55 passing in Chrome Headless, including
  successful, rejected, failed, duplicate, and destroyed key-generation paths;
- all 31 tracked XLF files passed XML validation and contain the stable success
  and failure messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Category-order feedback (2026-10-24)

- Category reordering now submits one immutable order snapshot and disables
  other category actions until the request settles.
- Successful updates announce completion. Rejected and failed updates restore
  the previous visible order and show a localized retry cue instead of leaving
  unsaved ordering on screen.
- A pending reorder is cancelled and rolled back when Settings is destroyed.

Verification:

- focused Settings component suite: 60 passing in Chrome Headless, including
  successful, rejected, failed, duplicate, and destroyed category-order paths;
- all 31 tracked XLF files passed XML validation and contain the stable success
  and rollback messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Category-deletion feedback (2026-10-24)

- Category deletion now distinguishes cancellation, successful deletion,
  rejected responses, and failed requests instead of silently ignoring a
  rejected response.
- A pending deletion disables category creation, editing, deletion, and
  reordering so conflicting category changes cannot overlap.
- Failed deletions restore the controls for retry and show a localized,
  actionable message. Confirmation and request subscriptions stop when
  Settings is destroyed.

Verification:

- focused Settings component suite: 66 passing in Chrome Headless, including
  cancelled, successful, rejected, transport-failed, duplicate, and destroyed
  category-deletion paths;
- all 31 tracked XLF files passed XML validation and contain the stable
  category-deletion failure message;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Category-creation feedback (2026-10-24)

- Category creation now keeps the entered name available after rejected and
  failed requests, restores the submission controls for retry, and announces
  both successful creation and actionable failure states.
- The shared input dialog now locks its input, Cancel, and submit controls while
  an emitted request is pending, preventing duplicate submissions. Its caller
  can explicitly restore the populated form after a recoverable failure.
- Category creation and its dialog emitter stop updating Settings after the
  component is destroyed, and other category actions remain disabled while the
  request is pending.

Verification:

- focused Settings and Input Dialog component suites: 75 passing in Chrome
  Headless, including successful, rejected, transport-failed, duplicate, and
  destroyed category-creation paths plus dialog pending-state behavior;
- all 31 tracked XLF files passed XML validation and contain the stable
  category-creation success and failure messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Category-update feedback (2026-10-25)

- Category editing now prevents duplicate saves, disables every form and dialog
  action while a request is pending, and validates that a category name is
  present before submission.
- Successful updates announce completion and record the exact submitted
  snapshot. Rejected and failed updates preserve the current edits, restore the
  controls for retry, and show a localized actionable message without logging
  raw request errors.
- Active update requests stop when the dialog is destroyed, preventing a late
  response from refreshing categories or showing stale feedback.

Verification:

- focused Edit Category Dialog component suite: 8 passing in Chrome Headless,
  including successful, rejected, transport-failed, duplicate, stale-edit, and
  destroyed-dialog update paths;
- all 31 tracked XLF files passed XML validation and contain the stable
  category-update success and failure messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Task-action feedback (2026-10-25)

- Running and confirming a task now disable both actions for that task until the
  request settles, preventing overlapping operations before polling reports the
  task as busy.
- Successful actions refresh the task list, and task runs also refresh the
  available database backups. Rejected and failed requests restore the controls
  for retry and show localized actionable feedback without logging raw errors.
- Task reset now prevents duplicate confirmation or reset requests, refreshes
  tasks and database backups after success, and restores the action after a
  rejected or failed request.
- Pending confirmations and task requests stop updating the page after the Tasks
  component is destroyed.

Verification:

- focused Tasks component suite: 19 passing in Chrome Headless, covering
  successful, rejected, transport-failed, duplicate, cross-action, reset, and
  destroyed-component paths alongside the existing responsive and polling
  behavior;
- all 31 tracked XLF files passed XML validation and contain the stable
  task-action failure messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Task-schedule feedback (2026-10-25)

- Task scheduling now allows only one open schedule dialog or update request per
  task, and disables that task's Schedule action until the workflow settles.
- A successful update refreshes the task list and announces completion. Rejected
  and failed updates restore the action for retry and show localized actionable
  feedback instead of failing silently.
- Schedule-dialog and update-request subscriptions stop when the Tasks component
  is destroyed, preventing late refreshes or feedback after navigation.

Verification:

- focused Tasks component suite: 23 passing in Chrome Headless, covering
  successful, cancelled, rejected, transport-failed, duplicate, and destroyed
  schedule workflows alongside the existing task-action, responsive, and polling
  behavior;
- all 31 tracked XLF files passed XML validation and contain the stable schedule
  success and failure messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Task-settings feedback (2026-10-25)

- Task Settings now prevent duplicate saves and disable every editable field plus
  the dialog actions while a save request is pending.
- Successful saves announce completion and record the exact submitted snapshot,
  so edits made while the request is pending remain visibly unsaved.
- Rejected and failed saves preserve the current edits, restore the controls for
  retry, and show localized actionable feedback instead of reloading and
  discarding the form.
- Task loading and save requests stop updating the dialog after it is destroyed.

Verification:

- focused Task Settings component suite: 8 passing in Chrome Headless, covering
  loading, successful, rejected, transport-failed, duplicate, stale-edit, and
  destroyed-dialog paths;
- all 31 tracked XLF files passed XML validation and contain the stable task
  settings success and failure messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Archive-deletion feedback (2026-10-25)

- Archive deletion now waits for an explicit successful response before changing
  the visible archive list or clearing its selection.
- Successful deletion removes only the confirmed extractor-and-ID records. This
  corrects the previous inverted local filter, which could retain the selected
  row while removing unrelated rows from the same extractor.
- Rejected and failed deletions preserve both the archive list and selection for
  retry, show localized actionable feedback, and no longer produce a false local
  success state.
- Confirmation and deletion controls prevent duplicate work, remain disabled
  while the workflow is pending, and stop updating after the component is
  destroyed.

Verification:

- focused Archive Viewer component suite: 6 passing in Chrome Headless, covering
  exact-record deletion, rejected and transport-failed requests, duplicate
  confirmation and request prevention, and destroyed-component behavior;
- all 31 tracked XLF files passed XML validation and contain the stable archive
  deletion failure message;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Archive-import feedback (2026-10-26)

- Archive import now accepts only the first selected file, snapshots its target
  file type and subscription, and prevents duplicate submissions while the file
  or request is pending.
- Successful imports refresh the archive list only after the server confirms the
  operation. Rejected requests, transport failures, and local file-read failures
  preserve the selected file for retry and show localized actionable feedback.
- Import target controls stay disabled while work is pending, and late file or
  request results cannot update a destroyed component.

Verification:

- focused Archive Viewer component suite: 12 passing in Chrome Headless,
  including successful, rejected, transport-failed, duplicate, and
  destroyed-component import paths alongside the deletion coverage;
- all 31 tracked XLF files passed XML validation and contain the stable archive
  import failure message;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Archive-download feedback (2026-10-26)

- Archive export now snapshots the selected file type and subscription, disables
  its action while the request is pending, and ignores repeated activation.
- Successful exports announce that the browser download started. Request and
  local save failures restore the action and show a localized retry cue instead
  of failing silently.
- Pending export requests stop updating or saving files after Archive Viewer is
  destroyed.

Verification:

- focused Archive Viewer component suite: 17 passing in Chrome Headless,
  covering successful, request-failed, local-save-failed, duplicate, and
  destroyed-component export paths alongside import and deletion coverage;
- all 31 tracked XLF files passed XML validation and contain the stable archive
  download success and failure messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

#### Archive-list loading and recovery (2026-10-26)

- Archive Viewer now distinguishes initial/loading, empty, populated, and failed
  list states instead of showing an empty message before retrieval or silently
  retaining stale content after a request failure.
- Failed and invalid responses show sanitized guidance with a direct Retry
  action. Destructive and export actions stay disabled until a valid list is
  available.
- Filter changes cancel the previous list request, clear stale selection, and
  guard the result so an older response cannot overwrite the newest filter.
  Pending requests stop updating after the component is destroyed.

Verification:

- focused Archive Viewer component suite: 22 passing in Chrome Headless,
  covering successful empty retrieval, transport and invalid-response failures,
  superseded requests, and destroyed-component list loading alongside the
  import, export, and deletion coverage;
- all 31 tracked XLF files passed XML validation and contain the stable archive
  loading and failure messages;
- production frontend build passed with the inherited `file-saver` CommonJS
  warning.

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
- Weekly task-schedule toggles retain their compact locale-aware weekday letters
  while exposing the full locale-aware weekday names to assistive technology,
  removing ambiguity between Tuesday and Thursday or Saturday and Sunday.
- One-time task schedules with a time but no date now show the existing localized
  `Choose a date` guidance instead of failing on a null date.
- Playlist-creation request failures now show the existing localized failure
  message and leave the dialog open for retry instead of exposing the raw error
  only in the browser console.
- Video-information refresh failures now clear the loading state and show the
  existing localized failure message instead of exposing the raw error only in
  the browser console.
- Log-retrieval failures now clear the loading state and preserve the existing
  localized failure message without exposing the raw request error in the
  browser console.
- Playlist-update failures now keep the dialog retryable, avoid marking the
  playlist as updated, and show an existing localized failure message instead
  of a false success message or raw browser-console error.
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
- The Home and subscription library paginator now remembers a supported
  Items-per-page selection across refreshes and reloads, while invalid saved
  values fall back to the existing default.

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
- validation image at commit `5eabc79` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, while the previous container and a
  verified appdata/users archive remain available for rollback;
- validation image at commit `64040c1` rebuilt and redeployed on port `18084`;
  the container again remained healthy with HTTP 200 and all five persistent
  volumes attached after a deliberate restart, with its prior container and
  verified appdata/users archive retained for rollback;
- validation image at commit `218d4b0` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `35c7631` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `a1d5ebf` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `8da2fe8` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `eca2ca5` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `554a552` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `c96a587` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `c01aa71` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `e81c67c` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `d46bed8` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `6ff8df0` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `d923af1` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `a8e235a` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `c711bde` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `ea78eed` rebuilt and redeployed on port `18084`;
  the container remained healthy with HTTP 200 and all five persistent volumes
  attached after a deliberate restart, with a verified appdata/users archive
  and the prior container retained for rollback;
- validation image at commit `57f998d` rebuilt and redeployed on port `18084`;
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
