// ============================================================
// ===== LAVA Remote License HTTP Transport (PART 3C) ============
// ============================================================
// This is the real network transport that was deliberately deferred by
// PART 2A/2B (see licenseRemoteClient.js's comments: "PART 2A عمدًا مش
// بيعمل أي HTTP request حقيقي... setRemoteTransport(fn) هي النقطة
// الوحيدة اللي Prompt 2B/2C هيحقن فيها transport الحقيقي"). The
// independent License Server project now exists with a concrete,
// stable HTTP contract, so this file implements that injection point
// for real, using Node's built-in `fetch` (no new dependency added).
//
// This module does NOT decide whether a response is trustworthy — that
// remains entirely licenseRemoteResponsePipeline.js's job (envelope
// shape, protocol version, requestId match, timestamp freshness,
// Ed25519 signature). This file's only responsibilities are:
//   1. Send the already-built request payload as JSON to the
//      configured License Server URL, with a hard timeout.
//   2. Return the parsed JSON response body as-is (whatever shape it
//      is — success or failure envelope) so the pipeline can make the
//      real trust decision.
//   3. Never leak internal transport details (raw fetch/network errors,
//      headers, stack traces) — those are summarized by
//      licenseRemoteClient.callRemote() into a single
//      RemoteLicenseUnavailableError already; this file just needs to
//      throw *something* on network/timeout/parse failure and let that
//      existing wrapping do its job.
//   4. SSRF hardening: the target URL is always operator-configured
//      (LICENSE_SERVER_URL via .env), never end-user input, but as
//      defense in depth this transport (a) only allows http/https
//      schemes and (b) does not follow redirects — a redirect response
//      is treated as a failure rather than silently followed to a
//      different host.
//
// ---- Wire-format note: protocolVersion type ----
// licenseRemoteProtocol.js's LICENSE_REMOTE_PROTOCOL_VERSION is a
// *string* ('1') by design and by existing test contract (see
// licenseRemoteProtocol.test.js) — changing that would ripple through
// many already-passing tests for no behavioral benefit. The actual
// License Server implementation (separate project) defines
// protocolVersion as a *number* (`config.protocolVersion`, parsed via
// `parseInt(...) || 1`) and does a strict `!==` comparison against the
// incoming request body. Sending the JSON string "1" would make every
// real request fail with UNSUPPORTED_PROTOCOL_VERSION even though
// nothing is actually wrong. This transport is the correct, narrow
// place to bridge that: only the bytes actually placed on the wire for
// the *request* are coerced to a number, immediately before
// JSON.stringify. Nothing about the internal request-builder contract,
// its tests, or (separately) response signature verification (which
// always uses the response's protocolVersion exactly as the server
// sent it, never coerced — see licenseRemoteResponsePipeline.js) is
// touched by this.

const ALLOWED_URL_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * @param {string} url
 * @returns {URL}
 * @throws {Error} if the URL is missing, malformed, or not http(s)
 */
function assertSafeUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (err) {
    throw new Error('licenseRemoteTransport: LICENSE_SERVER_URL is not a valid URL');
  }
  if (!ALLOWED_URL_PROTOCOLS.has(parsed.protocol)) {
    throw new Error('licenseRemoteTransport: LICENSE_SERVER_URL must be http(s)');
  }
  return parsed;
}

/**
 * The real transport function, matching the shape
 * licenseRemoteClient.js's `callRemote()` already invokes:
 * `transport({ operation, payload, url, timeoutMs })`.
 *
 * @param {{operation: string, payload: Object, url: string, timeoutMs: number}} args
 * @returns {Promise<Object>} parsed JSON response body (untrusted, not
 *   yet verified — caller must run it through
 *   licenseRemoteResponsePipeline.processRemoteResponse()).
 */
async function httpTransport({ payload, url, timeoutMs }) {
  const target = assertSafeUrl(url);

  const wirePayload = {
    ...payload,
    // See "Wire-format note" above — request-only, response bytes are
    // never touched here.
    protocolVersion: Number(payload.protocolVersion),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(target, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(wirePayload),
      signal: controller.signal,
      redirect: 'error', // SSRF hardening: never silently follow a redirect
    });
  } finally {
    clearTimeout(timer);
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    throw new Error('licenseRemoteTransport: response body was not valid JSON');
  }

  return body;
}

module.exports = { httpTransport, assertSafeUrl };
