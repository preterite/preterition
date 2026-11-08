

const SCHEMAS = ['zoe-2.1'];

function makeRun(exp, entry = null, passages = null) {
  if (!SCHEMAS.includes(exp.schema_version)) {
    throw new Error(`schema ${exp.schema_version} is not one this model reads`);
  }
  const N = exp.N;
  if (exp.sessions.length !== N) {
    throw new Error(`${exp.run}: ${exp.sessions.length} sessions against N ${N}`);
  }
  const key = exp.bars ? exp.bars.baseline : null;
  const base = key && passages && passages[key] && passages[key].bands ? passages[key] : null;
  return {
    id: exp.run,
    N,
    begun: exp.begun_session,
    term: exp.term,
    passage: exp.passage,
    knobs: entry ? entry.knobs : null,
    sentence: entry ? entry.term_rule_sentence : null,
    told: entry ? entry.told : null,
    base,
    exp,
  };
}

function clamp(run, kf) {
  return Math.min(Math.max(kf, 0), run.N);
}

function head(run, kf) {
  const x = clamp(run, kf);
  const k = Math.floor(x);
  const frac = x - k;
  return {
    kf: x,
    k,
    frac,
    atRest: frac === 0,
    atLeader: x === 0,
    atEnd: x === run.N,
    session: k >= 1 ? k : null,
  };
}

function packs(run, kf) {
  const { k, frac } = head(run, kf);
  const N = run.N;
  return {
    takeup: Math.max(k - 1, 0) + (k >= 1 ? frac : 0),
    supply: Math.max(N - k - 1, 0) + (k + 1 <= N ? 1 - frac : 0),
  };
}


const HELD = {
  ordinary_letter: 'letter',
  empty_letter_notice: 'empty notice',
};

function slotKind(received) {
  const sl = received.slot || {};
  if (sl.held === 'response_as_it_stood') {
    return sl.held_empty ? 'empty refusal' : 'response as it stood';
  }
  if (sl.held) return HELD[sl.held] || sl.held;
  const ch = received.channels || [];
  if (ch.length === 1 && ch[0] === 'nothing') return 'nothing';
  return 'received';
}

function slotGrain(run, s, received) {
  const sl = received.slot || {};
  if (sl.held) {
    if (!sl.grain) return { rows: null, absent: sl.grain_absent || 'not recorded' };
    return { rows: sl.grain.map(g => ({ label: g.label, count: g.count, absent: null })), absent: null };
  }
  if (s === 1) return { rows: null, absent: 'no earlier session' };
  const rows = [...run.exp.stack].sort((a, b) => a.rank - b.rank).map(r => ({
    label: r.label,
    count: r.counts_by_written_at ? r.counts_by_written_at[s - 2] : null,
    absent: r.counts_by_written_at ? null : (r.absent || 'not recorded'),
  }));
  return { rows, absent: null };
}

function bandOf(run, s) {
  if (!run.base || s > 36) return null;
  const b = run.base.bands[Math.floor((s - 1) / 6)];
  return { name: b.band, value: b.value, verdict: b.verdict, confound: b.confound || null };
}

function frame(run, s) {
  if (!Number.isInteger(s) || s < 1 || s > run.N) return null;
  const e = run.exp;
  const sess = e.sessions[s - 1];
  const letterIn = e.letters.find(L => L.written_at === s - 1) || null;
  const letterOut = e.letters.find(L => L.written_at === s) || null;
  const page = e.pages.find(p => p.session === s) || null;
  const delivered = e.deliveries.filter(d => d.session === s);
  const other = e.other_term_deliveries.filter(d => d.session === s);
  const arc = e.reader_arc;
  const bars = e.bars;
  const kind = slotKind(sess.received);
  return {
    session: s,
    status: sess.status,
    editor: sess.editor_session,
    time: sess.time,
    slot: {
      kind,
      channels: sess.received.channels,
      from: sess.received.from_sessions,
      after: (sess.received.slot || {}).held_after || null,
      notice: (sess.received.slot || {}).notice || null,
      rung: letterIn ? letterIn.rung : null,
      prohibition: letterIn ? letterIn.prohibition : false,
      grain: slotGrain(run, s, sess.received),
    },
    frame: {
      catalog: e.catalog_line_sessions.includes(s),
      delivery: delivered.length > 0,
      quotesTerm: delivered.some(d => d.query_quotes_term),
      otherTermDeliveries: other.length,
      page: page ? page.rung : null,
    },
    letterOut: letterOut ? letterOut.rung : null,
    arc: s >= arc.from.session && s <= arc.to.session,
    relay: !!(letterIn && letterIn.rung !== 'not_taken' && delivered.length === 0),
    bars: {
      semantic: bars.semantic_distance[s - 1],
      running: bars.session_running[s - 1],
      gap: bars.return_gap[s - 1],
    },
    band: bandOf(run, s),
  };
}

function at(run, kf) {
  const h = head(run, kf);
  return {
    head: h,
    packs: packs(run, kf),
    window: [h.k - 1, h.k, h.k + 1].map(s => frame(run, s)),
    current: frame(run, h.k),
  };
}



function g(x) {
  if (!Number.isFinite(x)) throw new Error(`g: ${x} is not a finite number`);
  if (Object.is(x, -0)) return '-0';
  const a = Math.abs(x);
  if (a !== 0 && (a < 1e-4 || a >= 1e6)) throw new Error(`g: ${x} would take exponent form`);
  let s = x.toPrecision(6);
  const exact = a.toPrecision(40).replace('.', '').replace(/^0+/, '');
  if (exact[6] === '5' && /^0*$/.test(exact.slice(7))) {
    const sixth = Number(exact[5]);
    if (sixth % 2 === 0) {
      const q = x.toPrecision(7);
      s = q.slice(0, q.length - 1);
    }
  }
  if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
  return s;
}

const GROUND = '#1a1f1b', PANEL = '#20261f', GUIDE = '#3a423a';
const INK = '#ede8e2', MUTED = '#8b9489';
const SKY = '#a3d2f2', GOLD = '#c9a227', PEACOCK = '#3a78b0', CORAL = '#e96f7f';
const SANS = "'IBM Plex Sans', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const FSS = 9.5;

const FW = 18.0, SW = 16.0, LANE = 16.0, GAPL = 10.0, G = 7.0, MK = 5.0, BAR = 12.0;

const TONES = { r1: '#9fdccd', r2: '#b9a9e2', r3: '#d6bd7c', r4: '#76a7b8' };

const LANES = [['catalog', 0], ['delivery', 0],
  ['copied', 1], ['in_hand', 1], ['by_name', 1], ['not_taken', 1],
  ['off', 2],
  ['r1', 3], ['r2', 3], ['r3', 3], ['r4', 3],
  ['arc', 4]];

function lanePositions() {
  const pos = {};
  let c = 0.0, grp = null;
  for (const [name, gr] of LANES) {
    if (grp !== null && gr !== grp) c += GAPL;
    pos[name] = c + LANE / 2;
    c += LANE;
    grp = gr;
  }
  return [pos, c];
}

const LEFT = 40.0;
const [LP0, CROSS] = lanePositions();

const LP = Object.fromEntries(Object.entries(LP0).map(([k, v]) => [k, LEFT + v]));
const PANEL_L = LP.catalog - LANE / 2, PANEL_R = LP.r4 + LANE / 2;
const BAR_X0 = LEFT + CROSS + 14, BAR_LEN = 100.0;
const STILL_W = BAR_X0 + BAR_LEN + 10, STILL_H = SW + FW;
const SLOT_Y = SW / 2, FRAME_Y = SW + FW / 2;
const LEFT_SLOT = 22.0;
const SLOT_W = LEFT_SLOT + CROSS + 4;
const OFF = 'no_traced_channel';
const CAT_OPACITY = 0.55;

const FACE_W = 150.0, FACE_H = SW + FW;
const FCAT = 5.5, FCX = 15.0;
const FRAME_L = 36.0;
const FACE_R = FACE_W - 10.0;
const FK = (FACE_R - FRAME_L) / CROSS;
const FL = Object.fromEntries(Object.entries(LP).map(([k, v]) => [k, FRAME_L + (v - LEFT) * FK]));
const FLANE = LANE * FK;
const FARC = FL.arc;
const FBAND = [FL.copied - FLANE / 2, FL.r1 + FLANE / 2];

const BARS_L = 220.0, BARS_H = 7.0, BARS_PAD = 4.0, SNAP_FS = 7.5;

const lane = rung => (rung === OFF ? LP.off : LP[rung]);
const flane = rung => (rung === OFF ? FL.off : FL[rung]);

const tFrame = s => (s - 1) * (FW + SW);
const tFc = s => tFrame(s) + FW / 2;
const tSlot = s => tFrame(s) + FW;
const tSc = s => tSlot(s) + SW / 2;

function glyph(kind, x, y, color, cls, sw = 1.3, bg = GROUND) {
  const h = G / 2, c = `${cls} ms-g-${kind}`;
  switch (kind) {
    case 'copied': {
      const r = h - 0.4;
      return `<g class="${c}"><circle cx="${g(x)}" cy="${g(y)}" r="${g(r)}" fill="${bg}" stroke="${color}" ` +
        `stroke-width="${g(sw)}"/><path d="M${g(x)},${g(y - r)}A${g(r)},${g(r)} 0 0 1 ${g(x)},${g(y + r)}Z" ` +
        `fill="${color}"/></g>`;
    }
    case 'in_hand':
      return `<circle class="${c}" cx="${g(x)}" cy="${g(y)}" r="${g(h + 0.5)}" fill="${color}"/>`;
    case 'by_name':
      return `<circle class="${c}" cx="${g(x)}" cy="${g(y)}" r="${g(h - 0.4)}" fill="none" stroke="${color}" stroke-width="${g(sw)}"/>`;
    case 'not_taken':
      return `<path class="${c}" d="M${g(x - h)},${g(y - h)}L${g(x + h)},${g(y + h)}M${g(x + h)},${g(y - h)}L${g(x - h)},${g(y + h)}" ` +
        `fill="none" stroke="${color}" stroke-width="${g(sw)}"/>`;
    case 'delivery':
      return `<polygon class="${c}" points="${g(x - h + 0.5)},${g(y - h)} ${g(x - h + 0.5)},${g(y + h)} ${g(x + h)},${g(y)}" fill="${color}"/>`;
    case 'catalog':
      return `<rect class="${c}" x="${g(x - 2.2)}" y="${g(y - 3)}" width="4.4" height="6" rx="1.3" ` +
        `fill="none" stroke="${color}" stroke-width="0.9"/>`;
    case 'grain':
      return `<rect class="${c}" x="${g(x - MK / 2)}" y="${g(y - MK / 2)}" width="${g(MK)}" height="${g(MK)}" fill="${color}"/>`;
    default:
      throw new Error(`glyph: no mark for ${kind}`);
  }
}

function brackets(x, y, color) {
  const h = G / 2 + 1.5, a = 2.0;
  const l = x - G / 2 - 2.2, r = x + G / 2 + 2.2;
  return `<path class="ms-prohibition" d="M${g(l + a)},${g(y - h)}H${g(l)}V${g(y + h)}H${g(l + a)}` +
    `M${g(r - a)},${g(y - h)}H${g(r)}V${g(y + h)}H${g(r - a)}" fill="none" stroke="${color}" stroke-width="0.9"/>`;
}

function quoteMarks(x, y, color) {
  const x0 = x + G / 2 + 1.2;
  return `<path class="ms-quotes" d="M${g(x0)},${g(y - 4.5)}l0.6,2.4M${g(x0 + 2)},${g(y - 4.5)}l0.6,2.4" ` +
    `fill="none" stroke="${color}" stroke-width="1" stroke-linecap="round"/>`;
}

function offGlyph(x, y, color, cls) {
  const r = G / 2 - 0.4;
  return `<circle class="${cls} ms-g-off" cx="${g(x)}" cy="${g(y)}" r="${g(r)}" fill="none" stroke="${color}" ` +
    `stroke-width="1.3" stroke-dasharray="1.2 1.4"/>`;
}

const mark = (rung, x, y, color, cls, bg) =>
  (rung === OFF ? offGlyph(x, y, color, cls) : glyph(rung, x, y, color, cls, 1.3, bg));



function arcEnds(run) {
  const a = run.exp.reader_arc;
  return [a.from, a.to].map(e => [e.session, e.documents.includes('page') ? 'frame' : 'slot']);
}

function arcSegment(run, pos) {
  const [[sa, ka], [sb, kb]] = arcEnds(run);
  const ta = ka === 'frame' ? tFc(sa) : tSc(sa);
  const tb = kb === 'frame' ? tFc(sb) : tSc(sb);
  const t0 = tFrame(pos) - SW;
  const y0 = Math.max(ta - t0, 0), y1 = Math.min(tb - t0, STILL_H);
  const ends = [ta, tb].map(t => t - t0).filter(y => y >= 0 && y <= STILL_H);
  return y0 < y1 || ends.length ? { y0, y1, ends } : null;
}

function rowAt(run, pos) {
  const N = run.N;
  if (pos === N + 1) {
    const L = run.exp.letters.find(l => l.written_at === N) || null;
    const stack = [...run.exp.stack].sort((a, b) => a.rank - b.rank);
    return {
      leader: true,
      letter: L ? L.rung : null,
      prohibition: L ? L.prohibition : false,
      rows: stack.map(r => (r.counts_by_written_at ? r.counts_by_written_at[N - 1] > 0 : false)),
    };
  }
  const f = frame(run, pos);
  const rows = f.slot.grain.rows ? f.slot.grain.rows.map(r => r.count > 0) : [];
  const page = f.frame.page;
  return {
    leader: false,
    letter: f.slot.rung,
    held: f.slot.kind,
    prohibition: f.slot.prohibition,
    rows,
    catalog: f.frame.catalog,
    delivery: f.frame.delivery,
    quotesTerm: f.frame.quotesTerm,
    page,
    relay: f.relay ? { from: f.slot.rung, to: page && page !== 'not_taken' ? page : null } : null,
    bars: f.bars,
  };
}


const HX = (FL.in_hand + FL.by_name) / 2, HR = G / 2;
function heldTick(x) {
  return `<path class="zf-held zf-held-tick" d="M${g(x - 1.8)},${g(SLOT_Y + 6.2)}l1.3,1.3l2.6,-2.6" fill="none" stroke="${INK}" stroke-width="0.8"/>`;
}
function heldMark(kind) {
  const x = HX, y = SLOT_Y, h = HR, d = h * 0.7;
  switch (kind) {
    case 'response as it stood':
      return `<circle class="zf-held zf-held-stood" cx="${g(x)}" cy="${g(y)}" r="${g(h)}" fill="none" stroke="${GOLD}" stroke-width="1" stroke-dasharray="1.1 1.1"/>`;
    case 'empty refusal':
      return `<g class="zf-held zf-held-refusal" fill="none" stroke="${INK}" stroke-width="0.9"><circle cx="${g(x)}" cy="${g(y)}" r="${g(h)}"/>` +
        `<line x1="${g(x - d)}" y1="${g(y + d)}" x2="${g(x + d)}" y2="${g(y - d)}"/></g>`;
    case 'empty notice':
      return `<g class="zf-held zf-held-notice" fill="none" stroke="${MUTED}" stroke-width="0.9"><rect x="${g(x - 4.4)}" y="${g(y - 2.6)}" width="8.8" height="5.2"/>` +
        `<line x1="${g(x - 2.6)}" y1="${g(y)}" x2="${g(x + 2.6)}" y2="${g(y)}"/></g>`;
    case 'letter':
      return mark(OFF, FL.off, y, GOLD, 'zf-letter', GROUND) + heldTick(FL.off);
  }
  return '';
}

function face(run, pos, opts = {}) {
  const r = rowAt(run, pos);
  const drawn = { page: 0, letter: 0, delivery: 0, relay: 0, grain: 0 };
  const op = r.leader ? ' opacity="0.45"' : '';
  const o = [
    `<svg xmlns="http://www.w3.org/2000/svg" class="zf" viewBox="0 0 ${g(FACE_W)} ${g(FACE_H)}" ` +
    `role="img" aria-label="${r.leader ? 'leader' : `session ${pos}`}" font-family="${SANS}">`,
    `<rect class="zf-ground" width="${g(FACE_W)}" height="${g(FACE_H)}" fill="${GROUND}"/>`,
    `<rect class="zf-frame" x="${g(FRAME_L)}" y="${g(SW)}" width="${g(FACE_W - FRAME_L)}" height="${g(FW)}" ` +
    `fill="${PANEL}"${op}/>`];
  const seg = r.leader ? null : arcSegment(run, pos);
  if (seg) {
    const [c0, c1] = FBAND;
    if (seg.y1 > seg.y0) {
      o.push(`<rect class="zf-band" x="${g(c0)}" y="${g(seg.y0)}" width="${g(c1 - c0)}" height="${g(seg.y1 - seg.y0)}" ` +
        `fill="${PEACOCK}" fill-opacity="0.16"/>`);
      o.push(`<line class="zf-arc" x1="${g(FARC)}" y1="${g(seg.y0)}" x2="${g(FARC)}" y2="${g(seg.y1)}" ` +
        `stroke="${PEACOCK}" stroke-width="1.2" stroke-dasharray="1 3" stroke-linecap="round"/>`);
    }
    for (const y of seg.ends) o.push(`<circle class="zf-arc-end" cx="${g(FARC)}" cy="${g(y)}" r="2" fill="${PEACOCK}"/>`);
  }
  if (!r.leader && r.relay) {
    drawn.relay += 1;
    const x1 = flane(r.relay.from);
    if (r.relay.to) {
      o.push(`<line class="zf-relay zf-cross" x1="${g(x1)}" y1="${g(SLOT_Y)}" x2="${g(flane(r.relay.to))}" ` +
        `y2="${g(FRAME_Y)}" stroke="${CORAL}" stroke-width="1.3"/>`);
    } else {
      const x2 = x1 + (SW - SLOT_Y) / (FRAME_Y - SLOT_Y) * (FL.by_name - x1);
      o.push(`<line class="zf-relay zf-drop" x1="${g(x1)}" y1="${g(SLOT_Y)}" x2="${g(x2)}" ` +
        `y2="${g(SW - 0.9)}" stroke="${GOLD}" stroke-width="1.2" stroke-dasharray="2.5 1.5"/>`);
      o.push(`<line class="zf-relay zf-drop-bar" x1="${g(x2 - BAR / 2)}" y1="${g(SW)}" ` +
        `x2="${g(x2 + BAR / 2)}" y2="${g(SW)}" stroke="${GOLD}" stroke-width="1.8"/>`);
    }
  }
  if (pos > 1) {
    if (opts.held && !r.letter && r.held) o.push(heldMark(r.held));
    if (r.letter) {
      drawn.letter += 1;
      o.push(mark(r.letter, flane(r.letter), SLOT_Y, GOLD, 'zf-letter', GROUND));
      if (r.prohibition) o.push(brackets(flane(r.letter), SLOT_Y, GOLD));
      if (opts.held && r.held === 'letter') o.push(heldTick(flane(r.letter)));
    }
    r.rows.forEach((present, i) => {
      if (present) {
        drawn.grain += 1;
        o.push(glyph('grain', FL[`r${i + 1}`], SLOT_Y, TONES[`r${i + 1}`], `zf-grain zf-grain-r${i + 1}`));
      }
    });
  }
  if (!r.leader) {
    if (r.catalog) {
      o.push(`<g class="zf-stock" opacity="${g(CAT_OPACITY)}">` + glyph('catalog', FCAT, FRAME_Y, MUTED, 'zf-catalog') + '</g>');
    }
    if (r.delivery) {
      drawn.delivery += 1;
      o.push(glyph('delivery', FL.delivery, FRAME_Y, SKY, 'zf-delivery'));
      if (r.quotesTerm) o.push(quoteMarks(FL.delivery, FRAME_Y, SKY));
    }
    if (r.page) {
      drawn.page += 1;
      const byLetter = r.page === 'by_name' && !r.delivery;
      o.push(mark(r.page, flane(r.page), FRAME_Y, byLetter ? CORAL : INK, 'zf-page', PANEL));
    }
    o.push(`<text class="zf-counter" x="${g(FCX)}" y="${g(FRAME_Y + 3.3)}" text-anchor="start" ` +
      `font-size="${g(FSS)}" font-family="${MONO}" fill="${MUTED}">S${pos}</text>`);
  }
  o.push('</svg>');
  return { svg: o.join('\n'), drawn };
}

function bars(run, pos, pid, { scales, bands }, x0 = BAR_X0, L = BAR_LEN, y = SW + 3, h = 5.0, fs = FSS) {
  const o = [], drew = { tick: null, snap: false };
  const { top, sessTop } = scales;
  const fb = frame(run, pos).bars;
  const v = fb.semantic;
  const band = bands ? bands[Math.floor((pos - 1) / 6)] : null;
  o.push(`<rect class="zs-track" x="${g(x0)}" y="${g(y)}" width="${g(L)}" height="${g(h)}" ` +
    `fill="none" stroke="${GUIDE}" stroke-width="0.5"/>`);
  if (v === null) {
  } else if (!band || band.value === null) {
    const xv = x0 + v / top * L;
    o.push(`<rect class="zs-sem zs-sem-raw" x="${g(x0)}" y="${g(y)}" width="${g(xv - x0)}" ` +
      `height="${g(h)}" fill="${INK}"/>`);
  } else {
    const xv = x0 + v / top * L;
    const xb = x0 + band.value / top * L;
    o.push(`<rect class="zs-sem" x="${g(x0)}" y="${g(y)}" width="${g(Math.min(xv, xb) - x0)}" ` +
      `height="${g(h)}" fill="${INK}"/>`);
    o.push(`<rect class="zs-sem-stretch" x="${g(Math.min(xv, xb))}" y="${g(y)}" width="${g(Math.abs(xv - xb))}" ` +
      `height="${g(h)}" fill="url(#${pid})"/>`);
    const clean = band.verdict === 'clean';
    const dash = clean ? '' : ' stroke-dasharray="1.5 1"';
    o.push(`<line class="zs-tick zs-tick-${clean ? 'clean' : 'confounded'}" x1="${g(xb)}" y1="${g(y - 2)}" ` +
      `x2="${g(xb)}" y2="${g(y + h + 2)}" stroke="${INK}" stroke-width="1"${dash}/>`);
    drew.tick = band.verdict;
  }
  const r = fb.running, gp = fb.gap, ys = y + h + 3;
  const dash = r === null ? ' stroke-dasharray="2 2"' : '';
  o.push(`<rect class="zs-track zs-session" x="${g(x0)}" y="${g(ys)}" width="${g(L)}" ` +
    `height="${g(h)}" fill="none" stroke="${GUIDE}" stroke-width="0.5"${dash}/>`);
  if (r) {
    o.push(`<rect class="zs-run" x="${g(x0)}" y="${g(ys)}" width="${g(r / sessTop * L)}" ` +
      `height="${g(h)}" fill="${MUTED}"/>`);
  }
  if (gp !== null) {
    if (r !== 0) throw new Error(`${run.id} S${pos}: a return gap where the running count is ${r}`);
    const xg = x0 + gp / sessTop * L;
    o.push(`<line class="zs-snap-trace" x1="${g(x0)}" y1="${g(ys + h / 2)}" x2="${g(xg)}" y2="${g(ys + h / 2)}" ` +
      `stroke="${MUTED}" stroke-width="1" stroke-dasharray="1 2"/>`);
    o.push(`<text class="zs-snap" x="${g(x0 + L - 1)}" y="${g(ys + h - 0.6)}" text-anchor="end" ` +
      `font-size="${g(fs)}" font-family="${MONO}" fill="${INK}">${gp}</text>`);
    drew.snap = true;
  }
  return { lines: o, drew };
}

function still(run, pos, { key, withBars = true, ext = 0.0, width = null, scales, bands }) {
  const slot = !withBars;
  const W = withBars ? STILL_W : width;
  const dx = slot ? ext - (LEFT - LEFT_SLOT) : 0.0;
  const par = slot ? ' preserveAspectRatio="none"' : '';
  const k = key.toLowerCase().replace(/ /g, '');
  const r = rowAt(run, pos);
  const pid = `zh-${k.slice(0, 12)}-${pos}`;
  const drawn = { page: 0, letter: 0, delivery: 0, relay: 0, grain: 0,
    tick_clean: 0, tick_confounded: 0, no_tick: 0, snap: 0 };
  const o = [
    `<svg xmlns="http://www.w3.org/2000/svg" class="zs" viewBox="0 0 ${g(W)} ${g(STILL_H)}"${par} ` +
    `role="img" aria-label="${r.leader ? 'leader' : `session ${pos}`}" font-family="${SANS}">`,
    `<defs><pattern id="${pid}" width="3" height="3" patternUnits="userSpaceOnUse" ` +
    `patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="${INK}" stroke-width="1"/>` +
    `</pattern></defs>`,
    `<rect class="zs-ground" width="${g(W)}" height="${g(STILL_H)}" fill="${GROUND}"/>`];
  const op = r.leader ? ' opacity="0.35"' : '';
  if (slot) {
    o.push(`<rect class="zs-frame" x="0" y="${g(SW)}" width="${g(W)}" height="${g(FW)}" fill="${PANEL}"${op}/>`);
    const gid = `zg-${pid}`;
    o.push(`<defs><linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${g(ext + 60)}" y2="0">` +
      `<stop offset="0" stop-color="${GUIDE}" stop-opacity="0"/>` +
      `<stop offset="1" stop-color="${GUIDE}" stop-opacity="1"/></linearGradient></defs>`);
    for (const yy of [SW + 0.25, STILL_H - 0.25]) {
      o.push(`<line class="zs-edge" x1="0" y1="${g(yy)}" x2="${g(W)}" y2="${g(yy)}" ` +
        `stroke="url(#${gid})" stroke-width="0.5"${op}/>`);
    }
    o.push(`<g class="zs-lanes" transform="translate(${g(dx)} 0)">`);
  } else {
    o.push(`<rect class="zs-frame" x="${g(PANEL_L)}" y="${g(SW)}" width="${g(PANEL_R - PANEL_L)}" ` +
      `height="${g(FW)}" fill="${PANEL}"${op}/>`);
    for (const yy of [SW + 0.25, STILL_H - 0.25]) {
      o.push(`<line class="zs-edge" x1="${g(PANEL_L)}" y1="${g(yy)}" x2="${g(PANEL_R)}" y2="${g(yy)}" ` +
        `stroke="${GUIDE}" stroke-width="0.5"${op}/>`);
    }
  }
  const seg = r.leader ? null : arcSegment(run, pos);
  if (seg) {
    const c0 = LP.copied - LANE / 2, c1 = LP.r1 + LANE / 2;
    if (seg.y1 > seg.y0) {
      o.push(`<rect class="zs-band" x="${g(c0)}" y="${g(seg.y0)}" width="${g(c1 - c0)}" height="${g(seg.y1 - seg.y0)}" ` +
        `fill="${PEACOCK}" fill-opacity="0.16"/>`);
      o.push(`<line class="zs-arc" x1="${g(LP.arc)}" y1="${g(seg.y0)}" x2="${g(LP.arc)}" y2="${g(seg.y1)}" ` +
        `stroke="${PEACOCK}" stroke-width="1.2" stroke-dasharray="1 3" stroke-linecap="round"/>`);
    }
    for (const y of seg.ends) o.push(`<circle class="zs-arc-end" cx="${g(LP.arc)}" cy="${g(y)}" r="2" fill="${PEACOCK}"/>`);
  }
  if (!r.leader && r.relay) {
    drawn.relay += 1;
    const x1 = lane(r.relay.from);
    if (r.relay.to) {
      o.push(`<line class="zs-relay zs-cross" x1="${g(x1)}" y1="${g(SLOT_Y)}" x2="${g(lane(r.relay.to))}" ` +
        `y2="${g(FRAME_Y)}" stroke="${CORAL}" stroke-width="1.4"/>`);
    } else {
      const x2 = x1 + (SW - SLOT_Y) / (FRAME_Y - SLOT_Y) * (LP.by_name - x1);
      o.push(`<line class="zs-relay zs-drop" x1="${g(x1)}" y1="${g(SLOT_Y)}" x2="${g(x2)}" ` +
        `y2="${g(SW - 0.9)}" stroke="${GOLD}" stroke-width="1.2" stroke-dasharray="2.5 1.5"/>`);
      o.push(`<line class="zs-relay zs-drop-bar" x1="${g(x2 - BAR / 2)}" y1="${g(SW)}" ` +
        `x2="${g(x2 + BAR / 2)}" y2="${g(SW)}" stroke="${GOLD}" stroke-width="1.8"/>`);
    }
  }
  if (pos > 1) {
    if (r.letter) {
      drawn.letter += 1;
      o.push(mark(r.letter, lane(r.letter), SLOT_Y, GOLD, 'zs-letter', GROUND));
      if (r.prohibition) o.push(brackets(lane(r.letter), SLOT_Y, GOLD));
    }
    r.rows.forEach((present, i) => {
      if (present) {
        drawn.grain += 1;
        o.push(glyph('grain', LP[`r${i + 1}`], SLOT_Y, TONES[`r${i + 1}`], `zs-grain zs-grain-r${i + 1}`));
      }
    });
  }
  if (!r.leader) {
    if (r.catalog && !slot) {
      o.push(`<g opacity="${g(CAT_OPACITY)}">` + glyph('catalog', PANEL_L + 4, FRAME_Y, MUTED, 'zs-catalog') + '</g>');
    }
    if (r.delivery) {
      drawn.delivery += 1;
      o.push(glyph('delivery', LP.delivery, FRAME_Y, SKY, 'zs-delivery'));
      if (r.quotesTerm) o.push(quoteMarks(LP.delivery, FRAME_Y, SKY));
    }
    if (r.page) {
      drawn.page += 1;
      const byLetter = r.page === 'by_name' && !r.delivery;
      o.push(mark(r.page, lane(r.page), FRAME_Y, byLetter ? CORAL : INK, 'zs-page', PANEL));
    }
    if (withBars) {
      const { lines, drew } = bars(run, pos, pid, { scales, bands });
      o.push(...lines);
      if (drew.tick === null) drawn.no_tick += 1; else drawn[`tick_${drew.tick}`] += 1;
      drawn.snap += drew.snap ? 1 : 0;
    }
  }
  if (slot) {
    o.push('</g>');
    if (!r.leader && r.catalog) {
      o.push(`<g opacity="${g(CAT_OPACITY)}">` + glyph('catalog', ext - 7, FRAME_Y, MUTED, 'zs-catalog') + '</g>');
    }
  }
  const label = r.leader ? 'leader' : `S${pos}`;
  const [xc, anchor] = slot ? [ext + 2, 'start'] : [LEFT - 6, 'end'];
  o.push(`<text class="zs-counter" x="${g(xc)}" y="${g(FRAME_Y + 3.3)}" text-anchor="${anchor}" ` +
    `font-size="${g(FSS)}" font-family="${MONO}" fill="${MUTED}">${label}</text>`);
  o.push('</svg>');
  return { svg: o.join('\n'), drawn };
}

function barsStill(run, pos, pid, { scales, bands }) {
  const w = BARS_L + BARS_PAD, hh = 2 * BARS_H + 3 + 2 * BARS_PAD;
  const leader = pos === run.N + 1;
  const o = [
    `<svg xmlns="http://www.w3.org/2000/svg" class="zb" viewBox="0 0 ${g(w)} ${g(hh)}" role="img" ` +
    `aria-label="${leader ? 'leader' : `bars, session ${pos}`}">`,
    `<defs><pattern id="${pid}" width="3" height="3" patternUnits="userSpaceOnUse" ` +
    `patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="${INK}" stroke-width="1"/>` +
    `</pattern></defs>`,
    `<rect class="zb-ground" width="${g(w)}" height="${g(hh)}" fill="${GROUND}"/>`];
  let drew = { tick: null, snap: false };
  if (!leader) {
    const b = bars(run, pos, pid, { scales, bands }, BARS_PAD, BARS_L, BARS_PAD, BARS_H, SNAP_FS);
    o.push(...b.lines);
    drew = b.drew;
  }
  o.push('</svg>');
  return { svg: o.join('\n'), drew };
}



const DRAWER_EVENTS = Object.freeze([
  'mode',
  'modekey',
  'pick-open',
  'knob-turn',
  'knob-refused',
  'knob-lock',
  'knob-unlock', 'shuffle', 'lock-all', 'unlock-all',
  'tapes-match',
  'run-admitted',
  'pick-accepted',
  'pick-refused',
  'load-start',
  'load-done',
  'preset',
  'sync-arm',
  'sync-disarm',
  'bank-set',
  'bank-refused',
]);

function makeChannel(events) {
  const listeners = new Map();
  return {
    on(name, fn) {
      if (name !== '*' && !events.includes(name)) throw new Error(`no event named ${name}`);
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name).delete(fn);
    },
    emit(name, detail = {}) {
      if (!events.includes(name)) throw new Error(`no event named ${name}`);
      for (const key of [name, '*']) {
        for (const fn of listeners.get(key) || []) {
          try { fn(name, detail); } catch (err) { console.error(`listener for ${name}:`, err); }
        }
      }
    },
  };
}


function makeKnobs(index) {
  const knobs = index.knobs.map(k => ({
    name: k.knob,
    gloss: k.gloss,
    values: k.values.map(v => ({ value: v.value, label: v.label, gloss: v.gloss, runs: v.runs })),
  }));
  const runs = index.runs.map(e => {
    for (const k of knobs) {
      if (!k.values.some(v => v.value === e.knobs[k.name])) {
        throw new Error(`${e.run}: ${k.name} ${e.knobs[k.name]} is not in the vocabulary`);
      }
    }
    return { id: e.run, knobs: e.knobs };
  });
  return {
    knobs,
    runs,
    pos: Object.fromEntries(knobs.map(k => [k.name, 0])),
    locks: {},
  };
}

function knobOf(ks, name) {
  const k = ks.knobs.find(x => x.name === name);
  if (!k) throw new Error(`no knob named ${name}`);
  return k;
}

const valueAt = (ks, name) => knobOf(ks, name).values[ks.pos[name]];
const isLocked = (ks, name) => Object.prototype.hasOwnProperty.call(ks.locks, name);

function matching(ks, except = null) {
  return ks.runs.filter(r =>
    Object.entries(ks.locks).every(([n, v]) => n === except || r.knobs[n] === v));
}

function live(ks, name) {
  const have = new Set(matching(ks, name).map(r => r.knobs[name]));
  return knobOf(ks, name).values.map(v => have.has(v.value));
}

function admitted(ks) {
  const m = matching(ks);
  return m.length === 1 ? m[0].id : null;
}

function turn(ks, name, dir) {
  if (isLocked(ks, name)) return { refused: 'locked' };
  const k = knobOf(ks, name), n = k.values.length, on = live(ks, name);
  for (let i = 1; i < n; i++) {
    const p = ((ks.pos[name] + dir * i) % n + n) % n;
    if (on[p]) {
      const from = ks.pos[name];
      ks.pos[name] = p;
      return { knob: name, from, to: p };
    }
  }
  return { refused: 'no other live position' };
}

function settle(ks) {
  const turned = [];
  const one = matching(ks);
  for (const k of ks.knobs) {
    if (isLocked(ks, k.name)) continue;
    const from = ks.pos[k.name];
    let to = from;
    if (one.length === 1) {
      to = k.values.findIndex(v => v.value === one[0].knobs[k.name]);
    } else {
      const on = live(ks, k.name);
      for (let i = 0; i < k.values.length && !on[to]; i++) to = (from + i + 1) % k.values.length;
    }
    if (to !== from) {
      ks.pos[k.name] = to;
      turned.push({ knob: k.name, from, to });
    }
  }
  return turned;
}

function lock(ks, name) {
  if (isLocked(ks, name)) return { refused: 'already locked' };
  if (!live(ks, name)[ks.pos[name]]) return { refused: 'dark position' };
  ks.locks[name] = valueAt(ks, name).value;
  return { knob: name, value: ks.locks[name], turned: settle(ks), count: matching(ks).length, admitted: admitted(ks) };
}

function unlock(ks, name) {
  if (!isLocked(ks, name)) return { refused: 'not locked' };
  delete ks.locks[name];
  return { knob: name, count: matching(ks).length, admitted: admitted(ks) };
}

function shuffle(ks, rand = Math.random) {
  const m = matching(ks);
  const shown = ks.runs.find(r => ks.knobs.every(k => r.knobs[k.name] === valueAt(ks, k.name).value));
  const pool = m.length > 1 && shown ? m.filter(r => r !== shown) : m;
  if (!pool.length) return { refused: 'no run the locks leave' };
  const run = pool[Math.floor(rand() * pool.length)];
  const turned = [];
  for (const k of ks.knobs) {
    if (isLocked(ks, k.name)) continue;
    const from = ks.pos[k.name], to = k.values.findIndex(v => v.value === run.knobs[k.name]);
    if (to !== from) { ks.pos[k.name] = to; turned.push({ knob: k.name, from, to }); }
  }
  return { id: run.id, turned };
}

const allLocked = ks => ks.knobs.every(k => isLocked(ks, k.name));

function lockAll(ks) {
  const locked = [];
  for (const k of ks.knobs) {
    if (isLocked(ks, k.name)) continue;
    const r = lock(ks, k.name);
    if (r.refused) return { refused: `${k.name}: ${r.refused}`, locked };
    locked.push({ knob: k.name, value: r.value, turned: r.turned });
  }
  return { locked, admitted: admitted(ks) };
}

function unlockAll(ks) {
  const unlocked = Object.keys(ks.locks);
  for (const n of unlocked) delete ks.locks[n];
  return { unlocked, count: matching(ks).length };
}


const noFields = () => ({});

function makeBank(keys, count = keys.length, blank = noFields) {
  if (keys.length !== count) throw new Error(`the bank holds ${count} tapes, not ${keys.length}`);
  return keys.map(key => ({ key, ...blank() }));
}

function bankDrop(slots, i, key, count = slots.length, blank = noFields) {
  if (!Number.isInteger(i) || i < 0 || i >= count) throw new Error(`no slot ${i}`);
  const from = slots[i].key;
  slots[i] = { key, ...blank() };
  return { slot: i, from, to: key };
}


function bankSaveTo(storage, slots, key) {
  if (slots.some(s => s.key.startsWith('file:'))) return false;
  try { storage.setItem(key, JSON.stringify(slots.map(s => s.key))); return true; }
  catch { return false; }
}

function bankRestoreFrom(storage, known, key, count) {
  try {
    const keys = JSON.parse(storage.getItem(key));
    if (Array.isArray(keys) && keys.length === count
        && keys.every(k => typeof k === 'string' && known.has(k))) return keys;
  } catch {   }
  return null;
}


const PROSE_KEY = /^(text|body|prose|content|page_text|letter_text|passage_text)$/;
const LONGEST = 300;

const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);

function proseFound(x, path, out) {
  if (typeof x === 'string') {
    if (x.length > LONGEST) out.push(`R6: ${path || 'the file'} holds ${x.length} characters of text`);
  } else if (Array.isArray(x)) {
    x.forEach((y, i) => proseFound(y, `${path}[${i}]`, out));
  } else if (isObj(x)) {
    for (const [k, v] of Object.entries(x)) {
      if (PROSE_KEY.test(k) && typeof v === 'string' && v) out.push(`R6: a field named ${path ? path + '.' : ''}${k}`);
      proseFound(v, path ? `${path}.${k}` : k, out);
    }
  }
  return out;
}



const COUNTER_EVENTS = Object.freeze([
  'cue-set',
  'wheel-set',
  'locate-refused',
]);


const pad3 = n => String(n).padStart(3, '0');
const digitsOf = n => pad3(n).split('').map(Number);
const valueOf3 = d => d[0] * 100 + d[1] * 10 + d[2];

function rollWheel(digits, i, delta, N) {
  const place = 10 ** (2 - i), v = valueOf3(digits);
  let to = v + delta * place;
  if (i === 2) to = ((to % (N + 1)) + N + 1) % (N + 1);
  else if (to > N) to = v % place;
  else if (to < 0) { to = v % place; while (to + place <= N) to += place; }
  return digitsOf(to);
}

function clampTo(to, N) {
  return to > N ? { to: N, past: true } : { to, past: false };
}






const EVENTS = Object.freeze([...DRAWER_EVENTS, ...COUNTER_EVENTS,
  'step',
  'hold-start',
  'hold-release',
  'head-cross',
  'land',
  'rewind',
  'locate-start',
  'locate-done',
  'view',
]);

function makeBus() {
  return makeChannel(EVENTS);
}



const SLOTS = 6;

const blankSlot = () => ({ kf: 0, cue: null });

function makeSlots(keys) {
  return makeBank(keys, SLOTS, blankSlot);
}

function drop(slots, i, key) {
  return bankDrop(slots, i, key, SLOTS, blankSlot);
}


const BANK_KEY = 'preterition-deck:bank:v1';

function bankSave(storage, slots) {
  return bankSaveTo(storage, slots, BANK_KEY);
}

function bankRestore(storage, known) {
  return bankRestoreFrom(storage, known, BANK_KEY, SLOTS);
}


const STATUSES = ['submitted', 'malformed', 'refused'];
const CHANNELS = ['nothing', 'letter', 'chat', 'diary', 'accumulative'];
const HELD_CLASSES = ['response_as_it_stood', 'empty_letter_notice', 'notice', 'ordinary_letter', 'other'];

function intake(exp, passages = null) {
  if (!isObj(exp)) return { ok: false, refusals: ['not an export: the file is not one JSON object'] };
  const sv = exp.schema_version;
  if (sv === undefined) {
    return { ok: false, refusals: ['no schema_version: an export older than zoe-2.1, as the six\'s first exports are'] };
  }
  if (!SCHEMAS.includes(sv)) {
    const why = sv === 'zoe-2'
      ? 'schema zoe-2: it carries no received.slot.held, so the slot after a malformed or refused session cannot be told apart; this player reads zoe-2.1'
      : `schema ${sv}: this player reads ${SCHEMAS.join(', ')}`;
    return { ok: false, refusals: [why] };
  }
  const no = [];
  if (typeof exp.run !== 'string' || !exp.run) no.push('R1: no run id');
  if (!isObj(exp.design)) no.push('R1: no design variables');
  if (!Number.isInteger(exp.N) || exp.N < 1) no.push('R2: N is not a count of sessions');
  if (exp.begun_session !== null &&
      !(Array.isArray(exp.begun_session) && exp.begun_session.every(b => Number.isInteger(b) && b > exp.N))) {
    no.push('R2: begun_session is neither null nor sessions after the last that ended');
  }
  if (!Array.isArray(exp.sessions)) {
    no.push('R2: no sessions');
  } else {
    if (exp.sessions.length !== exp.N) no.push(`R2: ${exp.sessions.length} sessions against N ${exp.N}`);
    exp.sessions.forEach((s, i) => {
      const at = `session ${i + 1}`;
      if (!isObj(s)) { no.push(`R2: ${at} is not a record`); return; }
      if (s.session !== i + 1) no.push(`R2: ${at} is numbered ${s.session}`);
      if (!STATUSES.includes(s.status)) no.push(`R2: ${at} has status ${s.status}`);
      const r = s.received;
      if (!isObj(r) || !Array.isArray(r.channels) || !r.channels.length ||
          r.channels.some(c => !CHANNELS.includes(c)) || !Array.isArray(r.from_sessions)) {
        no.push(`R3: ${at} does not say what it received`);
      } else if (isObj(r.slot) && r.slot.held !== undefined && !HELD_CLASSES.includes(r.slot.held)) {
        no.push(`R3: ${at} names an unknown slot class, ${r.slot.held}`);
      }
      if (!isObj(s.time)) no.push(`R4: ${at} does not say what it was told about time`);
    });
  }
  const p = exp.provenance;
  if (!isObj(p) || !isObj(p.dataset) || !p.dataset.doi || typeof p.analysis_commit !== 'string' || !p.export_command) {
    no.push('R5: no provenance (the dataset\'s DOI, the analysis commit, the export command)');
  }
  no.push(...proseFound(exp, '', []));
  if (no.length) return { ok: false, refusals: no };

  try {
    const run = makeRun(exp, null, passages);
    for (let s = 1; s <= run.N; s++) frame(run, s);
  } catch (err) {
    return { ok: false, refusals: [`the model could not read it: ${err.message}`] };
  }

  const gaps = [];
  const count = st => exp.sessions.filter(s => s.status === st).length;
  if (count('malformed')) gaps.push(`O4: ${count('malformed')} malformed sessions`);
  if (count('refused')) gaps.push(`O4: ${count('refused')} refused sessions`);
  if (exp.begun_session) gaps.push(`R2: session ${exp.begun_session.join(', ')} begun and never ended`);
  const sem = exp.bars && exp.bars.semantic_distance;
  const nulls = Array.isArray(sem) ? sem.filter(v => v === null).length : exp.N;
  if (nulls) gaps.push(`O2: ${nulls} sessions with no semantic distance`);
  for (const r of exp.stack || []) if (r.absent) gaps.push(`O1: grain row ${r.label} absent (${r.absent})`);
  const key = exp.bars && exp.bars.baseline;
  if (!key || !passages || !passages[key] || !passages[key].bands) gaps.push('O3: no baseline in this page for its passage');
  return { ok: true, exp, verdict: gaps.length ? 'meets with marked gaps' : 'meets', gaps };
}



const knobFx = x => x.toFixed(2);

function knobEl(tag, attrs = {}, text = '') {
  const x = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
  if (text) x.textContent = text;
  return x;
}

function buildKnob(k, words = {}) {
  const wrap = knobEl('div', { class: 'knob', 'data-knob': k.name });
  const win = knobEl('div', { class: 'kwin', 'aria-hidden': 'true' });
  const strip = knobEl('div', { class: 'kstrip' });
  for (const v of [...k.values].reverse()) strip.append(knobEl('span', {}, v.label));
  win.append(strip);
  const face = knobEl('div', { class: 'kface', role: 'slider', tabindex: '0', 'aria-label': k.name,
    'aria-valuemin': '1', 'aria-valuemax': String(k.values.length) });
  const prev = knobEl('span', { class: 'half prev', 'aria-hidden': 'true', 'data-dir': '-1' }, '<');
  const next = knobEl('span', { class: 'half next', 'aria-hidden': 'true', 'data-dir': '1' }, '>');
  const ticks = knobEl('div', { class: 'ticks', 'aria-hidden': 'true' });
  face.append(prev, next, ticks);
  const lever = knobEl('button', { class: 'lever', 'aria-pressed': 'false',
    'aria-label': words.lockOne ? words.lockOne(k.name) : `lock ${k.name}` });
  lever.append(knobEl('span', { class: 'lamp' }), knobEl('span', { class: 'lt' }, words.lock || 'LOCK'));
  wrap.append(knobEl('div', { class: 'kname' }, k.name), win, face, lever);
  return { wrap, win, strip, face, ticks, lever };
}

function buildShuffle(name, words = {}) {
  const wrap = knobEl('div', { class: 'knob shuffle', 'data-knob': name });
  const win = knobEl('div', { class: 'kwin', 'aria-hidden': 'true' });
  const strip = knobEl('div', { class: 'kstrip' });
  for (let i = 0; i < 3; i++) strip.append(knobEl('span', {}, words.any || 'any tape'));
  strip.style.transform = 'translateX(-100%)';
  win.append(strip);
  const face = knobEl('div', { class: 'kface', role: 'button', tabindex: '0',
    'aria-label': words.turnAll || 'shuffle: turn the knobs at random' });
  face.append(knobEl('span', { class: 'half prev', 'aria-hidden': 'true', 'data-dir': '-1' }, '<'),
              knobEl('span', { class: 'half next', 'aria-hidden': 'true', 'data-dir': '1' }, '>'));
  const lever = knobEl('button', { class: 'lever', 'aria-pressed': 'false',
    'aria-label': words.lockEvery || 'lock every knob' });
  lever.append(knobEl('span', { class: 'lamp' }), knobEl('span', { class: 'lt' }, words.lock || 'LOCK'));
  wrap.append(knobEl('div', { class: 'kname' }, name), win, face, lever);
  return { wrap, win, strip, face, lever };
}

function paintKnob(parts, ks, name, words = {}) {
  const k = ks.knobs.find(x => x.name === name);
  const v = valueAt(ks, name), on = live(ks, name), locked = isLocked(ks, name), pos = ks.pos[name];
  parts.strip.style.transform = `translateX(${-(k.values.length - 1 - pos) * 100}%)`;
  parts.face.setAttribute('aria-valuenow', String(pos + 1));
  parts.face.setAttribute('aria-valuetext', `${v.label}${locked ? ', locked' : ''}, ${v.gloss}`);
  parts.wrap.classList.toggle('locked', locked);
  parts.lever.setAttribute('aria-pressed', String(locked));
  parts.lever.querySelector('.lt').textContent = locked ? (words.locked || 'LOCKED') : (words.lock || 'LOCK');
  const n = k.values.length, ang = i => n > 1 ? -135 + 270 * i / (n - 1) : 0;
  parts.ticks.innerHTML = k.values.map((x, i) =>
    `<span class="t${on[i] ? '' : ' dark'}${i === pos ? ' cur' : ''}" style="--a:${knobFx(ang(i))}deg"></span>`).join('');
  parts.face.style.setProperty('--pa', `${knobFx(ang(pos))}deg`);
}

function paintShuffle(parts, ks, angle, words = {}) {
  const all = allLocked(ks);
  parts.lever.querySelector('.lt').textContent = all ? (words.unlock || 'UNLOCK') : (words.lock || 'LOCK');
  parts.lever.setAttribute('aria-pressed', String(all));
  parts.lever.setAttribute('aria-label', all ? (words.unlockEvery || 'unlock every knob')
    : (words.lockEvery || 'lock every knob'));
  parts.wrap.classList.toggle('locked', all);
  parts.face.style.setProperty('--pa', `${knobFx(angle)}deg`);
}

function shuffleSlide(parts, dir) {
  const s = parts.strip;
  if (!s || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  s.style.transition = 'none'; s.style.transform = 'translateX(-100%)'; void s.offsetWidth;
  s.style.transition = ''; s.style.transform = `translateX(${dir < 0 ? -200 : 0}%)`;
  setTimeout(() => { s.style.transition = 'none'; s.style.transform = 'translateX(-100%)'; void s.offsetWidth; s.style.transition = ''; }, 130);
}



function mountDrawer(cfg) {
  const {
    root,
    host = root,
    bankHost,
    rect = null,
    flex = {},
    ks,
    slots,
    st,
    bus,
    say,
    strip,
    drop,
    intake,
    kind,
    sync = {},
    hooks = {},
    ids = {},
  } = cfg;
  if (kind !== 'run' && kind !== 'fan') throw new Error(`the drawer is mounted with kind ${kind}, which is neither run nor fan`);
  const id = { drawer: 'drawer', modeKey: 'modekey', pick: 'pick', syncKey: 'synckey', ...ids };
  const nothing = () => {};
  const h = {
    inert: nothing,
    onMode: nothing,
    enterLoad: nothing,
    load: nothing,
    save: nothing,
    leader: nothing,
    choose: nothing,
    render: nothing,
    tapeOf: () => null,
    keep: () => ({ key: null, id: null }),
    knows: () => false,
    kindOf: () => null,
    ...hooks,
  };
  const W = {
    title: 'Tape library', region: 'tape library',
    load: 'LOAD', play: 'PLAY', lock: 'LOCK', locked: 'LOCKED', unlock: 'UNLOCK',
    shuffleName: 'SHUFFLE', any: 'any tape',
    turnAll: 'shuffle: turn the knobs at random', lockEvery: 'lock every knob', unlockEvery: 'unlock every knob',
    lockOne: name => `lock ${name}`,
    howto: [], pickLine: '', pickKey: 'Choose file',
    tape: 'TAPE', tapePrompt: '', noTape: 'Nothing chosen.',
    positionsLocked: 'positions locked', none: 'none', tapesAvailable: 'tapes available', refused: 'refused',
    shuffleGlass: n => `${W.shuffleName}: one at random among the ${n} the locks leave`,
    atLabel: (knob, label, n) => `tapes available at ${knob} ${label}: ${n}`,
    allLockedSay: 'every knob is locked; unlock first',
    saidAvailable: (n, title) => (title ? `tapes available: 1, ${title}` : `tapes available: ${n}`),
    saidShuffled: title => `shuffled: the knobs show ${title}`,
    saidLoaded: (i, title) => `loaded into preset ${i + 1}: ${title}`,
    saidRefused: first => `refused: ${first}`,
    saidInBox: name => `in the tape box: ${name}; press a preset key to load it`,
    judged: verdict => `judged here: ${verdict}`,
    playPreset: (i, title) => `play preset ${i + 1}, ${title}`,
    loadSlot: i => `load the tape into slot ${i + 1}`,
    sync: 'SYNC', armed: 'ARMED',
    syncArm: 'arm this instrument for sync', syncDisarm: 'disarm this instrument',
    wrongKind: (theirs, ours) => `kind ${theirs}: this is a ${ours} tool, and the file is a ${theirs} unit`,
    ...(cfg.words || {}),
  };

  const el = (tag, attrs = {}, text = '') => {
    const x = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
    if (text) x.textContent = text;
    return x;
  };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const emit = (name, detail = {}) => bus.emit(name, detail);
  const SHUF = W.shuffleName;

  const bank = el('div', { class: 'bank' });
  const presetKeys = slots.map((s, i) => {
    const b = el('button', { 'data-slot': String(i), 'aria-pressed': 'false' });
    if (flex.key) b.style.flex = flex.key;
    bank.appendChild(b);
    return b;
  });
  const modeKey = el('button', { id: id.modeKey, 'aria-pressed': 'false' }, W.load);
  if (flex.mode) modeKey.style.flex = flex.mode;
  bank.appendChild(modeKey);
  bankHost.appendChild(bank);

  let armed = false;
  const syncKey = sync.shown ? el('button', { id: id.syncKey, class: 'synckey', 'aria-pressed': 'false',
    'aria-label': W.syncArm }) : null;
  if (syncKey) {
    syncKey.append(el('span', { class: 'lamp' }), el('span', { class: 'lt' }, W.sync));
    const f = sync.flex || flex.sync || flex.mode;
    if (f) syncKey.style.flex = f;
    (sync.host || bank).appendChild(syncKey);
  }
  function setArmed(on) {
    if (!syncKey || on === armed) return;
    armed = on;
    syncKey.setAttribute('aria-pressed', String(armed));
    syncKey.setAttribute('aria-label', armed ? W.syncDisarm : W.syncArm);
    syncKey.querySelector('.lt').textContent = armed ? W.armed : W.sync;
    emit(armed ? 'sync-arm' : 'sync-disarm', {});
  }

  const drawer = el('section', { id: id.drawer, 'aria-label': W.region, role: 'region' });
  if (rect) {
    const [x, y, w, hh] = rect;
    Object.assign(drawer.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' });
  }
  const knobGrid = el('div', { class: 'knobs' });
  const knobEls = {};
  for (const k of ks.knobs) {
    const parts = buildKnob(k, W);
    knobGrid.appendChild(parts.wrap);
    knobEls[k.name] = parts;
  }
  const shuf = buildShuffle(SHUF, W);
  knobGrid.appendChild(shuf.wrap);

  const under = el('div', { class: 'under' });
  const readout = el('div', { class: 'glass', 'aria-live': 'polite' }, '');
  const tapebox = el('div', { class: 'tapebox', hidden: '' });
  const picker = el('div', { class: 'picker' });
  const pickLine = el('span', { class: 'pickline' });
  pickLine.innerHTML = W.pickLine;
  const pickLabel = el('label', { for: id.pick, class: 'pickkey' }, W.pickKey);
  const pickInput = el('input', { type: 'file', id: id.pick, accept: '.json,application/json', class: 'sr' });
  pickLabel.addEventListener('click', () => emit('pick-open', {}));
  picker.append(pickLabel, pickLine, pickInput);
  const tapecell = el('div', { class: 'tapecell' });
  tapecell.append(tapebox);
  under.append(readout, tapecell);
  const howto = el('ol', { class: 'howto' });
  howto.innerHTML = W.howto.map(x => `<li>${x}</li>`).join('');
  drawer.append(el('h2', { class: 'sr' }, W.title), howto, knobGrid, under, picker);
  host.appendChild(drawer);
  root.dataset.drawerHost = '';
  root.dataset.mode = st.mode;

  function updateKnobs() {
    for (const k of ks.knobs) paintKnob(knobEls[k.name], ks, k.name, W);
    paintShuffle(shuf, ks, st.shufAngle || 0, W);
    const held = ks.knobs.filter(k => isLocked(ks, k.name)).map(k => `${k.name} ${valueAt(ks, k.name).label}`);
    const lines = [`${W.positionsLocked}: ${held.length ? held.join(', ') : W.none}`,
                   `${W.tapesAvailable}: ${matching(ks).length}`];
    if (st.focusKnob === SHUF) {
      lines.push(W.shuffleGlass(matching(ks).length));
    } else if (st.focusKnob) {
      const v = valueAt(ks, st.focusKnob);
      const at = matching(ks, st.focusKnob).filter(r => r.knobs[st.focusKnob] === v.value).length;
      lines.push(W.atLabel(st.focusKnob, v.label, at), `${v.label}: ${v.gloss}`);
    }
    readout.innerHTML = (st.pickRefused
      ? `<pre>${W.refused}: ${esc(st.pickRefused.file)}\n- ${st.pickRefused.refusals.map(esc).join('\n- ')}</pre>`
      : `<pre>${esc(lines.join('\n'))}</pre>`);
    const tape = boxTape();
    tapebox.hidden = !tape;
    if (tape) {
      const gaps = tape.gaps.length ? '\n' + tape.gaps.map(x => '  ' + esc(x)).join('\n') : '';
      tapebox.innerHTML = `<pre>${W.tape}  ${strip(tape.key)}\n${esc(tape.key.replace(/^file:/, ''))}\n${tape.verdict}${gaps}` +
        `\n\n${W.tapePrompt}</pre>`;
    }
  }
  function boxTape() {
    if (st.picked) return st.picked;
    const one = admitted(ks);
    if (!one) return null;
    return h.tapeOf(one);
  }
  function updateBank() {
    const playing = st.mode === 'PLAY';
    presetKeys.forEach((b, i) => {
      const key = slots[i].key;
      const runId = key.replace(/^file:/, '');
      const label = `${i + 1} ${strip(key, false, !flex.full)}${flex.full ? ' ' + runId : ''}${i === st.slot ? ' LOADED' : ''}`;
      if (b.textContent !== label) b.innerHTML = `<i class="plamp" aria-hidden="true"></i><span class="pk">${i + 1} </span>` +
        `<span class="pstrip">${strip(key, true, !flex.full)}${flex.full ? `<small class="prun"> ${esc(runId)}</small>` : ''}</span>` +
        `<span class="sr">${i === st.slot ? ' LOADED' : ''}</span>`;
      b.setAttribute('aria-pressed', String(i === st.slot));
      b.setAttribute('aria-label', playing ? W.playPreset(i, strip(key, false)) : W.loadSlot(i));
    });
    modeKey.textContent = playing ? W.load : W.play;
    modeKey.setAttribute('aria-pressed', String(!playing));
  }

  function setMode(m) {
    if (m === st.mode) return;
    if (m === 'LOAD') h.enterLoad();
    st.mode = m;
    h.onMode(m);
    root.dataset.mode = m;
    if (m === 'LOAD') drawer.setAttribute('data-open', ''); else drawer.removeAttribute('data-open');
    h.inert(m === 'LOAD');
    emit('mode', { mode: m });
    updateKnobs();
    h.render();
    if (m === 'LOAD') knobEls[ks.knobs[0].name].face.focus({ preventScroll: true });
  }
  function loadInto(i) {
    const tape = boxTape();
    if (!tape) { say(W.noTape); return; }
    emit('load-start', { slot: i, id: tape.key });
    drop(slots, i, tape.key);
    h.load(i, tape.key);
    emit('load-done', { slot: i, id: tape.key });
    h.save();
    st.picked = null; st.pickRefused = null;
    h.leader(i);
    setMode('PLAY');
    h.choose(i);
    say(W.saidLoaded(i, strip(tape.key, false)));
  }
  function bankState() {
    return {
      kind,
      keys: slots.map(s => s.key),
      slot: st.slot,
      syncable: !slots.some(s => s.key.startsWith('file:')),
    };
  }
  function refuseBank(next) {
    if (!next || typeof next !== 'object') return 'no bank was given';
    if (next.kind !== kind) return `kind ${next.kind}, and this is a ${kind} tool`;
    const keys = next.keys;
    if (!Array.isArray(keys) || keys.length !== slots.length) {
      return `${Array.isArray(keys) ? keys.length : 'no'} keys, and the bank holds ${slots.length}`;
    }
    for (const key of keys) {
      if (typeof key !== 'string' || !key) return 'a key that is not a name';
      if (key.startsWith('file:')) return `a picked file, ${key}, whose contents live only in the page that read it`;
      if (!h.knows(key)) return `a key this tool does not carry, ${key}`;
    }
    if (!Number.isInteger(next.slot) || next.slot < 0 || next.slot >= slots.length) return `no slot ${next.slot}`;
    if (st.mode === 'LOAD') return 'the drawer is open, and the reader is choosing';
    return null;
  }
  function setBank(next, by = 'peer') {
    const why = refuseBank(next);
    if (why) { emit('bank-refused', { why }); return false; }
    emit('bank-set', { keys: [...next.keys], slot: next.slot, by });
    next.keys.forEach((key, i) => {
      if (slots[i].key === key) return;
      drop(slots, i, key);
      h.load(i, key);
    });
    h.save();
    h.choose(next.slot);
    return true;
  }

  function afterKnobs(changed) {
    st.picked = null; st.pickRefused = null;
    const one = admitted(ks);
    if (changed) emit('tapes-match', { count: matching(ks).length });
    if (one && one !== st.admittedBefore) emit('run-admitted', { id: one });
    st.admittedBefore = one;
    updateKnobs();
  }
  function turnKnob(name, dir) {
    if (name === SHUF) return shuffleKnobs(dir);
    st.focusKnob = name;
    const r = turn(ks, name, dir);
    if (r.refused) { emit('knob-refused', { knob: name, why: r.refused }); say(`${name}: ${r.refused}`); return; }
    emit('knob-turn', { knob: name, from: r.from, to: r.to, label: valueAt(ks, name).label, by: 'reader' });
    afterKnobs(false);
  }
  function toggleLock(name) {
    if (name === SHUF) return lockEvery();
    st.focusKnob = name;
    if (isLocked(ks, name)) {
      unlock(ks, name);
      emit('knob-unlock', { knob: name });
    } else {
      const r = lock(ks, name);
      if (r.refused) { emit('knob-refused', { knob: name, why: r.refused }); say(`${name}: ${r.refused}`); return; }
      emit('knob-lock', { knob: name, value: r.value, by: 'reader' });
      for (const x of r.turned) {
        emit('knob-turn', { knob: x.knob, from: x.from, to: x.to, label: valueAt(ks, x.knob).label, by: 'machine' });
      }
    }
    afterKnobs(true);
    sayCount();
  }
  function sayCount() {
    const one = admitted(ks);
    say(one ? W.saidAvailable(1, strip(one, false)) : W.saidAvailable(matching(ks).length, null));
  }
  function shuffleKnobs(dir) {
    st.focusKnob = SHUF;
    if (allLocked(ks)) { emit('knob-refused', { knob: SHUF, why: 'locked' }); say(`${SHUF}: ${W.allLockedSay}`); updateKnobs(); return; }
    const r = shuffle(ks);
    if (r.refused) { emit('knob-refused', { knob: SHUF, why: r.refused }); say(`${SHUF}: ${r.refused}`); return; }
    st.shufAngle = (st.shufAngle || 0) + 90 + Math.random() * 180;
    shuffleSlide(shuf, dir || 1);
    emit('shuffle', { id: r.id });
    for (const x of r.turned) emit('knob-turn', { knob: x.knob, from: x.from, to: x.to, label: valueAt(ks, x.knob).label, by: 'machine' });
    afterKnobs(false);
    say(W.saidShuffled(strip(r.id, false)));
  }
  function lockEvery() {
    st.focusKnob = SHUF;
    if (allLocked(ks)) {
      const r = unlockAll(ks);
      for (const n of r.unlocked) emit('knob-unlock', { knob: n });
      emit('unlock-all', {});
    } else {
      const r = lockAll(ks);
      for (const x of r.locked) {
        emit('knob-lock', { knob: x.knob, value: x.value, by: 'reader' });
        for (const t of x.turned) emit('knob-turn', { knob: t.knob, from: t.from, to: t.to, label: valueAt(ks, t.knob).label, by: 'machine' });
      }
      if (r.refused) { emit('knob-refused', { knob: SHUF, why: r.refused }); say(`${SHUF}: ${r.refused}`); }
      else emit('lock-all', { count: matching(ks).length });
    }
    afterKnobs(true);
    sayCount();
  }

  pickInput.addEventListener('change', () => {
    const file = pickInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let exp, r;
      try {
        exp = JSON.parse(reader.result);
        const theirs = h.kindOf(exp);
        r = theirs && theirs !== kind
          ? { ok: false, refusals: [W.wrongKind(theirs, kind)] }
          : intake(exp);
      } catch (err) { r = { ok: false, refusals: [`not JSON: ${err.message}`] }; }
      if (!r.ok) {
        st.picked = null; st.pickRefused = { file: file.name, refusals: r.refusals };
        emit('pick-refused', { file: file.name, refusals: r.refusals });
        say(W.saidRefused(r.refusals[0]));
      } else {
        const kept = h.keep(exp, r.verdict);
        st.picked = { key: kept.key, verdict: W.judged(r.verdict), gaps: r.gaps, name: file.name };
        st.pickRefused = null;
        emit('pick-accepted', { id: kept.id, verdict: r.verdict });
        say(W.saidInBox(kept.id));
      }
      pickInput.value = '';
      updateKnobs();
    };
    reader.readAsText(file);
  });

  drawer.addEventListener('click', e => {
    const half = e.target.closest('.kface .half');
    if (half) { turnKnob(half.closest('.knob').dataset.knob, Number(half.dataset.dir)); return; }
    const lever = e.target.closest('.lever');
    if (lever) toggleLock(lever.closest('.knob').dataset.knob);
  });
  bank.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.id === id.modeKey) { emit('modekey', { to: st.mode === 'PLAY' ? 'LOAD' : 'PLAY' }); setMode(st.mode === 'PLAY' ? 'LOAD' : 'PLAY'); return; }
    if (syncKey && b === syncKey) { setArmed(!armed); return; }
    if (b.dataset.slot !== undefined) {
      const i = Number(b.dataset.slot);
      if (st.mode === 'LOAD') loadInto(i); else h.choose(i);
    }
  });
  if (syncKey && !bank.contains(syncKey)) {
    syncKey.addEventListener('click', () => { if (!syncKey.disabled) setArmed(!armed); });
  }
  drawer.addEventListener('focusin', e => {
    const k = e.target.closest('.knob');
    if (k) { st.focusKnob = k.dataset.knob; updateKnobs(); }
  });
  drawer.addEventListener('keydown', e => {
    const face = e.target.closest && e.target.closest('.kface');
    if (!face) return;
    const name = face.closest('.knob').dataset.knob;
    if (['ArrowRight', 'ArrowUp'].includes(e.key)) { e.preventDefault(); turnKnob(name, 1); }
    else if (['ArrowLeft', 'ArrowDown'].includes(e.key)) { e.preventDefault(); turnKnob(name, -1); }
    else if (e.key === 'Enter') { e.preventDefault(); toggleLock(name); }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && st.mode === 'LOAD') setMode('PLAY'); });

  return {
    drawer, bank, presetKeys, modeKey, knobEls, shuf, updateKnobs, updateBank, setMode, loadInto, boxTape,
    kind, syncKey, bankState, setBank,
    isArmed: () => armed,
    setArmed,
  };
}



function mountCounter(cfg) {
  const {
    root,
    host,
    order = 'counter-first',
    keyClass = 'tp',
    narrow = false,
    st,
    bus,
    say,
    hooks = {},
    ids = {},
  } = cfg;
  const id = { counter: null, ...ids };
  const h = {
    reading: () => ({ session: 0, N: 0, live: false, cue: null }),
    setCue: () => null,
    goTo: () => {},
    winding: () => false,
    render: () => {},
    ...hooks,
  };
  const W = {
    cue: 'CUE', locate: 'LOCATE',
    cueAria: 'set this cue at the head', locateAria: 'wind to the counter\'s setting, or to the cue',
    wheelAria: place => `counter, ${place}`,
    places: ['hundreds', 'tens', 'ones'],
    unit: 'S', of: n => ` of ${n}`,
    set: ' SET', wind: ' WIND', cueLine: s => ` cue ${pad3(s)}`,
    saidCue: s => `cue set at ${s ? 'session ' + s : 'the leader'}`,
    saidPast: (to, n) => `S${pad3(to)} is past the end; going to S${pad3(n)}`,
    saidNothing: 'Nothing to locate: set the counter or press CUE first.',
    whyNothing: 'no setting and no cue',
    icons: { cue: '', locate: '' },
    ...(cfg.words || {}),
  };

  const el = (tag, attrs = {}, text = '') => {
    const x = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
    if (text) x.textContent = text;
    return x;
  };
  const emit = (name, detail = {}) => bus.emit(name, detail);

  const keys = el('div', { class: 'k2' });
  const keyEls = {};
  for (const [k, label, aria] of [['cue', W.cue, W.cueAria], ['locate', W.locate, W.locateAria]]) {
    const b = el('button', { 'data-k': k, 'aria-label': aria });
    b.innerHTML = `<i class="ic" aria-hidden="true">${W.icons[k] || ''}</i><span class="kl">${label}</span>`;
    keys.appendChild(b);
    keyEls[k] = b;
  }

  const counter = el('span', id.counter ? { class: 'counter', id: id.counter } : { class: 'counter' });
  const cdisp = el('span', { class: 'cdisp' });
  cdisp.appendChild(el('span', { class: 'cs' }, W.unit));
  const wheels = W.places.map((place, i) => {
    const w = i === 0 ? el('span', { class: 'wheel fixed', 'data-w': '0', 'aria-hidden': 'true' }, '0')
      : el('span', { class: 'wheel', role: 'spinbutton', tabindex: '0', 'data-w': String(i),
        'aria-label': W.wheelAria(place), 'aria-valuemin': '0', 'aria-valuemax': '9', 'aria-valuenow': '0' }, '0');
    cdisp.appendChild(w);
    return w;
  });
  const ofN = el('span', { class: 'cof' });
  cdisp.appendChild(ofN);
  const csub = el('span', { class: 'csub' });
  const flag = el('span', { class: 'flag' });
  const cueText = el('span', { class: 'cue' });
  csub.append(flag, cueText);
  counter.append(cdisp, csub);

  const row = el('div', { class: `${keyClass} tp2` });
  if (narrow) row.dataset.counterNarrow = '';
  if (order === 'keys-first') row.append(keys, counter); else row.append(counter, keys);
  host.appendChild(row);
  root.dataset.counterHost = '';

  function update(r) {
    const live = !!r.live;
    for (const w of wheels) w.setAttribute('aria-disabled', String(!live));
    const digits = st.set || digitsOf(r.session || 0);
    wheels.forEach((w, i) => {
      if (w.textContent !== String(digits[i])) w.textContent = String(digits[i]);
      w.setAttribute('aria-valuenow', String(digits[i]));
    });
    counter.classList.toggle('set', !!st.set);
    counter.classList.toggle('adjust', !!(st.set || st.adjust));
    flag.textContent = st.set ? W.set : r.winding ? W.wind : '';
    ofN.textContent = W.of(r.N);
    cueText.textContent = r.cue === null || r.cue === undefined ? '' : W.cueLine(r.cue);
  }

  function forgetSetting() { st.set = null; }
  function clearAdjust() { st.adjust = false; }
  function reset() { st.set = null; st.adjust = false; }

  function wheel(i, delta) {
    if (i === 0) return;
    if (st.mode !== 'PLAY' || h.winding()) return;
    const r = h.reading();
    if (!r.live) return;
    if (!st.set) st.set = digitsOf(r.session || 0);
    st.set = rollWheel(st.set, i, delta, r.N);
    emit('wheel-set', { digits: st.set.join('') });
    h.render();
  }

  function setCue() {
    const r = h.setCue();
    if (!r) return;
    st.adjust = true;
    emit('cue-set', r);
    h.render();
    say(W.saidCue(r.session));
  }

  function locate() {
    const r = h.reading();
    if (!r.live) return;
    st.adjust = true;
    if (st.set) {
      const c = clampTo(valueOf3(st.set), r.N);
      if (c.past) say(W.saidPast(valueOf3(st.set), r.N));
      h.goTo(c.to, 'counter');
    } else if (r.cue !== null && r.cue !== undefined) {
      h.goTo(r.cue, 'cue');
    } else {
      emit('locate-refused', { why: W.whyNothing });
      say(W.saidNothing);
    }
  }

  counter.addEventListener('click', e => {
    const w = e.target.closest('.wheel');
    if (!w) return;
    const b = w.getBoundingClientRect();
    wheel(Number(w.dataset.w), e.clientY < b.top + b.height / 2 ? 1 : -1);
  });
  counter.addEventListener('keydown', e => {
    const w = e.target.closest && e.target.closest('.wheel');
    if (!w) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); wheel(Number(w.dataset.w), 1); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); wheel(Number(w.dataset.w), -1); }
    else if (e.key === 'Enter') { e.preventDefault(); locate(); }
  });
  keys.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b.dataset.k === 'cue') setCue();
    else if (b.dataset.k === 'locate') locate();
  });

  update(h.reading());
  return {
    row, counter, keys, keyEls, wheels, cdisp, flag, cueText,
    update, wheel, locate, setCue,
    reset, forgetSetting, clearAdjust,
    setting: () => (st.set ? st.set.slice() : null),
    events: COUNTER_EVENTS,
  };
}



const REEL = { HUB: 22, RMAX: 130, RF: 137 };
const wrapT = N => (REEL.RMAX - REEL.HUB) / N;

const LANE_NAMES = ['catalog', 'delivery', 'copied', 'in_hand', 'by_name', 'not_taken',
  'off', 'r1', 'r2', 'r3', 'r4', 'arc'];
const LANE_XS = LANE_NAMES.map(n => LP[n]);
const LANE_X0 = Math.min(...LANE_XS), LANE_X1 = Math.max(...LANE_XS);
const LANE_U = LANE_NAMES.map(n => (LP[n] - LANE_X0) / (LANE_X1 - LANE_X0));
const WEDGE = LANE / (LANE_X1 - LANE_X0 + LANE) * 360;
const WINDOWS = [0, 120, 240], WIN_HALF = 46;

function polar(r, d) {
  const a = (d - 90) * Math.PI / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}
const e1Angle = (u, w) => w - WIN_HALF + 4 + u * (2 * WIN_HALF - 8);
const wedgeMid = u => u * (360 - WEDGE) + WEDGE / 2;
function subRadius(reel, ring, band, T) {
  const r = REEL.HUB + (ring + 0.5) * T, e = reel === 'up' ? -T / 4 : T / 4;
  return r + (band === 0 ? e : -e);
}

const laneIndexOf = rung => LANE_NAMES.indexOf(rung === OFF ? 'off' : rung);

function sessionMarks(run, s) {
  const f = frame(run, s);
  if (!f) return [];
  const out = [];
  if (f.slot.rung) out.push([0, laneIndexOf(f.slot.rung), 'dot']);
  (f.slot.grain.rows || []).forEach((r, i) => { if (r.count > 0) out.push([0, laneIndexOf('r' + (i + 1)), 'sq']); });
  if (f.frame.catalog) out.push([1, laneIndexOf('catalog'), 'dot']);
  if (f.frame.delivery) out.push([1, laneIndexOf('delivery'), 'dot']);
  if (f.frame.page) out.push([1, laneIndexOf(f.frame.page), 'dot']);
  if (f.arc) out.push([1, laneIndexOf('arc'), 'dot']);
  return out;
}

const MARK_CACHE = new WeakMap();
function marksOf(run) {
  if (!MARK_CACHE.has(run)) {
    const all = [[]];
    for (let s = 1; s <= run.N; s++) all.push(sessionMarks(run, s));
    MARK_CACHE.set(run, all);
  }
  return MARK_CACHE.get(run);
}

function lampsLit(run, kf, lifted = false) {
  const { k } = head(run, kf);
  if (lifted || k < 1) return new Set();
  return new Set(marksOf(run)[k].map(([, li]) => LANE_NAMES[li]));
}

function reelAt(run, kf) {
  const h = head(run, kf), p = packs(run, kf), N = run.N, T = wrapT(N);
  const up = [], dn = [];
  for (let s = 1; s <= h.k - 1; s++) up.push([s, s - 1]);
  for (let s = h.k + 2; s <= N; s++) dn.push([s, N - s]);
  return {
    k: h.k, frac: h.frac, T,
    rot: h.frac === 0 ? 0 : -360 * h.frac,
    rUp: REEL.HUB + p.takeup * T,
    rDn: REEL.HUB + p.supply * T,
    up, dn,
    upPart: h.k >= 1 ? [h.k, h.k - 1] : null,
    dnPart: h.k + 1 <= N ? [h.k + 1, N - h.k - 1] : null,
  };
}

function touchAngle(reel, r, L) {
  const a = Math.acos(Math.min(r / L, 1)) * 180 / Math.PI;
  return reel === 'up' ? 90 - a : 90 + a;
}

const smearOf = v => Math.min(Math.max((v - 3) / 2, 0), 1);

const METER = { A0: -50, A1: 50, PARK: -58 };
function meterAngle(value, top) {
  if (value === null || value === undefined) return METER.PARK;
  return METER.A0 + (METER.A1 - METER.A0) * Math.min(Math.max(value / top, 0), 1);
}

const NEEDLE = { K: 140, ZETA: 0.6 };
function needleStep(n, target, dt, reduced = false) {
  const k = NEEDLE.K, c = 2 * (reduced ? 1 : NEEDLE.ZETA) * Math.sqrt(k);
  let { a, w } = n, t = Math.min(dt, 0.25);
  while (t > 1e-9) {
    const h = Math.min(t, 0.004);
    w += (k * (target - a) - c * w) * h;
    a += w * h;
    t -= h;
  }
  return { a, w };
}

const LOOK_AHEAD = 6;
const FADE_FLOOR = 0.3;
const fadeOf = (k, s) => Math.max(FADE_FLOOR, 1 - (k - s) / 12);

function scopeAt(run, kf, lifted = false) {
  const { k, frac } = head(run, kf), N = run.N, b = run.exp.bars;
  const pt = s => ({ s, sem: b.semantic_distance[s - 1], run: b.session_running[s - 1] });
  const played = [], ghost = [];
  for (let s = 1; s <= k; s++) played.push(pt(s));
  for (let s = k + 1; s <= Math.min(k + LOOK_AHEAD, N); s++) ghost.push(pt(s));
  const f = k >= 1 && !lifted ? frame(run, k) : null;
  const horizon = f ? (f.slot.from || []).filter(s => s >= 1 && s < k) : [];
  const bands = [];
  for (let s0 = 1; s0 <= Math.min(N, 36); s0 += 6) {
    const x = bandOf(run, s0);
    if (x) bands.push({ s0, s1: Math.min(s0 + 5, N), value: x.value, verdict: x.verdict });
  }
  return { k, frac, N, played, ghost, horizon, bands };
}



const FLO_SCHEMAS = ['flo-1.0'];

const FLO_WINDOWS = ['1', '3', '6', '12', 'all'];

const FLO_BANDS = ['opening', 'middle', 'end'];

const FLO_SCALES = Object.freeze({
  chassis: Object.freeze({ slots: 16 }),

  ladder: Object.freeze({
    min: -2.5, max: 2.5, rung: 0.25, rungsEachWay: 10,
    reservedTop: true, reservedBottom: true,
    unit: 'bits', labelEvery: 2,
  }),

  counts: Object.freeze({
    '1': Object.freeze({ min: 0, max: 3, rung: 1, unit: 'returns' }),
    '3': Object.freeze({ min: 0, max: 7, rung: 1, unit: 'returns' }),
    '6': Object.freeze({ min: 0, max: 9, rung: 1, unit: 'returns' }),
    '12': Object.freeze({ min: 0, max: 14, rung: 1, unit: 'returns' }),
    'all': Object.freeze({ min: 0, max: 33, rung: 1, unit: 'returns' }),
  }),

  cumulativeCountScale: 'all',

  envelope: Object.freeze({ min: 0, max: 1, rung: null, unit: 'gini' }),

  zoomEnvelope: Object.freeze({
    min: 0, max: 2, rung: null, evenMark: 1, reservedTop: true, unit: 'x even share',
  }),
});

const FLO_LETTER_MEMORY = Object.freeze(['LETTER', 'NONE+LTR', 'DIARY+LTR']);

const FLO_FAILED = Object.freeze(['refused', 'malformed', 'begun']);


function makeFloRun(exp, floorFile, bounds, checks, entry = null) {
  if (!FLO_SCHEMAS.includes(exp.schema_version)) {
    throw new Error(`schema ${exp.schema_version} is not one this model reads`);
  }
  if (!floorFile || floorFile.corpus !== exp.corpus) {
    throw new Error(`${exp.run}: a ${exp.corpus} run against the floor file for ` +
                    `${floorFile ? floorFile.corpus : 'nothing'} (decision 44)`);
  }
  const N = exp.N;
  if (exp.sessions.length !== N) {
    throw new Error(`${exp.run}: ${exp.sessions.length} sessions against N ${N}`);
  }
  const eff = bounds && bounds.effective_by_room ? bounds.effective_by_room[exp.corpus] : null;
  if (!eff) throw new Error(`${exp.run}: bounds.json carries no effective_by_room for ${exp.corpus}`);

  const sources = Object.keys(floorFile.sources);
  return {
    id: exp.run,
    corpus: exp.corpus,
    N,
    sources,
    effective: eff,
    knobs: entry ? entry.knobs : null,
    exp,
    floor: floorFile,
    bounds,
    checks,
  };
}

function floorFor(run, source) {
  const s = run.floor.sources[source];
  return s ? s.floor : null;
}

function slotsOf(run) {
  const out = [];
  for (let i = 0; i < FLO_SCALES.chassis.slots; i++) {
    const src = i < run.sources.length ? run.sources[i] : null;
    out.push({
      index: i,
      source: src,
      dark: src === null,
      family: src ? src[0] : null,
      label: src,
      effective: src ? run.effective[src] : null,
      inRun: src ? Object.prototype.hasOwnProperty.call(run.exp.sources, src) : false,
    });
  }
  return out;
}

function rungsOf(value, scale) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { value: null, lit: null, frac: null, over: false, under: false };
  }
  const over = value > scale.max;
  const under = value < scale.min;
  const held = Math.min(Math.max(value, scale.min), scale.max);
  return {
    value,
    lit: scale.rung ? Math.trunc(held / scale.rung) : null,
    frac: (held - scale.min) / (scale.max - scale.min),
    over,
    under,
  };
}


function floLo(session, window) {
  if (window === 'all') return 1;
  return Math.max(1, session - Number(window) + 1);
}

function floPartial(session, window) {
  return window !== 'all' && session < Number(window);
}

function floAt(run, source, field, window, session) {
  const rec = run.exp.sources[source];
  if (!rec) return null;
  const series = rec[field];
  const arr = series && !Array.isArray(series) ? series[window] : series;
  if (!arr) return null;
  const v = arr[session - 1];
  return v === undefined ? null : v;
}

function floReturnsIn(run, session, window, source) {
  const search = new Map(), cont = new Map();
  let searchTotal = 0, contTotal = 0;
  if (session === null) return { search, cont, searchTotal, contTotal };
  const from = floLo(session, window);
  for (let k = from; k <= session; k++) {
    for (const x of run.exp.sessions[k - 1].returns) {
      const cut = x.key.lastIndexOf('|');
      if (source !== null && x.key.slice(0, cut) !== source) continue;
      const n = Number(x.key.slice(cut + 1));
      if (x.channel === 'search') { search.set(n, (search.get(n) || 0) + 1); searchTotal++; }
      else { cont.set(n, (cont.get(n) || 0) + 1); contTotal++; }
    }
  }
  return { search, cont, searchTotal, contTotal };
}

function floFailedIn(run, session, window) {
  if (session === null) return 0;
  let n = 0;
  for (let k = floLo(session, window); k <= session; k++) {
    if (run.exp.sessions[k - 1].status !== 'submitted') n++;
  }
  return n;
}

function floBandOf(run, source, n) {
  const s = run.floor.sources[source];
  if (!s || s.passages < 3) return null;
  return FLO_BANDS[Math.min(2, Math.floor((3 * (n - 1)) / s.passages))];
}


function gateAt(run, session, window) {
  const atLeader = session === null;
  const slots = slotsOf(run).map(slot => {
    if (slot.dark || atLeader) {
      return {
        ...slot, bend: null, nullSd: null, n: null, continueN: null,
        detent: null, inDetent: null, censored: false, hatched: false,
        rungs: rungsOf(null, FLO_SCALES.ladder),
      };
    }
    const bend = floAt(run, slot.source, 'bend', window, session);
    const nullSd = floAt(run, slot.source, 'null_sd', window, session);
    const n = floAt(run, slot.source, 'n', window, session) ?? 0;
    const { contTotal } = floReturnsIn(run, session, window, slot.source);
    return {
      ...slot,
      bend,
      nullSd,
      n,
      continueN: contTotal,
      detent: nullSd === null ? null : { lo: -2 * nullSd, hi: 2 * nullSd },
      inDetent: bend === null || nullSd === null ? null : Math.abs(bend) <= 2 * nullSd,
      censored: n === 0,
      hatched: contTotal > 0,
      rungs: rungsOf(bend, FLO_SCALES.ladder),
    };
  });
  return {
    session,
    window,
    atLeader,
    scale: FLO_SCALES.ladder,
    sessionsHeld: atLeader ? 0 : session - floLo(session, window) + 1,
    partial: atLeader ? false : floPartial(session, window),
    failed: floFailedIn(run, session, window),
    slots,
  };
}

function bypassAt(run, session) {
  const scale = FLO_SCALES.counts[FLO_SCALES.cumulativeCountScale];
  const atLeader = session === null;
  let roomDistinct = 0, roomExpected = 0;
  const slots = slotsOf(run).map(slot => {
    if (slot.dark || atLeader) {
      return { ...slot, distinct: null, expected: null, censored: false,
               rungs: rungsOf(null, scale), tick: rungsOf(null, scale) };
    }
    const distinct = floAt(run, slot.source, 'distinct_search_cum', null, session) ?? 0;
    const expected = floAt(run, slot.source, 'expected_search_cum', null, session) ?? 0;
    if (slot.inRun) { roomDistinct += distinct; roomExpected += expected; }
    return {
      ...slot,
      distinct,
      expected,
      censored: distinct === 0,
      rungs: rungsOf(distinct, scale),
      tick: rungsOf(expected, scale),
    };
  });
  return {
    session,
    atLeader,
    since: 1,
    scale,
    room: atLeader ? { distinct: null, expected: null }
                   : { distinct: roomDistinct, expected: Math.round(roomExpected * 100) / 100 },
    slots,
  };
}

function positionAt(run, session) {
  const scale = FLO_SCALES.counts[FLO_SCALES.cumulativeCountScale];
  const atLeader = session === null;
  const pos = run.exp.position;
  const eligible = pos.eligible_sources;
  const excluded = pos.excluded_sources;

  const cont = new Map();
  if (!atLeader) {
    for (let k = 1; k <= session; k++) {
      for (const x of run.exp.sessions[k - 1].returns) {
        if (x.channel === 'search') continue;
        const cut = x.key.lastIndexOf('|');
        const src = x.key.slice(0, cut);
        const b = floBandOf(run, src, Number(x.key.slice(cut + 1)));
        if (b === null) continue;
        const key = src + '|' + b;
        cont.set(key, (cont.get(key) || 0) + 1);
      }
    }
  }

  const rows = FLO_BANDS.map(band => {
    let roomSearch = 0, roomContinue = 0;
    const slots = slotsOf(run).map(slot => {
      const elig = slot.source !== null && eligible.includes(slot.source);
      if (slot.dark || atLeader || !elig) {
        return { ...slot, eligible: elig, search: null, continueN: null, roomAlone: null,
                 censored: !slot.dark && !elig, hatched: false,
                 rungs: rungsOf(null, scale), tick: rungsOf(null, scale) };
      }
      const per = pos.per_source_search_cumulative[slot.source];
      const search = per ? per[band][session - 1] : 0;
      const continueN = cont.get(slot.source + '|' + band) || 0;
      const total = per ? FLO_BANDS.reduce((t, b) => t + per[b][session - 1], 0) : 0;
      const share = run.floor.sources[slot.source].band_room_share;
      const roomAlone = share === null ? null : total * share[band];
      roomSearch += search; roomContinue += continueN;
      return {
        ...slot,
        eligible: true,
        search,
        continueN,
        roomAlone,
        censored: search === 0,
        hatched: continueN > 0,
        rungs: rungsOf(search, scale),
        tick: rungsOf(roomAlone, scale),
      };
    });
    return {
      band,
      slots,
      room: atLeader ? { search: null, continue: null, roomExpected: null } : {
        search: pos.cumulative.search[band][session - 1],
        continue: pos.cumulative.continue[band][session - 1],
        roomExpected: pos.cumulative.room_expected_search[band][session - 1],
      },
      counted: atLeader ? null : { search: roomSearch, continue: roomContinue },
    };
  });
  return { session, atLeader, since: 1, scale, eligible, excluded, rows };
}

function zoomAt(run, session, window, source) {
  const rows = floorFor(run, source);
  if (rows === null) return null;
  const scale = FLO_SCALES.counts[window];
  const atLeader = session === null;
  const { search, cont, searchTotal } = floReturnsIn(run, session, window, source);
  const passages = rows.map(p => {
    const count = search.get(p.n) || 0;
    const continueN = cont.get(p.n) || 0;
    const roomAlone = atLeader ? null : p.weight * searchTotal;
    return {
      n: p.n,
      band: p.band,
      weight: p.weight,
      r1Share: p.r1_share,
      r1Zero: p.r1_zero,
      reachable: p.reachable,
      count: atLeader ? null : count,
      continueN: atLeader ? null : continueN,
      roomAlone,
      reached: count > 0,
      hatched: continueN > 0,
      rungs: rungsOf(atLeader ? null : count, scale),
      tick: rungsOf(roomAlone, scale),
    };
  });
  return {
    source,
    session,
    window,
    atLeader,
    scale,
    printedList: passages.length > FLO_SCALES.chassis.slots,
    passages,
    searchTotal: atLeader ? null : searchTotal,
    reached: passages.filter(p => p.reached).length,
    overflows: passages.length > FLO_SCALES.chassis.slots,
  };
}

function envelopeAt(run, source = null) {
  if (source === null) {
    return {
      zoom: false,
      scale: FLO_SCALES.envelope,
      slots: slotsOf(run).map(slot => {
        const gini = slot.dark ? null : run.floor.sources[slot.source].gini_r1;
        return { ...slot, gini, rungs: rungsOf(gini, FLO_SCALES.envelope) };
      }),
    };
  }
  const s = run.floor.sources[source];
  if (!s) return null;
  const scale = FLO_SCALES.zoomEnvelope;
  return {
    zoom: true,
    source,
    scale,
    printedList: s.floor.length > FLO_SCALES.chassis.slots,
    overflows: s.floor.length > FLO_SCALES.chassis.slots,
    passages: s.floor.map(p => {
      const multiple = p.r1_share === null ? null : p.r1_share * s.passages;
      return {
        n: p.n,
        r1Share: p.r1_share,
        multiple,
        even: scale.evenMark,
        r1Zero: p.r1_zero,
        rungs: rungsOf(multiple, scale),
      };
    }),
  };
}

function peakAt(run, session, window) {
  const atLeader = session === null;
  const slots = slotsOf(run).map(slot => {
    if (slot.dark || atLeader) return { ...slot, peak: null, atSession: null, rungs: rungsOf(null, FLO_SCALES.ladder) };
    let peak = null, at = null;
    for (let k = 1; k <= session; k++) {
      const v = floAt(run, slot.source, 'bend', window, k);
      if (v === null) continue;
      if (peak === null || v > peak) { peak = v; at = k; }
    }
    return { ...slot, peak, atSession: at, rungs: rungsOf(peak, FLO_SCALES.ladder) };
  });
  return { session, window, scale: FLO_SCALES.ladder, slots };
}

function momentAt(run, session, window, source = null) {
  const atLeader = session === null;
  const sess = atLeader ? null : run.exp.sessions[session - 1];
  const status = sess ? sess.status : null;
  const lamps = {};
  for (const f of FLO_FAILED) lamps[f] = status === f;
  const out = {
    run: run.id,
    corpus: run.corpus,
    session,
    atLeader,
    status,
    lamps,
    failedInWindow: floFailedIn(run, session, window),
    partial: atLeader ? false : floPartial(session, window),
    window,
    source: null,
    bits: null, detent: null, n: null, continueN: null,
    effective: null, asIf: null, asIfUnder1: false, asIfClamped: false,
    censored: false, dark: false,
  };
  if (source === null) return out;
  const held = run.sources.includes(source);
  out.source = source;
  out.dark = !held;
  if (!held || atLeader) return out;
  const bend = floAt(run, source, 'bend', window, session);
  const nullSd = floAt(run, source, 'null_sd', window, session);
  const n = floAt(run, source, 'n', window, session) ?? 0;
  const { contTotal } = floReturnsIn(run, session, window, source);
  const effective = run.effective[source];
  const asIf = bend === null ? null : Math.round((effective / 2 ** bend) * 100) / 100;
  out.bits = bend;
  out.detent = nullSd === null ? null : { lo: -2 * nullSd, hi: 2 * nullSd };
  out.n = n;
  out.continueN = contTotal;
  out.effective = effective;
  out.asIf = asIf;
  out.asIfUnder1 = asIf !== null && asIf < 1;
  out.asIfClamped = out.asIfUnder1;
  out.censored = n === 0;
  return out;
}

function decayRows(run) {
  const readings = run.checks && run.checks.persistence ? run.checks.persistence.readings : null;
  const absent = run.corpus !== 'S7';
  const mem = run.knobs ? run.knobs.MEMORY : null;
  const letter = mem === null ? null : FLO_LETTER_MEMORY.includes(mem);
  const row = (label, key, lamp) => {
    const r = readings ? readings[key] : null;
    return {
      label,
      key,
      lamp,
      halfLife: absent || !r ? null : r.half_life_sessions,
      events: absent || !r ? null : r.events,
      absent: absent || !r,
    };
  };
  return {
    unit: 'sessions',
    scope: run.checks && run.checks.persistence ? run.checks.persistence.scope : null,
    absent,
    memory: mem,
    rows: [
      row('unassisted', 'refreshed|no_letter', letter === null ? null : letter === false),
      row('with the letter', 'refreshed|letter_received', letter === null ? null : letter === true),
    ],
  };
}

function numbersAt(run, session, window, view = 'RETURNS', source = null) {
  const caption = {
    run: run.id,
    corpus: run.corpus,
    session,
    status: session === null ? null : run.exp.sessions[session - 1].status,
    window: view === 'RETURNS' ? window : 'since S1',
    view,
    zoom: source,
  };
  if (view === 'POSITION') {
    const p = positionAt(run, session);
    return {
      caption,
      shape: 'position',
      excluded: p.excluded,
      rows: p.rows.map(r => ({
        band: r.band,
        room: r.room,
        columns: r.slots.filter(s => !s.dark).map(s => ({
          source: s.source, eligible: s.eligible, search: s.search,
          continue: s.continueN, roomAlone: s.roomAlone,
        })),
      })),
    };
  }
  if (source !== null) {
    const z = zoomAt(run, session, window, source);
    const e = envelopeAt(run, source);
    if (z === null) return null;
    const share = new Map(e.passages.map(p => [p.n, p.multiple]));
    return {
      caption,
      shape: 'zoom',
      source,
      printedList: z.printedList,
      searchTotal: z.searchTotal,
      rows: z.passages.map(p => ({
        passage: p.n, band: p.band, count: p.count, continue: p.continueN,
        roomAlone: p.roomAlone, shareOfEven: share.get(p.n) ?? null, reached: p.reached,
      })),
    };
  }
  if (view === 'BYPASS') {
    const b = bypassAt(run, session);
    return {
      caption,
      shape: 'bypass',
      room: b.room,
      rows: b.slots.filter(s => !s.dark).map(s => ({
        source: s.source, effective: s.effective,
        distinct: s.distinct, roomAlone: s.expected,
      })),
    };
  }
  const g = gateAt(run, session, window);
  const e = envelopeAt(run, null);
  const gini = new Map(e.slots.map(s => [s.source, s.gini]));
  return {
    caption,
    shape: 'returns',
    roomAloneInWindow: null,
    roomAloneAbsent: 'no per-source room count across sources exists in the files; ' +
                     'zero bits is ROOM ALONE on the ladder (decisions 16 and 22)',
    rows: g.slots.filter(s => !s.dark).map(s => {
      const m = momentAt(run, session, window, s.source);
      return {
        source: s.source,
        effective: s.effective,
        bits: s.bend,
        detent: s.detent,
        inDetent: s.inDetent,
        n: s.n,
        continue: s.continueN,
        asIf: m.asIf,
        asIfUnder1: m.asIfUnder1,
        gini: gini.get(s.source) ?? null,
        censored: s.censored,
        distinctSinceS1: session === null ? null : floAt(run, s.source, 'distinct_search_cum', null, session) ?? 0,
        roomAloneSinceS1: session === null ? null : floAt(run, s.source, 'expected_search_cum', null, session) ?? 0,
      };
    }),
  };
}



function mountFlo(cfg) {
  const {
    host,
    width,
    data,
    say,
    storage = null,
    slots: sharedSlots = null,
    drawer: drawerOpt,
    drawerIds = {},
    drawerOver = false,
    syncShown = false,
    hold: holdOpt = false,
  } = cfg;
  const shared = sharedSlots !== null && drawerOpt === null;

  const FLO_EVENTS = Object.freeze([...DRAWER_EVENTS, ...COUNTER_EVENTS,
    'room',
    'corpus',
    'tool-dark',
    'window',
    'view',
    'floor',
    'zoom',
    'zoom-leave',
    'cursor',
    'peak',
    'solo',
    'focus',
    'display',
    'flo-rewind',
  ]);
  const bus = makeChannel(FLO_EVENTS);
  const emit = (name, detail = {}) => bus.emit(name, detail);

  const W = {
    model: 'FLO 1.0', desc: 'RETURNS METER',
    doi: 'doi:10.5281/zenodo.23663062', who: 'Mike Edwards', licence: 'CC BY 4.0',
    roomAlone: 'ROOM ALONE',
    detentLegend: "within the room's spread",
    sinceS1: 'since S1',
    setByPreset: 'SET BY PRESET',
    decayHead: 'DECAY, sessions',
    decayRows: ['unassisted', 'with the letter'],
    under1: 'under 1 passage',
    gini: 'GINI', solo: 'SOLO',
    earlier: n => `+${n} earlier`,
    dealt: (r, e) => `reached ${r}; the index alone would have dealt ${e}`,
    ...(cfg.words || {}),
  };

  const ROOMS = ['S7', 'S36', 'S105', 'S3457'];
  const ROOM_LABEL = { S7: 's7', S36: 's36', S105: 's105', S3457: 's3457' };
  const SLOTS = FLO_SCALES.chassis.slots;
  const LADDER = FLO_SCALES.ladder;

  const RUNGS = LADDER.rungsEachWay + 1;
  const RUNG_H = 10, RUNG_GAP = 3, ZERO_BAND = 8;
  const LADDER_H = 2 * (ZERO_BAND / 2 + RUNGS * (RUNG_H + RUNG_GAP));
  const RUNG_W = 9, RUNG_WGAP = 1;
  const LADDER_W = 2 * (ZERO_BAND / 2 + RUNGS * (RUNG_W + RUNG_WGAP));

  const LAYOUT = {
    1100: {
      W: 1100, H: 776,
      band: { h: 56, plateY: 6, plateH: 44, logo: [34, 256, 14, 18],
              pilot: 320, pilotTop: 24, cite: [348, 420], badge: [809, 267] },
      strip: null,
      left: 34, leftW: 256, keyX: 192, keyW: 86, axis: 113,
      meterX: 353, pitch: 38, colW: 24,
      preset: [34, 80, 256, 162],
      env: [348, 80, 604, 162],
      moment: [958, 80, 118, 162],
      gate: [34, 258, 256, 167],
      meter: [348, 258, 604, 342],
      axisBox: [296, 258, 56, 342],
      rule: 626,
      counter: [34, 642, 256, 112],
      wheelsY: 672, locateY: 700,
      display: [348, 642, 599, 112],
      dispKeys: [958, 642, 118],
      bank: [0, 800, 1100, 40],
      drawer: [0, 848, 1100, 430],
      page: 1294,
    },
    760: {
      W: 760, H: 796,
      band: { h: 56, plateY: 6, plateH: 44, logo: [24, 186, 19.8, 18],
              pilot: 229.5, pilotTop: 24, cite: [257, 267], badge: [536, 200] },
      strip: null,
      left: 24, leftW: 186, keyX: 122, keyW: 80, axis: 73,
      meterX: 262, pitch: 30, colW: 19,
      moment: [24, 72, 712, 50],
      preset: [24, 136, 186, 162],
      env: [257, 136, 479, 162],
      gate: [24, 310, 186, 167],
      meter: [257, 310, 479, 342],
      axisBox: [212, 310, 45, 342],
      rule: 664,
      counter: [24, 676, 186, 74],
      wheelsY: 694, locateY: 722,
      display: [257, 676, 479, 104],
      dispKeys: [33, 758, 80],
      bank: [0, 820, 760, 40],
      drawer: [0, 868, 760, 430],
      page: 1314,
    },
    375: {
      W: 375, H: 892,
      band: { h: 44, plateY: 7, plateH: 30, logo: [14, 138, 8, 9.5],
              pilot: 164, pilotTop: 18, cite: null, badge: [184, 177] },
      strip: [0, 44, 375, 26],
      H375note: 'sketch 4 draws 838; the two family gaps and the strip\'s second line grow it',
      moment: [16, 82, 343, 58],
      preset: [16, 152, 343, 64],
      gate: [16, 228, 343, 64],
      keyCols: [112, 194.3, 276.6], keyW3: 76.3,
      strip1: 298, strip2: 326,
      rows: { y0: 346, rh: 20, gap: 12, labelX: 18, fader: [46, 106], solo: 112,
              bar: [130, 230], seg: 4 },
      axisBox: [112, 326, 248, 12],
      counterRow: 704,
      dispKeys: [16, 704, 90],
      display: [16, 768, 343, 110],
      bank: [8, 900, 359, 104],
      drawer: [0, 1012, 375, 380],
      page: 1400,
    },
  };
  const Wd = LAYOUT[width] ? width : 1100;
  const L = LAYOUT[Wd];
  const sideways = Wd === 375;

  const el = (tag, attrs = {}, text = '') => {
    const x = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
    if (text) x.textContent = text;
    return x;
  };
  const MARKS = new Set([
    'wordmark', 'pilot-core', 'pilot-ring', 'doi-placard', 'badge', 'sound-glyph',
    'run-id', 'status-lamp',
    'room-knob', 'corpus-key', 'tool-key', 'decay-numeral', 'decay-label',
    'decay-lamp', 'decay-absent', 'envelope-cap', 'envelope-scale',
    'envelope-cap-lamp', 'set-by-preset', 'solo', 'envelope-zoom-cap',
    'column-label', 'effective', 'family-box', 'dark-slot', 'gate-bar',
    'detent-bracket', 'detent-legend', 'ladder', 'ladder-label', 'over-rung',
    'under-rung', 'hollow-square', 'continue-hatch', 'peak-hold', 'peak-lamp',
    'window-knob', 'count-scale', 'window-partial', 'failed-count',
    'bypass-bar', 'bypass-tick', 'bypass-dotted', 'bypass-room-sum', 'since-s1',
    'position-row', 'position-bar', 'position-hatch', 'position-tick', 'position-hollow',
    'zoom-key', 'zoom-column', 'zoom-count', 'zoom-tick', 'printed-list', 'printed-mark',
    'counter', 'cue-line', 'rewind-key', 'view-key', 'floor-key', 'bypass-key',
    'display-key', 'history-row', 'history-earlier', 'numbers-table',
    'as-if-under-1', 'numbers-caption',
  ]);
  if (holdOpt && Wd === 1100) MARKS.add('hold-key');
  const mark = (name, tag = 'div', attrs = {}, text = '') => {
    if (!MARKS.has(name)) throw new Error(`flo-face.js: the mark ${name} answers no row of the sources table`);
    return el(tag, { ...attrs, 'data-mark': name }, text);
  };
  const put = (x, [a, b, w, h]) => {
    Object.assign(x.style, { left: a + 'px', top: b + 'px', width: w + 'px', height: h + 'px' });
    return x;
  };
  const fx = n => (n === null || n === undefined ? '' : String(Math.round(n * 100) / 100));

  const st = {
    mode: 'PLAY', slot: 0,
    run: null,
    k: null,
    window: '6',
    view: 'RETURNS',
    floorIn: true,
    zoom: null, cursor: null,
    solo: new Set(),
    peak: true,
    display: 'HISTORY',
    cue: null,
    synced: false,
    ring: 'none',
    room: 'S7',
    focus: 0,
    set: null, adjust: false,
    picked: null, pickRefused: null, focusKnob: null,
    shufAngle: 0, admittedBefore: null,
  };
  const loaded = () => st.run !== null;
  const room = () => (loaded() ? st.run.corpus : st.room);
  function roomOnly(corpus) {
    return {
      id: null, corpus, N: 0,
      sources: Object.keys(data.floors[corpus].sources),
      effective: data.bounds.effective_by_room[corpus],
      knobs: null, exp: { sources: {}, sessions: [] },
      floor: data.floors[corpus], bounds: data.bounds, checks: data.checks,
    };
  }
  const base = () => (loaded() ? st.run : roomOnly(st.room));
  const tableView = () => (st.view === 'POSITION' ? 'POSITION' : st.floorIn ? 'RETURNS' : 'BYPASS');
  const knobLive = () => st.view === 'RETURNS' && st.floorIn;
  const floorLive = () => st.zoom === null && st.view === 'RETURNS';
  const peakLive = () => st.view === 'RETURNS' && st.floorIn && st.zoom === null;
  const transportLive = () => loaded() && !st.synced;

  const root = el('div', { id: 'flo', 'data-flo-host': '', 'data-width': String(Wd),
                           'data-mode': 'PLAY', 'aria-label': "Flo 1.0, Returns meter" });
  root.style.width = L.W + 'px';
  root.style.height = L.page + 'px';
  const chassis = el('div', { class: 'chassis' });
  put(chassis, [0, 0, L.W, L.H]);
  root.appendChild(chassis);
  host.appendChild(root);

  const band = el('div', { class: 'band' });
  put(band, [0, 0, L.W, L.band.h]);
  chassis.appendChild(band);
  {
    const b = L.band;
    const plate = el('div', { class: 'logoplate' });
    put(plate, [b.logo[0], b.plateY, b.logo[1], b.plateH]);
    const word = mark('wordmark', 'span', { class: 'logoword' }, 'Preterition');
    word.style.fontSize = b.logo[3] + 'px';
    word.style.marginLeft = b.logo[2] + 'px';
    plate.appendChild(word);
    band.appendChild(plate);

    const pilot = el('div', { class: 'pilot' });
    put(pilot, [b.pilot - 4, b.pilotTop - 4, 16, 16]);
    pilot.appendChild(mark('pilot-core', 'i', { class: 'core', 'aria-hidden': 'true' }));
    pilot.appendChild(mark('pilot-ring', 'i', { class: 'ring', 'aria-hidden': 'true', 'data-ring': 'none' }));
    band.appendChild(pilot);

    const citeOf = (small) => {
      const c = mark('doi-placard', 'div', { class: 'citeplate' + (small ? ' small' : '') });
      c.append(el('span', { class: 'doi' }, W.doi), el('span', { class: 'who' }, W.who),
               el('span', { class: 'clic' }, W.licence));
      return c;
    };
    if (b.cite) band.appendChild(put(citeOf(false), [b.cite[0], b.plateY, b.cite[1], b.plateH]));

    const badge = mark('badge', 'div', { class: 'badgeplate' });
    put(badge, [b.badge[0], b.plateY, b.badge[1], b.plateH]);
    const snd = mark('sound-glyph', 'span', { class: 'snd', 'aria-hidden': 'true' });
    snd.innerHTML = '<svg viewBox="0 0 16 11"><path class="body" d="M0 4h3l4-3.5v10L3 7H0z"/>' +
                    '<path class="on" d="M9.5 3Q12 5.5 9.5 8"/></svg>';
    const name = el('span', { class: 'badge' });
    name.append(el('span', { class: 'bname' }, W.model), el('small', {}, W.desc));
    badge.append(snd, name);
    band.appendChild(badge);

    if (L.strip) {
      const strip = el('div', { class: 'doistrip' });
      put(strip, L.strip);
      strip.appendChild(put(citeOf(true), [14, 3, L.W - 28, 20]));
      chassis.appendChild(strip);
    }
  }

  function box(id, rect, label, labelMark) {
    const b = el('section', { class: 'gbox', id });
    put(b, rect);
    b.appendChild(labelMark ? mark(labelMark, 'span', { class: 'glabel' }, label)
                            : el('span', { class: 'glabel' }, label));
    chassis.appendChild(b);
    return b;
  }
  function key(name, label, opts = {}) {
    const b = mark(name, 'button', { type: 'button', class: 'k', 'aria-pressed': 'false' });
    if (opts.lamp !== false) b.appendChild(el('i', { class: 'klamp', 'aria-hidden': 'true' }));
    b.appendChild(el('span', { class: 'kl' }, label));
    if (opts.sub !== undefined) b.appendChild(el('small', { class: 'ksub' }, opts.sub));
    chassis.appendChild(b);
    return b;
  }
  function lamp(name, label) {
    const w = mark(name, 'div', { class: 'lp' });
    w.append(el('i', { class: 'bulb', 'aria-hidden': 'true' }), el('span', { class: 'lt' }, label));
    return w;
  }

  function floKnob(name, values, legend) {
    const parts = buildKnob({ name, values: values.map(v => ({ value: v.value, label: v.label, gloss: v.label })) });
    parts.lever.remove();
    parts.wrap.querySelector('.kname').remove();
    parts.values = values;
    parts.pos = 0;
    parts.wrap.appendChild(el('div', { class: 'klegend' }, legend));
    parts.face.setAttribute('aria-label', legend);
    return parts;
  }
  function paintFloKnob(parts) {
    const n = parts.values.length, pos = parts.pos;
    parts.strip.style.transform = `translateX(${-(n - 1 - pos) * 100}%)`;
    [...parts.strip.children].forEach((sp, i) => {
      if (i === n - 1 - pos) sp.setAttribute('data-current', ''); else sp.removeAttribute('data-current');
    });
    parts.face.setAttribute('aria-valuenow', String(pos + 1));
    parts.face.setAttribute('aria-valuetext', parts.values[pos].label);
    const ang = i => (n > 1 ? -135 + (270 * i) / (n - 1) : 0);
    parts.ticks.innerHTML = parts.values.map((v, i) =>
      `<span class="t${i === pos ? ' cur' : ''}" style="--a:${ang(i).toFixed(2)}deg"></span>`).join('');
    parts.face.style.setProperty('--pa', `${ang(pos).toFixed(2)}deg`);
  }

  box('flo-moment', L.moment, 'MOMENT');
  const runId = mark('run-id', 'div', { class: 'runid' }, '');
  const lamps = {};
  const lampRow = el('div', { class: 'lamprow' });
  for (const s of ['refused', 'malformed', 'begun']) {
    const lp = lamp('status-lamp', s.toUpperCase());
    lp.setAttribute('data-status', s);
    lamps[s] = lp;
    lampRow.appendChild(lp);
  }
  chassis.append(runId, lampRow);

  box('flo-preset', L.preset, 'PRESET');
  const roomKnob = floKnob('room', ROOMS.map(c => ({ value: c, label: ROOM_LABEL[c] })), 'room');
  const roomWrap = mark('room-knob', 'div', { class: 'knobwrap' });
  roomWrap.appendChild(roomKnob.wrap);
  const corpusKey = key('corpus-key', 'CORPUS');
  const toolKey = key('tool-key', 'TOOL', { lamp: false });
  toolKey.classList.add('dark');
  toolKey.setAttribute('aria-disabled', 'true');
  const decay = el('div', { class: 'decay' });
  const decayCol = el('div', { class: 'dcol' });
  decayCol.appendChild(el('div', { class: 'dhead' }, W.decayHead));
  decay.appendChild(decayCol);
  const decayEls = W.decayRows.map((label, i) => {
    const r = el('div', { class: 'drow', 'data-row': String(i) });
    const lp = mark('decay-lamp', 'i', { class: 'bulb', 'aria-hidden': 'true' });
    const lb = mark('decay-label', 'span', { class: 'dlabel' }, label);
    const nm = mark('decay-numeral', 'span', { class: 'dnum' }, '');
    const ab = mark('decay-absent', 'span', { class: 'dabsent', hidden: '',
                                              'aria-label': 'no reading off s7' }, '□');
    r.append(lp, lb, nm, ab);
    decayCol.appendChild(r);
    return { r, lp, nm, ab };
  });
  chassis.append(roomWrap, decay);

  box('flo-gate', L.gate, 'GATE');
  const winKnob = floKnob('window', FLO_WINDOWS.map(w => ({ value: w, label: w })), 'window');
  winKnob.pos = FLO_WINDOWS.indexOf('6');
  const winWrap = mark('window-knob', 'div', { class: 'knobwrap' });
  winWrap.appendChild(winKnob.wrap);
  const viewKey = key('view-key', 'RETURNS');
  const zoomKey = key('zoom-key', 'ZOOM');
  const peakKey = key('peak-hold', 'PEAK');
  const floorKey = key('floor-key', 'FLOOR IN', { lamp: false });
  const bypassKey = key('bypass-key', 'BYPASS', { lamp: false });
  const partialLamp = lamp('window-partial', 'WINDOW PARTIAL');
  const failed = mark('failed-count', 'div', { class: 'failed' });
  const failedNum = el('span', { class: 'fnum' }, '0');
  const failedWin = el('span', { class: 'fwin' });
  failedWin.append(failedNum, el('span', { class: 'funit' }, 'S'));
  failed.append(el('span', { class: 'fcap' }, 'FAILED'), failedWin);
  const peakLamp = mark('peak-lamp', 'i', { class: 'bulb peaklamp', 'aria-hidden': 'true' });
  const gateCol = el('div', { class: 'gcol' });
  const gcolIn = el('div', { class: 'gin' });
  gcolIn.append(partialLamp, failed);
  gateCol.appendChild(gcolIn);
  chassis.append(winWrap, gateCol, peakLamp);

  let meter = null;
  if (!sideways) {
    box('flo-env', L.env, W.setByPreset, 'set-by-preset');
    meter = el('div', { class: 'meter', id: 'flo-meter' });
    put(meter, L.meter);
    chassis.appendChild(meter);
  } else {
    const sp = mark('set-by-preset', 'span', { class: 'rulelabel' }, W.setByPreset);
    put(sp, [16, L.strip1, 100, 12]);
    chassis.appendChild(sp);
  }
  const envScale = mark('envelope-scale', 'div', { class: 'escale' });
  envScale.append(el('span', { class: 'etop' }, '1'), el('span', { class: 'ebot' }, '0'),
                  el('span', { class: 'esolo' }, W.solo), el('span', { class: 'egini' }, W.gini));
  put(envScale, sideways ? [16, L.strip2, 112, 12] : [L.env[0] - 56, L.env[1], 56, L.env[3]]);
  chassis.appendChild(envScale);

  const famBoxes = {};
  for (const f of ['F', 'N', 'W']) {
    const fb = mark('family-box', 'div', { class: 'fambox', 'data-family': f, hidden: '' });
    fb.appendChild(el('span', { class: 'flabel' }, f));
    (meter || chassis).appendChild(fb);
    famBoxes[f] = fb;
  }

  const axis = el('div', { class: 'axis' });
  put(axis, L.axisBox);
  const ladderLabels = {};
  for (const [name, text] of [['over', sideways ? 'OV' : 'OVER'], ['top', '2.5'],
                              ['zero', '0'], ['bot', '-2.5']]) {
    const lb = mark('ladder-label', 'span', { class: 'alab ' + name }, text);
    ladderLabels[name] = lb;
    axis.appendChild(lb);
  }
  const countScale = mark('count-scale', 'div', { class: 'cscale' });
  const detentLegend = mark('detent-legend', 'div', { class: 'dlegend' }, W.detentLegend);
  const sinceS1 = mark('since-s1', 'div', { class: 'sinces1' }, W.sinceS1);
  axis.append(countScale, detentLegend, sinceS1);
  chassis.appendChild(axis);

  const cols = [];
  for (let i = 0; i < SLOTS; i++) {
    const c = { index: i };
    c.ladder = mark('ladder', 'div', { class: 'ladder', 'data-col': String(i) });
    c.rungs = { up: [], down: [] };
    for (const dir of ['up', 'down']) {
      for (let r = 1; r <= RUNGS; r++) {
        const reserved = r === RUNGS;
        const rg = mark(reserved ? (dir === 'up' ? 'over-rung' : 'under-rung') : 'gate-bar', 'i',
                        { class: `rung ${dir}${reserved ? ' reserved' : ''}`,
                          'data-rung': String(r), 'aria-hidden': 'true' });
        if (sideways) {
          const off = ZERO_BAND / 2 + (r - 1) * (RUNG_W + RUNG_WGAP);
          Object.assign(rg.style, { width: RUNG_W + 'px' },
            dir === 'up' ? { left: `calc(50% + ${off}px)` } : { right: `calc(50% + ${off}px)` });
        } else {
          const off = ZERO_BAND / 2 + (r - 1) * (RUNG_H + RUNG_GAP);
          Object.assign(rg.style, { height: RUNG_H + 'px' },
            dir === 'up' ? { bottom: `calc(50% + ${off}px)` } : { top: `calc(50% + ${off}px)` });
        }
        c.ladder.appendChild(rg);
        c.rungs[dir].push(rg);
      }
    }
    c.bracket = mark('detent-bracket', 'i', { class: 'bracket', hidden: '', 'aria-hidden': 'true' });
    c.hollow = mark('hollow-square', 'i', { class: 'hollow', hidden: '', 'aria-hidden': 'true' });
    c.hatch = mark('continue-hatch', 'i', { class: 'hatch', hidden: '', 'aria-hidden': 'true' });
    c.peak = mark('peak-hold', 'i', { class: 'peak', hidden: '', 'aria-hidden': 'true' });
    c.tick = mark('bypass-tick', 'i', { class: 'tick', hidden: '', 'aria-hidden': 'true' });
    c.dotted = mark('bypass-dotted', 'i', { class: 'dotted', hidden: '', 'aria-hidden': 'true' });
    c.zoomCol = mark('zoom-column', 'i', { class: 'zcol', hidden: '', 'aria-hidden': 'true' });
    c.zoomTick = mark('zoom-tick', 'i', { class: 'ztick', hidden: '', 'aria-hidden': 'true' });
    c.hit = el('button', { type: 'button', class: 'colhit', 'data-col': String(i),
                           'aria-label': 'column ' + (i + 1) });
    c.ladder.append(c.bracket, c.hollow, c.hatch, c.peak, c.tick, c.dotted,
                    c.zoomCol, c.zoomTick, c.hit);

    c.label = mark('column-label', 'div', { class: 'collabel' });
    c.labelText = el('span', { class: 'ltext' }, '');
    c.printedMark = mark('printed-mark', 'i', { class: 'pmark', hidden: '',
                                                'aria-label': 'opens as a printed list' }, '≡');
    c.label.append(c.labelText, c.printedMark);
    c.eff = mark('effective', 'div', { class: 'coleff' }, '');
    c.dark = mark('dark-slot', 'i', { class: 'darkslot', hidden: '', 'aria-hidden': 'true' });
    c.slider = el('div', { class: 'slider' });
    c.cap = mark('envelope-cap', 'i', { class: 'cap', 'aria-hidden': 'true' });
    c.cap.appendChild(mark('envelope-cap-lamp', 'i', { class: 'caplamp', 'aria-hidden': 'true' }));
    c.zoomCap = mark('envelope-zoom-cap', 'i', { class: 'zcap', hidden: '', 'aria-hidden': 'true' });
    c.slider.append(c.cap, c.zoomCap);
    c.solo = mark('solo', 'button', { type: 'button', class: 'solobox', 'aria-pressed': 'false',
                                      'data-col': String(i), 'aria-label': 'solo column ' + (i + 1) });
    cols.push(c);
  }

  const posRows = FLO_BANDS.map(b => {
    const r = mark('position-row', 'div', { class: 'posrow', 'data-band': b, hidden: '' });
    r.appendChild(el('span', { class: 'pband' }, b));
    r.cells = [];
    for (let i = 0; i < SLOTS; i++) {
      const cell = el('div', { class: 'poscell', 'data-col': String(i) });
      const bar = mark('position-bar', 'i', { class: 'pbar', 'aria-hidden': 'true' });
      const hat = mark('position-hatch', 'i', { class: 'phatch', hidden: '', 'aria-hidden': 'true' });
      const tick = mark('position-tick', 'i', { class: 'ptick', 'aria-hidden': 'true' });
      const holl = mark('position-hollow', 'i', { class: 'phollow', hidden: '', 'aria-hidden': 'true' });
      cell.append(bar, hat, tick, holl);
      r.appendChild(cell);
      r.cells.push({ cell, bar, hat, tick, holl });
    }
    (meter || chassis).appendChild(r);
    return r;
  });

  if (!sideways) {
    for (let i = 0; i < SLOTS; i++) {
      const c = cols[i];
      const x = L.meterX + i * L.pitch - L.meter[0];
      put(c.ladder, [x, 20, L.colW, LADDER_H]);
      put(c.dark, [x, 20, L.colW, LADDER_H]);
      put(c.label, [x - 7, 24 + LADDER_H, L.colW + 14, 12]);
      put(c.eff, [x - 7, 35 + LADDER_H, L.colW + 14, 10]);
      meter.append(c.ladder, c.dark, c.label, c.eff);
      const ex = L.meterX + i * L.pitch + L.colW / 2;
      put(c.slider, [ex - 10, L.env[1] + 18, 20, 102]);
      put(c.solo, [ex - 6, L.env[1] + 144, 12, 12]);
      chassis.append(c.slider, c.solo);
    }
    const bandH = LADDER_H / 3;
    posRows.forEach((r, j) => put(r, [0, 20 + j * bandH, L.meter[2], bandH - 2]));
  } else {
    for (const c of cols) chassis.append(c.label, c.eff, c.slider, c.solo, c.ladder, c.dark);
  }

  function rowTops(sl) {
    const R = L.rows, tops = [];
    let fam = null, gaps = 0;
    for (let i = 0; i < SLOTS; i++) {
      const fm = sl[i].source ? sl[i].source[0] : null;
      if (fm && fam && fm !== fam) gaps++;
      if (fm) fam = fm;
      tops.push(R.y0 + i * R.rh + gaps * R.gap);
    }
    return tops;
  }

  function placeRows(sl) {
    const R = L.rows, tops = rowTops(sl);
    for (let i = 0; i < SLOTS; i++) {
      const c = cols[i], y = tops[i];
      put(c.label, [R.labelX, y + 2, 26, 11]);
      put(c.eff, [R.labelX, y + 12, 26, 8]);
      put(c.slider, [R.fader[0], y + 5, R.fader[1] - R.fader[0], 10]);
      put(c.solo, [R.solo, y + 5, 9, 9]);
      put(c.ladder, [R.bar[0] + 1, y + 4, LADDER_W, R.rh - 8]);
      put(c.dark, [R.bar[0] + 1, y + 4, LADDER_W, R.rh - 8]);
    }
    const segW = (R.bar[1] - 2 * R.seg) / 3;
    const top = tops[0], height = tops[SLOTS - 1] + R.rh - top;
    posRows.forEach((r, j) => {
      put(r, [R.bar[0] + j * (segW + R.seg), top, segW, height]);
      r.cells.forEach((cell, i) => put(cell.cell, [0, tops[i] - top + 4, segW, R.rh - 8]));
    });
    return tops;
  }

  const counterHost = mark('counter', 'div', { class: 'cthost' });
  if (!sideways) {
    box('flo-counter', L.counter, 'COUNTER');
    put(counterHost, [L.axis - L.keyW / 2, L.wheelsY, L.keyW, 26]);
  } else {
    put(counterHost, [(L.rows.fader[1] + L.keyCols[2]) / 2 - 44, L.counterRow, 88, 26]);
  }
  chassis.appendChild(counterHost);
  const rewindKey = key('rewind-key', 'REWIND', { lamp: false });
  const holdKey = holdOpt && Wd === 1100 ? key('hold-key', 'HOLD') : null;

  const counter = mountCounter({
    root, host: counterHost, keyClass: 'flotp',
    narrow: true,
    st, bus, say,
    words: {
      of: n => '/' + n,
      saidPast: (to, n) => `S${to} is past the end; going to S${n}`,
      saidNothing: 'Nothing to locate: set the counter or press CUE first.',
      locateAria: "go to the counter's setting, or to the cue",
      cueAria: "set this run's cue at the session showing",
    },
    hooks: {
      reading: () => ({ session: st.k ?? 0, N: loaded() ? st.run.N : 0,
                        live: st.mode === 'PLAY' && transportLive(), cue: st.cue, winding: false }),
      setCue: () => {
        if (!transportLive() || st.mode !== 'PLAY' || st.k === null) return null;
        st.cue = st.k;
        return { slot: st.slot, session: st.k };
      },
      goTo: session => { counter.forgetSetting(); st.k = session; render(); },
      winding: () => false,
      render: () => render(),
    },
  });
  counter.cueText.setAttribute('data-mark', 'cue-line');
  counter.keys.classList.add('flotp');
  chassis.appendChild(counter.keys);

  const display = el('div', { class: 'display', id: 'flo-display' });
  put(display, L.display);
  const history = el('div', { class: 'history' });
  const historyRows = el('div', { class: 'hrows' });
  const earlier = mark('history-earlier', 'div', { class: 'hearlier', hidden: '' }, '');
  history.append(historyRows, earlier);
  const numbers = mark('numbers-table', 'table', { class: 'numbers', hidden: '' });
  const numbersCap = mark('numbers-caption', 'caption', {}, '');
  const numbersHead = el('thead');
  const numbersBody = el('tbody');
  numbers.append(numbersCap, numbersHead, numbersBody);
  const roomSum = mark('bypass-room-sum', 'div', { class: 'roomsum', hidden: '' }, '');
  const under1 = mark('as-if-under-1', 'div', { class: 'under1', hidden: '' }, W.under1);
  const printed = mark('printed-list', 'div', { class: 'plist', hidden: '' }, '');
  display.append(history, numbers, roomSum, under1, printed);
  chassis.appendChild(display);

  const histKey = key('display-key', 'HISTORY');
  histKey.dataset.position = 'HISTORY';
  const numKey = key('display-key', 'NUMBERS');
  numKey.dataset.position = 'NUMBERS';

  if (!sideways) {
    const colW = L.keyX - L.left;
    if (Wd === 1100) {
      put(runId, [L.moment[0] + 8, L.moment[1] + 14, L.moment[2] - 16, 60]);
      put(lampRow, [L.moment[0] + 8, L.moment[1] + 80, L.moment[2] - 16, 56]);
    } else {
      put(runId, [L.moment[0] + 8, L.moment[1] + 14, 420, 14]);
      put(lampRow, [L.moment[0] + 8, L.moment[1] + 32, L.moment[2] - 16, 12]);
    }
    put(roomWrap, [L.left, L.preset[1] + 24, colW, 76]);
    put(corpusKey, [L.keyX, L.preset[1] + 20, L.keyW, 20]);
    put(toolKey, [L.keyX, L.preset[1] + 46, L.keyW, 20]);
    put(decay, [L.left, L.preset[1] + 104, colW, 52]);
    put(winWrap, [L.left, L.gate[1] + 24, colW, 76]);
    put(viewKey, [L.keyX, L.gate[1] + 26, L.keyW, 20]);
    put(zoomKey, [L.keyX, L.gate[1] + 52, L.keyW, 20]);
    put(peakKey, [L.keyX, L.gate[1] + 78, L.keyW, 20]);
    put(floorKey, [L.keyX, L.gate[1] + 104, L.keyW, 20]);
    put(bypassKey, [L.keyX, L.gate[1] + 130, L.keyW, 20]);
    put(gateCol, [L.left, L.gate[1] + 104, colW, 46]);
    put(peakLamp, [L.keyX + L.keyW - 12, L.gate[1] + 82, 6, 6]);
    put(counter.keyEls.cue, [L.keyX, L.wheelsY, L.keyW, 22]);
    put(counter.keyEls.locate, [L.axis - L.keyW / 2, L.locateY, L.keyW, 22]);
    put(rewindKey, [L.keyX, L.locateY, L.keyW, 22]);
    if (holdKey) {
      const pitch = L.locateY - L.wheelsY, margin = (L.counter[0] + L.counter[2]) - (L.keyX + L.keyW);
      const rewTop = L.counter[1] + L.counter[3] - margin - 22, holdTop = rewTop - pitch, cueTop = holdTop - pitch;
      put(counter.keyEls.cue, [L.keyX, cueTop, L.keyW, 22]);
      put(holdKey, [L.keyX, holdTop, L.keyW, 22]);
      put(rewindKey, [L.keyX, rewTop, L.keyW, 22]);
      put(counter.keyEls.locate, [L.axis - L.keyW / 2, rewTop, L.keyW, 22]);
      put(counterHost, [L.axis - L.keyW / 2, holdTop, L.keyW, 26]);
    }
    if (Wd === 1100) {
      put(histKey, [L.dispKeys[0], L.dispKeys[1], L.dispKeys[2], 22]);
      put(numKey, [L.dispKeys[0], L.dispKeys[1] + 28, L.dispKeys[2], 22]);
    } else {
      put(histKey, [L.axis - L.keyW / 2, L.dispKeys[1], L.keyW, 22]);
      put(numKey, [L.keyX, L.dispKeys[1], L.keyW, 22]);
    }
    chassis.appendChild(put(el('hr', { class: 'rule' }), [0, L.rule, L.W, 1]));
  } else {
    const C = L.keyCols, KW = L.keyW3;
    put(runId, [L.moment[0] + 8, L.moment[1] + 12, L.moment[2] - 16, 26]);
    put(lampRow, [L.moment[0] + 8, L.moment[1] + 38, L.moment[2] - 16, 12]);
    put(roomWrap, [L.preset[0] + 6, L.preset[1] + 8, 90, 28]);
    put(corpusKey, [C[0], L.preset[1] + 12, KW, 20]);
    put(toolKey, [C[1], L.preset[1] + 12, KW, 20]);
    put(decay, [L.preset[0] + 6, L.preset[1] + 40, 330, 16]);
    decay.classList.add('row');
    put(winWrap, [L.gate[0] + 6, L.gate[1] + 8, 90, 28]);
    put(viewKey, [C[0], L.gate[1] + 12, KW, 20]);
    put(zoomKey, [C[1], L.gate[1] + 12, KW, 20]);
    put(peakKey, [C[2], L.gate[1] + 12, KW, 20]);
    put(floorKey, [C[1], L.gate[1] + 38, KW, 20]);
    put(bypassKey, [C[2], L.gate[1] + 38, KW, 20]);
    put(gateCol, [L.gate[0] + 6, L.gate[1] + 40, 164, 18]);
    gateCol.classList.add('row');
    put(peakLamp, [C[2] + KW - 10, L.gate[1] + 16, 6, 6]);
    put(histKey, [L.dispKeys[0], L.dispKeys[1], L.dispKeys[2], 22]);
    put(numKey, [L.dispKeys[0], L.dispKeys[1] + 28, L.dispKeys[2], 22]);
    put(counter.keyEls.cue, [C[2], L.counterRow, KW, 22]);
    put(rewindKey, [C[2], L.counterRow + 28, KW, 22]);
    put(counter.keyEls.locate, [(L.rows.fader[1] + C[2]) / 2 - 44, L.counterRow + 28, 88, 22]);
  }

  const ix = data.index;
  const entryOf = id => ix.runs.find(e => e.run === id) || null;
  const picked = new Map();

  let slots, drawer = null;
  if (shared) {
    slots = sharedSlots;
  } else {
  const bankHost = el('div', { class: 'bankhost', id: 'flo-bank' });
  put(bankHost, L.bank);
  root.appendChild(bankHost);

  const LETTERS = {
    '20261018-straight-letter-s7': 'A',
    '20261018-straight-letter-s7-r2': 'B',
    '20261020-straight-letter-s7-argon4-r2': 'C',
    '20261020-straight-letter-s7-progress-report-nothing-is-due': 'D',
    '20261020-straight-letter-s7-gpt61sol': 'E',
    '20261019-straight-letter-s7-questions': 'F',
  };
  for (const id of Object.keys(LETTERS)) {
    if (!entryOf(id) || !entryOf(id).six_key) throw new Error(id + ' is not among the index six');
  }
  const BANK_KEY = 'preterition-flo:bank:v1';
  const known = new Set(ix.runs.map(r => r.run));
  const remembered = storage ? bankRestoreFrom(storage, known, BANK_KEY, 6) : null;
  const blank = () => ({ k: null, cue: null });
  slots = makeBank(remembered || Object.keys(LETTERS), 6, blank);
  const ks = makeKnobs(ix);

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function stripOf(flKey, html = true, short = false) {
    const id = flKey.replace(/^file:/, '');
    const e = entryOf(id);
    const term = e ? e.term : id;
    const it = html ? `<i>${esc(term)}</i>` : term;
    if (flKey.startsWith('file:')) return short ? `${it} (file)` : `${it}, from a file`;
    const head = `${LETTERS[id] ? LETTERS[id] + ' ' : ''}${it}`;
    return short ? head : `${head}, ${e.knobs.CORPUS}, ${e.knobs.MEMORY}`;
  }

  function floIntake(exp) {
    if (!exp || typeof exp !== 'object' || Array.isArray(exp)) {
      return { ok: false, refusals: ['not an export: the file is not one JSON object'] };
    }
    if (exp.schema_version !== 'flo-1.0') {
      return { ok: false, refusals: [`schema ${exp.schema_version}: this meter reads flo-1.0`] };
    }
    const no = [];
    if (typeof exp.run !== 'string' || !exp.run) no.push('F1: no run id');
    if (!ROOMS.includes(exp.corpus)) no.push(`F2: ${exp.corpus} is not one of the four rooms`);
    if (!Number.isInteger(exp.N) || exp.N < 1) no.push('F3: N is not a count of sessions');
    if (!Array.isArray(exp.sessions) || exp.sessions.length !== exp.N) {
      no.push('F3: the sessions do not agree with N');
    }
    if (!exp.sources || typeof exp.sources !== 'object') no.push('F4: no sources block');
    if (!exp.position || !Array.isArray(exp.position.eligible_sources)) no.push('F5: no position block');
    if (no.length) return { ok: false, refusals: no };
    try {
      makeFloRun(exp, data.floors[exp.corpus], data.bounds, data.checks, entryOf(exp.run));
    } catch (err) {
      return { ok: false, refusals: [`the model could not read it: ${err.message}`] };
    }
    const gaps = [];
    const bad = exp.sessions.filter(s => s.status !== 'submitted').length;
    if (bad) gaps.push(`F6: ${bad} sessions that did not end submitted`);
    return { ok: true, exp, verdict: gaps.length ? 'meets with marked gaps' : 'meets', gaps };
  }

  drawer = mountDrawer({
    root, host: root, bankHost,
    rect: drawerOver ? [0, L.band.h, Wd, L.bank[1] - L.band.h] : L.drawer,
    ids: drawerIds,
    flex: { key: Wd === 1100 ? '1 1 0' : `1 1 ${Wd === 760 ? '12%' : '22%'}`,
            mode: Wd === 1100 ? '1 1 0' : '1 1 12%', full: Wd === 1100 },
    ks, slots, st, bus, say,
    strip: stripOf,
    drop: (sl, i, k) => bankDrop(sl, i, k, 6, blank),
    intake: floIntake,
    kind: 'run',
    sync: { shown: syncShown },
    words: {
      title: 'Run library', region: 'run library',
      pickKey: 'Choose file',
      pickLine: 'Load a downloaded Flo export.',
      howto: ['Turn the knobs to lock positions, or turn SHUFFLE and press its LOCK. The glass reports the count of runs left by the locks.',
              'When the locks leave one run, press a preset button to load it to that slot.',
              'Press PLAY to leave the loader and return to the meter.'],
      tape: 'RUN', tapePrompt: '2  press a preset key to load it into that slot.',
      noTape: 'No run chosen: lock the knobs to one run, or pick a file.',
    },
    hooks: {
      inert: on => { chassis.inert = on; },
      onMode: () => { counter.clearAdjust(); render(); },
      load: () => {},
      save: () => { if (storage) bankSaveTo(storage, slots, BANK_KEY); },
      leader: i => { st.slot = i; },
      choose,
      render: () => render(),
      tapeOf: one => { const e = entryOf(one); return { key: one, verdict: e.verdict, gaps: e.gaps }; },
      knows: k => !!entryOf(k),
      kindOf: exp => {
        if (!exp || typeof exp !== 'object' || Array.isArray(exp)) return null;
        if (typeof exp.fan === 'string' && exp.fan) return 'fan';
        if (typeof exp.run === 'string' && exp.run) return 'run';
        return null;
      },
      keep: exp => { const k = 'file:' + exp.run; picked.set(k, exp); return { key: k, id: exp.run }; },
    },
  });
  }

  async function choose(i) {
    st.slot = i;
    const flKey = slots[i].key;
    st.run = null; st.k = null; st.cue = null;
    st.zoom = null; st.cursor = null;
    st.solo.clear(); st.focus = 0; st.peak = true;
    counter.reset();
    render();
    let exp;
    if (flKey.startsWith('file:')) {
      const id = flKey.slice('file:'.length);
      exp = picked.has(flKey) ? picked.get(flKey)
        : shared ? await data.runFile(id)
        : null;
    } else {
      exp = await data.runFile(flKey);
    }
    if (slots[st.slot].key !== flKey) return;
    if (!exp) { say(`no Flo export for ${flKey}`); render(); return; }
    st.run = makeFloRun(exp, data.floors[exp.corpus], data.bounds, data.checks, entryOf(exp.run));
    st.room = st.run.corpus;
    roomKnob.pos = ROOMS.indexOf(st.run.corpus);
    emit('preset', { slot: i, id: flKey });
    render();
  }

  const slotsNow = () => slotsOf(base());

  function paintBand() {
    root.querySelector('.pilot .ring').dataset.ring = st.ring;
    root.querySelector('.pilot').dataset.mode = st.mode;
  }

  function paintMoment(m) {
    runId.textContent = loaded() ? st.run.id : '';
    for (const s of ['refused', 'malformed', 'begun']) {
      const on = !!(m && m.lamps[s]);
      lamps[s].classList.toggle('on', on);
      lamps[s].setAttribute('data-lit', String(on));
    }
  }

  function paintPreset() {
    paintFloKnob(roomKnob);
    corpusKey.setAttribute('aria-pressed', 'true');
    corpusKey.classList.add('lit');
    const d = decayRows(base());
    decayEls.forEach((rowEl, i) => {
      const r = d.rows[i];
      rowEl.nm.textContent = r.absent ? '' : String(r.halfLife);
      rowEl.nm.hidden = r.absent;
      rowEl.ab.hidden = !r.absent;
      rowEl.lp.classList.toggle('on', !!r.lamp);
      rowEl.lp.setAttribute('data-lit', String(!!r.lamp));
      rowEl.r.dataset.key = r.key;
    });
  }

  function paintGateBox(g) {
    paintFloKnob(winKnob);
    winWrap.classList.toggle('dark', !knobLive());
    winKnob.face.setAttribute('aria-disabled', String(!knobLive()));
    viewKey.setAttribute('aria-pressed', String(st.view === 'POSITION'));
    viewKey.querySelector('.kl').textContent = st.view;
    zoomKey.setAttribute('aria-pressed', String(st.zoom !== null));
    zoomKey.querySelector('.kl').textContent = st.zoom === null ? 'ZOOM' : 'ZOOM ' + st.zoom;
    peakKey.setAttribute('aria-pressed', String(st.peak && peakLive()));
    peakKey.classList.toggle('dark', !peakLive());
    peakLamp.classList.toggle('on', st.peak && peakLive());
    peakLamp.setAttribute('data-lit', String(st.peak && peakLive()));
    floorKey.setAttribute('aria-pressed', String(st.floorIn));
    bypassKey.setAttribute('aria-pressed', String(!st.floorIn));
    floorKey.classList.toggle('dark', !floorLive());
    bypassKey.classList.toggle('dark', !floorLive());
    const partial = !!(g && g.partial);
    partialLamp.classList.toggle('on', partial);
    partialLamp.setAttribute('data-lit', String(partial));
    const f = g ? g.failed : 0;
    failedNum.textContent = String(f);
    failed.classList.toggle('on', f > 0);
    failed.setAttribute('data-lit', String(f > 0));
  }

  function paintAxis() {
    const counts = !st.floorIn || st.view === 'POSITION' || st.zoom !== null;
    axis.dataset.scale = counts ? 'counts' : 'bits';
    for (const k of Object.keys(ladderLabels)) ladderLabels[k].classList.toggle('dim', counts);
    const sc = st.zoom !== null ? FLO_SCALES.counts[st.window]
      : counts ? FLO_SCALES.counts[FLO_SCALES.cumulativeCountScale]
      : FLO_SCALES.counts[st.window];
    countScale.textContent = `0 - ${sc.max}`;
    countScale.dataset.top = String(sc.max);
    countScale.classList.toggle('dim', !counts);
    detentLegend.hidden = counts;
    sinceS1.hidden = !(st.view === 'POSITION' || !st.floorIn);
  }

  function lightRungs(c, r, scale, barMark) {
    const up = r && r.lit !== null && r.lit > 0 ? r.lit : 0;
    const down = r && r.lit !== null && r.lit < 0 ? -r.lit : 0;
    const over = !!(r && r.over), under = !!(r && r.under);
    for (const [dir, n0, res] of [['up', up, over], ['down', down, under]]) {
      c.rungs[dir].forEach((rg, idx) => {
        const n = idx + 1, reserved = n === RUNGS;
        const lit = reserved ? res : n <= n0;
        rg.classList.toggle('lit', lit);
        rg.setAttribute('data-lit', String(lit));
        if (!reserved && barMark) rg.setAttribute('data-mark', barMark);
      });
    }
    c.ladder.dataset.scale = scale;
    c.ladder.setAttribute('data-value', r && r.value !== null ? fx(r.value) : '');
  }

  const frac = r => (r && r.frac !== null && r.frac !== undefined
    ? Math.min(1, Math.max(0, r.frac)) : 0);
  function setSpan(x, a, b) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    if (sideways) { x.style.left = (lo * 100) + '%'; x.style.width = ((hi - lo) * 100) + '%'; }
    else { x.style.bottom = (lo * 100) + '%'; x.style.height = ((hi - lo) * 100) + '%'; }
  }
  function setAt(x, r) {
    const f = frac(r);
    if (sideways) x.style.left = (f * 100) + '%'; else x.style.bottom = (f * 100) + '%';
    x.setAttribute('data-frac', f.toFixed(4));
  }
  function setCap(x, r) {
    const f = frac(r);
    if (sideways) x.style.transform = `translateX(${(f * 100).toFixed(2)}%)`;
    else x.style.transform = `translateY(${(-f * 100).toFixed(2)}%)`;
    x.setAttribute('data-frac', f.toFixed(4));
  }
  function setBracket(x, d) {
    setSpan(x, frac(rungsOf(d.lo, LADDER)), frac(rungsOf(d.hi, LADDER)));
    x.setAttribute('data-lo', fx(d.lo));
    x.setAttribute('data-hi', fx(d.hi));
  }

  function paintColumns() {
    const sl = slotsNow();
    const on = loaded();
    const g = on && st.view === 'RETURNS' && st.floorIn && st.zoom === null
      ? gateAt(st.run, st.k, st.window) : null;
    const b = on && st.view === 'RETURNS' && !st.floorIn && st.zoom === null
      ? bypassAt(st.run, st.k) : null;
    const z = on && st.zoom !== null ? zoomAt(st.run, st.k, st.window, st.zoom) : null;
    const e = envelopeAt(base(), st.zoom);
    const pk = on && peakLive() && st.peak ? peakAt(st.run, st.k, st.window) : null;
    const tops = sideways ? placeRows(sl) : null;

    const fam = { F: [], N: [], W: [] };
    sl.forEach((s, i) => { if (s.source) fam[s.source[0]].push(i); });
    for (const f of ['F', 'N', 'W']) {
      const ids = fam[f];
      famBoxes[f].hidden = ids.length === 0 || z !== null;
      if (!ids.length) continue;
      if (!sideways) {
        put(famBoxes[f], [L.meterX + ids[0] * L.pitch - 5 - L.meter[0], 0,
                          (ids[ids.length - 1] - ids[0]) * L.pitch + L.colW + 10, LADDER_H + 48]);
      } else {
        const a = tops[ids[0]] - 3;
        const b2 = tops[ids[ids.length - 1]] + L.rows.rh + 3;
        put(famBoxes[f], [10, a, L.W - 20, b2 - a]);
      }
    }

    for (let i = 0; i < SLOTS; i++) {
      const c = cols[i], s = sl[i];
      c.hollow.hidden = true; c.hatch.hidden = true; c.peak.hidden = true;
      c.tick.hidden = true; c.dotted.hidden = true; c.bracket.hidden = true;
      c.zoomCol.hidden = true; c.zoomTick.hidden = true; c.zoomCap.hidden = true;
      c.ladder.hidden = st.view === 'POSITION';
      c.ladder.classList.toggle('soloed', st.solo.size > 0 && !st.solo.has(s.source));
      c.ladder.classList.toggle('focused', i === st.focus && z === null);

      if (z) {
        const p = z.printedList ? null : z.passages[i];
        const show = !!p;
        c.dark.hidden = show;
        c.ladder.dataset.dark = String(!show);
        c.label.hidden = !show;
        c.eff.hidden = true;
        c.solo.hidden = true;
        c.hit.disabled = !show;
        c.slider.hidden = !show;
        c.cap.hidden = true;
        c.labelText.textContent = show ? String(p.n) : '';
        c.printedMark.hidden = true;
        if (show) {
          c.zoomCol.hidden = false;
          lightRungs(c, p.rungs, 'counts', 'zoom-count');
          c.zoomTick.hidden = p.tick.value === null;
          setAt(c.zoomTick, p.tick);
          c.hatch.hidden = !p.hatched;
          const ze = e.passages ? e.passages[i] : null;
          c.zoomCap.hidden = !ze;
          if (ze) setCap(c.zoomCap, ze.rungs);
          c.ladder.classList.toggle('cursor', st.cursor === p.n);
        } else {
          lightRungs(c, null, 'counts', 'zoom-count');
        }
        continue;
      }

      c.dark.hidden = !s.dark;
      c.ladder.dataset.dark = String(s.dark);
      c.label.hidden = s.dark;
      c.eff.hidden = s.dark;
      c.solo.hidden = s.dark;
      c.slider.hidden = s.dark;
      c.cap.hidden = s.dark;
      c.hit.disabled = s.dark || !on;
      c.labelText.textContent = s.label || '';
      c.eff.textContent = s.effective === null ? '' : fx(s.effective);
      c.solo.setAttribute('aria-pressed', String(st.solo.has(s.source)));
      const over = s.source ? base().floor.sources[s.source].passages > SLOTS : false;
      c.printedMark.hidden = !over;
      if (!s.dark) setCap(c.cap, e.slots[i].rungs);

      if (g && !s.dark) {
        lightRungs(c, g.slots[i].rungs, 'bits', 'gate-bar');
        c.hollow.hidden = !g.slots[i].censored;
        c.hatch.hidden = !g.slots[i].hatched;
        if (g.slots[i].detent) { c.bracket.hidden = false; setBracket(c.bracket, g.slots[i].detent); }
        if (pk && pk.slots[i].peak !== null) { c.peak.hidden = false; setAt(c.peak, pk.slots[i].rungs); }
      } else if (b && !s.dark) {
        lightRungs(c, b.slots[i].rungs, 'counts', 'bypass-bar');
        c.hollow.hidden = !b.slots[i].censored;
        c.tick.hidden = b.slots[i].expected === null;
        setAt(c.tick, b.slots[i].tick);
        c.dotted.hidden = false;
        setSpan(c.dotted, frac(b.slots[i].rungs), frac(b.slots[i].tick));
      } else {
        lightRungs(c, null, st.floorIn ? 'bits' : 'counts', st.floorIn ? 'gate-bar' : 'bypass-bar');
      }
    }

    const pos = on && st.view === 'POSITION' ? positionAt(st.run, st.k) : null;
    const bandH = sideways ? (SLOTS * L.rows.rh) / 3 : LADDER_H / 3;
    posRows.forEach((r, j) => {
      r.hidden = !pos;
      if (!pos) return;
      const row = pos.rows[j];
      r.cells.forEach((cell, i) => {
        const s2 = row.slots[i];
        cell.cell.hidden = s2.dark;
        if (s2.dark) return;
        if (!sideways) {
          put(cell.cell, [L.meterX + i * L.pitch - L.meter[0], 14, L.colW, bandH - 22]);
        }
        cell.holl.hidden = !(s2.censored || !s2.eligible);
        cell.bar.hidden = !s2.eligible;
        cell.hat.hidden = !s2.hatched;
        cell.tick.hidden = s2.roomAlone === null;
        if (s2.eligible) {
          setSpan(cell.bar, 0, frac(s2.rungs));
          setAt(cell.tick, s2.tick);
        }
      });
    });
  }

  let saidCaption = '';
  function paintDisplay() {
    const isNumbers = st.display === 'NUMBERS';
    history.hidden = isNumbers;
    numbers.hidden = !isNumbers;
    histKey.setAttribute('aria-pressed', String(!isNumbers));
    numKey.setAttribute('aria-pressed', String(isNumbers));
    roomSum.hidden = true; under1.hidden = true; printed.hidden = true;
    if (isNumbers) paintNumbers(); else paintHistory();
  }

  function paintHistory() {
    historyRows.innerHTML = '';
    earlier.hidden = true;
    const dark = !loaded() || st.k === null || st.view === 'POSITION' || !st.floorIn;
    historyRows.dataset.dark = String(dark);
    if (dark) return;
    const h = L.display[3] - 14;
    const from = st.window === 'all' ? 1 : Math.max(1, st.k - Number(st.window) + 1);
    const want = st.k - from + 1;
    const shown = Math.max(1, Math.min(want, Math.floor(h / 3)));
    const folded = want - shown;
    const pitch = h / shown;
    for (let s = st.k - shown + 1; s <= st.k; s++) {
      const row = mark('history-row', 'div', { class: 'hrow', 'data-session': String(s) });
      row.style.height = pitch + 'px';
      row.classList.toggle('newest', s === st.k);
      if (st.zoom === null) {
        for (const slot of gateAt(st.run, s, st.window).slots) {
          if (slot.dark || slot.bend === null) continue;
          row.appendChild(histMark(slot.index, rungsOf(slot.bend, LADDER), pitch));
        }
      } else {
        const z = zoomAt(st.run, s, st.window, st.zoom);
        if (z) {
          z.passages.slice(0, SLOTS).forEach((p, i) => {
            if (p.count === null) return;
            row.appendChild(histMark(i, rungsOf(p.count - (p.roomAlone || 0),
                                                FLO_SCALES.counts[st.window]), pitch));
          });
        }
      }
      historyRows.appendChild(row);
    }
    if (folded > 0) { earlier.hidden = false; earlier.textContent = W.earlier(folded); }
  }
  function histMark(i, r, pitch) {
    const m = el('i', { class: 'hmark', 'aria-hidden': 'true' });
    const span = L.display[2] - 16, cw = span / SLOTS;
    const f = (r.frac === null ? 0.5 : r.frac) - 0.5;
    m.style.left = (8 + i * cw) + 'px';
    m.style.width = Math.max(2, cw - 2) + 'px';
    m.style.height = Math.max(1, Math.abs(f) * pitch) + 'px';
    m.style.bottom = (f >= 0 ? pitch / 2 : pitch / 2 - Math.abs(f) * pitch) + 'px';
    return m;
  }

  const HEADS = {
    returns: ['source', 'effective', 'bits', 'detent', 'returns', 'continue', 'as_if', 'Gini'],
    bypass: ['source', 'effective', 'reached', W.roomAlone],
    position: ['band', 'source', 'search', 'continue', W.roomAlone],
    zoom: ['passage', 'band', 'count', 'continue', W.roomAlone, 'x even'],
  };
  function paintNumbers() {
    numbersHead.innerHTML = '';
    numbersBody.innerHTML = '';
    if (!loaded()) { numbersCap.textContent = 'no run loaded'; return; }
    const t = numbersAt(st.run, st.k, st.window, tableView(), st.zoom);
    if (!t) return;
    const cap = t.caption;
    numbersCap.textContent = `${cap.run}, ${cap.session === null ? 'the leader' : 'S' + cap.session}` +
      `, window ${cap.window}${cap.status ? ', ' + cap.status : ''}${cap.zoom ? ', zoom ' + cap.zoom : ''}`;
    const hr = el('tr');
    for (const name of HEADS[t.shape]) hr.appendChild(el('th', { scope: 'col' }, name));
    numbersHead.appendChild(hr);
    const rows = [];
    if (t.shape === 'returns') {
      for (const r of t.rows) {
        if (r.asIfUnder1) under1.hidden = false;
        rows.push([[r.source, r.source === (slotsNow()[st.focus] || {}).source],
                   fx(r.effective), r.bits === null ? '—' : fx(r.bits),
                   r.detent ? `±${fx(r.detent.hi)}` : '—',
                   r.n === null ? '—' : String(r.n),
                   r.continue === null ? '—' : String(r.continue),
                   r.asIf === null ? '—' : r.asIfUnder1 ? W.under1 : fx(r.asIf), fx(r.gini)]);
      }
    } else if (t.shape === 'bypass') {
      for (const r of t.rows) {
        rows.push([[r.source, false], fx(r.effective),
                   r.distinct === null ? '\u2014' : String(r.distinct), fx(r.roomAlone)]);
      }
      roomSum.hidden = false;
      roomSum.textContent = W.dealt(t.room.distinct, fx(t.room.expected));
    } else if (t.shape === 'position') {
      for (const r of t.rows) {
        for (const c of r.columns) {
          rows.push([[r.band, false], c.source, c.search === null ? '—' : String(c.search),
                     c.continue === null ? '—' : String(c.continue),
                     c.roomAlone === null ? '—' : fx(c.roomAlone)]);
        }
      }
    } else {
      for (const r of t.rows) {
        rows.push([[String(r.passage), r.passage === st.cursor], r.band,
                   r.count === null ? '—' : String(r.count),
                   r.continue === null ? '—' : String(r.continue),
                   r.roomAlone === null ? '—' : fx(r.roomAlone), fx(r.shareOfEven)]);
      }
      if (t.printedList) {
        printed.hidden = false;
        printed.textContent = `${t.source}: ${t.rows.length} passages, printed as a list`;
      }
    }
    for (const r of rows) {
      const tr = el('tr');
      const [first, focused] = r[0];
      if (focused) tr.classList.add('focused');
      tr.appendChild(el('td', {}, first));
      for (const v of r.slice(1)) tr.appendChild(el('td', {}, v));
      numbersBody.appendChild(tr);
    }
    if (numbersCap.textContent !== saidCaption) {
      saidCaption = numbersCap.textContent;
      say(saidCaption);
    }
  }

  let rendering = false;
  function render() {
    if (rendering) return;
    rendering = true;
    try {
      root.dataset.mode = st.mode;
      root.dataset.view = st.view;
      root.dataset.floor = st.floorIn ? 'in' : 'bypass';
      root.dataset.zoom = st.zoom || '';
      root.dataset.synced = String(st.synced);
      root.dataset.loaded = String(loaded());
      const g = loaded() ? gateAt(st.run, st.k, st.window) : null;
      const focusSource = st.zoom === null ? (slotsNow()[st.focus] || {}).source || null : null;
      const m = loaded() ? momentAt(st.run, st.k, st.window, focusSource) : null;
      paintBand();
      paintMoment(m);
      paintPreset();
      paintGateBox(g);
      paintAxis();
      paintColumns();
      paintDisplay();
      if (drawer) drawer.updateBank();
      counter.update({ session: st.k ?? 0, N: loaded() ? st.run.N : 0,
                       live: st.mode === 'PLAY' && transportLive(), cue: st.cue, winding: false });
      for (const b of [counter.keyEls.cue, counter.keyEls.locate, rewindKey]) {
        b.classList.toggle('dark', !transportLive());
        b.disabled = !transportLive();
      }
    } finally { rendering = false; }
  }

  function setWindow(w) {
    st.window = w; winKnob.pos = FLO_WINDOWS.indexOf(w);
    emit('window', { window: w }); render();
  }
  function setRoom(c) {
    if (loaded()) return;
    st.room = c; roomKnob.pos = ROOMS.indexOf(c);
    emit('room', { corpus: c }); render();
  }
  function leaveZoom(by) {
    if (st.zoom === null) return;
    const was = st.zoom;
    st.zoom = null; st.cursor = null;
    emit('zoom-leave', { by });
    say(`left the zoom of ${was}`);
  }
  function zoomTo(source) {
    if (!loaded() || !source) return;
    st.zoom = source; st.cursor = null;
    const z = zoomAt(st.run, st.k, st.window, source);
    emit('zoom', { source, printedList: !!(z && z.printedList) });
    if (z) say(`${source}: ${z.passages.length} passages${z.printedList ? ', printed as a list' : ''}`);
    render();
  }

  root.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b || b.disabled) return;
    if (b === corpusKey) { emit('corpus', { corpus: room() }); return; }
    if (b === toolKey) { emit('tool-dark', {}); return; }
    if (b === viewKey) {
      leaveZoom('view');
      st.view = st.view === 'RETURNS' ? 'POSITION' : 'RETURNS';
      emit('view', { view: st.view }); render(); return;
    }
    if (b === zoomKey) { leaveZoom('zoom'); render(); return; }
    if (b === peakKey) {
      if (!peakLive()) return;
      st.peak = !st.peak; emit('peak', { on: st.peak }); render(); return;
    }
    if (b === floorKey || b === bypassKey) {
      if (!floorLive()) return;
      st.floorIn = b === floorKey;
      emit('floor', { floor: st.floorIn ? 'FLOOR IN' : 'BYPASS' });
      render(); return;
    }
    if (b === histKey || b === numKey) {
      st.display = b.dataset.position;
      emit('display', { position: st.display });
      render(); return;
    }
    if (b === rewindKey) {
      if (!transportLive()) return;
      st.k = 1;
      counter.reset();
      emit('flo-rewind', { to: 1 });
      render(); return;
    }
    if (b.classList.contains('solobox')) {
      const s = slotsNow()[Number(b.dataset.col)];
      if (!s || !s.source) return;
      if (st.solo.has(s.source)) st.solo.delete(s.source); else st.solo.add(s.source);
      emit('solo', { source: s.source, on: st.solo.has(s.source) });
      render(); return;
    }
    if (b.classList.contains('colhit')) {
      const i = Number(b.dataset.col);
      if (st.zoom !== null) {
        const z = zoomAt(st.run, st.k, st.window, st.zoom);
        const p = z && !z.printedList && z.passages[i];
        if (p) { st.cursor = p.n; emit('cursor', { source: st.zoom, passage: p.n }); render(); }
        return;
      }
      const s = slotsNow()[i];
      if (s && s.source) { st.focus = i; zoomTo(s.source); }
    }
  });

  for (const [parts, turnTo] of [[winKnob, i => setWindow(FLO_WINDOWS[i])],
                                 [roomKnob, i => setRoom(ROOMS[i])]]) {
    const n = () => parts.values.length;
    parts.face.addEventListener('keydown', ev => {
      if (parts === winKnob && !knobLive()) return;
      if (['ArrowRight', 'ArrowUp'].includes(ev.key)) { ev.preventDefault(); turnTo((parts.pos + 1) % n()); }
      else if (['ArrowLeft', 'ArrowDown'].includes(ev.key)) { ev.preventDefault(); turnTo((parts.pos + n() - 1) % n()); }
    });
    parts.face.addEventListener('click', ev => {
      const half = ev.target.closest('.half');
      if (!half) return;
      if (parts === winKnob && !knobLive()) return;
      const d = Number(half.dataset.dir);
      turnTo(((parts.pos + d) % n() + n()) % n());
    });
  }
  root.addEventListener('keydown', ev => {
    if (ev.target.closest('.kface') || ev.target.closest('.wheel')) return;
    if (!loaded()) return;
    const sl = slotsNow();
    const live = sl.map((s, i) => (s.source ? i : -1)).filter(i => i >= 0);
    if (!live.length) return;
    const at = live.indexOf(st.focus);
    if (ev.key === 'ArrowRight') { ev.preventDefault(); st.focus = live[(at + 1 + live.length) % live.length]; }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); st.focus = live[(at - 1 + live.length) % live.length]; }
    else if (ev.key === 'Enter' && st.zoom === null) { ev.preventDefault(); zoomTo(sl[st.focus].source); return; }
    else return;
    emit('focus', { source: sl[st.focus].source });
    render();
  });

  if (drawer) drawer.updateKnobs();
  render();

  return {
    root, chassis, st, bus, counter, drawer, cols,
    width: Wd, layout: L,
    ladder: { height: LADDER_H, width: LADDER_W, rungs: RUNGS, rungH: RUNG_H, rungGap: RUNG_GAP },
    marks: [...MARKS],
    events: FLO_EVENTS,
    bank: slots,
    readings: () => (loaded() ? {
      slots: slotsOf(st.run),
      gate: gateAt(st.run, st.k, st.window),
      bypass: bypassAt(st.run, st.k),
      position: positionAt(st.run, st.k),
      zoom: st.zoom === null ? null : zoomAt(st.run, st.k, st.window, st.zoom),
      envelope: envelopeAt(st.run, st.zoom),
      peak: peakAt(st.run, st.k, st.window),
      moment: momentAt(st.run, st.k, st.window,
                       st.zoom === null ? (slotsNow()[st.focus] || {}).source || null : null),
      decay: decayRows(st.run),
      numbers: numbersAt(st.run, st.k, st.window, tableView(), st.zoom),
      view: tableView(),
    } : null),
    state: () => ({
      run: loaded() ? st.run.id : null, corpus: room(), k: st.k, N: loaded() ? st.run.N : 0,
      window: st.window, view: st.view, floorIn: st.floorIn, zoom: st.zoom, cursor: st.cursor,
      solo: [...st.solo], peak: st.peak, display: st.display, cue: st.cue,
      synced: st.synced, ring: st.ring, mode: st.mode, slot: st.slot, focus: st.focus,
      tableView: tableView(), loaded: loaded(),
    }),
    setSynced: v => { st.synced = !!v; render(); },
    setRing: v => { st.ring = v; render(); },
    idle: () => { st.run = null; st.k = null; st.cue = null; st.zoom = null;
                  st.cursor = null; st.solo.clear(); counter.reset(); render(); },
    setWindow, setRoom, zoomTo, leaveZoom, choose, render,
    goTo: s => { st.k = s; render(); },
    setView: v => { if (v !== st.view) viewKey.click(); },
    setFloor: on => { (on ? floorKey : bypassKey).click(); },
    setDisplay: p => { (p === 'NUMBERS' ? numKey : histKey).click(); },
    rewind: () => rewindKey.click(),
    keys: { view: viewKey, zoom: zoomKey, peak: peakKey, floor: floorKey, bypass: bypassKey,
            corpus: corpusKey, tool: toolKey, history: histKey, numbers: numKey,
            rewind: rewindKey, cue: counter.keyEls.cue, locate: counter.keyEls.locate, hold: holdKey },
  };
}


performance.mark('deck-start');
const T = window.__deck = { ready: false, events: [], timings: {}, step: 8 };

const bus = makeBus();
const emit = (name, detail = {}) => bus.emit(name, detail);
const SND = makeSound(); T.sound = SND;
T.audio = SND.audio;
bus.on('*', (name, detail) => {
  T.events.push([name, detail]);
  if (T.events.length > 500) T.events.shift();
  SND.hear(name, detail);
});

function makeSound() {
  const TEETH = 4, TEETH_PER_FRAME = 8, still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = document.getElementById('deck-cues');
  const data = el ? JSON.parse(el.textContent) : null;
  const map = {};
  if (data) for (const [role, c] of Object.entries(data.roles)) for (const ev of c.events) map[ev] = role;
  const S = { on: true, ready: false, played: [], count: {}, errors: 0, teeth: TEETH, roles: data ? Object.keys(data.roles) : [], map, audio: [] };
  try { S.on = localStorage.getItem('deck-sound') !== 'off'; } catch (e) {   }
  let ctx = null, waking = null, afterLoad = false;
  const bufs = {}, live = {};
  const b64 = s => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u.buffer; };
  const note = what => {
    S.audio.push({ at: Math.round(performance.now()), what, state: ctx ? ctx.state : 'none' });
    if (S.audio.length > 200) S.audio.shift();
  };
  function revive(why) {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    note('resume ' + why);
    try {
      const p = ctx.resume();
      if (p && p.catch) p.catch(() => note('refused ' + why));
    } catch (e) { note('threw ' + why); }
  }
  function wake() {
    if (waking || !data) return waking;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    note('created');
    const onState = () => { note('statechange'); revive('on statechange'); };
    if (ctx.addEventListener) ctx.addEventListener('statechange', onState); else ctx.onstatechange = onState;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') { note('hidden'); return; }
      note('visible'); revive('on return to view');
    });
    waking = Promise.all(Object.entries(data.roles).map(([role, c]) =>
      ctx.decodeAudioData(b64(c.mp3)).then(b => { bufs[role] = b; }, () => { S.errors += 1; })))
      .then(() => { S.ready = true; });
    return waking;
  }
  function play(role, at, gm = 1, rate = 1, loop = false) {
    if (!S.on || !ctx || !bufs[role]) return;
    revive('before a play');
    const s = ctx.createBufferSource(), g = ctx.createGain();
    s.buffer = bufs[role]; s.playbackRate.value = rate; g.gain.value = data.roles[role].gain * gm;
    let off = 0;
    if (loop) {
      const L = data.roles[role].loop;
      if (L) {
        const x = bufs[role].duration - L.content;
        off = [[0, 0], [L.endpad, 0], [L.delay, L.delay], [L.delay + L.endpad, L.delay]].reduce((a, c) => Math.abs(c[0] - x) < Math.abs(a[0] - x) ? c : a)[1];
        s.loopStart = off; s.loopEnd = off + L.content;
      }
      s.loop = true; S.loopStart = L ? off : null;
    }
    s.connect(g); g.connect(ctx.destination); s.start(at || 0, off);
    live[role] = { s, g };
    s.onended = () => {
      if (live[role] && live[role].s === s) delete live[role];
      try { s.disconnect(); g.disconnect(); } catch (e) {   }
    };
    S.count[role] = (S.count[role] || 0) + 1;
    S.played.push(role); if (S.played.length > 200) S.played.shift();
  }
  function stop(role) {
    const l = live[role]; if (!l || !ctx) return;
    const t = ctx.currentTime;
    l.g.gain.setTargetAtTime(0, t, 0.015); l.s.stop(t + 0.08); delete live[role];
  }
  S.turn = (k0, k1, dt) => {
    if (!S.on || !ctx || !bufs.tick || !(k1 > k0)) return;
    const a = Math.floor(k0 * TEETH + 1e-9), b = Math.floor(k1 * TEETH + 1e-9);
    if (b <= a) return;
    const now = ctx.currentTime;
    for (let i = Math.max(a + 1, b - TEETH_PER_FRAME + 1); i <= b; i++) play('tick', now + dt * (i / TEETH - k0) / (k1 - k0));
  };
  S.hear = (name, d) => {
    if (name === 'knob-turn' && d.by !== 'reader') return;
    if (name === 'head-cross' && still) { play('tick'); return; }
    if (name === 'load-done') { afterLoad = true; queueMicrotask(() => { afterLoad = false; }); }
    if (name === 'preset' && afterLoad) { afterLoad = false; return; }
    const steps = data && data.compound && data.compound[name];
    if (steps) {
      if (!S.on || !ctx) return;
      const t0 = ctx.currentTime, r = () => Math.random() - 0.5;
      for (const c of steps) {
        const j = c.jitter || {};
        play(c.role, t0 + Math.max(0, c.at + (j.at || 0) * r()), (c.gain || 1) * (1 - (j.gain || 0) * Math.random()), 1 + (j.rate || 0) * r());
      }
      return;
    }
    const role = map[name]; if (role) play(role);
  };
  S.bind = () => {
    const b = document.querySelector('.snd');
    const show = () => { if (b) { b.setAttribute('aria-pressed', String(S.on)); b.setAttribute('aria-label', S.on ? 'sound on; press to turn it off' : 'sound off; press to turn it on'); } };
    show();
    if (b) b.addEventListener('click', () => {
      S.on = !S.on; show();
      try { localStorage.setItem('deck-sound', S.on ? 'on' : 'off'); } catch (e) {   }
      if (!S.on) for (const r of Object.keys(live)) stop(r);
    });
    for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, wake, { capture: true, passive: true });
    if (!data && b) b.hidden = true;
  };
  S.wake = wake;
  const pend = {};
  let held = false;
  function whenReady(role, f) {
    if (!S.on || !data || !data.roles[role]) return;
    if (S.ready) { f(); return; }
    const w = wake(); if (!w || pend[role]) return;
    pend[role] = true; w.then(() => { pend[role] = false; f(); });
  }
  S.egg = role => { if (!live[role]) whenReady(role, () => { if (!live[role]) play(role); }); };
  S.hold = (role, down) => {
    held = down;
    const l = live[role];
    if (l) { l.s.loop = down; return; }
    if (down) whenReady(role, () => { if (!live[role]) play(role, 0, 1, 1, true); if (!held && live[role]) live[role].s.loop = false; });
  };
  S.sounding = role => !!live[role];
  S.seconds = role => (data && data.roles[role] && data.roles[role].seconds) || 0;
  return S;
}

const LAYOUT = {
  1100: { W: 1100, H: 700, parts: {
    plate: [0, 0, 1100, 56],
    takeup: [24, 72, 276, 276], transport: [24, 356, 276, 44], supply: [24, 408, 276, 276], tape: [312, 72, 24, 612],
    lamps: [348, 72, 420, 84], meters: [348, 168, 420, 139],
    window: [348, 319, 420, 118], report: [348, 449, 420, 235],
    presets: [792, 72, 284, 612] }, drawer: [0, 56, 780, 644], head: 378 },
  760: { W: 760, H: 760, parts: {
    plate: [0, 0, 760, 56],
    takeup: [16, 68, 252, 252], transport: [16, 326, 252, 44], supply: [16, 376, 252, 252], tape: [278, 68, 20, 560],
    lamps: [308, 68, 436, 84], meters: [308, 162, 436, 118],
    window: [308, 289, 436, 118], report: [308, 417, 436, 211],
    presets: [16, 644, 728, 100] }, drawer: [0, 56, 760, 584], head: 348 },
  375: { W: 375, H: 800, parts: {
    plate: [0, 0, 375, 44],
    takeup: [8, 56, 150, 150], supply: [8, 216, 150, 150], tape: [162, 56, 12, 310],
    lamps: [180, 56, 187, 56], title: [180, 118, 187, 40], window: [180, 163, 187, 96],
    meters: [180, 265, 187, 70],
    transport: [8, 380, 359, 52], report: [8, 440, 359, 240],
    presets: [8, 688, 359, 104] }, drawer: null, head: 211 },
};

const params = new URLSearchParams(location.search);
if (params.has('dev')) document.body.dataset.dev = '';
const forced = Number(params.get('w'));
const W = LAYOUT[forced] ? forced : innerWidth >= 1100 ? 1100 : innerWidth >= 760 ? 760 : 375;
const L = LAYOUT[W];
const deck = document.getElementById('deck');
deck.style.width = L.W + 'px'; deck.style.height = L.H + 'px';
deck.dataset.width = W;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

const box = {};
for (const [name, [x, y, w, h]] of Object.entries(L.parts)) {
  const el = document.createElement('section');
  el.className = 'box' + (name === 'tape' ? ' tape' : '');
  el.id = 'box-' + name;
  Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  const label = { takeup: 'take-up', window: 'window - grain: term/near/source/topic' }[name] || name;
  el.innerHTML = name === 'tape' ? '' : `<h2>${label}</h2><div class="body"></div>`;
  deck.appendChild(el);
  box[name] = el;
}
const hm = document.createElement('div');
hm.className = 'headmark';
hm.style.top = (L.head - L.parts.tape[1]) + 'px';
hm.innerHTML = '<span>head</span>';
box.tape.appendChild(hm);

const CITE = 'Edwards, Mike. 2026. Zoe 2.1: Dataset Player. Version 2.1. [Software.] https://preterite.net/weblog/2026/10/31/hey-pretty-agent-memory-part-3.html';
box.plate.querySelector('.body').innerHTML =
  `<span class="logoplate"><a class="logo" href="https://preterite.net/weblog/" target="_top" title="Preterition, the weblog"><svg xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 523.67 64.35" role="img" aria-label="Preterition"><g fill="currentColor"><path d="M77.71,26.14L72.98,26.16C71.91,28.12 70.9,29.94 69.31,31.44 60.29,39.95 45.24,42.33 33.15,41.5L31.52,47.89 30.4,52.32C30.18,54.23 31.22,55.86 33.2,56.27 35.17,56.68 37.2,56.54 39.32,56.38L37.89,62.28 0,62.28 1.39,56.42C3.08,56.43 4.46,56.51 6.07,56.23 7.8,55.93 9.61,54.67 10.06,52.75L18.85,15.39C19.26,13.63 17.68,12.36 16.3,12.25L14.14,12.08 11.68,12.1 13.11,6.11C17.25,6.29 21.17,6.2 25.4,6.07 33.47,5.82 41.31,5.65 49.36,6.2 54.03,6.53 58.37,7.14 62.79,8.4 68.75,10.31 73.87,13.69 73.62,20.5L98.58,20.51C99.02,21.02 99.57,21.77 99.83,22.31L98.54,28.15C102.69,23.24 108.98,19.36 115.35,19.68 118.35,19.84 120.56,21.49 121.75,24.13 123.2,27.35 122.36,30.97 119.39,33.07 117.21,34.62 114.41,35.33 111.75,34.85 109.03,34.35 107.14,32.45 106.49,29.78 102.07,30.5 98.92,34.03 96.8,37.86L91.11,62.27 71.6,62.26 79.48,28.67C79.88,27.43 79.01,26.14 77.71,26.14ZM53.09,22.55C53.69,19.32 52.74,16.3 50.5,14.24 47.42,12.06 43.7,11.42 39.9,12.16L34.55,35.49C43.37,36.98 51.49,31.14 53.09,22.55ZM358.26,43.78C357.4,47.11 356.09,54.13 357.93,55.01 359.62,55.81 361.5,54.92 362.57,53.47 363.91,51.62 364.47,49.51 364.93,47.24L370.1,47.25C368.97,55.5 364.82,61.7 356.3,62.82 353.41,63.2 350.56,63.3 347.66,63.18 342.21,62.95 338.4,59.43 338.08,54 337.65,46.67 339.37,41.72 341.01,35.04L343.17,26.19 337.77,26.14 339.07,20.57C346.43,21.87 350.88,16.93 354.32,10.92L356.83,6.07 367.33,6.09 364,20.51 400.74,20.49C401.4,21.02 401.82,21.59 402.18,22.37L395.03,53.53C394.88,54.19 395.3,55.06 395.67,55.37 396.19,55.8 397.18,55.77 397.82,55.37 398.76,54.78 399.37,53.74 399.64,52.66L400.58,48.93 405.97,48.91C405.74,53.7 403.42,57.84 399.41,60.35 394.88,63.19 389.31,64.14 384.21,62.65 379.57,61.3 376.48,57.54 376.35,52.76 376.29,50.81 376.56,48.96 377.01,47.04L381.31,28.55C381.45,27.93 381.28,27.1 380.88,26.71 380.51,26.35 379.81,26.18 379.14,26.18L362.81,26.19 360.92,33.59 358.26,43.78ZM493.63,48.6L496.55,38.92C497.38,36.16 498.73,32.57 497.26,30.79 495.68,28.87 491.6,30.33 489.41,33.47 487.66,35.99 486.61,38.75 485.61,41.68L482.94,53.13 480.92,62.27 461.4,62.25 469.47,28.44C469.78,27.14 468.88,26.32 467.69,26.05L463.89,26.16 465.19,20.5 488.4,20.5C488.93,20.96 489.53,21.74 489.82,22.31L488.8,27.37C494.38,21.69 502.42,18.83 510.17,20.31 514.86,21.21 517.92,24.84 518.08,29.51 518.17,32.33 517.46,34.92 516.57,37.59L512.03,51.24C511.59,52.57 510.63,54.66 512.44,55.52 513.53,56.04 515.18,54.81 515.73,53.32L517.37,48.93 522.67,48.93C520.83,54.44 518.45,61.32 512.56,62.36 508.95,62.99 505.37,63.03 501.72,62.71 496.77,62.27 492.8,58.94 493.02,53.74 493.09,52.04 493.1,50.35 493.63,48.6ZM448.08,59.41C442.8,62.57 437.2,63.39 431.23,63.22 426.05,63.07 421.07,62.51 416.53,60.08 410.83,57.03 407.21,51.61 407.03,45.1 406.65,31.53 417.88,20.58 431.5,19.76L436.98,19.78C441.2,19.79 445.19,20.36 449.06,21.96 455.77,24.75 460.13,30.76 460.3,38.2 460.5,46.86 455.59,54.9 448.08,59.41ZM436.18,53.26C439.42,47.86 441.23,41.79 441.2,35.55L440.59,30.95C440.37,29.24 439.8,27.6 438.87,26.21 437.99,24.89 436.44,24.67 435.09,25.49 433.6,26.38 432.38,27.68 431.4,29.25 428.03,34.69 426.07,41.01 426.22,47.48 426.3,50.93 427.33,56.94 430.08,57.72 432.22,58.32 434.73,55.67 436.18,53.26ZM138.77,48.97C139.27,53.25 142.5,56.31 146.88,56.43 152.67,56.59 158.05,53.14 160.72,48.05L166.45,48.12C164.46,52.61 161.58,56.17 157.7,58.86 153.2,61.79 148.12,62.98 142.74,63.12 137.8,63.25 133,62.7 128.63,60.45 123.33,57.71 119.87,52.79 119.41,46.77 118.94,40.56 121.05,34.58 125,29.74 129.88,23.74 137.01,20.24 144.77,19.79 149.3,19.52 153.72,19.88 158.14,20.8 162.93,21.8 168.56,24.55 168.64,29.5 168.7,34.09 164.34,38.17 160.44,40.5 153.7,44.53 146.58,45.93 138.72,46.62L138.78,48.97ZM153.36,30.96C153.6,29.26 153.26,27.62 152.17,26.31 151.42,25.42 150.22,25.12 149.08,25.3 142.64,26.34 139.74,34.99 139.01,41.38 145.69,40.31 152.36,37.85 153.36,30.96ZM232.64,56.43C238.5,56.48 243.67,53.11 246.26,48.07L252.1,48.12 250.11,51.68C244.79,61.17 233.37,63.99 222.85,62.92 219.38,62.57 216.15,61.62 213.2,59.89 202.06,53.34 202.94,38.52 211.19,29.03 216.19,23.29 223.38,20.04 231.05,19.74 237.17,19.5 245.72,20.24 250.63,23.61 252.67,25.01 254.25,27.2 254.2,29.71 254.15,32.31 252.78,34.63 251.01,36.51 244.74,43.19 233.57,46.02 224.29,46.58 223.75,51.92 227.14,56.38 232.64,56.43ZM238.78,31.69C239.18,29.84 239.01,28.02 237.91,26.49 235.91,23.69 230.45,26.02 228.42,29.77 226.24,33.22 225.02,37.08 224.59,41.37 230.82,40.38 237.36,38.18 238.78,31.69ZM202.97,47.25C202.05,53.8 199.28,59.44 193.05,61.82 190.45,62.82 187.78,63.08 184.98,63.17 182.82,63.23 180.75,63.33 178.66,62.95 174.54,62.19 171.58,59.13 171.05,54.92 170.17,47.98 172.31,41.26 173.98,34.58L176.07,26.22 170.6,26.12 171.9,20.55C179.01,21.84 183.5,17.27 186.96,11.31L189.65,6.08 200.15,6.08 196.89,20.44 209.26,20.49 207.88,26.18 195.62,26.2 193.69,33.89C192.54,38.51 187.65,54.14 191.01,55.16 194.95,56.34 197.15,51.21 197.83,47.23L202.97,47.25ZM254.29,62.26L262.2,28.32C262.74,25.99 259.44,25.81 256.54,26.18L257.88,20.51 281.21,20.51 282.52,22.31 281.17,28.09C285.33,23.29 291.62,19.33 298,19.68 300.77,19.84 302.88,21.26 304.15,23.65 305.79,26.76 305.19,30.42 302.4,32.72 299.98,34.71 296.64,35.54 293.6,34.66 291.28,33.99 289.72,32.26 289.16,29.83 284.79,30.4 281.59,33.89 279.42,37.84L273.69,62.3 254.29,62.26ZM335.42,48.92C335.44,57.41 328.1,62.67 320.05,63.26 317.34,63.46 314.75,63.19 312.25,62.07 308.88,60.55 306.39,57.53 306.02,53.73 305.89,52.36 305.81,50.72 306.12,49.36L310.84,28.87C310.99,28.18 310.99,27.37 310.62,26.87 310.25,26.37 309.36,26.17 308.62,26.02L305.26,26.23 306.65,20.52 330.41,20.48 331.8,22.27 324.63,53.47C324.51,53.99 324.79,54.86 325.03,55.19 325.3,55.55 326.28,55.85 326.75,55.67 328.09,55.15 328.88,54.08 329.21,52.79L330.19,48.93 335.42,48.92ZM403.62,13.22C400.06,16.9 393.29,18.56 388.53,16.57 386.01,15.52 384.69,13.4 384.39,10.78 384.05,7.91 384.93,5.37 387.25,3.45 390.89,0.45 396.07,-0.78 400.64,0.5 403.61,1.34 405.35,3.61 405.74,6.51 406.07,9.03 405.42,11.36 403.62,13.22ZM332.57,13.85C329.01,16.84 324.05,18.07 319.67,17.08 316.08,16.27 314.03,13.57 313.96,10.06 313.91,7.48 314.67,5.26 316.76,3.52 320.33,0.53 325.38,-0.68 329.93,0.42 333.16,1.2 335.12,3.72 335.34,6.95 335.51,9.54 334.75,12.02 332.57,13.85Z"/></g></svg></a></span>` +
  `<i class="pilot" aria-hidden="true"></i>` +
  `<span class="citeplate"><span class="cite" title="${CITE}"><a class="doi" href="https://doi.org/10.5281/zenodo.23663062" target="_top">doi:10.5281/zenodo.23663062</a>` +
  `<a class="who" href="https://doi.org/10.5281/zenodo.23663062" target="_top">Mike Edwards</a><a class="clic" rel="license" href="https://creativecommons.org/licenses/by/4.0/" target="_top">CC BY 4.0</a></span></span>` +
  `<span class="badgeplate"><button type="button" class="snd" aria-pressed="true" aria-label="sound on; press to turn it off"><svg viewBox="0 0 16 12" aria-hidden="true"><path class="body" d="M1 4h3l4-3v10l-4-3H1z"/><path class="on" d="M10.5 3.6a3.4 3.4 0 0 1 0 4.8M12.6 1.6a6.2 6.2 0 0 1 0 8.8"/><path class="off" d="M10.6 4l4 4M14.6 4l-4 4"/></svg></button><span class="badge"><b>Zoe 2.1</b><small>Dataset player</small></span></span>`;

const NS = 'http://www.w3.org/2000/svg';
const HEAD_H = (L.parts.window[3] - 12) / 3;
const RB = (() => {
  const [ux, uy, uw, uh] = L.parts.takeup, [sx, sy, sw, sh] = L.parts.supply, [px, py, pw, ph] = L.parts.tape;
  const x0 = Math.min(ux, sx), y0 = Math.min(uy, py), x1 = px + pw, y1 = Math.max(sy + sh, py + ph);
  const sc = Math.min(uw, uh) / 2 / REEL.RF, cx = ux + uw / 2 - x0, tx = px + pw / 2 - x0;
  return { x0, y0, w: x1 - x0, h: y1 - y0, sc, cx, tx, L: (tx - cx) / sc,
           cyU: uy + uh / 2 - y0, cyD: sy + sh / 2 - y0, head: L.head - y0 };
})();
const fx = x => x.toFixed(2);
function arcD(r, d0, d1) {
  const [x0, y0] = polar(r, d0), [x1, y1] = polar(r, d1);
  return `M${fx(x0)},${fx(y0)} A${fx(r)},${fx(r)} 0 ${(d1 - d0) % 360 > 180 ? 1 : 0} 1 ${fx(x1)},${fx(y1)}`;
}
function sector(d0, d1) {
  const ext = d1 - d0, R = REEL.RF + 12;
  if (ext <= 0.01) return 'M0,0Z';
  if (ext >= 359.9) return `M${-R},${-R}h${2 * R}v${2 * R}h${-2 * R}Z`;
  const [x0, y0] = polar(R, d0), [x1, y1] = polar(R, d1);
  return `M0,0L${fx(x0)},${fx(y0)}A${R},${R} 0 ${ext > 180 ? 1 : 0} 1 ${fx(x1)},${fx(y1)}Z`;
}
const NOTCH_HALF = 5;
const notchD = (R = REEL.RF + 12) => WINDOWS.map(w => {
  const [x0, y0] = polar(R, w - NOTCH_HALF), [x1, y1] = polar(R, w + NOTCH_HALF);
  return `M0,0L${fx(x0)},${fx(y0)}A${R},${R} 0 0 1 ${fx(x1)},${fx(y1)}Z`; }).join('');
const discD = () => `M${-REEL.RF},0A${REEL.RF},${REEL.RF} 0 1 1 ${REEL.RF},0A${REEL.RF},${REEL.RF} 0 1 1 ${-REEL.RF},0Z`;
const hubHoleD = () => { const r = REEL.HUB + 1; return `M${-r},0A${r},${r} 0 1 1 ${r},0A${r},${r} 0 1 1 ${-r},0Z`; };
function hubArcs() {
  const H = REEL.HUB, o = [];
  for (const [r, w, dark, phase] of [[H * 0.80, H * 0.16, 40, 0], [H * 0.58, H * 0.16, 20, 40]]) {
    o.push(`<circle class="hubarc-l" r="${fx(r)}" stroke-width="${fx(w)}" fill="none"/>`);
    for (let k = 0; k < 6; k++) o.push(`<path class="hubarc-d" d="${arcD(r, phase + 60 * k, phase + 60 * k + dark)}" stroke-width="${fx(w)}" fill="none"/>`);
  }
  return o.join('');
}
function armsMill(id) {
  const rings = [];
  for (let r = REEL.HUB + 7; r < REEL.RF; r += 3) rings.push(`<circle class="ml" r="${r}" fill="none"/>`);
  return `<path${id ? ` id="${id}"` : ''} class="arm" d="${armsD()}"/><g class="mill" clip-path="url(#clip-arms)">${rings.join('')}</g>`;
}
function armsD() {
  const ri = REEL.HUB + 5, RF = REEL.RF;
  return WINDOWS.map(w => {
    const a0 = w + WIN_HALF, a1 = w + 120 - WIN_HALF;
    const [xo0, yo0] = polar(RF, a0), [xo1, yo1] = polar(RF, a1), [xi1, yi1] = polar(ri, a1), [xi0, yi0] = polar(ri, a0);
    return `M${fx(xo0)},${fx(yo0)}A${RF},${RF} 0 0 1 ${fx(xo1)},${fx(yo1)}L${fx(xi1)},${fx(yi1)}A${ri},${ri} 0 0 0 ${fx(xi0)},${fx(yi0)}Z`;
  }).join('');
}
const STYLE = { up: 'marks', dn: 'wedges' };
function wrapSvg(reel, run, s, ring, T) {
  const o = [`<circle class="pk" r="${fx(REEL.HUB + (ring + 0.5) * T)}" stroke-width="${fx(T)}"/>`];
  for (const [band, li, shape] of marksOf(run)[s]) {
    const r = subRadius(reel, ring, band, T), u = LANE_U[li];
    if (STYLE[reel] === 'marks') {
      for (const w of WINDOWS) {
        const [x, y] = polar(r, e1Angle(u, w));
        o.push(shape === 'sq' ? `<rect class="mk mk-${LANE_NAMES[li]} mk-b${band}" x="${fx(x - 1)}" y="${fx(y - 1)}" width="2" height="2"/>`
                              : `<circle class="mk mk-${LANE_NAMES[li]} mk-b${band}" cx="${fx(x)}" cy="${fx(y)}" r="1"/>`);
      }
    } else {
      const m = wedgeMid(u);
      o.push(`<path class="wd wd-${LANE_NAMES[li]} wd-b${band}" d="${arcD(r, m - WEDGE / 2 + 0.6, m + WEDGE / 2 - 0.6)}" stroke-width="${fx(T / 2 * 0.85)}"/>`);
    }
  }
  return o.join('');
}
const reels = document.createElementNS(NS, 'svg');
reels.id = 'reels';
reels.setAttribute('aria-hidden', 'true');
reels.setAttribute('viewBox', `0 0 ${fx(RB.w)} ${fx(RB.h)}`);
Object.assign(reels.style, { left: RB.x0 + 'px', top: RB.y0 + 'px', width: RB.w + 'px', height: RB.h + 'px' });
const at2 = (cy) => `translate(${fx(RB.cx)} ${fx(cy)}) scale(${RB.sc.toFixed(4)})`;
reels.innerHTML = `
<defs><clipPath id="clip-up"><path id="clip-up-p"/></clipPath><clipPath id="clip-dn"><path id="clip-dn-p"/></clipPath>
  <clipPath id="clip-notch"><path d="${notchD()}"/></clipPath>
  <linearGradient id="logo-champ" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8cfb0"/><stop offset="0.4" stop-color="#c3b58f"/><stop offset="1" stop-color="#b0a27c"/></linearGradient>
  <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6d0c4"/><stop offset="0.5" stop-color="#b9b3a8"/><stop offset="1" stop-color="#8a847a"/></linearGradient>
  <filter id="f3" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="0.45" result="b"/><feColorMatrix in="b" type="saturate" values="0.65"/></filter>
  <clipPath id="clip-arms"><path d="${armsD()}"/></clipPath>
  <radialGradient id="hubg" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#b8974a"/><stop offset="0.6" stop-color="#b8974a"/><stop offset="0.68" stop-color="#e2cc84"/><stop offset="0.76" stop-color="#b8974a"/><stop offset="0.9" stop-color="#8c7340"/><stop offset="1" stop-color="#5e4c28"/></radialGradient></defs>
<g transform="${at2(RB.cyU)}"><g id="reel-up">
  <circle class="fl" r="${REEL.RF}"/>
  <g id="up-done"></g><g id="up-part" clip-path="url(#clip-up)"></g>
  ${armsMill('up-arms')}
  <circle class="hub" r="${REEL.HUB}"/>
  ${hubArcs()}<circle class="spindle" r="${fx(REEL.HUB * 0.16)}"/>
</g></g>
<g transform="${at2(RB.cyD)}"><g id="reel-dn">
  <circle class="fl" r="${REEL.RF}"/>
  <g id="dn-under"><g id="dn-under-done"></g><g id="dn-under-part" clip-path="url(#clip-dn)"></g></g>
  <g id="dn-smear" opacity="0"></g>
  <g id="dn-notch" clip-path="url(#clip-notch)"><g id="dn-marks"><g id="dn-done"></g><g id="dn-part" clip-path="url(#clip-dn)"></g></g></g>
  <circle class="hub" r="${REEL.HUB}"/>
  ${hubArcs()}<circle class="spindle" r="${fx(REEL.HUB * 0.16)}"/>
</g></g>
<path id="tape-path" class="tp"/>
<path id="tape-stripe2" class="tps2"/>
<path id="tape-stripe" class="tps"/>
<rect class="headblk" x="${fx(RB.tx + 2)}" y="${fx(RB.head - HEAD_H / 2)}" width="7" height="${fx(HEAD_H)}"/>
<circle class="guide" cx="${fx(RB.tx)}" cy="${fx(RB.cyU)}" r="4"/>
<circle class="guide" cx="${fx(RB.tx)}" cy="${fx(RB.cyD)}" r="4"/>
<g transform="${at2(RB.cyU)}"><g id="up-over">${armsMill()}</g></g>
<g transform="${at2(RB.cyD)}"><g id="dn-over"><path class="frost" fill-rule="evenodd" d="${discD()}${notchD(REEL.RF - 0.5)}${hubHoleD()}"/></g></g>`;
deck.appendChild(reels);
const $r = id => reels.querySelector('#' + id);
function dip() {
  reels.classList.add('dip');
  void reels.getBoundingClientRect();
  requestAnimationFrame(() => reels.classList.remove('dip'));
}
function xf(el) { if (!reduced) return; el.classList.remove('xf'); void el.getBoundingClientRect(); el.classList.add('xf'); }
let reelKey = null;
function drawReels(run, kf, vEff) {
  const R = reelAt(run, kf), T = R.T;
  const key = slots[st.slot].key + ':' + R.k;
  if (key !== reelKey) {
    $r('up-done').innerHTML = R.up.map(([s, ring]) => wrapSvg('up', run, s, ring, T)).join('');
    $r('dn-done').innerHTML = R.dn.map(([s, ring]) => wrapSvg('dn', run, s, ring, T)).join('');
    $r('up-part').innerHTML = R.upPart ? wrapSvg('up', run, R.upPart[0], R.upPart[1], T) : '';
    $r('dn-part').innerHTML = R.dnPart ? wrapSvg('dn', run, R.dnPart[0], R.dnPart[1], T) : '';
    $r('dn-under-done').innerHTML = $r('dn-done').innerHTML;
    $r('dn-under-part').innerHTML = $r('dn-part').innerHTML;
    $r('dn-smear').innerHTML = (R.dnPart ? R.dn.concat([R.dnPart]) : R.dn).map(([s, ring]) =>
      marksOf(run)[s].map(([band]) => `<circle class="sm" r="${fx(subRadius('dn', ring, band, T))}"/>`).join('')).join('');
    if (reelKey !== null) xf(reels);
    reelKey = key;
  }
  $r('reel-up').setAttribute('transform', `rotate(${fx(R.rot)})`);
  $r('up-over').setAttribute('transform', `rotate(${fx(R.rot)})`);
  $r('dn-over').setAttribute('transform', `rotate(${fx(R.rot)})`);
  $r('reel-dn').setAttribute('transform', `rotate(${fx(R.rot)})`);
  const tu = touchAngle('up', R.rUp, RB.L), td = touchAngle('dn', R.rDn, RB.L);
  $r('clip-up-p').setAttribute('d', sector(tu, tu + 360 * R.frac));
  $r('clip-dn-p').setAttribute('d', sector(td + 360 * R.frac, td + 360));
  const [ux, uy] = polar(R.rUp, tu), [dx, dy] = polar(R.rDn, td);
  const lift = st.lifted ? -7 : 0;
  $r('tape-path').setAttribute('d',
    `M${fx(RB.cx + ux * RB.sc)},${fx(RB.cyU + uy * RB.sc)}L${fx(RB.tx)},${fx(RB.cyU)}` +
    `L${fx(RB.tx + lift)},${fx(RB.head - HEAD_H / 2)}L${fx(RB.tx + lift)},${fx(RB.head + HEAD_H / 2)}` +
    `L${fx(RB.tx)},${fx(RB.cyD)}L${fx(RB.cx + dx * RB.sc)},${fx(RB.cyD + dy * RB.sc)}`);
  $r('tape-stripe').setAttribute('d', $r('tape-path').getAttribute('d'));
  const off = (kf * 48) % 32;
  $r('tape-stripe').setAttribute('stroke-dashoffset', fx(off));
  $r('tape-stripe2').setAttribute('d', $r('tape-path').getAttribute('d'));
  $r('tape-stripe2').setAttribute('stroke-dashoffset', fx(off + 2));
  const sm = smearOf(vEff);
  $r('dn-marks').setAttribute('opacity', fx(1 - 0.9 * sm));
  $r('dn-under').setAttribute('opacity', fx(1 - 0.9 * sm));
  $r('dn-smear').setAttribute('opacity', fx(sm));
}

const cache = {};
const body = n => {
  const el = box[n] && box[n].querySelector('.body');
  if (!el) return null;
  return { set innerHTML(h) { if (cache[n] !== h) { cache[n] = h; el.innerHTML = h; } } };
};
const say = text => { document.getElementById('announce').textContent = text; };

async function getData() {
  const el = document.getElementById('deck-data');
  if (el) {
    const t0 = performance.now();
    const d = JSON.parse(el.textContent);
    T.timings.parse_ms = performance.now() - t0;
    T.timings.data_chars = el.textContent.length;
    return d;
  }
  const get = f => fetch('/data/' + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
  const index = await get('zoetrope-all.json');
  const passages = (await get(index.baselines)).passages;
  const exports = {};
  await Promise.all(index.runs.map(async e => { exports[e.run] = await get(e.path); }));
  return { index, passages, exports };
}
const DATA = await getData();
const ix = DATA.index;
const passages = DATA.passages;
const entryOf = id => ix.runs.find(e => e.run === id) || null;

const runs = new Map();
function runFor(key) {
  if (!runs.has(key)) {
    if (key.startsWith('file:')) throw new Error(`${key} was never picked`);
    runs.set(key, makeRun(DATA.exports[key], entryOf(key), passages));
  }
  return runs.get(key);
}

const LETTERS = {
  '20261018-straight-letter-s7': 'A',
  '20261018-straight-letter-s7-r2': 'B',
  '20261020-straight-letter-s7-argon4-r2': 'C',
  '20261020-straight-letter-s7-progress-report-nothing-is-due': 'D',
  '20261020-straight-letter-s7-gpt61sol': 'E',
  '20261019-straight-letter-s7-questions': 'F',
};
for (const id of Object.keys(LETTERS)) if (!entryOf(id) || !entryOf(id).six_key) throw new Error(id + ' is not among the index six');
let store = null;
try { store = window.localStorage; } catch {   }
const remembered = store ? bankRestore(store, new Set(ix.runs.map(r => r.run))) : null;
const slots = makeSlots(remembered || Object.keys(LETTERS));
const ks = makeKnobs(ix);
const st = {
  mode: 'PLAY', slot: 0, kf: 0, v: 0, held: 0, target: null, view: 'REPORT',
  lifted: false, wind: null, set: null,
  picked: null,
  focusKnob: null, lastWhole: 0, admittedBefore: null,
};
const cur = () => runFor(slots[st.slot].key);

const LAMPS = ['catalog', 'delivery', 'copied', 'in hand', 'by name', 'not taken', 'off ladder',
               'term', 'near family', 'source', 'topic', 'arc'];
const RUNG = { copied: 'copied', in_hand: 'in hand', by_name: 'by name', not_taken: 'not taken',
               no_traced_channel: 'off ladder' };
if (LAMPS.length !== LANE_NAMES.length) throw new Error('the lamps and the lanes disagree');
const lit = (run, kf) => new Set([...lampsLit(run, kf, st.lifted)].map(n => LAMPS[LANE_NAMES.indexOf(n)]));
const SHORT = ['cat', 'deliv', 'copy', 'hand', 'name', 'not', 'off', 'term', 'near', 'src', 'topic', 'arc'];
const lampGrid = el('div', { class: 'lamps', 'aria-hidden': 'true' });
const lampEls = LAMPS.map((name, i) => {
  const lp = el('span', { class: 'lp lp-' + LANE_NAMES[i] });
  lp.append(el('i', { class: 'bulb ' + (/^r\d$/.test(LANE_NAMES[i]) ? 'sq' : 'dot') }),
            el('span', { class: 'ln' }, W === 375 ? SHORT[i] : name));
  return lp;
});
const BOARD = ['catalog', 'delivery', 'copied', 'arc', 'term', 'near family', 'source', 'topic',
               'in hand', 'by name', 'not taken', 'off ladder'];
if (BOARD.length !== LAMPS.length || BOARD.some(n => !LAMPS.includes(n))) throw new Error('the board and the lamps disagree');
BOARD.forEach(n => lampGrid.appendChild(lampEls[LAMPS.indexOf(n)]));
const lampSr = el('p', { class: 'sr' });
box.lamps.querySelector('.body').append(lampGrid, lampSr);
function drawLamps(on, text) {
  LAMPS.forEach((name, i) => lampEls[i].classList.toggle('on', on.has(name)));
  if (lampSr.textContent !== text) lampSr.textContent = text;
}

const SEM_TOP = ix.scales.semantic_distance[1], RUN_TOP = ix.scales.session_running[1];
const PIV = [60, 58];
const mpt = (r, a) => { const [x, y] = polar(r, a); return [PIV[0] + x, PIV[1] + y]; };
const marc = (r, a0, a1) => { const [x0, y0] = mpt(r, a0), [x1, y1] = mpt(r, a1);
  return `M${fx(x0)},${fx(y0)}A${r},${r} 0 0 1 ${fx(x1)},${fx(y1)}`; };
function meterSvg(id, label) {
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(u => {
    const a = METER.A0 + (METER.A1 - METER.A0) * u, [x0, y0] = mpt(46, a), [x1, y1] = mpt(51, a);
    return `<line class="mt" x1="${fx(x0)}" y1="${fx(y0)}" x2="${fx(x1)}" y2="${fx(y1)}"/>`;
  }).join('');
  const [px0, py0] = mpt(44, METER.PARK), [px1, py1] = mpt(50, METER.PARK);
  return `<svg class="meter" id="${id}" viewBox="0 0 120 74" aria-hidden="true">
<defs><pattern id="${id}-hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="1.4" height="3" class="hatch"/></pattern></defs>
<path class="scale" d="${marc(50, METER.A0, METER.A1)}"/>${ticks}
<path class="zone" id="${id}-zone"/><line class="btick" id="${id}-btick"/>
<line class="pin" x1="${fx(px0)}" y1="${fx(py0)}" x2="${fx(px1)}" y2="${fx(py1)}"/>
<text class="mlab" x="60" y="71" text-anchor="middle">${label}</text>
<g id="${id}-needle"><path class="ndl" d="M58.7,58 L60,9 L61.3,58 Z"/></g>
<circle class="piv" cx="60" cy="58" r="2.6"/></svg>`;
}
const mb = box.meters.querySelector('.body');
mb.innerHTML = `<div class="meters">
  <div class="mtr">${meterSvg('m-sem', 'DISTANCE')}<pre class="mcap" id="m-sem-cap"></pre></div>
  <div class="mid"></div>
  <div class="mtr">${meterSvg('m-run', 'SINCE HELD')}<pre class="mcap" id="m-run-cap"></pre></div></div>`;
const meterEl = id => mb.querySelector('#' + id);
const needles = [{ a: METER.PARK, w: 0 }, { a: METER.PARK, w: 0 }];
T.mech = { needles, targets: () => needleTargets(), st: () => ({ kf: st.kf, lifted: st.lifted, v: st.vEff || 0 }) };
function needleTargets() {
  const f = st.lifted ? null : at(cur(), st.kf).current;
  return [f ? meterAngle(f.bars.semantic, SEM_TOP) : METER.PARK, f ? meterAngle(f.bars.running, RUN_TOP) : METER.PARK];
}
function stepNeedles(dt) {
  const tg = needleTargets();
  needles.forEach((n, i) => Object.assign(n, needleStep(n, tg[i], dt, reduced)));
}
const capCache = {};
function setText(id, text) { if (capCache[id] !== text) { capCache[id] = text; meterEl(id).textContent = text; } }
function setHTML(id, html) { if (capCache[id] !== html) { capCache[id] = html; meterEl(id).innerHTML = html; } }
function drawMeters(f) {
  meterEl('m-sem-needle').setAttribute('transform', `rotate(${fx(needles[0].a)} 60 58)`);
  meterEl('m-run-needle').setAttribute('transform', `rotate(${fx(needles[1].a)} 60 58)`);
  const b = f && !st.lifted ? f.band : null;
  const zone = meterEl('m-sem-zone'), bt = meterEl('m-sem-btick');
  if (b && b.value !== null) {
    const a = meterAngle(b.value, SEM_TOP), [x0, y0] = mpt(40, a), [x1, y1] = mpt(51, a);
    zone.setAttribute('d', marc(44, METER.A0, a));
    zone.setAttribute('class', 'zone ' + (b.verdict === 'clean' ? 'clean' : 'conf'));
    Object.entries({ x1: fx(x0), y1: fx(y0), x2: fx(x1), y2: fx(y1) }).forEach(([k, v]) => bt.setAttribute(k, v));
    bt.setAttribute('class', 'btick ' + (b.verdict === 'clean' ? 'clean' : 'conf'));
  } else {
    zone.setAttribute('d', ''); bt.setAttribute('class', 'btick none');
  }
  if (!f || st.lifted) {
    setText('m-sem-cap', st.lifted ? 'tape lifted\nneedles parked' : 'at the leader\nneedles parked');
    setText('m-run-cap', '');
    return;
  }
  setHTML('m-sem-cap', `<b>${f.bars.semantic === null ? 'no page: parked' : num(f.bars.semantic)}</b>\n` +
    (b ? `base ${num(b.value)}\n${esc(b.name)} ${b.value === null ? 'no tick' : b.verdict === 'clean' ? 'clean' : 'conf.'}` : 'no baseline'));
  setHTML('m-run-cap', `since held <b>${num(f.bars.running)}${f.bars.running > RUN_TOP ? ' (pinned)' : ''}</b>\nreturn gap <b>${num(f.bars.gap)}</b>`);
}

const winBody = box.window.querySelector('.body');
winBody.innerHTML = '<div class="wstrip"></div><div class="hz hz-up"></div><div class="hz hz-head"></div><div class="hz hz-dn"></div>';
const wstrip = winBody.firstChild;
const ROW_H = HEAD_H;
winBody.style.setProperty('--rowh', ROW_H + 'px');
let winKey = null;
function drawWindow(run, h) {
  const key = `${slots[st.slot].key}:${h.k}:${st.lifted}`;
  if (key !== winKey) {
    wstrip.innerHTML = [h.k - 1, h.k, h.k + 1, h.k + 2].map((s, i) => {
      const pic = s >= 1 && s <= run.N + 1 ? face(run, s, { held: true }).svg : '';
      const txt = st.lifted ? '(tape lifted)' : s === run.N + 1 ? '(tape end)' : frameText(s >= 1 && s <= run.N ? frame(run, s) : null);
      return `<div class="fr${i === 1 ? ' head' : ''}" style="height:${fx(ROW_H)}px"><span class="fpic">${pic}</span>` +
        `<span class="ftxt">${i === 1 ? '<span class="sr">head: </span>' : ''}${txt}</span></div>`;
    }).join('');
    if (winKey !== null) xf(wstrip);
    winKey = key;
  }
  wstrip.style.transform = `translateY(${fx(-h.frac * ROW_H)}px)`;
}

function scopeSvg(run, h) {
  const S = scopeAt(run, h.kf, st.lifted);
  const [, , rw, rh] = L.parts.report, w = rw - 16, hh = Math.max(Math.min(rh - 70, 190), 96);
  const pad = 8, ch = (hh - 3 * pad) / 2;
  const x = s => pad + (s - 0.5) / S.N * (w - 2 * pad), cw = (w - 2 * pad) / S.N;
  const y1 = v => pad + ch - Math.min(v / SEM_TOP, 1) * ch;
  const y2 = v => 2 * pad + 2 * ch - Math.min(v / RUN_TOP, 1) * ch;
  const o = [`<svg class="scope" viewBox="0 0 ${w} ${fx(hh)}" width="${w}" height="${fx(hh)}" role="img" ` +
    `aria-label="scope: ${S.k} of ${S.N} sessions played; the next ${S.ghost.length} ahead faint` +
    `${S.horizon.length ? `; the head received from S${S.horizon.join(', S')}` : ''}">`,
    `<rect class="ch" x="${pad}" y="${pad}" width="${fx(w - 2 * pad)}" height="${fx(ch)}"/>`,
    `<rect class="ch" x="${pad}" y="${fx(2 * pad + ch)}" width="${fx(w - 2 * pad)}" height="${fx(ch)}"/>`,
    `<text class="slab" x="${pad + 3}" y="${pad + 9}">DISTANCE</text>`,
    `<text class="slab" x="${pad + 3}" y="${fx(2 * pad + ch + 9)}">SINCE HELD</text>`];
  for (const s of S.horizon)
    o.push(`<rect class="hz" x="${fx(x(s) - cw / 2)}" y="${pad}" width="${fx(cw)}" height="${fx(2 * ch + pad)}"/>`);
  for (const b of S.bands) if (b.value !== null)
    o.push(`<line class="bl ${b.verdict === 'clean' ? 'clean' : 'conf'}" x1="${fx(x(b.s0) - cw / 2)}" x2="${fx(x(b.s1) + cw / 2)}" ` +
      `y1="${fx(y1(b.value))}" y2="${fx(y1(b.value))}"/>`);
  const trace = (pts, key, y, floor, cls, op) => {
    pts.forEach((p, i) => {
      if (p[key] === null || p[key] === undefined) {
        o.push(`<circle class="nul" cx="${fx(x(p.s))}" cy="${fx(floor)}" r="2"/>`);
        return;
      }
      const q = i ? pts[i - 1] : null;
      if (q && q[key] !== null && q[key] !== undefined)
        o.push(`<line class="${cls}" x1="${fx(x(q.s))}" y1="${fx(y(q[key]))}" x2="${fx(x(p.s))}" y2="${fx(y(p[key]))}"${op(p.s)}/>`);
    });
  };
  const fade = s => ` stroke-opacity="${fadeOf(S.k, s).toFixed(2)}"`;
  const at0 = S.played.length ? [S.played[S.played.length - 1]] : [];
  trace(S.played, 'sem', y1, pad + ch, 'tr', fade);
  trace(S.played, 'run', y2, 2 * pad + 2 * ch, 'tr', fade);
  trace(at0.concat(S.ghost), 'sem', y1, pad + ch, 'gh', () => '');
  trace(at0.concat(S.ghost), 'run', y2, 2 * pad + 2 * ch, 'gh', () => '');
  if (S.k >= 1 && !st.lifted) {
    const a = S.played[S.played.length - 1], nb = S.ghost[0], f = S.frac;
    const lerp = (key, y) => (nb && nb[key] !== null && a[key] !== null) ? y(a[key] + (nb[key] - a[key]) * f)
      : a[key] !== null ? y(a[key]) : null;
    const bx = x(S.k + f);
    for (const [key, y] of [['sem', y1], ['run', y2]]) {
      const by = lerp(key, y);
      if (by !== null) o.push(`<circle class="beam" cx="${fx(bx)}" cy="${fx(by)}" r="2.6"/>`);
    }
    o.push(`<line class="hd" x1="${fx(bx)}" x2="${fx(bx)}" y1="${pad}" y2="${fx(2 * pad + 2 * ch)}"/>`);
  }
  o.push('</svg>');
  return o.join('');
}

const num = v => v === null || v === undefined ? 'none' : (typeof v === 'number' ? +v.toFixed(5) : v);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
function grain(gr) {
  if (!gr.rows) return 'grain absent';
  return gr.rows.map(r => r.count === null ? '-' : r.count).join('/');
}
function frameText(f) {
  if (!f) return '(no session)';
  const s = f.slot, fr = f.frame;
  const slot = s.kind === 'nothing' ? 'in: nothing' + (s.notice ? ', notice' : '')
    : `in: ${s.kind}${s.after ? ' after ' + s.after : ''}${s.rung ? ', ' + RUNG[s.rung] : ''}, ${grain(s.grain)}`;
  const met = [fr.catalog && 'cat', fr.delivery && 'deliv', fr.page && 'page ' + RUNG[fr.page]]
    .filter(Boolean).join(', ') || 'nothing';
  return `S${f.session} ${f.status} | ${slot} | met: ${met}${f.relay ? ' | relay' : ''}`;
}
function strip(key, html = true, short = false) {
  const id = key.replace(/^file:/, '');
  const e = entryOf(id);
  const run = runs.get(key);
  const term = run ? run.term : e ? e.term : '?';
  const it = html ? `<i>${esc(term)}</i>` : term;
  if (key.startsWith('file:')) return short ? `${it} (file)` : `${it}, from a file`;
  const head = `${LETTERS[id] ? LETTERS[id] + ' ' : ''}${it}`;
  return short ? head : `${head}, ${e.knobs.MODEL}, ${e.knobs.GENRE}`;
}

function render() {
  const run = cur();
  const v = at(run, st.kf);
  const { head: h, packs: p, current: f } = v;
  drawReels(run, h.kf, st.vEff || 0);
  const kfr = document.getElementById('kfr');
  kfr.max = run.N; kfr.value = h.kf;
  document.getElementById('kfv').textContent =
    `kf ${h.kf.toFixed(2)}  k ${h.k}  frac ${h.frac.toFixed(2)}  v ${st.v.toFixed(1)}/s${st.lifted ? '  LIFTED' : ''}`;

  body('takeup').innerHTML = `<pre class="sr">${p.takeup.toFixed(2)} sessions wound\nS1..S${Math.max(h.k - 1, 0)} whole` +
    (h.k >= 1 && h.frac > 0 ? `\nS${h.k} laying ${h.frac.toFixed(2)}` : '') + '</pre>';
  body('supply').innerHTML = `<pre class="sr">${p.supply.toFixed(2)} sessions to play\nS${Math.min(h.k + 1, run.N)}..S${run.N}` +
    (h.atEnd ? '\n(empty)' : '') + (run.begun ? `\nthen begun S${run.begun.join(', S')}: tape end` : '') + '</pre>';
  box.tape.classList.toggle('lifted', st.lifted);

  const on = lit(run, h.kf);
  drawLamps(on, st.lifted ? 'tape lifted: all dark' : f ? `${on.size} of ${LAMPS.length} lit: ` +
    (LAMPS.filter(n => on.has(n)).join(', ') || 'none') : 'leader: all dark');

  if (body('title')) body('title').innerHTML = `<pre>${strip(slots[st.slot].key)}</pre><span class="sr">${esc(run.id)}</span>`;

  drawMeters(f);

  box.window.classList.toggle('lifted', st.lifted);
  drawWindow(run, h);

  let glass = '';
  if (st.mode === 'LOAD') {
    glass = 'loading: the tape lifted, the transport locked; choose in the drawer';
  } else if (st.view === 'REPORT') {
    glass = (W !== 375 ? strip(slots[st.slot].key) + '\n' + esc(run.id) + '\n' : '') + (st.lifted ? 'winding, the tape lifted' : f ? `session ${f.session}: ${f.status}` +
      `\nreceived by ${f.slot.channels.join(', ')}${f.slot.from.length ? ' from S' + f.slot.from.join(', S') : ''}` +
      (f.slot.grain && !f.slot.grain.rows ? `\nslot grain absent: ${esc(f.slot.grain.absent)}` : '') +
      `\nletter written: ${f.letterOut ? RUNG[f.letterOut] : 'none'}` +
      `\ntold: session ${f.time.number} of ${f.time.total ?? 'unstated'}${f.time.nothing_is_due ? ', nothing is due' : ''}${f.time.exit_tool ? ', exit offered' : ''}`
      : 'at the leader');
  } else if (st.view === 'SCOPE') {
    glass = scopeSvg(run, h);
  } else {
    const e = entryOf(run.id);
    const verdict = slots[st.slot].key.startsWith('file:')
      ? `judged here: ${runs.get(slots[st.slot].key).verdict}` : `llm-loop's verdict: ${e.verdict}`;
    glass = esc(ix.common_caption) + '\n\n' + esc(run.sentence || 'no term-rule sentence: not in the selection') +
      (run.told ? `\n\ntold: ${esc(run.told.line)}` : '') + '\n\n' + verdict;
  }
  deck.dataset.view = st.view;
  document.getElementById('glass').innerHTML = glass;
  updateControls(h, run);
}

function el(tag, attrs = {}, text = '') {
  const x = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
  if (text) x.textContent = text;
  return x;
}

const ICO = d => `<svg viewBox="0 0 16 8" aria-hidden="true"><path d="${d}"/></svg>`;
const KEY_ICON = { rewind: ICO('M8 0 0 4 8 8zM16 0 8 4 16 8z'), step: ICO('M0 0 10 4 0 8zM12 0h3v8h-3z'), slow: ICO('M4 0 14 4 4 8z'),
  fast: ICO('M0 0 8 4 0 8zM8 0 16 4 8 8z'), cue: ICO('M2 8A6 6 0 0 1 14 8z'), locate: ICO('M8 0 12 4 8 8 4 4z') };
const tp = el('div', { class: 'tp' });
for (const [k, label, aria] of [['rewind', 'REWIND', 'rewind to the leader'], ['step', 'STEP', 'advance one session'],
  ['slow', 'SLOW', 'advance slow, hold'], ['fast', 'FAST', 'advance fast, hold']]) {
  const b = el('button', { 'data-k': k, 'aria-label': aria });
  b.innerHTML = `<i class="ic" aria-hidden="true">${KEY_ICON[k]}</i><span class="kl">${label}</span>`;
  tp.appendChild(b);
}
box.transport.querySelector('.body').appendChild(tp);

const C = mountCounter({
  root: deck,
  host: W === 375 ? box.transport.querySelector('.body') : mb.querySelector('.mid'),
  order: W === 375 ? 'keys-first' : 'counter-first',
  st, bus, say,
  words: {
    cueAria: 'set this tape\'s cue at the head',
    locateAria: 'wind to the counter\'s setting, or to the cue',
    icons: { cue: KEY_ICON.cue, locate: KEY_ICON.locate },
    saidCue: s => `cue set at ${s ? 'session ' + s : 'the leader'}`,
    saidPast: (to, n) => `S${pad3(to)} is past the end; winding to S${pad3(n)}`,
  },
  hooks: {
    reading: () => {
      const run = cur();
      return { session: at(run, st.kf).head.session, N: run.N, live: st.mode === 'PLAY' && !st.frozen,
               cue: slots[st.slot].cue, winding: st.lifted };
    },
    setCue: () => {
      if (st.mode !== 'PLAY' || winding() || st.frozen) return null;
      const s = Math.floor(st.kf);
      slots[st.slot].cue = s;
      return { slot: st.slot, session: s };
    },
    goTo: (to, by) => wind(to, by),
    winding: () => winding(),
    render,
  },
});

const rb = box.report.querySelector('.body');
const tog = el('div', { style: 'display:flex;gap:4px;margin-bottom:3px' });
for (const n of ['REPORT', 'SCOPE', 'NOTE']) tog.appendChild(el('button', { 'data-view': n, 'aria-pressed': 'false' }, n));
rb.append(tog, el('pre', { id: 'glass' }));

const D = mountDrawer({
  root: deck,
  bankHost: box.presets.querySelector('.body'),
  rect: L.drawer,
  flex: {
    key: W === 1100 ? '1 1 0' : `1 1 ${W === 760 ? '12%' : '22%'}`,
    mode: W === 1100 ? '1 1 0' : '1 1 12%',
    full: W === 1100,
  },
  ks, slots, st, bus, say, strip, drop,
  intake: exp => intake(exp, passages),
  kind: 'run',
  sync: { shown: true },
  words: {
    title: 'Tape library', region: 'tape library',
    pickKey: 'Choose file',
    pickLine: 'Load a downloaded <a href="https://doi.org/10.5281/zenodo.23663062">dataset</a> file.',
    howto: [
      'Turn the knobs to lock positions, or turn SHUFFLE and press its LOCK. The glass reports the count of available tapes left by the locks.',
      'When the locks leave one tape, press a preset button to load it to that slot.',
      'Press PLAY to leave the loader and return to the player.',
    ],
    turnAll: 'shuffle: turn the knobs to a tape at random among those the locks leave',
    shuffleGlass: n => `SHUFFLE: a tape at random among the ${n} the locks leave`,
    allLockedSay: 'every knob is locked; unlock first',
    tapePrompt: '2  press a preset key to load it into that slot.',
    noTape: 'No tape chosen: lock the knobs to one run, or pick a file.',
  },
  hooks: {
    inert: setInert,
    onMode: () => { C.clearAdjust(); },
    enterLoad: () => { st.held = 0; st.target = null; st.v = 0; finishWind(); st.kf = Math.round(st.kf); slots[st.slot].kf = st.kf; },
    load: (i, key) => { runFor(key); },
    save: () => { if (store) bankSave(store, slots); },
    leader: i => { st.slot = i; st.kf = 0; },
    choose,
    render,
    tapeOf: one => { const e = entryOf(one); return { key: one, verdict: e.verdict, gaps: e.gaps }; },
    knows: key => !!entryOf(key),
    kindOf: exp => {
      if (!exp || typeof exp !== 'object' || Array.isArray(exp)) return null;
      if (typeof exp.fan === 'string' && exp.fan) return 'fan';
      if (typeof exp.run === 'string' && exp.run) return 'run';
      return null;
    },
    keep: (exp, verdict) => {
      const key = 'file:' + exp.run;
      const run = makeRun(exp, entryOf(exp.run), passages);
      run.verdict = verdict;
      runs.set(key, run);
      return { key, id: exp.run };
    },
  },
});
T.drawer = D;
function setInert(on) {
  for (const [name, b] of Object.entries(box)) {
    if (name === 'presets') continue;
    if (W !== 375 && name === 'plate') continue;
    b.inert = on;
  }
}

function updateControls(h, run) {
  const playing = st.mode === 'PLAY';
  for (const b of tp.querySelectorAll('button')) b.disabled = !playing || !!st.frozen;
  C.update({ session: h.session, N: run.N, live: playing && !st.frozen, cue: slots[st.slot].cue, winding: st.lifted });
  for (const b of tog.querySelectorAll('button')) {
    b.setAttribute('aria-pressed', String(st.view === b.dataset.view));
    b.disabled = !playing;
  }
  D.updateBank();
}

const ACC = 30, DEC = 24, MINV = 1.25, SPEED = { slow: 3, fast: 5 };
let last = null;
function tick(t) {
  const run = cur();
  if (last !== null) {
    const dt = Math.min((t - last) / 1000, 0.05);
    const k0 = st.kf, lift0 = st.lifted;
    if (st.wind) {
      const w = st.wind, u = Math.min((t - w.t0) / (w.dur * 1000), 1);
      st.kf = reduced ? (u < 1 ? w.from : w.to) : w.from + (w.to - w.from) * (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
      if (u >= 1) {
        st.kf = w.to; st.wind = null; st.lifted = false; st.lastWhole = Math.floor(st.kf);
        emit('locate-done', { session: st.kf });
        say(`at ${st.kf ? 'session ' + st.kf : 'the leader'}`);
      }
    } else if (st.held) {
      st.v = Math.min(st.held, st.v + ACC * dt);
      st.kf = clamp(run, st.kf + st.v * dt);
      if (st.kf >= run.N) { st.held = 0; st.v = 0; st.target = null; emit('land', { session: run.N }); }
    } else if (st.target !== null) {
      const rem = st.target - st.kf;
      st.v = Math.max(Math.min(st.v || MINV, Math.sqrt(2 * DEC * Math.max(rem, 0))), MINV);
      if (st.kf + st.v * dt >= st.target) {
        st.kf = st.target; st.v = 0; st.target = null;
        emit('land', { session: st.kf });
        say(`session ${st.kf}`);
      } else st.kf += st.v * dt;
    }
    if (!st.lifted) {
      const whole = Math.floor(st.kf);
      for (let s = st.lastWhole + 1; s <= whole; s++) emit('head-cross', { session: s });
      st.lastWhole = whole;
    }
    st.vEff = reduced ? 0 : 0.6 * (st.vEff || 0) + 0.4 * Math.abs(st.kf - (st.prevKf ?? st.kf)) / Math.max(dt, 1e-3);
    if (!lift0 && !st.lifted) SND.turn(k0, st.kf, dt);
    st.prevKf = st.kf;
    stepNeedles(dt);
    slots[st.slot].kf = st.kf;
    render();
  }
  last = t;
  requestAnimationFrame(tick);
}

const winding = () => !!st.wind;
function step() {
  if (st.mode !== 'PLAY' || winding() || st.frozen) return;
  const run = cur();
  const next = Math.min(run.N, Math.floor(st.kf) + 1);
  C.clearAdjust(); emit('step', { from: st.kf });
  if (reduced) { st.kf = next; slots[st.slot].kf = next; emit('land', { session: next }); render(); }
  else if (st.target === null) st.target = next;
}
function hold(kind) {
  if (st.mode !== 'PLAY' || winding() || st.frozen) return;
  if (reduced) { step(); return; }
  st.held = SPEED[kind]; st.heldKind = kind; C.clearAdjust();
  emit('hold-start', { speed: kind });
}
function release() {
  if (!st.held) return;
  const run = cur();
  emit('hold-release', { speed: st.heldKind });
  st.held = 0;
  st.target = Math.min(run.N, Math.max(Math.floor(st.kf) + 1, Math.ceil(st.kf + st.v * st.v / (2 * DEC))));
}
function wind(to, by) {
  if (st.mode !== 'PLAY' || winding() || st.frozen) return;
  const run = cur();
  to = clamp(run, to);
  st.held = 0; st.target = null; st.v = 0; C.forgetSetting();
  if (to === st.kf) { emit('locate-done', { session: to }); return; }
  st.lifted = true;
  const cue = by === 'rewind' && SND.seconds('rewind');
  st.wind = { from: st.kf, to, t0: performance.now(), dur: cue || (reduced ? 0.3 : 0.6 + 1.2 * Math.abs(to - st.kf) / run.N) };
  if (by === 'rewind') { C.clearAdjust(); emit('rewind', {}); }
  emit('locate-start', { from: st.kf, to, by });
}
function finishWind() {
  if (!st.wind) return;
  st.kf = st.wind.to; st.wind = null; st.lifted = false; st.lastWhole = Math.floor(st.kf);
  emit('locate-done', { session: st.kf });
}

function choose(i) {
  finishWind();
  slots[st.slot].kf = st.kf;
  st.slot = i;
  const run = cur();
  st.kf = slots[i].kf; st.v = 0; st.held = 0; st.target = null; st.lastWhole = Math.floor(st.kf);
  st.prevKf = st.kf; st.vEff = 0; C.reset();
  dip();
  document.getElementById('runsel').value = run.id;
  emit('preset', { slot: i, id: run.id });
  render();
}

deck.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.k === 'step') step();
  else if (b.dataset.k === 'rewind') wind(0, 'rewind');
  else if (b.dataset.view) { st.view = b.dataset.view; emit('view', { view: st.view }); render(); }
});
deck.addEventListener('pointerdown', e => {
  const b = e.target.closest('button[data-k="slow"], button[data-k="fast"]');
  if (b && !b.disabled) hold(b.dataset.k);
});
addEventListener('pointerup', release);
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('.kface')) return;
  if (e.target.closest && e.target.closest('.wheel')) return;
  if (e.key === 'Escape' && st.mode === 'LOAD') return;
  if (e.key === 'ArrowRight' && !e.repeat && st.mode === 'PLAY') step();
  if ((e.key === ' ' || e.key === 'Enter') && e.target.dataset && (e.target.dataset.k === 'slow' || e.target.dataset.k === 'fast') && !e.repeat) {
    e.preventDefault(); hold(e.target.dataset.k);
  }
});
addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') release(); });

const sel = document.getElementById('runsel');
sel.innerHTML = ix.runs.map(e => `<option value="${e.run}">${LETTERS[e.run] ? LETTERS[e.run] + ' ' : ''}${e.run}</option>`).join('');
sel.addEventListener('change', () => { drop(slots, st.slot, sel.value); runFor(sel.value); choose(st.slot); });
document.getElementById('kfr').addEventListener('input', e => {
  if (winding() || st.mode !== 'PLAY') return;
  st.target = null; st.held = 0; st.v = 0; st.kf = Number(e.target.value); st.lastWhole = Math.floor(st.kf);
  slots[st.slot].kf = st.kf; render();
});

deck.dataset.mode = 'PLAY';
const startRun = params.get('run');
if (startRun && entryOf(startRun)) drop(slots, 0, startRun);
choose(0);
if (params.has('kf')) { st.kf = clamp(cur(), Number(params.get('kf'))); st.lastWhole = Math.floor(st.kf); render(); }
D.updateKnobs();
document.getElementById('status').textContent = `${ix.runs.length} runs in the page, ${slots.length} on the bank`;
performance.mark('deck-ready');
T.timings.ready_ms = performance.measure('deck', 'deck-start', 'deck-ready').duration;
T.timings.since_navigation_ms = performance.now();
const KICK = 190;
function bindEggs() {
  const miss = e => !e.target.closest('a, button');
  const on = (sel, f) => document.querySelectorAll(sel).forEach(el => el.addEventListener('click', e => { if (miss(e)) f(el); }));
  const lp = document.querySelector('.logoplate');
  if (lp) {
    lp.addEventListener('pointerdown', e => {
      if (!miss(e) || e.button > 0) return;
      try { lp.setPointerCapture(e.pointerId); } catch (x) {   }
      SND.hold('beat', true);
    });
    for (const ev of ['pointerup', 'pointercancel']) lp.addEventListener(ev, () => SND.hold('beat', false));
    lp.addEventListener('contextmenu', e => { if (miss(e)) e.preventDefault(); });
  }
  on('.badge', () => SND.egg('zoe'));
  on('.citeplate', () => SND.egg('answer'));
  on('svg.meter', el => {
    SND.egg('glass');
    const nd = needles[el.id === 'm-run' ? 1 : 0];
    if (!reduced && Math.abs(nd.w) < 20) nd.w += KICK;
  });
}
bindEggs();
SND.bind();
T.ready = true;
requestAnimationFrame(tick);


await (async () => {
  const $ = id => document.getElementById(id);
  let zoeHold = 'off';
  let floHold = 'off';
  let floHoldKey = null, lastFloHold = '';
  const hs = { phase: 'idle', by: null, t0: 0 };

  const floEl = $('flo-data');
  let bounds, checks, floors;
  let runFile;
  if (floEl) {
    const d = JSON.parse(floEl.textContent);
    bounds = d.bounds; checks = d.checks; floors = d.floors;
    const runs = d.runs || {};
    runFile = id => Promise.resolve(Object.prototype.hasOwnProperty.call(runs, id) ? runs[id] : null);
  } else {
    const get = f => fetch('/flo/' + f).then(r => (r.ok ? r.json() : null));
    const ROOMS = ['S7', 'S36', 'S105', 'S3457'];
    const got = await Promise.all([get('bounds.json'), get('checks.json'),
      ...ROOMS.map(c => get('floor-' + c.toLowerCase() + '.json'))]);
    bounds = got[0]; checks = got[1];
    floors = Object.fromEntries(ROOMS.map((c, i) => [c, got[2 + i]]));
    const cache = new Map();
    runFile = async id => {
      if (!cache.has(id)) cache.set(id, await get('flo-' + id + '.json'));
      return cache.get(id);
    };
  }

  const flo = mountFlo({
    host: $('flo-stage'),
    width: W,
    data: { index: ix, bounds, checks, floors, runFile },
    say,
    storage: store,
    drawerIds: { drawer: 'flo-drawer', modeKey: 'flo-load', pick: 'flo-pick', syncKey: 'flo-synckey' },
    drawerOver: true,
    syncShown: true,
    hold: true,
  });
  flo.root.style.height = (flo.layout.bank[1] + flo.layout.bank[3]) + 'px';

  const T = window.__flo = { ready: false, events: [], step: 7 };
  flo.bus.on('*', (name, detail) => {
    T.events.push([name, detail]);
    if (T.events.length > 500) T.events.shift();
  });
  T.width = flo.width;
  T.marks = flo.marks;
  T.vocabulary = flo.events;
  T.ladder = flo.ladder;
  T.state = () => flo.state();
  T.readings = () => flo.readings();
  T.setSynced = v => flo.setSynced(v);
  T.setRing = v => flo.setRing(v);
  T.idle = () => flo.idle();
  T.go = s => flo.goTo(s);
  T.setWindow = w => flo.setWindow(w);
  T.setRoom = c => flo.setRoom(c);
  T.setView = v => flo.setView(v);
  T.setFloor = on => flo.setFloor(on);
  T.setDisplay = p => flo.setDisplay(p);
  T.zoomTo = s => flo.zoomTo(s);
  T.leaveZoom = () => flo.keys.zoom.click();
  T.rewind = () => flo.rewind();
  T.choose = i => flo.choose(i);
  T.bank = () => flo.bank.map(s => s.key);
  T.keys = flo.keys;
  T.drawer = flo.drawer;
  T.counter = flo.counter;

  const bare = k => String(k).replace(/^file:/, '');
  const floSlotOf = id => flo.bank.findIndex(s => bare(s.key) === id);
  const armedNow = () => hs.phase === 'synced';
  bus.on('bank-set', (name, d) => { if (armedNow() && d.by !== 'peer:flo') flo.drawer.setBank({ kind: 'run', keys: d.keys, slot: d.slot }, 'peer:zoe'); });
  flo.bus.on('bank-set', (name, d) => { if (armedNow() && d.by !== 'peer:zoe') D.setBank({ kind: 'run', keys: d.keys, slot: d.slot }, 'peer:flo'); });
  bus.on('preset', (name, detail) => {
    if (!armedNow() || flo.state().run === bare(detail.id)) return;
    const j = floSlotOf(bare(detail.id)); if (j >= 0) flo.choose(j);
  });
  flo.bus.on('preset', (name, detail) => {
    if (!armedNow() || cur().id === bare(detail.id)) return;
    const j = slots.findIndex(x => bare(x.key) === bare(detail.id)); if (j >= 0) choose(j);
  });
  bus.on('preset', () => { if (zoeHold !== 'off') endHold(); endFloHold(); });
  flo.drawer.setBank({ kind: 'run', keys: slots.map(x => x.key), slot: st.slot }, 'peer:zoe');


  bus.on('mode', (name, detail) => { if (detail.mode === 'LOAD' && flo.state().mode === 'LOAD') flo.drawer.setMode('PLAY'); });
  flo.bus.on('mode', (name, detail) => { if (detail.mode === 'LOAD' && st.mode === 'LOAD') D.setMode('PLAY'); });


  const syncKey = D.syncKey;
  syncKey.style.flex = '';
  D.drawer.querySelector('.picker').appendChild(syncKey);
  syncKey.addEventListener('click', () => press('zoe'));

  const floSync = flo.drawer.syncKey;
  floSync.style.flex = '';
  flo.drawer.drawer.querySelector('.picker').appendChild(floSync);
  floSync.addEventListener('click', () => press('flo'));

  const KEY = { zoe: syncKey, flo: floSync };
  const NAME = { zoe: 'Zoe', flo: 'Flo' };
  const other = s => (s === 'zoe' ? 'flo' : 'zoe');
  const PILOT = { zoe: document.querySelector('#deck .pilot'), flo: flo.root.querySelector('.pilot') };
  const FLOOR_MS = 500;
  function legendOf(s) {
    if (hs.phase === 'idle') return ['SYNC', false, 'off', 'propose sync with ' + NAME[other(s)]];
    if (hs.phase === 'proposed') return s === hs.by
      ? ['PENDING', true, 'slow', 'sync proposed to ' + NAME[other(s)] + '; press to withdraw']
      : ['ACCEPT', false, 'slow', 'accept ' + NAME[other(s)] + '\'s sync'];
    if (hs.phase === 'syncing') return ['SYNCING', true, 'fast', 'syncing'];
    return ['SYNCED', true, 'solid', 'synced with ' + NAME[other(s)] + '; press to release'];
  }
  function paintKeys() {
    for (const s of ['zoe', 'flo']) {
      const k = KEY[s], [word, down, lamp, aria] = legendOf(s);
      const lt = k.querySelector('.lt');
      if (lt.textContent !== word) lt.textContent = word;
      if (k.getAttribute('aria-pressed') !== String(down)) k.setAttribute('aria-pressed', String(down));
      if (k.dataset.lamp !== lamp) k.dataset.lamp = lamp;
      k.setAttribute('aria-label', aria);
      if (hs.phase === 'syncing') k.setAttribute('aria-disabled', 'true'); else k.removeAttribute('aria-disabled');
      const invited = hs.phase === 'proposed' && s !== hs.by;
      const p = PILOT[s];
      if (p && (p.dataset.invite === 'true') !== invited) {
        p.dataset.invite = String(invited);
        if (invited) { p.setAttribute('role', 'button'); p.setAttribute('tabindex', '0');
          p.setAttribute('aria-label', NAME[other(s)] + ' proposes sync: open the loader to accept'); p.removeAttribute('aria-hidden'); }
        else { p.removeAttribute('role'); p.removeAttribute('tabindex'); p.removeAttribute('aria-label'); }
      }
    }
  }
  const openTray = s => (s === 'zoe' ? D.setMode('LOAD') : flo.drawer.setMode('LOAD'));
  for (const s of ['zoe', 'flo']) {
    const p = PILOT[s]; if (!p) continue;
    const go = () => { if (p.dataset.invite === 'true') openTray(s); };
    p.addEventListener('click', go);
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  }
  function setPhase(phase, by = hs.by) { hs.phase = phase; hs.by = phase === 'idle' ? null : by; hs.t0 = performance.now(); paintKeys(); syncNow(); }
  function press(s) {
    if (hs.phase === 'syncing') return;
    if (hs.phase === 'idle') { setPhase('proposed', s); say(`${NAME[s]} proposes sync; ${NAME[other(s)]} can accept from the pilot or the loader`); return; }
    if (hs.phase === 'proposed' && s === hs.by) { setPhase('idle'); say('sync proposal withdrawn'); return; }
    if (hs.phase === 'proposed') { accept(hs.by); return; }
    if (hs.phase === 'synced') { if (zoeHold !== 'off') endHold(); endFloHold(); setPhase('idle'); say('sync released'); }
  }
  async function accept(by) {
    setPhase('syncing', by);
    const t0 = hs.t0;
    let ok = true, why = '';
    if (by === 'zoe') {
      if (flo.state().mode === 'LOAD') flo.drawer.setMode('PLAY');
      if (!flo.drawer.setBank({ kind: 'run', keys: slots.map(x => x.key), slot: st.slot }, 'peer:zoe')) { ok = false; why = 'Flo refused Zoe\'s library'; }
      const until = performance.now() + 4000;
      while (ok && !floOnZoesRun() && performance.now() < until) await new Promise(r => setTimeout(r, 50));
      if (ok && !floOnZoesRun()) { ok = false; why = 'Flo cannot read this run: the page carries no Flo reading for it'; }
    } else {
      const k = flo.state().k || 0, fs = flo.state().slot;
      if (st.mode === 'LOAD') D.setMode('PLAY');
      if (!D.setBank({ kind: 'run', keys: flo.bank.map(x => x.key), slot: fs }, 'peer:flo')) { ok = false; why = 'Zoe refused Flo\'s library'; }
      else if (cur().id !== bare(flo.bank[fs].key)) { ok = false; why = 'Zoe does not hold this run'; }
      else { finishWind(); st.held = 0; st.target = null; st.v = 0;
        st.kf = clamp(cur(), k); st.lastWhole = Math.floor(st.kf); slots[st.slot].kf = st.kf; render(); }
    }
    const wait = FLOOR_MS - (performance.now() - t0);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    if (hs.phase !== 'syncing' || hs.t0 !== t0) return;
    if (ok) { setPhase('synced'); say(`Zoe and Flo synced at ${headSession() ? 'S' + headSession() : 'the leader'}`); }
    else { setPhase('idle'); say('sync failed: ' + why); }
  }

  const zoeRing = document.createElement('i');
  zoeRing.className = 'ring';
  zoeRing.setAttribute('aria-hidden', 'true');
  zoeRing.setAttribute('data-ring', 'none');
  document.querySelector('#deck .pilot').appendChild(zoeRing);

  const headSession = () => at(cur(), st.kf).head.session;
  const floOnZoesRun = () => { const s = flo.state(); return s.loaded && s.run === cur().id; };
  function computeSync() {
    const armed = armedNow();
    const synced = armed && st.mode === 'PLAY' && flo.state().mode === 'PLAY' && floOnZoesRun();
    const ring = hs.phase === 'idle' ? 'none' : (hs.phase === 'synced' ? 'whole' : 'broken');
    return { armed, synced, ring };
  }
  let lastSynced = null, lastRing = null;
  function applySync(synced, ring) {
    if (synced !== lastSynced) { flo.setSynced(synced); lastSynced = synced; }
    if (ring !== lastRing) { flo.setRing(ring); zoeRing.dataset.ring = ring; lastRing = ring; }
  }
  function followOnce() {
    const target = headSession();
    if (flo.state().k !== target) { flo.counter.forgetSetting(); flo.goTo(target); }
  }
  function syncNow() {
    const c = computeSync();
    if (!c.synced && zoeHold !== 'off') endHold();
    if (!c.synced && floHold !== 'off') endFloHold();
    const locked = c.synced && zoeHold === 'off';
    applySync(locked, c.ring);
    const synced = locked && floHold === 'off';
    if (synced) followOnce();
    paintHold(c.synced);
    paintFloHold(c.synced);
  }

  let holdKey = null;
  {
    holdKey = document.createElement('button');
    holdKey.type = 'button';
    holdKey.dataset.k = 'hold';
    holdKey.setAttribute('aria-label', 'hold Zoe where she stands while Flo moves on her own');
    holdKey.setAttribute('aria-pressed', 'false');
    holdKey.setAttribute('aria-disabled', 'true');
    holdKey.innerHTML = `<i class="ic" aria-hidden="true">${ICO('M3 0h3v8H3zM10 0h3v8h-3z')}</i><span class="kl">HOLD</span>`;
    C.keys.replaceChildren(holdKey, C.keyEls.locate, C.keyEls.cue);
    C.keys.dataset.bank = '';
    holdKey.addEventListener('click', pressHold);
  }
  function pressHold() {
    if (holdKey.getAttribute('aria-disabled') === 'true') {
      say(st.mode !== 'PLAY' ? 'HOLD works in PLAY' : floHold !== 'off' ? 'HOLD: Flo is holding; release her HOLD first' : 'HOLD needs Zoe and Flo synced: press SYNC in either loader');
      return;
    }
    if (zoeHold === 'off') {
      st.held = 0; st.target = null; st.v = 0; finishWind();
      st.frozen = true; zoeHold = 'held';
      syncNow();
      const s = headSession();
      say(`Zoe holds at ${s ? 'S' + s : 'the leader'}; Flo moves on her own`);
    } else if (zoeHold === 'held') {
      st.frozen = false; zoeHold = 'rejoining';
      syncNow();
      const k = flo.state().k || 0;
      say(`Zoe winds to Flo at ${k ? 'S' + k : 'the leader'}`);
      wind(k, 'hold');
    }
  }
  bus.on('locate-done', () => { if (zoeHold === 'rejoining') { zoeHold = 'off'; syncNow(); } });
  function endHold() { zoeHold = 'off'; st.frozen = false; }
  let lastHold = '';
  function paintHold(synced) {
    if (!holdKey) return;
    const frozen = zoeHold === 'held';
    if (C.keyEls.cue.disabled !== frozen) C.keyEls.cue.disabled = frozen;
    if (C.keyEls.locate.disabled !== frozen) C.keyEls.locate.disabled = frozen;
    const can = (synced && floHold === 'off') || zoeHold !== 'off', on = zoeHold !== 'off';
    const key = can + ':' + on;
    if (key === lastHold) return;
    lastHold = key;
    holdKey.setAttribute('aria-disabled', String(!can));
    holdKey.setAttribute('aria-pressed', String(on));
  }

  function announceClose() {
    requestAnimationFrame(() => {
      if (armedNow()) {
        const s = headSession();
        say(s ? `Flo follows Zoe at S${s}` : 'Flo follows Zoe at the leader');
      } else {
        const k = flo.state().k;
        say(k ? `Flo holds S${k}` : 'Flo holds the leader');
      }
    });
  }

  bus.on('mode', (name, detail) => {
    if (detail.mode === 'LOAD') syncNow();
    else if (detail.mode === 'PLAY') { syncNow(); announceClose(); }
  });

  window.__pair = window.__pair || {};
  window.__pair.sync = () => {
    const { armed, synced, ring } = computeSync();
    return { armed, synced, ring, zoe: headSession(), flo: flo.state().k, mode: st.mode, hold: zoeHold, floHold, phase: hs.phase, by: hs.by };
  };

  setPhase('synced', 'zoe');
  syncNow();

  window.__pair = window.__pair || {};
  window.__pair.load = id => {
    const rest = ix.runs.map(r => r.run).filter(r => r !== id).slice(0, 5);
    return D.setBank({ kind: 'run', keys: [id, ...rest], slot: 0 }, 'check');
  };

  floHoldKey = flo.keys.hold;
  if (floHoldKey) {
    floHoldKey.id = 'flo-hold';
    floHoldKey.setAttribute('aria-label', 'hold Flo where she stands while Zoe plays on');
    floHoldKey.addEventListener('click', pressFloHold);
  }
  function pressFloHold() {
    if (floHoldKey.getAttribute('aria-disabled') === 'true') {
      say(zoeHold !== 'off' ? 'HOLD: Zoe is holding; release her HOLD first' : 'HOLD needs Zoe and Flo synced: press SYNC in either loader');
      return;
    }
    if (floHold === 'off') {
      floHold = 'held'; syncNow();
      const k = flo.state().k;
      say(`Flo holds at ${k ? 'S' + k : 'the leader'}; Zoe plays on`);
    } else {
      floHold = 'off'; syncNow();
      const z = headSession();
      say(`Flo rejoins Zoe at ${z ? 'S' + z : 'the leader'}`);
    }
  }
  function endFloHold() { floHold = 'off'; }
  function paintFloHold(synced) {
    if (!floHoldKey) return;
    const can = (synced && zoeHold === 'off') || floHold !== 'off', on = floHold !== 'off';
    const k = can + ':' + on;
    if (k === lastFloHold) return;
    lastFloHold = k;
    floHoldKey.setAttribute('aria-disabled', String(!can));
    floHoldKey.classList.toggle('dark', !can);
    floHoldKey.setAttribute('aria-pressed', String(on));
  }

  const bridgeFlo = $('bridge-flo');
  const bridgeZoe = $('bridge-zoe');
  const mk = (tag, cls, parent, attrs) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  const fParts = mk('div', 'bparts', bridgeFlo, { 'aria-hidden': 'true' });
  const fCols = mk('div', 'bcols', fParts);
  const fColEls = [];
  for (let i = 0; i < 16; i++) {
    const c = mk('div', 'bcol', fCols, { 'data-col': String(i) });
    c._up = mk('i', 'bbar up', c);
    c._dn = mk('i', 'bbar down', c);
    c._sq = mk('i', 'bsq', c);
    fColEls.push(c);
  }
  const fLamps = {};
  const fLampRow = mk('div', 'blamps', fParts);
  for (const s of ['refused', 'malformed', 'begun']) {
    fLamps[s] = mk('i', 'blamp', fLampRow, { 'data-status': s, 'data-lit': 'false',
      'aria-label': s });
  }
  const fSync = mk('i', 'bsync', fParts, { 'data-ring': 'none', 'aria-label': 'sync' });
  const fSess = mk('span', 'bsess', fParts, { 'data-session': '' });

  function paintBridgeFlo() {
    const rd = flo.readings();
    const s = flo.state();
    const gate = rd ? rd.gate.slots : null;
    for (let i = 0; i < 16; i++) {
      const c = fColEls[i];
      const g = gate ? gate[i] : null;
      const dark = !g || g.dark;
      const lit = g && g.rungs.lit !== null ? g.rungs.lit : 0;
      const censored = !!(g && g.censored);
      c.dataset.dark = String(dark);
      c.dataset.lit = String(lit);
      c.dataset.over = String(!!(g && g.rungs.over));
      c.dataset.under = String(!!(g && g.rungs.under));
      c.dataset.censored = String(censored);
      const frac = Math.min(1, Math.abs(lit) / 10);
      c._up.style.height = (!dark && lit > 0 ? frac * 18 : 0) + 'px';
      c._dn.style.height = (!dark && lit < 0 ? frac * 18 : 0) + 'px';
      c._sq.hidden = !censored;
    }
    for (const st2 of ['refused', 'malformed', 'begun']) {
      const on = !!(rd && rd.moment && rd.moment.lamps[st2]);
      fLamps[st2].dataset.lit = String(on);
      fLamps[st2].classList.toggle('on', on);
    }
    fSync.dataset.ring = s.ring;
    fSess.hidden = s.synced;
    fSess.dataset.session = String(s.k ?? 0);
    fSess.textContent = 'S' + (s.k ?? 0);
  }

  const zParts = mk('div', 'bparts', bridgeZoe, { 'aria-hidden': 'true' });
  const zWin = mk('div', 'bwin', zParts);
  const zCount = mk('span', 'bcount', zParts, { 'data-wheels': '' });
  const zSync = mk('i', 'bsync', zParts, { 'data-ring': 'none', 'aria-label': 'sync' });
  const zKeys = mk('div', 'bkeys', bridgeZoe);
  const KEYLABELS = { rewind: 'REWIND', step: 'STEP', slow: 'SLOW', fast: 'FAST' };
  const zoeBtn = k => document.querySelector('#deck button[data-k="' + k + '"]');
  for (const k of ['rewind', 'step', 'slow', 'fast']) {
    const b = mk('button', 'bkey', zKeys, { type: 'button', 'data-k': k,
      'aria-label': KEYLABELS[k].toLowerCase() });
    b.textContent = KEYLABELS[k];
    if (k === 'rewind' || k === 'step') {
      b.addEventListener('click', () => { const z = zoeBtn(k); if (z && !z.disabled) z.click(); });
    } else {
      b.addEventListener('pointerdown', () => { const z = zoeBtn(k);
        if (z && !z.disabled) z.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
      const up = () => { const z = zoeBtn(k);
        if (z) window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
    }
  }

  let zWinKey = null;
  function paintBridgeZoe() {
    const run = cur();
    const h = at(run, st.kf).head;
    const key = slots[st.slot].key + ':' + h.k + ':' + st.lifted;
    if (key !== zWinKey) {
      zWin.innerHTML = [h.k - 1, h.k, h.k + 1, h.k + 2].map((s, i) => {
        const pic = s >= 1 && s <= run.N + 1 ? face(run, s, { held: true }).svg : '';
        return '<div class="brow' + (i === 1 ? ' head' : '') + '">' + pic + '</div>';
      }).join('');
      zWinKey = key;
    }
    const wheels = [...document.querySelectorAll('#deck .wheel')].map(w => w.textContent).join('');
    zCount.dataset.wheels = wheels;
    zCount.textContent = wheels + '/' + run.N;
    zSync.dataset.ring = flo.state().ring;
  }

  const vh = () => window.innerHeight || document.documentElement.clientHeight;
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.target.id === 'flo') {
        const offAbove = !e.isIntersecting && e.boundingClientRect.bottom <= 0;
        bridgeFlo.hidden = !offAbove;
      } else if (e.target.id === 'deck') {
        const offBelow = !e.isIntersecting && e.boundingClientRect.top >= vh();
        bridgeZoe.hidden = !offBelow;
      }
    }
  }, { threshold: 0 });
  io.observe($('flo'));
  io.observe($('deck'));

  function bridgeTick() {
    syncNow();
    if (!bridgeFlo.hidden) paintBridgeFlo();
    if (!bridgeZoe.hidden) paintBridgeZoe();
    requestAnimationFrame(bridgeTick);
  }
  paintBridgeFlo();
  paintBridgeZoe();
  requestAnimationFrame(bridgeTick);

  {
    const SND = window.__deck.sound;
    const cue = role => SND.hear('flo:' + role, {});
    const s0 = flo.state();
    let last = { view: s0.view, display: s0.display, floor: s0.floorIn ? 'FLOOR IN' : 'BYPASS', window: s0.window };
    const changed = (k, v) => { const c = last[k] !== v; last[k] = v; return c; };
    flo.bus.on('*', (name, d) => {
      if (name === 'view') { if (changed('view', d.view)) cue(d.view === 'POSITION' ? 'view-position' : 'view-returns'); }
      else if (name === 'display') { if (changed('display', d.position)) cue(d.position === 'NUMBERS' ? 'display-numbers' : 'display-history'); }
      else if (name === 'floor') { if (changed('floor', d.floor)) cue(d.floor === 'FLOOR IN' ? 'chirp-on' : 'chirp-off'); }
      else if (name === 'window') { if (changed('window', d.window)) cue('gate-' + d.window); }
      else if (name === 'peak' || name === 'solo') cue(d.on ? 'chirp-on' : 'chirp-off');
      else if (name === 'zoom') cue('zoom-in');
      else if (name === 'zoom-leave' && d.by === 'zoom') cue('zoom-out');
    });

    let floAfterLoad = false;
    flo.bus.on('*', (name, d) => {
      if (!DRAWER_EVENTS.includes(name)) return;
      if (name === 'load-done') floAfterLoad = true;
      if (name === 'preset' && floAfterLoad) { floAfterLoad = false; return; }
      if (name === 'preset' && armedNow()) return;
      SND.hear(name, d);
    });

    const badge = flo.root.querySelector('.badge');
    if (badge) badge.addEventListener('click', () => SND.egg('flo-voice'));

    const floEgg = flo.root;
    const miss = e => !e.target.closest('a, button');
    const flp = floEgg.querySelector('.logoplate');
    if (flp) {
      flp.addEventListener('pointerdown', e => {
        if (!miss(e) || e.button > 0) return;
        try { flp.setPointerCapture(e.pointerId); } catch (x) {   }
        SND.hold('beat', true);
      });
      for (const ev of ['pointerup', 'pointercancel']) flp.addEventListener(ev, () => SND.hold('beat', false));
      flp.addEventListener('contextmenu', e => { if (miss(e)) e.preventDefault(); });
    }
    for (const plate of floEgg.querySelectorAll('.citeplate:not(.small), .doistrip')) {
      plate.addEventListener('click', e => { if (miss(e)) SND.egg('answer'); });
    }

    const zsnd = document.querySelector('#deck button.snd'), fsnd = flo.root.querySelector('.snd');
    if (zsnd && fsnd) {
      fsnd.removeAttribute('aria-hidden');
      fsnd.setAttribute('role', 'button'); fsnd.tabIndex = 0; fsnd.style.cursor = 'pointer';
      const svg = fsnd.querySelector('svg'), arc = svg.querySelector('.on');
      const cross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      cross.setAttribute('class', 'off'); cross.setAttribute('d', 'M9.6 3.5l4 4M13.6 3.5l-4 4');
      cross.setAttribute('fill', 'none'); cross.setAttribute('stroke', 'currentColor');
      cross.setAttribute('stroke-width', '1.3'); cross.setAttribute('stroke-linecap', 'round');
      svg.appendChild(cross);
      const show = () => {
        const on = zsnd.getAttribute('aria-pressed') !== 'false';
        fsnd.setAttribute('aria-pressed', String(on));
        fsnd.setAttribute('aria-label', zsnd.getAttribute('aria-label') || (on ? 'sound on' : 'sound off'));
        if (arc) arc.style.display = on ? '' : 'none';
        cross.style.display = on ? 'none' : '';
      };
      fsnd.addEventListener('click', () => zsnd.click());
      fsnd.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); zsnd.click(); } });
      new MutationObserver(show).observe(zsnd, { attributes: true, attributeFilter: ['aria-pressed'] });
      show();
    }
  }
  window.__pair.width = W;
  window.__pair.ready = true;
  T.ready = true;
})();

