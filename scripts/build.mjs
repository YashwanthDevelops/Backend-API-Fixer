import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

execFileSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
const sha =
  process.env.TRACEFIX_DEPLOYED_SHA ??
  execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('An exact deployed SHA is required');
if (
  !process.env.TRACEFIX_DEPLOYED_SHA &&
  execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], {
    encoding: 'utf8',
  }).trim()
)
  throw new Error('Commit source changes before building a release');
writeFileSync('dist/build-manifest.json', `${JSON.stringify({ commit_sha: sha })}\n`);
