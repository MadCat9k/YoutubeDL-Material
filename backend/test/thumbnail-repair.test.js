const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const db_api = require('../db');
const files_api = require('../files');
const utils = require('../utils');

describe('Thumbnail repair', function() {
    let test_dir;

    beforeEach(function() {
        test_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-thumbnail-'));
    });

    afterEach(function() {
        fs.removeSync(test_dir);
    });

    for (const extension of ['jpg', 'webp', 'png']) {
        it(`finds a ${extension} thumbnail beside media with spaces and Unicode`, function() {
            const media_path = path.join(test_dir, 'Tést Channel – sample.mp4');
            const thumbnail_path = path.join(test_dir, `Tést Channel – sample.${extension}`);
            fs.ensureFileSync(media_path);
            fs.ensureFileSync(thumbnail_path);

            assert.strictEqual(utils.getDownloadedThumbnail(media_path), thumbnail_path);
        });
    }

    it('replaces a stale database path with the discovered sidecar path', async function() {
        const media_path = path.join(test_dir, 'Generic channel sample.mp4');
        const thumbnail_path = path.join(test_dir, 'Generic channel sample.webp');
        fs.ensureFileSync(media_path);
        fs.ensureFileSync(thumbnail_path);

        const files = [{
            uid: 'thumbnail-repair-file',
            path: media_path,
            thumbnailPath: path.join(test_dir, 'missing.jpg')
        }];
        const original_bulk_update = db_api.bulkUpdateRecordsByKey;
        let received_update = null;
        db_api.bulkUpdateRecordsByKey = async (table, key, update) => {
            received_update = {table, key, update};
            return true;
        };

        try {
            await files_api.repairThumbnailPaths(files);
        } finally {
            db_api.bulkUpdateRecordsByKey = original_bulk_update;
        }

        assert.strictEqual(files[0].thumbnailPath, thumbnail_path);
        assert.deepStrictEqual(received_update, {
            table: 'files',
            key: 'uid',
            update: {
                'thumbnail-repair-file': {thumbnailPath: thumbnail_path}
            }
        });
    });
});
