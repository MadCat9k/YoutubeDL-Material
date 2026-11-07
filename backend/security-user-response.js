const PUBLIC_USER_FIELDS = Object.freeze([
    'uid',
    'name',
    'subscriptions',
    'created',
    'role',
    'permissions',
    'permission_overrides'
]);

exports.toPublicUser = user => {
    if (!user || typeof user !== 'object' || Array.isArray(user)) return null;

    const publicUser = {};
    for (const field of PUBLIC_USER_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(user, field)) {
            publicUser[field] = user[field];
        }
    }
    return publicUser;
};

exports.toPublicUsers = users => {
    if (!Array.isArray(users)) return [];
    return users.map(exports.toPublicUser).filter(Boolean);
};

exports.PUBLIC_USER_FIELDS = PUBLIC_USER_FIELDS;
