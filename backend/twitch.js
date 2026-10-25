const config_api = require('./config');
const logger = require('./logger');

const moment = require('moment');
const fs = require('fs-extra')
const path = require('path');
const { promisify } = require('util');
const child_process = require('child_process');
const commandExistsSync = require('command-exists').sync;
const media_paths = require('./media-paths');

async function getCommentsForVOD(vodId) {
    const exec = promisify(child_process.exec);
    
    // Reject invalid params to prevent command injection attack
    if (!vodId.match(/^[0-9a-z]+$/)) {
        logger.error('VOD ID must be purely alphanumeric. Twitch chat download failed!');
        return null;
    }

    const is_windows = process.platform === 'win32';
    const cliExt = is_windows ? '.exe' : ''
    const cliPath = `TwitchDownloaderCLI${cliExt}`

    if (!commandExistsSync(cliPath)) {
        logger.error(`${cliPath} does not exist. Twitch chat download failed! Get it here: https://github.com/lay295/TwitchDownloader`);
        return null;
    }

    const result = await exec(`${cliPath} chatdownload -u ${vodId} -o appdata/${vodId}.json`, {stdio:[0,1,2]});

    if (result['stderr']) {
        logger.error(`Failed to download twitch comments for ${vodId}`);
        logger.error(result['stderr']);
        return null;
    }

    const temp_chat_path = path.join('appdata', `${vodId}.json`);

    const raw_json = fs.readJSONSync(temp_chat_path);
    const new_json = raw_json.comments.map(comment_obj => {
        return {
            timestamp: comment_obj.content_offset_seconds,
            timestamp_str: convertTimestamp(comment_obj.content_offset_seconds),
            name: comment_obj.commenter.name,
            message: comment_obj.message.body,
            user_color: comment_obj.message.user_color
        }
    });

    fs.unlinkSync(temp_chat_path);

    return new_json;
}

async function getTwitchChatByFileID(id, type, user_uid, uuid, sub) {
    const file_path = resolveTwitchChatPath(id, type, user_uid, sub, null, true);
    return file_path ? fs.readJSONSync(file_path) : null;
}

function isSafePathSegment(value) {
    return typeof value === 'string' && value.length > 0 && value !== '.' && value !== '..'
        && !value.includes('/') && !value.includes('\\') && !value.includes('\0');
}

function resolveTwitchChatPath(id, type, user_uid, sub, customFileFolderPath = null, mustExist = false) {
    if (!isSafePathSegment(id) || (!customFileFolderPath && type !== 'audio' && type !== 'video')) return null;
    if (user_uid && !isSafePathSegment(user_uid)) return null;
    if (sub && (!isSafePathSegment(sub.name) || typeof sub.isPlaylist !== 'boolean')) return null;

    const usersFileFolder = config_api.getConfigItem('ytdl_users_base_path');
    const subscriptionsFileFolder = config_api.getConfigItem('ytdl_subscriptions_base_path');
    let file_path = null;
    let allowed_roots = null;

    if (customFileFolderPath) {
        file_path = path.join(customFileFolderPath, `${id}.twitch_chat.json`);
        allowed_roots = [customFileFolderPath];
    } else if (user_uid) {
        if (sub) {
            file_path = path.join(usersFileFolder, user_uid, 'subscriptions', sub.isPlaylist ? 'playlists' : 'channels', sub.name, `${id}.twitch_chat.json`);
        } else {
            file_path = path.join(usersFileFolder, user_uid, type, `${id}.twitch_chat.json`);
        }
        allowed_roots = [usersFileFolder];
    } else {
        if (sub) {
            file_path = path.join(subscriptionsFileFolder, sub.isPlaylist ? 'playlists' : 'channels', sub.name, `${id}.twitch_chat.json`);
            allowed_roots = [subscriptionsFileFolder];
        } else {
            const typeFolder = config_api.getConfigItem(`ytdl_${type}_folder_path`);
            file_path = path.join(typeFolder, `${id}.twitch_chat.json`);
            allowed_roots = [typeFolder];
        }
    }

    return mustExist
        ? media_paths.resolveExistingMediaFile(file_path, allowed_roots)
        : media_paths.resolveMediaOutputFile(file_path, allowed_roots);
}

async function downloadTwitchChatByVODID(vodId, id, type, user_uid, sub, customFileFolderPath = null) {
    const file_path = resolveTwitchChatPath(id, type, user_uid, sub, customFileFolderPath);
    if (!file_path) {
        logger.warn('Refusing to write Twitch chat outside configured media roots.');
        return null;
    }

    const chat = await getCommentsForVOD(vodId);
    if (chat) fs.writeJSONSync(file_path, chat);

    return chat;
}

const convertTimestamp = (timestamp) => moment.duration(timestamp, 'seconds')
                    .toISOString()
                    .replace(/P.*?T(?:(\d+?)H)?(?:(\d+?)M)?(?:(\d+).*?S)?/,
                        (_, ...ms) => {
                            const seg = v => v ? v.padStart(2, '0') : '00';
                            return `${seg(ms[0])}:${seg(ms[1])}:${seg(ms[2])}`;
});

module.exports = {
    getCommentsForVOD: getCommentsForVOD,
    getTwitchChatByFileID: getTwitchChatByFileID,
    downloadTwitchChatByVODID: downloadTwitchChatByVODID,
    resolveTwitchChatPath: resolveTwitchChatPath
}
