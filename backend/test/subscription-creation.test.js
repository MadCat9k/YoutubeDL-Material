const assert = require('assert');

const db_api = require('../db');
const logger = require('../logger');
const subscriptions_api = require('../subscriptions');
const youtubedl_api = require('../youtube-dl');

describe('Subscription creation', function() {
    const original_db = {};
    let records;
    let metadata_writes;

    beforeEach(function() {
        records = [];
        metadata_writes = [];

        for (const method of ['getRecord', 'insertRecordIntoTable', 'updateRecord', 'removeRecord']) {
            original_db[method] = db_api[method];
        }
        original_db.runYoutubeDL = youtubedl_api.runYoutubeDL;
        original_db.writeSubscriptionMetadata = subscriptions_api.writeSubscriptionMetadata;
        original_db.loggerError = logger.error;

        db_api.getRecord = async (table, filter) => records.find(record =>
            table === 'subscriptions' && Object.entries(filter).every(([key, value]) =>
                value === null ? record[key] === null || record[key] === undefined : record[key] === value
            )
        ) || null;
        db_api.insertRecordIntoTable = async (table, record) => {
            assert.strictEqual(table, 'subscriptions');
            records.push({...record});
            return true;
        };
        db_api.updateRecord = async (table, filter, update) => {
            const record = records.find(item => table === 'subscriptions' && item.id === filter.id);
            if (record) Object.assign(record, update);
            return true;
        };
        db_api.removeRecord = async (table, filter) => {
            records = records.filter(record => table !== 'subscriptions' || record.id !== filter.id);
            return true;
        };
        subscriptions_api.writeSubscriptionMetadata = sub => metadata_writes.push(sub.name);
        logger.error = () => undefined;
    });

    afterEach(function() {
        for (const method of ['getRecord', 'insertRecordIntoTable', 'updateRecord', 'removeRecord']) {
            db_api[method] = original_db[method];
        }
        youtubedl_api.runYoutubeDL = original_db.runYoutubeDL;
        subscriptions_api.writeSubscriptionMetadata = original_db.writeSubscriptionMetadata;
        logger.error = original_db.loggerError;
    });

    function subscription(overrides = {}) {
        return {
            id: 'synthetic-subscription-id',
            url: 'https://example.invalid/channel/synthetic',
            name: null,
            type: 'video',
            paused: true,
            ...overrides
        };
    }

    function downloaderOutput(output) {
        youtubedl_api.runYoutubeDL = async () => ({
            callback: Promise.resolve({parsed_output: [output], err: null})
        });
    }

    it('uses a channel fallback when uploader metadata is missing', async function() {
        downloaderOutput({uploader: null, channel: 'Synthetic Channel'});

        const result = await subscriptions_api.subscribe(subscription());

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.sub.name, 'Synthetic Channel');
        assert.strictEqual(records.length, 1);
        assert.strictEqual(records[0].name, 'Synthetic Channel');
        assert.deepStrictEqual(metadata_writes, ['Synthetic Channel']);
    });

    it('accepts valid metadata when the downloader also emits a warning', async function() {
        youtubedl_api.runYoutubeDL = async () => ({
            callback: Promise.resolve({
                parsed_output: [{uploader: 'Synthetic Channel'}],
                err: 'synthetic deprecation warning'
            })
        });

        const result = await subscriptions_api.subscribe(subscription());

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.sub.name, 'Synthetic Channel');
        assert.strictEqual(records.length, 1);
    });

    it('rolls back the database record when no valid name can be determined', async function() {
        downloaderOutput({uploader: null, channel: null, creator: null});

        const result = await subscriptions_api.subscribe(subscription());

        assert.strictEqual(result.success, false);
        assert.match(result.error, /custom name/i);
        assert.strictEqual(records.length, 0);
        assert.deepStrictEqual(metadata_writes, []);
    });

    it('rolls back the database record when metadata cannot be written', async function() {
        downloaderOutput({channel: 'Synthetic Channel'});
        subscriptions_api.writeSubscriptionMetadata = () => {
            throw new Error('synthetic write failure');
        };

        const result = await subscriptions_api.subscribe(subscription());

        assert.strictEqual(result.success, false);
        assert.strictEqual(records.length, 0);
    });

    it('skips metadata for a legacy nameless record', function() {
        const result = original_db.writeSubscriptionMetadata({name: null, isPlaylist: false});

        assert.strictEqual(result, false);
    });

    it('removes a stale nameless attempt before retrying', async function() {
        records.push(subscription({id: 'stale-subscription-id'}));
        downloaderOutput({channel: 'Recovered Channel'});

        const result = await subscriptions_api.subscribe(subscription());

        assert.strictEqual(result.success, true);
        assert.strictEqual(records.length, 1);
        assert.strictEqual(records[0].id, 'synthetic-subscription-id');
        assert.strictEqual(records[0].name, 'Recovered Channel');
    });

    it('rejects names that could escape the subscription directory', async function() {
        const result = await subscriptions_api.subscribe(subscription({name: '../outside'}), null, true);

        assert.strictEqual(result.success, false);
        assert.strictEqual(records.length, 0);
        assert.deepStrictEqual(metadata_writes, []);
    });

    it('does not include a duplicate subscription URL in logs or errors', async function() {
        const private_url = 'https://example.invalid/channel/private-token';
        records.push(subscription({name: 'Existing Channel', url: private_url}));
        let logged_message = '';
        logger.error = message => { logged_message = message; };

        const result = await subscriptions_api.subscribe(subscription({url: private_url}));

        assert.strictEqual(result.success, false);
        assert.strictEqual(logged_message.includes(private_url), false);
        assert.strictEqual(result.error.includes(private_url), false);
    });

    it('does not log downloader output that may contain a private URL', async function() {
        const private_url = 'https://example.invalid/channel/private-token';
        let logged_messages = [];
        logger.error = message => logged_messages.push(message);
        youtubedl_api.runYoutubeDL = async () => ({
            callback: Promise.resolve({
                parsed_output: [],
                err: {stderr: `failed to download ${private_url}`}
            })
        });

        const result = await subscriptions_api.subscribe(subscription({url: private_url}));

        assert.strictEqual(result.success, false);
        assert.strictEqual(records.length, 0);
        assert.strictEqual(logged_messages.some(message => message.includes(private_url)), false);
    });
});
