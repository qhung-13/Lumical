// Local Render TLS + Vercel function fixture. The edge-owned IP header is
// simulated here; hosted spoof resistance must also be checked after deployment.
import assert from 'node:assert/strict';
import { createServer as createTLS } from 'node:https';
import { createServer, request as httpRequest } from 'node:http';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const frontend = fileURLToPath(new URL('../../frontend', import.meta.url));
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });

export async function withNextGateway(app, key, work) {
  const directory = await mkdtemp(path.join(tmpdir(), 'lumical-next-gateway-'));
  let tls, child;
  const output = [];
  try {
    const cert = path.join(directory, 'cert.pem'); const privateKey = path.join(directory, 'key.pem');
    const config = path.join(directory, 'openssl.cnf');
    await writeFile(config, '[req]\ndistinguished_name=dn\n[dn]\n');
    let openssl = process.env.OPENSSL_BIN ?? 'openssl';
    if (!process.env.OPENSSL_BIN && process.platform === 'win32') {
      const gitPath = (await promisify(execFile)('git', ['--exec-path'])).stdout.trim();
      openssl = path.resolve(gitPath, '../../../usr/bin/openssl.exe');
    }
    await promisify(execFile)(openssl, ['req', '-config', config, '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', privateKey, '-out', cert,
      '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
    const upstreamPort = app.getHttpServer().address().port;
    tls = createTLS({ cert: await readFile(cert), key: await readFile(privateKey) }, (req, res) => {
      if (req.url === '/api/v1/__gateway-fixture/cookies') {
        res.writeHead(200, { 'Set-Cookie': ['__Host-one=first; Secure; Path=/; Expires=Wed, 01 Jan 2031 00:00:00 GMT', '__Host-two=second; Secure; Path=/'], 'Content-Type': 'application/octet-stream' });
        res.end(Buffer.from([0, 255, 42])); return;
      }
      if (req.url === '/api/v1/__gateway-fixture/failure') { req.socket.destroy(); return; }
      if (req.url === '/api/v1/__gateway-fixture/redirect') { res.writeHead(302, { Location: 'https://untrusted.invalid/steal' }).end(); return; }
      const upstream = httpRequest({ hostname: '127.0.0.1', port: upstreamPort, path: req.url, method: req.method, headers: req.headers }, response => {
        res.writeHead(response.statusCode, response.headers); response.pipe(res);
      });
      upstream.on('error', () => res.writeHead(502).end()); req.pipe(upstream);
      res.once('close', () => { if (!res.writableFinished) upstream.destroy(); });
    });
    const tlsPort = await listen(tls);
    const reservation = createServer(); const nextPort = await listen(reservation); await close(reservation);
    child = spawn(process.execPath, [path.join(frontend, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(nextPort)], {
      cwd: frontend,
      env: { ...process.env, NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'production',
        BACKEND_URL: `https://127.0.0.1:${tlsPort}`, LUMICAL_GATEWAY_KEY: key, NODE_EXTRA_CA_CERTS: cert },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    child.stdout.on('data', chunk => output.push(String(chunk))); child.stderr.on('data', chunk => output.push(String(chunk)));
    let failure; child.once('error', error => { failure = error; });
    const base = `http://127.0.0.1:${nextPort}`;
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (failure || child.exitCode !== null) throw new Error('Next fixture failed to start. Build frontend first.');
      try { if ((await fetch(`${base}/api/v1/health`, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* startup */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Next production gateway startup deadline');
    await work(base);
  } finally {
    if (child && child.exitCode === null) {
      await new Promise(resolve => { child.once('exit', resolve); child.kill(); });
    }
    if (tls) await close(tls);
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith('lumical-next-gateway-'));
    await rm(directory, { recursive: true });
    assert.ok(!output.join('').includes(key), 'gateway key must never occur in Next logs');
  }
}
