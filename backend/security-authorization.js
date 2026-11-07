exports.createUserAuthorization = ({getConfigItem, userHasPermission, adminExists, availablePermissions = []}) => {
    async function hasSettingsPermission(req) {
        if (!req.user || typeof req.user.uid !== 'string') return false;

        try {
            return await userHasPermission(req.user.uid, 'settings');
        } catch {
            return false;
        }
    }

    async function requireSettingsPermission(req, res, next) {
        if (!getConfigItem('ytdl_multi_user_mode')) return next();
        if (!req.user) return res.sendStatus(401);
        if (!await hasSettingsPermission(req)) return res.sendStatus(403);
        return next();
    }

    async function requireSelfOrSettings(req, res, next) {
        if (!getConfigItem('ytdl_multi_user_mode')) return next();
        if (!req.user) return res.sendStatus(401);
        if (req.body && req.body.user_uid === req.user.uid) return next();
        if (!await hasSettingsPermission(req)) return res.sendStatus(403);
        return next();
    }

    async function canRegister(req, userId) {
        if (userId === 'admin' && !await adminExists()) return true;
        if (getConfigItem('ytdl_allow_registration')) return true;
        return await hasSettingsPermission(req);
    }

    function isValidPermissionChange(permission, newValue, allowDefault = false) {
        const allowedValues = allowDefault ? ['default', 'yes', 'no'] : ['yes', 'no'];
        return availablePermissions.includes(permission) && allowedValues.includes(newValue);
    }

    return {
        requireSettingsPermission,
        requireSelfOrSettings,
        canRegister,
        isValidPermissionChange
    };
};
