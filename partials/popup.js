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
})();
