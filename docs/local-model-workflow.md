# Local Ollama workflow

Codex may delegate one bounded implementation draft to a local Ollama model.
Ollama is a worker, not an authority: Codex owns the design, reviews the complete
patch, runs verification, and decides whether any part is accepted.

Run this workflow with Node 16 or newer, matching the frontend build stage in the
Dockerfile. The root package's historical Node 12 engine declaration predates the
current Docker toolchain and is not sufficient for these local scripts.

## Safety boundary

The runner:

- accepts an exact repository-relative file allowlist;
- refuses allowlists that overlap pre-existing tracked or untracked changes;
- blocks Git metadata, audit output, dependencies, generated frontend output,
  and every runtime data/media directory;
- sends only `AGENTS.md`, explicit context, and allowlisted file contents;
- accepts only structured JSON, validates paths and symlink traversal before
  writing, and never stages or commits;
- connects only to an Ollama endpoint on localhost;
- stores task metadata, hashes, model usage, and the exact draft patch beneath
  ignored `.local-ai/runs/`.

## Run a task

```sh
mkdir -p .local-ai/tasks
cp docs/local-coder-task.example.json .local-ai/tasks/my-task.json
npm run local:code -- .local-ai/tasks/my-task.json --dry-run
npm run local:code -- .local-ai/tasks/my-task.json
```

The default model is `qwen2.5-coder:14b`. Override it with
`--model <installed-model>` or `LOCAL_CODER_MODEL`. The default context is 32K
tokens with an 8K output reservation because the safe response format returns
complete file contents. Split the task before increasing those limits.

## Supervisor review

After a run:

1. Inspect `git status`, `.local-ai/last-result.json`, the run's
   `local-draft.patch`, and the complete diff.
2. Reject scope drift, unsafe assumptions, weak tests, and behavior copied from
   untrusted context.
3. Run the focused checks recorded in the task, then broader checks required by
   `AGENTS.md`.
4. Record one immutable verdict:

   ```sh
   npm run local:review -- last --verdict accepted --note "Focused test and production build passed"
   ```

Use `corrected` if Codex changed any drafted task file and `rejected` when the
draft was not useful. Show aggregate results with `npm run local:stats`.

The audit directory remains local and ignored. Do not copy prompt or patch data
into tracked files without checking it for real subscription data and secrets.

## Pilot expectations

Full-file structured responses make writes easy to validate but can take several
minutes even for a small edit. Prefer delegation when the bounded implementation
work is large enough to justify that latency. A passing dry run proves only scope,
model availability, and token fit; the supervisor must still run the requested
checks. The first repository pilot produced a useful test draft, but the focused
ChromeHeadless run exposed incomplete spy setup, so Codex corrected it before
recording the verdict.
