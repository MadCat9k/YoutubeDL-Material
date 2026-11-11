const assert = require('assert');

const user_response = require('../security-user-response');
const auth_api = require('../authentication/auth');

describe('Public user responses', function() {
    const storedUser = {
        uid: 'synthetic-user',
        name: 'Synthetic User',
        passhash: 'synthetic-bcrypt-hash',
        subscriptions: ['synthetic-subscription'],
        created: 123456,
        role: 'user',
        permissions: ['subscriptions'],
        permission_overrides: ['subscriptions'],
        files: ['synthetic-file'],
        playlists: ['synthetic-playlist'],
        auth_method: 'internal',
        future_secret: 'synthetic-secret'
    };

    it('returns only explicitly public user fields', function() {
        assert.deepStrictEqual(user_response.toPublicUser(storedUser), {
            uid: 'synthetic-user',
            name: 'Synthetic User',
            subscriptions: ['synthetic-subscription'],
            created: 123456,
            role: 'user',
            permissions: ['subscriptions'],
            permission_overrides: ['subscriptions']
        });
    });

    it('never includes credential or unknown database fields in user lists', function() {
        const users = user_response.toPublicUsers([storedUser]);

        assert.strictEqual(users.length, 1);
        assert.strictEqual(Object.hasOwn(users[0], 'passhash'), false);
        assert.strictEqual(Object.hasOwn(users[0], 'future_secret'), false);
        assert.deepStrictEqual(user_response.toPublicUsers(null), []);
    });

    it('redacts the authenticated user before returning login or JWT responses', async function() {
        const originalUserPermissions = auth_api.userPermissions;
        let responseBody = null;
        auth_api.userPermissions = async () => ['subscriptions'];

        try {
            await auth_api.returnAuthResponse({
                user: storedUser,
                token: 'synthetic-token'
            }, {
                status(status) {
                    assert.strictEqual(status, 200);
                    return this;
                },
                json(body) {
                    responseBody = body;
                }
            });
        } finally {
            auth_api.userPermissions = originalUserPermissions;
        }

        assert.strictEqual(responseBody.token, 'synthetic-token');
        assert.strictEqual(Object.hasOwn(responseBody.user, 'passhash'), false);
        assert.strictEqual(Object.hasOwn(responseBody.user, 'future_secret'), false);
    });
});
