// boot.js -- the web build's loader (brief-pair-web.md, Part D). The three
// data files are fetched in parallel, each written into its own
// <script type="application/json"> by its original id, and only then is the
// module (code.js) started, so the instrument code reads the embedded blocks
// exactly as it does in the single-file page and nothing in it changes. A fetch
// that fails leaves its error in the console and on window.__pair.error, and the
// module is not started; no message is invented for the reader.
(function () {
  var files = { 'deck-cues': 'data/deck-cues.json', 'deck-data': 'data/deck-data.json', 'flo-data': 'data/flo-data.json' };
  var studyScripts = ["study-1.js","study-2.js","study-3.js"];
  window.__pair = window.__pair || {};
  function domReady() {
    return new Promise(function (res) {
      if (document.readyState !== 'loading') res();
      else document.addEventListener('DOMContentLoaded', res);
    });
  }
  function addScript(src, type) {
    return new Promise(function (res) {
      var s = document.createElement('script');
      if (type) s.type = type;
      s.src = src; s.onload = res; s.onerror = function () { res(); };
      document.body.appendChild(s);
    });
  }
  function pairReady() {
    return new Promise(function (res) {
      (function poll() { if (window.__pair && window.__pair.ready) res(); else requestAnimationFrame(poll); })();
    });
  }
  Promise.all(Object.keys(files).map(function (id) {
    return fetch(files[id]).then(function (r) {
      if (!r.ok) throw new Error(files[id] + ' -> HTTP ' + r.status);
      return r.text();
    }).then(function (text) {
      var s = document.createElement('script');
      s.type = 'application/json'; s.id = id; s.textContent = text;
      document.head.appendChild(s);
    });
  // Every declared face is loaded, and the body parsed, before the instrument
  // starts, so every text-dependent measurement the instrument and the study
  // layer make (label widths, the SET BY PRESET note's place) is taken against
  // the real faces, not a fallback. Flo's faces (Michroma) are requested only
  // when she mounts, so a bare document.fonts.ready resolves too early -- it is
  // the faces, not just the markup, that must be in before code.js runs, or the
  // study note is measured mid-FOUT and lands over the label.
  })).then(function () {
    return Promise.all(Array.prototype.map.call(document.fonts, function (f) { return f.load().catch(function () {}); }));
  }).then(function () { return Promise.all([domReady(), document.fonts.ready]); })
    .then(function () { return addScript('code.js', 'module'); })
    .then(pairReady)
    .then(function () {
      // the study scripts, in order, only after the instrument is ready and laid
      // out -- the single-file page's order (module, then the study's scripts) --
      // so the study layer measures Flo settled, not mid-mount
      return studyScripts.reduce(function (pr, src) { return pr.then(function () { return addScript(src); }); }, Promise.resolve());
    }).catch(function (e) {
      window.__pair.error = String(e && e.message || e);
      console.error('pair bootstrap: a data file did not load; the instrument was not started', e);
    });
})();
