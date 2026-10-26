const assert = require('assert');

const db_api = require('../db');

describe('Database input safety', function() {
    it('accepts scalar filters and server-created operator conditions', function() {
        assert.doesNotThrow(() => db_api.validateFilter({uid: 'synthetic-file-id'}));
        assert.doesNotThrow(() => db_api.validateFilter({
            registered: db_api.filterCondition('$lt', 1234)
        }));
        assert.doesNotThrow(() => db_api.validateFilter({
            title: db_api.filterCondition('$regex', 'synthetic', 'i')
        }));
    });

    it('rejects request-shaped object and operator filters', function() {
        const unsafeFilters = [
            {uid: {}},
            {uid: {$ne: null}},
            {uid: {$regex: '.*'}},
            {$where: 'synthetic'},
            {$text: 'synthetic'}
        ];

        for (const filter of unsafeFilters) {
            assert.throws(() => db_api.validateFilter(filter), /Database filter/);
        }
    });

    it('rejects prototype-related filter and update keys', function() {
        const unsafeFilter = JSON.parse('{"constructor.prototype.synthetic": true}');
        const unsafeUpdate = JSON.parse('{"nested": {"__proto__": {"synthetic": true}}}');

        assert.throws(() => db_api.validateFilter(unsafeFilter), /unsafe key/);
        assert.throws(() => db_api.validateUpdateObject(unsafeUpdate), /unsafe key/);
        assert.throws(() => db_api.validateUpdateObject({'$set': {favorite: true}}), /unsafe key/);
    });

    it('accepts ordinary nested updates and dotted server fields', function() {
        assert.doesNotThrow(() => db_api.validateUpdateObject({
            favorite: true,
            category: {uid: 'synthetic-category'},
            'schedule.type': 'recurring'
        }));
    });
});
