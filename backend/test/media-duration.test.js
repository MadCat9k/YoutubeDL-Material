const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const db_api = require('../db');
const files_api = require('../files');
const logger = require('../logger');

describe('Media duration verification', function() {
    let test_dir;
    let media_path;

    beforeEach(function() {
        test_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-duration-'));
        media_path = path.join(test_dir, 'Synthetic video.mp4');
        fs.ensureFileSync(media_path);
    });

    afterEach(function() {
        fs.removeSync(test_dir);
    });

    it('uses the finished media duration and records a material mismatch', async function() {
        const file = {path: media_path, duration: 120};

        const result = await files_api.applyMediaDuration(file, [test_dir], async received_path => {
            assert.strictEqual(received_path, fs.realpathSync(media_path));
            return 60;
        });

        assert.deepStrictEqual(result, {verified: true, mismatched: true});
        assert.strictEqual(file.duration, 60);
        assert.strictEqual(file.duration_verified, true);
        assert.strictEqual(file.duration_mismatch, true);
    });

    it('accepts a small container and extractor duration difference', async function() {
        const file = {path: media_path, duration: 120};

        const result = await files_api.applyMediaDuration(file, [test_dir], async () => 119);

        assert.deepStrictEqual(result, {verified: true, mismatched: false});
        assert.strictEqual(file.duration, 119);
        assert.strictEqual(file.duration_mismatch, false);
    });

    it('does not probe a database path outside configured media roots', async function() {
        const outside_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-duration-outside-'));
        const outside_path = path.join(outside_dir, 'Outside.mp4');
        fs.ensureFileSync(outside_path);
        let probe_called = false;

        try {
            const result = await files_api.applyMediaDuration(
                {path: outside_path, duration: 120},
                [test_dir],
                async () => {
                    probe_called = true;
                    return 60;
                }
            );

            assert.deepStrictEqual(result, {verified: false, mismatched: false});
            assert.strictEqual(probe_called, false);
        } finally {
            fs.removeSync(outside_dir);
        }
    });

    it('repairs records in bulk without logging media paths', async function() {
        const files = [{uid: 'synthetic-file', path: media_path, duration: 120}];
        const original_bulk_update = db_api.bulkUpdateRecordsByKey;
        const original_log_warn = logger.warn;
        let received_update = null;
        let received_log = null;
        db_api.bulkUpdateRecordsByKey = async (table, key, update) => {
            received_update = {table, key, update};
            return true;
        };
        logger.warn = message => {
            received_log = message;
        };

        try {
            const summary = await files_api.repairMediaDurations(files, [test_dir], async () => 60);

            assert.deepStrictEqual(summary, {checked: 1, updated: 1, mismatched: 1, failed: 0, playlists_updated: 0});
            assert.deepStrictEqual(received_update, {
                table: 'files',
                key: 'uid',
                update: {
                    'synthetic-file': {
                        duration: 60,
                        duration_verified: true,
                        duration_mismatch: true
                    }
                }
            });
            assert.strictEqual(received_log.includes('synthetic-file'), true);
            assert.strictEqual(received_log.includes(test_dir), false);

            received_update = null;
            const second_summary = await files_api.repairMediaDurations(files, [test_dir], async () => 60);
            assert.deepStrictEqual(second_summary, {checked: 1, updated: 0, mismatched: 1, failed: 0, playlists_updated: 0});
            assert.strictEqual(received_update, null);
        } finally {
            db_api.bulkUpdateRecordsByKey = original_bulk_update;
            logger.warn = original_log_warn;
        }
    });

    it('leaves an unverified record unchanged and logs only its UID', async function() {
        const outside_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdl-duration-unverified-'));
        const outside_path = path.join(outside_dir, 'Private title.mp4');
        fs.ensureFileSync(outside_path);
        const original_bulk_update = db_api.bulkUpdateRecordsByKey;
        const original_log_warn = logger.warn;
        let update_called = false;
        let received_log = null;
        db_api.bulkUpdateRecordsByKey = async () => {
            update_called = true;
        };
        logger.warn = message => {
            received_log = message;
        };

        try {
            const summary = await files_api.repairMediaDurations(
                [{uid: 'unverified-file', path: outside_path, duration: 120}],
                [test_dir],
                async () => assert.fail('outside-root media should not be probed')
            );

            assert.deepStrictEqual(summary, {checked: 1, updated: 0, mismatched: 0, failed: 1, playlists_updated: 0});
            assert.strictEqual(update_called, false);
            assert.strictEqual(received_log.includes('unverified-file'), true);
            assert.strictEqual(received_log.includes(outside_dir), false);
            assert.strictEqual(received_log.includes('Private title'), false);
        } finally {
            db_api.bulkUpdateRecordsByKey = original_bulk_update;
            logger.warn = original_log_warn;
            fs.removeSync(outside_dir);
        }
    });

    it('refreshes only playlists containing a repaired file', async function() {
        const original_get_records = db_api.getRecords;
        const original_get_video = files_api.getVideo;
        const original_update_record = db_api.updateRecord;
        const updates = [];
        db_api.getRecords = async table => {
            assert.strictEqual(table, 'playlists');
            return [
                {id: 'affected-playlist', uids: ['synthetic-file']},
                {id: 'other-playlist', uids: ['other-file']}
            ];
        };
        files_api.getVideo = async uid => ({uid, duration: uid === 'synthetic-file' ? 60 : 30});
        db_api.updateRecord = async (table, filter, update) => {
            updates.push({table, filter, update});
            return true;
        };

        try {
            const updated_count = await files_api.repairPlaylistDurations(['synthetic-file']);

            assert.strictEqual(updated_count, 1);
            assert.deepStrictEqual(updates, [{
                table: 'playlists',
                filter: {id: 'affected-playlist'},
                update: {duration: 60}
            }]);
        } finally {
            db_api.getRecords = original_get_records;
            files_api.getVideo = original_get_video;
            db_api.updateRecord = original_update_record;
        }
    });
});
