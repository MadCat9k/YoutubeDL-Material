const fs = require('fs-extra');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');
const unzipper = require('unzipper');

const pipelineAsync = promisify(pipeline);
const ARCHIVE_ROOT = 'youtubedl-material';

function validateReleaseTag(tag) {
    if (typeof tag !== 'string' || !/^v[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag)) {
        throw new Error('Invalid release tag.');
    }
    return tag;
}

function getArchiveEntryDestination(entryPath, backendRoot) {
    if (typeof entryPath !== 'string' || entryPath.includes('\0')) {
        throw new Error('Invalid archive entry path.');
    }

    const portablePath = entryPath.replace(/\\/g, '/');
    if (portablePath.startsWith('/') || /^[A-Za-z]:\//.test(portablePath)) {
        throw new Error('Absolute archive entry paths are not allowed.');
    }

    const pathParts = portablePath.split('/').filter(part => part.length > 0);
    if (pathParts.includes('.') || pathParts.includes('..') || pathParts[0] !== ARCHIVE_ROOT) {
        throw new Error('Archive entry is outside the release root.');
    }

    const relativeParts = pathParts.slice(1);
    if (relativeParts.length === 0) return null;
    if (relativeParts[0].toLowerCase() === 'appdata') return null;

    const resolvedRoot = path.resolve(backendRoot);
    const destination = path.resolve(resolvedRoot, ...relativeParts);
    const relativeDestination = path.relative(resolvedRoot, destination);
    if (!relativeDestination || relativeDestination.startsWith('..' + path.sep) || path.isAbsolute(relativeDestination)) {
        throw new Error('Archive entry resolves outside the backend root.');
    }

    return destination;
}

async function assertNoSymlinkComponents(backendRoot, destination) {
    const resolvedRoot = path.resolve(backendRoot);
    const relativeDestination = path.relative(resolvedRoot, destination);
    const parts = relativeDestination.split(path.sep);
    let currentPath = resolvedRoot;

    for (const part of parts) {
        currentPath = path.join(currentPath, part);
        if (!(await fs.pathExists(currentPath))) continue;
        const stats = await fs.lstat(currentPath);
        if (stats.isSymbolicLink()) {
            throw new Error('Archive entry would traverse a symbolic link.');
        }
    }
}

async function extractReleaseArchive(archivePath, backendRoot) {
    const directory = await unzipper.Open.file(archivePath);
    const entries = [];
    const destinations = new Set();

    for (const entry of directory.files) {
        if (entry.type === 'Directory') continue;
        if (entry.type !== 'File') {
            throw new Error('Release archive contains an unsupported entry type.');
        }

        const destination = getArchiveEntryDestination(entry.path, backendRoot);
        if (!destination) continue;
        if (destinations.has(destination)) {
            throw new Error('Release archive contains duplicate file paths.');
        }
        destinations.add(destination);
        entries.push({entry, destination});
    }

    const publicPath = path.join(path.resolve(backendRoot), 'public');
    await assertNoSymlinkComponents(backendRoot, publicPath);
    await fs.emptyDir(publicPath);

    for (const {entry, destination} of entries) {
        await assertNoSymlinkComponents(backendRoot, destination);
        await fs.ensureDir(path.dirname(destination));
        await pipelineAsync(entry.stream(), fs.createWriteStream(destination, {flags: 'w'}));
    }
}

module.exports = {
    extractReleaseArchive,
    getArchiveEntryDestination,
    validateReleaseTag
};
