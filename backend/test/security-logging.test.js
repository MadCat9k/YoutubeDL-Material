const assert = require('assert');

const security_logging = require('../security-logging');

describe('Security logging', function() {
    it('records only whether an API key was provided', function() {
        const suppliedKey = 'synthetic-secret-value';
        const message = security_logging.getRejectedApiRequestLogMessage(suppliedKey);

        assert.strictEqual(message.includes(suppliedKey), false);
        assert.strictEqual(message.endsWith('API key provided: true'), true);
    });

    it('does not include request-controlled data when no key was provided', function() {
        const message = security_logging.getRejectedApiRequestLogMessage(undefined);

        assert.strictEqual(message, 'Rejecting request - invalid API use for protected endpoint. API key provided: false');
    });

    it('uses fixed messages for downloader arguments', function() {
        const syntheticSecret = 'synthetic-cookie-or-header-value';
        const messages = [
            security_logging.getDownloaderInvocationLogMessage(syntheticSecret),
            security_logging.getArgumentInjectionFailureLogMessage(syntheticSecret)
        ];

        assert.strictEqual(messages.some(message => message.includes(syntheticSecret)), false);
        assert.deepStrictEqual(messages, [
            'Downloader invocation prepared.',
            'Failed to apply downloader arguments.'
        ]);
    });
});
