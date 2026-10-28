/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Category } from './Category';

export type DatabaseFile = {
    id: string;
    title: string;
    /**
     * Backup if thumbnailPath is not defined
     */
    thumbnailURL: string;
    thumbnailPath?: string;
    isAudio: boolean;
    /**
     * In seconds
     */
    duration: number;
    /**
     * Whether duration was read from the finished media file
     */
    duration_verified?: boolean;
    /**
     * Whether extractor metadata differed materially from the finished media file
     */
    duration_mismatch?: boolean;
    url: string;
    uploader: string;
    /**
     * In bytes
     */
    size: number;
    path: string;
    upload_date: string;
    uid: string;
    user_uid?: string;
    sharingEnabled?: boolean;
    category?: Category;
    view_count?: number;
    local_view_count?: number;
    sub_id?: string;
    registered?: number;
    /**
     * In pixels, only for videos
     */
    height?: number;
    /**
     * In Kbps
     */
    abr?: number;
    favorite: boolean;
};
