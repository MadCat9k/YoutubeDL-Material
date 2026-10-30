const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const youtubedl_api = require('../youtube-dl');

describe('youtube-dl updater', function() {
    let test_directory;

    beforeEach(async function() {
        test_directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdlm-updater-'));
    });

    afterEach(async function() {
        await fs.remove(test_directory);
    });

    it('selects standalone yt-dlp binaries for supported Linux architectures', function() {
        assert.strictEqual(
            youtubedl_api.getYoutubeDLDownloadURL('yt-dlp', 'linux', 'x64'),
            'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux'
        );
        assert.strictEqual(
            youtubedl_api.getYoutubeDLDownloadURL('yt-dlp', 'linux', 'arm64'),
            'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux_aarch64'
        );
    });

    it('rejects unsupported Linux architectures instead of installing an incompatible binary', function() {
        assert.throws(
            () => youtubedl_api.getYoutubeDLDownloadURL('yt-dlp', 'linux', 'arm'),
            /Unsupported Linux architecture/
        );
    });

    it('validates an executable before it is used', async function() {
        const valid_binary = path.join(test_directory, 'valid-downloader');
        const invalid_binary = path.join(test_directory, 'invalid-downloader');
        await fs.writeFile(valid_binary, '#!/bin/sh\nprintf "synthetic-version\\n"\n');
        await fs.writeFile(invalid_binary, '#!/bin/sh\nexit 1\n');
        await fs.chmod(valid_binary, 0o755);
        await fs.chmod(invalid_binary, 0o755);

        assert.strictEqual(await youtubedl_api.validateYoutubeDLBinary(valid_binary), true);
        assert.strictEqual(await youtubedl_api.validateYoutubeDLBinary(invalid_binary), false);
    });
});
