import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { BAGS_DIR, CONFIG_FILE } from './paths.js';
import { Config, ConfigSchema, Profile } from './schema.js';

let _profileOverride: string | undefined;

export function setProfileOverride(name: string): void {
  _profileOverride = name;
}

export function loadConfig(): Config {
  if (!existsSync(CONFIG_FILE)) {
    return ConfigSchema.parse({});
  }
  const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
  return ConfigSchema.parse(raw);
}

export function saveConfig(config: Config): void {
  if (!existsSync(BAGS_DIR)) {
    mkdirSync(BAGS_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}

export function getActiveProfile(): Profile & { name: string } {
  const config = loadConfig();
  const name = _profileOverride ?? config.activeProfile;
  const profile = config.profiles[name];
  if (!profile) {
    return { name, commitment: 'confirmed' };
  }
  return { ...profile, name };
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig();
  const profileName = _profileOverride ?? config.activeProfile;

  if (!config.profiles[profileName]) {
    config.profiles[profileName] = { commitment: 'confirmed' };
  }
  const profile = config.profiles[profileName];

  switch (key) {
    case 'api-key':
      profile.apiKey = value;
      break;
    case 'rpc-url':
      profile.rpcUrl = value;
      break;
    case 'private-key':
      profile.privateKey = value;
      break;
    case 'commitment':
      if (!['processed', 'confirmed', 'finalized'].includes(value)) {
        throw new Error(
          `Invalid commitment: ${value}. Must be processed, confirmed, or finalized.`,
        );
      }
      profile.commitment = value as Profile['commitment'];
      break;
    case 'active-profile':
      config.activeProfile = value;
      saveConfig(config);
      return;
    default:
      throw new Error(
        `Unknown config key: ${key}. Valid keys: api-key, rpc-url, private-key, commitment, active-profile`,
      );
  }

  saveConfig(config);
}
