(function(){
  'use strict';

  // ── STATE ──────────────────────────────────────────────
  const state = {
    cart: null,
    stripe: null,
    elements: null,
    paymentElement: null,
    paymentReady: false,
    currentStep: 1,
    addressData: null,
  };

  // ── DOM REFS ───────────────────────────────────────────
  const $ = function(id) { return document.getElementById(id); };

  const dom = {
    loading: $('coLoading'),
    empty: $('coEmpty'),
    main: $('coMain'),
    steps: document.querySelectorAll('.co-step'),
    secAddress: $('secAddress'),
    secPayment: $('secPayment'),
    secReview: $('secReview'),
    btnContinueToPayment: $('btnContinueToPayment'),
    btnContinueToReview: $('btnContinueToReview'),
    btnPlaceOrder: $('btnPlaceOrder'),
    paymentMount: $('paymentMount'),
    paymentMountLoading: $('paymentMountLoading'),
    paymentError: $('paymentError'),
    placeOrderError: $('placeOrderError'),
    reviewAddress: $('reviewAddress'),
    reviewPayment: $('reviewPayment'),
    cartItems: $('cartItems'),
    totalSubtotal: $('totalSubtotal'),
    totalShipping: $('totalShipping'),
    totalTaxRow: $('totalTaxRow'),
    totalTax: $('totalTax'),
    totalGrand: $('totalGrand'),
    promoInput: $('promoInput'),
    btnApplyPromo: $('btnApplyPromo'),
    editButtons: document.querySelectorAll('[data-edit-step]'),
  };

  const formFields = {
    email: $('f-email'),
    first: $('f-first'),
    last: $('f-last'),
    company: $('f-company'),
    address1: $('f-address1'),
    address2: $('f-address2'),
    city: $('f-city'),
    state: $('f-state'),
    postcode: $('f-postcode'),
    country: $('f-country'),
    phone: $('f-phone'),
  };

  // ── HELPERS ────────────────────────────────────────────
  function formatPrice(minorUnitStr) {
    var cents = parseInt(minorUnitStr, 10);
    if (isNaN(cents)) return '—';
    return '$' + (cents / 100).toFixed(2);
  }

  function showStep(n) {
    state.currentStep = n;
    dom.secAddress.hidden = n !== 1;
    dom.secPayment.hidden = n !== 2;
    dom.secReview.hidden = n !== 3;
    dom.steps.forEach(function(el) {
      var step = parseInt(el.dataset.step, 10);
      el.classList.toggle('is-active', step === n);
      el.classList.toggle('is-done', step < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── CART LOADING ───────────────────────────────────────
  async function loadCart() {
    try {
      const cart = await window.wcApi.wcGet('cart');
      state.cart = cart;

      if (!cart || !cart.items || cart.items.length === 0) {
        dom.loading.hidden = true;
        dom.empty.hidden = false;
        return false;
      }

      dom.loading.hidden = true;
      dom.main.hidden = false;
      renderCart();
      return true;
    } catch (err) {
      console.error('[checkout] Failed to load cart:', err);
      dom.loading.textContent = 'Unable to load your order. Please refresh.';
      return false;
    }
  }

  function renderCart() {
    const cart = state.cart;
    if (!cart) return;

    // Items
    dom.cartItems.innerHTML = cart.items.map(function(item) {
      var imgSrc = item.images && item.images[0] && item.images[0].src
        ? item.images[0].src
        : '';
      var variantText = '';
      if (item.variation && item.variation.length) {
        variantText = item.variation.map(function(v) { return v.value; }).join(' · ');
      }
      return [
        '<div class="co-line">',
        '  <div class="co-line-img">',
        imgSrc ? '<img src="' + imgSrc + '" alt="" />' : '',
        '    <span class="co-line-qty">' + item.quantity + '</span>',
        '  </div>',
        '  <div>',
        '    <div class="co-line-name">' + item.name + '</div>',
        variantText ? '<div class="co-line-variant">' + variantText + '</div>' : '',
        '  </div>',
        '  <div class="co-line-price">' + formatPrice(item.totals.line_total) + '</div>',
        '</div>'
      ].join('');
    }).join('');

    // Totals
    dom.totalSubtotal.textContent = formatPrice(cart.totals.total_items);

    var shippingCents = parseInt(cart.totals.total_shipping || '0', 10);
    dom.totalShipping.textContent = shippingCents > 0 ? formatPrice(cart.totals.total_shipping) : 'Free';

    var taxCents = parseInt(cart.totals.total_tax || '0', 10);
    if (taxCents > 0) {
      dom.totalTaxRow.hidden = false;
      dom.totalTax.textContent = formatPrice(cart.totals.total_tax);
    }

    dom.totalGrand.textContent = formatPrice(cart.totals.total_price);
  }

  // ── STRIPE INIT ────────────────────────────────────────
  async function initStripe() {
    if (state.stripe) return state.stripe;

    try {
      const configRes = await fetch('/api/wc/_stripe-config');
      if (!configRes.ok) throw new Error('config_fetch_failed');
      const config = await configRes.json();
      if (!config.publishableKey) throw new Error('no_publishable_key');

      if (typeof Stripe === 'undefined') {
        throw new Error('stripe_sdk_not_loaded');
      }

      state.stripe = Stripe(config.publishableKey);
      return state.stripe;
    } catch (err) {
      console.error('[checkout] Stripe init failed:', err);
      throw err;
    }
  }

  async function mountPaymentElement() {
    if (!state.cart) return;

    try {
      await initStripe();

      const amountCents = parseInt(state.cart.totals.total_price, 10);

      state.elements = state.stripe.elements({
        mode: 'payment',
        amount: amountCents,
        currency: 'usd',
        paymentMethodTypes: ['card'],
        appearance: {
          theme: 'flat',
          variables: {
            colorPrimary: '#934225',
            colorBackground: '#FBFAF7',
            colorText: '#1C211E',
            colorDanger: '#B5464A',
            fontFamily: 'DM Sans, -apple-system, sans-serif',
            spacingUnit: '4px',
            borderRadius: '8px',
          },
        },
      });

      state.paymentElement = state.elements.create('payment', {
        layout: 'tabs',
      });

      // Clear loading text and mount
      dom.paymentMountLoading.style.display = 'none';
      state.paymentElement.mount('#paymentMount');

      state.paymentElement.on('change', function(event) {
        state.paymentReady = event.complete;
        dom.btnContinueToReview.disabled = !event.complete;
        if (event.complete) {
          dom.paymentError.hidden = true;
        }
      });

      state.paymentElement.on('ready', function() {
        console.log('[checkout] Payment Element mounted');
      });

    } catch (err) {
      console.error('[checkout] Payment Element mount failed:', err);
      dom.paymentMountLoading.textContent = 'Unable to load. Please refresh.';
      dom.paymentError.hidden = false;
      dom.paymentError.textContent = 'Could not load the secure form. Please refresh the page or try again.';
    }
  }

  // ── FORM VALIDATION ────────────────────────────────────
  function validateField(field) {
    if (!field) return true;
    var wrapper = field.closest('.co-field');
    if (!wrapper) return true;

    var value = (field.value || '').trim();
    var isRequired = field.hasAttribute('required');
    var isValid = true;

    if (isRequired && !value) {
      isValid = false;
    } else if (field.type === 'email' && value) {
      isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    wrapper.classList.toggle('has-error', !isValid);
    return isValid;
  }

  function validateAllAddressFields() {
    var allValid = true;
    Object.keys(formFields).forEach(function(key) {
      var field = formFields[key];
      if (field && field.hasAttribute('required')) {
        if (!validateField(field)) allValid = false;
      }
    });
    return allValid;
  }

  function collectAddressData() {
    return {
      email: formFields.email.value.trim(),
      first_name: formFields.first.value.trim(),
      last_name: formFields.last.value.trim(),
      company: formFields.company.value.trim(),
      address_1: formFields.address1.value.trim(),
      address_2: formFields.address2.value.trim(),
      city: formFields.city.value.trim(),
      state: formFields.state.value,
      postcode: formFields.postcode.value.trim(),
      country: formFields.country.value,
      phone: formFields.phone.value.trim(),
    };
  }

  // ── STEP NAVIGATION ────────────────────────────────────
  async function goToPayment() {
    if (!validateAllAddressFields()) {
      var firstError = document.querySelector('.co-field.has-error');
      if (firstError) firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    state.addressData = collectAddressData();
    showStep(2);
    if (!state.paymentElement) {
      await mountPaymentElement();
    }
  }

  function goToReview() {
    if (!state.paymentReady) {
      dom.paymentError.hidden = false;
      dom.paymentError.textContent = 'Please complete the form above.';
      return;
    }
    renderReview();
    showStep(3);
  }

  function renderReview() {
    var a = state.addressData;
    if (!a) return;

    var addressLines = [
      a.first_name + ' ' + a.last_name,
      a.company || null,
      a.address_1,
      a.address_2 || null,
      a.city + ', ' + a.state + ' ' + a.postcode,
      a.country === 'US' ? 'United States' : a.country,
      a.email,
      a.phone || null,
    ].filter(Boolean);

    dom.reviewAddress.innerHTML = addressLines.join('<br/>');
    dom.reviewPayment.textContent = 'Card details entered above';
  }

  function attachFieldValidation() {
    Object.keys(formFields).forEach(function(key) {
      var field = formFields[key];
      if (field) {
        field.addEventListener('blur', function() { validateField(field); });
        field.addEventListener('input', function() {
          var wrapper = field.closest('.co-field');
          if (wrapper && wrapper.classList.contains('has-error')) {
            validateField(field);
          }
        });
      }
    });
  }

  function attachStepHandlers() {
    dom.btnContinueToPayment.addEventListener('click', goToPayment);
    dom.btnContinueToReview.addEventListener('click', goToReview);
    dom.editButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        var step = parseInt(btn.dataset.editStep, 10);
        if (step >= 1 && step <= 3) showStep(step);
      });
    });
  }

  // ── PLACE ORDER (STUB FOR SUB-COMMIT 1) ────────────────
  // Real submission flow lands in sub-commit 2:
  // - stripe.createPaymentMethod() to tokenize the card
  // - POST /api/wc/checkout with billing_address + payment_method + payment_data
  // - Handle 3DS redirect if needed
  // - Redirect to /order-confirmation.html on success
  function handlePlaceOrder() {
    console.log('[checkout] Place Order clicked');
    console.log('[checkout] Address data:', state.addressData);
    console.log('[checkout] Cart total:', state.cart && state.cart.totals.total_price);
    console.log('[checkout] Stripe element ready:', state.paymentReady);
    dom.placeOrderError.hidden = false;
    dom.placeOrderError.classList.remove('is-error');
    dom.placeOrderError.classList.add('is-info');
    dom.placeOrderError.textContent = 'Submission flow lands in the next deploy. Form data captured to console.';
  }

  // ── PROMO STUB (DEFERRED) ──────────────────────────────
  function handleApplyPromo() {
    console.log('[checkout] Promo apply clicked:', dom.promoInput.value);
  }

  // ── INIT ───────────────────────────────────────────────
  async function init() {
    if (!window.wcApi || typeof window.wcApi.wcGet !== 'function') {
      console.error('[checkout] wcApi not available. Check script load order.');
      dom.loading.textContent = 'Initialization error. Please refresh.';
      return;
    }

    const cartLoaded = await loadCart();
    if (!cartLoaded) return;

    attachFieldValidation();
    attachStepHandlers();
    dom.btnPlaceOrder.addEventListener('click', handlePlaceOrder);
    dom.btnApplyPromo.addEventListener('click', handleApplyPromo);

    // Disable Continue to Review until Payment Element signals complete
    dom.btnContinueToReview.disabled = true;

    console.log('[checkout] Initialized. Cart:', state.cart.items_count, 'items, total:', formatPrice(state.cart.totals.total_price));
  }

  // Run init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
