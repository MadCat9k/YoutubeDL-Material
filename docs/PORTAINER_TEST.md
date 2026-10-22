# Portainer test runbook for Synology

This runbook validates the fork on a Synology NAS without attaching the test
container to the production database or writable media directories. The
low-space path preserves the small, irreplaceable configuration and database
files without copying the full media library.

## Safety rules

- Never attach the production and test containers to the same writable path.
- Stop the production container while copying `appdata` and `users` so the
  copies are internally consistent.
- Keep subscription checks disabled when the copied database is paired with an
  empty test media directory. Otherwise startup can scan every subscription and
  queue downloads.
- Do not delete the production container, its Compose definition, or its image
  until the test and production cutover have both passed.
- Do not run a missing-file cleanup task against the copied database when the
  test media directories are empty.

## 1. Record and protect the production setup

1. In Portainer, save a copy of the existing Stack or Compose definition.
2. Record the current image, port, environment variables, and bind mounts.
3. Stop the production container briefly.
4. Copy these small production directories:

   - `/volume1/docker/youtubedl/appdata` to
     `/volume1/docker/youtubedl-test/appdata`;
   - `/volume1/docker/youtubedl/users` to
     `/volume1/docker/youtubedl-test/users`.

5. Make a second, date-labelled backup of both production directories in a
   location that will not be mounted into either container. The copied
   `appdata/db.json` is especially important because it contains the local
   subscription records.
6. Confirm that the test copies are real directories, not symlinks or bind
   mounts back to production.
7. Restart the production container.

If the media share is stored on Btrfs and Snapshot Replication is available,
create a manual snapshot of the shared folder containing the media. A snapshot
avoids a full second copy initially, but changed or deleted blocks consume
additional space while the snapshot is retained.

## 2. Create empty test media directories

Create these directories without copying the production media library:

- `/volume1/downloads/youtubedl-test/subscriptions`
- `/volume1/downloads/youtubedl-test/video`
- `/volume1/downloads/youtubedl-test/audio`

The production media at `/volume1/downloads/youtubedl` remains untouched and
is not mounted by the test Stack.

## 3. Prepare the Portainer Stack

1. Open `docker-compose.synology.portainer.test.yml` from this repository and
   copy its contents.
2. In Portainer, select **Stacks**, add a Stack, and use the web editor.
3. Name it `youtubedl-test` and paste the Compose content.
4. Add the following entry beneath the service's `environment` section:

   ```yaml
   ytdl_allow_subscriptions: "false"
   ```

   This overrides the copied configuration and prevents automatic subscription
   scans during the low-space test.

5. Confirm the rendered Stack has all of these properties before deployment:

   - image `ghcr.io/madcat9k/youtubedl-material:sha-e603edc`;
   - container name `YouTube-Downloader-Test`;
   - host port `18084` mapped to container port `17442`;
   - UID `1026` and GID `101`, unless the NAS uses different owners;
   - only `youtubedl-test` host paths;
   - `ytdl_allow_subscriptions: "false"`;
   - no `start-with-ytdlp-fix.sh` command override.

6. Deploy the Stack. No registry credentials are required for this public
   image.

## 4. Validate startup

1. Allow up to two minutes for the initial startup.
2. In Portainer, confirm the container remains running and becomes healthy.
3. Review its logs for restart loops, permission failures, and database errors.
   Do not copy logs containing subscription URLs, cookies, or tokens into a
   public issue.
4. Open `http://NAS-IP:18084`, replacing `NAS-IP` with the NAS address.
5. Confirm the application loads, authentication works if enabled, and the
   expected settings are present.

Warnings or missing playback caused by the deliberately empty media directories
do not indicate media loss. The test container cannot write to the production
media tree.

## 5. Validate yt-dlp impersonation

Open a console for the test container in Portainer using `/bin/sh`, then run:

```sh
/app/appdata/bin/yt-dlp --list-impersonate-targets
```

Confirm that at least one Chrome target is listed. The logs should not show a
timed wrapper rewrite or an attempt to run `start-with-ytdlp-fix.sh`; the fork
injects the configured impersonation target when yt-dlp is invoked.

## 6. Validate isolation and persistence

1. Confirm new logs and configuration changes appear only beneath the two test
   roots:

   - `/volume1/docker/youtubedl-test`
   - `/volume1/downloads/youtubedl-test`

2. Confirm the production service remains available on its original port and
   its directory timestamps did not change because of the test container.
3. Change one harmless setting in the test application.
4. Restart `YouTube-Downloader-Test`.
5. Confirm it becomes healthy again and the setting persists.

## 7. Optional controlled subscription test

Enabling subscriptions with the copied production database can scan every real
subscription and queue many downloads. For a bounded test, use a separate
temporary Stack with fresh, empty `appdata`, `users`, and media directories.
Only proceed when contacting the chosen media service and downloading a test
item are explicitly intended.

1. Leave the copied-database Stack stopped or keep subscriptions disabled.
2. Deploy the temporary Stack on another unused host port and isolated paths.
3. Enable subscriptions in that temporary Stack.
4. Add one small test subscription and download one item.
5. Confirm scan completion, thumbnail display, playback, and persistence after
   a container restart.
6. Remove the temporary Stack and its disposable data after the check.

## Pass criteria

The isolated test passes when:

- the container becomes and remains healthy;
- startup has no permission or restart loop;
- the copied configuration and authentication data load;
- settings persist across a restart;
- yt-dlp reports a supported impersonation target;
- production directories remain unchanged; and
- any explicitly approved controlled download works after restart.

Do not perform the production cutover merely because image assembly succeeded.
After these checks pass, prepare a separate production Stack and rollback plan,
stop the old container, and attach only the new production container to the
original writable data and media directories.
