const fs = require('fs-extra')
const path = require('path')
const { v4: uuid } = require('uuid');

const config_api = require('./config');
const db_api = require('./db');
const archive_api = require('./archive');
const utils = require('./utils')
const logger = require('./logger');
const media_paths = require('./media-paths');

const DURATION_MISMATCH_MIN_SECONDS = 2;
const DURATION_MISMATCH_RATIO = 0.02;

exports.registerFileDB = async (file_path, type, user_uid = null, category = null, sub_id = null, cropFileSettings = null, file_object = null) => {
    if (!file_object) file_object = generateFileObject(file_path, type);
    if (!file_object) {
        logger.error(`Could not find associated JSON file for ${type} file ${file_path}`);
        return false;
    }

    utils.fixVideoMetadataPerms(file_path, type);

    // add thumbnail path
    file_object['thumbnailPath'] = utils.getDownloadedThumbnail(file_path);

    // if category exists, only include essential info
    if (category) file_object['category'] = {name: category['name'], uid: category['uid']};

    // modify duration
    if (cropFileSettings) {
        file_object['duration'] = (cropFileSettings.cropFileEnd || file_object.duration) - cropFileSettings.cropFileStart;
    }

    const duration_result = await applyMediaDuration(file_object);

    if (user_uid) file_object['user_uid'] = user_uid;
    if (sub_id) file_object['sub_id'] = sub_id;

    const file_obj = await registerFileDBManual(file_object);

    if (!duration_result.verified) {
        logger.warn(`Could not verify finished media duration for file ${file_obj.uid}.`);
    } else if (duration_result.mismatched) {
        logger.warn(`Finished media duration differs from extractor metadata for file ${file_obj.uid}.`);
    }

    // remove metadata JSON if needed
    if (!config_api.getConfigItem('ytdl_include_metadata')) {
        utils.deleteJSONFile(file_path, type)
    }

    return file_obj;
}

function durationDiffers(expected_duration, actual_duration) {
    if (!Number.isFinite(expected_duration) || expected_duration <= 0) return false;
    const tolerance = Math.max(DURATION_MISMATCH_MIN_SECONDS, expected_duration * DURATION_MISMATCH_RATIO);
    return Math.abs(expected_duration - actual_duration) > tolerance;
}

async function applyMediaDuration(file_object, media_roots = media_paths.getConfiguredMediaRoots(), probe = utils.probeMediaDuration) {
    const resolved_path = file_object && media_paths.resolveExistingMediaFile(file_object.path, media_roots);
    if (!resolved_path) return {verified: false, mismatched: false};

    let actual_duration = null;
    try {
        actual_duration = await probe(resolved_path);
    } catch (_) {
        return {verified: false, mismatched: false};
    }

    if (!Number.isFinite(actual_duration) || actual_duration <= 0) {
        return {verified: false, mismatched: false};
    }

    const expected_duration = typeof file_object.duration === 'string'
        ? utils.durationStringToNumber(file_object.duration)
        : Number(file_object.duration);
    const mismatched = file_object.duration_verified
        ? !!file_object.duration_mismatch
        : durationDiffers(expected_duration, actual_duration);
    file_object.duration = actual_duration;
    file_object.duration_verified = true;
    file_object.duration_mismatch = mismatched;

    return {verified: true, mismatched};
}

exports.repairMediaDurations = async (
    files = null,
    media_roots = media_paths.getConfiguredMediaRoots(),
    probe = utils.probeMediaDuration
) => {
    const records = files || await db_api.getRecords('files');
    const updates = {};
    const summary = {checked: records.length, updated: 0, mismatched: 0, failed: 0, playlists_updated: 0};

    for (const file of records) {
        const previous_duration = file.duration;
        const previous_verified = file.duration_verified;
        const previous_mismatch = file.duration_mismatch;
        const result = await applyMediaDuration(file, media_roots, probe);
        if (!result.verified) {
            summary.failed++;
            logger.warn(`Could not verify finished media duration for file ${file.uid}.`);
            continue;
        }

        if (result.mismatched) {
            summary.mismatched++;
            logger.warn(`Repaired media duration differs from extractor metadata for file ${file.uid}.`);
        }

        if (previous_duration !== file.duration
            || previous_verified !== file.duration_verified
            || previous_mismatch !== file.duration_mismatch) {
            updates[file.uid] = {
                duration: file.duration,
                duration_verified: file.duration_verified,
                duration_mismatch: file.duration_mismatch
            };
            summary.updated++;
        }
    }

    if (Object.keys(updates).length > 0) {
        await db_api.bulkUpdateRecordsByKey('files', 'uid', updates);
        if (!files) {
            summary.playlists_updated = await repairPlaylistDurations(Object.keys(updates));
        }
    }

    return summary;
}

exports.applyMediaDuration = applyMediaDuration;

async function repairPlaylistDurations(updated_file_uids) {
    const updated_uid_set = new Set(updated_file_uids);
    const playlists = await db_api.getRecords('playlists');
    let updated_count = 0;

    for (const playlist of playlists) {
        if (!(playlist.uids || []).some(uid => updated_uid_set.has(uid))) continue;
        const duration = await exports.calculatePlaylistDuration(playlist);
        await db_api.updateRecord('playlists', {id: playlist.id}, {duration});
        updated_count++;
    }

    return updated_count;
}

exports.repairPlaylistDurations = repairPlaylistDurations;

async function registerFileDBManual(file_object) {
    // add additional info
    file_object['uid'] = uuid();
    file_object['registered'] = Date.now();
    const path_object = path.parse(file_object['path']);
    file_object['path'] = path.format(path_object);

    await db_api.insertRecordIntoTable('files', file_object, {path: file_object['path']})

    return file_object;
}

function generateFileObject(file_path, type) {
    const jsonobj = utils.getJSON(file_path, type);
    if (!jsonobj) {
        return null;
    } else if (!jsonobj['_filename']) {
        logger.error(`Failed to get filename from info JSON! File ${jsonobj['title']} could not be added.`);
        return null;
    }
    const true_file_path = utils.getTrueFileName(jsonobj['_filename'], type);
    // console.
    const stats = fs.statSync(true_file_path);

    const file_id = utils.removeFileExtension(path.basename(file_path));
    const title = jsonobj.title;
    const url = jsonobj.webpage_url;
    const uploader = jsonobj.uploader;
    const upload_date = utils.formatDateString(jsonobj.upload_date);

    const size = stats.size;

    const thumbnail = jsonobj.thumbnail;
    const duration = jsonobj.duration;
    const isaudio = type === 'audio';
    const description = jsonobj.description;
    const file_obj = new utils.File(file_id, title, thumbnail, isaudio, duration, url, uploader, size, true_file_path, upload_date, description, jsonobj.view_count, jsonobj.height, jsonobj.abr);
    return file_obj;
}

exports.importUnregisteredFiles = async () => {
    const imported_files = [];
    const dirs_to_check = await db_api.getFileDirectoriesAndDBs();

    // run through check list and check each file to see if it's missing from the db
    for (let i = 0; i < dirs_to_check.length; i++) {
        const dir_to_check = dirs_to_check[i];
        // recursively get all files in dir's path
        const files = await utils.getDownloadedFilesByType(dir_to_check.basePath, dir_to_check.type);

        for (let j = 0; j < files.length; j++) {
            const file = files[j];

            // check if file exists in db, if not add it
            const files_with_same_url = await db_api.getRecords('files', {url: file.url, sub_id: dir_to_check.sub_id});
            const file_is_registered = !!(files_with_same_url.find(file_with_same_url => path.resolve(file_with_same_url.path) === path.resolve(file.path)));
            if (!file_is_registered) {
                // add additional info
                const file_obj = await exports.registerFileDB(file['path'], dir_to_check.type, dir_to_check.user_uid, null, dir_to_check.sub_id, null);
                if (file_obj) {
                    imported_files.push(file_obj['uid']);
                    logger.verbose(`Added discovered file to the database: ${file.id}`);
                } else {
                    logger.error(`Failed to import ${file['path']} automatically.`);
                }
            }
        }
    }
    return imported_files;
}

exports.addMetadataPropertyToDB = async (property_key) => {
    try {
        const dirs_to_check = await db_api.getFileDirectoriesAndDBs();
        const update_obj = {};
        for (let i = 0; i < dirs_to_check.length; i++) {
            const dir_to_check = dirs_to_check[i];

            // recursively get all files in dir's path
            const files = await utils.getDownloadedFilesByType(dir_to_check.basePath, dir_to_check.type, true);
            for (let j = 0; j < files.length; j++) {
                const file = files[j];
                if (file[property_key]) {
                    update_obj[file.uid] = {[property_key]: file[property_key]};
                }
            }
        }

        return await db_api.bulkUpdateRecordsByKey('files', 'uid', update_obj);
    } catch(err) {
        logger.error(err);
        return false;
    }
}

exports.createPlaylist = async (playlist_name, uids, user_uid = null) => {
    const first_video = await exports.getVideo(uids[0]);
    const thumbnailToUse = first_video['thumbnailURL'];
    
    let new_playlist = {
        name: playlist_name,
        uids: uids,
        id: uuid(),
        thumbnailURL: thumbnailToUse,
        registered: Date.now(),
        randomize_order: false
    };

    new_playlist.user_uid = user_uid ? user_uid : undefined;

    await db_api.insertRecordIntoTable('playlists', new_playlist);
    
    const duration = await exports.calculatePlaylistDuration(new_playlist);
    await db_api.updateRecord('playlists', {id: new_playlist.id}, {duration: duration});

    return new_playlist;
}

exports.getPlaylist = async (playlist_id, user_uid = null, require_sharing = false) => {
    let playlist = await db_api.getRecord('playlists', {id: playlist_id});

    if (!playlist) {
        playlist = await db_api.getRecord('categories', {uid: playlist_id});
        if (playlist) {
            const uids = (await db_api.getRecords('files', {'category.uid': playlist_id})).map(file => file.uid);
            playlist['uids'] = uids;
            playlist['auto'] = true;
        }
    }

    // converts playlists to new UID-based schema
    if (playlist && playlist['fileNames'] && !playlist['uids']) {
        playlist['uids'] = [];
        logger.verbose(`Converting playlist ${playlist['name']} to new UID-based schema.`);
        for (let i = 0; i < playlist['fileNames'].length; i++) {
            const fileName = playlist['fileNames'][i];
            const uid = await exports.getVideoUIDByID(fileName, user_uid);
            if (uid) playlist['uids'].push(uid);
            else logger.warn(`Failed to convert file with name ${fileName} to its UID while converting playlist ${playlist['name']} to the new UID-based schema. The original file is likely missing/deleted and it will be skipped.`);
        }
        exports.updatePlaylist(playlist, user_uid);
    }

    // prevent unauthorized users from accessing the file info
    if (require_sharing && !playlist['sharingEnabled']) return null;

    return playlist;
}

exports.updatePlaylist = async (playlist) => {
    let playlistID = playlist.id;

    const duration = await exports.calculatePlaylistDuration(playlist);
    playlist.duration = duration;

    return await db_api.updateRecord('playlists', {id: playlistID}, playlist);
}

exports.setPlaylistProperty = async (playlist_id, assignment_obj, user_uid = null) => {
    let success = await db_api.updateRecord('playlists', {id: playlist_id}, assignment_obj);

    if (!success) {
        success = await db_api.updateRecord('categories', {uid: playlist_id}, assignment_obj);
    }

    if (!success) {
        logger.error(`Could not find playlist or category with ID ${playlist_id}`);
    }

    return success;
}

exports.calculatePlaylistDuration = async (playlist, playlist_file_objs = null) => {
    if (!playlist_file_objs) {
        playlist_file_objs = [];
        for (let i = 0; i < playlist['uids'].length; i++) {
            const uid = playlist['uids'][i];
            const file_obj = await exports.getVideo(uid);
            if (file_obj) playlist_file_objs.push(file_obj);
        }
    }

    return playlist_file_objs.reduce((a, b) => a + utils.durationStringToNumber(b.duration), 0);
}

exports.deleteFile = async (uid, blacklistMode = false) => {
    const file_obj = await exports.getVideo(uid);
    if (!file_obj || typeof file_obj.path !== 'string') return false;

    const stored_file_path = path.resolve(__dirname, file_obj.path);
    const fileExists = await fs.pathExists(stored_file_path);
    if (!fileExists) {
        await db_api.removeRecord('files', {uid: uid});
        return true;
    }

    const file_path = media_paths.resolveExistingMediaFile(file_obj.path);
    if (!file_path) {
        logger.warn('Refusing to delete a file outside configured media roots.');
        return false;
    }

    const type = file_obj.isAudio ? 'audio' : 'video';
    const folderPath = path.dirname(file_path);
    const filePathNoExtension = utils.removeFileExtension(file_path);
    const name = path.basename(filePathNoExtension);

    var jsonPath = `${file_path}.info.json`;
    var altJSONPath = `${filePathNoExtension}.info.json`;
    var thumbnailPath = `${filePathNoExtension}.webp`;
    var altThumbnailPath = `${filePathNoExtension}.jpg`;

    jsonPath = media_paths.resolveExistingMediaFile(jsonPath);
    altJSONPath = media_paths.resolveExistingMediaFile(altJSONPath);
    thumbnailPath = media_paths.resolveExistingMediaFile(thumbnailPath);
    altThumbnailPath = media_paths.resolveExistingMediaFile(altThumbnailPath);

    if (!jsonPath) jsonPath = altJSONPath;
    if (!thumbnailPath) thumbnailPath = altThumbnailPath;

    if (config_api.descriptors[uid]) {
        try {
            for (let i = 0; i < config_api.descriptors[uid].length; i++) {
                config_api.descriptors[uid][i].destroy();
            }
        } catch(e) {

        }
    }

    let useYoutubeDLArchive = config_api.getConfigItem('ytdl_use_youtubedl_archive');
    if (useYoutubeDLArchive || file_obj.sub_id) {
        // get id/extractor from JSON

        const info_json = await (type === 'audio' ? utils.getJSONMp3(name, folderPath) : utils.getJSONMp4(name, folderPath));
        let retrievedID = null;
        let retrievedExtractor = null;
        if (info_json) {
            retrievedID = info_json['id'];
            retrievedExtractor = info_json['extractor'];
        }

        // Remove file ID from the archive file, and write it to the blacklist (if enabled)
        if (!blacklistMode) {
            await archive_api.removeFromArchive(retrievedExtractor, retrievedID, type, file_obj.user_uid, file_obj.sub_id)
        } else {
            const exists_in_archive = await archive_api.existsInArchive(retrievedExtractor, retrievedID, type, file_obj.user_uid, file_obj.sub_id);
            if (!exists_in_archive) {
                await archive_api.addToArchive(retrievedExtractor, retrievedID, type, file_obj.title, file_obj.user_uid, file_obj.sub_id);
            }
        }
    }

    if (jsonPath) await fs.unlink(jsonPath);
    if (thumbnailPath) await fs.unlink(thumbnailPath);

    await db_api.removeRecord('files', {uid: uid});

    await fs.unlink(file_path);
    if ((jsonPath && await fs.pathExists(jsonPath)) || await fs.pathExists(file_path)) {
        return false;
    } else {
        return true;
    }
}

// Video ID is basically just the file name without the base path and file extension - this method helps us get away from that
exports.getVideoUIDByID = async (file_id, uuid = null) => {
    const file_obj = await db_api.getRecord('files', {id: file_id});
    return file_obj ? file_obj['uid'] : null;
}

exports.getVideo = async (file_uid) => {
    return await db_api.getRecord('files', {uid: file_uid});
}

exports.getAllFiles = async (sort, range, text_search, file_type_filter, favorite_filter, sub_id, uuid) => {
    const filter_obj = {user_uid: uuid};
    const regex = true;
    if (text_search) {
        if (regex) {
            filter_obj['title'] = db_api.filterCondition('$regex', `.*${text_search}.*`, 'i');
        } else {
            filter_obj['$text'] = db_api.filterCondition('$text', utils.createEdgeNGrams(text_search));
        }
    }

    if (favorite_filter) {
        filter_obj['favorite'] = true;
    }

    if (sub_id) {
        filter_obj['sub_id'] = sub_id;
    }

    if (file_type_filter === 'audio_only') filter_obj['isAudio'] = true;
    else if (file_type_filter === 'video_only') filter_obj['isAudio'] = false;
    
    const files = JSON.parse(JSON.stringify(await db_api.getRecords('files', filter_obj, false, sort, range, text_search)));
    await repairThumbnailPaths(files);
    const file_count = await db_api.getRecords('files', filter_obj, true);

    return {files, file_count};
}

async function repairThumbnailPaths(files, media_roots = media_paths.getConfiguredMediaRoots()) {
    const thumbnail_updates = {};

    for (const file of files) {
        const stored_thumbnail_exists = file.thumbnailPath && media_paths.resolveExistingMediaFile(file.thumbnailPath, media_roots);
        if (stored_thumbnail_exists) continue;

        const media_file_exists = media_paths.resolveExistingMediaFile(file.path, media_roots);
        const discovered_thumbnail_path = media_file_exists ? utils.getDownloadedThumbnail(file.path) : null;
        const resolved_thumbnail_path = discovered_thumbnail_path && media_paths.resolveExistingMediaFile(discovered_thumbnail_path, media_roots)
            ? discovered_thumbnail_path
            : null;
        if (resolved_thumbnail_path === file.thumbnailPath) continue;

        file.thumbnailPath = resolved_thumbnail_path;
        thumbnail_updates[file.uid] = {thumbnailPath: resolved_thumbnail_path};
        logger.info(`Repaired thumbnail path for file ${file.uid}: ${resolved_thumbnail_path ? 'local thumbnail found' : 'no local thumbnail found'}`);
    }

    if (Object.keys(thumbnail_updates).length > 0) {
        await db_api.bulkUpdateRecordsByKey('files', 'uid', thumbnail_updates);
    }
}

exports.repairThumbnailPaths = repairThumbnailPaths;
