/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */

import type { Subscription } from './Subscription';

export type SubscribeResponse = {
    new_sub: Subscription;
    error?: string;
    /**
     * Stable, non-sensitive reason for a failed subscription creation request. Known values are invalid_subscription_name, duplicate_subscription, subscription_metadata_unavailable, and subscription_preparation_failed.
     */
    error_code?: string;
};
