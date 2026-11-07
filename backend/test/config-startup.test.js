/* eslint-disable no-undef */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('Configuration startup', function() {
    it('creates defaults when config is read before explicit initialization', function() {
        const workingDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdlm-config-startup-'));
        const appdataDirectory = path.join(workingDirectory, 'appdata');
        const logsDirectory = path.join(appdataDirectory, 'logs');
        const configModulePath = path.resolve(__dirname, '../config.js');
        fs.mkdirSync(logsDirectory, {recursive: true});

        const script = [
            'const config = require(process.argv[1]);',
            "const value = config.getConfigItem('ytdl_use_telegram_API');",
            'if (value !== false) process.exit(2);'
        ].join(' ');
        const result = spawnSync(process.execPath, ['-e', script, configModulePath], {
            cwd: workingDirectory,
            encoding: 'utf8'
        });

        try {
            assert.strictEqual(result.status, 0, result.stderr || result.stdout);
            const writtenConfig = JSON.parse(fs.readFileSync(path.join(appdataDirectory, 'default.json')));
            assert.strictEqual(writtenConfig.YoutubeDLMaterial.API.use_telegram_API, false);
        } finally {
            fs.rmSync(workingDirectory, {recursive: true, force: true});
        }
    });
});
