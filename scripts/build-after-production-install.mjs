import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

// Hostinger's Express preset installs dependencies and publishes the entry file
// without a build step. Prepare the compiled API and SSR files before publishing.
let environment = process.env.NODE_ENV;
if (!environment) {
  try { environment = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8')).NODE_ENV; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (environment === 'production') {
  console.log('Preparing the Avaruchi production application.');
  const result = spawnSync('pnpm', ['run', 'build:hostinger'], {
    cwd: new URL('../', import.meta.url), stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' },
  });
  if (result.error) throw new Error('Cannot run the production build with pnpm.');
  if (result.status !== 0) process.exitCode = result.status || 1;
}
