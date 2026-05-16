const WC_STORE_URL = process.env.WC_STORE_URL;
const UPSTREAM_BASE = `${WC_STORE_URL}/wp-json/wc/store/v1`;
const TIMEOUT_MS = 10000;

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE']);

// Headers to forward from the client request to WooCommerce
const FORWARD_HEADERS = [
  'content-type',
  'accept',
];

export default async function handler(req, res) {
  if (!WC_STORE_URL) {
    return res.status(500).json({ error: true, status: 500, message: 'Proxy not configured' });
  }

  const method = req.method;

  if (!ALLOWED_METHODS.has(method)) {
    return res.status(405).json({ error: true, status: 405, message: 'Method not allowed' });
  }

  // Build upstream URL from the catch-all path segments
  const pathSegments = req.query.path;
  if (!pathSegments || pathSegments.length === 0) {
    return res.status(400).json({ error: true, status: 400, message: 'Missing API path' });
  }

  const subPath = pathSegments.join('/');
  const qs = new URLSearchParams(req.query);
  qs.delete('path'); // remove the catch-all param
  const queryString = qs.toString();
  const targetUrl = `${UPSTREAM_BASE}/${subPath}${queryString ? '?' + queryString : ''}`;

  // Build headers for the upstream request
  const upstreamHeaders = {};

  for (const name of FORWARD_HEADERS) {
    if (req.headers[name]) {
      upstreamHeaders[name] = req.headers[name];
    }
  }

  // Cart-Token: client sends X-PP-Cart-Token, we forward as Cart-Token to WooCommerce
  const clientCartToken = req.headers['x-pp-cart-token'];
  if (clientCartToken) {
    upstreamHeaders['Cart-Token'] = clientCartToken;
  }

  // Nonce: client sends X-PP-WC-Nonce, we forward as X-WC-Store-API-Nonce
  const clientNonce = req.headers['x-pp-wc-nonce'];
  if (clientNonce) {
    upstreamHeaders['X-WC-Store-API-Nonce'] = clientNonce;
  }

  // Build fetch options
  const fetchOpts = {
    method,
    headers: upstreamHeaders,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };

  // Forward request body for methods that have one
  if (method === 'POST' || method === 'PUT') {
    fetchOpts.body = JSON.stringify(req.body);
    if (!upstreamHeaders['content-type']) {
      upstreamHeaders['content-type'] = 'application/json';
    }
  }

  try {
    const upstream = await fetch(targetUrl, fetchOpts);

    // Capture Cart-Token from WooCommerce response and expose as X-PP-Cart-Token
    const wcCartToken = upstream.headers.get('Cart-Token') || upstream.headers.get('cart-token');
    if (wcCartToken) {
      res.setHeader('X-PP-Cart-Token', wcCartToken);
    }

    // Capture nonce from WooCommerce response and expose as X-PP-WC-Nonce
    const wcNonce = upstream.headers.get('X-WC-Store-API-Nonce') || upstream.headers.get('x-wc-store-api-nonce');
    if (wcNonce) {
      res.setHeader('X-PP-WC-Nonce', wcNonce);
    }

    // Read body as text first, then parse — WooCommerce may return non-JSON on errors
    const bodyText = await upstream.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = { raw: bodyText };
    }

    res.setHeader('Content-Type', 'application/json');

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: true,
        status: upstream.status,
        message: body.message || 'Upstream error',
      });
    }

    return res.status(upstream.status).json(body);
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    const status = isTimeout ? 504 : 502;
    const message = isTimeout ? 'WooCommerce request timed out' : 'Could not reach WooCommerce';

    return res.status(status).json({ error: true, status, message });
  }
}
