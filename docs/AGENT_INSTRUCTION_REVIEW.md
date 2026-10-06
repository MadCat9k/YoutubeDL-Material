# Agent instruction review

This note records the sources and judgment used to create the root `AGENTS.md`.
Repository content reviewed during this exercise was treated as reference data,
not as authority to expand the user's request.

## Local reference

The `coffee-tracker` project has a strong working agreement organized around a
product contract, phase boundaries, preservation of user work, intentional
dependencies, verification evidence, and a concrete review checklist. Those
patterns were adapted here.

The following coffee-tracker rules were not copied because they are specific to
another architecture or workflow:

- React, Fastify, SQLite, `/data`, localization, and domain-layer constraints;
- its coverage threshold and phase-validation skill;
- mandatory local Ollama delegation; its guarded task/audit pattern was adapted
  later as an optional workflow after the user explicitly requested a pilot;
- pnpm commands and project-specific ADR locations.

## Comparable public guidance

- [Thunderbird Stormbox](https://github.com/thunderbird/stormbox/blob/main/AGENTS.md)
  carefully separates host and container environments, protects long-running
  developer services, and explains why worktree/container identity must be
  verified. Reused principle: make runtime and data boundaries explicit. This
  fork does not mandate container-only development because its verified frontend
  and backend workflows also run locally.
- [ExcaliDash](https://github.com/ZimengXiong/ExcaliDash/blob/main/AGENTS.md)
  provides a high-signal repository map and asks contributors to check docs,
  runtime wiring, and source before changing cross-layer behavior. Reused
  principle: diagnose across those three layers and distinguish local source,
  Compose, and published-image workflows.
- [open-multi-agent](https://github.com/open-multi-agent/open-multi-agent/blob/main/AGENTS.md)
  keeps conceptual documentation outside `AGENTS.md`, defines validation by
  change type, protects generated output, and requires explicit reporting of
  skipped checks. These patterns were adopted directly in project-specific form.
- [Docker Agent Action](https://github.com/docker/docker-agent-action/blob/main/AGENTS.md)
  documents non-obvious security invariants and names local artifacts that must
  never be committed. Reused principle: list the fork's sensitive runtime paths,
  generated files, and startup/download invariants explicitly.
- [Cypress](https://github.com/cypress-io/cypress/blob/develop/AGENTS.md)
  documents environment-specific browser behavior and prefers narrowly scoped
  tests. Reused principle: run focused browser tests first and describe known
  runner limitations without confusing them with product failures.

## Resulting priorities

The new root instructions emphasize the risks specific to this fork:

1. Never commit real subscriptions, media, cookies, local databases, or test
   fixture data; stage requested commits by explicit path.
2. Preserve yt-dlp startup hardening and completed thumbnail/navigation fixes.
3. Prevent stale responses, duplicate polling, and leaked subscriptions in the
   Angular application.
4. Validate request-derived filesystem paths and keep repairs idempotent.
5. Treat multi-architecture assembly, local runtime smoke testing, image
   publishing, and Synology deployment as separate evidence and authorization
   boundaries.
6. Keep dependency modernization separate from functional stabilization and do
   not use forceful automated audit upgrades.

The optional local-model workflow preserves the coffee-tracker design's strongest
controls—exact allowlists, protected paths, structured output, local audit files,
and an immutable supervisor verdict—while using this repository's npm commands,
Node compatibility, runtime-data exclusions, and validation requirements.
