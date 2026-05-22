/* ============================================================
   SHARED POPUP SCRIPT
   Auto-loaded by /partials/include.js after popup HTML injection.
   Show once per device (localStorage + cookie), then never again.
   ============================================================ */
(function(){
  var KEY = 'pp_md_popup_dismissed';
  function hasCookie(){
    return document.cookie.split(';').some(function(c){ return c.trim().indexOf(KEY + '=1') === 0; });
  }
  function setDismissed(){
    try { localStorage.setItem(KEY, '1'); } catch(e){}
    try {
      var d = new Date();
      d.setTime(d.getTime() + 365*24*60*60*1000);
      document.cookie = KEY + '=1; expires=' + d.toUTCString() + '; path=/; SameSite=Lax';
    } catch(e){}
  }
  function isDismissed(){
    try { if (localStorage.getItem(KEY) === '1') return true; } catch(e){}
    return hasCookie();
  }
  function closePopup(){
    var p = document.getElementById('mdPopup');
    if (p) p.style.display = 'none';
    setDismissed();
  }
  if (isDismissed()) return;
  setTimeout(function(){
    var p = document.getElementById('mdPopup');
    if (!p) return;
    p.style.display = 'flex';
    p.addEventListener('click', function(e){ if (e.target === p) closePopup(); });
    p.querySelectorAll('[data-md-close]').forEach(function(btn){ btn.addEventListener('click', closePopup); });
  }, 2000);

      // EMAIL CAPTURE
      var KLAVIYO_COMPANY_ID = 'QXgzpX';
      var EMAIL_LIST_ID = 'YknngE';
      var WELCOME_CODE = 'WELCOME10';
      var popupForm = document.getElementById('popupEmailForm');
      var popupInput = document.getElementById('popupEmailInput');
      var popupSubmit = document.getElementById('popupEmailSubmit');
      var popupStatus = document.getElementById('popupEmailStatus');
      var popupCTA = document.querySelector('#mdPopup a[href*="bundle.html"]');

      if (popupForm && popupInput) {
        popupForm.addEventListener('submit', async function(ev){
          ev.preventDefault();
          popupStatus.style.display = 'none';
          popupStatus.style.color = '#fff';
          var email = (popupInput.value || '').trim();
          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            popupStatus.style.display = 'block';
            popupStatus.style.color = '#FFB4B8';
            popupStatus.textContent = 'Please enter a valid email';
            return;
          }
          var originalText = popupSubmit.textContent;
          popupSubmit.textContent = 'Sending...';
          popupSubmit.disabled = true;
          try {
            var resp = await fetch('https://a.klaviyo.com/client/subscriptions/?company_id=' + KLAVIYO_COMPANY_ID, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'revision': '2024-10-15' },
              body: JSON.stringify({
                data: {
                  type: 'subscription',
                  attributes: {
                    custom_source: 'Mother\'s Day Popup',
                    profile: { data: { type: 'profile', attributes: { email: email } } }
                  },
                  relationships: { list: { data: { type: 'list', id: EMAIL_LIST_ID } } }
                }
              })
            });
            if (resp.ok || resp.status === 202) {
              popupStatus.style.display = 'block';
              popupStatus.style.color = '#FFD9DB';
              popupStatus.innerHTML = "You're in. Use code <strong>" + WELCOME_CODE + "</strong> at checkout.";
              popupForm.style.display = 'none';
              if (popupCTA) {
                popupCTA.textContent = 'Continue to the Collection →';
                popupCTA.href = '/bundle.html?utm_source=popup&utm_medium=onsite&utm_campaign=md26&discount=' + WELCOME_CODE;
              }
              setDismissed();
            } else {
              popupStatus.style.display = 'block';
              popupStatus.style.color = '#FFB4B8';
              popupStatus.textContent = 'Something went wrong. Please try again.';
              popupSubmit.textContent = originalText;
              popupSubmit.disabled = false;
            }
          } catch (err) {
            popupStatus.style.display = 'block';
            popupStatus.style.color = '#FFB4B8';
            popupStatus.textContent = 'Network error. Please try again.';
            popupSubmit.textContent = originalText;
            popupSubmit.disabled = false;
          }
        });
      }
})();
