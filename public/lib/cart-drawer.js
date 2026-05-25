/**
 * cart-drawer.js — Mini-cart drawer + WooCommerce Store API cart helpers.
 * Depends on lib/wc-api.js (must be loaded first).
 * Exposes window.ppCart for use in page scripts.
 */
(function () {
  'use strict';

  var wcApi = window.wcApi;
  if (!wcApi) { console.error('[ppCart] wc-api.js must be loaded first'); return; }

  // ── FORMAT PRICE (cents → dollars, same pattern as product.html) ──────
  function formatPrice(minorUnitStr, minorUnitDigits, currencySymbol) {
    if (minorUnitDigits === undefined) minorUnitDigits = 2;
    if (!currencySymbol) currencySymbol = '$';
    var cents = parseInt(minorUnitStr, 10);
    if (isNaN(cents)) return currencySymbol + '0.00';
    return currencySymbol + (cents / Math.pow(10, minorUnitDigits)).toFixed(minorUnitDigits);
  }

  // ── TOKEN MANAGEMENT ──────────────────────────────────────────────────
  // ensureToken guarantees a Cart-Token exists in localStorage before any
  // mutation. If one is cached, returns immediately. Otherwise awaits
  // GET /cart and VERIFIES the token landed in storage before resolving.
  // Rejects on failure so callers' catch blocks fire (never resolves
  // without a token). Retries once to cover transient hiccups.
  // Concurrent callers share one in-flight promise; it is cleared on
  // both resolve and reject so the next call can retry fresh.
  var _tokenPromise = null;

  function _attemptGetToken(attemptsLeft) {
    return wcApi.wcGet('cart').then(
      function () {
        // Verify the token was actually captured into localStorage
        if (wcApi.getStoredCartToken()) return;
        // Token missing despite a successful GET — retry once
        if (attemptsLeft > 1) return _attemptGetToken(attemptsLeft - 1);
        throw new Error('Cart token not received after GET /cart');
      },
      function (err) {
        // Network or proxy failure — retry once
        if (attemptsLeft > 1) return _attemptGetToken(attemptsLeft - 1);
        throw err;
      }
    );
  }

  function ensureToken() {
    if (wcApi.getStoredCartToken()) return Promise.resolve();
    if (_tokenPromise) return _tokenPromise;
    _tokenPromise = _attemptGetToken(2).finally(function () {
      _tokenPromise = null;
    });
    return _tokenPromise;
  }

  // ── CART STATE ────────────────────────────────────────────────────────
  var _cart = null; // last known full cart object

  function broadcastCount(cart) {
    var count = cart ? cart.items_count : 0;
    window.dispatchEvent(new CustomEvent('pp:cart-updated', { detail: count }));
  }

  // ── CART API HELPERS ──────────────────────────────────────────────────

  async function getCart() {
    var cart = await wcApi.wcGet('cart');
    _cart = cart;
    broadcastCount(cart);
    return cart;
  }

  async function addToCart(id, qty) {
    await ensureToken();
    var cart = await wcApi.wcPost('cart/add-item', { id: id, quantity: qty || 1 });
    _cart = cart;
    broadcastCount(cart);
    renderDrawer(cart);
    openDrawer();
    return cart;
  }

  async function updateQuantity(key, qty) {
    await ensureToken();
    var cart = await wcApi.wcPost('cart/update-item', { key: key, quantity: qty });
    _cart = cart;
    broadcastCount(cart);
    renderDrawer(cart);
    return cart;
  }

  async function removeFromCart(key) {
    await ensureToken();
    var cart = await wcApi.wcPost('cart/remove-item', { key: key });
    _cart = cart;
    broadcastCount(cart);
    renderDrawer(cart);
    return cart;
  }

  // ── DRAWER INJECTION ──────────────────────────────────────────────────

  function injectDrawer() {
    // CSS
    var style = document.createElement('style');
    style.textContent = [
      '.cd-backdrop{position:fixed;inset:0;z-index:9998;background:rgba(20,8,9,.6);backdrop-filter:blur(4px);opacity:0;pointer-events:none;transition:opacity 300ms cubic-bezier(.22,1,.36,1)}',
      '.cd-backdrop.open{opacity:1;pointer-events:auto}',
      '.cd-drawer{position:fixed;top:0;right:0;bottom:0;z-index:9999;width:min(420px,92vw);background:var(--white,#fff);box-shadow:-8px 0 40px rgba(47,58,52,.15);transform:translateX(100%);transition:transform 400ms cubic-bezier(.22,1,.36,1);display:flex;flex-direction:column}',
      '.cd-drawer.open{transform:translateX(0)}',
      '.cd-header{display:flex;align-items:center;justify-content:space-between;padding:1.4rem 1.5rem;border-bottom:1px solid var(--line-soft,rgba(47,58,52,.06))}',
      '.cd-title{font-family:var(--font-display,"Cormorant Garamond",serif);font-size:1.4rem;font-weight:400;color:var(--forest,#2F3A34)}',
      '.cd-count-pill{font-family:var(--font-mono,"DM Mono",monospace);font-size:.6rem;letter-spacing:.14em;color:var(--ink-muted,#5B6560);margin-left:.6rem}',
      '.cd-close{width:36px;height:36px;border-radius:50%;background:var(--cream-soft,#F2EEE5);border:none;cursor:pointer;display:grid;place-items:center;font-size:1.1rem;color:var(--ink-muted,#5B6560);transition:background 200ms}',
      '.cd-close:hover{background:var(--cream,#E7E1D6)}',
      '.cd-items{flex:1;overflow-y:auto;padding:1rem 1.5rem;scrollbar-width:thin;scrollbar-color:var(--copper-med,#934225) transparent}',
      '.cd-items::-webkit-scrollbar{width:4px}',
      '.cd-items::-webkit-scrollbar-thumb{background:var(--copper-med,#934225);border-radius:2px}',
      '.cd-item{display:grid;grid-template-columns:72px 1fr;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--line-soft,rgba(47,58,52,.06))}',
      '.cd-item:last-child{border-bottom:none}',
      '.cd-item-img{width:72px;height:72px;border-radius:8px;overflow:hidden;background:var(--cream-soft,#F2EEE5)}',
      '.cd-item-img img{width:100%;height:100%;object-fit:cover}',
      '.cd-item-details{display:flex;flex-direction:column;gap:.3rem;min-width:0}',
      '.cd-item-name{font-family:var(--font-body,"DM Sans",sans-serif);font-size:.88rem;font-weight:500;color:var(--forest,#2F3A34);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cd-item-variant{font-family:var(--font-mono,"DM Mono",monospace);font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;color:var(--copper-med,#934225)}',
      '.cd-item-price{font-family:var(--font-mono,"DM Mono",monospace);font-size:.75rem;color:var(--ink-muted,#5B6560)}',
      '.cd-item-actions{display:flex;align-items:center;gap:.6rem;margin-top:.3rem}',
      '.cd-qty-btn{width:26px;height:26px;border-radius:50%;border:1px solid var(--line,rgba(47,58,52,.12));background:var(--white,#fff);cursor:pointer;display:grid;place-items:center;font-size:.8rem;color:var(--forest,#2F3A34);transition:all 200ms}',
      '.cd-qty-btn:hover{border-color:var(--forest,#2F3A34);background:var(--cream-soft,#F2EEE5)}',
      '.cd-qty-btn:disabled{opacity:.4;cursor:not-allowed}',
      '.cd-qty-num{font-family:var(--font-mono,"DM Mono",monospace);font-size:.72rem;min-width:1.5rem;text-align:center;color:var(--forest,#2F3A34)}',
      '.cd-remove{font-family:var(--font-mono,"DM Mono",monospace);font-size:.55rem;letter-spacing:.14em;text-transform:uppercase;color:var(--ink-muted,#5B6560);background:none;border:none;cursor:pointer;padding:2px 0;margin-left:auto;transition:color 200ms}',
      '.cd-remove:hover{color:var(--copper-med,#934225)}',
      '.cd-footer{padding:1.2rem 1.5rem;border-top:1px solid var(--line-soft,rgba(47,58,52,.06));background:var(--off-white,#FBFAF7)}',
      '.cd-subtotal{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:1rem}',
      '.cd-subtotal-label{font-family:var(--font-mono,"DM Mono",monospace);font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--ink-muted,#5B6560)}',
      '.cd-subtotal-price{font-family:var(--font-display,"Cormorant Garamond",serif);font-size:1.4rem;color:var(--forest,#2F3A34)}',
      '.cd-checkout{width:100%;padding:1.1rem 2rem;background:var(--forest,#2F3A34);color:var(--white,#fff);border:none;border-radius:99px;font-family:var(--font-mono,"DM Mono",monospace);font-size:.72rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;transition:all 300ms cubic-bezier(.22,1,.36,1);display:flex;align-items:center;justify-content:center;gap:.6rem}',
      '.cd-checkout:hover{background:var(--copper-med,#934225);transform:translateY(-1px)}',
      '.cd-checkout:disabled{opacity:.5;cursor:not-allowed;transform:none}',
      '.cd-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;padding:3rem 1.5rem;text-align:center}',
      '.cd-empty-icon{font-size:2.5rem;margin-bottom:1rem;opacity:.3}',
      '.cd-empty-text{font-family:var(--font-display,"Cormorant Garamond",serif);font-size:1.3rem;color:var(--forest,#2F3A34);margin-bottom:.5rem}',
      '.cd-empty-sub{font-family:var(--font-mono,"DM Mono",monospace);font-size:.65rem;letter-spacing:.14em;color:var(--ink-muted,#5B6560)}',
      '.cd-error{padding:.8rem 1rem;margin:0 1.5rem 1rem;background:#FBE9E7;border-radius:8px;font-family:var(--font-body,"DM Sans",sans-serif);font-size:.82rem;color:#B5464A;display:none}',
      '.cd-error.visible{display:block}',
      '.cd-item-loading{opacity:.5;pointer-events:none}'
    ].join('\n');
    document.head.appendChild(style);

    // HTML
    var backdrop = document.createElement('div');
    backdrop.className = 'cd-backdrop';
    backdrop.id = 'cdBackdrop';

    var drawer = document.createElement('div');
    drawer.className = 'cd-drawer';
    drawer.id = 'cdDrawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Shopping bag');
    drawer.innerHTML = [
      '<div class="cd-header">',
      '  <div><span class="cd-title">Your Bag</span><span class="cd-count-pill" id="cdItemCount"></span></div>',
      '  <button class="cd-close" id="cdClose" aria-label="Close cart">\u00d7</button>',
      '</div>',
      '<div class="cd-error" id="cdError"></div>',
      '<div class="cd-items" id="cdItems"></div>',
      '<div class="cd-footer" id="cdFooter" style="display:none">',
      '  <div class="cd-subtotal">',
      '    <span class="cd-subtotal-label">Subtotal</span>',
      '    <span class="cd-subtotal-price" id="cdSubtotal">\u2014</span>',
      '  </div>',
      '  <button class="cd-checkout" id="cdCheckout">',
      '    <span>Checkout</span>',
      '    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M0 5h13M9 1l4 4-4 4"/></svg>',
      '  </button>',
      '</div>'
    ].join('\n');

    document.body.appendChild(backdrop);
    document.body.appendChild(drawer);

    // Event listeners
    backdrop.addEventListener('click', closeDrawer);
    document.getElementById('cdClose').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer();
    });

    document.getElementById('cdCheckout').addEventListener('click', function () {
      window.location.href = '/checkout.html';
    });
  }

  // ── DRAWER OPEN / CLOSE ───────────────────────────────────────────────

  function openDrawer() {
    document.getElementById('cdBackdrop').classList.add('open');
    document.getElementById('cdDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeDrawer() {
    document.getElementById('cdBackdrop').classList.remove('open');
    document.getElementById('cdDrawer').classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── DRAWER RENDERING ──────────────────────────────────────────────────

  function renderDrawer(cart) {
    if (!cart) return;
    _cart = cart;

    var itemsEl = document.getElementById('cdItems');
    var footerEl = document.getElementById('cdFooter');
    var countEl = document.getElementById('cdItemCount');
    var subtotalEl = document.getElementById('cdSubtotal');
    var md = cart.totals.currency_minor_unit || 2;

    // Count pill
    countEl.textContent = cart.items_count > 0 ? cart.items_count + (cart.items_count === 1 ? ' item' : ' items') : '';

    if (!cart.items || cart.items.length === 0) {
      itemsEl.innerHTML = [
        '<div class="cd-empty">',
        '  <div class="cd-empty-icon">\ud83c\udf3f</div>',
        '  <div class="cd-empty-text">Your bag is empty</div>',
        '  <div class="cd-empty-sub">Add something beautiful</div>',
        '</div>'
      ].join('');
      footerEl.style.display = 'none';
      return;
    }

    footerEl.style.display = '';
    subtotalEl.textContent = formatPrice(cart.totals.total_price, md);

    itemsEl.innerHTML = cart.items.map(function (item) {
      var imd = item.prices.currency_minor_unit || md;
      var price = formatPrice(item.prices.price, imd);
      var lineTotal = formatPrice(item.totals.line_total, item.totals.currency_minor_unit || md);
      var imgSrc = item.images && item.images[0] ? item.images[0].thumbnail || item.images[0].src : '';
      var imgAlt = item.images && item.images[0] ? item.images[0].alt || item.name : item.name;
      var varLabel = '';
      if (item.variation && item.variation.length) {
        varLabel = item.variation.map(function (v) { return v.attribute + ': ' + v.value; }).join(', ');
      }

      return '<div class="cd-item" data-key="' + item.key + '">'
        + '<div class="cd-item-img">'
        + (imgSrc ? '<img src="' + imgSrc + '" alt="' + imgAlt.replace(/"/g, '&quot;') + '" />' : '')
        + '</div>'
        + '<div class="cd-item-details">'
        + '<div class="cd-item-name">' + item.name + '</div>'
        + (varLabel ? '<div class="cd-item-variant">' + varLabel + '</div>' : '')
        + '<div class="cd-item-price">' + price + (item.quantity > 1 ? ' \u00d7 ' + item.quantity + ' = ' + lineTotal : '') + '</div>'
        + '<div class="cd-item-actions">'
        + '<button class="cd-qty-btn" data-action="decrement" data-key="' + item.key + '"' + (item.quantity <= 1 ? ' disabled' : '') + '>\u2212</button>'
        + '<span class="cd-qty-num">' + item.quantity + '</span>'
        + '<button class="cd-qty-btn" data-action="increment" data-key="' + item.key + '">+</button>'
        + '<button class="cd-remove" data-action="remove" data-key="' + item.key + '">Remove</button>'
        + '</div>'
        + '</div>'
        + '</div>';
    }).join('');

    // Bind item action buttons
    itemsEl.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () { handleItemAction(btn); });
    });
  }

  // ── ITEM ACTION HANDLER ───────────────────────────────────────────────

  async function handleItemAction(btn) {
    var action = btn.dataset.action;
    var key = btn.dataset.key;
    if (!key) return;

    // Find the item row and dim it
    var row = btn.closest('.cd-item');
    if (row) row.classList.add('cd-item-loading');
    hideError();

    try {
      if (action === 'remove') {
        await removeFromCart(key);
      } else if (action === 'decrement') {
        var item = findItem(key);
        if (item && item.quantity <= 1) {
          await removeFromCart(key);
        } else if (item) {
          await updateQuantity(key, item.quantity - 1);
        }
      } else if (action === 'increment') {
        var itm = findItem(key);
        if (itm) {
          await updateQuantity(key, itm.quantity + 1);
        }
      }
    } catch (err) {
      console.error('[ppCart] Item action failed:', err);
      showError('Something went wrong. Please try again.');
      if (row) row.classList.remove('cd-item-loading');
    }
  }

  function findItem(key) {
    if (!_cart || !_cart.items) return null;
    for (var i = 0; i < _cart.items.length; i++) {
      if (_cart.items[i].key === key) return _cart.items[i];
    }
    return null;
  }

  // ── ERROR DISPLAY ─────────────────────────────────────────────────────

  function showError(msg) {
    var el = document.getElementById('cdError');
    if (el) { el.textContent = msg; el.classList.add('visible'); }
  }

  function hideError() {
    var el = document.getElementById('cdError');
    if (el) el.classList.remove('visible');
  }

  // ── SAFE ADD-TO-CART WRAPPER (for page scripts) ───────────────────────
  // Wraps addToCart with error display in the drawer so callers don't need
  // their own try/catch for UI feedback.

  async function safeAddToCart(id, qty) {
    hideError();
    try {
      return await addToCart(id, qty);
    } catch (err) {
      console.error('[ppCart] Add to cart failed:', err);
      openDrawer();
      showError('Unable to add item. Please try again.');
      throw err;
    }
  }

  // ── INIT ──────────────────────────────────────────────────────────────

  injectDrawer();

  // Load-time cart fetch for badge hydration (non-blocking — correctness
  // does NOT depend on this finishing before a customer clicks Add).
  getCart().then(function (cart) {
    renderDrawer(cart);
  }).catch(function () {
    // Silently ignore — badge stays at 0, ensureToken will retry on first add
  });

  // Hook #cartBtn on every page (handles both inline nav and partials-injected nav)
  function bindCartBtn() {
    var btn = document.getElementById('cartBtn');
    if (btn && !btn._ppCartBound) {
      btn._ppCartBound = true;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (_cart) renderDrawer(_cart);
        openDrawer();
      });
    }
  }
  bindCartBtn();
  // Re-bind after partials header loads (it replaces #cartBtn)
  window.addEventListener('pp:header-ready', bindCartBtn);

  // ── PUBLIC API ────────────────────────────────────────────────────────

  window.ppCart = {
    addToCart: safeAddToCart,
    updateQuantity: updateQuantity,
    removeFromCart: removeFromCart,
    getCart: getCart,
    open: openDrawer,
    close: closeDrawer,
    ensureToken: ensureToken
  };
})();
