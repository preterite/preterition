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
 * hidden (RULED 2026-08-18, amended 2026-08-19, reaffirmed 2026-08-25 --
 * site-design-spec.md, "Why these are not alt=''"). The descriptive
 * filename IS the author's name for the strip, so the file is the only
 * source and the picture and its description cannot disagree.
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

  // The strip is drawn as a CSS background rather than an <img> (RULED
  // 2026-08-25): there is no src for Pagefind to capture. It is NOT
  // hidden -- role="img" and aria-label carry the announcement the alt
  // attribute used to, so the 2026-08-18 ruling survives the change of
  // element. One draw sets both, so they cannot name different strips.
  // The no-JS fallback is a noscript rule in head.html; with scripting on
  // this draw is the only strip fetched.
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

  if (!hamburger || !navList) return;

  hamburger.addEventListener('click', () => {
    navList.classList.toggle('open');
  });

  // Close menu when a link is clicked. The nav is flat (RULED 2026-08-21),
  // so every nav item is a leaf and none of them opens a submenu.
  document.querySelectorAll('.nav-item a').forEach(link => {
    link.addEventListener('click', () => {
      navList.classList.remove('open');
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!hamburger.contains(e.target) && !navList.contains(e.target)) {
      navList.classList.remove('open');
    }
  });

  // Close menu on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      navList.classList.remove('open');
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
 * Handle smooth scroll behavior for anchor links
 */
function initSmoothScroll() {
  // matchMedia is the script-side counterpart of a CSS media query: it reads
  // the same user preference the stylesheet reads. The global animation kill
  // switch in responsive.css cannot reach scrollIntoView, since scroll
  // behaviour is neither an animation nor a transition (repair row 12).
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scrollBehavior = prefersReduced ? 'auto' : 'smooth';

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: scrollBehavior });
        }
      }
    });
  });
}

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
 * 1400, 65.1px at 1000 and 56px at 800 (harness, 2026-08-23). Those three
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
    // Edwards" (measured 2026-08-25). The url fallback is for a page that
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
  // showModal cannot run this dialog, and the 2026-08-20 ruling says a
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
  // comment form that does not exist yet (Michael, 2026-08-25): any input,
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

  // Leave no stale result set behind a closed dialog: the next open should
  // start empty rather than showing the last reader's query.
  dialog.addEventListener('close', () => {
    input.value = '';
    list.replaceChildren();
    status.textContent = '';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTrailAlign();
  initGifRotation();
  initStripRotation();
  initTaglineRotation();
  initMobileNav();
  initSmoothScroll();
  initCompactHeader();
  initSearch();

  // One-shot animations
  initNavStagger();
  initGifWake();
  initLineDrawOnScroll();

});

/* popstate listener removed: setActiveNavItem was commented out;
   active nav state is set server-side via 'active' class in HTML */
