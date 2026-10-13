const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const thumbnails_api = require('../thumbnails');

describe('Local thumbnail preparation', function() {
    let test_dir;
    let media_path;

    beforeEach(function() {
        test_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-local-thumbnail-'));
        media_path = path.join(test_dir, 'Synthetic video.mp4');
        fs.ensureFileSync(media_path);
    });

    afterEach(function() {
        fs.removeSync(test_dir);
    });

    it('uses an existing local thumbnail before remote or generated fallbacks', async function() {
        const thumbnail_path = path.join(test_dir, 'Synthetic video.webp');
        fs.ensureFileSync(thumbnail_path);

        const result = await thumbnails_api.ensureLocalThumbnail({path: media_path}, [test_dir], {
            fetchRemoteThumbnail: async () => assert.fail('remote thumbnail should not be fetched'),
            generateVideoThumbnail: async () => assert.fail('video thumbnail should not be generated')
        });

        assert.strictEqual(result, fs.realpathSync(thumbnail_path));
    });

    it('uses a valid stored thumbnail path even when its name differs from the media', async function() {
        const thumbnail_path = path.join(test_dir, 'stored-preview.png');
        fs.ensureFileSync(thumbnail_path);

        const result = await thumbnails_api.ensureLocalThumbnail({
            path: media_path,
            thumbnailPath: thumbnail_path
        }, [test_dir], {
            fetchRemoteThumbnail: async () => assert.fail('remote thumbnail should not be fetched'),
            generateVideoThumbnail: async () => assert.fail('video thumbnail should not be generated')
        });

        assert.strictEqual(result, fs.realpathSync(thumbnail_path));
    });

    it('stores a remote thumbnail locally before trying FFmpeg', async function() {
        const real_test_dir = fs.realpathSync(test_dir);
        const thumbnail_path = path.join(real_test_dir, 'Synthetic video.jpg');
        const result = await thumbnails_api.ensureLocalThumbnail({
            path: media_path,
            thumbnailURL: 'https://example.com/thumbnail',
            duration: 120,
            isAudio: false
        }, [test_dir], {
            fetchRemoteThumbnail: async (url, target_stem) => {
                assert.strictEqual(url, 'https://example.com/thumbnail');
                assert.strictEqual(target_stem, path.join(real_test_dir, 'Synthetic video'));
                fs.ensureFileSync(thumbnail_path);
                return thumbnail_path;
            },
            generateVideoThumbnail: async () => assert.fail('video thumbnail should not be generated')
        });

        assert.strictEqual(result, thumbnail_path);
    });

    it('generates a preview when the remote thumbnail is unavailable', async function() {
        const real_test_dir = fs.realpathSync(test_dir);
        const real_media_path = fs.realpathSync(media_path);
        const thumbnail_path = path.join(real_test_dir, 'Synthetic video.jpg');
        let received_timestamp = null;
        const result = await thumbnails_api.ensureLocalThumbnail({
            path: media_path,
            thumbnailURL: 'https://example.com/missing',
            duration: 120,
            isAudio: false
        }, [test_dir], {
            fetchRemoteThumbnail: async () => { throw new Error('unavailable'); },
            generateVideoThumbnail: async (input_path, output_path, timestamp) => {
                assert.strictEqual(input_path, real_media_path);
                assert.strictEqual(output_path, thumbnail_path);
                received_timestamp = timestamp;
                fs.ensureFileSync(output_path);
                return output_path;
            }
        });

        assert.strictEqual(result, thumbnail_path);
        assert.strictEqual(received_timestamp, 12);
    });

    it('chooses a bounded preview time for short and long videos', function() {
        assert.strictEqual(thumbnails_api.choosePreviewTimestamp(5), 1);
        assert.strictEqual(thumbnails_api.choosePreviewTimestamp(120), 12);
        assert.strictEqual(thumbnails_api.choosePreviewTimestamp(600), 30);
    });

    it('rejects local and private network thumbnail addresses', function() {
        assert.strictEqual(thumbnails_api.isPrivateAddress('127.0.0.1'), true);
        assert.strictEqual(thumbnails_api.isPrivateAddress('192.168.1.10'), true);
        assert.strictEqual(thumbnails_api.isPrivateAddress('::1'), true);
        assert.strictEqual(thumbnails_api.isPrivateAddress('::ffff:7f00:1'), true);
        assert.strictEqual(thumbnails_api.isPrivateAddress('8.8.8.8'), false);
    });
});
