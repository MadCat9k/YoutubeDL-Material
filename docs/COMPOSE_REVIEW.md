# Existing Compose and startup-script review

## Compose verdict

The intent is sound, but the pasted text is HTML/Markdown escaped and cannot be
used as-is. Remove the trailing `\` characters, replace `&#x20;` with spaces,
remove escaping before list dashes and colons, and quote values where YAML may
coerce their type. The normalized replacement is
[`docker-compose.synology.yml`](../docker-compose.synology.yml).

Key observations:

- `version: "3.9"` is accepted by older Compose, but ignored by current Compose.
- `command` does not bypass the image `ENTRYPOINT`. In the upstream image, the
  entrypoint uses `UID`/`GID` and `gosu` before it runs the supplied command.
- `user: "0:0"` is therefore intentional for the upstream permission setup, even
  though the Node process ultimately runs as `1026:101`.
- `restart: on-failure:5` is valid. `unless-stopped` may be preferable for a NAS,
  but changing restart semantics should be an explicit operational choice.
- `cpu_shares: 768` is a relative weight under contention, not a CPU limit.
- A production healthcheck should include a start period, interval, timeout, and
  retries. The replacement does.
- Confirm that UID `1026` has read/write access to every bind mount. The startup
  entrypoint may recursively change ownership under `/app`, which can be slow on
  large media libraries.

## Startup-script verdict

Do not carry the 40-second wrapper rewrite loop into the fork. It has several
failure modes:

1. It creates `python-packages` but not `/app/appdata/bin`.
2. It downloads directly to a live target without `curl --fail` or an atomic
   temporary-file rename.
3. A restart requires both PyPI and GitHub to be reachable.
4. The app's updater and the loop can write the same executable concurrently.
5. The pinned browser profile can become unsupported or deprioritized.
6. The background loop's failure is easy to miss because all output is redirected
   into one startup log.

The fork instead installs `curl-cffi` while building the image and applies the
`YTDLP_IMPERSONATE` setting whenever the backend launches yt-dlp. The application
remains responsible for updating the real yt-dlp binary.

## Data safety

The bind mounts, not the container, hold the important state. Back up at least:

- `/volume1/docker/youtubedl/appdata`
- `/volume1/docker/youtubedl/users`
- `/volume1/downloads/youtubedl/subscriptions`
- `/volume1/downloads/youtubedl/video`
- `/volume1/downloads/youtubedl/audio`

Test the fork on a different host port with copies of the state directories if
there is enough storage. Never run old and new containers simultaneously against
the same writable database and media mounts.
