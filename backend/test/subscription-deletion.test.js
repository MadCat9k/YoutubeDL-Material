const assert = require('assert');

const fs = require('fs-extra');
const config_api = require('../config');
const db_api = require('../db');
const logger = require('../logger');
const subscriptions_api = require('../subscriptions');

describe('Subscription deletion', function() {
    const original = {};
    let removals;
    let operationOrder;

    beforeEach(function() {
        original.getSubscription = subscriptions_api.getSubscription;
        original.getConfigItem = config_api.getConfigItem;
        original.getRecords = db_api.getRecords;
        original.removeRecord = db_api.removeRecord;
        original.removeAllRecords = db_api.removeAllRecords;
        original.pathExists = fs.pathExists;
        original.remove = fs.remove;
        original.loggerError = logger.error;

        removals = [];
        operationOrder = [];
        subscriptions_api.getSubscription = async () => ({
            id: 'synthetic-subscription-id',
            name: 'Synthetic Channel',
            isPlaylist: false,
            user_uid: null
        });
        config_api.getConfigItem = key => key === 'ytdl_subscriptions_base_path'
            ? '/synthetic/subscriptions'
            : null;
        db_api.getRecords = async () => [];
        db_api.removeRecord = async (table, filter) => {
            operationOrder.push(table);
            removals.push({method: 'removeRecord', table, filter});
            return true;
        };
        db_api.removeAllRecords = async (table, filter) => {
            operationOrder.push(table);
            removals.push({method: 'removeAllRecords', table, filter});
            return true;
        };
        fs.pathExists = async () => true;
        logger.error = () => undefined;
    });

    afterEach(function() {
        subscriptions_api.getSubscription = original.getSubscription;
        config_api.getConfigItem = original.getConfigItem;
        db_api.getRecords = original.getRecords;
        db_api.removeRecord = original.removeRecord;
        db_api.removeAllRecords = original.removeAllRecords;
        fs.pathExists = original.pathExists;
        fs.remove = original.remove;
        logger.error = original.loggerError;
    });

    it('waits for media removal before deleting database records', async function() {
        fs.remove = async () => { operationOrder.push('media'); };

        const result = await subscriptions_api.unsubscribe('synthetic-subscription-id', true);

        assert.deepStrictEqual(result, {success: true});
        assert.deepStrictEqual(operationOrder, ['media', 'subscriptions', 'files', 'archives']);
        assert.deepStrictEqual(removals, [
            {method: 'removeRecord', table: 'subscriptions', filter: {id: 'synthetic-subscription-id'}},
            {method: 'removeAllRecords', table: 'files', filter: {sub_id: 'synthetic-subscription-id'}},
            {method: 'removeAllRecords', table: 'archives', filter: {sub_id: 'synthetic-subscription-id'}}
        ]);
    });

    it('retains database records when media removal fails', async function() {
        fs.remove = async () => { throw new Error('synthetic filesystem failure'); };

        const result = await subscriptions_api.unsubscribe('synthetic-subscription-id', true);

        assert.strictEqual(result.success, false);
        assert.strictEqual(result.error, 'Failed to remove subscription.');
        assert.deepStrictEqual(removals, []);
    });

    it('removes database records without deleting media when files are retained', async function() {
        let mediaRemoveCalled = false;
        fs.remove = async () => { mediaRemoveCalled = true; };

        const result = await subscriptions_api.unsubscribe('synthetic-subscription-id', false);

        assert.deepStrictEqual(result, {success: true});
        assert.strictEqual(mediaRemoveCalled, false);
        assert.strictEqual(removals.length, 3);
    });

    it('cleans up a legacy nameless record without attempting a media path', async function() {
        subscriptions_api.getSubscription = async () => ({
            id: 'synthetic-subscription-id',
            name: null,
            user_uid: null
        });
        let mediaRemoveCalled = false;
        fs.remove = async () => { mediaRemoveCalled = true; };

        const result = await subscriptions_api.unsubscribe('synthetic-subscription-id', true);

        assert.deepStrictEqual(result, {success: true});
        assert.strictEqual(mediaRemoveCalled, false);
        assert.strictEqual(removals.length, 3);
    });
});
