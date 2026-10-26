const assert = require('assert');

const db_api = require('../db');
const tasks_api = require('../tasks');

describe('Task input safety', function() {
    let originalUpdateRecord;

    beforeEach(function() {
        originalUpdateRecord = db_api.updateRecord;
    });

    afterEach(function() {
        db_api.updateRecord = originalUpdateRecord;
        delete Object.prototype.job;
    });

    it('accepts only own task registry keys', function() {
        assert.strictEqual(tasks_api.isKnownTaskKey('backup_local_db'), true);
        assert.strictEqual(tasks_api.isKnownTaskKey('__proto__'), false);
        assert.strictEqual(tasks_api.isKnownTaskKey('constructor'), false);
        assert.strictEqual(tasks_api.isKnownTaskKey('missing_task'), false);
    });

    it('rejects a prototype key before database or registry mutation', async function() {
        let updateCalled = false;
        db_api.updateRecord = async () => {
            updateCalled = true;
            return true;
        };

        assert.strictEqual(await tasks_api.updateTaskSchedule('__proto__', null), false);
        assert.strictEqual(updateCalled, false);
        assert.strictEqual(Object.prototype.job, undefined);
    });
});
