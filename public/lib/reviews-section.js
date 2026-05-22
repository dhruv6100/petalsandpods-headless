/**
 * Shared review section: carousel, modal, video upgrade.
 * Used by both product.html and index.html.
 */
window.ppReviews = (function() {
  'use strict';

  // ── UNIVERSAL REVIEWS (from verified Amazon purchases) ───────────────
  var UNIVERSAL_REVIEWS = [
    { rating: 5, headline: 'Radiant results!', name: 'Ranjith Y.', date: 'Nov 2023', body: 'I am delighted to share my experience with this incredible face wash. Within just two weeks of regular use, I noticed a significant improvement in the texture of my skin. Rough patches were smoothed out, and dark areas visibly lightened. The results were beyond my expectations.' },
    { rating: 5, headline: 'In love with this cleanser', name: 'Javier', date: 'Dec 2023', body: 'I had my doubts looking at the ingredients. My mom used to tell me about fermented rice water for skin and hair \u2014 I could never do it on my own. Glad I found this. It works like a miracle. I use it in the morning and the glow is unbelievable.' },
    { rating: 5, headline: "Just what I've been looking for", name: 'Kate', date: 'Apr 2024', body: "So glad I found this wonderful product. I use it daily and alternate between the two formulas. My skin is brighter, softer, and more hydrated. The natural ingredients were a key factor in my decision to buy, and the scent is phenomenal. I can\u2019t stand the harsh chemical smells of most face products. The scent of these is divine." },
    { rating: 5, headline: 'Best cleanser I could ask for', name: 'Javier', date: 'Dec 2023', body: "I have sensitive skin and was very sceptical to order it. The ingredients are the reason and I am so glad I did. It changed the look of my skin right after a week's use. Glow for sure and skin feels so much more even." },
    { rating: 5, headline: 'Great', name: 'Naveen K.', date: 'Jan 2025', body: 'My 14-year-old has been using this product for a year and likes it.' },
    { rating: 5, headline: 'The cleanser my grandmother would approve of', name: 'Priya M.', date: 'Mar 2025', body: 'I grew up watching my grandmother make face packs from turmeric and gram flour. This stick is the closest modern version I\u2019ve ever tried \u2014 same warmth, same after-feel. Skin looks rested by week two.' },
    { rating: 5, headline: 'Finally something that lives up to clean beauty', name: 'Marcus T.', date: 'Feb 2025', body: 'I\u2019ve cycled through every \u2018clean\u2019 brand and most leave my skin tight or stripped. Not this. Glass Skin Miracle actually feels like food for my face. Worth every dollar.' },
    { rating: 5, headline: 'It smells like a kitchen, in the best way', name: 'Sana K.', date: 'Apr 2025', body: 'First whiff felt like home \u2014 turmeric, rose, something fermented and warm. My partner stole it from me twice. Going to need a backup.' }
  ];

  // ── CAROUSEL (auto-advance only, no visible controls) ────────────────
  function initCarousel(reviews) {
    var carousel = document.getElementById('reviewCarousel');
    var track = document.getElementById('carouselTrack');
    if (!track || !carousel) return;

    // Remove control elements if present (clean DOM)
    var prevBtn = document.getElementById('carouselPrev');
    var nextBtn = document.getElementById('carouselNext');
    var dotsEl = document.getElementById('carouselDots');
    if (prevBtn) prevBtn.remove();
    if (nextBtn) nextBtn.remove();
    if (dotsEl) dotsEl.remove();

    track.innerHTML = reviews.map(function(r) {
      var stars = '\u2605'.repeat(r.rating) + '\u2606'.repeat(5 - r.rating);
      var headlineHtml = r.headline
        ? '<h3 style="font-family:var(--font-display);font-size:1.05rem;font-weight:500;color:var(--forest);line-height:1.25;margin:0;">' + r.headline + '</h3>'
        : '';
      return '<div class="review-card">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<div style="color:var(--copper-med);font-size:.85rem;letter-spacing:.08em;">' + stars + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:.55rem;letter-spacing:.12em;color:var(--ink-muted);">' + (r.date || '') + '</div>'
        + '</div>'
        + headlineHtml
        + '<p style="font-family:var(--font-body);font-size:.82rem;color:var(--ink);line-height:1.55;margin:0;flex:1;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;">' + r.body + '</p>'
        + '<div style="height:1px;background:var(--line-soft);margin:.1rem 0;"></div>'
        + '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<div style="font-family:var(--font-body);font-size:.78rem;font-weight:500;color:var(--ink);">' + r.name + '</div>'
        + '<div style="font-family:var(--font-mono);font-size:.5rem;letter-spacing:.14em;text-transform:uppercase;color:var(--copper-med);">Verified</div>'
        + '</div>'
        + '</div>';
    }).join('');

    var cards = Array.from(track.querySelectorAll('.review-card'));
    if (!cards.length) return;

    // Smooth 600ms transition
    track.style.transition = 'transform 600ms cubic-bezier(0.22,1,0.36,1)';

    function getPerPage() {
      return window.innerWidth <= 640 ? 1 : window.innerWidth <= 900 ? 2 : 3;
    }

    var perPage = getPerPage();
    var current = 0;
    var autoTimer = null;
    var paused = false;

    function totalPages() { return Math.ceil(cards.length / perPage); }
    function isStatic() { return cards.length <= perPage; }

    function goTo(page) {
      if (isStatic()) return;
      var pages = totalPages();
      current = ((page % pages) + pages) % pages;
      var idx = Math.min(current * perPage, cards.length - 1);
      var offset = cards[idx].offsetLeft - cards[0].offsetLeft;
      track.style.transform = 'translateX(-' + offset + 'px)';
      resetAuto();
    }

    function resetAuto() {
      clearInterval(autoTimer);
      if (!paused && !isStatic()) autoTimer = setInterval(function() { goTo(current + 1); }, 5000);
    }

    carousel.addEventListener('mouseenter', function() { paused = true; clearInterval(autoTimer); });
    carousel.addEventListener('mouseleave', function() { paused = false; resetAuto(); });

    window.addEventListener('resize', function() {
      var np = getPerPage();
      if (np !== perPage) {
        perPage = np;
        if (isStatic()) {
          clearInterval(autoTimer);
          track.style.transform = 'translateX(0)';
          current = 0;
        } else {
          current = Math.min(current, totalPages() - 1);
          goTo(current);
        }
      }
    });

    // Start auto-advance if not static
    if (!isStatic()) resetAuto();
  }

  // ── REVIEW MODAL ─────────────────────────────────────────────────────
  // config: { getProductId, getProductName, getProductHandle }
  function initReviewModal(config) {
    var modal = document.getElementById('reviewModal');
    var stage1 = document.getElementById('reviewStage1');
    var stage2 = document.getElementById('reviewStage2');
    var stage3 = document.getElementById('reviewStage3');
    if (!modal || !stage1) return;

    var selectedRating = 0;
    var verifiedEmail = '';

    function openModal() {
      stage1.style.display = 'block'; stage2.style.display = 'none'; stage3.style.display = 'none';
      document.getElementById('verifyError').style.display = 'none';
      document.getElementById('submitError').style.display = 'none';
      document.getElementById('reviewEmail').value = '';
      selectedRating = 0;
      document.querySelectorAll('#ratingStars span').forEach(function(star) {
        star.style.color = 'var(--line-soft)';
      });
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }

    document.addEventListener('click', function(e) {
      if (e.target.closest && e.target.closest('#openReviewModal')) openModal();
    });
    document.getElementById('closeReviewModal').addEventListener('click', closeModal);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });

    document.getElementById('verifyEmailBtn').addEventListener('click', async function() {
      var email = document.getElementById('reviewEmail').value.trim();
      var errEl = document.getElementById('verifyError');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errEl.textContent = 'Please enter a valid email address.';
        errEl.style.display = 'block'; return;
      }
      var btn = document.getElementById('verifyEmailBtn');
      btn.disabled = true; btn.textContent = 'Verifying...';
      try {
        var res = await fetch('/api/verify-and-submit-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', email: email })
        });
        var data = await res.json();
        btn.disabled = false; btn.textContent = 'Verify & continue';
        if (data.verified) {
          verifiedEmail = email;
          stage1.style.display = 'none'; stage2.style.display = 'block';
        } else {
          errEl.innerHTML = '<strong>Become a customer to leave a review.</strong><br>We verify reviews against our subscriber list. <a href="/#subscribe" style="color:var(--copper-med);text-decoration:underline;font-weight:500;">Subscribe here</a> or purchase a product, then come back to share your experience.';
          errEl.style.display = 'block';
        }
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Verify & continue';
        errEl.textContent = 'Verification failed. Please try again.';
        errEl.style.display = 'block';
      }
    });

    document.querySelectorAll('#ratingStars span').forEach(function(s) {
      s.addEventListener('click', function() {
        selectedRating = parseInt(s.dataset.rating);
        document.querySelectorAll('#ratingStars span').forEach(function(star, i) {
          star.style.color = (i < selectedRating) ? 'var(--copper-med)' : 'var(--line-soft)';
        });
      });
    });

    document.getElementById('submitReviewBtn').addEventListener('click', async function() {
      var errEl = document.getElementById('submitError');
      errEl.style.display = 'none';
      var name = document.getElementById('reviewName').value.trim();
      var headline = document.getElementById('reviewHeadline').value.trim();
      var body = document.getElementById('reviewBody').value.trim();
      if (!selectedRating || !name || !headline || !body) {
        errEl.textContent = 'Please fill in all fields and select a rating.';
        errEl.style.display = 'block'; return;
      }
      var btn = document.getElementById('submitReviewBtn');
      btn.disabled = true; btn.textContent = 'Submitting...';
      try {
        var res = await fetch('/api/verify-and-submit-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit', email: verifiedEmail,
            review: {
              rating: selectedRating, headline: headline, body: body, name: name,
              product: config.getProductName(),
              productHandle: config.getProductHandle(),
              product_id: config.getProductId()
            }
          })
        });
        var data = await res.json();
        btn.disabled = false; btn.textContent = 'Submit review';
        if (data.success) {
          stage2.style.display = 'none'; stage3.style.display = 'block';
        } else {
          errEl.textContent = data.error || 'Submission failed. Please try again.';
          errEl.style.display = 'block';
        }
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Submit review';
        errEl.textContent = 'Submission failed. Please try again.';
        errEl.style.display = 'block';
      }
    });
  }

  // ── VIDEO UPGRADE (sound-on-click, single-play, IntersectionObserver) ─
  function initVideoUpgrade() {
    var currentlyPlaying = null;

    // Pause video when it scrolls out of view
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting && entry.target._ppVideo && !entry.target._ppVideo.paused) {
          entry.target._ppVideo.pause();
          entry.target._ppVideo.muted = true;
          var muteBtn = entry.target.querySelector('.pp-mute-toggle');
          if (muteBtn) muteBtn.remove();
          if (currentlyPlaying === entry.target) currentlyPlaying = null;
        }
      });
    }, { threshold: 0.3 });

    document.querySelectorAll('.video-card[data-video-src]').forEach(function(card) {
      var src = card.dataset.videoSrc;
      var video = document.createElement('video');
      video.src = src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:14px;cursor:pointer;';

      video.addEventListener('loadeddata', function() {
        card.querySelectorAll('.video-placeholder').forEach(function(el) { el.remove(); });
        card.appendChild(video);
        card._ppVideo = video;
        card.style.background = '#000';
        observer.observe(card);

        card.addEventListener('click', function(e) {
          // Don't handle clicks on the mute button
          if (e.target.closest('.pp-mute-toggle')) return;

          // Pause previously playing video
          if (currentlyPlaying && currentlyPlaying !== card) {
            var prevVideo = currentlyPlaying._ppVideo;
            if (prevVideo) { prevVideo.pause(); prevVideo.muted = true; }
            var prevMute = currentlyPlaying.querySelector('.pp-mute-toggle');
            if (prevMute) prevMute.remove();
          }

          if (video.paused) {
            // Play unmuted
            video.muted = false;
            video.play();
            currentlyPlaying = card;
            // Add mute toggle
            if (!card.querySelector('.pp-mute-toggle')) {
              var muteBtn = document.createElement('button');
              muteBtn.className = 'pp-mute-toggle';
              muteBtn.style.cssText = 'position:absolute;top:.6rem;right:.6rem;z-index:5;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.55);border:none;cursor:pointer;display:grid;place-items:center;color:#fff;font-size:.85rem;backdrop-filter:blur(4px);';
              muteBtn.textContent = '\uD83D\uDD0A';
              muteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                video.muted = !video.muted;
                muteBtn.textContent = video.muted ? '\uD83D\uDD07' : '\uD83D\uDD0A';
              });
              card.appendChild(muteBtn);
            }
          } else {
            // Pause
            video.pause();
            video.muted = true;
            var mb = card.querySelector('.pp-mute-toggle');
            if (mb) mb.remove();
            currentlyPlaying = null;
          }
        });
      });
    });
  }

  return {
    UNIVERSAL_REVIEWS: UNIVERSAL_REVIEWS,
    initCarousel: initCarousel,
    initReviewModal: initReviewModal,
    initVideoUpgrade: initVideoUpgrade
  };
})();
