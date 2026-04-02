import Table from 'cli-table3';
import { t } from './theme.js';

export function table(
  head: string[],
  rows: (string | number)[][],
): string {
  const tbl = new Table({
    head: head.map((h) => t.label(h)),
    style: { head: [], border: ['dim'] },
  });
  for (const row of rows) {
    tbl.push(row.map(String));
  }
  return tbl.toString();
}

export function kv(pairs: [string, string | number | undefined][]): string {
  const lines: string[] = [];
  for (const [key, val] of pairs) {
    if (val === undefined) continue;
    lines.push(`  ${t.label(key + ':')} ${t.value(String(val))}`);
  }
  return lines.join('\n');
}

export function jsonOut(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

export function redact(s: string | undefined): string {
  if (!s || s.length < 8) return '****';
  return s.slice(0, 4) + '...' + s.slice(-4);
}
