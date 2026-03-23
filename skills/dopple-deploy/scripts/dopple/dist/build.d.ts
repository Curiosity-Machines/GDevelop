import type { DoppleConfig } from './config.js';
/**
 * Run the configured build command (if any) and verify the output directory exists.
 */
export declare function runBuild(config: DoppleConfig, projectRoot: string): Promise<void>;
