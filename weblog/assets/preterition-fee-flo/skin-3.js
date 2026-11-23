(function glow() {
  if (!(window.__study && window.__study.bank === true)) { requestAnimationFrame(glow); return; }
  var ROOM = {"caption":"Zero is the room: how the index spreads its returns over each source's passages when given every word in that source as a one-word query. A bar compares the passages the index returned to the run's search queries with 100 random draws of the same number from the room. Zero is the draws' average; one bit above zero is as if the source held half as many passages. Continue requests are not counted. The detent spans two standard deviations of the draws on either side of zero. Above the detent, the run's returns fell on fewer passages than random draws from the room; below, more.","room_sentence":{"S7":"In room s7, the index holds 12 sources: 4 fulltexts, 2 notes and 6 weblog posts. Given every word in a source as a one-word query, the index spreads its returns over the posts as if they held 1.6 to 14.1 of their 2 to 15 passages, over the notes as if they held 6.7 and 5.7 of their 7 and 6, and over the fulltexts as if they held 78.7 to 521 of their 84 to 604. These figures are what zero stands for on each source's column.","S36":"In room s36, the index holds 12 sources: 4 fulltexts, 2 notes and 6 weblog posts. Given every word in a source as a one-word query, the index spreads its returns over the posts as if they held 1.7 to 12.9 of their 2 to 13 passages, over the notes as if they held 5.9 and 4.7 of their 6 and 5, and over the fulltexts as if they held 90.8 to 560 of their 97 to 641. These figures are what zero stands for on each source's column.","S105":"In room s105, the index holds 12 sources: 4 fulltexts, 2 notes and 6 weblog posts. Given every word in a source as a one-word query, the index spreads its returns over the posts as if they held 1.0 to 8.7 of their 1 to 9 passages, over the notes as if they held 5.9 and 4.7 of their 6 and 5, and over the fulltexts as if they held 87.1 to 531 of their 97 to 616. These figures are what zero stands for on each source's column.","S3457":"In room s3457, the index holds 16 sources: 8 fulltexts, 2 notes and 6 weblog posts. Given every word in a source as a one-word query, the index spreads its returns over the posts as if they held 1.0 to 3.9 of their 1 to 4 passages, over the notes as if they held 12.8 and 6.8 of their 13 and 7, and over the fulltexts as if they held 4.0 to 23.4 of their 4 to 24. These figures are what zero stands for on each source's column."},"passages":{"S7":{"F1":548,"F2":604,"F3":84,"F4":351,"N1":7,"N2":6,"W1":2,"W2":2,"W3":15,"W4":3,"W5":3,"W6":9},"S36":{"F1":97,"F2":641,"F3":637,"F4":377,"N1":6,"N2":5,"W1":3,"W2":2,"W3":2,"W4":8,"W5":13,"W6":3},"S105":{"F1":550,"F2":335,"F3":97,"F4":616,"N1":6,"N2":5,"W1":4,"W2":4,"W3":9,"W4":3,"W5":1,"W6":6},"S3457":{"F1":4,"F2":9,"F3":18,"F4":16,"F5":10,"F6":24,"F7":8,"F8":20,"N1":13,"N2":7,"W1":2,"W2":3,"W3":2,"W4":4,"W5":2,"W6":1}}};
  var flo = document.getElementById('flo');
  var chassis = flo.querySelector('.chassis');
  var display = document.getElementById('flo-display');
  var history = display.querySelector('.history');
  var rows = display.querySelector('.hrows');
  var numbers = display.querySelector('.numbers');
  var SLOTS = 16;
  var busy = false;
  var sideways = flo.getAttribute('data-width') === '375';

  function state() { try { return (window.__flo && window.__flo.state && window.__flo.state()) || {}; } catch (e) { return {}; } }

  var DROP = sideways ? 28 : 0;
  var GROW = ({ 1100: 112, 760: 104, 375: 120 }[flo.getAttribute('data-width')] || 112) + DROP;
  (function grow() {
    var bank = document.getElementById('flo-bank');
    display.style.top = (parseFloat(display.style.top) + DROP) + 'px';
    display.style.height = (parseFloat(display.style.height) + GROW - DROP) + 'px';
    if (bank) bank.style.top = (parseFloat(getComputedStyle(bank).top) + GROW) + 'px';
    [chassis, flo].forEach(function (e) {
      e.style.setProperty('height', (parseFloat(getComputedStyle(e).height) + GROW) + 'px', 'important');
    });
  })();
  function el(tag, cls, text) { var x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
  function rel(e) { var b = e.getBoundingClientRect(), c = chassis.getBoundingClientRect(); return { l: b.left - c.left, t: b.top - c.top, w: b.width, h: b.height }; }

  function roles() {
    var s = state();
    if (s.view) flo.setAttribute('data-view', s.view);
    if (typeof s.floorIn === 'boolean') flo.setAttribute('data-floor', s.floorIn ? 'in' : 'bypass');
    flo.setAttribute('data-zoom', s.zoom === null || s.zoom === undefined ? 'off' : 'on');
    if (s.display) flo.setAttribute('data-display', s.display);
  }

  function grid() {
    var c = chassis.getBoundingClientRect(), seen = {};
    return Array.prototype.slice.call(flo.querySelectorAll('[data-mark="ladder"], [data-mark="dark-slot"]'))
      .map(function (e) { var b = e.getBoundingClientRect(); if (!(b.width > 0)) return null;
        return { l: b.left - c.left, w: b.width, c: (b.left + b.right) / 2 - c.left, t: b.top - c.top, b: b.bottom - c.top }; })
      .filter(function (g) { if (!g) return false; var k = Math.round(g.c * 10); if (seen[k]) return false; seen[k] = true; return true; })
      .sort(function (a, b) { return a.c - b.c; });
  }
  function gridOverlay() {
    chassis.querySelectorAll('.study-gridline').forEach(function (e) { e.remove(); });
    if (flo.getAttribute('data-grid') !== 'on' || sideways) return;
    var g = grid(); if (g.length !== SLOTS) return;
    var c = chassis.getBoundingClientRect();
    var env = flo.querySelector('.slider'), envTop = env ? env.closest('.gbox') : null;
    var top = envTop ? envTop.getBoundingClientRect().top - c.top : g[0].t;
    var foot = display.getBoundingClientRect().bottom - c.top;
    g.forEach(function (s) {
      var l = el('i', 'study-gridline'); l.style.left = (s.c - chassis.clientLeft - 0.5) + 'px';
      l.style.top = (top - chassis.clientTop) + 'px'; l.style.height = (foot - top) + 'px';
      chassis.appendChild(l);
    });
  }

  function columnLabels() {
    var ls = Array.prototype.slice.call(flo.querySelectorAll('[data-mark="column-label"], [data-mark="dark-slot"]'));
    var withPos = ls.map(function (e) { var b = e.getBoundingClientRect(); return { e: e, k: sideways ? b.top : b.left }; });
    withPos.sort(function (a, b) { return a.k - b.k; });
    var name = function (e) { var m = e.textContent.trim().match(/^[A-Z]+\d+/); return m ? m[0] : ''; };
    var out = withPos.map(function (p) { return p.e.getAttribute('data-mark') === 'dark-slot' ? '' : name(p.e); });
    if (out.length !== SLOTS) {
      out = Array.prototype.slice.call(flo.querySelectorAll('[data-mark="column-label"]')).map(name);
      while (out.length < SLOTS) out.push('');
    }
    return out.slice(0, SLOTS);
  }
  function decorateHistory() {
    Array.prototype.slice.call(chassis.querySelectorAll('.hs')).forEach(function (e) { e.hidden = history.hidden; });
    if (history.hidden) return;
    var rs = Array.prototype.slice.call(rows.querySelectorAll('.hrow'));
    var dark = rows.getAttribute('data-dark') === 'true';
    if (sideways) {
      if (!rs.length || dark) {
        var gone = history.querySelector('.study-ht'); if (gone) gone.remove();
        rows.style.cssText = '';
        return;
      }
      historySideways(rs);
      return;
    }
    var fresh = rs.some(function (r) { return !r.hasAttribute('data-glow'); });
    var traceOn = flo.getAttribute('data-trace') === 'on' && flo.getAttribute('data-floor') === 'in' && flo.getAttribute('data-view') !== 'POSITION' && flo.getAttribute('data-zoom') !== 'on';
    if (rs.length && !dark && !fresh && history.querySelector('.hidx-top')) return;
    history.querySelectorAll('.hidx-top, .hidx-span, .hidx-key, .hs').forEach(function (e) { e.remove(); });
    chassis.querySelectorAll('.hs').forEach(function (e) { e.remove(); });
    if (!rs.length || dark) { rows.style.cssText = ''; return; }
    var STRIP = 12, FOOT = 11;
    var H = history.clientHeight, W = history.clientWidth;
    var cwOld = W / SLOTS;
    var g = sideways ? null : grid(); if (!sideways && g.length !== SLOTS) return;
    var GUTTER = sideways ? 24 : 0;
    var cwNew = (W - GUTTER) / SLOTS;
    var c = chassis.getBoundingClientRect();
    var histLeft = history.getBoundingClientRect().left - c.left + GUTTER;
    var dispRect = display.getBoundingClientRect();
    var colL = function (i) { return sideways ? i * cwNew : g[i].l - histLeft; };
    var colW = function (i) { return sideways ? Math.max(2, cwNew - 2) : g[i].w; };
    var sumOld = rs.reduce(function (a, r) { return a + (r.hasAttribute('data-glow') ? 0 : (parseFloat(r.style.height) || 0)); }, 0);
    var hNew = H - STRIP - FOOT;
    var hRows = !sideways ? hNew * rs.length / (rs.length + 1) : hNew;
    var scale = sumOld > 0 ? hRows / sumOld : 1;
    rows.style.position = 'absolute'; rows.style.left = GUTTER + 'px'; rows.style.right = '0';
    rows.style.top = STRIP + 'px'; rows.style.height = hNew + 'px';
    var s = state();
    var k = s.k, win = s.window;
    var top = 0, pitch = 0;
    rs.forEach(function (row, idx) {
      var scaled = row.hasAttribute('data-glow');
      var p = parseFloat(row.style.height) || 0;
      pitch = scaled ? p : p * scale;
      if (!scaled) {
        row.style.height = pitch + 'px';
        Array.prototype.slice.call(row.querySelectorAll('.hmark')).forEach(function (m) {
          var i = Math.round((parseFloat(m.style.left) - 8) / cwOld);
          if (i < 0 || i >= SLOTS) return;
          m.style.left = colL(i) + 'px';
          m.style.width = colW(i) + 'px';
          m.style.height = Math.max(1, (parseFloat(m.style.height) || 1) * scale) + 'px';
          m.style.bottom = ((parseFloat(m.style.bottom) || 0) * scale) + 'px';
        });
        row.setAttribute('data-glow', '1');
      }
      if (!row.querySelector('.hzero')) row.appendChild(el('b', 'hzero'));
      var sess = row.getAttribute('data-session');
      var every = pitch >= 9 ? 1 : Math.ceil(9 / pitch);
      var last = idx === rs.length - 1, first = idx === 0;
      if (sess && (every === 1 || first || last || (rs.length - 1 - idx) % every === 0)) {
        var lab = el('span', 'hs', 'S' + sess);
        if (sideways) {
          lab.style.left = '0'; lab.style.width = (GUTTER - 3) + 'px';
          lab.style.top = (STRIP + top + pitch / 2 - 4) + 'px';
          history.appendChild(lab);
        } else {
          lab.style.left = (dispRect.left - c.left - chassis.clientLeft - 44) + 'px';
          lab.style.top = (dispRect.top - c.top - chassis.clientTop + (history.getBoundingClientRect().top - dispRect.top) + STRIP + top + pitch / 2 - 4) + 'px';
          chassis.appendChild(lab);
        }
      }
      top += pitch;
    });
    rows.querySelectorAll('.hrow.study-shelf').forEach(function (e) { e.remove(); });
    if (!sideways) {
      var shelf = el('div', 'hrow study-shelf'); shelf.style.height = (hNew - hRows) + 'px';
      if (!traceOn) { rows.appendChild(shelf); }
    }
    if (traceOn && !sideways) {
      var bitsBy = traceBits();
      bitsBy.forEach(function (bits, i) {
        if (bits === null) return;
        var px = Math.min(pitch / 2, bits / BITS_PER_RUNG * ((pitch / 2) / RUNGS_PER_HALF));
        var stub = el('i', 'study-trace'); stub.style.left = colL(i) + 'px'; stub.style.width = colW(i) + 'px';
        stub.style.top = '50%'; stub.style.height = Math.max(1, px).toFixed(1) + 'px';
        shelf.appendChild(stub);
      });
      shelf.appendChild(el('b', 'hzero'));
      rows.appendChild(shelf);
      var slab = el('span', 'hs study-shelf-label', 'room');
      slab.style.left = (dispRect.left - c.left - chassis.clientLeft - 44) + 'px';
      slab.style.top = (dispRect.top - c.top - chassis.clientTop + (history.getBoundingClientRect().top - dispRect.top) + STRIP + top + pitch / 2 - 4) + 'px';
      chassis.appendChild(slab);
    }
    var from = rs.length ? rs[0].getAttribute('data-session') : null;
    var winWord = win ? (' (' + (win === 'all' ? 'all' : 'window ' + win) + ')') : '';
    var span = el('div', 'hidx-span', (from && k != null) ? ('S' + from + '-S' + k + winWord + ', newest at the foot') : '');
    history.appendChild(span);
    var strip = el('div', 'hidx-top');
    columnLabels().forEach(function (t, i) {
      if (!t) return;
      var lab = el('span', 'hcol', t);
      lab.style.left = (GUTTER + colL(i)) + 'px'; lab.style.width = colW(i) + 'px';
      strip.appendChild(lab);
    });
    history.appendChild(strip);
    var zoomed = flo.getAttribute('data-zoom') === 'on';
    var key = el('div', 'hidx-key', zoomed ? 'count less ROOM ALONE: 0 at each row\'s centre'
                                           : 'bend, bits: 0 at each row\'s centre, \u00b12.5 at its edges');
    history.appendChild(key);
  }

  function historySideways(rs) {
    var old = history.querySelector('.study-ht');
    var fresh = rs.some(function (r) { return !r.hasAttribute('data-glow'); });
    if (old && !fresh) return;
    if (old) old.remove();
    history.querySelectorAll('.hidx-top, .hidx-span, .hidx-key, .hs').forEach(function (e) { e.remove(); });
    rows.style.cssText = 'visibility: hidden;';
    var W = history.clientWidth, H = history.clientHeight;
    var STRIP = 12, FOOT = 11, GUTTER = 26;
    var cwOld = W / SLOTS;
    var names = columnLabels();
    var rowOf = [], nSrc = 0;
    names.forEach(function (t, i) { rowOf[i] = t ? nSrc++ : -1; });
    var n = rs.length, cw = (W - GUTTER) / n, hNew = H - STRIP - FOOT, rh = hNew / Math.max(1, nSrc);
    var T = el('div', 'study-ht');
    var prev = '';
    names.forEach(function (t, i) {
      if (!t) return;
      var y = STRIP + rowOf[i] * rh;
      var lab = el('span', 'ht-src', t);
      lab.style.top = y + 'px'; lab.style.height = rh + 'px'; lab.style.lineHeight = rh + 'px';
      lab.style.width = (GUTTER - 5) + 'px';
      T.appendChild(lab);
      if (prev && t.charAt(0) !== prev.charAt(0)) {
        var sep = el('b', 'ht-fam'); sep.style.top = y + 'px'; sep.style.left = GUTTER + 'px'; T.appendChild(sep);
      }
      prev = t;
    });
    rs.forEach(function (row, j) {
      var p = parseFloat(row.style.height) || 0;
      row.setAttribute('data-glow', '1');
      if (!(p > 0)) return;
      var x0 = GUTTER + j * cw;
      var z = el('b', 'ht-zero' + (row.classList.contains('newest') ? ' newest' : ''));
      z.style.left = (x0 + cw / 2 - 0.5) + 'px'; z.style.top = STRIP + 'px'; z.style.height = hNew + 'px';
      T.appendChild(z);
      Array.prototype.slice.call(row.querySelectorAll('.hmark')).forEach(function (m) {
        var i = Math.round((parseFloat(m.style.left) - 8) / cwOld);
        if (i < 0 || i >= SLOTS || rowOf[i] < 0) return;
        var b = parseFloat(m.style.bottom) || 0, h = parseFloat(m.style.height) || 1;
        var k = el('i', 'hmark');
        k.style.left = (x0 + 1 + b / p * (cw - 2)) + 'px'; k.style.width = Math.max(1, h / p * (cw - 2)) + 'px';
        k.style.top = (STRIP + rowOf[i] * rh + 2) + 'px'; k.style.height = Math.max(2, rh - 4) + 'px';
        T.appendChild(k);
      });
      var sess = row.getAttribute('data-session');
      var every = cw >= 16 ? 1 : Math.ceil(16 / cw);
      if (sess && (every === 1 || j === n - 1 || (n - 1 - j) % every === 0)) {
        var sl = el('span', 'ht-sess', 'S' + sess); sl.style.left = x0 + 'px'; sl.style.width = cw + 'px'; T.appendChild(sl);
      }
    });
    var s = state(), from = rs[0].getAttribute('data-session');
    var winWord = s.window ? (' (' + (s.window === 'all' ? 'all' : 'window ' + s.window) + ')') : '';
    T.appendChild(el('div', 'hidx-span', 'S' + from + '-S' + s.k + winWord + ', newest at the right'));
    history.appendChild(T);
  }

  var partialLp = flo.querySelector('[data-mark="window-partial"]');
  function gate() {
    var lt = partialLp ? partialLp.querySelector('.lt') : null;
    if (lt && !lt.querySelector('.study-sr')) { lt.textContent = ''; lt.appendChild(el('span', 'study-sr', 'window ')); lt.appendChild(document.createTextNode('PARTIAL')); }
    if (!sideways) return;
    var gbox = boxByLabel('GATE'), wrap = flo.querySelector('[data-mark="window-knob"]');
    var face = wrap && wrap.querySelector('.kface'), win = wrap && wrap.querySelector('.kwin'), leg = wrap && wrap.querySelector('.klegend');
    var gcol = flo.querySelector('.gcol'), failed = flo.querySelector('[data-mark="failed-count"]');
    var view = flo.querySelector('[data-mark="view-key"]'), floor = flo.querySelector('[data-mark="floor-key"]');
    if (!gbox || !face || !win || !leg || !gcol || !failed || !view || !floor || !partialLp) return;
    var cl = chassis.clientLeft, ct = chassis.clientTop;
    var g = rel(gbox), v = rel(view), f = rel(floor);
    var INSET = 6, SKIRT = 5, FACE = 22, GAP = 6;
    var r1 = v.t + v.h / 2, r2 = f.t + f.h / 2;
    var faceL = g.l + INSET + SKIRT, faceC = (r1 + r2) / 2;
    var axis = ((faceL + FACE + SKIRT) + (v.l - GAP)) / 2;
    var winH = win.offsetHeight, legH = leg.offsetHeight, legW = leg.offsetWidth;
    var winT = r1 - winH / 2;
    var W0 = g.l + INSET, T0 = g.t + 8, Wd = v.l - GAP - W0, Ht = g.t + g.h - 6 - T0;
    var set = function (e, k, val) { var want = val.toFixed(2) + 'px'; if (e.style.getPropertyValue(k) !== want) e.style.setProperty(k, want, 'important'); };
    set(wrap, 'left', W0 - cl); set(wrap, 'top', T0 - ct); set(wrap, 'width', Wd); set(wrap, 'height', Ht);
    set(face, 'left', faceL - W0); set(face, 'top', faceC - FACE / 2 - T0);
    set(win, 'left', axis - 13 - W0); set(win, 'top', winT - T0);
    set(leg, 'left', axis - legW / 2 - W0); set(leg, 'top', (winT + winH + (r2 - 10)) / 2 - legH / 2 - T0);
    var C0 = g.l + INSET, Cw = f.l - GAP - C0;
    set(gcol, 'left', C0 - cl); set(gcol, 'top', T0 - ct); set(gcol, 'width', Cw); set(gcol, 'height', Ht);
    var pw = partialLp.offsetWidth, ph = partialLp.offsetHeight;
    set(partialLp, 'left', axis - pw / 2 - C0); set(partialLp, 'top', r2 - ph / 2 - T0);
    var fw = failed.offsetWidth, fh = failed.offsetHeight;
    set(failed, 'left', v.l + v.w - fw - C0); set(failed, 'top', r2 - fh / 2 - T0);
  }

  var numbers2 = null;
  function fxRound(v) {
    var n = parseFloat(v); if (isNaN(n)) return v;
    return n < 100 ? (Math.round(n * 10) / 10).toFixed(1) : String(Math.round(n));
  }
  function dressTable(t, effCol) {
    var ths = t.querySelectorAll('thead th');
    ths.forEach(function (th, i) { if (i > 0) th.classList.add('num'); if (th.textContent.trim() === 'effective') th.textContent = 'even-equivalent'; });
    var lastFam = null;
    Array.prototype.slice.call(t.querySelectorAll('tbody tr')).forEach(function (tr) {
      var tds = tr.querySelectorAll('td');
      tds.forEach(function (td, i) {
        if (i > 0) td.classList.add('num');
        if (i === effCol) td.textContent = fxRound(td.textContent);
        if (/under 1 passage/.test(td.textContent)) td.classList.add('clamp');
      });
      var fam = (tds[0] ? tds[0].textContent.trim().charAt(0) : '');
      if (fam && fam !== lastFam && lastFam !== null) tr.classList.add('fam-first');
      lastFam = fam;
    });
  }
  function splitNumbers() {
    if (numbers.hidden) { if (numbers2) numbers2.hidden = true; return; }
    var ths = Array.prototype.slice.call(numbers.querySelectorAll('thead th')).map(function (th) { return th.textContent.trim(); });
    var effCol = ths.indexOf('effective');
    var trs = Array.prototype.slice.call(numbers.querySelectorAll('tbody tr'));
    var fresh = trs.length > 8 || effCol >= 0;
    if (!fresh) { if (numbers2) numbers2.hidden = false; return; }
    if (numbers2) { numbers2.remove(); numbers2 = null; }
    numbers.classList.remove('split');
    var SPLIT = false;
    if (SPLIT && !sideways && trs.length > 8) {
      numbers2 = numbers.cloneNode(false);
      numbers2.removeAttribute('data-mark'); numbers2.removeAttribute('id');
      numbers2.className = 'numbers numbers-2'; numbers2.hidden = false;
      numbers2.appendChild(numbers.querySelector('caption').cloneNode(true));
      numbers2.appendChild(numbers.querySelector('thead').cloneNode(true));
      var tb = document.createElement('tbody');
      var half = Math.ceil(trs.length / 2);
      trs.slice(half).forEach(function (tr) { tb.appendChild(tr); });
      numbers2.appendChild(tb);
      numbers.classList.add('split');
      numbers.parentNode.insertBefore(numbers2, numbers.nextSibling);
      dressTable(numbers2, effCol);
    }
    dressTable(numbers, effCol);
  }

  function roomKey() {
    var c = String(state().corpus || '').toUpperCase();
    if (ROOM.room_sentence[c]) return c;
    var kw = flo.querySelector('[data-mark="room-knob"] .kwin');
    var m = (kw ? kw.textContent.trim().toUpperCase() : '').match(/S\d+/);
    return (m && ROOM.room_sentence[m[0]]) ? m[0] : 'S7';
  }
  function boxByLabel(word) {
    return Array.prototype.slice.call(flo.querySelectorAll('.gbox')).filter(function (b) {
      var l = b.querySelector('.glabel'); return l && l.textContent.trim() === word; })[0] || null;
  }
  var hereBox = boxByLabel('PRESET'), momentBox = boxByLabel('MOMENT');
  var hereGlass = el('div', 'study-here'), hereKeys = el('div', 'study-here-keys');
  var herePos = 'RUN';
  var HERE_KEYS = ['RUN', 'ROOM', 'NOTE'];
  HERE_KEYS.forEach(function (name) {
    var b = el('button', 'k'); b.type = 'button'; b.setAttribute('data-here', name); b.setAttribute('data-mark', 'status-' + name.toLowerCase()); b.setAttribute('aria-pressed', String(name === herePos));
    var lamp = el('i', 'klamp'); var lab = el('span', 'kl', name); b.appendChild(lamp); b.appendChild(lab);
    b.addEventListener('click', function () { herePos = name; paintHere(); });
    hereKeys.appendChild(b);
  });
  if (hereBox) {
    var lab = hereBox.querySelector('.glabel'); if (lab && lab.textContent.trim() === 'PRESET') lab.textContent = 'STATUS';
    chassis.appendChild(hereGlass); chassis.appendChild(hereKeys);
  }
  function titleLine() {
    var key = document.querySelector('#flo-bank button[aria-pressed="true"]');
    if (!key) return null;
    var b1 = key.querySelector('.b1'), b2 = key.querySelector('.b2');
    var head = b1 ? b1.textContent.replace(/\s+/g, ' ').trim().replace(/^\d+\s*/, '') : '';
    var tail = b2 ? b2.textContent.replace(/\s+/g, ' ').trim() : '';
    return head + (tail ? ' \u00b7 ' + tail : '');
  }
  function paintHere() {
    if (!hereBox) return;
    var s = state(), rk = roomKey();
    hereGlass.innerHTML = '';
    hereGlass.setAttribute('data-pos', herePos);
    if (herePos === 'RUN') {
      var t = titleLine();
      hereGlass.appendChild(el('p', 'sh-title', t || (s.run || 'no run loaded')));
      if (t) hereGlass.appendChild(el('p', 'sh-dim', s.run || ''));
      var where = s.k == null ? 'the leader' : ('S' + s.k + (s.N ? ' of ' + s.N : ''));
      hereGlass.appendChild(el('p', 'sh-dim', where + (s.window ? ' \u00b7 window ' + (s.window === 'all' ? 'all' : s.window) : '') + ' \u00b7 room ' + rk));
    } else if (herePos === 'ROOM') {
      hereGlass.appendChild(el('p', 'sh-where', 'room ' + rk));
      hereGlass.appendChild(el('p', 'sh-room', ROOM.room_sentence[rk] || ''));
    } else {
      hereGlass.appendChild(el('p', 'sh-where', 'zero'));
      hereGlass.appendChild(el('p', 'sh-note', ROOM.caption || ''));
    }
    Array.prototype.slice.call(hereKeys.children).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-here') === herePos)); });
  }
  function here() {
    if (!hereBox) return;
    var r = rel(hereBox), cl = chassis.clientLeft, ct = chassis.clientTop;
    var ref = flo.querySelector(sideways ? '[data-mark="peak-hold"]' : '[data-mark="view-key"]');
    if (!ref) return;
    var k = rel(ref), m = (r.l + r.w) - (k.l + k.w);
    var TOP = sideways ? 8 : 14, FOOT = sideways ? 8 : 10;
    var gh = r.h - TOP - FOOT;
    hereGlass.style.left = (r.l + m - cl) + 'px'; hereGlass.style.top = (r.t + TOP - ct) + 'px';
    hereGlass.style.width = (k.l - m - (r.l + m)) + 'px'; hereGlass.style.height = gh + 'px';
    hereKeys.style.left = (k.l - cl) + 'px'; hereKeys.style.top = (r.t + TOP - ct) + 'px';
    hereKeys.style.width = k.w + 'px';
    hereKeys.style.height = (sideways ? gh : 3 * 20 + 2 * 6) + 'px';
    hereKeys.setAttribute('data-stack', sideways ? 'column' : 'pitch');
    paintHere();
  }
  var zoomKey = flo.querySelector('[data-mark="zoom-key"]');
  var ZOOM_REASON = 'FULL SPAN is dark: no source is zoomed. Click a source column to zoom; FULL SPAN then returns to every source.';
  if (zoomKey) zoomKey.addEventListener('click', function (ev) {
    if (zoomKey.getAttribute('aria-disabled') !== 'true') return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    var live = document.getElementById('announce'); if (live) { live.textContent = ''; live.textContent = ZOOM_REASON; }
  }, true);
  function fullSpan() {
    if (!zoomKey) return;
    var z = state().zoom, kl = zoomKey.querySelector('.kl'), sub = zoomKey.querySelector('.ksub');
    if (kl && kl.textContent !== 'FULL SPAN') kl.textContent = 'FULL SPAN';
    if (z === null || z === undefined) {
      if (!zoomKey.classList.contains('dark')) zoomKey.classList.add('dark');
      if (zoomKey.getAttribute('aria-disabled') !== 'true') zoomKey.setAttribute('aria-disabled', 'true');
      if (zoomKey.title !== ZOOM_REASON) zoomKey.title = ZOOM_REASON;
      if (sub) sub.remove();
    } else {
      if (zoomKey.classList.contains('dark')) zoomKey.classList.remove('dark');
      if (zoomKey.getAttribute('aria-disabled') !== 'false') zoomKey.setAttribute('aria-disabled', 'false');
      if (zoomKey.title) zoomKey.removeAttribute('title');
      if (!sub) { sub = el('small', 'ksub'); zoomKey.appendChild(sub); }
      if (sub.textContent !== String(z)) sub.textContent = String(z);
    }
  }
  function lamps() {
    if (!momentBox) return;
    var r = rel(momentBox), cl = chassis.clientLeft, ct = chassis.clientTop;
    var chassisChild = function (e) { while (e && e.parentElement && e.parentElement !== chassis) e = e.parentElement; return e && e.parentElement === chassis ? e : null; };
    var lampRow = chassisChild(flo.querySelector('[data-mark="status-lamp"]'));
    var decay = chassisChild(flo.querySelector('[data-mark="decay-label"]'));
    if (lampRow && lampRow.parentElement === chassis) {
      if (sideways) { lampRow.style.left = (r.l + 8 - cl) + 'px'; lampRow.style.top = (r.t + 12 - ct) + 'px'; }
      else if (flo.getAttribute('data-width') === '760') { lampRow.style.left = (r.l + 8 - cl) + 'px'; lampRow.style.top = (r.t + 25 - lampRow.offsetHeight / 2 - ct) + 'px'; }
      else { lampRow.style.left = (r.l + 8 - cl) + 'px'; lampRow.style.top = (r.t + 14 - ct) + 'px'; }
    }
    if (decay && decay.parentElement === chassis) {
      if (sideways) { decay.classList.add('row'); decay.style.left = (r.l + 8 - cl) + 'px'; decay.style.top = (r.t + 38 - ct) + 'px'; decay.style.width = (r.w - 16) + 'px'; decay.style.height = '16px'; }
      else if (flo.getAttribute('data-width') === '760') { decay.classList.add('row'); decay.style.left = (r.l + 300 - cl) + 'px'; decay.style.top = (r.t + 14 - ct) + 'px'; decay.style.width = (r.w - 308 - 90) + 'px'; decay.style.height = '22px'; }
      else { decay.style.left = (r.l + 8 - cl) + 'px'; decay.style.top = (r.t + 80 - ct) + 'px'; decay.style.width = (r.w - 16) + 'px'; decay.style.height = '52px'; }
    }
    traceKeyIn(r);
  }

  function align() {
    var c = chassis.getBoundingClientRect();
    var inset = chassis.clientLeft;
    var meter = flo.querySelector('.meter');
    if (meter) {
      var m = meter.getBoundingClientRect();
      display.style.left = (m.left - c.left - inset) + 'px';
      display.style.width = m.width + 'px';
    }
    if (sideways) return;
    var seen = {};
    var lad = Array.prototype.slice.call(flo.querySelectorAll('[data-mark="ladder"], [data-mark="dark-slot"]'))
      .map(function (e) { var b = e.getBoundingClientRect(); return b.width > 0 ? Math.round(((b.left + b.right) / 2 - c.left) * 10) / 10 : null; })
      .filter(function (x) { if (x === null || seen[x]) return false; seen[x] = true; return true; })
      .sort(function (a, b) { return a - b; });
    if (lad.length !== SLOTS) return;
    var pitch = lad[1] - lad[0];
    var seam8 = lad[8] - pitch / 2, seam10 = lad[10] - pitch / 2;
    var placard = flo.querySelector('.citeplate'), badge = flo.querySelector('.badgeplate');
    if (placard) { var p = placard.getBoundingClientRect(); placard.style.width = (seam8 - (p.left - c.left)) + 'px'; }
    if (badge) { var b = badge.getBoundingClientRect(); var right = b.right - c.left; badge.style.left = (seam10 - inset) + 'px'; badge.style.width = (right - seam10) + 'px'; }
  }

  var SCALE_TOP = 0.5;
  function caps() {
    var zoomed = flo.getAttribute('data-zoom') === 'on';
    var top = flo.querySelector('.escale .etop');
    if (top && !zoomed && top.textContent.trim() !== '0.5') top.textContent = '0.5';
    var gl0 = flo.querySelector('.escale .egini'); if (gl0 && !zoomed && gl0.textContent.trim() !== 'GINI') gl0.textContent = 'GINI';
    if (zoomed) {
      if (top && top.textContent.trim() !== '2x') top.textContent = '2x';
      var gl = flo.querySelector('.escale .egini'); if (gl && gl.textContent.trim() !== 'x even') gl.textContent = 'x even';
      Array.prototype.slice.call(flo.querySelectorAll('.slider .zcap')).forEach(function (z) {
        if (z.hidden || !/%\)/.test(z.style.transform || '')) return;
        var f = parseFloat(z.getAttribute('data-frac')); if (isNaN(f)) return;
        var s = z.parentElement, track = sideways ? s.getBoundingClientRect().width : s.getBoundingClientRect().height;
        var travel = Math.min(1, Math.max(0, f)) * track;
        z.style.transform = sideways ? ('translateX(' + travel.toFixed(2) + 'px)') : ('translateY(-' + travel.toFixed(2) + 'px)');
      });
      return;
    }
    Array.prototype.slice.call(flo.querySelectorAll('.slider')).forEach(function (s) {
      var cap = s.querySelector('.cap'); if (!cap) return;
      var t = cap.style.transform || '';
      var m = t.match(/translate([XY])\((-?[\d.]+)(%|px)\)/);
      var gini;
      if (m && m[3] === '%') { gini = Math.abs(parseFloat(m[2])) / 100; cap.setAttribute('data-gini', String(gini)); }
      else if (cap.hasAttribute('data-gini')) { gini = parseFloat(cap.getAttribute('data-gini')); }
      else return;
      var track = sideways ? s.getBoundingClientRect().width : s.getBoundingClientRect().height;
      var travel = Math.min(1, gini / SCALE_TOP) * track;
      cap.style.transform = sideways ? ('translateX(' + travel.toFixed(2) + 'px)') : ('translateY(-' + travel.toFixed(2) + 'px)');
    });
  }
  var EFF = {};
  function counts() {
    var rk = roomKey(); var P = (ROOM.passages || {})[rk] || {};
    Array.prototype.slice.call(flo.querySelectorAll('[data-mark="effective"]')).forEach(function (e) {
      if (/\//.test(e.textContent)) return;
      var raw = parseFloat(e.textContent); if (isNaN(raw)) return;
      var lab = e.previousElementSibling && e.previousElementSibling.getAttribute('data-mark') === 'column-label' ? e.previousElementSibling : null;
      var name = lab ? (lab.textContent.trim().match(/^[A-Z]+\d+/) || [''])[0] : '';
      if (name) EFF[name] = raw;
      var n = P[name];
      var shown = (n !== undefined && n < 100) ? (Math.floor(raw * 10 + 0.5) / 10).toFixed(1) : String(Math.floor(raw + 0.5));
      e.textContent = n !== undefined ? (shown + '/' + n) : shown;
    });
  }
  var RUNGS_PER_HALF = 11, BITS_PER_RUNG = 0.25;
  function trace() {
    Array.prototype.slice.call(flo.querySelectorAll('.study-trace')).forEach(function (e) { e.remove(); });
    var on = flo.getAttribute('data-trace') === 'on';
    var bitsRole = flo.getAttribute('data-floor') === 'in' && flo.getAttribute('data-view') !== 'POSITION' && flo.getAttribute('data-zoom') !== 'on';
    if (!on || !bitsRole) return;
    var rk = roomKey(); var P = (ROOM.passages || {})[rk] || {};
    var names = columnLabels();
    var ladders = Array.prototype.slice.call(flo.querySelectorAll('[data-mark="ladder"]'))
      .map(function (e) { var b = e.getBoundingClientRect(); return { e: e, k: sideways ? b.top : b.left, w: b.width, h: b.height }; })
      .filter(function (l) { return l.w > 0; }).sort(function (a, b) { return a.k - b.k; });
    ladders.forEach(function (l, i) {
      var name = names[i]; if (!name) return;
      var n = P[name], eff = EFF[name]; if (!(n > 0 && eff > 0)) return;
      var bits = Math.log(n / eff) / Math.LN2;
      var half = (sideways ? l.w : l.h) / 2;
      var px = Math.min(half, bits / BITS_PER_RUNG * (half / RUNGS_PER_HALF));
      var stub = el('i', 'study-trace'); stub.setAttribute('title', name + ': ' + bits.toFixed(2) + ' bits');
      if (sideways) { stub.style.right = '50%'; stub.style.width = px.toFixed(1) + 'px'; }
      else { stub.style.top = 'calc(50% + 1px)'; stub.style.height = px.toFixed(1) + 'px'; }
      l.e.insertBefore(stub, l.e.firstChild);
    });
  }
  function traceBits() {
    var rk = roomKey(); var P = (ROOM.passages || {})[rk] || {};
    return columnLabels().map(function (name) {
      var n = P[name], eff = EFF[name];
      return (name && n > 0 && eff > 0) ? Math.log(n / eff) / Math.LN2 : null;
    });
  }
  var traceKey = null;
  function traceKeyIn(r) {
    if (!traceKey) {
      traceKey = el('button', 'k'); traceKey.type = 'button'; traceKey.id = 'flo-trace'; traceKey.setAttribute('data-mark', 'trace-key'); traceKey.setAttribute('aria-pressed', 'false');
      traceKey.appendChild(el('i', 'klamp')); traceKey.appendChild(el('span', 'kl', 'TRACE'));
      traceKey.addEventListener('click', function () {
        var on = flo.getAttribute('data-trace') !== 'on';
        flo.setAttribute('data-trace', on ? 'on' : 'off'); traceKey.setAttribute('aria-pressed', String(on));
        if (on) { try { window.__deck.sound.hear('flo:trace-on', {}); } catch (e) {} }
        try { if (window.__flo.setDisplay) window.__flo.setDisplay(state().display || 'HISTORY'); } catch (e) {}
      });
      chassis.appendChild(traceKey);
    }
    var cl = chassis.clientLeft, ct = chassis.clientTop;
    if (sideways) { traceKey.style.left = (r.l + r.w - 8 - 80 - cl) + 'px'; traceKey.style.top = (r.t + 10 - ct) + 'px'; traceKey.style.width = '80px'; traceKey.style.height = '18px'; }
    else if (flo.getAttribute('data-width') === '760') { traceKey.style.left = (r.l + r.w - 8 - 80 - cl) + 'px'; traceKey.style.top = (r.t + 14 - ct) + 'px'; traceKey.style.width = '80px'; traceKey.style.height = '22px'; }
    else { traceKey.style.left = (r.l + 8 - cl) + 'px'; traceKey.style.top = (r.t + r.h - 8 - 20 - ct) + 'px'; traceKey.style.width = (r.w - 16) + 'px'; traceKey.style.height = '20px'; }
  }
  function sbpNote() {
    if (chassis.querySelector('.study-sbp-note')) return;
    var lab = flo.querySelector('[data-mark="set-by-preset"]'); if (!lab) return;
    var r = rel(lab), cs = getComputedStyle(lab);
    var note = el('span', 'study-sbp-note', 'how unevenly the index deals each source\'s passages; 0 is even');
    if (sideways) { note.style.left = (r.l - 4 - chassis.clientLeft) + 'px'; note.style.top = (r.t + 14 - chassis.clientTop) + 'px'; }
    else { note.style.left = (r.l + r.w + 6 - chassis.clientLeft) + 'px'; note.style.top = (r.t - chassis.clientTop) + 'px'; }
    note.style.height = r.h + 'px'; note.style.font = cs.font; note.style.lineHeight = cs.lineHeight; note.style.textTransform = cs.textTransform;
    chassis.appendChild(note);
  }
  function focus() {
    Array.prototype.slice.call(flo.querySelectorAll('.study-focus')).forEach(function (e) { e.remove(); });
    Array.prototype.slice.call(flo.querySelectorAll('.cap.study-focused')).forEach(function (e) { e.classList.remove('study-focused'); });
    if (sideways) return;
    var fl = flo.querySelector('.ladder.focused'); if (!fl) return;
    var c = chassis.getBoundingClientRect(), fb = fl.getBoundingClientRect();
    var left = fb.left - c.left, width = fb.width, cx = (fb.left + fb.right) / 2 - c.left;
    var sliders = Array.prototype.slice.call(flo.querySelectorAll('.slider')).filter(function (s) { return s.getBoundingClientRect().width > 0; });
    if (sliders.length) {
      var st = Math.min.apply(null, sliders.map(function (s) { return s.getBoundingClientRect().top; })) - c.top - 4;
      var sb = Math.max.apply(null, sliders.map(function (s) { return s.getBoundingClientRect().bottom; })) - c.top + 6;
      var b1 = el('i', 'study-focus'); b1.style.left = (left - chassis.clientLeft) + 'px'; b1.style.top = (st - chassis.clientTop) + 'px';
      b1.style.width = width + 'px'; b1.style.height = (sb - st) + 'px'; chassis.appendChild(b1);
      sliders.forEach(function (s) { var r = s.getBoundingClientRect(); if (Math.abs((r.left + r.right) / 2 - c.left - cx) < 2) { var cap = s.querySelector('.cap'); if (cap) cap.classList.add('study-focused'); } });
    }
    if (!history.hidden && !history.querySelector('.study-legend') && rows.getAttribute('data-dark') !== 'true' && rows.querySelector('.hmark')) {
      var hb = history.getBoundingClientRect();
      var b3 = el('i', 'study-focus'); b3.style.left = (fb.left - hb.left) + 'px'; b3.style.top = '12px'; b3.style.bottom = '11px'; b3.style.width = width + 'px';
      history.appendChild(b3);
    }
    if (numbersT && !numbersT.hidden && !numbers.hidden) {
      var db = display.getBoundingClientRect();
      var hb2 = numbersT.querySelector('thead').getBoundingClientRect(), tb2 = numbersT.querySelector('tbody').getBoundingClientRect();
      var b4 = el('i', 'study-focus'); b4.style.left = (fb.left - db.left) + 'px'; b4.style.top = (hb2.top - db.top - 2) + 'px'; b4.style.height = (tb2.bottom - hb2.top + 4) + 'px'; b4.style.width = width + 'px';
      display.appendChild(b4);
    }
  }

  var histKey = flo.querySelector('[data-mark="display-key"][data-position="HISTORY"]');
  var histLabel = histKey ? histKey.querySelector('.kl') : null;
  var wasPosition = false;
  function readings() { try { return (window.__flo && window.__flo.readings && window.__flo.readings()) || null; } catch (e) { return null; } }
  function position() {
    var pos = flo.getAttribute('data-view') === 'POSITION';
    var labels = Array.prototype.slice.call(flo.querySelectorAll('[data-mark="column-label"]'));
    var effs = Array.prototype.slice.call(flo.querySelectorAll('[data-mark="effective"]'));
    var cells = Array.prototype.slice.call(flo.querySelectorAll('.posrow .poscell'));
    var old = history.querySelector('.study-legend');
    if (!pos) {
      wasPosition = false;
      if (histLabel && histLabel.textContent !== 'HISTORY') histLabel.textContent = 'HISTORY';
      labels.concat(effs).forEach(function (e) { e.classList.remove('study-dim'); });
      cells.forEach(function (c) { c.classList.remove('study-dark'); });
      if (old) old.remove();
      return;
    }
    if (!wasPosition && state().display !== 'HISTORY') { try { window.__flo.setDisplay('HISTORY'); again = true; } catch (e) {} }
    wasPosition = true;
    if (histLabel && histLabel.textContent !== 'LEGEND') histLabel.textContent = 'LEGEND';
    var R = readings(); if (!R || !R.position) return;
    var rows = R.position.rows;
    var excluded = [], hatched = false;
    rows[0].slots.forEach(function (s, i) {
      var out = !s.dark && !s.eligible && s.source;
      if (out) excluded.push(s.source);
      if (labels[i]) labels[i].classList.toggle('study-dim', !!out);
      if (effs[i]) effs[i].classList.toggle('study-dim', !!out);
    });
    rows.forEach(function (row, j) {
      row.slots.forEach(function (s, i) {
        if (s.hatched) hatched = true;
        var c = cells[j * SLOTS + i]; if (c) c.classList.toggle('study-dark', !s.dark && !s.eligible);
      });
    });
    if (history.hidden) { if (old) old.remove(); return; }
    var key = excluded.join(' ') + '|' + hatched + '|' + sideways;
    if (old && old.getAttribute('data-key') === key) return;
    if (old) old.remove();
    var L = el('div', 'study-legend'); L.setAttribute('data-key', key);
    L.appendChild(el('p', 'lcap', 'legend'));
    function row(marks, text) {
      var r = el('div', 'lrow'), m = el('span', 'lmark');
      marks.forEach(function (k) { m.appendChild(el('i', k)); });
      r.appendChild(m); r.appendChild(el('span', 'ltext', text)); L.appendChild(r);
    }
    row(['lm-bar'], 'search returns from this portion of the source, since S1');
    row(['lm-tri'], 'ROOM ALONE: what the index alone would have dealt this portion of the source');
    row(['lm-zero', 'lm-hollow'], 'no returns yet from this portion of the source');
    if (hatched) row(['lm-hatch'], 'continue returns from this portion of the source');
    L.appendChild(el('p', 'lline', 'each source reads in three portions of its own passages, opening, middle and end; counts since S1 on the scale printed at the left'));
    L.appendChild(el('p', 'lline', 'excluded, under three passages: ' + (excluded.length ? excluded.join(' ') : 'none')));
    history.appendChild(L);
  }
  var numbersT = null;
  function colCentres() {
    var ls = Array.prototype.slice.call(flo.querySelectorAll('[data-mark="column-label"]'));
    if (ls.length !== SLOTS) return null;
    var hr = ls[0].parentElement.getBoundingClientRect(), c = chassis.getBoundingClientRect();
    return ls.map(function (l) { return hr.left - c.left + parseFloat(l.style.left || 0) + parseFloat(l.style.width || 0) / 2; });
  }
  function clearNumbersT() {
    if (numbersT) { if (numbersT.capLine) numbersT.capLine.remove(); numbersT.remove(); numbersT = null; }
    Array.prototype.slice.call(chassis.querySelectorAll('.nt-label')).forEach(function (e) { e.remove(); });
    numbers.classList.remove('study-flat');
  }
  function showNumbersT(on) {
    if (numbersT) { numbersT.hidden = !on; if (numbersT.capLine) numbersT.capLine.hidden = !on; }
    Array.prototype.slice.call(chassis.querySelectorAll('.nt-label')).forEach(function (e) { e.hidden = !on; });
    numbers.classList.toggle('study-flat', on);
  }
  function transposeNumbers() {
    if (sideways) return;
    if (numbers.hidden) { showNumbersT(false); return; }
    var ths = Array.prototype.slice.call(numbers.querySelectorAll('thead th')).map(function (th) { return th.textContent.trim(); });
    var trs = Array.prototype.slice.call(numbers.querySelectorAll('tbody tr')).map(function (tr) {
      return { cells: Array.prototype.slice.call(tr.querySelectorAll('td')).map(function (td) { return td.textContent.trim(); }), focused: tr.classList.contains('focused') };
    });
    var R = readings();
    if (!ths.length || !R || !R.slots) { clearNumbersT(); return; }
    var shape = ths[0] === 'band' ? 'position' : ths[0] === 'passage' ? 'zoom' : ths.indexOf('reached') >= 0 ? 'bypass' : 'returns';
    if (shape === 'zoom' && R.numbers && R.numbers.printedList) { clearNumbersT(); return; }
    var centres = colCentres(); if (!centres) { clearNumbersT(); return; }
    var cap = numbers.querySelector('caption').textContent;
    var key = [cap, shape, trs.map(function (r) { return r.cells.join(',') + (r.focused ? '*' : ''); }).join(';')].join('|');
    if (numbersT && numbersT.getAttribute('data-key') === key) { showNumbersT(true); return; }
    clearNumbersT();
    var keyCols = shape === 'position' ? [0, 1] : [0];
    var qs = []; ths.forEach(function (h, i) { if (keyCols.indexOf(i) < 0) qs.push({ h: h, i: i }); });
    if (shape === 'bypass') {
      var num = function (v) { var x = parseFloat(v); return isNaN(x) ? null : x; };
      var fmt = function (x) { if (x === null) return '\u2014'; var r = Math.round(x * 100) / 100; return String(r); };
      var reachedI = ths.indexOf('reached'), roomI = ths.length - 1;
      var csums = []; for (var ci = 0; ci < SLOTS; ci++) csums.push(0);
      if (R.position && R.position.rows) R.position.rows.forEach(function (row) { row.slots.forEach(function (sl, si) { if (sl.continueN) csums[si] += sl.continueN; }); });
      qs.push({ h: 'less ROOM ALONE', val: function (r) { var a = num(r.cells[reachedI]), b = num(r.cells[roomI]); return (a === null || b === null) ? '\u2014' : fmt(a - b); } });
      qs.push({ h: 'continue', val: function (r, idx, k) { return String(csums[k]); } });
    }
    var bySource = {}; R.slots.forEach(function (s, i) { if (s.source) bySource[s.source] = i; });
    var colOf = shape === 'zoom' ? function (r, idx) { return idx; }
      : function (r) { var k = bySource[r.cells[shape === 'position' ? 1 : 0]]; return k === undefined ? -1 : k; };
    var heads = []; for (var i = 0; i < SLOTS; i++) heads.push('');
    if (shape === 'zoom') trs.forEach(function (r, idx) { if (idx < SLOTS) heads[idx] = r.cells[0]; });
    else R.slots.forEach(function (s, i) { heads[i] = s.source || ''; });
    var focusedCol = -1; trs.forEach(function (r, idx) { if (r.focused) focusedCol = colOf(r, idx); });
    var groups = shape === 'position' ? ['opening', 'middle', 'end'] : [null];
    var pitch = centres[1] - centres[0];
    var dispRect = display.getBoundingClientRect(), c = chassis.getBoundingClientRect();
    var T = document.createElement('table'); T.className = 'numbers-t'; T.setAttribute('data-key', key);
    var capEl = document.createElement('caption'); capEl.className = 'sr-cap'; capEl.textContent = cap; T.appendChild(capEl);
    var capLine = el('div', 'nt-cap', cap); capLine.setAttribute('aria-hidden', 'true');
    var cg = document.createElement('colgroup'); var c0 = document.createElement('col'); c0.style.width = '0'; cg.appendChild(c0);
    for (i = 0; i < SLOTS; i++) { var col = document.createElement('col'); col.style.width = pitch + 'px'; cg.appendChild(col); }
    T.appendChild(cg);
    var famOf = function (h) { return h ? h.charAt(0) : ''; };
    var famFirst = []; var fam = null;
    heads.forEach(function (h, i) { var f = famOf(h); famFirst[i] = !!(f && fam && f !== fam); if (f) fam = f; });
    var thead = document.createElement('thead'), hr = document.createElement('tr');
    hr.appendChild(el('th', 'sr', shape === 'zoom' ? 'passage' : 'source'));
    heads.forEach(function (h, i) { var x = el('th', '', h); x.setAttribute('scope', 'col'); if (famFirst[i]) x.classList.add('fam-first'); if (i === focusedCol) x.classList.add('focused'); hr.appendChild(x); });
    thead.appendChild(hr); T.appendChild(thead);
    var tbody = document.createElement('tbody'), labels = [];
    groups.forEach(function (g, gi) {
      qs.forEach(function (q, qi) {
        var tr = document.createElement('tr'); if (qi === 0 && gi > 0) tr.classList.add('group-first');
        var name = q.h === 'effective' ? 'even-equivalent' : q.h;
        var rh = el('th', 'sr', (g ? g + ' ' : '') + name); rh.setAttribute('scope', 'row'); tr.appendChild(rh);
        var vals = []; for (var k = 0; k < SLOTS; k++) vals.push('');
        trs.forEach(function (r, idx) { if (g && r.cells[0] !== g) return; var k2 = colOf(r, idx); if (k2 >= 0 && k2 < SLOTS) vals[k2] = q.val ? q.val(r, idx, k2) : r.cells[q.i]; });
        vals.forEach(function (v, i2) { if (q.h === 'band') v = v === 'opening' ? 'open' : v === 'middle' ? 'mid' : v; var n = parseFloat(v); if (/^-?\d+\.\d+$/.test(v) && Math.abs(n) >= 100) v = String(Math.round(n)); var clamp = /under 1 passage/.test(v); if (clamp) v = '<1'; var td = el('td', '', v); if (clamp) td.setAttribute('aria-label', 'under 1 passage'); if (famFirst[i2]) td.classList.add('fam-first'); if (i2 === focusedCol) td.classList.add('focused'); if (clamp) td.classList.add('clamp'); tr.appendChild(td); });
        tbody.appendChild(tr);
        labels.push({ lines: name === 'even-equivalent' ? ['even-', 'equivalent'] : name === 'less ROOM ALONE' ? ['less', 'ROOM ALONE'] : (g ? [g, name] : [name]), tr: tr });
      });
    });
    T.appendChild(tbody);
    T.style.left = (centres[0] - pitch / 2 - (dispRect.left - c.left)) + 'px';
    T.style.width = (SLOTS * pitch) + 'px';
    var nRows = groups.length * qs.length;
    var rowH = Math.max(12, Math.min(24, Math.floor((display.clientHeight - 34) / (nRows + 1))));
    T.style.setProperty('--nt-row', rowH + 'px');
    display.appendChild(capLine); display.appendChild(T);
    numbersT = T; T.capLine = capLine;
    numbers.classList.add('study-flat');
    labels.forEach(function (L2) {
      var r = L2.tr.getBoundingClientRect();
      var lab = el('span', 'nt-label'); lab.setAttribute('aria-hidden', 'true');
      L2.lines.forEach(function (t, i3) { if (i3) lab.appendChild(document.createElement('br')); lab.appendChild(document.createTextNode(t)); });
      lab.style.left = (dispRect.left - c.left - chassis.clientLeft - (flo.getAttribute('data-width') === '760' ? 49 : 52)) + 'px';
      lab.style.width = '46px';
      lab.style.top = (r.top - c.top - chassis.clientTop + r.height / 2 - 4 * L2.lines.length) + 'px';
      chassis.appendChild(lab);
    });
  }
  var COUNT_TOPS = { '1': 3, '3': 7, '6': 9, '12': 14, 'all': 33 };
  function countsFoot() {
    if (sideways) return;
    var bypass = flo.getAttribute('data-floor') === 'bypass', zoom = flo.getAttribute('data-zoom') === 'on';
    if (!(bypass || zoom)) return;
    var s = state(), max = COUNT_TOPS[zoom ? String(s.window) : 'all'] || 33;
    var L = (window.__flo && window.__flo.ladder) || { rungs: 11 };
    Array.prototype.slice.call(flo.querySelectorAll('.ladder[data-scale="counts"]')).forEach(function (ld) {
      if (ld.dataset.dark === 'true') return;
      var low = ld.querySelector('.rung.down[data-rung="10"]'), high = ld.querySelector('.rung.up[data-rung="10"]');
      if (!low || !high) return;
      var v = parseFloat(ld.getAttribute('data-value')); if (isNaN(v)) v = 0;
      var n = Math.max(0, Math.min(20, Math.round(v / max * 20))), over = v > max;
      Array.prototype.slice.call(ld.querySelectorAll('.rung')).forEach(function (rg) {
        var r = +rg.getAttribute('data-rung'), up = rg.classList.contains('up'), res = r === L.rungs;
        var lit = res ? (up && over) : (up ? n >= 10 + r : n >= 11 - r);
        if (rg.classList.contains('lit') !== lit) { rg.classList.toggle('lit', lit); rg.setAttribute('data-lit', String(lit)); }
      });
      var lb = ld.getBoundingClientRect(), lo = low.getBoundingClientRect();
      var foot = lb.bottom - lo.bottom;
      flo.style.setProperty('--foot', foot.toFixed(1) + 'px');
      var rungTop = function (m) {
        if (m <= 0) return foot;
        var rg = m <= 10 ? ld.querySelector('.rung.down[data-rung="' + (11 - m) + '"]') : ld.querySelector('.rung.up[data-rung="' + (m - 10) + '"]');
        return rg ? lb.bottom - rg.getBoundingClientRect().top : foot;
      };
      var tickN = null;
      ['.tick', '.ztick'].forEach(function (sel) {
        var t = ld.querySelector(sel); if (!t || t.hidden) return;
        var f = parseFloat(t.getAttribute('data-frac')); if (isNaN(f)) return;
        tickN = Math.max(0, Math.min(20, Math.round(f * 20)));
        var want = rungTop(tickN).toFixed(1) + 'px';
        if (t.style.bottom !== want) t.style.bottom = want;
      });
      var d = ld.querySelector('.dotted');
      if (d && !d.hidden && tickN !== null) {
        var a = rungTop(Math.min(n, tickN)), b = rungTop(Math.max(n, tickN));
        var wb = a.toFixed(1) + 'px', wh = (b - a).toFixed(1) + 'px';
        if (d.style.bottom !== wb) d.style.bottom = wb;
        if (d.style.height !== wh) d.style.height = wh;
      }
    });
  }
  function bypassHatch() {
    if (flo.getAttribute('data-floor') !== 'bypass' || flo.getAttribute('data-zoom') === 'on') return;
    var R = readings(); if (!R || !R.position || !R.position.rows) return;
    var sums = []; for (var i = 0; i < SLOTS; i++) sums.push(0);
    R.position.rows.forEach(function (row) { row.slots.forEach(function (s, i) { if (s.continueN) sums[i] += s.continueN; }); });
    Array.prototype.slice.call(flo.querySelectorAll('.ladder')).forEach(function (ld) {
      var i = +ld.getAttribute('data-col'), h = ld.querySelector('.hatch'); if (!h || isNaN(i)) return;
      var want = ld.dataset.dark !== 'true' && sums[i] > 0;
      if (h.hidden === want) h.hidden = !want;
    });
  }
  var again = false;
  function pass() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      for (var round = 0; round < 3; round++) {
        again = false;
        roles(); align(); caps(); counts(); sbpNote(); here(); lamps(); gate(); fullSpan(); trace(); decorateHistory(); splitNumbers(); position(); transposeNumbers(); countsFoot(); bypassHatch(); focus(); gridOverlay();
        if (!again) break;
      }
    } finally {
      mo.takeRecords(); moFlo.takeRecords();
      busy = false;
    }
  }
  chassis.addEventListener('transitionend', function (ev) { if (ev.target && ev.target.classList && ev.target.classList.contains('cap')) focus(); });
  var mo = new MutationObserver(pass);
  mo.observe(chassis, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-pressed', 'data-dark', 'class', 'style'] });
  var moFlo = new MutationObserver(pass);
  moFlo.observe(flo, { attributes: true, attributeFilter: ['data-grid', 'data-wash', 'data-trace'] });
  pass();
  ['status-run', 'status-room', 'status-note', 'trace-key'].forEach(function (m) {
    if (window.__flo.marks.indexOf(m) < 0) window.__flo.marks.push(m);
  });
  window.__study.glow = true;
  window.__study.here = function (pos) { herePos = pos; paintHere(); };
})();
