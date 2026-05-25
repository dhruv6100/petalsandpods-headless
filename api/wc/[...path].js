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

  // Expose custom headers so browser JS can read them on every response
  res.setHeader('Access-Control-Expose-Headers', 'X-PP-Cart-Token, X-PP-WC-Nonce');

  const method = req.method;

  if (!ALLOWED_METHODS.has(method)) {
    return res.status(405).json({ error: true, status: 405, message: 'Method not allowed' });
  }

  // Build upstream URL from the catch-all path segments
  // Vercel passes a single-segment path as a string, multi-segment as an array
  const rawPath = req.query.path;
  const pathSegments = Array.isArray(rawPath)
    ? rawPath
    : (typeof rawPath === 'string' && rawPath.length > 0 ? [rawPath] : []);
  if (pathSegments.length === 0) {
    return res.status(400).json({ error: true, status: 400, message: 'Missing API path' });
  }

  const subPath = pathSegments.join('/');

  // Rebuild query string preserving array params (e.g. include[]=1&include[]=2)
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') continue; // strip Vercel's catch-all param
    if (Array.isArray(value)) {
      for (const v of value) qs.append(key, v);
    } else {
      qs.append(key, value);
    }
  }
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

  // Forward request body for methods that carry one
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    if (req.body != null) {
      if (typeof req.body === 'string') {
        fetchOpts.body = req.body;
      } else if (typeof req.body === 'object') {
        fetchOpts.body = JSON.stringify(req.body);
        if (!upstreamHeaders['content-type']) {
          upstreamHeaders['content-type'] = 'application/json';
        }
      }
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
    // WC Store API returns nonce as 'Nonce' header; keep legacy fallbacks defensively
    const wcNonce = upstream.headers.get('Nonce')
                 || upstream.headers.get('nonce')
                 || upstream.headers.get('X-WC-Store-API-Nonce')
                 || upstream.headers.get('x-wc-store-api-nonce');
    if (wcNonce) {
      res.setHeader('X-PP-WC-Nonce', wcNonce);
      res.setHeader('X-PP-Debug-Nonce-Captured', 'true');
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
