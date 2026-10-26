import Constants from 'expo-constants';

/**
 * Release info from app.json (`version`, `extra.privacyPolicyUrl`, `extra.supportEmail`).
 * Empty values mean "not set yet": the UI hides the link instead of showing a dead one.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

const nonEmpty = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export const APP_VERSION: string = Constants.expoConfig?.version ?? '';
export const PRIVACY_POLICY_URL: string | null = nonEmpty(extra.privacyPolicyUrl);
export const SUPPORT_EMAIL: string | null = nonEmpty(extra.supportEmail);
