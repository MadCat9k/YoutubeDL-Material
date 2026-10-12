/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

export type ClearDownloadsRequest = {
    /**
     * Clears only successfully completed downloads, retaining failures and cancellations
     */
    clear_completed?: boolean;
    clear_finished?: boolean;
    clear_paused?: boolean;
    clear_errors?: boolean;
};
