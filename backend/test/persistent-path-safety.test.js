const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const db_backup_paths = require('../db-backup-paths');
const utils = require('../utils');

describe('Persistent path safety', function() {
    let testRoot;
    let backupRoot;
    let mediaRoot;
    let outputRoot;

    beforeEach(async function() {
        testRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdlm-paths-'));
        backupRoot = path.join(testRoot, 'backups');
        mediaRoot = path.join(testRoot, 'media');
        outputRoot = path.join(testRoot, 'output');
        await fs.ensureDir(backupRoot);
        await fs.ensureDir(mediaRoot);
    });

    afterEach(async function() {
        await fs.remove(testRoot);
    });

    it('accepts only an existing backup with the generated name format', async function() {
        const backupName = 'local_db.json.1234567890.123.bak';
        const backupPath = path.join(backupRoot, backupName);
        await fs.writeJson(backupPath, {files: []});

        assert.strictEqual(db_backup_paths.resolveExistingBackupFile(backupName, backupRoot), fs.realpathSync(backupPath));
        assert.strictEqual(db_backup_paths.resolveExistingBackupFile('../' + backupName, backupRoot), null);
        assert.strictEqual(db_backup_paths.resolveExistingBackupFile('arbitrary.json', backupRoot), null);
    });

    it('rejects a backup symlink that escapes the backup root', async function() {
        const backupName = 'remote_db.json.1234567890.123.bak';
        const outsidePath = path.join(testRoot, 'outside.bak');
        await fs.writeJson(outsidePath, {files: []});
        await fs.symlink(outsidePath, path.join(backupRoot, backupName));

        assert.strictEqual(db_backup_paths.resolveExistingBackupFile(backupName, backupRoot), null);
    });

    it('creates container archives with random names beneath the output root', async function() {
        const mediaPath = path.join(mediaRoot, 'synthetic.mp4');
        await fs.writeFile(mediaPath, 'synthetic media');

        const zipPath = await utils.createContainerZipFile(
            '../../request-controlled-name',
            [{path: mediaPath}],
            [mediaRoot],
            outputRoot
        );

        assert.strictEqual(path.dirname(zipPath), outputRoot);
        assert.match(path.basename(zipPath), /^container-[0-9a-f]{24}\.zip$/);
        assert.strictEqual(await fs.pathExists(zipPath), true);
    });

    it('rejects media outside the configured archive roots', async function() {
        const outsidePath = path.join(testRoot, 'outside.mp4');
        await fs.writeFile(outsidePath, 'synthetic media');

        await assert.rejects(
            utils.createContainerZipFile('synthetic', [{path: outsidePath}], [mediaRoot], outputRoot),
            /invalid media path/
        );
    });
});
