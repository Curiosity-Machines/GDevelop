export interface DoppleConfig {
    name: string;
    build_output: string;
    entry_point: string;
    build_command?: string;
    icon?: string;
    slack?: {
        channel?: string;
    };
}
export declare function loadConfig(projectRoot: string): Promise<DoppleConfig>;
