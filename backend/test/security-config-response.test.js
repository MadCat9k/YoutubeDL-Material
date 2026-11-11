const assert = require('assert');

const config_response = require('../security-config-response');

describe('Public config response', function() {
    it('keeps only fields required by the public application bootstrap', function() {
        const configFile = {
            YoutubeDLMaterial: {
                Host: {url: 'https://internal.example', port: '17442'},
                Downloader: {
                    'path-audio': 'audio/',
                    'path-video': 'video/',
                    use_youtubedl_archive: true,
                    custom_args: '--synthetic-argument',
                    download_rate_limit: '10M'
                },
                Extra: {
                    title_top: 'Synthetic title',
                    file_manager_enabled: true,
                    allow_quality_select: true,
                    download_only_mode: false,
                    force_autoplay: false,
                    enable_downloads_manager: true,
                    enable_notifications: true,
                    allowed_notification_types: ['download']
                },
                API: {
                    use_API_key: true,
                    API_key: 'synthetic-public-api-key',
                    use_youtube_API: true,
                    youtube_API_key: 'synthetic-youtube-key',
                    webhook_URL: 'https://hooks.example/synthetic'
                },
                Themes: {default_theme: 'default', allow_theme_change: true},
                Subscriptions: {
                    allow_subscriptions: true,
                    subscriptions_base_path: 'subscriptions/',
                    subscriptions_check_interval: '86400'
                },
                Users: {
                    allow_registration: false,
                    auth_method: 'ldap',
                    ldap_config: {bindCredentials: 'synthetic-ldap-secret'}
                },
                Database: {mongodb_connection_string: 'mongodb://synthetic-secret'},
                Advanced: {
                    default_downloader: 'yt-dlp',
                    multi_user_mode: true,
                    allow_advanced_download: true,
                    use_default_downloading_agent: false,
                    custom_downloading_agent: 'synthetic-agent',
                    jwt_expiration: 3600
                }
            }
        };

        const result = config_response.toPublicConfig(configFile);

        assert.deepStrictEqual(result, {
            YoutubeDLMaterial: {
                Downloader: {
                    'path-audio': 'audio/',
                    'path-video': 'video/',
                    use_youtubedl_archive: true,
                    custom_args: '--synthetic-argument'
                },
                Extra: {
                    title_top: 'Synthetic title',
                    file_manager_enabled: true,
                    allow_quality_select: true,
                    download_only_mode: false,
                    force_autoplay: false,
                    enable_downloads_manager: true,
                    enable_notifications: true
                },
                API: {
                    use_youtube_API: true,
                    youtube_API_key: 'synthetic-youtube-key'
                },
                Themes: {default_theme: 'default', allow_theme_change: true},
                Subscriptions: {
                    allow_subscriptions: true,
                    subscriptions_base_path: 'subscriptions/'
                },
                Users: {allow_registration: false},
                Advanced: {
                    default_downloader: 'yt-dlp',
                    multi_user_mode: true,
                    allow_advanced_download: true,
                    use_default_downloading_agent: false,
                    custom_downloading_agent: 'synthetic-agent'
                }
            }
        });
        assert.strictEqual(configFile.YoutubeDLMaterial.API.API_key, 'synthetic-public-api-key');
    });

    it('rejects malformed config values without exposing input data', function() {
        assert.strictEqual(config_response.toPublicConfig(null), null);
        assert.strictEqual(config_response.toPublicConfig({YoutubeDLMaterial: []}), null);
    });
});
