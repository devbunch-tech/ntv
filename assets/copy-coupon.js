(function () {
  if (window.__ntvCopyCouponBound) return;
  window.__ntvCopyCouponBound = true;

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-copy-coupon]');
    if (!btn) return;
    e.preventDefault();

    var code = btn.getAttribute('data-code') || '';
    if (!code) return;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code).catch(function () { fallbackCopy(code); });
    } else {
      fallbackCopy(code);
    }

    var label = btn.querySelector('.m-product-coupon__label');
    var copied = btn.getAttribute('data-copied-label') || 'Copiado!';
    var defaultLabel = btn.getAttribute('data-default-label') || (label ? label.textContent : '');

    btn.classList.add('is-copied');
    if (label) label.textContent = copied;

    clearTimeout(btn.__copyTimer);
    btn.__copyTimer = setTimeout(function () {
      btn.classList.remove('is-copied');
      if (label) label.textContent = defaultLabel;
    }, 2000);
  });
})();
