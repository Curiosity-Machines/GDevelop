import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
const REQUIRED_FIELDS = ['name', 'build_output', 'entry_point'];
export async function loadConfig(projectRoot) {
    const configPath = join(projectRoot, 'dopple.toml');
    let raw;
    try {
        raw = await readFile(configPath, 'utf-8');
    }
    catch {
        throw new Error(`Could not read dopple.toml at ${configPath}. Run "dopple init" to create one.`);
    }
    let parsed;
    try {
        parsed = parseToml(raw);
    }
    catch (err) {
        throw new Error(`Failed to parse dopple.toml: ${err instanceof Error ? err.message : String(err)}`);
    }
    for (const field of REQUIRED_FIELDS) {
        if (typeof parsed[field] !== 'string' || parsed[field].length === 0) {
            throw new Error(`dopple.toml: missing or empty required field "${field}"`);
        }
    }
    const config = {
        name: parsed.name,
        build_output: parsed.build_output,
        entry_point: parsed.entry_point,
    };
    if (typeof parsed.build_command === 'string') {
        config.build_command = parsed.build_command;
    }
    if (typeof parsed.icon === 'string') {
        config.icon = parsed.icon;
    }
    if (parsed.slack && typeof parsed.slack === 'object') {
        const slack = parsed.slack;
        config.slack = {};
        if (typeof slack.channel === 'string') {
            config.slack.channel = slack.channel;
        }
    }
    return config;
}
