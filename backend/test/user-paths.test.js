const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const user_paths = require('../user-paths');

describe('User storage paths', function() {
    let testRoot;
    let usersRoot;

    beforeEach(async function() {
        testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdlm-users-'));
        usersRoot = path.join(testRoot, 'users');
        await fs.ensureDir(usersRoot);
    });

    afterEach(async function() {
        await fs.remove(testRoot);
    });

    it('accepts a single user ID segment beneath the users root', async function() {
        const expected = path.join(await fs.realpath(usersRoot), 'synthetic_user-1');
        assert.strictEqual(user_paths.isValidUserID('synthetic_user-1'), true);
        assert.strictEqual(user_paths.resolveUserDirectory('synthetic_user-1', usersRoot), expected);
    });

    it('accepts a valid user beneath a users root that has not been created yet', function() {
        const missingRoot = path.join(testRoot, 'not-created');
        assert.strictEqual(user_paths.resolveUserDirectory('synthetic_user', missingRoot), path.join(missingRoot, 'synthetic_user'));
    });

    it('rejects traversal, separators, NULs, and overlong user IDs', function() {
        assert.strictEqual(user_paths.isValidUserID('../outside'), false);
        assert.strictEqual(user_paths.isValidUserID('nested/user'), false);
        assert.strictEqual(user_paths.isValidUserID('nested\\user'), false);
        assert.strictEqual(user_paths.isValidUserID('bad\0user'), false);
        assert.strictEqual(user_paths.isValidUserID('x'.repeat(256)), false);
    });

    it('rejects a user-directory symlink that escapes the users root', async function() {
        const outside = path.join(testRoot, 'outside');
        await fs.ensureDir(outside);
        await fs.symlink(outside, path.join(usersRoot, 'synthetic_user'));

        assert.strictEqual(user_paths.resolveUserDirectory('synthetic_user', usersRoot), null);
    });
});
