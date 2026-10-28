const assert = require('assert');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const {Readable} = require('stream');

const network_safety = require('../network-safety');
const utils = require('../utils');

function response(status, body = '', headers = {}) {
    const normalized_headers = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    );
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: {
            get: key => normalized_headers[key.toLowerCase()] || null
        },
        body: Readable.from([Buffer.from(body)])
    };
}

function safeOverrides(fetch_impl) {
    return {
        fetch: fetch_impl,
        resolvePublicAddress: async () => ({address: '8.8.8.8', family: 4}),
        createPinnedAgent: () => undefined
    };
}

describe('Trusted remote downloads', function() {
    let tempRoot;
    let outputPath;

    beforeEach(async function() {
        tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ytdlm-download-'));
        outputPath = path.join(tempRoot, 'download.bin');
    });

    afterEach(async function() {
        await fs.remove(tempRoot);
    });

    it('allows only approved GitHub HTTPS download hosts', function() {
        assert.strictEqual(utils.parseTrustedDownloadURL('https://github.com/owner/release').hostname, 'github.com');
        assert.strictEqual(
            utils.parseTrustedDownloadURL('https://release-assets.githubusercontent.com/file').hostname,
            'release-assets.githubusercontent.com'
        );
        assert.throws(() => utils.parseTrustedDownloadURL('http://github.com/owner/release'), /approved HTTPS/);
        assert.throws(() => utils.parseTrustedDownloadURL('https://github.com.example.invalid/file'), /approved HTTPS/);
        assert.throws(() => utils.parseTrustedDownloadURL('https://127.0.0.1/file'), /approved HTTPS/);
    });

    it('writes an approved response through a temporary file', async function() {
        const contents = 'synthetic release data';
        const fetch_impl = async () => response(200, contents, {'content-length': String(contents.length)});

        await utils.fetchFile(
            'https://github.com/example/project/releases/download/v1.0.0/file.zip',
            outputPath,
            'synthetic update',
            safeOverrides(fetch_impl)
        );

        assert.strictEqual(await fs.readFile(outputPath, 'utf8'), contents);
        assert.deepStrictEqual((await fs.readdir(tempRoot)).sort(), ['download.bin']);
    });

    it('rejects a redirect to an unapproved destination before requesting it', async function() {
        let request_count = 0;
        const fetch_impl = async () => {
            request_count++;
            return response(302, '', {location: 'https://127.0.0.1/private'});
        };

        await assert.rejects(
            utils.fetchFile(
                'https://github.com/example/project/releases/download/v1.0.0/file.zip',
                outputPath,
                'synthetic update',
                safeOverrides(fetch_impl)
            ),
            /approved HTTPS/
        );
        assert.strictEqual(request_count, 1);
        assert.strictEqual(await fs.pathExists(outputPath), false);
    });

    it('resolves and validates every approved redirect destination', async function() {
        let request_count = 0;
        const fetch_impl = async () => {
            request_count++;
            return response(302, '', {location: 'https://release-assets.githubusercontent.com/file'});
        };
        const overrides = safeOverrides(fetch_impl);
        overrides.resolvePublicAddress = async hostname => {
            if (hostname === 'github.com') return {address: '8.8.8.8', family: 4};
            throw new Error('Remote host did not resolve to a public address.');
        };

        await assert.rejects(
            utils.fetchFile(
                'https://github.com/example/project/releases/download/v1.0.0/file.zip',
                outputPath,
                'synthetic update',
                overrides
            ),
            /public address/
        );
        assert.strictEqual(request_count, 1);
    });

    it('rejects private literal addresses and oversized responses', async function() {
        await assert.rejects(network_safety.resolvePublicAddress('127.0.0.1'), /public address/);
        const fetch_impl = async () => response(200, '', {'content-length': String(1024 * 1024 * 1024 + 1)});

        await assert.rejects(
            utils.fetchFile(
                'https://github.com/example/project/releases/download/v1.0.0/file.zip',
                outputPath,
                'synthetic update',
                safeOverrides(fetch_impl)
            ),
            /size limit/
        );
        assert.strictEqual(await fs.pathExists(outputPath), false);
    });

    it('does not replace an existing file when the response fails', async function() {
        await fs.writeFile(outputPath, 'known-good');
        const fetch_impl = async () => response(503);

        await assert.rejects(
            utils.fetchFile(
                'https://github.com/example/project/releases/download/v1.0.0/file.zip',
                outputPath,
                'synthetic update',
                safeOverrides(fetch_impl)
            ),
            /HTTP 503/
        );
        assert.strictEqual(await fs.readFile(outputPath, 'utf8'), 'known-good');
    });
});
