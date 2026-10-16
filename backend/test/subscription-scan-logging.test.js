const assert = require('assert');
const fs = require('fs-extra');

const archive_api = require('../archive');
const config_api = require('../config');
const db_api = require('../db');
const downloader_api = require('../downloader');
const logger = require('../logger');
const subscriptions_api = require('../subscriptions');
const youtubedl_api = require('../youtube-dl');

describe('Subscription scan logging', function() {
    const original = {};
    const private_url = 'https://example.invalid/channel/private-token';
    const private_name = 'Private Synthetic Channel';
    let callback_result;
    let created_downloads;
    let info_messages;
    let error_messages;
    let warning_messages;
    let interval_callback;
    let interval_cleared;
    let timeout_callback;
    let timeout_cleared;
    let killed_process;
    let now;
    let updates;

    beforeEach(function() {
        original.getSubscription = subscriptions_api.getSubscription;
        original.runYoutubeDL = youtubedl_api.runYoutubeDL;
        original.killYoutubeDLProcess = youtubedl_api.killYoutubeDLProcess;
        original.createDownload = downloader_api.createDownload;
        original.getRecord = db_api.getRecord;
        original.updateRecord = db_api.updateRecord;
        original.getConfigItem = config_api.getConfigItem;
        original.generateArchive = archive_api.generateArchive;
        original.existsInArchive = archive_api.existsInArchive;
        original.ensureDirSync = fs.ensureDirSync;
        original.pathExists = fs.pathExists;
        original.loggerInfo = logger.info;
        original.loggerError = logger.error;
        original.loggerWarn = logger.warn;
        original.loggerVerbose = logger.verbose;
        original.setInterval = global.setInterval;
        original.clearInterval = global.clearInterval;
        original.setTimeout = global.setTimeout;
        original.clearTimeout = global.clearTimeout;
        original.dateNow = Date.now;

        callback_result = deferred();
        created_downloads = [];
        info_messages = [];
        error_messages = [];
        warning_messages = [];
        interval_callback = null;
        interval_cleared = false;
        timeout_callback = null;
        timeout_cleared = false;
        killed_process = null;
        now = 1000;
        updates = [];

        subscriptions_api.getSubscription = async () => ({
            id: 'synthetic-subscription-id',
            url: private_url,
            name: private_name,
            type: 'video',
            paused: false
        });
        youtubedl_api.runYoutubeDL = async () => ({
            child_process: {pid: 123},
            callback: callback_result.promise
        });
        youtubedl_api.killYoutubeDLProcess = child_process => {
            killed_process = child_process;
            callback_result.resolve({parsed_output: null, err: {signal: 'SIGKILL'}});
        };
        downloader_api.createDownload = async (...args) => {
            created_downloads.push(args);
            return {uid: 'synthetic-download-id'};
        };
        db_api.getRecord = async () => null;
        db_api.updateRecord = async (table, filter, update) => {
            updates.push({table, filter, update});
            return true;
        };
        config_api.getConfigItem = key => ({
            ytdl_subscriptions_base_path: '/tmp/synthetic-subscriptions',
            ytdl_default_file_output: '%(title)s',
            ytdl_default_downloader: 'yt-dlp',
            ytdl_use_cookies: false,
            ytdl_include_thumbnail: false,
            ytdl_download_rate_limit: null,
            ytdl_subscriptions_redownload_fresh_uploads: false
        })[key];
        archive_api.generateArchive = async () => '';
        archive_api.existsInArchive = async () => false;
        fs.ensureDirSync = () => undefined;
        fs.pathExists = async () => false;
        logger.info = message => info_messages.push(message);
        logger.error = message => error_messages.push(message);
        logger.warn = message => warning_messages.push(message);
        logger.verbose = () => undefined;
        global.setInterval = callback => {
            interval_callback = callback;
            return {unref: () => undefined};
        };
        global.clearInterval = () => { interval_cleared = true; };
        global.setTimeout = callback => {
            timeout_callback = callback;
            return {unref: () => undefined};
        };
        global.clearTimeout = () => { timeout_cleared = true; };
        Date.now = () => now;
    });

    afterEach(function() {
        subscriptions_api.getSubscription = original.getSubscription;
        youtubedl_api.runYoutubeDL = original.runYoutubeDL;
        youtubedl_api.killYoutubeDLProcess = original.killYoutubeDLProcess;
        downloader_api.createDownload = original.createDownload;
        db_api.getRecord = original.getRecord;
        db_api.updateRecord = original.updateRecord;
        config_api.getConfigItem = original.getConfigItem;
        archive_api.generateArchive = original.generateArchive;
        archive_api.existsInArchive = original.existsInArchive;
        fs.ensureDirSync = original.ensureDirSync;
        fs.pathExists = original.pathExists;
        logger.info = original.loggerInfo;
        logger.error = original.loggerError;
        logger.warn = original.loggerWarn;
        logger.verbose = original.loggerVerbose;
        global.setInterval = original.setInterval;
        global.clearInterval = original.clearInterval;
        global.setTimeout = original.setTimeout;
        global.clearTimeout = original.clearTimeout;
        Date.now = original.dateNow;
    });

    it('logs safe start, heartbeat, and completion details', async function() {
        assert.strictEqual(await subscriptions_api.getVideosForSub('synthetic-subscription-id'), true);
        await waitFor(() => interval_callback !== null);

        now = 62000;
        interval_callback();
        callback_result.resolve({parsed_output: [], err: null});
        await waitFor(() => interval_cleared);

        assert.deepStrictEqual(info_messages, [
            'Subscription scan started for synthetic-subscription-id.',
            'Subscription scan still running for synthetic-subscription-id after 61 seconds.',
            'Subscription scan completed for synthetic-subscription-id after 61 seconds; discovered 0 entries and queued 0.'
        ]);
        assert.strictEqual(messagesContainPrivateData(info_messages), false);
        assert.strictEqual(updates.some(({update}) => update.downloading === true), true);
        assert.strictEqual(updates.some(({update}) => update.downloading === false && update.child_process === null), true);
        assert.strictEqual(timeout_cleared, true);
    });

    it('does not copy downloader output into failure logs', async function() {
        assert.strictEqual(await subscriptions_api.getVideosForSub('synthetic-subscription-id'), true);
        await waitFor(() => interval_callback !== null);

        callback_result.resolve({
            parsed_output: null,
            err: {
                exitCode: 1,
                signal: 'SIGTERM',
                stderr: `failed for ${private_url}`,
                stdout: private_name
            }
        });
        await waitFor(() => interval_cleared);

        assert.deepStrictEqual(error_messages, [
            'Subscription scan failed for synthetic-subscription-id after 0 seconds (exit code 1, signal SIGTERM).'
        ]);
        assert.strictEqual(messagesContainPrivateData(error_messages), false);
        assert.strictEqual(updates.some(({update}) => update.downloading === false && update.child_process === null), true);
    });

    it('uses fast playlist discovery and queues minimal entries for full metadata collection', async function() {
        let downloader_args;
        youtubedl_api.runYoutubeDL = async (url, args) => {
            downloader_args = args;
            return {
                child_process: {pid: 123},
                callback: callback_result.promise
            };
        };

        assert.strictEqual(await subscriptions_api.getVideosForSub('synthetic-subscription-id'), true);
        await waitFor(() => interval_callback !== null);
        callback_result.resolve({
            parsed_output: [{
                id: 'synthetic-video-id',
                title: 'Synthetic Video',
                extractor: 'synthetic',
                webpage_url: 'https://example.invalid/watch/synthetic-video'
            }],
            err: null
        });
        await waitFor(() => created_downloads.length === 1 && interval_cleared);

        assert.strictEqual(downloader_args.includes('--flat-playlist'), true);
        assert.strictEqual(downloader_args.includes('--lazy-playlist'), true);
        assert.deepStrictEqual(downloader_args.slice(downloader_args.indexOf('--socket-timeout'), downloader_args.indexOf('--socket-timeout') + 2), ['--socket-timeout', '30']);
        assert.strictEqual(created_downloads[0][0], 'https://example.invalid/watch/synthetic-video');
        assert.strictEqual(created_downloads[0][6], null);
        assert.strictEqual(info_messages.some(message => message.includes('discovered 1 entries and queued 1')), true);
    });

    it('kills and cleans up a scan that exceeds ten minutes', async function() {
        assert.strictEqual(await subscriptions_api.getVideosForSub('synthetic-subscription-id'), true);
        await waitFor(() => timeout_callback !== null);

        now = 601000;
        timeout_callback();
        await waitFor(() => timeout_cleared);

        assert.deepStrictEqual(killed_process, {pid: 123});
        assert.deepStrictEqual(error_messages, [
            'Subscription scan timed out for synthetic-subscription-id after 600 seconds.'
        ]);
        assert.strictEqual(messagesContainPrivateData(error_messages), false);
        assert.strictEqual(updates.some(({update}) => update.downloading === false && update.child_process === null), true);
    });

    function messagesContainPrivateData(messages) {
        return messages.some(message => message.includes(private_url) || message.includes(private_name));
    }

    function deferred() {
        let resolve;
        const promise = new Promise(resolvePromise => { resolve = resolvePromise; });
        return {promise, resolve};
    }

    async function waitFor(predicate) {
        for (let attempt = 0; attempt < 20; attempt++) {
            if (predicate()) return;
            await new Promise(resolve => setImmediate(resolve));
        }
        assert.fail('Timed out waiting for subscription scan state.');
    }
});
