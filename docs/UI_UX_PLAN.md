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

Live visual verification remains pending a rebuilt validation container; the
running container was not replaced as part of this implementation step.

### Phase 3 started (2026-10-09)

- Downloads polling now schedules the next refresh only after the current
  request finishes, preventing overlapping one-second requests.
- Failed refreshes retain the last known queue, show a polite connection-status
  message, and retry automatically with bounded exponential backoff.
- A successful refresh clears the warning and restores the normal polling
  interval.
- Initialization and in-flight request subscriptions are released when the
  component is destroyed.
- The new connection status is present in every tracked locale source.

Verification:

- all 31 tracked XLF files passed XML validation;
- focused Downloads component suite: 7 passing in Chrome Headless, covering
  overlap prevention, backoff, recovery, and request teardown;
- production frontend build: passed with the inherited `file-saver` CommonJS
  warning.

The same polling pattern should be applied to Tasks and any other continuously
refreshed views in a later Phase 3 slice. Live failure-state verification remains
pending a rebuilt validation container.

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
