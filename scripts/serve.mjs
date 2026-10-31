import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
const root = path.resolve(process.cwd());
const port = Number(process.env.PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root + path.sep) || pathname.split('/').some(s => s.startsWith('.') && s.length > 1)) { res.writeHead(403).end(); return; }
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    if (!(await stat(target)).isFile()) { res.writeHead(404).end(); return; }
    const content = await readFile(target);
    res.writeHead(200, {'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control':'no-cache'});
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404).end('找不到檔案'); }
});
server.on('error', error => {
  console.error(`無法啟動預覽：${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${server.address().port}`;
  console.log(`本地預覽：${url}`);
  console.log('請保留此視窗；按 Ctrl+C 或關閉視窗即可結束預覽。');
  if (process.argv.includes('--open')) {
    const browser = process.platform === 'win32'
      ? spawn('rundll32.exe', ['url.dll,FileProtocolHandler', url], { windowsHide: true, stdio: 'ignore' })
      : spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
    browser.on('error', () => console.log(`請手動在瀏覽器開啟：${url}`));
    browser.unref();
  }
});
