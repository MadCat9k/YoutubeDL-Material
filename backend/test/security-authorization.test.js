const assert = require('assert');

const security_authorization = require('../security-authorization');

function createResponse() {
    return {
        status: null,
        sendStatus(status) {
            this.status = status;
            return this;
        }
    };
}

async function invoke(middleware, req) {
    const res = createResponse();
    let nextCalled = false;
    await middleware(req, res, () => nextCalled = true);
    return {status: res.status, nextCalled};
}

function createAuthorization({multiUser = true, registration = false, admin = true, settingsUsers = []} = {}) {
    return security_authorization.createUserAuthorization({
        getConfigItem: key => ({
            ytdl_multi_user_mode: multiUser,
            ytdl_allow_registration: registration
        })[key],
        userHasPermission: async userId => settingsUsers.includes(userId),
        adminExists: async () => admin,
        availablePermissions: ['filemanager', 'settings']
    });
}

describe('User mutation authorization', function() {
    it('requires settings permission for privileged multi-user mutations', async function() {
        const authorization = createAuthorization({settingsUsers: ['settings-user']});

        assert.deepStrictEqual(
            await invoke(authorization.requireSettingsPermission, {user: null}),
            {status: 401, nextCalled: false}
        );
        assert.deepStrictEqual(
            await invoke(authorization.requireSettingsPermission, {user: {uid: 'ordinary-user'}}),
            {status: 403, nextCalled: false}
        );
        assert.deepStrictEqual(
            await invoke(authorization.requireSettingsPermission, {user: {uid: 'settings-user'}}),
            {status: null, nextCalled: true}
        );
    });

    it('allows password changes only for the current user or a settings user', async function() {
        const authorization = createAuthorization({settingsUsers: ['settings-user']});

        assert.deepStrictEqual(
            await invoke(authorization.requireSelfOrSettings, {
                user: {uid: 'ordinary-user'}, body: {user_uid: 'ordinary-user'}
            }),
            {status: null, nextCalled: true}
        );
        assert.deepStrictEqual(
            await invoke(authorization.requireSelfOrSettings, {
                user: {uid: 'ordinary-user'}, body: {user_uid: 'another-user'}
            }),
            {status: 403, nextCalled: false}
        );
        assert.deepStrictEqual(
            await invoke(authorization.requireSelfOrSettings, {
                user: {uid: 'settings-user'}, body: {user_uid: 'another-user'}
            }),
            {status: null, nextCalled: true}
        );
    });

    it('preserves single-user mutation behavior', async function() {
        const authorization = createAuthorization({multiUser: false});

        assert.deepStrictEqual(
            await invoke(authorization.requireSettingsPermission, {user: null}),
            {status: null, nextCalled: true}
        );
        assert.deepStrictEqual(
            await invoke(authorization.requireSelfOrSettings, {user: null, body: {}}),
            {status: null, nextCalled: true}
        );
    });

    it('allows only bootstrap, open, or settings-authorized registration', async function() {
        const bootstrap = createAuthorization({admin: false});
        const closed = createAuthorization();
        const open = createAuthorization({registration: true});
        const managed = createAuthorization({settingsUsers: ['settings-user']});

        assert.strictEqual(await bootstrap.canRegister({user: null}, 'admin'), true);
        assert.strictEqual(await closed.canRegister({user: null}, 'ordinary-user'), false);
        assert.strictEqual(await open.canRegister({user: null}, 'ordinary-user'), true);
        assert.strictEqual(await managed.canRegister({user: {uid: 'settings-user'}}, 'ordinary-user'), true);
    });

    it('accepts only known permission values at the request boundary', function() {
        const authorization = createAuthorization();

        assert.strictEqual(authorization.isValidPermissionChange('settings', 'yes'), true);
        assert.strictEqual(authorization.isValidPermissionChange('filemanager', 'default', true), true);
        assert.strictEqual(authorization.isValidPermissionChange('settings', 'default'), false);
        assert.strictEqual(authorization.isValidPermissionChange('unknown', 'yes', true), false);
        assert.strictEqual(authorization.isValidPermissionChange('settings', {$ne: null}, true), false);
    });
});
