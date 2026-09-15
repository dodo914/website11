const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');

const root = path.resolve(__dirname, '..');
const { httpTransport, assertSafeUrl } = require(path.join(root, 'services/license/licenseRemoteTransport.js'));

// ============================================================
// ===== PART 3C: licenseRemoteTransport tests ===================
// ============================================================
// These spin up a real local HTTP server on 127.0.0.1 (no external
// network access) so we exercise the actual `fetch` call path, not a
// mock of it — this is the one place in the license test suite where
// that's appropriate, since it's the transport itself under test.

function withServer(handler, fn) {
  const server = http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', async () => {
      const { port } = server.address();
      const url = `http://127.0.0.1:${port}/api/v1/license`;
      try {
        const result = await fn(url);
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
  });
}

test('httpTransport: sends protocolVersion as a JSON number on the wire, not a string', async () => {
  let receivedBody = null;
  await withServer(
    (req, res) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        receivedBody = JSON.parse(raw);
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      });
    },
    async (url) => {
      await httpTransport({
        operation: 'VALIDATE',
        payload: { protocolVersion: '1', operation: 'VALIDATE', requestId: 'req-1', timestamp: new Date().toISOString(), licenseId: 'LIC-1' },
        url,
        timeoutMs: 2000,
      });
    }
  );

  assert.equal(typeof receivedBody.protocolVersion, 'number');
  assert.equal(receivedBody.protocolVersion, 1);
});

test('httpTransport: returns the parsed JSON response body as-is', async () => {
  const fakeEnvelope = { protocolVersion: 1, operation: 'VALIDATE', requestId: 'req-2', success: true, code: 'OK', data: {}, signature: 'sig' };
  const result = await withServer(
    (req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(fakeEnvelope));
    },
    (url) =>
      httpTransport({
        operation: 'VALIDATE',
        payload: { protocolVersion: '1', operation: 'VALIDATE', requestId: 'req-2', timestamp: new Date().toISOString(), licenseId: 'LIC-1' },
        url,
        timeoutMs: 2000,
      })
  );

  assert.deepEqual(result, fakeEnvelope);
});

test('httpTransport: a timeout aborts the request and throws (never hangs the caller)', async () => {
  await withServer(
    (req, res) => {
      // Never respond — simulate an unreachable/slow License Server.
    },
    async (url) => {
      await assert.rejects(() =>
        httpTransport({
          operation: 'VALIDATE',
          payload: { protocolVersion: '1', operation: 'VALIDATE', requestId: 'req-3', timestamp: new Date().toISOString(), licenseId: 'LIC-1' },
          url,
          timeoutMs: 100,
        })
      );
    }
  );
});

test('httpTransport: a non-JSON response body throws instead of returning garbage', async () => {
  await withServer(
    (req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('not json');
    },
    async (url) => {
      await assert.rejects(() =>
        httpTransport({
          operation: 'VALIDATE',
          payload: { protocolVersion: '1', operation: 'VALIDATE', requestId: 'req-4', timestamp: new Date().toISOString(), licenseId: 'LIC-1' },
          url,
          timeoutMs: 2000,
        })
      );
    }
  );
});

test('httpTransport: a redirect response is treated as a failure, never silently followed (SSRF hardening)', async () => {
  await withServer(
    (req, res) => {
      res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
      res.end();
    },
    async (url) => {
      await assert.rejects(() =>
        httpTransport({
          operation: 'VALIDATE',
          payload: { protocolVersion: '1', operation: 'VALIDATE', requestId: 'req-5', timestamp: new Date().toISOString(), licenseId: 'LIC-1' },
          url,
          timeoutMs: 2000,
        })
      );
    }
  );
});

test('assertSafeUrl: rejects non-http(s) schemes', () => {
  assert.throws(() => assertSafeUrl('file:///etc/passwd'));
  assert.throws(() => assertSafeUrl('ftp://example.com'));
  assert.throws(() => assertSafeUrl('not a url'));
});

test('assertSafeUrl: accepts http/https URLs', () => {
  assert.doesNotThrow(() => assertSafeUrl('https://license.example.com/api/v1/license'));
  assert.doesNotThrow(() => assertSafeUrl('http://127.0.0.1:4000/api/v1/license'));
});
