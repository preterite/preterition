/**
 * Main JavaScript
 * Handles GIF rotation, tagline rotation, mobile navigation toggle
 */

// Array of GIF filenames (1-120)
const GIFS = Array.from({ length: 120 }, (_, i) => `800abstract00${String(i + 1).padStart(3, '0')}.gif`);

/**
 * Initialize GIF rotation
 * Picks a random GIF from the collection on page load
 */
function initGifRotation() {
  const gifElement = document.getElementById('sidebar-gif');
  if (!gifElement) return;

  // One index drives both halves. GIFS[i] and gifAltText(i) name the same
  // strip by construction -- gif-slugs.js recovered the mapping by MD5 against
  // the archive, 120 matches and 0 mismatches -- so the filename and the alt
  // text cannot drift apart as long as the index is computed once.
  const i = Math.floor(Math.random() * GIFS.length);
  gifElement.src = `/img/800s/${GIFS[i]}`;
  gifElement.alt = typeof gifAltText === 'function'
    ? gifAltText(i)
    : 'abstract gray and green image';
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
 * terms. The strips are aria-hidden decoration and are owed no alt text,
 * which is why this shares the GIFS array but not the slug lookup beside it.
 */
function initStripRotation() {
  const strips = document.querySelectorAll('.strip');
  if (!strips.length || !window.matchMedia) return;

  const mq = window.matchMedia('(min-width: 900px) and (min-height: 520px) and (hover: hover)');

  const assign = () => {
    if (!mq.matches || strips[0].style.backgroundImage) return;
    sampleStrips(strips.length, GIFS.length).forEach((n, k) => {
      strips[k].style.backgroundImage = `url('/img/800s/${GIFS[n]}')`;
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

document.addEventListener('DOMContentLoaded', () => {
  initTrailAlign();
  initGifRotation();
  initStripRotation();
  initTaglineRotation();
  initMobileNav();
  initSmoothScroll();
  initCompactHeader();

  // One-shot animations
  initNavStagger();
  initGifWake();
  initLineDrawOnScroll();

});

/* popstate listener removed: setActiveNavItem was commented out;
   active nav state is set server-side via 'active' class in HTML */
