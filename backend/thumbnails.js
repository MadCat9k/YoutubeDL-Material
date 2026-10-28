const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');
const stream = require('stream');
const {promisify} = require('util');
const fetch = require('node-fetch');

const media_paths = require('./media-paths');
const network_safety = require('./network-safety');
const utils = require('./utils');

const MAX_THUMBNAIL_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
const pending_thumbnails = new Map();
const pipeline = promisify(stream.pipeline);

function findExistingLocalThumbnail(file, media_path, media_roots) {
    const stored_thumbnail = file.thumbnailPath && media_paths.resolveExistingMediaFile(file.thumbnailPath, media_roots);
    if (stored_thumbnail) return stored_thumbnail;

    const discovered_thumbnail = media_path && utils.getDownloadedThumbnail(media_path);
    return discovered_thumbnail && media_paths.resolveExistingMediaFile(discovered_thumbnail, media_roots);
}

function thumbnailExtension(content_type) {
    const normalized_type = (content_type || '').split(';')[0].trim().toLowerCase();
    return {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp'
    }[normalized_type] || null;
}

async function writeBoundedResponse(response, target_path) {
    const content_length = Number(response.headers.get('content-length'));
    if (Number.isFinite(content_length) && content_length > MAX_THUMBNAIL_BYTES) {
        throw new Error('Remote thumbnail exceeds the size limit.');
    }

    const temp_path = `${target_path}.download-${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
    let received_bytes = 0;
    try {
        const size_limiter = new stream.Transform({
            transform(chunk, encoding, callback) {
                received_bytes += chunk.length;
                if (received_bytes > MAX_THUMBNAIL_BYTES) {
                    callback(new Error('Remote thumbnail exceeds the size limit.'));
                    return;
                }
                callback(null, chunk);
            }
        });
        await pipeline(response.body, size_limiter, fs.createWriteStream(temp_path, {flags: 'wx'}));

        if (await fs.pathExists(target_path)) {
            await fs.remove(temp_path);
        } else {
            await fs.move(temp_path, target_path, {overwrite: false});
        }
        return target_path;
    } catch (error) {
        await fs.remove(temp_path);
        throw error;
    }
}

async function fetchRemoteThumbnail(thumbnail_url, target_stem, redirect_count = 0) {
    const parsed_url = new URL(thumbnail_url);
    if (!['http:', 'https:'].includes(parsed_url.protocol)) throw new Error('Unsupported thumbnail URL protocol.');

    const resolved_address = await network_safety.resolvePublicAddress(parsed_url.hostname);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
        const response = await fetch(parsed_url.toString(), {
            agent: network_safety.createPinnedAgent(parsed_url, resolved_address),
            redirect: 'manual',
            signal: controller.signal
        });

        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
            response.body.destroy();
            if (redirect_count >= MAX_REDIRECTS) throw new Error('Remote thumbnail exceeded the redirect limit.');
            const redirect_url = new URL(response.headers.get('location'), parsed_url).toString();
            return await fetchRemoteThumbnail(redirect_url, target_stem, redirect_count + 1);
        }
        if (!response.ok) {
            response.body.destroy();
            throw new Error(`Remote thumbnail returned HTTP ${response.status}.`);
        }

        const extension = thumbnailExtension(response.headers.get('content-type'));
        if (!extension) {
            response.body.destroy();
            throw new Error('Remote thumbnail did not return a supported image type.');
        }
        return await writeBoundedResponse(response, `${target_stem}${extension}`);
    } finally {
        clearTimeout(timeout);
    }
}

function choosePreviewTimestamp(duration) {
    const numeric_duration = Number(duration);
    if (!Number.isFinite(numeric_duration) || numeric_duration <= 0) return 30;
    return Math.min(30, Math.max(1, numeric_duration * 0.1));
}

async function generateVideoThumbnail(media_path, target_path, timestamp) {
    const temp_path = `${path.dirname(target_path)}/.${path.basename(target_path)}.preview-${process.pid}-${crypto.randomBytes(6).toString('hex')}.jpg`;
    try {
        await new Promise((resolve, reject) => {
            ffmpeg(media_path)
                .seekInput(timestamp)
                .outputOptions(['-frames:v 1', '-q:v 4'])
                .format('image2')
                .on('end', resolve)
                .on('error', reject)
                .save(temp_path);
        });

        if (await fs.pathExists(target_path)) await fs.remove(temp_path);
        else await fs.move(temp_path, target_path, {overwrite: false});
        return target_path;
    } catch (error) {
        await fs.remove(temp_path);
        throw error;
    }
}

async function createLocalThumbnail(file, media_roots, dependencies) {
    const media_path = media_paths.resolveExistingMediaFile(file.path, media_roots);
    if (!media_path) return null;

    const existing_thumbnail = findExistingLocalThumbnail(file, media_path, media_roots);
    if (existing_thumbnail) return existing_thumbnail;

    const target_stem = media_path.slice(0, -path.extname(media_path).length);
    if (file.thumbnailURL) {
        try {
            const downloaded_thumbnail = await dependencies.fetchRemoteThumbnail(file.thumbnailURL, target_stem);
            if (media_paths.resolveExistingMediaFile(downloaded_thumbnail, media_roots)) return downloaded_thumbnail;
        } catch {
            // A local preview is generated below when the remote image is unavailable or unsafe.
        }
    }

    if (file.isAudio) return null;
    try {
        const generated_thumbnail = await dependencies.generateVideoThumbnail(
            media_path,
            `${target_stem}.jpg`,
            choosePreviewTimestamp(file.duration)
        );
        return media_paths.resolveExistingMediaFile(generated_thumbnail, media_roots) ? generated_thumbnail : null;
    } catch {
        return null;
    }
}

exports.ensureLocalThumbnail = async (file, media_roots = media_paths.getConfiguredMediaRoots(), overrides = {}) => {
    if (!file) return null;

    const stored_thumbnail = file.thumbnailPath && media_paths.resolveExistingMediaFile(file.thumbnailPath, media_roots);
    if (stored_thumbnail) return stored_thumbnail;

    const media_path = media_paths.resolveExistingMediaFile(file.path, media_roots);
    if (!media_path) return null;
    const existing_thumbnail = findExistingLocalThumbnail(file, media_path, media_roots);
    if (existing_thumbnail) return existing_thumbnail;

    if (pending_thumbnails.has(media_path)) return await pending_thumbnails.get(media_path);

    const dependencies = {
        fetchRemoteThumbnail: overrides.fetchRemoteThumbnail || fetchRemoteThumbnail,
        generateVideoThumbnail: overrides.generateVideoThumbnail || generateVideoThumbnail
    };
    const pending_thumbnail = createLocalThumbnail(file, media_roots, dependencies)
        .finally(() => pending_thumbnails.delete(media_path));
    pending_thumbnails.set(media_path, pending_thumbnail);
    return await pending_thumbnail;
};

exports.choosePreviewTimestamp = choosePreviewTimestamp;
exports.fetchRemoteThumbnail = fetchRemoteThumbnail;
exports.generateVideoThumbnail = generateVideoThumbnail;
exports.isPrivateAddress = network_safety.isPrivateAddress;
