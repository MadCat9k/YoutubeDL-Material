const assert = require('assert');

const db_api = require('../db');
const logger = require('../logger');
const subscriptions_api = require('../subscriptions');

describe('Subscription update', function() {
    const original = {};
    const subscription = {
        id: 'synthetic-subscription-id',
        name: 'Synthetic Channel',
        isPlaylist: false,
        user_uid: null
    };

    beforeEach(function() {
        original.updateRecord = db_api.updateRecord;
        original.writeSubscriptionMetadata = subscriptions_api.writeSubscriptionMetadata;
        original.loggerError = logger.error;
        logger.error = () => undefined;
    });

    afterEach(function() {
        db_api.updateRecord = original.updateRecord;
        subscriptions_api.writeSubscriptionMetadata = original.writeSubscriptionMetadata;
        logger.error = original.loggerError;
    });

    it('waits for persistence before reporting success', async function() {
        let finishUpdate;
        let metadataWritten = false;
        db_api.updateRecord = () => new Promise(resolve => { finishUpdate = resolve; });
        subscriptions_api.writeSubscriptionMetadata = () => {
            metadataWritten = true;
            return true;
        };

        let settled = false;
        const resultPromise = subscriptions_api.updateSubscription(subscription).then(result => {
            settled = true;
            return result;
        });
        await Promise.resolve();

        assert.strictEqual(settled, false);
        assert.strictEqual(metadataWritten, false);
        finishUpdate(true);
        assert.strictEqual(await resultPromise, true);
        assert.strictEqual(metadataWritten, true);
    });

    it('reports a database failure without exposing its details', async function() {
        let loggedMessage = '';
        db_api.updateRecord = async () => { throw new Error('synthetic private detail'); };
        subscriptions_api.writeSubscriptionMetadata = () => true;
        logger.error = message => { loggedMessage = message; };

        const result = await subscriptions_api.updateSubscription(subscription);

        assert.strictEqual(result, false);
        assert.strictEqual(loggedMessage, 'Failed to update subscription.');
        assert.ok(!loggedMessage.includes('synthetic private detail'));
    });

    it('reports metadata failure', async function() {
        db_api.updateRecord = async () => true;
        subscriptions_api.writeSubscriptionMetadata = () => false;

        const result = await subscriptions_api.updateSubscription(subscription);

        assert.strictEqual(result, false);
    });
});
