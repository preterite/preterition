(function floBank() {
  if (!(window.__pair && window.__pair.ready && window.__flo && window.__flo.ready)) {
    requestAnimationFrame(floBank); return;
  }
  var dataEl = document.getElementById('deck-data');
  var runs = dataEl ? JSON.parse(dataEl.textContent).index.runs : [];
  var entryOf = function (id) {
    for (var i = 0; i < runs.length; i++) if (runs[i].run === id) return runs[i];
    return null;
  };
  var LET = { '20261018-straight-letter-s7': 'A', '20261018-straight-letter-s7-r2': 'B',
    '20261020-straight-letter-s7-argon4-r2': 'C', '20261020-straight-letter-s7-progress-report-nothing-is-due': 'D',
    '20261020-straight-letter-s7-gpt61sol': 'E', '20261019-straight-letter-s7-questions': 'F' };
  var keys = function () { return document.querySelectorAll('#flo-bank .bank button[data-slot]'); };
  function faces() {
    var bank = window.__flo.bank();
    keys().forEach(function (b) {
      var i = Number(b.getAttribute('data-slot'));
      var id = (bank[i] || '').replace(/^file:/, '');
      if (b.querySelector('.bt') && b.getAttribute('data-face') === id) return;
      var e = entryOf(id), k = e ? e.knobs : null;
      b.innerHTML = '<i class="plamp" aria-hidden="true"></i><span class="bt"><span class="b1"><b>' + (i + 1) + '</b>' +
        (LET[id] ? LET[id] + ' ' : '') + '<i class="term">' + (e ? e.term : id) + '</i></span><span class="b2">' +
        (k ? '<span class="m">' + k.MODEL + '</span><span class="sep"> \u00b7 </span><span class="c">' + k.CORPUS + ' \u00b7 ' + k.GENRE + '</span>'
           : 'from a file') + '</span></span>';
      b.setAttribute('data-face', id);
    });
    requestAnimationFrame(faces);
  }
  var bk = document.getElementById('flo-bank');
  ['left', 'top', 'width', 'height'].forEach(function (p) { bk.style[p] = ''; });
  var tray = document.getElementById('flo-drawer');
  function trayToBank() {
    if (document.getElementById('flo').getAttribute('data-width') !== '375') {
      var h = bk.offsetTop - 56;
      if (h > 0 && tray.style.height !== h + 'px') { tray.style.setProperty('top', '56px', 'important'); tray.style.setProperty('height', h + 'px', 'important'); }
    }
    requestAnimationFrame(trayToBank);
  }
  trayToBank();
  if (tray && !tray.querySelector('.study-dgrille')) {
    var w2 = document.createElement('div'); w2.className = 'study-wear'; tray.insertBefore(w2, tray.firstChild);
    var gr = document.createElement('div'); gr.className = 'study-dgrille'; gr.setAttribute('aria-hidden', 'true');
    tray.insertBefore(gr, tray.querySelector('.picker'));
  }
  faces();
  window.__study = window.__study || {};
  window.__study.bank = true;
})();
