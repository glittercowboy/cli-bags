import { homedir } from 'node:os';
import { join } from 'node:path';

export const BAGS_DIR = join(homedir(), '.bags');
export const CONFIG_FILE = join(BAGS_DIR, 'config.json');
