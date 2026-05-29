/**
 * Minimal TypeScript declarations for Google Identity Services (GIS).
 * Covers the oauth2 token client and the One Tap / ID token APIs used by the Tracker.
 */
export interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
    error?: string;
    error_description?: string;
    error_uri?: string;
}
export interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: {
        type: string;
        message: string;
    }) => void;
    prompt?: string;
}
export interface OverridableTokenClientConfig {
    prompt?: string;
    login_hint?: string;
    scope?: string;
}
export interface TokenClient {
    requestAccessToken(overrides?: OverridableTokenClientConfig): void;
}
export interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
}
export interface CredentialResponse {
    credential: string;
    select_by: string;
    clientId?: string;
}
export type PromptMomentNotification = {
    isDisplayMoment(): boolean;
    isDisplayed(): boolean;
    isNotDisplayed(): boolean;
    getNotDisplayedReason(): string;
    isSkippedMoment(): boolean;
    getSkippedReason(): string;
    isDismissedMoment(): boolean;
    getDismissedReason(): string;
};
declare global {
    interface Window {
        google?: typeof google;
    }
    namespace google {
        namespace accounts {
            namespace oauth2 {
                function initTokenClient(config: TokenClientConfig): TokenClient;
            }
            namespace id {
                function initialize(config: IdConfiguration): void;
                function prompt(momentListener?: (notification: PromptMomentNotification) => void): void;
            }
        }
    }
}
//# sourceMappingURL=gis-types.d.ts.map