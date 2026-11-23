(function lay() {
  if (!(window.__pair && window.__pair.ready)) { requestAnimationFrame(lay); return; }
  var Z = { 1100: [[34, 441, 256, 169], [958, 258, 118, 342]], 760: [[24, 493, 186, 155]], 375: [] };
  var ch = document.querySelector('#flo .chassis');
  var w = document.createElement('div'); w.className = 'study-wear'; ch.insertBefore(w, ch.firstChild);
  (Z[window.__pair.width] || []).forEach(function (r) {
    var g = document.createElement('div'); g.className = 'study-grille';
    g.style.left = r[0] + 'px'; g.style.top = r[1] + 'px'; g.style.width = r[2] + 'px'; g.style.height = r[3] + 'px';
    ch.appendChild(g);
  });
  window.__study = { ready: true };
})();