const fs = require('fs-extra');
const multer = require('multer');
const path = require('path');

const MAX_COOKIE_FILE_SIZE = 10 * 1024 * 1024;

function isWithinRoot(candidate, root) {
    const relative_path = path.relative(root, candidate);
    return relative_path !== '' && !relative_path.startsWith(`..${path.sep}`) && relative_path !== '..' && !path.isAbsolute(relative_path);
}

exports.MAX_COOKIE_FILE_SIZE = MAX_COOKIE_FILE_SIZE;

exports.createCookieUploader = (appdata_root) => multer({
    dest: appdata_root,
    limits: {
        fields: 0,
        files: 1,
        fileSize: MAX_COOKIE_FILE_SIZE
    }
}).single('cookies');

exports.installUploadedCookieFile = async (uploaded_file, appdata_root) => {
    if (!uploaded_file || typeof uploaded_file.filename !== 'string') return false;

    const upload_name = path.basename(uploaded_file.filename);
    if (upload_name !== uploaded_file.filename || !/^[0-9a-f]{32}$/.test(upload_name)) return false;

    try {
        const real_root = await fs.realpath(appdata_root);
        const real_upload = await fs.realpath(path.join(real_root, upload_name));
        const stats = await fs.stat(real_upload);
        if (!stats.isFile() || !isWithinRoot(real_upload, real_root)) return false;
        if (stats.size === 0 || stats.size > MAX_COOKIE_FILE_SIZE) {
            await fs.remove(real_upload);
            return false;
        }

        await fs.chmod(real_upload, 0o600);
        await fs.move(real_upload, path.join(real_root, 'cookies.txt'), {overwrite: true});
        return true;
    } catch {
        return false;
    }
};
