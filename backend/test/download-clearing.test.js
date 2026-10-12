const assert = require('assert');

const db_api = require('../db');
const downloader_api = require('../downloader');

describe('Download clearing', function() {
    let original_remove_all_records;
    let removals;

    beforeEach(function() {
        original_remove_all_records = db_api.removeAllRecords;
        removals = [];
        db_api.removeAllRecords = async (table, filter) => {
            removals.push({table, filter});
            return true;
        };
    });

    afterEach(function() {
        db_api.removeAllRecords = original_remove_all_records;
    });

    it('clears only successful completed downloads for the current user', async function() {
        const success = await downloader_api.clearDownloads({clear_completed: true}, 'synthetic-user');

        assert.strictEqual(success, true);
        assert.deepStrictEqual(removals, [{
            table: 'download_queue',
            filter: {finished: true, error: null, user_uid: 'synthetic-user'}
        }]);
    });

    it('retains the existing detailed clear filters', async function() {
        const success = await downloader_api.clearDownloads({
            clear_finished: true,
            clear_paused: true,
            clear_errors: true
        });

        assert.strictEqual(success, true);
        assert.deepStrictEqual(removals, [
            {table: 'download_queue', filter: {finished: true, user_uid: null}},
            {table: 'download_queue', filter: {paused: true, user_uid: null}},
            {table: 'download_queue', filter: {error: {$ne: null}, user_uid: null}}
        ]);
    });
});
