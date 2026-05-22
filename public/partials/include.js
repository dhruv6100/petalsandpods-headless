/*  ================================================================
    PARTIALS LOADER — include.js
    Fetches /partials/header.html and /partials/footer.html,
    injects them into <div id="site-header"> and <div id="site-footer">,
    then re-attaches event handlers and fires ready events.
    Load with: <script src="/partials/include.js" defer></script>
    ================================================================ */
(function () {
  'use strict';
  if (window.__partialsLoaded) return;
  window.__partialsLoaded = true;

  /* ── helpers ──────────────────────────────────────────────────── */

  function fire(name) {
    window.dispatchEvent(new CustomEvent(name));
  }

  async function fetchPartial(url) {
    try {
      var r = await fetch(url);
      if (!r.ok) throw new Error(url + ' → ' + r.status);
      return await r.text();
    } catch (err) {
      console.error('[partials] Failed to load ' + url, err);
      return null;
    }
  }

  /* ── cart badge ───────────────────────────────────────────────── */

  function syncCartBadge() {
    var el = document.getElementById('cartCount');
    if (!el) return;
    var n = parseInt(localStorage.getItem('pp_cart_count') || '0', 10) || 0;
    el.textContent = n > 99 ? '99+' : String(n);
    el.style.display = n > 0 ? 'inline-block' : 'none';
  }

  /* ── mobile menu ─────────────────────────────────────────────── */

  function bindMobileMenu() {
    var menuBtn    = document.getElementById('menuBtn');
    var mobileMenu = document.getElementById('mobileMenu');
    var mobileClose = document.getElementById('mobileClose');
    if (!menuBtn || !mobileMenu) return;

    var openMenu = function () {
      mobileMenu.classList.add('open');
      mobileMenu.setAttribute('aria-hidden', 'false');
    };
    var closeMenu = function () {
      mobileMenu.classList.remove('open');
      mobileMenu.setAttribute('aria-hidden', 'true');
    };

    menuBtn.addEventListener('click', openMenu);
    if (mobileClose) mobileClose.addEventListener('click', closeMenu);
    mobileMenu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeMenu);
    });
  }

  /* ── announcement bar dismiss ────────────────────────────────── */

  function bindAnnouncementBar() {
    var bar = document.getElementById('mothersBar');
    if (!bar) return;
    var btn = bar.querySelector('button[aria-label="Close"]');
    if (btn) {
      btn.addEventListener('click', function () {
        bar.style.display = 'none';
      });
    }
  }

  /* ── active nav link ─────────────────────────────────────────── */

  function markActiveNav() {
    var path = window.location.pathname;
    var hash = window.location.hash;
    var links = document.querySelectorAll('.nav-link, .mobile-links a');

    links.forEach(function (a) {
      var href = a.getAttribute('href') || '';
      var isActive = false;

      if (href.startsWith('/') && !href.startsWith('/#')) {
        isActive = path === href || path === href.replace(/\.html$/, '');
      } else if (href.startsWith('#') && hash) {
        isActive = href === hash;
      }

      a.classList.toggle('is-active', isActive);
    });
  }

  /* ── inject partials ─────────────────────────────────────────── */

  async function init() {
    var headerTarget = document.getElementById('site-header');
    var footerTarget = document.getElementById('site-footer');

    var jobs = [];
    if (headerTarget && !headerTarget.dataset.loaded) jobs.push({ target: headerTarget, url: '/partials/header.html', event: 'pp:header-ready' });
    if (footerTarget && !footerTarget.dataset.loaded) jobs.push({ target: footerTarget, url: '/partials/footer.html', event: 'pp:footer-ready' });

    if (jobs.length === 0 && !document.getElementById('site-popup')) return;

    var results = await Promise.all(jobs.map(function (j) { return fetchPartial(j.url); }));

    jobs.forEach(function (j, i) {
      if (results[i] === null) return;
      j.target.innerHTML = results[i];
      j.target.dataset.loaded = '1';
      fire(j.event);
    });

    /* Re-attach handlers after header HTML is in the DOM */
    if (headerTarget && headerTarget.dataset.loaded) {
      bindMobileMenu();
      bindAnnouncementBar();
      syncCartBadge();
      markActiveNav();
    }

    /* ── popup partial ───────────────────────────────────────────── */
    var popupTarget = document.getElementById('site-popup');
    if (popupTarget && !popupTarget.dataset.loaded) {
      var popupHTML = await fetchPartial('/partials/popup.html');
      if (popupHTML) {
        popupTarget.innerHTML = popupHTML;
        popupTarget.dataset.loaded = '1';
        var s = document.createElement('script');
        s.src = '/partials/popup.js';
        document.body.appendChild(s);
        fire('pp:popup-ready');
      }
    }

    /* Listen for cart updates from other scripts */
    window.addEventListener('pp:cart-updated', function (e) {
      if (e.detail != null) {
        try { localStorage.setItem('pp_cart_count', String(e.detail)); } catch (x) {}
      }
      syncCartBadge();
    });
  }

  /* ── boot ────────────────────────────────────────────────────── */

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
