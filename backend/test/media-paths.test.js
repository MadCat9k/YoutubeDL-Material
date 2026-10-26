const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const media_paths = require('../media-paths');
const twitch_api = require('../twitch');

describe('Media path containment', function() {
    let test_dir;
    let media_root;

    beforeEach(function() {
        test_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-media-paths-'));
        media_root = path.join(test_dir, 'video');
        fs.ensureDirSync(media_root);
    });

    afterEach(function() {
        fs.removeSync(test_dir);
    });

    it('accepts an existing file inside a configured media root', function() {
        const thumbnail_path = path.join(media_root, 'sample.webp');
        fs.ensureFileSync(thumbnail_path);

        assert.strictEqual(
            media_paths.resolveExistingMediaFile(thumbnail_path, [media_root]),
            fs.realpathSync(thumbnail_path)
        );
    });

    it('rejects traversal, absolute outside paths, and symlink escapes', function() {
        const outside_path = path.join(test_dir, 'outside.webp');
        fs.ensureFileSync(outside_path);
        const symlink_path = path.join(media_root, 'linked.webp');
        fs.symlinkSync(outside_path, symlink_path);

        assert.strictEqual(media_paths.resolveExistingMediaFile('../outside.webp', [media_root], media_root), null);
        assert.strictEqual(media_paths.resolveExistingMediaFile(outside_path, [media_root]), null);
        assert.strictEqual(media_paths.resolveExistingMediaFile(symlink_path, [media_root]), null);
    });

    it('accepts a new output only when its real parent is beneath a media root', function() {
        const output_path = path.join(media_root, 'sample.twitch_chat.json');
        const outside_path = path.join(test_dir, 'outside.twitch_chat.json');
        const expected_output_path = path.join(fs.realpathSync(media_root), 'sample.twitch_chat.json');

        assert.strictEqual(media_paths.resolveMediaOutputFile(output_path, [media_root]), expected_output_path);
        assert.strictEqual(media_paths.resolveMediaOutputFile(outside_path, [media_root]), null);
    });

    it('rejects request-shaped Twitch path segments before creating an output path', function() {
        const expected_output_path = path.join(fs.realpathSync(media_root), 'sample.twitch_chat.json');
        assert.strictEqual(twitch_api.resolveTwitchChatPath('sample', 'video', null, null, media_root), expected_output_path);
        assert.strictEqual(twitch_api.resolveTwitchChatPath('sample', null, null, null, media_root), expected_output_path);
        assert.strictEqual(twitch_api.resolveTwitchChatPath('../outside', 'video', null, null, media_root), null);
        assert.strictEqual(twitch_api.resolveTwitchChatPath('sample', '../video', null, null), null);
        assert.strictEqual(twitch_api.resolveTwitchChatPath('sample', 'video', null, {name: '../outside', isPlaylist: false}, media_root), null);
    });
});
