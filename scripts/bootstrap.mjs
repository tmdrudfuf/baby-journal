// Fresh clone -> working dev environment.
import { execSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';

execSync('npm ci', { stdio: 'inherit' });
if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env');
  console.log('Created .env from .env.example');
}
try {
  execSync('docker info', { stdio: 'ignore' });
  console.log('Docker is running: `npm run db:start` starts local Supabase.');
} catch {
  console.log('Docker is not running: start Docker Desktop before `npm run db:start`.');
}
console.log('Done. `npm start` launches the app.');
