const fs = require('fs-extra');
const path = require('path');

const backup_name_pattern = /^(?:local|remote)_db\.json\.\d+(?:\.\d+)?\.bak$/;

function isWithinRoot(candidate, root) {
    const relative_path = path.relative(root, candidate);
    return relative_path !== '' && !relative_path.startsWith(`..${path.sep}`) && relative_path !== '..' && !path.isAbsolute(relative_path);
}

exports.resolveExistingBackupFile = (file_name, backup_root) => {
    if (typeof file_name !== 'string' || file_name !== path.basename(file_name) || !backup_name_pattern.test(file_name)) return null;

    try {
        const real_root = fs.realpathSync(backup_root);
        const candidate = fs.realpathSync(path.join(real_root, file_name));
        const stats = fs.statSync(candidate);
        return stats.isFile() && isWithinRoot(candidate, real_root) ? candidate : null;
    } catch {
        return null;
    }
};
