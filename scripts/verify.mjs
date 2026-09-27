// Milestone gate: lint -> typecheck -> unit tests. Cross-platform (Windows + CI).
import { execSync } from 'node:child_process';

for (const cmd of ['npx expo lint', 'npx tsc --noEmit', 'npx jest --ci']) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}
console.log('\nverify: OK');
