#!/usr/bin/env node
/**
 * Local proxy for mobile II auth.
 * Forwards requests to localhost:8000 with Host: localhost:8000 (so IC gateway accepts).
 * Rewrites Location headers in responses so redirects stay on the proxy URL.
 */
const http = require('http');

const TARGET_HOST = 'localhost';
const TARGET_PORT = 8000;
const PORTS_TO_TRY = [9180, 9181, 9182, 8082, 8083];

function startServer(port) {
  const server = http.createServer((clientReq, clientRes) => {
    const clientHost = clientReq.headers.host || `localhost:${port}`;
    const upstreamHost = `${TARGET_HOST}:${TARGET_PORT}`;

    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: upstreamHost,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      if (headers.location) {
        headers.location = headers.location
          .replace(/https?:\/\/localhost(:\d+)?/gi, `http://${clientHost}`)
          .replace(/https?:\/\/127\.0\.0\.1(:\d+)?/g, `http://${clientHost}`);
      }
      clientRes.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(clientRes);
    });

    proxyReq.on('error', (err) => {
      console.error('Proxy error:', err.message);
      clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
      clientRes.end('Bad Gateway: could not reach localhost:8000. Is dfx running?');
    });

    clientReq.pipe(proxyReq);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && PORTS_TO_TRY.length > 0) {
      startServer(PORTS_TO_TRY.shift());
    } else {
      console.error('Failed to start proxy:', err.message);
      process.exit(1);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const os = require('os');
    const ifaces = os.networkInterfaces();
    let lanIp = '?';
    for (const name of Object.keys(ifaces)) {
      for (const iface of ifaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          lanIp = iface.address;
          break;
        }
      }
      if (lanIp !== '?') break;
    }
    const url = `http://${lanIp}:${port}`;
    console.log('');
    console.log('Mobile II proxy running');
    console.log('──────────────────────');
    console.log(`  Set DEV_HOST_OVERRIDE = '${url}'`);
    console.log('  in mobile_app/src/config/canisters.ts');
    console.log('');
    console.log('  Phone and Mac must be on the same Wi‑Fi.');
    console.log('');
  });
}

startServer(PORTS_TO_TRY.shift());
