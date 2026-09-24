/**
 * Main JavaScript
 * Handles GIF rotation, tagline rotation, mobile navigation toggle
 */

// GIFS is a global emitted by _includes/scripts.html, enumerated from
// img/800s/ at build. It holds site-absolute paths. Nothing here names a
// strip file, and no list of them is maintained by hand.

/**
 * Compose a strip's accessible name from its filename. The strips are an
 * identity element, named by the author, and are announced rather than
 * hidden. The descriptive filename IS the author's name for the strip, so
 * the file is the only source and the picture and its description cannot
 * disagree.
 * /img/800s/800witherblister.gif -> 'abstract gray and green image - witherblister'
 * @param {string} path site-absolute path to a strip
 * @returns {string} the accessible name
 */
function stripLabel(path) {
  const slug = path.split('/').pop().replace(/^800/, '').replace(/\.gif$/, '');
  return slug ? `abstract gray and green image - ${slug}` : 'abstract gray and green image';
}


/**
 * Initialize GIF rotation
 * Picks a random GIF from the collection on page load
 */
function initGifRotation() {
  const strip = document.getElementById('sidebar-gif');
  if (!strip) return;
  if (typeof GIFS === 'undefined' || !GIFS.length) return;

  // The strip is drawn as a CSS background rather than an <img>: there is
  // no src for Pagefind to capture. It is NOT hidden -- role="img" and
  // aria-label carry the announcement the alt attribute used to, so the
  // strip is still announced after the change of element. One draw sets
  // both, so they cannot name different strips. The no-JS fallback is a
  // noscript rule in head.html; with scripting on this draw is the only
  // strip fetched.
  const path = GIFS[Math.floor(Math.random() * GIFS.length)];
  strip.style.backgroundImage = `url('${path}')`;
  strip.setAttribute('aria-label', stripLabel(path));
}

/**
 * Initialize tagline rotation
 * Picks a random tagline from TAGLINES array
 * Used on regular pages (sidebar) and weblog header (subtitle)
 */
function initTaglineRotation() {
  if (typeof TAGLINES === 'undefined') return;

  // Two homes, one draw. #tagline-text is the sidebar's box on the
  // professional pages; .tagline span is the landing page's stack of four
  // layers, three of them aria-hidden ghosts drifting behind the live one.
  // They must all carry the same string: the offset drifts, not the text.
  const sidebar = document.getElementById('tagline-text');
  const layers = document.querySelectorAll('.tagline span');
  if (!sidebar && !layers.length) return;

  const randomTagline = TAGLINES[Math.floor(Math.random() * TAGLINES.length)];
  if (sidebar) sidebar.textContent = `${randomTagline}`;
  layers.forEach((el) => { el.textContent = randomTagline; });
}

/**
 * Mobile navigation toggle
 * Shows/hides nav menu when hamburger button is clicked
 */
function initMobileNav() {
  const hamburger = document.querySelector('.hamburger');
  const navList = document.querySelector('.nav-list');
  const header = document.querySelector('header');

  if (!hamburger || !navList) return;

  // One writer for the drawer's state, so the class and the announcement
  // cannot disagree: the class alone was toggled, and aria-expanded stayed
  // false through every open.
  //
  // The top padding is measured rather than declared. It was a fixed 80px,
  // sized for a header that was fixed and one line tall; the header is
  // static now and its height follows its content, so the first items sat
  // behind it. The height is a function of the width the reader is at.
  const setDrawer = (open) => {
    navList.classList.toggle('open', open);
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && header) {
      navList.style.paddingTop = header.getBoundingClientRect().height + 'px';
    }
  };

  hamburger.addEventListener('click', () => {
    setDrawer(!navList.classList.contains('open'));
  });

  // Close menu when a link is clicked. The nav is flat,
  // so every nav item is a leaf and none of them opens a submenu.
  document.querySelectorAll('.nav-item a').forEach(link => {
    link.addEventListener('click', () => {
      setDrawer(false);
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !navList.contains(e.target)) {
      setDrawer(false);
    }
  });

  // Close menu on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setDrawer(false);
    }
  });
}

/**
 * Set active navigation item based on current page
 * Compares current URL to nav links
 *
 * function setActiveNavItem() {
 * const currentPage = window.location.pathname.split('/').filter(Boolean).pop() || 'index.html';
 * const navLinks = document.querySelectorAll('.nav-item a');
 *
 * navLinks.forEach(link => {
 *   const href = link.getAttribute('href');
 *   if (href === currentPage || (currentPage === '' && href === 'index.html')) {
 *     link.parentElement.classList.add('active');
 *   } else {
 *     link.parentElement.classList.remove('active');
 *   }
 * });
 * }
 */

/**
 * Nav stagger animation
 * Fades nav items in left-to-right with staggered delay
 * Fires once on page load
 */
function initNavStagger() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const items = document.querySelectorAll('.nav-item');
  if (!items.length) return;

  // Mark all items as hidden
  items.forEach(item => item.classList.add('stagger-init'));

  // Stagger them in after a brief pause for page settle
  setTimeout(() => {
    items.forEach((item, i) => {
      setTimeout(() => item.classList.add('stagger-in'), i * 60);
    });
  }, 150);
}

/**
 * GIF wake animation
 * Sidebar GIF starts dimmed/desaturated, fades to full color
 * Fires once after nav stagger completes
 */
function initGifWake() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  const gif = document.getElementById('sidebar-gif');
  if (!gif) return;

  // Start dormant
  gif.classList.add('gif-dormant');

  // Wake up after nav stagger finishes (~150ms + 8 items * 60ms = ~630ms)
  setTimeout(() => gif.classList.add('gif-awake'), 800);
}

/**
 * Emerald line draw animation
 * Card left-border pseudo-element grows from 0 to full height
 * Fires once per card as it enters the viewport
 */
function initLineDrawOnScroll() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    // Just show borders immediately
    document.querySelectorAll('.card, .blog-card').forEach(card => {
      card.classList.add('line-drawn');
    });
    return;
  }

  const cards = document.querySelectorAll('.card, .blog-card');
  if (!cards.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('line-drawn');
        observer.unobserve(entry.target); // one-shot: stop watching
      }
    });
  }, {
    threshold: 0.15,      // trigger when 15% visible
    rootMargin: '0px 0px -40px 0px'  // slight offset so cards just above fold don't trigger
  });

  cards.forEach(card => observer.observe(card));
}

/**
 * Compact header on scroll
 * Compresses header to a slim bar when user scrolls down
 * Restores full header when scrolled back to top
 */
function initCompactHeader() {
  let scrollThreshold = 60;  // px scrolled before compressing
  let isCompact = false;

  function checkScroll() {
    const scrollTop = document.documentElement.scrollTop || window.scrollY || document.body.scrollTop;
    const shouldBeCompact = scrollTop > scrollThreshold;
    if (shouldBeCompact !== isCompact) {
      isCompact = shouldBeCompact;
      document.body.classList.toggle('header-compact', isCompact);
    }
  }

  // Use passive listener for scroll performance
  window.addEventListener('scroll', checkScroll, { passive: true });

  // Check initial state (in case page loads scrolled)
  checkScroll();
}

/**
 * Draw n distinct indices from 0..count-1 by partial Fisher-Yates: walk the
 * first n positions of the pool, swapping each with a random position at or
 * after it, then slice. This is sampling WITHOUT replacement -- n independent
 * draws from the pool collide often enough at this size to read as a bug
 * rather than as chance, and a repeated strip in the wall looks like damage.
 * @param {number} n how many to draw
 * @param {number} count size of the pool
 * @returns {number[]} n distinct zero-based indices
 */
function sampleStrips(n, count) {
  const pool = Array.from({ length: count }, (_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (count - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

/**
 * Fill the landing page's strip wall -- one random GIF per spine -- but only
 * while the wide layout is live. The narrow layout sets .strip to
 * display:none, so assigning unconditionally would make a phone fetch images
 * it never shows. matchMedia is the script-side counterpart of a CSS media
 * query and is the feature test here; its change event covers a resize into
 * the wide layout after load, and the guard on backgroundImage keeps a later
 * resize from redrawing the wall under a reader already looking at it.
 *
 * The query string must stay identical to the wide gate in css/style.css and
 * to the noscript block in _layouts/index.html -- three copies of one
 * condition, since a container query cannot express the height or pointer
 * terms. The strips are aria-hidden decoration and are owed no alt text, so
 * this uses the pool's paths directly and never composes a description.
 */
function initStripRotation() {
  const strips = document.querySelectorAll('.strip');
  if (!strips.length || !window.matchMedia) return;
  if (typeof GIFS === 'undefined' || !GIFS.length) return;

  const mq = window.matchMedia('(min-width: 900px) and (min-height: 520px) and (hover: hover)');

  const assign = () => {
    if (!mq.matches || strips[0].style.backgroundImage) return;
    sampleStrips(strips.length, GIFS.length).forEach((n, k) => {
      strips[k].style.backgroundImage = `url('${GIFS[n]}')`;
    });
    // .landing.strips-lit .strip fades them in; the class goes on <body>,
    // which already carries .landing on this page and only this page.
    document.body.classList.add('strips-lit');
  };

  assign();
  mq.addEventListener('change', assign);
}

/**
 * Initialize all functionality on DOM ready
 */
/**
 * Align the 404's trail with the first nav label.
 *
 * This is the ONLY page with a trail and the alignment target is not a
 * value CSS can name. `nav .nav-item` is `flex: 1 1 auto` with centered
 * text, so each cell sizes to its label and then absorbs an equal share of
 * the bar's slack: the inked left edge of "Index" measured 85.1px at
 * 1400, 65.1px at 1000 and 56px at 800. Those three
 * are not three breakpoints -- the first two sit inside the same media
 * query -- so the target moves continuously with viewport width and no
 * constant, page-scoped or not, can hold it.
 *
 * So the alignment is measured at run time and written as an inline
 * padding-left on the trail. Concepts: Range.getBoundingClientRect(),
 * which gives the box of the TEXT rather than of the element holding it
 * -- the label is centered, so the element box says nothing about where
 * the word starts; document.fonts.ready, because the mono face's metrics
 * decide the label width and measuring before it loads measures the
 * fallback; and a resize listener, because the target is a function of
 * viewport width.
 *
 * WITHOUT JAVASCRIPT the trail keeps its stylesheet value and sits at the
 * content column's own left edge, which is a defensible alignment rather
 * than a broken one. That is the no-JS baseline and it is why this is a
 * progressive enhancement and not a requirement.
 */
function initTrailAlign() {
  if (!document.body.classList.contains('has-trail')) return;
  const trail = document.querySelector('.breadcrumbs');
  const text = document.querySelector('.breadcrumbs-content');
  const label = document.querySelector('.nav-item a');
  if (!trail || !text || !label) return;

  const align = () => {
    // The drawer takes over at narrow widths and the bar stops rendering.
    // There is no label to align to, so the stylesheet value stands.
    if (!label.getClientRects().length) { trail.style.paddingLeft = ''; return; }
    trail.style.paddingLeft = '';
    const range = document.createRange();
    range.selectNodeContents(label);
    const labelLeft = range.getBoundingClientRect().left;
    const trailLeft = trail.getBoundingClientRect().left;
    if (labelLeft <= trailLeft) return;   // never pull the trail leftward
    trail.style.paddingLeft = (labelLeft - trailLeft) + 'px';
  };

  align();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(align);
  let t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(align, 100);
  });
}

/**
 * How many results get their data fetched. Pagefind returns lazy handles;
 * the rest of a large result set is never touched.
 */
const SEARCH_MAX_RESULTS = 10;

/**
 * The cached Pagefind module promise. Assigned on first open and re-used,
 * so a reader who opens the dialog five times loads the engine once.
 */
let pagefindLoad = null;

/**
 * Load and initialise Pagefind, once.
 *
 * Concept: dynamic import(). pagefind.js is an ES module that pulls a WASM
 * binary behind it, so importing it at page load would make every reader
 * fetch a search engine they did not ask for. import() returns a promise
 * and is legal inside a classic script, which is why this file needs no
 * type="module" and the script tag in scripts.html is unchanged.
 * @returns {Promise<object>} the initialised Pagefind module
 */
function loadPagefind() {
  if (!pagefindLoad) {
    pagefindLoad = import('/pagefind/pagefind.js').then(async (pf) => {
      await pf.init();
      return pf;
    });
  }
  return pagefindLoad;
}

/**
 * Draw a result set into the dialog.
 *
 * The excerpt is assigned with innerHTML because Pagefind wraps each hit in
 * <mark> and escapes everything else itself. The string is this site's own
 * build output rather than anything a reader supplied, so there is no
 * untrusted input here -- worth saying out loud, since innerHTML is the
 * line where that question is normally asked.
 * @param {Array} results Pagefind result handles
 * @param {HTMLElement} list the <ul> to fill
 * @param {HTMLElement} status the live region to announce into
 */
async function renderSearchResults(results, list, status) {
  list.replaceChildren();
  if (!results.length) {
    status.textContent = 'No results.';
    return;
  }
  const shown = Math.min(results.length, SEARCH_MAX_RESULTS);
  const noun = results.length === 1 ? 'result' : 'results';
  status.textContent = shown < results.length
    ? results.length + ' ' + noun + ', showing the first ' + shown + '.'
    : results.length + ' ' + noun + '.';

  const data = await Promise.all(results.slice(0, shown).map((r) => r.data()));
  data.forEach((d) => {
    const li = document.createElement('li');
    li.className = 'search-result';
    const a = document.createElement('a');
    a.href = d.url;
    // meta.title is supplied by data-pagefind-meta in page.html and
    // post.html. Left to itself Pagefind takes the first <h1>, which here
    // is the header's identity line, so every hit would read "Mike
    // Edwards". The url fallback is for a page that
    // somehow carries no title rather than for the normal case.
    a.textContent = (d.meta && d.meta.title) ? d.meta.title : d.url;
    const p = document.createElement('p');
    p.className = 'search-excerpt';
    p.innerHTML = d.excerpt;
    li.append(a, p);
    list.append(li);
  });
}

/**
 * Wire the search controls to the Pagefind index.
 *
 * Two controls, one dialog. .search-trigger is the header's hexagon on the
 * professional pages, the weblog and the 404; .hex is the landing page's,
 * authored in index.md and carrying its clip-path on the button itself.
 * Both are already real buttons with an accessible name, so this adds
 * behaviour and no markup.
 *
 * showModal() rather than show() or a class toggle: it puts the dialog in
 * the TOP LAYER, above every stacking context, and brings focus trapping,
 * Escape-to-close and inert background content with it. A closed <dialog>
 * is display:none from the user-agent stylesheet, so nothing hides it here.
 *
 * debouncedSearch() rather than search(): Pagefind's own 300ms debounce, so
 * a fast typist issues one query rather than eight. It resolves to null for
 * a call a later keystroke superseded, which is the signal to drop a stale
 * render rather than paint it over a newer one.
 */
function initSearch() {
  const dialog = document.getElementById('search-dialog');
  const input = document.getElementById('search-input');
  const list = document.getElementById('search-results');
  const status = document.getElementById('search-status');
  const triggers = document.querySelectorAll('.search-trigger, .hex');
  if (!dialog || !input || !list || !status || !triggers.length) return;

  // Feature detection, and the failure mode matters. An engine without
  // showModal cannot run this dialog, and a
  // control that does nothing is worse than one hidden -- so the triggers
  // go, exactly as the noscript branch in head.html does it. Neither
  // .search-trigger nor .hex declares `display`, so the [hidden] rule in
  // the user-agent stylesheet is not being outbid.
  if (typeof dialog.showModal !== 'function') {
    triggers.forEach((t) => { t.hidden = true; });
    return;
  }

  const unavailable = 'Search is unavailable: the index did not load.';

  const open = () => {
    dialog.showModal();
    input.focus();
    loadPagefind().catch(() => { status.textContent = unavailable; });
  };

  triggers.forEach((t) => t.addEventListener('click', open));

  // "/" opens search from anywhere. The guard is written by element KIND
  // rather than by a list of known fields, so it already holds for a weblog
  // comment form that does not exist yet: any input,
  // textarea, select or contenteditable region swallows the key. A comment
  // form served inside an iframe never delivers keydown to this document at
  // all, so that case is covered by the platform rather than here.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || dialog.open) return;
    const el = e.target;
    if (el && el.isContentEditable) return;
    if (el && el.closest && el.closest('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    open();
  });

  // A monotonic ticket per keystroke. Pagefind's null covers its own
  // debounce; this covers the await, where a slow data fetch for "af" can
  // still land after a fast one for "afghanistan".
  let seq = 0;
  input.addEventListener('input', async () => {
    const query = input.value.trim();
    const mine = ++seq;
    if (!query) {
      list.replaceChildren();
      status.textContent = '';
      return;
    }
    let pf;
    try {
      pf = await loadPagefind();
    } catch (err) {
      status.textContent = unavailable;
      return;
    }
    const search = await pf.debouncedSearch(query, {}, 300);
    if (search === null || mine !== seq) return;
    renderSearchResults(search.results, list, status);
  });

  // Light dismiss, so a reader who does not know Escape can click away.
  // closedby="any" on the element is the declarative form and the browser
  // does the hit-testing; this branch runs only where that attribute is
  // unimplemented -- Safari, at this writing. Delete the whole block when
  // closedby reaches Baseline.
  //
  // Both conditions are required, and each alone is wrong for THIS dialog.
  // e.target === dialog is the pattern written everywhere, and .search-dialog
  // carries its own padding, so a click on the band between its border and
  // its content also targets the dialog element and would close it. The rect
  // test alone fails the other way: select text inside, drag past the edge,
  // release, and the click reports coordinates outside. Together they are
  // exact. close() rather than requestClose(), which shipped alongside
  // closedBy and so is absent wherever this branch runs.
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const inside = e.clientX >= box.left && e.clientX <= box.right
                  && e.clientY >= box.top && e.clientY <= box.bottom;
      if (!inside) dialog.close();
    });
  }

  // Leave no stale result set behind a closed dialog: the next open should
  // start empty rather than showing the last reader's query.
  dialog.addEventListener('close', () => {
    input.value = '';
    list.replaceChildren();
    status.textContent = '';
  });
}

/**
 * Comment replies that never leave the page.
 *
 * Each comment on an entry page carries a Reply link whose href is the
 * comment service's own reply page -- the destination a reader with
 * scripting off reaches. With scripting on, this intercepts the click and
 * does the same job here: it copies the comment's id into the form's hidden
 * `replying-to` field, tells the reader whose comment they are answering,
 * and moves them to the textarea. The service reads the hidden field when
 * the form is sent and files the new comment as a reply.
 *
 * Event delegation: one listener on the thread, not one per Reply link.
 * A click anywhere inside the list bubbles up to the list, and
 * `closest('.comment-reply')` asks whether it started on a Reply link;
 * the data attributes on that link carry what the form needs. The cancel
 * control in the reply note undoes all of it. Everything is guarded on
 * the elements existing, because this runs on every page that loads the
 * script and only entry pages carry a thread.
 */
function initCommentReply() {
  const thread = document.querySelector('.comment-list');
  const field = document.getElementById('replying-to');
  const note = document.getElementById('reply-note');
  const name = document.getElementById('reply-to-name');
  const cancel = document.getElementById('reply-cancel');
  const message = document.getElementById('comment-message');
  if (!thread || !field || !note || !name || !cancel || !message) return;

  thread.addEventListener('click', (e) => {
    const link = e.target.closest('.comment-reply');
    if (!link) return;
    e.preventDefault();
    field.value = link.dataset.replyTo || '';
    name.textContent = link.dataset.replyName || 'this comment';
    note.hidden = false;
    message.focus();
    message.scrollIntoView({ block: 'center' });
  });

  cancel.addEventListener('click', () => {
    field.value = '';
    name.textContent = '';
    note.hidden = true;
    message.focus();
  });
}

/**
 * The header's finite motion event.
 *
 * One event per visit. It waits a random span, weighted toward the long end,
 * runs two passes on the header's upper moire screen, and stops with the end
 * state held. Nothing loops and nothing is left ticking afterwards, which is
 * the whole point: the ornament is paid for once rather than continuously.
 *
 * Four mechanisms, each small, each named where it happens:
 *
 * 1. THE ONSET. Math.sqrt of a uniform random number piles the mass toward
 *    the high end of a range, so 30 + 90 * sqrt(u) seconds has a median near
 *    94 -- a visit shorter than a minute and a half mostly never sees the
 *    event at all, which is what makes it a surprise rather than a feature.
 * 2. A PASS IS A CLASS. Adding .p1 starts the animations css/style.css
 *    declares for it. This script never animates anything itself; it only
 *    switches classes on and off, which is what keeps the work on the
 *    compositor and off the main thread.
 * 3. THE BAKE. When a pass ends, its computed opacity and transform are
 *    written into the element's inline style and the class comes off. The
 *    animation then stops existing while the reader still sees its result,
 *    and the browser is free to throw away the GPU texture it was holding.
 * 4. SEEN OR UNSEEN. If the reader is on another tab when the timer fires,
 *    the event arms instead of running and fires when they come back: the
 *    return is the trigger. This uses the Page Visibility API rather than an
 *    IntersectionObserver on the header, because this site's header is
 *    position: fixed and so never leaves the viewport -- an observer here
 *    would report "visible" always and the arming branch would be dead code.
 *
 * REDUCED MOTION. responsive.css carries a site-wide
 * `* { animation: none !important }`, so under that preference no animation
 * runs and no animationend ever fires. The end state is written straight in
 * instead, which is what initNavStagger and initLineDrawOnScroll already do
 * for their own motion: the reader reaches the same page, without watching it
 * get there.
 */
function initHeaderEvent() {
  const upper = document.getElementById('header-moire');
  if (!upper) return;

  // The 100% values of the moire keyframes in css/style.css. They are named
  // here as well because an end state applied without an animation -- the
  // reduced-motion path -- has no animation to read them from. If a keyframe
  // changes, this changes with it.
  const PASSES = [
    { cls: 'p1', opacity: '0.5',  transform: 'translate(9px, -4px) rotate(0.5deg)' },
    { cls: 'p2', opacity: '0.65', transform: 'translate(-6px, 3px) rotate(-0.35deg)' }
  ];
  const BEAT_MS = 2000;  // the pause between the two passes
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const hold = (pass) => {
    upper.style.opacity = pass.opacity;
    upper.style.transform = pass.transform;
  };

  // The longest duration the stylesheet declares for whatever is running, in
  // seconds, or 0 when nothing is. The stylesheet stays the single source for
  // the timings; this only reads them back.
  const longestSeconds = () => {
    const declared = getComputedStyle(upper).animationDuration || '';
    return declared.split(',').reduce((m, s) => Math.max(m, parseFloat(s) || 0), 0);
  };

  const runPass = (i) => {
    const pass = PASSES[i];
    if (!pass) return;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      upper.removeEventListener('animationend', onEnd);
      const cs = getComputedStyle(upper);
      upper.style.opacity = cs.opacity;
      upper.style.transform = cs.transform;
      upper.classList.remove(pass.cls);
      if (i + 1 < PASSES.length) setTimeout(() => runPass(i + 1), BEAT_MS);
    };
    // Two animations share each pass and share a duration, so the first
    // animationend is the end of the pass; the guard keeps the second from
    // running this twice.
    const onEnd = (e) => { if (e.target === upper) finish(); };
    upper.addEventListener('animationend', onEnd);
    upper.classList.add(pass.cls);
    // Backstop. An animation that never starts never ends, and a pass that
    // never ends would leave the screen at opacity 0 for good. Read the
    // duration after the class is on, and give it a margin.
    setTimeout(finish, longestSeconds() * 1000 + 1500);
  };

  let armed = false;
  const fire = () => {
    if (document.visibilityState === 'hidden') { armed = true; return; }
    if (prefersReduced) { hold(PASSES[PASSES.length - 1]); return; }
    runPass(0);
  };

  document.addEventListener('visibilitychange', () => {
    if (armed && document.visibilityState === 'visible') {
      armed = false;
      fire();
    }
  });

  setTimeout(fire, (30 + 90 * Math.sqrt(Math.random())) * 1000);
}

/**
 * Open the colophon's page-cost plate.
 *
 * The same shape as initSearch's opener and for the same reasons: showModal()
 * puts the dialog in the top layer, so no rule sets a z-index, and the focus
 * trap, Escape-to-close and inert background all come from the platform.
 *
 * Where it differs from search, and the difference is the point. An engine
 * without showModal, or a reader with scripting off, gets the plate rendered
 * INLINE rather than hidden. The search control is hidden in that case because
 * there is no static shape of site search to degrade to; the plate is not a
 * control but the evidence for a claim the paragraph makes, so hiding it would
 * leave the claim unsupported for exactly the reader most likely to test it.
 * The scripting-off half is a noscript rule beside the dialog in
 * pages/about.md; this function covers the no-showModal half.
 */
function initPerfPlate() {
  const dialog = document.getElementById('perf-plate');
  const trigger = document.querySelector('.perf-plate-trigger');
  if (!dialog || !trigger) return;

  if (typeof dialog.showModal !== 'function') {
    dialog.classList.add('perf-plate-inline');
    trigger.hidden = true;
    return;
  }

  trigger.addEventListener('click', () => dialog.showModal());

  // Light dismiss where closedby="any" is unimplemented -- Safari, at this
  // writing. Both conditions are required and the reasoning is initSearch's,
  // unchanged: this dialog also carries its own padding, so a click on the
  // band between its border and its content targets the dialog element too.
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    dialog.addEventListener('click', (e) => {
      if (e.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      const inside = e.clientX >= box.left && e.clientX <= box.right
                  && e.clientY >= box.top && e.clientY <= box.bottom;
      if (!inside) dialog.close();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initTrailAlign();
  initGifRotation();
  initStripRotation();
  initTaglineRotation();
  initMobileNav();
  initCompactHeader();
  initSearch();
  initPerfPlate();
  initCommentReply();
  initHeaderEvent();

  // One-shot animations
  initNavStagger();
  initGifWake();
  initLineDrawOnScroll();

});

/* popstate listener removed: setActiveNavItem was commented out;
   active nav state is set server-side via 'active' class in HTML */
