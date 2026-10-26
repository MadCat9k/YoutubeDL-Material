const fs = require('fs-extra');
const path = require('path');

const config_api = require('./config');

exports.getConfiguredMediaRoots = () => [
    config_api.getConfigItem('ytdl_audio_folder_path'),
    config_api.getConfigItem('ytdl_video_folder_path'),
    config_api.getConfigItem('ytdl_subscriptions_base_path'),
    config_api.getConfigItem('ytdl_users_base_path')
].filter(root => typeof root === 'string' && root.length > 0);

function realPathIfPresent(candidate, expected_type) {
    try {
        const real_path = fs.realpathSync(candidate);
        const stats = fs.statSync(real_path);
        if (expected_type === 'file' && !stats.isFile()) return null;
        if (expected_type === 'directory' && !stats.isDirectory()) return null;
        return real_path;
    } catch {
        return null;
    }
}

function isWithinRoot(candidate, root) {
    const relative_path = path.relative(root, candidate);
    return relative_path === '' || (!relative_path.startsWith(`..${path.sep}`) && relative_path !== '..' && !path.isAbsolute(relative_path));
}

exports.resolveExistingMediaFile = (candidate, roots = exports.getConfiguredMediaRoots(), base_directory = __dirname) => {
    if (typeof candidate !== 'string' || candidate.length === 0 || candidate.includes('\0')) return null;

    const resolved_candidate = path.resolve(base_directory, candidate);
    for (const root of roots) {
        const resolved_root = path.resolve(base_directory, root);
        const real_root = realPathIfPresent(resolved_root, 'directory');
        if (!real_root) continue;

        const relative_candidate = path.relative(resolved_root, resolved_candidate);
        const real_relative_candidate = path.relative(real_root, resolved_candidate);
        const under_resolved_root = relative_candidate !== '..' && !relative_candidate.startsWith(`..${path.sep}`) && !path.isAbsolute(relative_candidate);
        const under_real_root = real_relative_candidate !== '..' && !real_relative_candidate.startsWith(`..${path.sep}`) && !path.isAbsolute(real_relative_candidate);
        if (!under_resolved_root && !under_real_root) continue;

        const real_candidate = realPathIfPresent(resolved_candidate, 'file');
        if (real_candidate && isWithinRoot(real_candidate, real_root)) return real_candidate;
    }

    return null;
};

exports.resolveMediaOutputFile = (candidate, roots = exports.getConfiguredMediaRoots(), base_directory = __dirname) => {
    if (typeof candidate !== 'string' || candidate.length === 0 || candidate.includes('\0')) return null;

    const resolved_candidate = path.resolve(base_directory, candidate);
    for (const root of roots) {
        const resolved_root = path.resolve(base_directory, root);
        const real_root = realPathIfPresent(resolved_root, 'directory');
        if (!real_root) continue;

        const relative_candidate = path.relative(resolved_root, resolved_candidate);
        const real_relative_candidate = path.relative(real_root, resolved_candidate);
        const under_resolved_root = relative_candidate !== '..' && !relative_candidate.startsWith(`..${path.sep}`) && !path.isAbsolute(relative_candidate);
        const under_real_root = real_relative_candidate !== '..' && !real_relative_candidate.startsWith(`..${path.sep}`) && !path.isAbsolute(real_relative_candidate);
        if (!under_resolved_root && !under_real_root) continue;

        if (fs.existsSync(resolved_candidate)) {
            const real_candidate = realPathIfPresent(resolved_candidate, 'file');
            if (real_candidate && isWithinRoot(real_candidate, real_root)) return real_candidate;
            continue;
        }

        const real_parent = realPathIfPresent(path.dirname(resolved_candidate), 'directory');
        if (real_parent && isWithinRoot(real_parent, real_root)) return path.join(real_parent, path.basename(resolved_candidate));
    }

    return null;
};
