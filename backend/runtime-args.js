/**
 * Add arguments that must be present for every invocation of a downloader.
 *
 * Keeping this in the application (instead of wrapping appdata/bin/yt-dlp)
 * means the startup updater can replace the binary without removing runtime
 * configuration.
 */
exports.addRuntimeArgs = (args, youtubedl_fork) => {
    const runtime_args = [...args];
    const impersonate_target = process.env.YTDLP_IMPERSONATE;
    const has_impersonate_arg = runtime_args.some(arg => arg === '--impersonate' || arg.startsWith('--impersonate='));

    if (youtubedl_fork === 'yt-dlp' && impersonate_target && !has_impersonate_arg) {
        runtime_args.unshift('--impersonate', impersonate_target);
    }

    return runtime_args;
};
