const fs = require('fs-extra');
const path = require('path');

function isWithinRoot(candidate, root) {
    const relative_path = path.relative(root, candidate);
    return relative_path !== '' && !relative_path.startsWith(`..${path.sep}`) && relative_path !== '..' && !path.isAbsolute(relative_path);
}

exports.isValidUserID = (uid) => typeof uid === 'string'
    && uid.length > 0
    && Buffer.byteLength(uid, 'utf8') <= 255
    && uid !== '.'
    && uid !== '..'
    && !uid.includes('/')
    && !uid.includes('\\')
    && !uid.includes('\0');

exports.resolveUserDirectory = (uid, users_root, base_directory = __dirname) => {
    if (!exports.isValidUserID(uid) || typeof users_root !== 'string' || users_root.length === 0) return null;

    try {
        const resolved_root = path.resolve(base_directory, users_root);
        if (!fs.existsSync(resolved_root)) return path.join(resolved_root, uid);

        const real_root = fs.realpathSync(resolved_root);
        if (!fs.statSync(real_root).isDirectory()) return null;
        const candidate = path.join(real_root, uid);
        if (!fs.existsSync(candidate)) return candidate;

        const real_candidate = fs.realpathSync(candidate);
        return fs.statSync(real_candidate).isDirectory() && isWithinRoot(real_candidate, real_root)
            ? real_candidate
            : null;
    } catch {
        return null;
    }
};
