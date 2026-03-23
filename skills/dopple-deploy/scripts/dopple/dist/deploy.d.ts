import type { DoppleConfig } from './config.js';
export interface DeployResult {
    id: string;
    name: string;
    version: number;
    manifest_url: string;
    qr_url: string;
    qr_image_path?: string;
}
/**
 * Deploy an activity to Dopple Studio.
 *
 * Three-phase deployment:
 * 1. POST metadata -> get signed upload URLs
 * 2. PUT ZIP bundle and icon to signed URLs
 * 3. POST finalize -> get manifest URL and version
 */
export declare function deploy(config: DoppleConfig, projectRoot: string, accessToken: string, nameOverride?: string): Promise<DeployResult>;
