#!/bin/sh

set -eu

# THANK YOU TALULAH (https://github.com/nottalulah) for your help in figuring this out
# and also optimizing some code with this commit.
# xoxo :D

case $(uname -m) in
  x86_64)
    ARCH=Linux-x64;;
  aarch64)
    ARCH=LinuxArm64;;
  armhf)
    ARCH=LinuxArm;;
  armv7)
    ARCH=LinuxArm;;
  armv7l)
    ARCH=LinuxArm;;
  *)
    echo "Unsupported architecture: $(uname -m)"
    exit 1
esac

echo "(INFO) Architecture detected: $ARCH"
echo "(1/5) READY - Install unzip"
apt-get update && apt-get -y install unzip curl jq libicu70
VERSION=$(curl --fail --silent --show-error --location \
    --connect-timeout 10 \
    --max-time 120 \
    --retry 5 \
    --retry-all-errors \
    --retry-delay 2 \
    "https://api.github.com/repos/lay295/TwitchDownloader/releases" | jq -r --arg arch "$ARCH" '[.[] | select(.assets | length > 0) | select(.assets[].name | contains("CLI") and contains($arch))] | max_by(.published_at) | .tag_name')
if [ -z "$VERSION" ] || [ "$VERSION" = "null" ]; then
    echo "No TwitchDownloader release found for architecture: $ARCH" >&2
    exit 1
fi
echo "(2/5) DOWNLOAD - Acquire twitchdownloader"
curl --fail --location --output twitchdownloader.zip \
    --connect-timeout 10 \
    --max-time 300 \
    --retry 5 \
    --retry-all-errors \
    --retry-delay 2 \
    --retry-max-time 600 \
    "https://github.com/lay295/TwitchDownloader/releases/download/$VERSION/TwitchDownloaderCLI-$VERSION-$ARCH.zip"
unzip -tq twitchdownloader.zip
unzip twitchdownloader.zip
chmod +x TwitchDownloaderCLI
echo "(3/5) Smoke test"
VERSION_OUTPUT=$(./TwitchDownloaderCLI version 2>&1 || true)
printf '%s\n' "$VERSION_OUTPUT"
printf '%s\n' "$VERSION_OUTPUT" | grep -q '^TwitchDownloaderCLI '
cp ./TwitchDownloaderCLI /usr/local/bin/TwitchDownloaderCLI
