const PUBLIC_CONFIG_FIELDS = Object.freeze({
    Downloader: Object.freeze([
        'path-audio',
        'path-video',
        'use_youtubedl_archive',
        'custom_args'
    ]),
    Extra: Object.freeze([
        'title_top',
        'file_manager_enabled',
        'allow_quality_select',
        'download_only_mode',
        'force_autoplay',
        'enable_downloads_manager',
        'enable_notifications'
    ]),
    API: Object.freeze([
        'use_youtube_API',
        'youtube_API_key'
    ]),
    Themes: Object.freeze([
        'default_theme',
        'allow_theme_change'
    ]),
    Subscriptions: Object.freeze([
        'allow_subscriptions',
        'subscriptions_base_path'
    ]),
    Users: Object.freeze([
        'allow_registration'
    ]),
    Advanced: Object.freeze([
        'default_downloader',
        'multi_user_mode',
        'allow_advanced_download',
        'use_default_downloading_agent',
        'custom_downloading_agent'
    ])
});

function copyAllowedFields(source, fields) {
    const result = {};
    if (!source || typeof source !== 'object' || Array.isArray(source)) return result;

    for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(source, field)) {
            result[field] = source[field];
        }
    }
    return result;
}

exports.toPublicConfig = configFile => {
    const config = configFile && configFile.YoutubeDLMaterial;
    if (!config || typeof config !== 'object' || Array.isArray(config)) return null;

    const publicConfig = {};
    for (const [section, fields] of Object.entries(PUBLIC_CONFIG_FIELDS)) {
        publicConfig[section] = copyAllowedFields(config[section], fields);
    }

    return {YoutubeDLMaterial: publicConfig};
};

exports.PUBLIC_CONFIG_FIELDS = PUBLIC_CONFIG_FIELDS;
