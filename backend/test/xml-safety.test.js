const assert = require('assert');

const xml_safety = require('../xml-safety');

describe('XML output safety', function() {
    it('escapes every ampersand in a URL', function() {
        const input = 'https://example.invalid/image?a=1&b=2&c=3';
        assert.strictEqual(
            xml_safety.escapeAmpersands(input),
            'https://example.invalid/image?a=1&amp;b=2&amp;c=3'
        );
    });

    it('preserves absent optional values', function() {
        assert.strictEqual(xml_safety.escapeAmpersands(null), null);
        assert.strictEqual(xml_safety.escapeAmpersands(undefined), undefined);
    });
});
