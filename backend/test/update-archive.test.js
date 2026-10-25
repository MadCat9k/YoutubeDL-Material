const assert = require('assert');
const archiver = require('archiver');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const update_archive = require('../update-archive');

async function createArchive(archivePath, entries) {
    await new Promise((resolve, reject) => {
        const output = fs.createWriteStream(archivePath);
        const archive = archiver('zip');
        output.on('close', resolve);
        output.on('error', reject);
        archive.on('error', reject);
        archive.pipe(output);
        for (const [name, contents] of Object.entries(entries)) {
            archive.append(contents, {name});
        }
        archive.finalize();
    });
}

describe('Update archive safety', function() {
    let backendRoot;
    let outsideRoot;

    beforeEach(async function() {
        backendRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdlm-update-'));
        outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdlm-update-outside-'));
    });

    afterEach(async function() {
        await fs.remove(backendRoot);
        await fs.remove(outsideRoot);
    });

    it('accepts release tags without allowing path separators', function() {
        assert.strictEqual(update_archive.validateReleaseTag('v4.3.2'), 'v4.3.2');
        assert.strictEqual(update_archive.validateReleaseTag('v4.3.2-rc.1'), 'v4.3.2-rc.1');
        assert.throws(() => update_archive.validateReleaseTag('../../tmp/owned'), /Invalid release tag/);
        assert.throws(() => update_archive.validateReleaseTag('latest'), /Invalid release tag/);
    });

    it('keeps normal release files inside the backend root', function() {
        const destination = update_archive.getArchiveEntryDestination(
            'youtubedl-material/public/assets/app.js',
            backendRoot
        );

        assert.strictEqual(destination, path.join(backendRoot, 'public', 'assets', 'app.js'));
    });

    it('rejects traversal and absolute archive paths', function() {
        const unsafePaths = [
            'youtubedl-material/../../outside.txt',
            'youtubedl-material/public/../../../outside.txt',
            '../youtubedl-material/server.js',
            '/youtubedl-material/server.js',
            'C:\\youtubedl-material\\server.js',
            'different-root/server.js'
        ];

        for (const unsafePath of unsafePaths) {
            assert.throws(
                () => update_archive.getArchiveEntryDestination(unsafePath, backendRoot),
                /archive entry|Archive entry|Absolute archive/
            );
        }
    });

    it('never replaces persistent appdata from an application update', function() {
        const destination = update_archive.getArchiveEntryDestination(
            'youtubedl-material/appdata/db.json',
            backendRoot
        );

        assert.strictEqual(destination, null);
    });

    it('extracts valid release files and preserves persistent appdata', async function() {
        const archivePath = path.join(backendRoot, 'release.zip');
        await fs.outputFile(path.join(backendRoot, 'public', 'old.js'), 'old');
        await fs.outputFile(path.join(backendRoot, 'appdata', 'db.json'), 'persistent');
        await createArchive(archivePath, {
            'youtubedl-material/public/new.js': 'new',
            'youtubedl-material/server.js': 'server',
            'youtubedl-material/appdata/db.json': 'replacement'
        });

        await update_archive.extractReleaseArchive(archivePath, backendRoot);

        assert.strictEqual(await fs.readFile(path.join(backendRoot, 'public', 'new.js'), 'utf8'), 'new');
        assert.strictEqual(await fs.pathExists(path.join(backendRoot, 'public', 'old.js')), false);
        assert.strictEqual(await fs.readFile(path.join(backendRoot, 'server.js'), 'utf8'), 'server');
        assert.strictEqual(await fs.readFile(path.join(backendRoot, 'appdata', 'db.json'), 'utf8'), 'persistent');
    });

    it('rejects an existing symlink that would escape the backend root', async function() {
        const archivePath = path.join(backendRoot, 'release.zip');
        await fs.symlink(outsideRoot, path.join(backendRoot, 'public'), 'dir');
        await createArchive(archivePath, {
            'youtubedl-material/public/new.js': 'new'
        });

        await assert.rejects(
            update_archive.extractReleaseArchive(archivePath, backendRoot),
            /symbolic link/
        );
        assert.strictEqual(await fs.pathExists(path.join(outsideRoot, 'new.js')), false);
    });
});
