(function () {
  var me = document.currentScript;
  var mod = me.getAttribute('data-module');
  var ids = (me.getAttribute('data-data') || '').split(',').filter(Boolean);
  var after = (me.getAttribute('data-after') || '').split(',').filter(Boolean);
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
  function ready() {
    return new Promise(function (res) {
      (function poll() {
        var t = window.__feeflo || window.__fee;
        if (t && t.ready) res(); else requestAnimationFrame(poll);
      })();
    });
  }
  Promise.all(ids.map(function (id) {
    return fetch('data/' + id + '.json').then(function (r) {
      if (!r.ok) throw new Error('data/' + id + '.json -> HTTP ' + r.status);
      return r.text();
    }).then(function (text) {
      var s = document.createElement('script');
      s.type = 'application/json'; s.id = id; s.textContent = text;
      document.head.appendChild(s);
    });
  })).then(function () {
    return Promise.all(Array.prototype.map.call(document.fonts, function (f) {
      return f.load().catch(function () {});
    }));
  }).then(function () { return Promise.all([domReady(), document.fonts.ready]); })
    .then(function () { return addScript(mod, 'module'); })
    .then(ready)
    .then(function () {
      return after.reduce(function (pr, src) {
        return pr.then(function () { return addScript(src); });
      }, Promise.resolve());
    }).catch(function (e) {
      console.error('bootstrap: a data file did not load; the instrument was not started', e);
    });
})();
