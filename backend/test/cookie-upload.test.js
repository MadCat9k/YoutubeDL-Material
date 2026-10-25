const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const cookie_upload = require('../cookie-upload');

describe('Cookies file upload', function() {
    let testRoot;
    let appdataRoot;

    beforeEach(async function() {
        testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdlm-cookies-'));
        appdataRoot = path.join(testRoot, 'appdata');
        await fs.ensureDir(appdataRoot);
    });

    afterEach(async function() {
        await fs.remove(testRoot);
    });

    it('installs a bounded temporary file at the fixed cookies path', async function() {
        const uploadPath = path.join(appdataRoot, 'synthetic-upload');
        await fs.writeFile(uploadPath, '# synthetic cookies file');

        assert.strictEqual(await cookie_upload.installUploadedCookieFile({path: uploadPath}, appdataRoot), true);
        assert.strictEqual(await fs.readFile(path.join(appdataRoot, 'cookies.txt'), 'utf8'), '# synthetic cookies file');
        assert.strictEqual((await fs.stat(path.join(appdataRoot, 'cookies.txt'))).mode & 0o777, 0o600);
    });

    it('rejects files outside appdata and oversized files', async function() {
        const outsidePath = path.join(testRoot, 'outside-upload');
        const oversizedPath = path.join(appdataRoot, 'oversized-upload');
        await fs.writeFile(outsidePath, 'must survive');
        await fs.writeFile(oversizedPath, 'x');
        await fs.truncate(oversizedPath, cookie_upload.MAX_COOKIE_FILE_SIZE + 1);

        assert.strictEqual(await cookie_upload.installUploadedCookieFile({path: outsidePath}, appdataRoot), false);
        assert.strictEqual(await cookie_upload.installUploadedCookieFile({path: oversizedPath}, appdataRoot), false);
        assert.strictEqual(await fs.readFile(outsidePath, 'utf8'), 'must survive');
        assert.strictEqual(await fs.pathExists(oversizedPath), false);
        assert.strictEqual(await fs.pathExists(path.join(appdataRoot, 'cookies.txt')), false);
    });
});
