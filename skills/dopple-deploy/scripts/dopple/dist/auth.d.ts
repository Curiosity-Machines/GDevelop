/**
 * Resolve an access token using the priority chain:
 * 1. Explicit --token flag
 * 2. DOPPLE_TOKEN env var
 * 3. ~/.dopple/auth.json refresh token
 */
export declare function resolveAuth(tokenFlag?: string): Promise<string>;
/**
 * Return the email of the currently authenticated user.
 */
export declare function whoami(tokenFlag?: string): Promise<string>;
/**
 * Login via OAuth.
 * - On desktop: opens browser, local server captures callback automatically.
 * - On headless/container: prints URL, user authenticates in any browser.
 *   The callback page shows a short code to paste back into the terminal.
 */
export declare function login(): Promise<void>;
