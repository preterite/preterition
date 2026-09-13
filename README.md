# preterite.net

The personal and professional site of Mike Edwards, Associate Professor of
Rhetoric and Composition in the Department of English at Washington State
University. A static Jekyll site: semantic HTML, CSS Grid and Flexbox,
vanilla JavaScript, self-hosted fonts, no frameworks, and no third-party
requests at page load.

Beneath the professional pages sits a weblog that has run continuously
since June 2003.

## Features

- **Static Jekyll build.** Kramdown with GFM input, built by GitHub
  Actions rather than by Pages' native builder.
- **No third-party requests.** Fonts, scripts and stylesheets are served
  from this origin. Nothing is fetched from a CDN, a font host or an
  analytics service when a page loads.
- **Vanilla JavaScript only.** No framework, no bundler, no
  transpilation. Every page is usable with scripting disabled.
- **The weblog, whole.** Published posts, drafts, comments, and the
  pingback and trackback network around them. Retired permalinks
  are honoured by generated redirect stubs.
- **Comments without an account.** A plain form posts to a hosted
  service, which validates and spam-checks the comment and commits it to
  the repository as a file. No asset is fetched from the service.
- **Month and category archives,** generated from the posts themselves.
- **Site search** through Pagefind.
- **Atom feed** at `/feed.xml`.
- **One designed look** rather than a theme switcher.
- **Print styles.** A post reaches paper legible and uncut, with
  quotations, lists and preformatted blocks intact.

## Directory Structure

Criteria, not members: what a folder holds is read by listing it.

Root split is by role, not by media type. Page chrome sits at the root beside
the markup that calls it; content sits under `resources/`, where a page's
prose links it.

| Folder | Criterion |
| --- | --- |
| `*.md` at the root | The professional pages' sources, one per deployed root-level page, named for the deployed file. |
| `_config.yml`, `Gemfile` | The Jekyll build's configuration and its gem set. |
| `_includes/`, `_layouts/`, `_plugins/`, `_data/`, `_calendar/`, `_scripts/` | The build's own folders: consumed by Jekyll and never deployed as paths. `_data/` holds what the widgets read, `_calendar/` the committed calendar, `_scripts/` build-side scripts. |
| `css/` | Stylesheets. |
| `js/` | Scripts, including those whose content is data expressed as a JavaScript array. |
| `fonts/` | Self-hosted WOFF2 faces, subset. |
| `img/` | Chrome: decoration and interface imagery the layout emits without a page asking for it -- the abstract strips, the favicon and logotype set. Never content. |
| `resources/` | Content: every file a page's prose links -- PDFs, slides, presentation scripts, the campus map, the CV. Flat, with no subdivision by media type, so the filename is the only organizing principle and the public address at once. `_source/` beneath it holds what the published files are rendered from and does not deploy. |
| `weblog/` | The weblog: its index, `_posts/`, `_drafts/`, and `assets/`, one flat folder for every image and file a post links. |

## Browser Support

Verified in Chromium, Firefox and WebKit through an automated browser
harness. Layout is built on CSS Grid, Flexbox, custom properties and logical
properties. No version floor beneath the support those features already
have is claimed here.

## Accessibility

Benchmark: WCAG 2.2 Level AA, with attention to WCAG 2.1 AA and Section
508. The standards are shared vocabulary rather than a substitute for
judgement. Commitment is not discharged by conformance.

The operational floor:

- Contrast of 4.5:1 for normal text, 3:1 for large text and interface
  components.
- Every interactive element reachable by keyboard, with a visible focus
  indicator.
- Meaningful `alt` on images; `alt=""` on decorative ones.
- A skip link to main content.
- `prefers-reduced-motion` respected: every animation has a
  reduced-motion fallback.
- Semantic HTML (`nav`, `main`, `aside`, `article`), with ARIA only where  semantic HTML is insufficient.
- Form inputs labelled with `label`, never by placeholder alone.
- Focus managed on dialogs and on mobile navigation.
- Meaning never carried by colour alone: shape, icon, label or pattern
  carries it alongside.

## Performance

The properties here are structural:

- No third-party request at page load: no extra DNS lookup, no extra
  handshake, and nothing blocking on another origin's availability.
- Self-hosted WOFF2 faces, subset to the codepoints the site serves.
- No framework runtime and no bundle. The JavaScript is hand-written and
  small enough to read.
- Static HTML, cacheable indefinitely and served from a CDN-backed host.
- Page backgrounds are static rather than animated, so a long page at
  rest does not occupy the main thread.

## License

Site content is licensed CC BY-NC-SA 4.0. See `LICENSE.txt`.

## Contact

https://preterite.net/contact.html
