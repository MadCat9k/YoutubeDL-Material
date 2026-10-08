#!/bin/sh

set -eu

# THANK YOU TALULAH (https://github.com/nottalulah) for your help in figuring this out
# and also optimizing some code with this commit.
# xoxo :D

case $(uname -m) in
  x86_64)
    ARCH=Linux-x64
    SHA256=f2bcee00d0e6da759d97c23767345634cb9cdb10cdff96cfa96f97983d51bf55;;
  aarch64)
    ARCH=LinuxArm64
    SHA256=2fde836f07c3ebfcf61cace23742a2c43543fc30fda96071eb96ab8e10c24f7f;;
  armhf)
    ARCH=LinuxArm
    SHA256=ca66f85248f45f6f2870d6ca27bbd841e911d3f80a88fc3e76b33575169121cc;;
  armv7)
    ARCH=LinuxArm
    SHA256=ca66f85248f45f6f2870d6ca27bbd841e911d3f80a88fc3e76b33575169121cc;;
  armv7l)
    ARCH=LinuxArm
    SHA256=ca66f85248f45f6f2870d6ca27bbd841e911d3f80a88fc3e76b33575169121cc;;
  *)
    echo "Unsupported architecture: $(uname -m)"
    exit 1
esac

echo "(INFO) Architecture detected: $ARCH"
echo "(1/5) READY - Install unzip"
apt-get update && apt-get -y install unzip curl libicu70
VERSION=1.56.5
echo "(2/5) DOWNLOAD - Acquire twitchdownloader"
curl --fail --location --output twitchdownloader.zip \
    --connect-timeout 10 \
    --max-time 300 \
    --retry 5 \
    --retry-all-errors \
    --retry-delay 2 \
    --retry-max-time 600 \
    "https://github.com/lay295/TwitchDownloader/releases/download/$VERSION/TwitchDownloaderCLI-$VERSION-$ARCH.zip"
printf '%s  %s\n' "$SHA256" twitchdownloader.zip | sha256sum --check --strict -
unzip -tq twitchdownloader.zip
unzip twitchdownloader.zip
chmod +x TwitchDownloaderCLI
echo "(3/5) Smoke test"
VERSION_OUTPUT=$(./TwitchDownloaderCLI version 2>&1 || true)
printf '%s\n' "$VERSION_OUTPUT"
printf '%s\n' "$VERSION_OUTPUT" | grep -q '^TwitchDownloaderCLI '
cp ./TwitchDownloaderCLI /usr/local/bin/TwitchDownloaderCLI
