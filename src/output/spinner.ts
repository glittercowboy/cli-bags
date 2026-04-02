import ora, { type Ora } from 'ora';

let current: Ora | null = null;

export function spin(text: string): Ora {
  if (current?.isSpinning) current.stop();
  current = ora(text).start();
  return current;
}

export function succeed(text?: string): void {
  current?.succeed(text);
  current = null;
}

export function fail(text?: string): void {
  current?.fail(text);
  current = null;
}

export function stop(): void {
  current?.stop();
  current = null;
}
