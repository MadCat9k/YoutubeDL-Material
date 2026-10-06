import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = realpathSync(resolve(scriptDirectory, '..'));
const auditRoot = resolve(repositoryRoot, '.local-ai', 'runs');
const verdicts = new Set(['accepted', 'corrected', 'rejected']);

function fail(message) {
  console.error(`Local coder review: ${message}`);
  process.exit(1);
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function snapshot(repositoryPath) {
  const absolutePath = resolve(repositoryRoot, repositoryPath);
  if (!existsSync(absolutePath)) return { exists: false, sha256: null, bytes: 0 };
  if (!lstatSync(absolutePath).isFile()) return { exists: true, sha256: null, bytes: 0 };
  const content = readFileSync(absolutePath);
  return {
    exists: true,
    sha256: createHash('sha256').update(content).digest('hex'),
    bytes: content.byteLength,
  };
}

function runGit(args) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.error) fail(`git could not start: ${result.error.message}`);
  if (result.status !== 0) fail(result.stderr.trim() || 'git command failed');
  return result.stdout;
}

function readStatusPaths() {
  const entries = runGit([
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=all',
  ])
    .split('\0')
    .filter(Boolean);
  const paths = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const code = entry.slice(0, 2);
    paths.push(entry.slice(3));
    if (code.includes('R') || code.includes('C')) paths.push(entries[++index]);
  }
  return paths;
}

function pathIsAllowed(repositoryPath, allowedPaths) {
  return allowedPaths.some((allowedPath) =>
    allowedPath.endsWith('/')
      ? repositoryPath.startsWith(allowedPath)
      : repositoryPath === allowedPath,
  );
}

function resolveRunId(argument) {
  if (argument === 'last') {
    const lastPath = resolve(repositoryRoot, '.local-ai', 'last-result.json');
    if (!existsSync(lastPath)) fail('no last local-coder result exists');
    argument = readJson(lastPath, 'last-result.json').runId;
  }
  if (typeof argument !== 'string' || !/^[A-Za-z0-9._-]+$/.test(argument)) {
    fail('invalid run id');
  }
  return argument;
}

function parseArguments(args) {
  let runArgument;
  let verdict;
  const notes = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--') continue;
    if (argument === '--verdict') {
      verdict = args[++index];
    } else if (argument === '--note') {
      const note = args[++index];
      if (!note) fail('--note requires a value');
      notes.push(note);
    } else if (argument.startsWith('--')) {
      fail(`unknown option ${argument}`);
    } else if (runArgument) {
      fail('provide exactly one run id or "last"');
    } else {
      runArgument = argument;
    }
  }
  if (!runArgument) fail('run id is required');
  if (!verdicts.has(verdict)) fail('verdict must be accepted, corrected, or rejected');
  if (!notes.length) fail('at least one --note is required');
  return { runId: resolveRunId(runArgument), verdict, notes };
}

function currentHead() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function recordReview(args) {
  const { runId, verdict, notes } = parseArguments(args);
  const directory = resolve(auditRoot, runId);
  const runPath = resolve(directory, 'run.json');
  const reviewPath = resolve(directory, 'review.json');
  if (!existsSync(runPath)) fail(`run does not exist: ${runId}`);
  if (existsSync(reviewPath)) fail(`run already has a review: ${runId}`);
  const run = readJson(runPath, 'run.json');
  if (run.status !== 'completed' || !Array.isArray(run.files)) {
    fail('run is incomplete or damaged');
  }
  if (!run.files.length && verdict !== 'rejected') {
    fail('a no-op draft can only be rejected');
  }
  const files = run.files.map((file) => {
    const current = snapshot(file.path);
    return {
      path: file.path,
      draft: file.draft,
      current,
      unchangedFromDraft:
        current.exists === file.draft.exists && current.sha256 === file.draft.sha256,
    };
  });
  const draftedPaths = new Set(files.map((file) => file.path));
  const additionalTaskPaths = readStatusPaths().filter(
    (path) =>
      !draftedPaths.has(path) && pathIsAllowed(path, run.task.allowedPaths),
  );
  const changed = [
    ...files.filter((file) => !file.unchangedFromDraft).map((file) => file.path),
    ...additionalTaskPaths,
  ];
  if (verdict === 'accepted' && changed.length) {
    fail(`accepted is invalid because Codex changed: ${changed.join(', ')}`);
  }
  if (verdict === 'corrected' && !changed.length) {
    fail('corrected is invalid because no post-draft edits were detected');
  }
  const review = {
    schemaVersion: 1,
    runId,
    verdict,
    notes,
    reviewedAt: new Date().toISOString(),
    supervisorChangedPaths: changed,
    additionalTaskPaths,
    files,
    head: currentHead(),
  };
  writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`);
  console.log(`Recorded ${verdict} review for ${runId}.`);
}

function percentage(part, total) {
  return total ? `${((part / total) * 100).toFixed(1)}%` : 'n/a';
}

function printStats() {
  if (!existsSync(auditRoot)) {
    console.log('No local-coder runs recorded yet.');
    return;
  }
  const items = readdirSync(auditRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directory = resolve(auditRoot, entry.name);
      const runPath = resolve(directory, 'run.json');
      if (!existsSync(runPath)) return null;
      const reviewPath = resolve(directory, 'review.json');
      return {
        run: readJson(runPath, `${entry.name}/run.json`),
        review: existsSync(reviewPath) ? readJson(reviewPath, `${entry.name}/review.json`) : null,
      };
    })
    .filter(Boolean);
  const completed = items.filter(({ run }) => run.status === 'completed');
  const reviewed = completed.filter(({ review }) => review);
  const count = (verdict) => reviewed.filter(({ review }) => review.verdict === verdict).length;
  const accepted = count('accepted');
  const corrected = count('corrected');
  const rejected = count('rejected');
  console.log('Local coder performance');
  console.log(`Runs: ${items.length}; completed: ${completed.length}; reviewed: ${reviewed.length}`);
  console.log(`Accepted unchanged: ${accepted}; corrected: ${corrected}; rejected: ${rejected}`);
  console.log(`First-draft acceptance: ${percentage(accepted, reviewed.length)}`);
  console.log(`Useful after review: ${percentage(accepted + corrected, reviewed.length)}`);
}

if (process.argv.includes('--stats')) printStats();
else recordReview(process.argv.slice(2));
