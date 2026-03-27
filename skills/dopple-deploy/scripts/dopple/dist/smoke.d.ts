import type { DoppleConfig } from './config.js';
/**
 * Run a Playwright smoke test against the built activity.
 * Starts a local static server, loads the entry point in headless Chromium,
 * and checks for fatal errors.
 *
 * Playwright is dynamically imported so it remains optional.
 */
export declare function runSmokeTest(config: DoppleConfig, projectRoot: string): Promise<void>;
