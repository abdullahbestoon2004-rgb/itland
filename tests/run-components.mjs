import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = await mkdtemp(join(tmpdir(), 'itland-checks-'));
try {
    const outfile = join(directory, 'components.cjs');
    await build({ entryPoints: ['tests/components.jsx'], outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [{ name: 'test-database', setup(build) {
        build.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: 'supabase-mock', namespace: 'test' }));
        build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const isSupabaseConfigured = true; export const supabase = { from(...args) { return globalThis.__newsletterTestDb.from(...args); } };' }));
    } }] });
    const result = spawnSync(process.execPath, ['--test', outfile], { stdio: 'inherit' });
    process.exitCode = result.status ?? 1;
} finally { await rm(directory, { recursive: true, force: true }); }
