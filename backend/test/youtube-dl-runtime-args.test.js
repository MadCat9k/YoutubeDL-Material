const assert = require('assert');

const { addRuntimeArgs } = require('../runtime-args');

describe('youtube-dl runtime arguments', function() {
    const original_target = process.env.YTDLP_IMPERSONATE;

    afterEach(function() {
        if (original_target === undefined) {
            delete process.env.YTDLP_IMPERSONATE;
        } else {
            process.env.YTDLP_IMPERSONATE = original_target;
        }
    });

    it('adds the configured impersonation target to yt-dlp', function() {
        process.env.YTDLP_IMPERSONATE = 'chrome';

        assert.deepStrictEqual(
            addRuntimeArgs(['--dump-json'], 'yt-dlp'),
            ['--impersonate', 'chrome', '--dump-json']
        );
    });

    it('preserves an explicit impersonation target', function() {
        process.env.YTDLP_IMPERSONATE = 'chrome';

        assert.deepStrictEqual(
            addRuntimeArgs(['--impersonate=safari', '--dump-json'], 'yt-dlp'),
            ['--impersonate=safari', '--dump-json']
        );
    });

    it('does not modify other downloader forks', function() {
        process.env.YTDLP_IMPERSONATE = 'chrome';

        assert.deepStrictEqual(
            addRuntimeArgs(['--dump-json'], 'youtube-dl'),
            ['--dump-json']
        );
    });
});
