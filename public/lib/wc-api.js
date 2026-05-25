/**
 * WooCommerce Store API client — talks to same-origin /api/wc/* proxy.
 * No dependencies (uses fetch). Works in any browser without a build step.
 */

const API_BASE = '/api/wc';
const CART_TOKEN_KEY = 'pp_cart_token';

// Cart token persists in localStorage; nonce is session-only (memory).
let _nonce = null;

function getStoredCartToken() {
  try { return localStorage.getItem(CART_TOKEN_KEY); } catch { return null; }
}

function _setCartToken(token) {
  try { localStorage.setItem(CART_TOKEN_KEY, token); } catch { /* private browsing */ }
}

function _buildHeaders() {
  var headers = { 'Content-Type': 'application/json' };
  var token = getStoredCartToken();
  if (token) headers['X-PP-Cart-Token'] = token;
  if (_nonce) headers['X-PP-WC-Nonce'] = _nonce;
  return headers;
}

function _captureTokens(response) {
  var token = response.headers.get('X-PP-Cart-Token');
  if (token) _setCartToken(token);
  var nonce = response.headers.get('X-PP-WC-Nonce');
  if (nonce) _nonce = nonce;
}

async function _request(method, path, body) {
  var url = API_BASE + '/' + path;
  var opts = { method: method, headers: _buildHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);

  var response = await fetch(url, opts);
  _captureTokens(response);

  var data = await response.json();
  if (data.error) {
    var err = new Error(data.message || 'WC API error');
    err.status = data.status || response.status;
    throw err;
  }
  return data;
}

function wcGet(path, params) {
  var qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return _request('GET', path + qs);
}

function wcPost(path, body) {
  return _request('POST', path, body);
}

// ── Product URL helper (bundle-aware) ───────────────────────────────────
var BUNDLE_SLUGS = ['the-ritual-bundle'];

function getProductUrl(productOrSlug) {
  var slug = typeof productOrSlug === 'string'
    ? productOrSlug
    : (productOrSlug.slug || productOrSlug.handle || '');
  if (BUNDLE_SLUGS.indexOf(slug) !== -1) {
    return '/bundle.html';
  }
  return '/product.html?handle=' + encodeURIComponent(slug);
}

// Expose for use in <script> tags (no module bundler)
window.wcApi = { wcGet: wcGet, wcPost: wcPost, getStoredCartToken: getStoredCartToken };
window.getProductUrl = getProductUrl;
