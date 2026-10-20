import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
function privatePwa() {
  return {
    name: 'cashbook-private-pwa',
    apply: 'build',
    async closeBundle() {
      const dist = fileURLToPath(new URL('./dist', import.meta.url));
      const paths = (await readdir(dist, { recursive: true }))
        .filter((p) => /\.(js|css|html|svg|png|woff2|webmanifest)$/.test(p) && p !== 'sw.js')
        .map((p) => `/${p.replaceAll('\\', '/')}`)
        .sort();
      const hash = createHash('sha256');
      for (const asset of paths) hash.update(await readFile(path.join(dist, asset.slice(1))));
      const cache = `cashbook-static-${hash.digest('hex').slice(0, 12)}`;
      const sw = `// Public application shell only. Never cache APIs, account details or cash records.\nconst CACHE=${JSON.stringify(cache)},ASSETS=${JSON.stringify(paths)},ALLOWED=new Set(ASSETS);\nself.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));\nself.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});\nself.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('cashbook-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));\nself.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/health/'))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.open(CACHE).then(cache=>cache.match('/index.html'))));return;}if(ALLOWED.has(url.pathname)){event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(event.request)));}});\n`;
      await writeFile(path.join(dist, 'sw.js'), sw);
    },
  };
}
export default defineConfig(({ mode }) => {
  const config = loadEnv(mode, process.cwd(), '');
  const target = config.API_TARGET || 'http://127.0.0.1:4000';
  return {
    plugins: [react(), privatePwa()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: { '/api': target, '/health': target },
    },
    build: { sourcemap: false, chunkSizeWarningLimit: 600 },
    test: {
      environment: 'jsdom',
      setupFiles: ['./test/setup.js'],
      include: ['test/**/*.test.{js,jsx}'],
      pool: 'forks',
      maxWorkers: 1,
    },
  };
});
