import { spawnSync } from 'node:child_process';
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', 'test/api.test.js'], {
  stdio: 'inherit',
  env: { ...process.env, TEST_TOPOLOGY: 'replica' },
});
process.exit(result.status ?? 1);
