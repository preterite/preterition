

const FEE_SCHEMAS = ['rack-bus-1.0'];

const FEE_GROUPS = Object.freeze([
  Object.freeze({ group: 'None', positions: Object.freeze(['NONE']) }),
  Object.freeze({ group: 'Letter', positions: Object.freeze(['LETTER', 'NONE+LTR', 'DIARY+LTR']) }),
  Object.freeze({ group: 'Diary', positions: Object.freeze(['DIARY']) }),
  Object.freeze({ group: 'Chat', positions: Object.freeze(['CHAT']) }),
  Object.freeze({ group: 'Accumulative', positions: Object.freeze(['ACCUM']) }),
]);

const FEE_RANGES = Object.freeze(['2bm1', '2b']);

const FEE_SCALES = Object.freeze({
  bend: Object.freeze({ min: -0.3802, max: 2.3603, unit: 'bits', zeroAtRoom: 0 }),

  distortion: Object.freeze({
    '2bm1': Object.freeze({ min: -0.2317, max: 4.1348, zeroAtRoom: 0, live: true,
                            label: '2 ** bend - 1' }),
    '2b': Object.freeze({ min: 0.7683, max: 5.1348, zeroAtRoom: 1, live: false,
                          label: '2 ** bend' }),
  }),

  c: Object.freeze({ min: 0, max: 1, unit: 'share of words', declared: true }),
  c_writing: Object.freeze({ min: 0, max: 1, unit: 'share of words', declared: true }),

  nixies: Object.freeze({
    runs: Object.freeze({ tubes: 2, counts: 'the baseline runs behind the printed marks' }),
    returns: Object.freeze({ tubes: 3, counts: 'the search returns so far on the selected block' }),
  }),
});

const FEE_ASKS = Object.freeze({
  LETTER: 'one A', 'NONE+LTR': 'one A', 'DIARY+LTR': 'one A', CHAT: 'one A',
  DIARY: 'path', ACCUM: 'path',
});

const FEE_FAILED = Object.freeze(['refused', 'malformed', 'begun']);

function feeRound4(x) {
  return x === null || x === undefined || !Number.isFinite(x) ? null : Number(x.toFixed(4));
}

function feeMedian(xs) {
  const s = xs.filter(x => x !== null && x !== undefined).sort((a, b) => a - b);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
}


function makeFeeRoom(json) {
  if (!FEE_SCHEMAS.includes(json.schema_version)) {
    throw new Error(`schema ${json.schema_version} is not one this model reads`);
  }
  for (const r of json.runs) {
    if (r.series.session.length !== r.N) {
      throw new Error(`${r.run}: ${r.series.session.length} sessions against N ${r.N}`);
    }
  }
  const byId = new Map(json.runs.map(r => [r.run, r]));
  if (byId.size !== json.runs.length) throw new Error(`${json.corpus}: a run id twice`);
  return {
    corpus: json.corpus,
    roomHash: json.room ? json.room.room_hash : null,
    roomPackage: json.room ? json.room.package : null,
    positionsPresent: json.positions_present,
    nonePresent: json.none_present,
    baselineCell: json.baseline_cell,
    zero: json.zero,
    caption: json.caption ?? null,
    roomSentence: json.room_sentence ?? null,
    roomSentenceNote: json.room_sentence_note ?? null,
    runs: json.runs,
    runById: byId,
    nulls: json.nulls,
    checks: json.checks,
    limits: json.limits,
    caveats: json.caveats,
  };
}

function feeBlocks(room) {
  const out = [];
  let index = 0;
  for (let g = 0; g < FEE_GROUPS.length; g++) {
    for (const position of FEE_GROUPS[g].positions) {
      const present = room.positionsPresent.includes(position);
      const pooled = room.checks.pooled[position];
      out.push({
        index: index++,
        group: FEE_GROUPS[g].group,
        groupIndex: g,
        position,
        present,
        dark: !present,
        reason: present ? null : `no ${position} run in ${room.corpus}`,
        runs: pooled ? pooled.runs : null,
        hasMarkedView: Object.prototype.hasOwnProperty.call(room.checks.pooled, `${position}|marked`),
        asks: FEE_ASKS[position] ?? null,
      });
    }
  }
  return out;
}

function feeBank(room, form = '2bm1') {
  return {
    corpus: room.corpus,
    roomHash: room.roomHash,
    positionsPresent: room.positionsPresent,
    nonePresent: room.nonePresent,
    curves: room.nonePresent,
    curvesReason: room.nonePresent ? null
      : `${room.corpus} has no NONE run: the six have nothing to be measured against, ` +
        'and the curves go with it',
    form,
    scale: feeScale(form),
    bendScale: FEE_SCALES.bend,
    blocks: feeBlocks(room),
  };
}


function feePooled(room, position) {
  const sel = room.runs.filter(r => r.position === position && r.baseline);
  if (!sel.length) return null;
  const ticks = sel.map(r => ({
    run: r.run,
    bend: r.whole_run.bend,
    c: r.whole_run.c_median,
    cWriting: r.whole_run.c_writing_median,
    n: r.whole_run.n,
    nullSd: r.whole_run.null_sd,
  }));
  const bends = ticks.map(t => t.bend);
  return {
    position,
    view: 'baseline',
    runs: sel.length,
    ticks,
    bendMedian: feeRound4(feeMedian(bends)),
    bendMin: Math.min(...bends),
    bendMax: Math.max(...bends),
    cMedian: feeRound4(feeMedian(ticks.map(t => t.c))),
    cMedianReason: null,
    cWritingMedian: position === 'CHAT' ? feeRound4(feeMedian(ticks.map(t => t.cWriting))) : null,
  };
}

function feeMarked(room, position = 'LETTER') {
  const sel = room.runs.filter(r => r.position === position && !r.baseline);
  if (!sel.length) return null;
  const ticks = sel.map(r => ({
    run: r.run, bend: r.whole_run.bend, c: r.whole_run.c_median, n: r.whole_run.n, N: r.N,
    knobs: r.knobs,
  }));
  const bends = ticks.map(t => t.bend);
  return {
    position,
    view: 'marked',
    m: sel.length,
    runs: sel.length,
    ticks,
    bendMedian: feeRound4(feeMedian(bends)),
    bendMin: Math.min(...bends),
    bendMax: Math.max(...bends),
    cMedian: feeRound4(feeMedian(ticks.map(t => t.c))),
    cWritingMedian: null,
    heterogeneous: true,
    Ns: [...new Set(ticks.map(t => t.N))].sort((a, b) => a - b),
  };
}

function feeBlockOf(room, runId) {
  const r = room.runById.get(runId);
  if (!r) throw new Error(`${runId} is not a run of ${room.corpus}`);
  return {
    run: r.run,
    position: r.position,
    baseline: r.baseline,
    view: r.view,
    marked: r.view === 'marked',
    N: r.N,
    knobs: r.knobs,
  };
}


function feeDistortion(bend, form = '2bm1') {
  if (!FEE_RANGES.includes(form)) throw new Error(`${form} is not a Range position`);
  if (bend === null || bend === undefined || !Number.isFinite(bend)) return null;
  return form === '2b' ? 2 ** bend : 2 ** bend - 1;
}

function feeScale(form = '2bm1') {
  if (!FEE_RANGES.includes(form)) throw new Error(`${form} is not a Range position`);
  return FEE_SCALES.distortion[form];
}

function feeLive(room, runId, session, form = '2bm1') {
  const r = room.runById.get(runId);
  if (!r) throw new Error(`${runId} is not a run of ${room.corpus}`);
  const atLeader = session === null || session === undefined;
  const lamps = {};
  for (const f of FEE_FAILED) lamps[f] = false;
  const out = {
    run: r.run, position: r.position, view: r.view, corpus: room.corpus,
    session: atLeader ? null : session, N: r.N, atLeader, form,
    scale: feeScale(form), bendScale: FEE_SCALES.bend, cScale: FEE_SCALES.c,
    bend: null, distortion: null, nullSd: null, detent: null, detentDistortion: null,
    inDetent: null,
    c: null, cReason: null, cWriting: null, cWritingReason: null,
    n: null, status: null, lamps, failed: false,
    failedSinceS1: null, predecessorMalformed: null,
    parked: true,
    parkedReason: 'a needle at rest lies below its scale\'s zero, crossed with its pair, '
      + 'at its full length and at the live needle\'s width in a lighter grey, with no pin',
  };
  if (atLeader) return out;
  if (!Number.isInteger(session) || session < 1 || session > r.N) {
    throw new Error(`${runId}: S${session} is outside 1 .. ${r.N}`);
  }
  const s = r.series, i = session - 1;
  const bend = s.bend_cum[i];
  const nullSd = s.null_sd_cum[i];
  out.bend = bend;
  out.distortion = feeDistortion(bend, form);
  out.nullSd = nullSd;
  out.detent = nullSd === null ? null : { lo: -2 * nullSd, hi: 2 * nullSd };
  out.detentDistortion = nullSd === null ? null
    : { lo: feeDistortion(-2 * nullSd, form), hi: feeDistortion(2 * nullSd, form) };
  out.inDetent = bend === null || nullSd === null ? null : Math.abs(bend) <= 2 * nullSd;
  out.c = s.c[i];
  out.cReason = s.c[i] === null
    ? (session === 1 ? room.caveats.c_first_session : 'c-series.csv holds no row for this session')
    : null;
  out.cWriting = r.position === 'CHAT' ? s.c_writing[i] : null;
  out.cWritingReason = r.position === 'CHAT'
    ? (s.c_writing[i] === null
        ? (session === 1 ? room.caveats.c_first_session : 'c-series.csv holds no row for this session')
        : null)
    : 'c_writing stands beside c on CHAT alone';
  out.n = s.n_cum[i];
  out.status = s.status[i];
  for (const f of FEE_FAILED) out.lamps[f] = s.status[i] === f;
  out.failed = s.status[i] !== 'submitted';
  let failedSoFar = 0;
  for (let k = 0; k <= i; k++) if (s.status[k] !== 'submitted') failedSoFar++;
  out.failedSinceS1 = failedSoFar;
  out.predecessorMalformed = s.predecessor_malformed[i];
  out.parked = out.bend === null && out.c === null;
  out.parkedReason = out.parked ? out.parkedReason : null;
  out.counts = {
    totalWords: s.total_words[i], predWritten: s.pred_written[i],
    carriedReturns: s.carried_returns[i], returnedWords: s.returned_words[i],
  };
  return out;
}

function feePeak(room, runId, session, form = '2bm1') {
  const r = room.runById.get(runId);
  if (!r) throw new Error(`${runId} is not a run of ${room.corpus}`);
  const atLeader = session === null || session === undefined;
  if (atLeader) {
    return { run: r.run, session: null, atLeader: true, form, scale: feeScale(form),
             peak: null, atSession: null, distortion: null };
  }
  if (!Number.isInteger(session) || session < 1 || session > r.N) {
    throw new Error(`${runId}: S${session} is outside 1 .. ${r.N}`);
  }
  let peak = null, at = null;
  for (let k = 1; k <= session; k++) {
    const v = r.series.bend_cum[k - 1];
    if (v === null) continue;
    if (peak === null || v > peak) { peak = v; at = k; }
  }
  return {
    run: r.run, session, atLeader: false, form, scale: feeScale(form),
    peak, atSession: at, distortion: feeDistortion(peak, form),
  };
}


function feeImpliedA(room, position, cVariant = 'c') {
  const label = cVariant === 'c_writing' ? 'beside'
    : (FEE_ASKS[position] ?? 'not named in the request');
  const out = {
    position, cVariant, asks: label,
    c: null, B_NONE: null, B_pos: null, A_en: null, reason: null,
  };
  if (!room.nonePresent) {
    out.reason = `${room.corpus} has no NONE run: implied A stands only where the room has NONE`;
    return out;
  }
  const none = feePooled(room, 'NONE');
  const pos = feePooled(room, position);
  if (!pos) { out.reason = `no ${position} run at the baseline cell in ${room.corpus}`; return out; }
  if (position === 'NONE') { out.reason = 'NONE is what the others are measured against'; return out; }
  const bn = none.bendMedian;
  const bp = pos.bendMedian;
  const c = cVariant === 'c_writing' ? pos.cWritingMedian : pos.cMedian;
  out.B_NONE = bn;
  out.B_pos = bp;
  out.c = c;
  if (c === null) { out.reason = `${position} carries no pooled ${cVariant}`; return out; }
  if (c === 0) { out.reason = room.caveats.c_zero; return out; }
  if (!(bp > 0)) { out.reason = `B_pos ${bp} is at or below 0: A is undefined there`; return out; }
  if (!(bn > 0)) { out.reason = `B_NONE ${bn} is at or below 0: A is undefined there`; return out; }
  const R = (2 ** bn - 1) / (2 ** bp - 1);
  out.A_en = feeRound4((Math.sqrt(R) - 1) / c);
  out.floor = feeRound4(-1 / c);
  return out;
}

function feeCurve(room, A, form = '2bm1') {
  if (!FEE_RANGES.includes(form)) throw new Error(`${form} is not a Range position`);
  if (!room.nonePresent) return null;
  const bn = feePooled(room, 'NONE').bendMedian;
  const dNONE = 2 ** bn - 1;
  const shift = form === '2b' ? 1 : 0;
  return {
    A, form, B_NONE: bn, dNONE,
    scale: feeScale(form),
    domain: A >= 0 ? { from: 0, to: 1, whole: true }
                   : { from: 0, to: Math.min(1, -1 / A), whole: -1 / A > 1 },
    at(c) {
      if (c === null || c === undefined || !Number.isFinite(c)) return null;
      const k = 1 + A * c;
      if (!(k > 0)) return null;
      return dNONE / (k * k) + shift;
    },
  };
}

function feeCrossingA(room, bend, c) {
  const out = { bend, c, B_NONE: null, A_en: null, reason: null };
  if (!room.nonePresent) {
    out.reason = `${room.corpus} has no NONE run: no curve family stands`;
    return out;
  }
  const bn = feePooled(room, 'NONE').bendMedian;
  out.B_NONE = bn;
  if (c === null || c === undefined || !Number.isFinite(c)) { out.reason = 'c has no value here'; return out; }
  if (c === 0) { out.reason = room.caveats.c_zero; return out; }
  if (bend === null || bend === undefined || !Number.isFinite(bend)) { out.reason = 'bend has no value here'; return out; }
  if (!(bend > 0)) { out.reason = `bend ${bend} is at or below 0: A is undefined there`; return out; }
  if (!(bn > 0)) { out.reason = `B_NONE ${bn} is at or below 0: A is undefined there`; return out; }
  out.A_en = (Math.sqrt((2 ** bn - 1) / (2 ** bend - 1)) - 1) / c;
  return out;
}

function feePath(room, position, form = '2bm1') {
  const sel = room.runs.filter(r => r.position === position && r.baseline);
  if (!sel.length) return null;
  return {
    position,
    asks: FEE_ASKS[position] ?? 'not named in the request',
    form,
    scale: feeScale(form),
    runs: sel.map(r => ({
      run: r.run,
      points: r.series.session.slice(1).map((k, j) => {
        const i = j + 1;
        return {
          session: k,
          bend: r.series.bend_cum[i],
          distortion: feeDistortion(r.series.bend_cum[i], form),
          c: r.series.c[i],
          cWriting: position === 'CHAT' ? r.series.c_writing[i] : null,
        };
      }),
    })),
  };
}


function feeRankNull(room, position, view = 'baseline') {
  if (view !== 'baseline' && view !== 'marked') throw new Error(`${view} is not a view`);
  const out = { position, view, m: null, n_none: null, U: null, U_max: null,
                p: null, floor: null, all_below: null, floorAbove05: null, reason: null };
  if (!room.nonePresent) {
    out.reason = `${room.corpus} has no NONE run: the null stands against NONE`;
    return out;
  }
  if (position === 'NONE') { out.reason = 'NONE is what the others are tested against'; return out; }
  const none = room.runs.filter(r => r.position === 'NONE' && r.baseline)
    .map(r => r.whole_run.bend).sort((a, b) => a - b);
  const pos = room.runs.filter(r => r.position === position
    && (view === 'baseline' ? r.baseline : !r.baseline))
    .map(r => r.whole_run.bend).sort((a, b) => a - b);
  if (!pos.length) { out.reason = `no ${position} run in the ${view} view of ${room.corpus}`; return out; }

  const pooled = [...pos, ...none];
  const nAll = pooled.length, m = pos.length;
  const uOf = idx => {
    const inA = new Array(nAll).fill(false);
    for (const i of idx) inA[i] = true;
    let u = 0;
    for (let i = 0; i < nAll; i++) {
      if (!inA[i]) continue;
      for (let j = 0; j < nAll; j++) {
        if (inA[j]) continue;
        u += pooled[i] < pooled[j] ? 1 : pooled[i] === pooled[j] ? 0.5 : 0;
      }
    }
    return u;
  };
  const obs = uOf(Array.from({ length: m }, (_, i) => i));
  const idx = Array.from({ length: m }, (_, i) => i);
  let total = 0, hits = 0;
  for (;;) {
    total++;
    if (uOf(idx) >= obs - 1e-12) hits++;
    let i = m - 1;
    while (i >= 0 && idx[i] === nAll - m + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < m; j++) idx[j] = idx[j - 1] + 1;
  }
  out.m = m;
  out.n_none = none.length;
  out.U = obs;
  out.U_max = m * none.length;
  out.p = feeRound4(hits / total);
  out.floor = feeRound4(1 / total);
  out.all_below = pos.every(x => x < none[0]);
  out.floorAbove05 = out.floor > 0.05;
  out.relabellings = total;
  return out;
}


function feeSustain(room, position, view = 'baseline') {
  if (view !== 'baseline' && view !== 'marked') throw new Error(`${view} is not a view`);
  const key = view === 'marked' ? `${position}|marked` : position;
  const rows = room.checks.sustain[key];
  if (!rows) {
    return { position, view, key, rows: null,
             reason: `${room.corpus} carries no sustain for ${key}` };
  }
  return {
    position, view, key, reason: null,
    lags: rows.length,
    rows: rows.map(r => {
      const above = r.against_band === 'above';
      const within = r.against_band === 'within';
      const below = r.against_band === 'below';
      return {
        k: r.k,
        D: r.D,
        N: r.N,
        rate: r.rate,
        excessExact: r.excess_exact,
        bandLo: r.band_lo,
        bandHi: r.band_hi,
        againstBand: r.against_band,
        lit: above,
        sunken: within || below,
        belowBand: below,
        minus: below,
        state: above ? 'lit' : within ? 'sunken' : 'below',
        stateReason: null,
      };
    }),
    above: rows.filter(r => r.against_band === 'above').map(r => r.k),
    within: rows.filter(r => r.against_band === 'within').map(r => r.k),
    below: rows.filter(r => r.against_band === 'below').map(r => r.k),
  };
}

function feeNixies(room, position, runId = null, session = null) {
  const sel = runId === null ? null : feeBlockOf(room, runId);
  const marked = sel !== null && sel.marked && sel.position === position;
  const view = marked ? 'marked' : 'baseline';
  const pooled = marked ? feeMarked(room, position) : feePooled(room, position);
  const selected = sel !== null && sel.position === position;
  let returns = null;
  if (selected && session !== null && session !== undefined) {
    const r = room.runById.get(runId);
    if (!Number.isInteger(session) || session < 1 || session > r.N) {
      throw new Error(`${runId}: S${session} is outside 1 .. ${r.N}`);
    }
    returns = r.series.n_cum[session - 1];
  }
  return {
    position,
    view,
    selected,
    runs: pooled ? (marked ? pooled.m : pooled.runs) : null,
    returns,
    returnsLit: returns !== null,
    tubes: FEE_SCALES.nixies,
    runsFits: pooled === null ? null
      : String(marked ? pooled.m : pooled.runs).length <= FEE_SCALES.nixies.runs.tubes,
    returnsFits: returns === null ? null
      : String(returns).length <= FEE_SCALES.nixies.returns.tubes,
  };
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
                    `${floorFile ? floorFile.corpus : 'nothing'}: a run is read `
                    + `against its own room's floor and no other`);
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
    roomAloneAbsent: 'no per-source room count across sources exists in the files, ' +
                     'the weights being normalized within a source; zero bits is ' +
                     'ROOM ALONE on the ladder',
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



function mountFee(cfg) {
  const {
    host,
    width = 1100,
    data,
    say = () => {},
    storage = null,
    drawerIds = {},
    syncShown = true,
    hold: holdOpt = false,
  } = cfg;

  const FEE_EVENTS = Object.freeze([...DRAWER_EVENTS, ...COUNTER_EVENTS,
    'fee-load',
    'fee-step',
    'fee-rewind',
    'fee-range',
    'fee-peak',
    'fee-dark',
    'fee-screen',
    'fee-trace',
  ]);
  const bus = makeChannel(FEE_EVENTS);
  const emit = (name, detail = {}) => bus.emit(name, detail);


  const noLeadZero = v => v.toFixed(2).replace(/^0\./, '.');

  const W = {
    model: 'FEE', desc: 'EXCHANGE METER',
    modelRev: 'FEE 1.0',
    author: 'Mike Edwards',
    licence: 'CC BY-NC-SA 4.0',
    licenceHref: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
    malformed: 'MALFORMED', predecessor: 'PREDECESSOR',
    doi: 'doi:10.5281/zenodo.23663062',
    darkBlock: (pos, corpus) => `NO ${pos} RUN IN ${corpus.toUpperCase()}`,
    noCurves: 'NO CURVES',
    carried: 'CARRIED c', distortion: 'DISTORTION',
    clip: 'CLIP', clipTop: top => `> A ${top}`,
    malPred: 'MAL PRED', selected: 'SELECTED', marked: 'MARKED',
    runs: 'RUNS', returns: 'RETURNS', fail: n => `FAIL ${n}`,
    failOff: 'FAIL',
    rankNull: 'RANK NULL AGAINST NONE',
    rankRef: 'REFERENCE: EVERY BLOCK READS AGAINST',
    rankVal: (p, f) => `p ${noLeadZero(p)}   floor ${noLeadZero(f)}`,
    rankNo05: 'none reach .05',
    sustain: 'SUSTAIN',
    sustainScale: () => 'BY LAG VS SHUFFLED; TOP .21',
    noneRate: 'RETURN RATE BY LAG',
    range: 'RANGE', peak: 'PEAK', hold: 'HOLD', step: 'STEP', rewind: 'REWIND',
    trace: 'TRACE',
    form: { '2bm1': '2^b - 1', '2b': '2^b' },
    of: n => 'of ' + n,
    screen: { RUN: 'RUN', ROOM: 'ROOM', CLOCKS: 'CLOCKS', CARD: 'CARD' },
    whyHold: 'HOLD holds two synced meters together: this meter stands alone',
    whyStepEnd: n => `S${n} is the end of this run: STEP has nowhere to advance`,
    ...(cfg.words || {}),
  };

  const GAP = 18, TITLE_H = 22, BH = 372;
  const CH = 5;
  const CW = 254.5;
  const ROW_H = TITLE_H + BH;
  const ROW_GAP = 34;
  const PB_G = 6;
  const PB_BW = (CW - 20 - 3 * PB_G) / 4;
  const PB_BH = PB_BW / 2;
  const MY = cfg.flush ? 0 : 14;
  const BAND_PAD = 10;
  const PLATE_H_1100 = 36;

  const READING = Object.freeze(['NONE', 'LETTER', 'NONE+LTR', 'DIARY+LTR',
                                 'BANK', 'DIARY', 'CHAT', 'ACCUM']);
  const GROUP_OF = Object.freeze({
    NONE: 'NONE', LETTER: 'LETTER', 'NONE+LTR': 'LETTER', 'DIARY+LTR': 'LETTER',
    BANK: 'THE BANK', DIARY: 'DIARY', CHAT: 'CHAT', ACCUM: 'ACCUMULATIVE' });
  const NARROW_ORDER = Object.freeze({
    760: Object.freeze(['BANK', 'NONE', 'LETTER', 'NONE+LTR', 'DIARY', 'DIARY+LTR', 'CHAT', 'ACCUM']),
    375: Object.freeze(['BANK', 'NONE', 'LETTER', 'NONE+LTR', 'DIARY+LTR', 'DIARY', 'CHAT', 'ACCUM']) });

  const LAYOUT = {
    1100: { cols: 4, scale: 1, bandRows: 1, plateH: PLATE_H_1100, bandGap: 10,
            kh: PB_BH, loadW: CW - 20, doiSize: null,
            plates: [['wordmark', 0, 0, 1], ['doi-placard', 0, 1, 2],
                     ['fee-nameplate', 0, 3, 1]] },
    760: { cols: 4, scale: (760 - 2 * 14) / (4 * CW + 3 * GAP), bandRows: 2, plateH: PLATE_H_1100,
           bandGap: 10, kh: PB_BH, loadW: (CW - 20) * (760 - 2 * 14) / (4 * CW + 3 * GAP), doiSize: null,
           plates: [['wordmark', 0, 0, 2], ['fee-nameplate', 0, 2, 2], ['doi-placard', 1, 0, 4]] },
    375: { cols: 1, scale: 343 / CW, bandRows: 3, plateH: 40, bandGap: 8,
           kh: 39, loadW: 64, doiSize: 20,
           plates: [['wordmark', 0, 0, 1], ['doi-placard', 1, 0, 1],
                    ['fee-nameplate', 2, 0, 1]] },
  };
  const Wd = LAYOUT[width] ? width : 1100;
  const D = LAYOUT[Wd];
  const PW = Wd;
  const COLS = D.cols;
  const S = D.scale;
  const ROWS = Math.ceil(READING.length / COLS);
  const DECK_W = COLS * CW + (COLS - 1) * GAP;
  const DECK_H = ROWS * ROW_H + (ROWS - 1) * ROW_GAP;
  const M = (PW - DECK_W * S) / 2;
  const BAND_H = 2 * BAND_PAD + D.bandRows * D.plateH + (D.bandRows - 1) * D.bandGap;
  const Y0 = MY + BAND_H + 14;
  const PB_Y = Y0 + DECK_H * S + ROW_GAP;
  const PB_BH_FOOT = D.kh;
  const PB_H = 2 * PB_BH_FOOT + PB_G;
  const CHIN_CLEAR = 26;
  const CHIN_H = PB_H + CHIN_CLEAR;
  const PAGE_H = PB_Y + CHIN_H + MY;
  const TRAY_TOP = MY + BAND_H;
  const TRAY_S = Wd === 760 ? S : 1;
  const BROW_H = CHIN_H / (Wd === 375 ? 4 : 2);
  const PLACE = {};
  const ORDER = COLS === 4 ? READING : NARROW_ORDER[Wd];
  ORDER.forEach((p, i) => {
    PLACE[p] = COLS === 4
      ? { NONE: [0, 0], LETTER: [1, 0], 'NONE+LTR': [2, 0], 'DIARY+LTR': [3, 0],
          BANK: [0, 1], DIARY: [1, 1], CHAT: [2, 1], ACCUM: [3, 1] }[p]
      : [i % COLS, Math.floor(i / COLS)];
  });
  const FW = CW - 20, FH = 180, R = 217, A0 = 32, A1 = 56;
  const PIV = (FW - 208) / 2;
  const SEP = 208;
  const FOOT = 14;
  const RING_EDGE = 3.3;
  const PLATE_LINE = 66.29;
  const PLATE_PAD = 8;
  const PLATE_W = PLATE_LINE + 2 * PLATE_PAD;
  const PLATE_FREE = [84.99, 171.37];
  const PLATE_X = (PLATE_FREE[0] + PLATE_FREE[1] - PLATE_W) / 2;
  const PLATE_CX = PLATE_X + PLATE_W / 2;
  const PLATE_H = 30, PLATE_Y = 102.5;
  const PLATE_B1 = 12, PLATE_B2 = 24.5;
  const BLO = FEE_SCALES.bend.min, BHI = FEE_SCALES.bend.max;
  const FAMILY = Object.freeze([1, 2, 4, 8, 16]);
  const PATH_ON_FACE = false;
  const TOP_A = 16;
  const LABEL_C = Object.freeze({ 1: 0.90, 2: 0.90, 4: 0.62, 8: 0.36, 16: 0.08 });
  const SUS_TOP = 0.21;
  const CLOCKS_SENTENCE = 'TWO CLOCKS: c READS THIS SESSION; DISTORTION ALL RETURNS '
    + "SINCE S1. AS RETURNS GROW, DISTORTION'S STEP NARROWS; c'S DOES NOT. "
    + '*TRACE* SHOWS TREND.';
  const REST = 15 * Math.PI / 180;
  const DIST_TICKS = Object.freeze([0, 0.5, 1, 2, 3, 4]);
  const C_TICKS = Object.freeze([0, 0.2, 0.4, 0.6, 0.8, 1]);
  const FAILED = Object.freeze(['refused', 'malformed', 'begun']);
  const LAGS = 8;
  const SPRING = Object.freeze({ K: 140, ZETA: 0.6 });
  const LAMP_DECAY = 300;

  const TRACE_BLOT = Object.freeze({
    sigma0: 0.8, sigmaAge: 0.035,
    peakAge: 0.18,
    gain: 2.2,
    reach: 4,
  });
  const blotSigma = age => TRACE_BLOT.sigma0 + TRACE_BLOT.sigmaAge * age;
  const blotPeak = age => 1 / (1 + TRACE_BLOT.peakAge * age);
  let traceRGB = [246, 246, 246];

  const col = i => i * (CW + GAP);
  const rowY = r => r * (ROW_H + ROW_GAP);

  const BLOCKS = Object.freeze(READING.filter(p => p !== 'BANK').map(p => (
    { position: p, col: PLACE[p][0], row: PLACE[p][1] })));
  const GROUPS = Object.freeze(COLS === 4
    ? [{ title: 'NONE', col: 0, span: 1, row: 0 },
       { title: 'LETTER', col: 1, span: 3, row: 0 },
       { title: 'THE BANK', col: 0, span: 1, row: 1 },
       { title: 'DIARY', col: 1, span: 1, row: 1 },
       { title: 'CHAT', col: 2, span: 1, row: 1 },
       { title: 'ACCUMULATIVE', col: 3, span: 1, row: 1 }]
    : ORDER.map(p => ({ title: GROUP_OF[p], col: PLACE[p][0], span: 1, row: PLACE[p][1] })));
  const CHASSIS = Object.freeze(COLS === 4
    ? [{ col: 0, span: 1, row: 0 }, { col: 1, span: 3, row: 0 },
       { col: 1, span: 1, row: 1 }, { col: 2, span: 1, row: 1 },
       { col: 3, span: 1, row: 1 }]
    : BLOCKS.map(b => ({ col: b.col, span: 1, row: b.row })));

  const PB_KW = COLS === 4 ? (CW - 20) * S
    : (DECK_W * S - D.loadW - 3 * PB_G) / 3;
  const PB_KEY_X = Object.freeze(COLS === 4
    ? [1, 2, 3].map(i => M + (col(i) + 10) * S)
    : [0, 1, 2].map(i => M + i * (PB_KW + PB_G)));
  const PB_LOAD_X = COLS === 4 ? M + (col(0) + 10) * S
    : M + 3 * (PB_KW + PB_G);
  const PB_ROW_Y = Object.freeze([PB_Y, PB_Y + PB_BH_FOOT + PB_G]);

  const FEE_SIX = Object.freeze({
    '20261022-straight-diary-s7-v2': 'A',
    '20261022-straight-chat-s7-v2': 'B',
    '20261025-accumulative-s3457': 'C',
    '20261021-straight-letter-s36-progress-report-argon4': 'D',
    '20261023-straight-none-s36': 'E',
    '20261019-straight-letter-s105': 'F',
  });
  const BANK_KEY = 'preterition-fee:bank:v1';

  const MARKS = new Set([
    'wordmark', 'doi-placard', 'fee-nameplate',
    'pilot-core', 'pilot-ring', 'sound-glyph',
    'block', 'group-title', 'dark-block', 'dark-reason', 'curves-absent',
    'room-glass', 'counter', 'cue-line', 'hold-key', 'rewind-key', 'step-key',
    'range-key', 'range-lamp', 'peak-key', 'peak-lamp',
    'trace-key', 'trace-lamp', 'trace-field',
    'free-cell', 'preset-bank', 'tray-chrome',
    'screen', 'screen-key', 'screen-lamp',
    'meter-face', 'scale-arc', 'pivot', 'arc-end', 'scale-label',
    'distortion-numeral', 'c-numeral', 'face-range-lamp',
    'curve', 'curve-label', 'own-curve', 'clip-lamp',
    'pooled-tick', 'pooled-tick-writing', 'pooled-median', 'pooled-crossing',
    'path', 'path-end',
    'needle-distortion', 'needle-c', 'needle-c-writing', 'needle-rest',
    'detent', 'peak-pointer', 'mal-pred-lamp',
    'block-name', 'selected-lamp', 'marked-lamp',
    'runs-tube', 'returns-tube', 'fail-count', 'status-lamp',
    'rank-null', 'rank-null-reference', 'rank-null-floor',
    'sustain', 'sustain-cell', 'sustain-lag', 'sustain-rate', 'sustain-scale',
  ]);
  const MARKS_OFF = Object.freeze(PATH_ON_FACE ? [] : ['path', 'path-end']);

  const SVGNS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs = {}, text = '') => {
    const x = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
    if (text) x.textContent = text;
    return x;
  };
  const sv = (tag, attrs = {}, text = '') => {
    const x = document.createElementNS(SVGNS, tag);
    for (const [k, v] of Object.entries(attrs)) x.setAttribute(k, v);
    if (text) x.textContent = text;
    return x;
  };
  const mark = (name, tag = 'div', attrs = {}, text = '') => {
    if (!MARKS.has(name)) throw new Error(`fee-face.js: the mark ${name} answers no row of the sources table`);
    return el(tag, { ...attrs, 'data-mark': name }, text);
  };
  const smark = (name, tag, attrs = {}, text = '') => {
    if (!MARKS.has(name)) throw new Error(`fee-face.js: the mark ${name} answers no row of the sources table`);
    return sv(tag, { ...attrs, 'data-mark': name }, text);
  };
  const show = (x, on) => { if (on) x.removeAttribute('hidden'); else x.setAttribute('hidden', ''); };
  const put = (x, [a, b, w, h]) => {
    Object.assign(x.style, { left: a + 'px', top: b + 'px', width: w + 'px', height: h + 'px' });
    return x;
  };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  const st = {
    mode: 'PLAY', slot: 0,
    run: null,
    corpus: null,
    k: null,
    form: '2bm1',
    peak: true,
    trace: false,
    cue: null,
    synced: false,
    ring: 'none',
    frozen: false,
    set: null, adjust: false,
    picked: null, pickRefused: null, focusKnob: null,
    shufAngle: 0, admittedBefore: null,
  };
  const loaded = () => st.run !== null;
  const roomOf = c => (data.rooms[c] ? data.rooms[c].room : null);
  const jsonOf = c => (data.rooms[c] ? data.rooms[c].json : null);
  const room = () => roomOf(st.corpus);
  const runEntry = () => (loaded() ? room().runById.get(st.run) : null);
  const N = () => (loaded() ? runEntry().N : 0);
  const corpusOf = id => data.order.find(c => roomOf(c).runById.has(id)) || null;
  const selected = () => (loaded() ? feeBlockOf(room(), st.run) : null);

  const root = el('div', { id: 'fee', 'data-fee-host': '', 'data-width': String(Wd),
                           'data-mode': 'PLAY', 'aria-label': 'FEE, Exchange meter' });
  root.style.width = PW + 'px';
  root.style.height = PAGE_H + 'px';
  root.style.setProperty('--fee-foot', PB_H + 'px');
  root.style.setProperty('--dr-phone-bottom', (Wd === 375 ? PB_H + 26 : PB_H) + 'px');
  const chassis = el('div', { class: 'chassis' });
  put(chassis, [0, 0, PW, PB_Y]);
  root.appendChild(chassis);
  host.appendChild(root);

  const deck = el('div', { class: 'deck' });
  Object.assign(deck.style, {
    position: 'absolute', left: M + 'px', top: Y0 + 'px',
    width: DECK_W + 'px', height: DECK_H + 'px',
    transformOrigin: '0 0',
    transform: S === 1 ? 'none' : `scale(${S})`,
  });
  chassis.appendChild(deck);

  const band = el('div', { class: 'band' });
  const BAND_X = M - CH, BAND_W = DECK_W * S + 2 * CH;
  put(band, [BAND_X, MY, BAND_W, BAND_H]);
  root.style.setProperty('--fee-sheet-w', BAND_W + 'px');
  root.style.setProperty('--fee-band-x', BAND_X + 'px');
  root.style.setProperty('--fee-tray-s', String(TRAY_S));
  root.style.setProperty('--fee-sync-cs', String(1 / TRAY_S));
  root.style.setProperty('--fee-brow-h', BROW_H + 'px');
  root.style.setProperty('--fee-brow-y', TRAY_TOP + 'px');
  root.style.setProperty('--fee-brow-x', (Wd === 375 ? BAND_X : 0) + 'px');
  root.style.setProperty('--fee-brow-w', (Wd === 375 ? BAND_W : PW) + 'px');
  root.style.setProperty('--fee-brow-inner', (BROW_H / TRAY_S) + 'px');
  function placeSheet() {
    if (Wd !== 375) return;
    const r = root.getBoundingClientRect();
    root.style.setProperty('--fee-sheet-l', (r.left + BAND_X) + 'px');
    root.style.setProperty('--fee-sheet-t', (r.top + TRAY_TOP) + 'px');
  }
  if (Wd === 375) window.addEventListener('resize', placeSheet);
  chassis.appendChild(band);
  const bandParts = {};

  const tokenProbe = el('span', { 'aria-hidden': 'true' });
  tokenProbe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0;'
    + 'overflow:hidden;clip-path:inset(50%);pointer-events:none';
  root.appendChild(tokenProbe);
  const tokenRGB = (name, fallback) => {
    tokenProbe.style.color = `var(${name})`;
    const got = String(getComputedStyle(tokenProbe).color || '').match(/-?[\d.]+/g);
    return got && got.length >= 3 ? got.slice(0, 3).map(Number) : fallback;
  };

  {
    const HREF = { weblog: 'https://preterite.net/weblog/',
                   doi: 'https://doi.org/10.5281/zenodo.23663062' };
    const rectOf = (r, c, span) => [col(c) * S + CH,
                                    BAND_PAD + r * (D.plateH + D.bandGap),
                                    (span * CW + (span - 1) * GAP) * S, D.plateH];
    const where = {};
    for (const [nm, r, c, span] of D.plates) where[nm] = rectOf(r, c, span);

    const plate = el('div', { class: 'logoplate' });
    put(plate, where.wordmark);
    root.style.setProperty('--fee-sync-x', (where.wordmark[0] - 16) + 'px');
    root.style.setProperty('--fee-sync-w', where.wordmark[2] + 'px');
    plate.appendChild(mark('wordmark', 'a', { class: 'logoword', href: HREF.weblog,
      target: '_top', title: 'Preterition, the weblog' }, 'PRETERITION'));
    band.appendChild(plate);

    const cite = mark('doi-placard', 'div', { class: 'citeplate' });
    put(cite, where['doi-placard']);
    const pilot = el('div', { class: 'pilot' });
    const pilotRing = mark('pilot-ring', 'i', { class: 'ring', 'aria-hidden': 'true',
                                                'data-ring': 'none' });
    pilot.append(mark('pilot-core', 'i', { class: 'core', 'aria-hidden': 'true' }),
                 pilotRing);
    bandParts.pilotRing = pilotRing;
    const doi = el('a', { class: 'doi', href: HREF.doi, target: '_top' }, W.doi);
    if (D.doiSize) doi.style.fontSize = D.doiSize + 'px';
    cite.append(pilot, doi);
    band.appendChild(cite);

    const name = mark('fee-nameplate', 'div', { class: 'nameplate' });
    put(name, where['fee-nameplate']);
    const snd = mark('sound-glyph', 'span', { class: 'snd', 'aria-hidden': 'true' });
    snd.innerHTML = '<svg viewBox="0 0 16 11"><path class="body" d="M0 4h3l4-3.5v10L3 7H0z"/>'
      + '<path class="on" d="M9.5 3Q12 5.5 9.5 8"/></svg>';
    const plateName = el('span', { class: 'nplate' });
    plateName.append(el('span', { class: 'nname' }, W.model),
                     el('small', { class: 'ndesc' }, W.desc));
    name.append(snd, plateName);
    band.appendChild(name);
    bandParts.pilot = pilot;
  }

  for (const g of GROUPS) {
    const w = g.span * CW + (g.span - 1) * GAP;
    const box = mark('group-title', 'div', { class: 'gbox', 'data-group': g.title });
    put(box, [col(g.col), rowY(g.row), w, TITLE_H + BH]);
    box.appendChild(el('span', { class: 'glabel' }, g.title));
    deck.appendChild(box);
  }
  for (const c of CHASSIS) {
    const w = c.span * CW + (c.span - 1) * GAP;
    const sh = el('div', { class: 'shell' });
    put(sh, [col(c.col) - CH, rowY(c.row) + TITLE_H - CH, w + 2 * CH, BH + 2 * CH]);
    deck.appendChild(sh);
  }

  const PLx = PIV, PRx = FW - PIV, Py = FH + FOOT;
  const pl = (a, r) => [PLx + r * Math.cos(a), Py - r * Math.sin(a)];
  const pr = (a, r) => [PRx - r * Math.cos(a), Py - r * Math.sin(a)];
  const cross = (aD, aCc) => pl(aD, SEP * Math.sin(aCc) / Math.sin(aD + aCc));
  const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
  const bendOf = (d, form) => (d === null || d === undefined || !Number.isFinite(d) ? null
    : Math.log2(Math.max(d + (form === '2b' ? 0 : 1), 1e-12)));
  const aBend = b => (A0 + (clamp(b, BLO, BHI) - BLO) / (BHI - BLO) * (A1 - A0)) * Math.PI / 180;
  const aCar = c => (A0 + clamp(c, 0, 1) * (A1 - A0)) * Math.PI / 180;
  const crossAt = (d, c) => cross(aBend(Math.log2(1 + Math.max(d, -0.29))), aCar(c));

  const blockEls = {};
  for (const b of BLOCKS) blockEls[b.position] = buildBlock(b);

  function buildBlock(spec) {
    const x = col(spec.col), y = rowY(spec.row) + TITLE_H;
    const o = { position: spec.position, x, y };
    o.box = mark('block', 'div', { class: 'block', 'data-position': spec.position });
    put(o.box, [x, y, CW, BH]);
    deck.appendChild(o.box);

    o.name = mark('block-name', 'div', { class: 'bname' }, spec.position);
    put(o.name, [x + 10, y + 5, CW - 180, 17]);
    deck.appendChild(o.name);
    o.sel = lampEl('selected-lamp', W.selected, 'right');
    put(o.sel, [x + CW - 90, y + 5, 80, 14]);
    deck.appendChild(o.sel);
    o.marked = lampEl('marked-lamp', W.marked, 'left');
    put(o.marked, [x + CW - 107, y + 5, 70, 14]);
    deck.appendChild(o.marked);

    const fxp = x + 10, fyp = y + 26;
    o.fx = fxp;
    o.fy = fyp;
    o.field = null;
    const svg = sv('svg', { class: 'dial', viewBox: `-6 -6 ${FW + 12} ${FH + 36}`,
                            'aria-hidden': 'true' });
    put(svg, [fxp - 6, fyp - 6, FW + 12, FH + 36]);
    deck.appendChild(svg);
    o.svg = svg;
    const tag = spec.position.replace(/[^A-Z]/g, '') + spec.col + spec.row;
    const cid = `fee-clip-${tag}`, hid = `fee-hatch-${tag}`;
    const defs = sv('defs');
    const cp = sv('clipPath', { id: cid });
    cp.appendChild(sv('rect', { x: 0, y: 0, width: FW, height: FH }));
    const pat = sv('pattern', { id: hid, width: 6, height: 6,
                                patternUnits: 'userSpaceOnUse',
                                patternTransform: 'rotate(45)' });
    pat.appendChild(sv('line', { class: 'hl', x1: 0, y1: 0, x2: 0, y2: 6 }));
    defs.append(cp, pat);
    svg.appendChild(defs);
    svg.appendChild(sv('rect', { class: 'bezel', x: -3, y: -3, width: FW + 6, height: FH + 6, rx: 5 }));
    o.face = smark('meter-face', 'rect', { class: 'faceplate', x: 0, y: 0,
                                           width: FW, height: FH, rx: 2 });
    svg.appendChild(o.face);
    o.hatch = sv('rect', { class: 'hatch', x: 0, y: 0, width: FW, height: FH, rx: 2,
                           fill: `url(#${hid})`, hidden: '' });
    svg.appendChild(o.hatch);

    const g = sv('g', { 'clip-path': `url(#${cid})` });
    svg.appendChild(g);
    o.g = g;

    const arcPts = f => {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const a = (A0 + i * (A1 - A0) / 24) * Math.PI / 180;
        const p = f(a, R);
        pts.push(`${p[0].toFixed(2)},${p[1].toFixed(2)}`);
      }
      return pts.join(' ');
    };
    g.appendChild(smark('scale-arc', 'polyline', { class: 'arc', 'data-side': 'distortion',
                                                   'data-r': String(R), points: arcPts(pl) }));
    g.appendChild(smark('scale-arc', 'polyline', { class: 'arc', 'data-side': 'c',
                                                   'data-r': String(R), points: arcPts(pr) }));
    o.pivots = {};
    for (const [side, px] of [['distortion', PLx], ['c', PRx]]) {
      const c0 = smark('pivot', 'circle', { class: 'piv', 'data-side': side,
                                            cx: String(px), cy: String(Py), r: '0.5' });
      svg.appendChild(c0);
      o.pivots[side] = c0;
    }
    for (const [side, f] of [['distortion', pl], ['c', pr]]) {
      for (const deg of [A0, A1]) {
        const p = f(deg * Math.PI / 180, R);
        g.appendChild(smark('arc-end', 'circle', { class: 'arcend', 'data-side': side,
          'data-angle': String(deg), cx: p[0].toFixed(3), cy: p[1].toFixed(3), r: '0.5' }));
      }
    }

    o.distNums = [];
    for (const d of DIST_TICKS) {
      const a = aBend(Math.log2(1 + d));
      const p = pl(a, R), q = pl(a, R - 5), n = pl(a, R - 11), m = pl(a, R - 20);
      g.appendChild(sv('line', { class: 'tick', x1: p[0].toFixed(2), y1: p[1].toFixed(2),
                                 x2: q[0].toFixed(2), y2: q[1].toFixed(2) }));
      const lo = smark('distortion-numeral', 'text', { class: 'num', 'data-form': '2bm1',
        'data-value': String(d), x: n[0].toFixed(2), y: (n[1] + 2.5).toFixed(2),
        'text-anchor': 'middle' }, d === 0.5 ? '.5' : String(d));
      const hi = smark('distortion-numeral', 'text', { class: 'num', 'data-form': '2b',
        'data-value': String(d + 1), x: m[0].toFixed(2), y: (m[1] + 2.5).toFixed(2),
        'text-anchor': 'middle' }, String(d + 1));
      g.append(lo, hi);
      o.distNums.push({ lo, hi });
    }
    for (const c of C_TICKS) {
      const a = aCar(c);
      const p = pr(a, R), q = pr(a, R - 5), n = pr(a, R - 11);
      g.appendChild(sv('line', { class: 'tick', x1: p[0].toFixed(2), y1: p[1].toFixed(2),
                                 x2: q[0].toFixed(2), y2: q[1].toFixed(2) }));
      g.appendChild(smark('c-numeral', 'text', { class: 'num', 'data-value': String(c),
        x: n[0].toFixed(2), y: (n[1] + 2.5).toFixed(2), 'text-anchor': 'middle' },
        c > 0 && c < 1 ? String(c).replace('0.', '.') : String(c)));
    }

    o.curves = sv('g', { class: 'curves' });
    o.labels = sv('g', { class: 'curvelabels' });
    o.pooled = sv('g', { class: 'pooled' });
    o.paths = sv('g', { class: 'paths' });
    o.livemarks = sv('g', { class: 'livemarks' });
    g.append(o.curves, o.labels, o.pooled, o.paths, o.livemarks);

    o.detent = smark('detent', 'g', { class: 'det', hidden: '' });
    o.detent.append(sv('polyline', { class: 'detbar', points: '' }),
                    sv('line', { class: 'dend' }), sv('line', { class: 'dend' }));
    o.peak = smark('peak-pointer', 'path', { class: 'peakptr', d: '', hidden: '' });
    o.livemarks.append(o.detent, o.peak);
    o.needles = {};
    for (const [key, name, side] of [['dist', 'needle-distortion', 'distortion'],
                                     ['c', 'needle-c', 'c'],
                                     ['cw', 'needle-c-writing', 'c']]) {
      const ln = smark(name, 'line', { class: 'ndl' + (key === 'cw' ? ' writing' : ''),
                                       'data-side': side, x1: '0', y1: '0', x2: '0', y2: '0',
                                       hidden: '' });
      o.livemarks.appendChild(ln);
      o.needles[key] = { el: ln, a: REST, w: 0, target: REST, side, shown: false };
    }
    o.rest = {};
    for (const side of ['distortion', 'c']) {
      const ln = smark('needle-rest', 'line', { class: 'ndl rest', 'data-side': side,
                                                x1: '0', y1: '0', x2: '0', y2: '0', hidden: '' });
      o.livemarks.appendChild(ln);
      setNeedle(ln, side, REST, R);
      o.rest[side] = ln;
    }

    svg.appendChild(smark('scale-label', 'text', { class: 'slab', 'data-scale': 'c',
      x: '6', y: String(FH - 78), 'text-anchor': 'start' }, W.carried));
    svg.appendChild(smark('scale-label', 'text', { class: 'slab', 'data-scale': 'distortion',
      x: String(FW - 6), y: String(FH - 78), 'text-anchor': 'end' }, W.distortion));
    o.malPred = svgLamp('mal-pred-lamp', W.malPred, 9, FH - 66);
    svg.appendChild(o.malPred.g);
    o.faceLamps = {};
    FEE_RANGES.forEach((form, i) => {
      const lp = svgLamp('face-range-lamp', W.form[form], FW - 40, FH - 66 + i * 11);
      lp.g.setAttribute('data-form', form);
      svg.appendChild(lp.g);
      o.faceLamps[form] = lp;
    });
    o.clip = svgLamp('clip-lamp', W.clip, FW - 27, 9);
    o.clip.g.appendChild(sv('text', { class: 'cliptop', x: '21', y: '10',
                                      'text-anchor': 'end' }, W.clipTop(TOP_A)));
    svg.appendChild(o.clip.g);
    o.darkBox = smark('dark-block', 'g', { class: 'darkbox', hidden: '' });
    o.darkBox.appendChild(sv('rect', { class: 'darkplate', x: PLATE_X.toFixed(2),
                                       y: String(PLATE_Y), width: String(PLATE_W),
                                       height: String(PLATE_H) }));
    o.darkText = smark('dark-reason', 'text', { class: 'darktext', 'text-anchor': 'middle' });
    o.darkLines = [PLATE_B1, PLATE_B2].map(d => {
      const t = sv('tspan', { x: PLATE_CX.toFixed(2), y: String(PLATE_Y + d) });
      o.darkText.appendChild(t);
      return t;
    });
    o.darkBox.appendChild(o.darkText);
    svg.appendChild(o.darkBox);
    o.curvesAbsent = smark('curves-absent', 'text', { class: 'noc', x: String(FW / 2),
      y: String(FH - 40), 'text-anchor': 'middle', hidden: '' }, W.noCurves);
    svg.appendChild(o.curvesAbsent);

    const yn = y + 26 + FH + 12;
    o.runsLab = put(el('div', { class: 'tlab' }, W.runs), [x + 10, yn, 30, 12]);
    deck.appendChild(o.runsLab);
    o.runsTubes = tubes('runs-tube', x + 36, yn, 2);
    o.returnTubes = tubes('returns-tube', x + CW - 73, yn, 3);
    o.retLab = put(el('div', { class: 'tlab right' }, W.returns),
                   [x + CW - 150, yn, 72, 12]);
    deck.appendChild(o.retLab);
    o.fail = mark('fail-count', 'div', { class: 'fail right' }, W.fail(0));
    put(o.fail, [x + CW - 150, yn + 28 - 12, 72, 12]);
    deck.appendChild(o.fail);
    o.status = {};
    FAILED.forEach((f, j) => {
      const lp = lampEl('status-lamp', f.toUpperCase(), 'left');
      lp.setAttribute('data-status', f);
      put(lp, [x + 11 + j * 58, yn + 34, 56, 12]);
      deck.appendChild(lp);
      o.status[f] = lp;
    });

    const yp = yn + 58;
    o.rankLabel = el('div', { class: 'slab2' }, W.rankNull);
    deck.appendChild(put(o.rankLabel, [x + 10, yp - 9, 160, 12]));
    o.rank = mark('rank-null', 'div', { class: 'rank' }, '');
    put(o.rank, [x + 10, yp + 2, 120, 14]);
    deck.appendChild(o.rank);
    o.rankRef = mark('rank-null-reference', 'div', { class: 'rankref', hidden: '' }, W.rankRef);
    put(o.rankRef, [x + 10, yp + 3, CW - 20, 12]);
    deck.appendChild(o.rankRef);
    o.rankNo05 = mark('rank-null-floor', 'div', { class: 'rank05 right', hidden: '' }, W.rankNo05);
    put(o.rankNo05, [x + CW - 130, yp + 3, 120, 12]);
    deck.appendChild(o.rankNo05);

    const ys = yp + 26;
    deck.appendChild(put(el('div', { class: 'slab2' }, W.sustain), [x + 10, ys - 9, 60, 12]));
    o.susScale = mark('sustain-scale', 'div', { class: 'susscale right' }, W.sustainScale(SUS_TOP));
    put(o.susScale, [x + CW - 190, ys - 9, 180, 12]);
    deck.appendChild(o.susScale);
    const strip = mark('sustain', 'div', { class: 'strip' });
    put(strip, [x + 10, ys, CW - 20, 56]);
    deck.appendChild(strip);
    o.cells = [];
    for (let i = 0; i < LAGS; i++) {
      const cell = mark('sustain-cell', 'div', { class: 'jewel', 'data-lag': String(i + 1) });
      cell.style.left = (1.5 + i * 29) + 'px';
      cell.append(el('i', { class: 'disc', 'aria-hidden': 'true' }),
                  el('i', { class: 'well', 'aria-hidden': 'true' }),
                  el('i', { class: 'minus', 'aria-hidden': 'true' }));
      const lag = mark('sustain-lag', 'div', { class: 'lag' }, String(i + 1));
      lag.style.left = (1.5 + i * 29) + 'px';
      const rate = mark('sustain-rate', 'div', { class: 'rate', hidden: '' }, '');
      rate.style.left = (1.5 + i * 29) + 'px';
      strip.append(cell, lag, rate);
      o.cells.push({ cell, lag, rate });
    }
    o.noteRate = el('div', { class: 'ratenote right', hidden: '' }, W.noneRate);
    put(o.noteRate, [x + CW - 170, ys + 44, 160, 12]);
    deck.appendChild(o.noteRate);

    o.darkParts = [o.sel, strip, o.fail, ...FAILED.map(f => o.status[f])]
      .concat(o.marked ? [o.marked] : []);
    return o;
  }

  function setNeedle(nd, pivotSide, a, len) {
    const f = pivotSide === 'distortion' ? pl : pr;
    const P = pivotSide === 'distortion' ? [PLx, Py] : [PRx, Py];
    const p = f(a, len);
    nd.setAttribute('x1', P[0].toFixed(2));
    nd.setAttribute('y1', P[1].toFixed(2));
    nd.setAttribute('x2', p[0].toFixed(2));
    nd.setAttribute('y2', p[1].toFixed(2));
  }

  function tubes(name, x, y, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = mark(name, 'div', { class: 'tube', 'data-lit': 'false' });
      put(t, [x + i * 21, y, 18, 28]);
      const stack = el('span', { class: 'nstack', 'aria-hidden': 'true' });
      stack.append(el('i', {}, '8'), el('i', {}, '0'));
      t.append(stack, el('span', { class: 'digit' }, ''));
      deck.appendChild(t);
      out.push(t);
    }
    return out;
  }
  function lampEl(name, label, side) {
    const w = mark(name, 'div', { class: 'lp ' + side, 'data-lit': 'false' });
    w.append(el('i', { class: 'bulb', 'aria-hidden': 'true' }), el('span', { class: 'lt' }, label));
    return w;
  }
  function svgLamp(name, label, x, y) {
    const g = smark(name, 'g', { class: 'slamp', 'data-lit': 'false',
                                 transform: `translate(${x},${y})` });
    const bulb = sv('circle', { class: 'bulb', cx: '0', cy: '0', r: '2.6' });
    const ring = sv('circle', { class: 'ring', cx: '0', cy: '0', r: '1.5' });
    const lt = sv('text', { class: 'lt', x: '5', y: '2.2' }, label);
    g.append(bulb, ring, lt);
    return { g, bulb, ring, lt };
  }

  const BX = col(PLACE.BANK[0]), BY = rowY(PLACE.BANK[1]) + TITLE_H;
  deck.appendChild(put(el('div', { class: 'bankcell' }), [BX, BY, CW, BH]));

  const glass = mark('room-glass', 'div', { class: 'glassbox' });
  put(glass, [BX + 10, BY + 20,
              3 * PB_BW + 2 * PB_G - RING_EDGE, 44]);
  deck.appendChild(glass);
  const roomName = el('div', { class: 'roomname' }, '');
  put(roomName, [7, 1, 110, 20]);
  glass.append(roomName);

  const GX = BX + 10, GY = BY + 72;
  const gx = i => GX + i * (PB_BW + PB_G);
  const gy = j => GY + j * (PB_BH + PB_G);
  const sw = n => n * PB_BW + (n - 1) * PB_G;
  const sh = n => n * PB_BH + (n - 1) * PB_G;

  const counterHost = mark('counter', 'div', { class: 'cthost' });
  put(counterHost, [gx(0), gy(0), sw(2), sh(2)]);
  deck.appendChild(counterHost);

  function key(name, label, rect, opts = {}) {
    const b = mark(name, 'button', { type: 'button', class: 'k', 'aria-pressed': 'false' });
    if (opts.lamp !== false) b.appendChild(el('i', { class: 'klamp', 'aria-hidden': 'true' }));
    b.appendChild(el('span', { class: 'kl' }, label));
    put(b, rect);
    deck.appendChild(b);
    return b;
  }
  const holdKey = key('hold-key', W.hold, [gx(0), gy(2), PB_BW, PB_BH], { lamp: false });
  const rewindKey = key('rewind-key', W.rewind, [gx(2), gy(0), PB_BW, PB_BH], { lamp: false });
  const stepKey = key('step-key', W.step, [gx(2), gy(1), PB_BW, PB_BH], { lamp: false });

  const rangeKey = mark('range-key', 'button', { type: 'button', class: 'k range',
                                                 'aria-pressed': 'false' });
  put(rangeKey, [gx(0), gy(3), sw(2), PB_BH]);
  rangeKey.appendChild(el('span', { class: 'kl rl' }, W.range));
  const rangeLamps = {};
  FEE_RANGES.forEach((form, i) => {
    const lp = lampEl('range-lamp', W.form[form], 'left');
    lp.setAttribute('data-form', form);
    lp.style.left = (7 + i * 54) + 'px';
    lp.style.top = '13px';
    rangeKey.appendChild(lp);
    rangeLamps[form] = lp;
  });
  deck.appendChild(rangeKey);

  const peakKey = mark('peak-key', 'button', { type: 'button', class: 'k peak',
                                               'aria-pressed': 'false' });
  put(peakKey, [gx(2), gy(3), PB_BW, PB_BH]);
  peakKey.appendChild(el('span', { class: 'kl' }, W.peak));
  const peakLamp = mark('peak-lamp', 'i', { class: 'pinpoint', 'data-lit': 'false',
                                            'aria-hidden': 'true' });
  peakKey.appendChild(peakLamp);
  deck.appendChild(peakKey);

  for (let j = 0; j < 3; j++) {
    const f = mark('free-cell', 'div', { class: 'free', 'data-where': 'fourth-column' });
    put(f, [gx(3), gy(j), PB_BW, PB_BH]);
    deck.appendChild(f);
  }

  const traceKey = mark('trace-key', 'button', { type: 'button', class: 'k trace',
                                                 'aria-pressed': 'false' });
  put(traceKey, [gx(3), gy(3), PB_BW, PB_BH]);
  traceKey.appendChild(el('span', { class: 'kl' }, W.trace));
  const traceLamp = mark('trace-lamp', 'i', { class: 'pinpoint', 'data-lit': 'false',
                                              'aria-hidden': 'true' });
  traceKey.appendChild(traceLamp);
  deck.appendChild(traceKey);

  const SCREEN_PAGES = ['RUN', 'ROOM', 'CLOCKS', 'CARD'];
  const screen = mark('screen', 'div', { class: 'crt', 'data-page': 'RUN' });
  put(screen, [gx(0), gy(4), sw(3), sh(4)]);
  const screenFace = el('div', { class: 'crtface' });
  const screenText = el('div', { class: 'crttxt' });
  screenFace.appendChild(screenText);
  screen.appendChild(screenFace);
  deck.appendChild(screen);
  const screenKeys = {};
  SCREEN_PAGES.forEach((page, i) => {
    const b = mark('screen-key', 'button', { type: 'button', class: 'k scr',
                                             'aria-pressed': 'false', 'data-page': page });
    b.appendChild(el('span', { class: 'kl' }, W.screen[page]));
    b.appendChild(mark('screen-lamp', 'i', { class: 'pinpoint', 'data-lit': 'false',
                                             'aria-hidden': 'true' }));
    put(b, [gx(3), gy(4 + i), PB_BW, PB_BH]);
    b.addEventListener('click', () => { st.page = page; emit('fee-screen', { page }); render(); });
    deck.appendChild(b);
    screenKeys[page] = b;
  });

  const counter = mountCounter({
    root, host: counterHost, keyClass: 'feetp',
    narrow: false,
    st, bus, say,
    words: {
      of: W.of,
      saidPast: (to, n) => `S${to} is past the end; going to S${n}`,
      saidNothing: 'Nothing to locate: set the counter or press CUE first.',
      locateAria: "go to the counter's setting, or to the cue",
      cueAria: "set this run's cue at the session showing",
    },
    hooks: {
      reading: () => ({ session: st.k ?? 0, N: N(), live: true, cue: st.cue, winding: false }),
      setCue: () => {
        if (!loaded() || st.mode !== 'PLAY' || st.k === null || st.frozen) return null;
        st.cue = st.k;
        return { slot: st.slot, session: st.k };
      },
      goTo: session => { if (st.frozen) return; counter.forgetSetting(); st.k = session; render(); },
      winding: () => false,
      render: () => render(),
    },
  });
  counter.cueText.setAttribute('data-mark', 'cue-line');
  counter.keys.classList.add('feetp');
  deck.appendChild(counter.keys);
  put(counter.keyEls.locate, [gx(1), gy(2), PB_BW, PB_BH]);
  put(counter.keyEls.cue, [gx(2), gy(2), PB_BW, PB_BH]);

  const ix = data.index;
  const entryOf = id => ix.runs.find(e => e.run === id) || null;
  const picked = new Map();

  const bankHost = mark('preset-bank', 'div', { class: 'bankhost', id: 'fee-bank' });
  put(bankHost, [0, PB_Y, PW, CHIN_H]);
  root.appendChild(bankHost);

  for (const id of Object.keys(FEE_SIX)) {
    if (!entryOf(id)) throw new Error(id + ' is not in the index');
  }
  const syncHost = el('div', { class: 'synchost' });

  const known = new Set(ix.runs.map(r => r.run));
  const remembered = storage ? bankRestoreFrom(storage, known, BANK_KEY, 6) : null;
  const blank = () => ({ k: null, cue: null });
  const slots = makeBank(remembered || Object.keys(FEE_SIX), 6, blank);
  const ks = makeKnobs(ix);

  function stripOf(feeKey, html = true, short = false) {
    const id = feeKey.replace(/^file:/, '');
    const e = entryOf(id);
    const term = e ? e.term : id;
    const it = html ? `<i>${esc(term)}</i>` : term;
    const line = s => (html ? `<span class="pline">${s}</span>` : s);
    if (feeKey.startsWith('file:')) return line(`${it}, from a file`);
    const head = it;
    if (short && Wd !== 1100) return line(head);
    return line(`${head}, ${e.knobs.CORPUS}, ${e.knobs.MEMORY}`);
  }

  function feeIntake(exp) {
    const name = exp && typeof exp === 'object' && !Array.isArray(exp) && exp.run ? exp.run : 'the file';
    return { ok: false, refusals: [
      `${name}: FEE reads llm-loop's room files, blocks-<corpus>.json on the rack-bus-1.0 `
      + 'line, and no export of her own'] };
  }

  const drawer = mountDrawer({
    root, host: root, bankHost,
    rect: Wd === 375 ? null : [BAND_X, TRAY_TOP, BAND_W / TRAY_S, (PB_Y - TRAY_TOP) / TRAY_S],
    ids: drawerIds,
    flex: { key: '1 1 0', mode: '1 1 0', full: false },
    ks, slots, st, bus, say,
    strip: stripOf,
    drop: (sl, i, k) => bankDrop(sl, i, k, 6, blank),
    intake: feeIntake,
    kind: 'run',
    sync: { shown: syncShown, host: syncHost },
    words: {
      title: 'Run library', region: 'run library',
      pickKey: 'Choose file',
      pickLine: 'FEE reads the rooms, not an export.',
      howto: ['Turn the knobs to lock positions, or turn SHUFFLE and press its LOCK. The glass reports the count of runs left by the locks.',
              'When the locks leave one run, press a preset key to load it to that slot.',
              'Press PLAY to leave the loader and return to the bank.'],
      tape: 'RUN', tapePrompt: '2  press a preset key to load it into that slot.',
      noTape: 'No run chosen: lock the knobs to one run.',
    },
    hooks: {
      inert: on => { chassis.inert = on; },
      onMode: () => { placeSheet(); counter.clearAdjust(); render(); },
      load: () => {},
      save: () => { if (storage) bankSaveTo(storage, slots, BANK_KEY); },
      leader: i => { st.slot = i; },
      choose,
      render: () => render(),
      tapeOf: one => { const e = entryOf(one); return { key: one, verdict: e.verdict, gaps: e.gaps }; },
      knows: k => !!corpusOf(String(k).replace(/^file:/, '')),
      kindOf: exp => {
        if (!exp || typeof exp !== 'object' || Array.isArray(exp)) return null;
        if (typeof exp.fan === 'string' && exp.fan) return 'fan';
        if (typeof exp.run === 'string' && exp.run) return 'run';
        return null;
      },
      keep: exp => { const k = 'file:' + exp.run; picked.set(k, exp); return { key: k, id: exp.run }; },
    },
  });
  drawer.presetKeys.forEach((b, i) => put(b, [PB_KEY_X[i % 3],
    PB_ROW_Y[Math.floor(i / 3)] - PB_Y, PB_KW, PB_BH_FOOT]));
  put(drawer.modeKey, [PB_LOAD_X, 0, D.loadW, PB_H]);

  drawer.modeKey.addEventListener('click', () => {
    if (Wd !== 375 || drawer.drawer.hasAttribute('data-open')) return;
    window.scrollTo(0, 0);
  }, true);

  const chrome = mark('tray-chrome', 'div', { class: 'chrome' });
  const picker = drawer.drawer.querySelector('.picker');
  drawer.drawer.insertBefore(chrome, picker);
  picker.appendChild(syncHost);

  let shown = null;
  let hand = { leaving: null, entering: null, phase: null };
  function handover(to) {
    const from = hand.phase === 'falling' ? hand.leaving : shown;
    hand = from && from !== to ? { leaving: from, entering: to, phase: 'falling' }
                               : { leaving: null, entering: to, phase: null };
  }
  function choose(i) {
    st.slot = i;
    const feeKey = slots[i].key;
    const id = feeKey.replace(/^file:/, '');
    const corpus = corpusOf(id);
    st.k = null; st.cue = null;
    counter.reset();
    if (!corpus) { st.run = null; say(`no room file carries ${id}`); render(); return; }
    st.corpus = corpus;
    st.run = id;
    const b = feeBlockOf(room(), id);
    handover(b.position);
    emit('fee-load', { slot: i, id, corpus, position: b.position });
    emit('preset', { slot: i, id: feeKey });
    render();
  }

  function screenLines(page) {
    if (page === 'RUN') {
      if (!loaded()) return [];
      const e = entryOf(st.run), run = runEntry(), b = selected();
      const view = run && run.view === 'marked' ? 'marked'
        : (run && run.baseline ? 'baseline' : String(run ? run.view : ''));
      return [e ? e.term : '', st.run, `${b ? b.position : ''} . ${view}`]
        .map(s => s.toUpperCase());
    }
    if (page === 'CARD') {
      const j = jsonOf(st.corpus);
      if (!j) return [];
      const pv = j.provenance;
      const hc = j.harness_commits ? Object.keys(j.harness_commits).length : 0;
      const n = { refused: 0, malformed: 0, begun: 0 };
      for (const r of j.runs) for (const s of r.series.status) if (s in n) n[s] += 1;
      const mp = /^(\d+)/.exec(String(j.caveats.malformed_predecessor || ''));
      const fails = [`${n.refused} refused`, `${n.malformed} malformed`]
        .concat(n.begun ? [`${n.begun} begun`] : []).join(', ');
      return [
        `export ${String(pv.analysis_commit).slice(0, 8)}  ${pv.analysis_dirty ? 'dirty' : 'clean'}`,
        `schema ${j.schema_version}`,
        `room hash ${String(j.room.room_hash).slice(0, 16)}`,
        `harness commits: ${hc} position${hc === 1 ? '' : 's'} carry one`,
        `${fails} sessions`,
        `${mp ? mp[1] : 0} malformed predecessors`,
      ].map(s => s.toUpperCase());
    }
    if (page === 'ROOM') {
      const r = room();
      if (!r || r.caption === null || r.roomSentence === null) return [];
      return [r.caption, r.roomSentence].map(s => String(s).toUpperCase());
    }
    if (page === 'CLOCKS') return [CLOCKS_SENTENCE];
    return [];
  }
  const angleOf = d => { const b = bendOf(d, st.form); return b === null ? null : aBend(b); };

  function paintNeedles() {
    for (const spec of BLOCKS) {
      const o = blockEls[spec.position];
      for (const k of ['dist', 'c', 'cw']) {
        const n = o.needles[k];
        if (n.shown) setNeedle(n.el, n.side, n.a, R + 3);
      }
    }
  }

  function render() {
    const r = room();
    root.dataset.mode = st.mode;
    root.dataset.form = st.form;
    if (bandParts.pilot) bandParts.pilot.dataset.mode = st.mode;
    root.dataset.synced = String(st.synced);
    if (bandParts.pilotRing) bandParts.pilotRing.dataset.ring = st.ring;
    const bank = r ? feeBank(r, st.form) : null;
    const sel = selected();

    roomName.textContent = r ? `ROOM ${r.corpus.toUpperCase()}` : '';
    const page = st.page || 'RUN';
    screen.dataset.page = page;
    for (const [p, b] of Object.entries(screenKeys)) {
      b.setAttribute('aria-pressed', String(p === page));
      b.querySelector('.pinpoint').setAttribute('data-lit', String(p === page));
    }
    screenText.textContent = '';
    for (const ln of screenLines(page)) screenText.appendChild(el('div', { class: 'crow' }, ln));

    for (const [form, lp] of Object.entries(rangeLamps)) {
      lp.setAttribute('data-lit', String(form === st.form));
      lp.classList.toggle('on', form === st.form);
    }
    rangeKey.setAttribute('aria-pressed', String(st.form === '2b'));
    peakKey.setAttribute('aria-pressed', String(st.peak));
    peakLamp.setAttribute('data-lit', String(st.peak));
    peakLamp.classList.toggle('on', st.peak);
    root.dataset.trace = st.trace ? 'on' : 'off';
    traceKey.setAttribute('aria-pressed', String(st.trace));
    traceLamp.setAttribute('data-lit', String(st.trace));
    traceLamp.classList.toggle('on', st.trace);
    if (st.trace) traceRGB = tokenRGB('--trace-blot', traceRGB);
    if (!holdOpt) {
      holdKey.classList.add('dark');
      holdKey.setAttribute('aria-disabled', 'true');
    }
    const atEnd = loaded() && st.k !== null && st.k >= N();
    stepKey.classList.toggle('dark', atEnd || st.frozen);
    stepKey.setAttribute('aria-disabled', String(atEnd || st.frozen));
    rewindKey.classList.toggle('dark', st.frozen);
    rewindKey.setAttribute('aria-disabled', String(st.frozen));

    const blocks = r ? feeBlocks(r) : [];
    for (const spec of BLOCKS) {
      paintBlock(blockEls[spec.position], blocks.find(x => x.position === spec.position) || null,
                 bank, sel);
    }
    counter.update({ session: st.k ?? 0, N: N(), live: true, cue: st.cue, winding: false });
    drawer.updateBank();
    paintNeedles();
  }

  function paintBlock(o, b, bank, sel) {
    const r = room();
    const dark = !b || b.dark;
    const isSel = !!(sel && sel.position === o.position && !dark);
    const marked = !!(isSel && sel.marked);
    const view = marked ? 'marked' : 'baseline';
    o.box.dataset.dark = String(dark);
    o.box.dataset.selected = String(isSel);
    o.svg.dataset.dark = String(dark);
    o.svg.dataset.light = dark ? 'dark' : (isSel ? 'lit' : 'off');
    if (o.field) o.field.dataset.light = o.svg.dataset.light;
    for (const e of o.darkParts) e.dataset.dark = String(dark);
    show(o.hatch, dark);
    show(o.darkBox, dark);
    if (dark && b) {
      const why = W.darkBlock(o.position, r.corpus);
      const cut = why.indexOf(' RUN IN ');
      o.darkLines[0].textContent = cut < 0 ? why : why.slice(0, cut);
      o.darkLines[1].textContent = cut < 0 ? '' : why.slice(cut + 1);
    }
    o.sel.setAttribute('data-lit', String(isSel));
    o.sel.classList.toggle('on', isSel);
    if (o.marked) {
      o.marked.setAttribute('data-lit', String(marked));
      o.marked.classList.toggle('on', marked);
    }

    for (const n of o.distNums) {
      n.lo.classList.toggle('live', st.form === '2bm1');
      n.lo.classList.toggle('alt', st.form !== '2bm1');
      n.hi.classList.toggle('live', st.form === '2b');
      n.hi.classList.toggle('alt', st.form !== '2b');
    }
    for (const [form, lp] of Object.entries(o.faceLamps)) {
      lp.g.setAttribute('data-lit', String(!dark && form === st.form));
    }

    o.curves.textContent = '';
    o.labels.textContent = '';
    const standCurves = !!(bank && bank.curves) && !dark && o.position !== 'NONE';
    show(o.curvesAbsent, !!(bank && !bank.curves) && !dark);
    if (standCurves) {
      const dN = feeCurve(r, 1, '2bm1').dNONE;
      for (const A of FAMILY) {
        const pts = curvePoints(A, dN);
        if (pts.length > 1) {
          o.curves.appendChild(smark('curve', 'polyline', { class: 'fam', 'data-a': String(A),
            points: pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') }));
        }
        const c0 = LABEL_C[A];
        const p = crossAt(dN / (1 + A * c0) ** 2, c0);
        if (p[1] >= 0 && p[1] <= FH && p[0] >= 0 && p[0] <= FW) {
          const txt = `A ${A}`;
          const w = 3.4 * txt.length + 3;
          o.labels.appendChild(sv('rect', { class: 'lblbreak', x: (p[0] - w / 2).toFixed(2),
            y: (p[1] - 3.8).toFixed(2), width: w.toFixed(2), height: '7.2' }));
          o.labels.appendChild(smark('curve-label', 'text', { class: 'lbl', 'data-a': String(A),
            x: p[0].toFixed(2), y: (p[1] + 2).toFixed(2), 'text-anchor': 'middle' }, txt));
        }
      }
      const own = feeImpliedA(r, o.position, 'c');
      o.curves.dataset.ownReason = own.A_en === null ? String(own.reason || '') : '';
      if (own.A_en !== null) {
        const pts = curvePoints(own.A_en, dN);
        if (pts.length > 1) {
          o.curves.appendChild(smark('own-curve', 'polyline', { class: 'own',
            'data-a-en': String(own.A_en),
            points: pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') }));
        }
      }
    }

    o.pooled.textContent = '';
    o.paths.textContent = '';
    const pooled = dark ? null : (marked ? feeMarked(r, o.position) : feePooled(r, o.position));
    if (pooled) {
      for (const t of pooled.ticks) {
        tickMark(o.pooled, 'pooled-tick', pl, aBend(t.bend), R + 2, R + 8, 'distortion', t.run);
        if (t.c !== null && t.c !== undefined) {
          tickMark(o.pooled, 'pooled-tick', pr, aCar(t.c), R + 2, R + 8, 'c', t.run);
        }
        if (o.position === 'CHAT' && t.cWriting !== null && t.cWriting !== undefined) {
          tickMark(o.pooled, 'pooled-tick-writing', pr, aCar(t.cWriting), R - 9, R - 3, 'c', t.run);
        }
      }
      const bm = pooled.bendMedian, cm = pooled.cMedian;
      tickMark(o.pooled, 'pooled-median', pl, aBend(bm), R + 2, R + 14, 'distortion', '');
      if (cm !== null && cm !== undefined) {
        tickMark(o.pooled, 'pooled-median', pr, aCar(cm), R + 2, R + 14, 'c', '');
        const p = cross(aBend(bm), aCar(cm));
        o.pooled.appendChild(smark('pooled-crossing', 'rect', { class: 'xmark',
          'data-bend': String(bm), 'data-c': String(cm),
          x: (p[0] - 3).toFixed(2), y: (p[1] - 3).toFixed(2), width: '6', height: '6' }));
      }
    }
    if (PATH_ON_FACE && !dark && b && b.asks === 'path') {
      for (const one of feePath(r, o.position, st.form).runs) {
        const pts = [];
        for (const pt of one.points) {
          if (pt.c === null || pt.bend === null) continue;
          pts.push(cross(aBend(pt.bend), aCar(pt.c)));
        }
        if (pts.length > 1) {
          o.paths.appendChild(smark('path', 'polyline', { class: 'runpath', 'data-run': one.run,
            points: pts.map(p => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ') }));
          const last = pts[pts.length - 1];
          o.paths.appendChild(smark('path-end', 'circle', { class: 'pathend',
            cx: last[0].toFixed(2), cy: last[1].toFixed(2), r: '1.6' }));
        }
      }
    }

    paintTrace(o, dark, isSel);

    const live = isSel && st.k !== null ? feeLive(r, st.run, st.k, st.form) : null;
    const mayRise = !!(isSel && live && hand.phase !== 'falling');
    setLiveNeedles(o, live, mayRise, dark);
    paintDetent(o, live, mayRise);
    paintPeak(o, mayRise ? feePeak(r, st.run, st.k, st.form) : null);
    paintClip(o, r, mayRise ? live : null, dark);
    o.malPred.g.setAttribute('data-lit', String(!!(live && live.predecessorMalformed)));

    const nx = dark ? null : feeNixies(r, o.position, st.run, st.k);
    setTubes(o.runsTubes, nx && nx.runs !== null ? String(nx.runs) : '', !!(nx && nx.runs !== null));
    setTubes(o.returnTubes, nx && nx.returns !== null ? String(nx.returns) : '',
             !!(nx && nx.returnsLit));
    const nf = live ? live.failedSinceS1 : 0;
    if (o.failCount) {
      o.failCount.textContent = isSel ? String(nf) : '';
      o.failCount.dataset.n = isSel ? String(nf) : '';
    } else {
      o.fail.textContent = isSel ? W.fail(nf) : W.failOff;
    }
    o.fail.classList.toggle('on', isSel && nf > 0);
    o.fail.hidden = false;
    for (const f of FAILED) {
      const on = !!(live && live.lamps[f]);
      o.status[f].setAttribute('data-lit', String(on));
      o.status[f].classList.toggle('on', on);
      o.status[f].hidden = false;
    }

    const nul = dark ? null : feeRankNull(r, o.position, view);
    o.rankRef.hidden = o.position !== 'NONE';
    o.rank.hidden = o.position === 'NONE' ? true
      : (dark ? false : (!nul || nul.p === null));
    o.rankNo05.hidden = !(nul && nul.floorAbove05);
    if (dark) {
      o.rank.textContent = '';
      delete o.rank.dataset.p;
      delete o.rank.dataset.floor;
    } else if (nul && nul.p !== null) {
      o.rank.textContent = W.rankVal(nul.p, nul.floor);
      o.rank.dataset.p = String(nul.p);
      o.rank.dataset.floor = String(nul.floor);
    }

    const sus = dark ? null : feeSustain(r, o.position, view);
    o.noteRate.hidden = !(o.position === 'NONE' && !dark);
    o.susScale.hidden = false;
    for (let i = 0; i < LAGS; i++) {
      const c = o.cells[i];
      const row = sus && sus.rows ? sus.rows[i] : null;
      c.cell.hidden = false;
      c.lag.hidden = false;
      if (!row) {
        c.rate.hidden = true;
        c.cell.dataset.state = dark ? 'unlit' : '';
        c.cell.dataset.lit = 'false';
        c.cell.dataset.sunken = 'false';
        c.cell.dataset.minus = 'false';
        c.cell.dataset.excess = '';
        c.cell.style.removeProperty('--sus');
        continue;
      }
      c.cell.dataset.state = row.state;
      c.cell.dataset.lit = String(row.lit);
      c.cell.dataset.sunken = String(row.sunken);
      c.cell.dataset.minus = String(row.minus);
      c.cell.dataset.excess = String(row.excessExact);
      if (row.lit) {
        const v = 0.55 + 0.45 * Math.min(1, Math.max(0, row.excessExact) / SUS_TOP);
        c.cell.style.setProperty('--sus', v.toFixed(3));
      } else {
        c.cell.style.removeProperty('--sus');
      }
      c.rate.hidden = o.position !== 'NONE';
      if (o.position === 'NONE') c.rate.textContent = row.rate.toFixed(2).replace(/^0/, '');
    }
    placeRateNote(o);
    if (document.fonts && document.fonts.status !== 'loaded') {
      document.fonts.ready.then(() => placeRateNote(o));
    }
  }

  function traceCrossings(position, isSel) {
    const r = room();
    if (!r || st.k === null) return [];
    const out = [];
    const take = (runId, session, bend, c) => {
      if (session < 2 || session > st.k) return;
      let cv = c;
      if (cv === null || cv === undefined) {
        if (position !== 'NONE') return;
        cv = 0;
      }
      if (bend === null || bend === undefined) return;
      const p = cross(aBend(bend), aCar(cv));
      out.push({ run: runId, session, age: st.k - session, x: p[0], y: p[1] });
    };
    if (isSel && loaded()) {
      const s = r.runById.get(st.run).series;
      for (let i = 0; i < s.session.length; i++) {
        take(st.run, s.session[i], s.bend_cum[i], s.c[i]);
      }
      return out;
    }
    const path = feePath(r, position, st.form);
    if (path) {
      for (const one of path.runs) {
        for (const pt of one.points) take(one.run, pt.session, pt.bend, pt.c);
      }
    }
    return out;
  }

  function drawField(o, pts) {
    const cv = o.field;
    const dpr = Math.max(1, window.devicePixelRatio || 1) * S;
    const w = Math.max(1, Math.round(FW * dpr));
    const h = Math.max(1, Math.round(FH * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    if (!pts.length) { bloom(cv, true); return; }
    const sx = w / FW, sy = h / FH, sm = Math.max(sx, sy);
    const I = new Float32Array(w * h);
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (const pt of pts) {
      const sg = blotSigma(pt.age);
      const k2 = 1 / (2 * sg * sg);
      const rd = TRACE_BLOT.reach * sg * sm;
      const cx = pt.x * sx, cy = pt.y * sy;
      const ax = Math.max(0, Math.floor(cx - rd)), bx = Math.min(w - 1, Math.ceil(cx + rd));
      const ay = Math.max(0, Math.floor(cy - rd)), by = Math.min(h - 1, Math.ceil(cy + rd));
      if (ax > bx || ay > by) continue;
      if (ax < x0) x0 = ax;
      if (bx > x1) x1 = bx;
      if (ay < y0) y0 = ay;
      if (by > y1) y1 = by;
      const pk = blotPeak(pt.age);
      for (let yy = ay; yy <= by; yy++) {
        const dy = (yy + 0.5) / sy - pt.y;
        const row = yy * w;
        for (let xx = ax; xx <= bx; xx++) {
          const dx = (xx + 0.5) / sx - pt.x;
          I[row + xx] += pk * Math.exp(-(dx * dx + dy * dy) * k2);
        }
      }
    }
    if (x1 < x0 || y1 < y0) return;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const img = ctx.createImageData(bw, bh);
    const data = img.data;
    const lr = traceRGB[0], lg = traceRGB[1], lb = traceRGB[2];
    for (let yy = 0; yy < bh; yy++) {
      const src = (y0 + yy) * w + x0, dst = yy * bw * 4;
      for (let xx = 0; xx < bw; xx++) {
        const v = 1 - Math.exp(-TRACE_BLOT.gain * I[src + xx]);
        const q = dst + xx * 4;
        data[q] = lr;
        data[q + 1] = lg;
        data[q + 2] = lb;
        data[q + 3] = Math.max(0, Math.min(255, Math.round(255 * v)));
      }
    }
    ctx.putImageData(img, x0, y0);
    bloom(cv);
  }

  const BLOOM = [[1.2, 0.85], [3.5, 0.55]];
  function bloom(cv, clear) {
    let b = cv.__bloom;
    if (!b || !b.isConnected) {
      b = el('canvas', { class: 'trace-bloom', 'aria-hidden': 'true' });
      cv.after(b);
      cv.__bloom = b;
    }
    b.style.cssText = cv.style.cssText;
    if (b.width !== cv.width || b.height !== cv.height) {
      b.width = cv.width;
      b.height = cv.height;
    }
    const g = b.getContext('2d');
    g.clearRect(0, 0, b.width, b.height);
    if (clear) return;
    const k = cv.width / (parseFloat(cv.style.width) || FW);
    g.globalCompositeOperation = 'lighter';
    for (const [r, a] of BLOOM) {
      g.filter = `blur(${r * k}px)`;
      g.globalAlpha = a;
      g.drawImage(cv, 0, 0);
    }
    g.filter = 'none';
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }

  function paintTrace(o, dark, isSel) {
    if (!st.trace || dark) {
      if (o.field) {
        if (o.field.__bloom) o.field.__bloom.remove();
        o.field.remove();
        o.field = null;
      }
      return;
    }
    if (!o.field) {
      o.field = mark('trace-field', 'canvas', { 'aria-hidden': 'true',
                                                'data-position': o.position });
      put(o.field, [o.fx, o.fy, FW, FH]);
      o.field.dataset.light = o.svg.dataset.light;
      deck.appendChild(o.field);
    }
    drawField(o, traceCrossings(o.position, isSel));
  }

  function toggleTrace() {
    st.trace = !st.trace;
    emit('fee-trace', { on: st.trace });
    render();
  }

  function tickMark(g, name, f, a, r0, r1, side, run) {
    const p = f(a, r0), q = f(a, r1);
    g.appendChild(smark(name, 'line', { class: 'ptick', 'data-side': side, 'data-run': run || '',
      x1: p[0].toFixed(2), y1: p[1].toFixed(2), x2: q[0].toFixed(2), y2: q[1].toFixed(2) }));
  }

  function curvePoints(A, dN) {
    const out = [];
    for (let i = 0; i <= 50; i++) {
      const c = i / 50;
      const k = 1 + A * c;
      if (!(k > 0)) continue;
      const p = crossAt(dN / (k * k), c);
      if (p[1] >= 0 && p[1] <= FH && p[0] >= 0 && p[0] <= FW) out.push(p);
    }
    return out;
  }

  function setLiveNeedles(o, live, mayRise, dark) {
    if (dark) {
      for (const k of ['dist', 'c', 'cw']) {
        const n = o.needles[k];
        n.shown = false; n.target = REST; n.a = REST; n.w = 0;
        n.el.dataset.target = '';
        show(n.el, false);
      }
      for (const side of ['distortion', 'c']) {
        show(o.rest[side], true);
        o.rest[side].dataset.reason = '';
      }
      o.box.dataset.resting = 'true';
      return;
    }
    const falling = hand.phase === 'falling' && hand.leaving === o.position;
    const want = {
      dist: mayRise && live.distortion !== null ? angleOf(live.distortion) : null,
      c: mayRise && live.c !== null ? aCar(live.c) : null,
      cw: mayRise && o.position === 'CHAT' && live.cWriting !== null ? aCar(live.cWriting) : null,
    };
    for (const k of ['dist', 'c', 'cw']) {
      const n = o.needles[k];
      if (falling) { n.target = REST; show(n.el, n.shown); continue; }
      const a = want[k];
      n.shown = a !== null;
      n.target = a === null ? REST : a;
      n.el.dataset.target = a === null ? '' : String(a);
      show(n.el, n.shown);
      if (reduced()) { n.a = n.target; n.w = 0; }
    }
    for (const side of ['distortion', 'c']) {
      const liveHere = falling ? o.needles[side === 'distortion' ? 'dist' : 'c'].shown
                               : (side === 'distortion' ? want.dist !== null : want.c !== null);
      show(o.rest[side], !liveHere);
      o.rest[side].dataset.reason = live && live.parked ? String(live.parkedReason || '') : '';
    }
    o.box.dataset.resting = String(want.dist === null && want.c === null && !falling);
  }

  function paintDetent(o, live, mayRise) {
    const on = !!(mayRise && live && live.detent && live.bend !== null);
    show(o.detent, on);
    if (!on) return;
    const half = live.detent.hi;
    const lo = aBend(-half), hi = aBend(half);
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const p = pl(lo + (hi - lo) * i / 8, R + 18);
      pts.push(`${p[0].toFixed(2)},${p[1].toFixed(2)}`);
    }
    o.detent.querySelector('.detbar').setAttribute('points', pts.join(' '));
    const ends = o.detent.querySelectorAll('.dend');
    [lo, hi].forEach((a, i) => {
      const p = pl(a, R + 14), q = pl(a, R + 18);
      ends[i].setAttribute('x1', p[0].toFixed(2)); ends[i].setAttribute('y1', p[1].toFixed(2));
      ends[i].setAttribute('x2', q[0].toFixed(2)); ends[i].setAttribute('y2', q[1].toFixed(2));
    });
    o.detent.dataset.lo = String(live.detentDistortion.lo);
    o.detent.dataset.hi = String(live.detentDistortion.hi);
    o.detent.dataset.half = String(half);
  }

  function paintPeak(o, peak) {
    const on = !!(peak && st.peak && peak.peak !== null);
    show(o.peak, on);
    if (!on) return;
    const a = angleOf(peak.distortion);
    const p = pl(a, R + 24), q1 = pl(a - 0.03, R + 32), q2 = pl(a + 0.03, R + 32);
    o.peak.setAttribute('d', `M${p[0].toFixed(2)} ${p[1].toFixed(2)} L${q1[0].toFixed(2)} `
      + `${q1[1].toFixed(2)} L${q2[0].toFixed(2)} ${q2[1].toFixed(2)} Z`);
    o.peak.dataset.peak = String(peak.peak);
  }

  function paintClip(o, r, live, dark) {
    const stands = o.position !== 'NONE';
    show(o.clip.g, stands);
    let lit = false, aEn = null;
    if (stands && live && live.bend !== null && live.c !== null) {
      const x = feeCrossingA(r, live.bend, live.c);
      aEn = x.A_en;
      lit = x.A_en !== null && x.A_en > TOP_A;
    }
    o.clip.g.setAttribute('data-lit', String(lit));
    o.clip.g.dataset.aEn = aEn === null ? '' : String(aEn);
  }

  function setTubes(tubeEls, text, lit) {
    const s = String(text || '').padStart(tubeEls.length, ' ');
    tubeEls.forEach((t, i) => {
      const on = lit && s[i] !== ' ';
      t.dataset.lit = String(on);
      t.querySelector('.digit').textContent = on ? s[i] : '';
    });
  }

  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function spring(n, target, dt) {
    const k = SPRING.K, c = 2 * (reduced() ? 1 : SPRING.ZETA) * Math.sqrt(k);
    let a = n.a, w = n.w, t = Math.min(dt, 0.25);
    while (t > 1e-9) {
      const h = Math.min(t, 0.004);
      w += (k * (target - a) - c * w) * h;
      a += w * h;
      t -= h;
    }
    n.a = a; n.w = w;
  }
  let last = null, raf = null;
  function tick(now) {
    const dt = last === null ? 0 : Math.min(0.25, (now - last) / 1000);
    last = now;
    for (const spec of BLOCKS) {
      const o = blockEls[spec.position];
      for (const k of ['dist', 'c', 'cw']) {
        const n = o.needles[k];
        if (reduced()) { n.a = n.target; n.w = 0; continue; }
        if (Math.abs(n.a - n.target) > 1e-4 || Math.abs(n.w) > 1e-3) spring(n, n.target, dt);
      }
    }
    if (hand.phase === 'falling') {
      const o = hand.leaving ? blockEls[hand.leaving] : null;
      const down = !o || ['dist', 'c', 'cw'].every(k =>
        Math.abs(o.needles[k].a - REST) < 0.004 && Math.abs(o.needles[k].w) < 0.05);
      if (down || reduced()) { hand.phase = 'rising'; shown = hand.entering; render(); }
    } else if (hand.entering) {
      shown = hand.entering;
    }
    paintNeedles();
    raf = requestAnimationFrame(tick);
  }

  function settle() {
    if (hand.phase === 'falling') {
      const o = hand.leaving ? blockEls[hand.leaving] : null;
      if (o) for (const k of ['dist', 'c', 'cw']) { o.needles[k].a = REST; o.needles[k].w = 0; }
      hand.phase = 'rising';
      shown = hand.entering;
      render();
    }
    for (const spec of BLOCKS) {
      const o = blockEls[spec.position];
      for (const k of ['dist', 'c', 'cw']) { o.needles[k].a = o.needles[k].target; o.needles[k].w = 0; }
    }
    paintNeedles();
    matchBadges();
    placeSync();
    placeStatusRow();
  }

  function setForm(form) {
    if (!FEE_RANGES.includes(form) || form === st.form) return;
    st.form = form;
    emit('fee-range', { form });
    render();
  }
  function stepSession() {
    if (!loaded() || st.frozen) return;
    const n = N();
    if (st.k !== null && st.k >= n) {
      emit('fee-dark', { key: 'STEP', why: W.whyStepEnd(n) });
      say(W.whyStepEnd(n));
      return;
    }
    counter.forgetSetting();
    st.k = st.k === null ? 1 : st.k + 1;
    emit('fee-step', { to: st.k });
    render();
  }
  function rewind() {
    if (!loaded() || st.frozen) return;
    counter.forgetSetting();
    st.k = 1;
    counter.reset();
    emit('fee-rewind', { to: 1 });
    render();
  }
  function togglePeak() {
    st.peak = !st.peak;
    emit('fee-peak', { on: st.peak });
    render();
  }

  chassis.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b === rangeKey) { setForm(st.form === '2bm1' ? '2b' : '2bm1'); return; }
    if (b === peakKey) { togglePeak(); return; }
    if (b === traceKey) { toggleTrace(); return; }
    if (b === stepKey) { stepSession(); return; }
    if (b === rewindKey) { rewind(); return; }
    if (b === holdKey) {
      if (holdOpt) return;
      emit('fee-dark', { key: 'HOLD', why: W.whyHold });
      say(W.whyHold);
    }
  });


  function bandRect(nm) {
    const r = (D.plates.find(p => p[0] === nm));
    if (!r) return null;
    const [, , c, span] = r;
    return [(span * CW + (span - 1) * GAP) * S, D.plateH];
  }
  function windowRects() {
    const px = e => [parseFloat(e.style.width), parseFloat(e.style.height)];
    const out = [[glass, px(glass)], [screen, px(screen)]];
    const ct = counterHost.querySelector('.counter');
    if (ct) out.push([ct, px(counterHost)]);
    return out;
  }
  const SHEEN = 'rgb(255 248 230)';

  function paintServers() {
    const host = sv('svg', { width: '0', height: '0', 'aria-hidden': 'true' });
    host.style.position = 'absolute';
    const defs = sv('defs');
    const stops = (g, rows) => {
      for (const [off, col, op] of rows) {
        const s = sv('stop', { offset: off, 'stop-color': col });
        if (op !== undefined) s.setAttribute('stop-opacity', op);
        g.appendChild(s);
      }
      return g;
    };
    defs.appendChild(stops(sv('radialGradient', {
      id: 'fee-enamel-lit', gradientUnits: 'userSpaceOnUse', cx: '0.5', cy: '0.05',
      r: '1', fx: '0.5', fy: '0.05', gradientTransform: `scale(${FW} ${FH})` }),
      [['0', '#fffaf0'], ['0.34', '#f5edd9'], ['0.70', '#e7ddc4'], ['1', '#cdc2a6']]));
    defs.appendChild(stops(sv('linearGradient', {
      id: 'fee-enamel-off', gradientUnits: 'userSpaceOnUse', x1: '0', y1: '0', x2: '0', y2: '1',
      gradientTransform: `scale(${FW} ${FH})` }),
      [['0', '#aca592'], ['0.5', '#beb6a2'], ['1', '#b9b19d']]));
    defs.appendChild(stops(sv('linearGradient', {
      id: 'fee-enamel-dark', gradientUnits: 'userSpaceOnUse', x1: '0', y1: '0', x2: '0', y2: '1',
      gradientTransform: `scale(${FW} ${FH})` }),
      [['0', '#6f6a5c'], ['0.5', '#837c6d'], ['1', '#8a8373']]));
    defs.appendChild(stops(sv('linearGradient', {
      id: 'jewel-recess', x1: '0', y1: '0', x2: '0', y2: '1' }),
      [['0', 'rgb(0 0 0)', '.62'], ['.5', 'rgb(0 0 0)', '.2'],
       ['.8', 'rgb(0 0 0)', '0'], ['1', 'rgb(255 250 235)', '.14']]));
    defs.appendChild(stops(sv('linearGradient', {
      id: 'bezel-sheen', x1: '0', y1: '0', x2: '0', y2: '1' }),
      [['0', SHEEN, '.34'], ['.5', SHEEN, '.14'], ['1', SHEEN, '.06']]));
    host.appendChild(defs);
    root.appendChild(host);
  }

  function roseFacets() {
    const th = (k, d = 0) => (-90 + 60 * k + d) * Math.PI / 180;
    const C = [0, 0, 1];
    const H = [], Gv = [], Gm = [];
    for (let k = 0; k < 6; k++) {
      H.push([0.5 * Math.cos(th(k)), 0.5 * Math.sin(th(k)), 0.62]);
      Gv.push([Math.cos(th(k)), Math.sin(th(k)), 0]);
      Gm.push([Math.cos(th(k, 30)), Math.sin(th(k, 30)), 0]);
    }
    const F = [];
    for (let k = 0; k < 6; k++) {
      F.push([C, H[k], H[(k + 1) % 6]]);
      F.push([H[k], H[(k + 1) % 6], Gm[k]]);
      F.push([H[k], Gm[(k + 5) % 6], Gv[k]]);
      F.push([H[k], Gv[k], Gm[k]]);
    }
    const L = [-0.45, -0.55, 0.7];
    const ln = Math.hypot(L[0], L[1], L[2]);
    const dots = F.map(([a, b, c]) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (n[2] < 0) n = n.map(x => -x);
      const m = Math.hypot(n[0], n[1], n[2]);
      return (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / (m * ln);
    });
    const mean = dots.reduce((a, b) => a + b, 0) / dots.length;
    const span = Math.max(...dots.map(d => Math.abs(d - mean)));
    const steps = dots.map(d => Math.round((d - mean) / span * 18 * 10) / 10);
    steps[dots.indexOf(Math.max(...dots))] += 8;
    return F.map((f, i) => [f.map(p => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join(' '),
                            steps[i]]);
  }

  function drawRoses() {
    const facets = roseFacets();
    const fill = d => `hsl(var(--fh) var(--fs) clamp(4%, calc(var(--fl) + var(--fk) * ${d}%), 94%))`;
    const line = 'hsl(var(--fh) var(--ss) clamp(4%, calc(var(--fl) + var(--sl)), 96%))';
    let n = 0;
    for (const e of root.querySelectorAll('.jewel')) {
      const s = sv('svg', { class: 'rose', viewBox: '-1 -1 2 2', 'aria-hidden': 'true' });
      s.appendChild(sv('circle', { r: '1', style: `fill: ${fill(-18)}` }));
      for (const [pts, d] of facets) {
        s.appendChild(sv('polygon', { points: pts,
          style: `fill: ${fill(d)}; stroke: ${line}; stroke-width: .035; stroke-linejoin: round` }));
      }
      s.appendChild(sv('circle', { class: 'shade', r: '1', style: 'fill: url(#jewel-recess)' }));
      s.appendChild(sv('rect', { class: 'bar', x: '-0.55', y: '-0.09', width: '1.1',
        height: '0.18', rx: '0.09', style: 'fill: rgb(236 231 216 / .92)' }));
      s.appendChild(sv('circle', { class: 'gird', r: '0.97', style: 'fill: none' }));
      e.appendChild(s);
      n++;
    }
    return n;
  }

  function drawCathodes() {
    let n = 0;
    for (const st2 of root.querySelectorAll('.tube .nstack')) {
      const have = new Set([...st2.children].map(i => i.textContent));
      '0123456789'.split('').forEach((d, k) => {
        if (have.has(d)) return;
        const i = el('i', {}, d);
        i.style.transform = `scale(${(0.975 + 0.0025 * k).toFixed(4)})`;
        st2.appendChild(i);
      });
      n++;
    }
    return n;
  }

  const BEZEL = [[-2.9, 4.2, '#15130f', 0.25, 4.0],
                 [-4.75, 0.7, 'rgb(0 0 0 / .55)', 0.35, 5.8],
                 [-1.05, 0.6, 'rgb(0 0 0 / .7)', 0.3, 2.2],
                 [-3.2, 1.1, 'url(#bezel-sheen)', 0.35, 4.3]];

  function drawBezels() {
    let n = 0;
    for (const b of BLOCKS) {
      const o = blockEls[b.position];
      const g = sv('g', { class: 'soft-ring', 'aria-hidden': 'true' });
      BEZEL.forEach(([i, w, paint, blur, rx], k) => {
        const sheen = k === 0 ? `drop-shadow(0 0.6px 0 ${SHEEN.replace('rgb', 'rgba').replace(')', ', .32)')}) ` : '';
        g.appendChild(sv('rect', { x: String(i), y: String(i),
          width: String(FW - 2 * i), height: String(FH - 2 * i), rx: String(rx),
          style: `fill: none; stroke: ${paint}; stroke-width: ${w}; filter: ${sheen}blur(${blur}px)` }));
      });
      o.svg.insertBefore(g, o.svg.firstChild);
      o.bezelFlat = o.svg.querySelector('.bezel');
      if (o.bezelFlat) o.bezelFlat.style.display = 'none';
      n++;
    }
    return n;
  }

  const RING = { seat: 0.3, bodyC: 1.8, bodyW: 3.0, edge: RING_EDGE };
  const RING_NICKEL = ['#efebe2', '#d6d1c5', '#9f998b'];
  let ringSeq = 0;

  function drawRing(e, rect) {
    const [w, h] = rect;
    const m = 8;
    const id = `fee-ring-${ringSeq++}`;
    const s = sv('svg', { class: 'trim-ring', 'aria-hidden': 'true',
                          viewBox: `${-m} ${-m} ${w + 2 * m} ${h + 2 * m}` });
    Object.assign(s.style, { position: 'absolute', left: -m + 'px', top: -m + 'px',
      width: (w + 2 * m) + 'px', height: (h + 2 * m) + 'px', overflow: 'visible',
      pointerEvents: 'none', zIndex: '2' });
    const defs = sv('defs');
    const g = sv('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: '0',
      y1: String(-RING.bodyC - RING.bodyW / 2), x2: '0',
      y2: String(h + RING.bodyC + RING.bodyW / 2) });
    RING_NICKEL.forEach((c, i) => g.appendChild(sv('stop',
      { offset: ['0', '.45', '1'][i], 'stop-color': c })));
    defs.appendChild(g);
    s.appendChild(defs);
    const r = parseFloat(getComputedStyle(e).borderTopLeftRadius) || 0;
    const rect4 = (i, sw, paint, extra) => s.appendChild(sv('rect', {
      x: String(-i), y: String(-i), width: String(w + 2 * i), height: String(h + 2 * i),
      rx: String(r + i),
      style: `fill: none; stroke: ${paint}; stroke-width: ${sw}; ${extra || ''}` }));
    rect4(RING.bodyC, RING.bodyW, `url(#${id})`,
          'filter: drop-shadow(0 0.8px 0.7px rgba(0,0,0,.42))');
    rect4(RING.edge, 0.5, 'rgba(70,64,52,.6)');
    rect4(RING.seat, 0.6, 'rgba(20,18,14,.72)');
    rect4(RING.bodyC - RING.bodyW / 2 + 0.55, 0.5, 'rgba(255,253,246,.5)', 'filter: blur(.2px)');
    if (getComputedStyle(e).position === 'static') {
      e.style.position = 'relative';
      e.style.top = '0px';
    }
    e.appendChild(s);
  }

  function drawGleam() {
    const plate = band.querySelector('.logoplate');
    if (!plate) return;
    const g = el('span', { class: 'brass-gleam', 'aria-hidden': 'true' });
    plate.appendChild(g);
  }

  function drawCitation() {
    const cite = band.querySelector('.citeplate');
    const doi = cite && cite.querySelector('.doi');
    if (!doi || cite.querySelector('.cite2')) return;
    const a = (cls, href, t, rel) => {
      const e = el('a', { class: cls, href, target: '_top' }, t);
      if (rel) e.setAttribute('rel', rel);
      return e;
    };
    const blk = el('div', { class: 'cite2' });
    const row = el('div', { class: 'crow' });
    row.append(a('who', doi.getAttribute('href'), W.author),
               a('clic', W.licenceHref, W.licence, 'license'));
    blk.append(doi, row);
    cite.appendChild(blk);
    const nn = band.querySelector('.nameplate .nname');
    if (nn) nn.textContent = W.modelRev;
  }

  let STATUS_UNROUNDED = [];
  const STATUS_GAP = 17.578;
  const CLIP_AIR = 0.75;

  let inkCtx;
  function inkOf(e, k) {
    if (!e) return null;
    const node = [...e.childNodes].find(c => c.nodeType === 3 && c.textContent.trim());
    if (!node) return null;
    const g = document.createRange();
    g.selectNodeContents(node);
    const b = g.getBoundingClientRect();
    if (!(b.width > 0)) return null;
    if (inkCtx === undefined) {
      const c = document.createElement('canvas');
      inkCtx = (c && c.getContext) ? c.getContext('2d') : null;
    }
    if (!inkCtx) return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, ink: false };
    const s = getComputedStyle(e);
    inkCtx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    if ('letterSpacing' in inkCtx) inkCtx.letterSpacing = s.letterSpacing;
    const m = inkCtx.measureText(node.textContent.replace(/^\s+|\s+$/g, ''));
    if (!(m && isFinite(m.actualBoundingBoxRight) && isFinite(m.fontBoundingBoxAscent))) {
      return { left: b.left, top: b.top, right: b.right, bottom: b.bottom, ink: false };
    }
    return {
      left: b.left + m.actualBoundingBoxLeft * k,
      right: b.right - (m.width - m.actualBoundingBoxRight) * k,
      top: b.top + (m.fontBoundingBoxAscent - m.actualBoundingBoxAscent) * k,
      bottom: b.bottom - (m.fontBoundingBoxDescent - m.actualBoundingBoxDescent) * k,
      ink: true,
    };
  }

  function placeRateNote(o) {
    if (!o || !o.noteRate || o.noteRate.hidden) return;
    if (!o.susScale || o.susScale.hidden || !o.rankWin || !o.rankLabel) return;
    const dr = deck.getBoundingClientRect();
    const dw = parseFloat(getComputedStyle(deck).width);
    if (!(dr.width > 0) || !(dw > 0)) return;
    const k = dr.width / dw;
    const e = o.noteRate;
    if (e.dataset.laidLeft === undefined) e.dataset.laidLeft = e.style.left;
    if (e.dataset.laidTop === undefined) e.dataset.laidTop = e.style.top;
    e.style.left = e.dataset.laidLeft;
    e.style.top = e.dataset.laidTop;
    const rates = (o.cells || []).map(c => c.rate).filter(r => r && !r.hidden);
    if (!rates.length) return;
    const sk = inkOf(o.susScale, k), lk = inkOf(o.rankLabel, k);
    if (!sk || !lk) return;
    const foot = Math.max(...rates.map(r => r.getBoundingClientRect().bottom));
    const gapB = o.rankWin.getBoundingClientRect().top - lk.bottom;
    const now = inkOf(e, k);
    if (!now) return;
    e.style.left = (parseFloat(e.style.left) + (sk.right - now.right) / k) + 'px';
    e.style.top = (parseFloat(e.style.top) + ((foot + gapB) - now.top) / k) + 'px';
  }

  function placeStatusRow() {
    const dr = deck.getBoundingClientRect();
    const dw = parseFloat(getComputedStyle(deck).width);
    if (!(dr.width > 0) || !(dw > 0)) return;
    const k = dr.width / dw;
    STATUS_UNROUNDED = [];
    const rect = e => e.getBoundingClientRect();
    const tr = e => {
      const n = [...e.childNodes].find(c => c.nodeType === 3
                                            && c.textContent.trim());
      if (!n) return rect(e);
      const g = document.createRange();
      g.selectNodeContents(n);
      return g.getBoundingClientRect();
    };
    const lt = e => { const w = e.querySelector('.lt'); return w ? tr(w) : rect(e); };
    const lay = e => {
      if (e.dataset.laidLeft === undefined) e.dataset.laidLeft = e.style.left;
      if (e.dataset.laidTop === undefined) e.dataset.laidTop = e.style.top;
      e.style.left = e.dataset.laidLeft;
      e.style.top = e.dataset.laidTop;
    };
    const TYPE_TOL = 0.3;
    const shift = (e, px, what, on) => {
      const mark = on || e;
      const now = rect(mark).left;
      const snapped = Math.round(now + px);
      const off = Math.abs(snapped - (now + px)) / k;
      const use = off > TYPE_TOL ? px : snapped - now;
      if (off > TYPE_TOL && what) STATUS_UNROUNDED.push(what);
      e.style.left = (parseFloat(e.style.left) + use / k) + 'px';
    };
    const bulbOf = e => (e && e.querySelector) ? e.querySelector('.bulb') : null;
    const snapTop = (e, what, on) => {
      const mark = on || e;
      const now = rect(mark).top;
      const off = Math.abs(Math.round(now) - now) / k;
      if (off > TYPE_TOL) {
        if (what) STATUS_UNROUNDED.push(what + ', down');
        return;
      }
      e.style.top = (parseFloat(e.style.top) + (Math.round(now) - now) / k) + 'px';
    };
    for (const spec of BLOCKS) {
      const o = blockEls[spec.position];
      if (!o) continue;
      const st = FAILED.map(f => o.status && o.status[f]).filter(Boolean);
      const cell8 = o.cells && o.cells[LAGS - 1];
      const lag8 = cell8 && cell8.lag;
      if (!o.sel || !o.marked || !lag8 || st.length !== 3) continue;
      for (const e of [o.sel, o.marked, o.susScale, ...st]) if (e) lay(e);
      if (o.sel.dataset.flipped === 'yes') {
        o.sel.classList.replace('left', 'right');
        o.sel.style.width = '';
        delete o.sel.dataset.flipped;
      }
      for (const e of st) e.style.width = '';
      const edge = tr(lag8).right;
      if (!(edge > 0)) continue;
      if (o.susScale) shift(o.susScale, edge - tr(o.susScale).right,
              spec.position + ' the caption');
      for (const e of st) e.style.width = 'max-content';
      const L = rect(st[0]).left;
      const w = st.map(e => lt(e).right - rect(e).left);
      const gap = (edge - L - w[0] - w[1] - w[2]) / 2;
      shift(st[1], L + w[0] + gap - rect(st[1]).left,
            spec.position + ' the second status lamp', bulbOf(st[1]));
      shift(st[2], edge - w[2] - rect(st[2]).left,
            spec.position + ' the third status lamp', bulbOf(st[2]));
      const was = rect(o.sel).right;
      o.sel.classList.replace('right', 'left');
      o.sel.style.width = 'max-content';
      o.sel.dataset.flipped = 'yes';
      shift(o.sel, was - rect(o.sel).right, spec.position + ' SELECTED',
            bulbOf(o.sel));
      const bulb = o.sel.querySelector('.bulb');
      if (bulb) {
        shift(o.marked, rect(bulb).left - STATUS_GAP * k - lt(o.marked).right,
              spec.position + ' MARKED', bulbOf(o.marked));
      }
      snapTop(o.sel, spec.position + ' SELECTED', bulbOf(o.sel));
      snapTop(o.marked, spec.position + ' MARKED', bulbOf(o.marked));
      st.forEach((e, i) => snapTop(e, spec.position + ` status lamp ${i + 1}`,
                                   bulbOf(e)));
      if (o.susScale) snapTop(o.susScale, spec.position + ' the caption');
      placeRateNote(o);
      const cg = o.clip && o.clip.g;
      const ctop = cg && cg.querySelector('.cliptop');
      const cword = cg && cg.querySelector('.lt');
      if (ctop && cword) {
        ctop.style.translate = '0px 0px';
        const csvg = cg.ownerSVGElement;
        const cm = csvg && csvg.getScreenCTM();
        const ks = cm ? Math.hypot(cm.a, cm.b) : 0;
        if (ks > 0) {
          const w = tr(cword), t = tr(ctop);
          const dx = (w.left - t.left) / ks;
          const dy = (w.bottom - t.top) / ks + CLIP_AIR;
          if (isFinite(dx) && isFinite(dy)) {
            ctop.style.translate = `${dx}px ${Math.max(0, dy)}px`;
          }
        }
      }
      const rt = o.runsTubes || [], et = o.returnTubes || [];
      if (o.runsLab && o.retLab && rt.length && et.length) {
        for (const t of rt) lay(t);
        const rg = rect(et[0]).left - tr(o.retLab).right;
        const d = tr(o.runsLab).right + rg - rect(rt[0]).left;
        if (d > 0) rt.forEach((t, i) => shift(t, d,
          spec.position + ` RUNS' tube ${i + 1}`));
      }
    }
  }

  function placeSync() {
    const plate = band.querySelector('.logoplate');
    const tray = document.getElementById('fee-drawer');
    if (!plate || !tray) return;
    const ref = Wd === 1100 ? plate : document.getElementById('fee-load');
    if (!ref) return;
    const pr = ref.getBoundingClientRect();
    const br = band.getBoundingClientRect();
    if (!(pr.width > 0) || !(br.width > 0)) return;
    const c = getComputedStyle(tray);
    const inset = (parseFloat(c.borderLeftWidth) || 0)
      + (parseFloat(c.paddingLeft) || 0);
    root.style.setProperty('--fee-sync-x', ((pr.left - br.left) / TRAY_S - inset) + 'px');
    root.style.setProperty('--fee-sync-w', pr.width + 'px');
    const key = document.getElementById('fee-synckey');
    if (key && key.offsetHeight > 0) {
      root.style.setProperty('--fee-sync-row', (key.offsetHeight / TRAY_S) + 'px');
    }
  }

  function matchBadges() {
    const q = sel => band.querySelector(sel);
    const N = q('.nameplate'), C = q('.citeplate');
    const nn = q('.nameplate .nname'), nd = q('.nameplate .ndesc');
    const doi = q('.citeplate .cite2 .doi') || q('.citeplate .doi');
    const row = q('.citeplate .crow');
    if (!N || !C || !nn || !nd || !doi || !row) return;
    const links = [...row.querySelectorAll('a')];
    if (!links.length) return;
    doi.style.removeProperty('font-size');
    doi.style.removeProperty('transform');
    row.style.removeProperty('transform');
    for (const a of links) a.style.removeProperty('font-size');
    const cx = matchBadges.cx
      || (matchBadges.cx = document.createElement('canvas').getContext('2d'));
    const cap = e => {
      const c = getComputedStyle(e);
      cx.font = `${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;
      return cx.measureText('H').actualBoundingBoxAscent;
    };
    const fs = e => parseFloat(getComputedStyle(e).fontSize);
    if (!(cap(nn) > 0) || !(cap(nd) > 0)
        || !(cap(doi) > 0) || !(cap(links[0]) > 0)) return;
    doi.style.fontSize = (fs(doi) * cap(nn) / cap(doi)) + 'px';
    const k = cap(nd) / cap(links[0]);
    for (const a of links) a.style.fontSize = (fs(a) * k) + 'px';
    const base = e => {
      const z = document.createElement('span');
      z.style.cssText = 'display:inline-block;width:0;height:0;'
        + 'vertical-align:baseline';
      e.appendChild(z);
      const y = z.getBoundingClientRect().top;
      z.remove();
      return y;
    };
    const right = e => {
      const g = document.createRange();
      g.selectNodeContents(e);
      const rs = [...g.getClientRects()].filter(r => r.width);
      if (!rs.length) return null;
      return Math.max(...rs.map(r => r.right))
        - (parseFloat(getComputedStyle(e).letterSpacing) || 0);
    };
    const nameCs = getComputedStyle(N);
    const padR = (parseFloat(nameCs.paddingRight) || 0)
      + (parseFloat(getComputedStyle(nn).letterSpacing) || 0)
      - (parseFloat(getComputedStyle(doi).letterSpacing) || 0);
    if (isFinite(padR) && padR >= 0) {
      C.style.setProperty('padding-right', padR + 'px', 'important');
    }
    const geo = () => {
      const n = N.getBoundingClientRect(), c = C.getBoundingClientRect();
      const z = links[links.length - 1];
      return {
        name: { top: base(nn) - cap(nn) - n.top,
                gap: base(nd) - cap(nd) - base(nn),
                right: n.right - right(nn), right2: n.right - right(nd) },
        doi: { top: base(doi) - cap(doi) - c.top,
               gap: base(links[0]) - cap(links[0]) - base(doi),
               right: c.right - right(doi), right2: c.right - right(z) },
      };
    };
    const g = geo(), d = g.doi, m = g.name;
    if (right(nn) === null || right(doi) === null) return;
    doi.style.transform =
      `translate(${d.right - m.right}px, ${m.top - d.top}px)`;
    row.style.transform = `translate(${d.right2 - m.right2}px, `
      + `${(m.top - d.top) + (m.gap - d.gap)}px)`;
  }

  function dressFurniture() {
    for (const b of BLOCKS) {
      const o = blockEls[b.position];
      if (!o.failCount) {
        o.fail.textContent = '';
        o.fail.append(el('span', {}, W.failOff), document.createTextNode(' '),
                      el('span', { class: 'fc' }));
        o.failCount = o.fail.querySelector('.fc');
      }
      if (!o.rankWin) {
        const left = o.x + 10 + 1.5;
        const right = o.x + 10 + 1.5 + (LAGS - 1) * 29 + 19;
        const win = el('div', { class: 'rankwin', 'aria-hidden': 'true' });
        put(win, [left, parseFloat(o.rank.style.top), right - left, 14]);
        deck.insertBefore(win, o.rank);
        o.rankWin = win;
        o.rank.style.left = (left + 5) + 'px';
        o.rankRef.style.left = (left + 5) + 'px';
        o.rankRef.style.top = o.rank.style.top;
        o.rankNo05.style.top = o.rank.style.top;
      }
      const mp = o.malPred.lt;
      if (mp && !o.malPred.lt2) {
        mp.textContent = W.malformed;
        const t2 = sv('text', { class: 'lt', x: mp.getAttribute('x'),
                                y: String(parseFloat(mp.getAttribute('y')) + 11) },
                      W.predecessor);
        o.malPred.g.appendChild(t2);
        o.malPred.lt2 = t2;
      }
    }
  }

  function dressFace() {
    paintServers();
    drawBezels();
    drawRoses();
    drawCathodes();
    dressFurniture();
    drawCitation();
    matchBadges();
    placeSync();
    placeStatusRow();
    drawGleam();
    for (const [sel, rect] of [['.logoplate', bandRect('wordmark')],
                               ['.citeplate', bandRect('doi-placard')],
                               ['.nameplate', bandRect('fee-nameplate')]]) {
      const e = band.querySelector(sel);
      if (e && rect) drawRing(e, rect);
    }
    for (const [e, rect] of windowRects()) if (e) drawRing(e, rect);
  }

  drawer.updateKnobs();
  dressFace();
  render();
  raf = requestAnimationFrame(tick);

  return {
    root, chassis, st, bus, counter, drawer,
    statusUnrounded: () => [...STATUS_UNROUNDED],
    width, marks: [...MARKS], off: [...MARKS_OFF], events: FEE_EVENTS, bank: slots,
    six: { ...FEE_SIX }, bankKey: BANK_KEY,
    geometry: {
      width: Wd, cols: COLS, rows: ROWS, scale: S,
      deck: [M, Y0, DECK_W, DECK_H], place: { ...PLACE },
      page: PW, pageHeight: PAGE_H, chassisHeight: PB_Y,
      columns: Array.from({ length: COLS }, (_, i) =>
        [M + col(i) * S, M + (col(i) + CW) * S]),
      band: [M - CH, MY, DECK_W * S + 2 * CH, BAND_H],
      bandPlates: Object.fromEntries(D.plates.map(([nm, r, c, span]) =>
        [nm, [M + col(c) * S, MY + BAND_PAD + r * (D.plateH + D.bandGap),
              (span * CW + (span - 1) * GAP) * S, D.plateH]])),
      button: [PB_BW, PB_BH], gap: PB_G,
      counter: [sw(2), sh(2)], range: [sw(2), PB_BH],
      face: [FW, FH], pivots: { inset: PIV, apart: SEP, below: FOOT },
      arc: { r: R, a0: A0, a1: A1 },
      presetBank: { top: PB_Y, foot: PB_Y + PB_H, rows: [...PB_ROW_Y],
                    load: [PB_LOAD_X, PB_LOAD_X + D.loadW],
                    keys: PB_KEY_X.map(v => [v, v + PB_KW]),
                    keySize: [PB_KW, PB_BH_FOOT], loadSize: [D.loadW, PB_H] },
      tray: [TRAY_TOP, PB_Y], rowGutter: ROW_GAP, colGutter: GAP,
      family: [...FAMILY], topA: TOP_A, labelC: { ...LABEL_C }, rest: REST,
      sustainTop: SUS_TOP, spring: { ...SPRING }, lampDecay: LAMP_DECAY,
      traceBlot: { ...TRACE_BLOT },
    },
    readings: () => {
      const r = room();
      if (!r || !loaded()) return null;
      const sel = selected();
      const live = feeLive(r, st.run, st.k, st.form);
      const out = {
        run: st.run, corpus: r.corpus, k: st.k, N: N(), form: st.form,
        position: sel.position, view: sel.view, marked: sel.marked,
        bank: feeBank(r, st.form),
        live,
        peak: feePeak(r, st.run, st.k, st.form),
        crossing: live.bend === null || live.c === null ? null
          : feeCrossingA(r, live.bend, live.c),
        blocks: {},
      };
      for (const b of feeBlocks(r)) {
        const v = b.position === sel.position && sel.marked ? 'marked' : 'baseline';
        out.blocks[b.position] = {
          dark: b.dark, reason: b.reason, asks: b.asks, view: v,
          pooled: b.dark ? null : (v === 'marked' ? feeMarked(r, b.position) : feePooled(r, b.position)),
          impliedA: b.dark ? null : feeImpliedA(r, b.position, 'c'),
          rankNull: b.dark ? null : feeRankNull(r, b.position, v),
          sustain: b.dark ? null : feeSustain(r, b.position, v),
          nixies: b.dark ? null : feeNixies(r, b.position, st.run, st.k),
          path: b.dark || b.asks !== 'path' ? null : feePath(r, b.position, st.form),
          trace: {
            on: st.trace,
            crossings: b.dark ? []
              : traceCrossings(b.position, b.position === sel.position),
          },
        };
      }
      return out;
    },
    state: () => ({
      run: st.run, corpus: st.corpus, k: st.k, N: N(), form: st.form,
      peak: st.peak, trace: st.trace, cue: st.cue, mode: st.mode, slot: st.slot,
      position: loaded() ? selected().position : null,
      view: loaded() ? selected().view : null,
      marked: loaded() ? selected().marked : false,
      loaded: loaded(), synced: st.synced, ring: st.ring, frozen: st.frozen, shown,
      handover: { ...hand },
      scale: feeScale(st.form),
      reduced: reduced(),
    }),
    settle,
    setSynced: v => { st.synced = !!v; render(); },
    setRing: v => { st.ring = v; render(); },
    choose, setForm, step: stepSession, rewind, togglePeak, toggleTrace, render,
    goTo: s => { if (st.frozen) return; counter.forgetSetting(); st.k = s; render(); },
    load: id => {
      const i = slots.findIndex(s => s.key.replace(/^file:/, '') === id);
      if (i >= 0) { choose(i); return true; }
      if (!corpusOf(id)) return false;
      bankDrop(slots, st.slot, id, 6, blank);
      choose(st.slot);
      return true;
    },
    keys: { range: rangeKey, peak: peakKey, trace: traceKey, step: stepKey,
            rewind: rewindKey, hold: holdKey,
            cue: counter.keyEls.cue, locate: counter.keyEls.locate, load: drawer.modeKey,
            presets: drawer.presetKeys, sync: drawer.syncKey },
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
    doi: 'doi:10.5281/zenodo.23663062', who: 'Mike Edwards',
    licence: 'CC BY-NC-SA 4.0',
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
    const HREF = { weblog: 'https://preterite.net/weblog/',
                   doi: 'https://doi.org/10.5281/zenodo.23663062',
                   deed: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' };
    const link = (cls, href, text, more = {}) => el('a', { class: cls, href, target: '_top', ...more }, text);
    const plate = el('div', { class: 'logoplate' });
    put(plate, [b.logo[0], b.plateY, b.logo[1], b.plateH]);
    const word = mark('wordmark', 'a', { class: 'logoword', href: HREF.weblog, target: '_top',
                                         title: 'Preterition, the weblog' }, 'Preterition');
    plate.appendChild(word);
    band.appendChild(plate);

    const pilot = el('div', { class: 'pilot' });
    put(pilot, [b.pilot - 4, b.pilotTop - 4, 16, 16]);
    pilot.appendChild(mark('pilot-core', 'i', { class: 'core', 'aria-hidden': 'true' }));
    pilot.appendChild(mark('pilot-ring', 'i', { class: 'ring', 'aria-hidden': 'true', 'data-ring': 'none' }));
    band.appendChild(pilot);

    const citeOf = (small) => {
      const c = mark('doi-placard', 'div', { class: 'citeplate' + (small ? ' small' : '') });
      c.append(link('doi', HREF.doi, W.doi), link('who', HREF.doi, W.who),
               link('clic', HREF.deed, W.licence, { rel: 'license' }));
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
    const head = it;
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



const ZOE_SHARED = ['detent', 'lock', 'unlock', 'thunk', 'seat', 'rattle', 'shuffler', 'rewind', 'answer'];
const MISS = 'a, button, .pilot, .snd';
const STORE = 'deck-sound';

async function loadCues({ base = 'sounds/', sets = [['cues.json', ZOE_SHARED], ['fee-cues.json', null]], lazy = [] } = {}) {
  const inline = document.getElementById('fee-cues');
  if (inline) return JSON.parse(inline.textContent);
  const out = { roles: {}, compound: {} };
  for (const [file, keep] of sets) {
    const r = await fetch(base + file);
    if (!r.ok) throw new Error(`${file}: ${r.status}`);
    const j = await r.json();
    for (const [role, c] of Object.entries(j.roles)) {
      if (keep && !keep.includes(role)) continue;
      out.roles[role] = { gain: c.gain, events: c.events || [], seconds: c.seconds, url: base + c.file,
                          ...(c.loop ? { loop: c.loop } : {}), ...(c.lazy || lazy.includes(role) ? { lazy: true } : {}) };
    }
    for (const [ev, steps] of Object.entries(j.compound || {})) {
      if (steps.every(s => out.roles[s.role])) out.compound[ev] = steps;
    }
  }
  return out;
}

function makeFeeSound(data) {
  const map = {};
  for (const [role, c] of Object.entries(data.roles)) for (const ev of c.events) map[ev] = role;
  const S = { on: true, ready: false, played: [], count: {}, errors: 0, roles: Object.keys(data.roles), map, audio: [],
              fetched: [] };
  try { S.on = localStorage.getItem(STORE) !== 'off'; } catch (e) {   }
  let ctx = null, waking = null, afterLoad = false, held = false;
  const bufs = {}, live = {}, loading = {}, pend = {};
  const b64 = s => { const t = atob(s), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u.buffer; };
  const note = what => {
    S.audio.push({ at: Math.round(performance.now()), what, state: ctx ? ctx.state : 'none' });
    if (S.audio.length > 200) S.audio.shift();
  };
  function revive(why) {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    note('resume ' + why);
    try { const p = ctx.resume(); if (p && p.catch) p.catch(() => note('refused ' + why)); } catch (e) { note('threw ' + why); }
  }
  function load(role) {
    if (bufs[role]) return Promise.resolve();
    if (!loading[role]) {
      const c = data.roles[role];
      const bytes = c.mp3 ? Promise.resolve(b64(c.mp3))
        : fetch(c.url).then(r => { if (!r.ok) throw new Error(c.url); S.fetched.push(role); return r.arrayBuffer(); });
      loading[role] = bytes.then(a => ctx.decodeAudioData(a)).then(b => { bufs[role] = b; }, () => { S.errors += 1; });
    }
    return loading[role];
  }
  function wake() {
    if (waking) return waking;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); note('created');
    const onState = () => { note('statechange'); revive('on statechange'); };
    if (ctx.addEventListener) ctx.addEventListener('statechange', onState); else ctx.onstatechange = onState;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') { note('hidden'); return; }
      note('visible'); revive('on return to view');
    });
    waking = Promise.all(Object.keys(data.roles).filter(r => !data.roles[r].lazy).map(load)).then(() => { S.ready = true; });
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
      s.loop = true;
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
  S.hear = (name, d = {}) => {
    if (name === 'knob-turn' && d.by !== 'reader') return;
    if (name === 'load-done') { afterLoad = true; queueMicrotask(() => { afterLoad = false; }); }
    if (name === 'preset' && afterLoad) { afterLoad = false; return; }
    const steps = data.compound && data.compound[name];
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
  function whenReady(role, f) {
    if (!S.on || !data.roles[role]) return;
    const w = wake(); if (!w) return;
    if (S.ready && bufs[role]) { f(); return; }
    if (pend[role]) return;
    pend[role] = true;
    w.then(() => load(role)).then(() => { pend[role] = false; f(); });
  }
  S.egg = role => { if (!live[role]) whenReady(role, () => { if (!live[role]) play(role); }); };
  S.hold = (role, down) => {
    held = down;
    const l = live[role];
    if (l) { l.s.loop = down; return; }
    if (down) whenReady(role, () => { if (!live[role]) play(role, 0, 1, 1, true); if (!held && live[role]) live[role].s.loop = false; });
  };
  S.sounding = role => !!live[role];
  S.wake = wake;
  const toggles = [];
  function show() {
    for (const t of toggles) {
      t.el.setAttribute('aria-pressed', String(S.on));
      t.el.setAttribute('aria-label', S.on ? 'sound on; press to turn it off' : 'sound off; press to turn it on');
      if (t.arc) t.arc.style.display = S.on ? '' : 'none';
      t.cross.style.display = S.on ? 'none' : '';
    }
  }
  S.set = on => {
    S.on = on; show();
    try { localStorage.setItem(STORE, on ? 'on' : 'off'); } catch (e) {   }
    if (!on) for (const r of Object.keys(live)) stop(r);
  };
  S.bindToggle = el => {
    if (!el) return;
    el.removeAttribute('aria-hidden'); el.setAttribute('role', 'button'); el.tabIndex = 0; el.style.cursor = 'pointer';
    const svg = el.querySelector('svg'), arc = svg && svg.querySelector('.on');
    const cross = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    cross.setAttribute('class', 'off'); cross.setAttribute('d', 'M9.6 3.5l4 4M13.6 3.5l-4 4');
    cross.setAttribute('fill', 'none'); cross.setAttribute('stroke', 'currentColor');
    cross.setAttribute('stroke-width', '1.3'); cross.setAttribute('stroke-linecap', 'round');
    if (svg) svg.appendChild(cross);
    toggles.push({ el, arc, cross });
    el.addEventListener('click', () => S.set(!S.on));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.set(!S.on); } });
    show();
  };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, wake, { capture: true, passive: true });
  return S;
}

function wireFee(SND, fee, { quietPreset = () => false } = {}) {
  let afterLoad = false, page = fee.st.page || 'RUN';
  fee.bus.on('*', (name, d = {}) => {
    if (DRAWER_EVENTS.includes(name)) {
      if (name === 'load-done') afterLoad = true;
      if (name === 'preset' && afterLoad) { afterLoad = false; return; }
      if (name === 'preset' && quietPreset()) return;
      SND.hear(name, d);
      return;
    }
    if (name === 'fee-peak') SND.hear('fee:peak', d);
    else if (name === 'fee-range') SND.hear('fee:range', d);
    else if (name === 'fee-screen') { if (d.page !== page) SND.hear('fee:screen', d); page = d.page; }
    else if (name === 'fee-trace') SND.hear(d.on ? 'fee:trace-on' : 'fee:trace-off', d);
    else if (name === 'fee-step') SND.hear('fee:step', d);
    else if (name === 'fee-rewind') SND.hear('rewind', d);
  });
  const root = fee.root, miss = e => !e.target.closest(MISS);
  const lp = root.querySelector('.logoplate');
  if (lp) {
    lp.addEventListener('pointerdown', e => {
      if (!miss(e) || e.button > 0) return;
      try { lp.setPointerCapture(e.pointerId); } catch (x) {   }
      SND.hold('fee-beat', true);
    });
    for (const ev of ['pointerup', 'pointercancel']) lp.addEventListener(ev, () => SND.hold('fee-beat', false));
    lp.addEventListener('contextmenu', e => { if (miss(e)) e.preventDefault(); });
  }
  const on = (sel, f) => root.querySelectorAll(sel).forEach(el => el.addEventListener('click', e => { if (miss(e)) f(el); }));
  on('.citeplate', () => SND.egg('answer'));
  on('.nplate', () => SND.egg('fee-voice'));
  on('svg.dial .faceplate', () => SND.egg('fee-glass'));
  SND.bindToggle(root.querySelector('.snd'));
}

function wireFlo(SND, flo, { following = () => false } = {}) {
  const cue = role => SND.hear('flo:' + role, {});
  const s0 = flo.state();
  const last = { view: s0.view, display: s0.display, floor: s0.floorIn ? 'FLOOR IN' : 'BYPASS', window: s0.window };
  const changed = (k, v) => { const c = last[k] !== v; last[k] = v; return c; };
  let afterLoad = false;
  flo.bus.on('*', (name, d = {}) => {
    if (DRAWER_EVENTS.includes(name)) {
      if (name === 'load-done') afterLoad = true;
      if (name === 'preset' && afterLoad) { afterLoad = false; return; }
      if (name === 'preset' && following()) return;
      SND.hear(name, d);
      return;
    }
    if (name === 'view') { if (changed('view', d.view)) cue(d.view === 'POSITION' ? 'view-position' : 'view-returns'); }
    else if (name === 'display') { if (changed('display', d.position)) cue(d.position === 'NUMBERS' ? 'display-numbers' : 'display-history'); }
    else if (name === 'floor') { if (changed('floor', d.floor)) cue(d.floor === 'FLOOR IN' ? 'chirp-on' : 'chirp-off'); }
    else if (name === 'window') { if (changed('window', d.window)) cue('gate-' + d.window); }
    else if (name === 'peak' || name === 'solo') cue(d.on ? 'chirp-on' : 'chirp-off');
    else if (name === 'zoom') cue('zoom-in');
    else if (name === 'zoom-leave' && d.by === 'zoom') cue('zoom-out');
  });
  const root = flo.root, miss = e => !e.target.closest('a, button');
  const badge = root.querySelector('.badge');
  if (badge) badge.addEventListener('click', () => SND.egg('flo-voice'));
  const lp = root.querySelector('.logoplate');
  if (lp) {
    lp.addEventListener('pointerdown', e => {
      if (!miss(e) || e.button > 0) return;
      try { lp.setPointerCapture(e.pointerId); } catch (x) {   }
      SND.hold('beat', true);
    });
    for (const ev of ['pointerup', 'pointercancel']) lp.addEventListener(ev, () => SND.hold('beat', false));
    lp.addEventListener('contextmenu', e => { if (miss(e)) e.preventDefault(); });
  }
  for (const plate of root.querySelectorAll('.citeplate:not(.small), .doistrip')) {
    plate.addEventListener('click', e => { if (miss(e)) SND.egg('answer'); });
  }
  SND.bindToggle(root.querySelector('.snd'));
}


const T = { ready: false, errors: [] };
window.__feeflo = T;
window.addEventListener('error', e => T.errors.push(String(e.message)));

const $ = id => document.getElementById(id);
const sayEl = $('say');
const say = s => { sayEl.textContent = ''; sayEl.textContent = s; };
const qs = new URLSearchParams(location.search);
const forcedW = Number(qs.get('w'));
const width = [1100, 760, 375].includes(forcedW) ? forcedW
  : (innerWidth >= 1100 ? 1100 : innerWidth >= 760 ? 760 : 375);

const FEE_ROOMS = ['s7', 's36', 's105', 's3457'];
const FLO_ROOMS = ['S7', 'S36', 'S105', 'S3457'];

(async () => {
  const block = id => JSON.parse(document.getElementById(id).textContent);
  const feeData = block('fee-data');
  const floData = block('flo-data');
  const index = feeData.index;
  const rooms = {};
  FEE_ROOMS.forEach(c => { rooms[c] = { room: makeFeeRoom(feeData.blocks[c]), json: feeData.blocks[c] }; });
  const bounds = floData.bounds;
  const checks = floData.checks;
  const floors = floData.floors;
  const runFile = async id => (Object.prototype.hasOwnProperty.call(floData.runs, id) ? floData.runs[id] : null);

  let storage = null;
  try { storage = window.localStorage; } catch { storage = null; }

  const fee = mountFee({
    host: $('fee-mount'),
    width,
    data: { index, rooms, order: FEE_ROOMS },
    say,
    storage,
    drawerIds: { drawer: 'fee-drawer', modeKey: 'fee-load', pick: 'fee-pick',
                 syncKey: 'fee-synckey' },
    syncShown: true,
    hold: true,
    flush: true,
  });
  fee.choose(0);

  const flo = mountFlo({
    host: $('flo-stage'),
    width,
    data: { index, bounds, checks, floors, runFile },
    say,
    storage,
    drawerIds: { drawer: 'flo-drawer', modeKey: 'flo-load', pick: 'flo-pick',
                 syncKey: 'flo-synckey' },
    drawerOver: true,
    syncShown: true,
    hold: true,
  });
  flo.root.style.height = (flo.layout.bank[1] + flo.layout.bank[3]) + 'px';

  const hs = { phase: 'idle', by: null, t0: 0 };
  let feeHold = 'off';
  let floHold = 'off';

  const bare = k => String(k).replace(/^file:/, '');
  const armedNow = () => hs.phase === 'synced';
  const feeK = () => fee.state().k;
  const floOnFeesRun = () => { const s = flo.state(); return s.loaded && s.run === fee.state().run; };
  const floSlotOf = id => flo.bank.findIndex(s => bare(s.key) === id);
  const feeSlotOf = id => fee.bank.findIndex(s => bare(s.key) === id);
  const ontoFee = k => (k === null || k === undefined ? null : Math.min(k, fee.state().N));

  const floSync = flo.drawer.syncKey;
  floSync.style.flex = '';
  flo.drawer.drawer.querySelector('.picker').appendChild(floSync);
  floSync.addEventListener('click', () => press('flo'));

  const feeSync = $('fee-synckey');
  const feeSyncHost = feeSync.parentElement;
  feeSyncHost.addEventListener('click', e => {
    if (!e.target.closest('#fee-synckey')) return;
    e.stopPropagation();
    if (feeSync.getAttribute('aria-disabled') === 'true') return;
    press('fee');
  }, true);

  const KEY = { fee: feeSync, flo: floSync };
  const NAME = { fee: 'FEE', flo: 'Flo' };
  const PILOT = { fee: fee.root.querySelector('.pilot'), flo: flo.root.querySelector('.pilot') };
  const other = s => (s === 'fee' ? 'flo' : 'fee');
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
    for (const s of ['fee', 'flo']) {
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
          p.setAttribute('aria-label', NAME[other(s)] + ' proposes sync: open the loader to accept');
          p.removeAttribute('aria-hidden'); }
        else { p.removeAttribute('role'); p.removeAttribute('tabindex'); p.removeAttribute('aria-label');
          p.setAttribute('aria-hidden', 'true'); }
      }
    }
  }
  const openTray = s => (s === 'fee' ? fee.drawer.setMode('LOAD') : flo.drawer.setMode('LOAD'));
  for (const s of ['fee', 'flo']) {
    const p = PILOT[s]; if (!p) continue;
    const go = () => { if (p.dataset.invite === 'true') openTray(s); };
    p.addEventListener('click', go);
    p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  }
  function setPhase(phase, by = hs.by) {
    hs.phase = phase; hs.by = phase === 'idle' ? null : by; hs.t0 = performance.now();
    paintKeys(); syncNow();
  }
  function press(s) {
    if (hs.phase === 'syncing') return;
    if (hs.phase === 'idle') { setPhase('proposed', s); say(`${NAME[s]} proposes sync; ${NAME[other(s)]} can accept from the pilot or the loader`); return; }
    if (hs.phase === 'proposed' && s === hs.by) { setPhase('idle'); say('sync proposal withdrawn'); return; }
    if (hs.phase === 'proposed') { accept(hs.by); return; }
    if (hs.phase === 'synced') { endHold(); endFloHold(); setPhase('idle'); say('sync released'); }
  }

  async function accept(by) {
    setPhase('syncing', by);
    const t0 = hs.t0;
    let ok = true, why = '';
    if (by === 'fee') {
      if (flo.state().mode === 'LOAD') flo.drawer.setMode('PLAY');
      if (!flo.drawer.setBank({ kind: 'run', keys: fee.bank.map(x => x.key), slot: fee.state().slot }, 'peer:fee')) {
        ok = false; why = 'Flo refused FEE\'s library';
      }
      const until = performance.now() + 4000;
      while (ok && !floOnFeesRun() && performance.now() < until) await new Promise(r => setTimeout(r, 50));
      if (ok && !floOnFeesRun()) { ok = false; why = 'Flo cannot read this run: the page carries no Flo reading for it'; }
    } else {
      const k = flo.state().k, fs = flo.state().slot;
      if (fee.state().mode === 'LOAD') fee.drawer.setMode('PLAY');
      if (!fee.drawer.setBank({ kind: 'run', keys: flo.bank.map(x => x.key), slot: fs }, 'peer:flo')) {
        ok = false; why = 'FEE refused Flo\'s library';
      } else if (fee.state().run !== bare(flo.bank[fs].key)) {
        ok = false; why = 'FEE does not hold this run';
      } else {
        fee.goTo(ontoFee(k));
      }
    }
    const wait = FLOOR_MS - (performance.now() - t0);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    if (hs.phase !== 'syncing' || hs.t0 !== t0) return;
    if (ok) { setPhase('synced'); say(`FEE and Flo synced at ${feeK() ? 'S' + feeK() : 'the leader'}`); }
    else { setPhase('idle'); say('sync failed: ' + why); }
  }

  function computeSync() {
    const armed = armedNow();
    const synced = armed && fee.state().mode === 'PLAY' && flo.state().mode === 'PLAY' && floOnFeesRun();
    const ring = hs.phase === 'idle' ? 'none' : (hs.phase === 'synced' ? 'whole' : 'broken');
    return { armed, synced, ring };
  }
  let lastFloFrozen = null, lastRing = null, lastFeeSynced = null;
  function applySync(floFrozen, synced, ring) {
    if (floFrozen !== lastFloFrozen) { flo.setSynced(floFrozen); lastFloFrozen = floFrozen; }
    if (synced !== lastFeeSynced) { fee.setSynced(synced); lastFeeSynced = synced; }
    if (ring !== lastRing) { flo.setRing(ring); fee.setRing(ring); lastRing = ring; }
  }
  function followOnce() {
    const target = feeK();
    if (flo.state().k !== target) { flo.counter.forgetSetting(); flo.goTo(target); }
  }
  function syncNow() {
    const c = computeSync();
    if (!c.synced && feeHold !== 'off') endHold();
    if (!c.synced && floHold !== 'off') endFloHold();
    applySync(floHold === 'held', c.synced, c.ring);
    if (c.synced && feeHold === 'off' && floHold === 'off') followOnce();
    paintHold(c.synced);
    paintFloHold(c.synced);
  }

  const routed = () => armedNow() && feeHold === 'off' && floHold === 'off';
  function routeLocate() {
    const set = flo.counter.setting();
    if (set) {
      const want = Number(set.join(''));
      const to = ontoFee(want);
      flo.counter.forgetSetting();
      if (want > fee.state().N) say(`S${want} is past the end; going to S${to}`);
      fee.goTo(to);
      return;
    }
    const cue = fee.state().cue;
    if (cue !== null && cue !== undefined) { fee.goTo(ontoFee(cue)); return; }
    say('Nothing to locate: set the counter or press CUE first.');
  }
  function routeCue() {
    fee.keys.cue.click();
    if (flo.st.cue !== null) { flo.st.cue = null; flo.render(); }
  }
  function routeRewind() {
    fee.rewind();
  }
  flo.root.addEventListener('click', e => {
    if (!routed()) return;
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    if (b === flo.keys.rewind) { e.stopPropagation(); routeRewind(); return; }
    if (b === flo.keys.cue) { e.stopPropagation(); routeCue(); return; }
    if (b === flo.keys.locate) { e.stopPropagation(); routeLocate(); return; }
  }, true);
  flo.root.addEventListener('keydown', e => {
    if (!routed() || e.key !== 'Enter') return;
    if (!e.target.closest || !e.target.closest('.wheel')) return;
    e.preventDefault(); e.stopPropagation();
    routeLocate();
  }, true);

  const holdKey = fee.keys.hold;
  holdKey.setAttribute('aria-label', 'hold FEE where she stands while Flo moves on her own');
  holdKey.addEventListener('click', pressHold);
  function pressHold() {
    if (holdKey.getAttribute('aria-disabled') === 'true') {
      say(fee.state().mode !== 'PLAY' ? 'HOLD works in PLAY'
        : floHold !== 'off' ? 'HOLD: Flo is holding; release her HOLD first'
        : 'HOLD needs FEE and Flo synced: press SYNC in either loader');
      return;
    }
    if (feeHold === 'off') {
      feeHold = 'held'; fee.st.frozen = true; fee.render();
      syncNow();
      const s = feeK();
      say(`FEE holds at ${s ? 'S' + s : 'the leader'}; Flo moves on her own`);
    } else {
      feeHold = 'off'; fee.st.frozen = false;
      const k = flo.state().k;
      fee.goTo(ontoFee(k));
      syncNow();
      say(`FEE joins Flo at ${k ? 'S' + k : 'the leader'}`);
    }
  }
  function endHold() { feeHold = 'off'; fee.st.frozen = false; fee.render(); }
  let lastHold = '';
  function paintHold(synced) {
    const frozen = feeHold === 'held';
    if (fee.keys.cue.disabled !== frozen) fee.keys.cue.disabled = frozen;
    if (fee.keys.locate.disabled !== frozen) fee.keys.locate.disabled = frozen;
    fee.keys.cue.classList.toggle('dark', frozen);
    fee.keys.locate.classList.toggle('dark', frozen);
    const can = (synced && floHold === 'off') || feeHold !== 'off', on = feeHold !== 'off';
    const key = can + ':' + on;
    if (key === lastHold) return;
    lastHold = key;
    holdKey.setAttribute('aria-disabled', String(!can));
    holdKey.classList.toggle('dark', !can);
    holdKey.setAttribute('aria-pressed', String(on));
  }

  const floHoldKey = flo.keys.hold;
  if (floHoldKey) {
    floHoldKey.id = 'flo-hold';
    floHoldKey.setAttribute('aria-label', 'hold Flo where she stands while FEE plays on');
    floHoldKey.addEventListener('click', pressFloHold);
  }
  function pressFloHold() {
    if (floHoldKey.getAttribute('aria-disabled') === 'true') {
      say(feeHold !== 'off' ? 'HOLD: FEE is holding; release her HOLD first'
        : 'HOLD needs FEE and Flo synced: press SYNC in either loader');
      return;
    }
    if (floHold === 'off') {
      floHold = 'held'; syncNow();
      const k = flo.state().k;
      say(`Flo holds at ${k ? 'S' + k : 'the leader'}; FEE plays on`);
    } else {
      floHold = 'off'; syncNow();
      const f = feeK();
      say(`Flo rejoins FEE at ${f ? 'S' + f : 'the leader'}`);
    }
  }
  function endFloHold() { floHold = 'off'; }
  let lastFloHold = '';
  function paintFloHold(synced) {
    if (!floHoldKey) return;
    const can = (synced && feeHold === 'off') || floHold !== 'off', on = floHold !== 'off';
    const k = can + ':' + on;
    if (k === lastFloHold) return;
    lastFloHold = k;
    floHoldKey.setAttribute('aria-disabled', String(!can));
    floHoldKey.classList.toggle('dark', !can);
    floHoldKey.setAttribute('aria-pressed', String(on));
  }

  const PEER = {
    fee: { me: () => fee, them: () => flo, tag: 'peer:fee', back: 'peer:flo', name: 'Flo' },
    flo: { me: () => flo, them: () => fee, tag: 'peer:flo', back: 'peer:fee', name: 'FEE' },
  };
  function carryBank(s, { keys = null, slot = null, by = null }) {
    const c = PEER[s];
    if (!armedNow() || by === c.back) return;
    const mine = c.me().drawer.bankState();
    const want = { kind: 'run', keys: keys || mine.keys,
                   slot: Number.isInteger(slot) ? slot : mine.slot };
    let why = '';
    const off = c.them().bus.on('bank-refused', (name, d) => { why = (d && d.why) || ''; });
    let took = false;
    try { took = c.them().drawer.setBank(want, c.tag); } finally { off(); }
    if (took) return;
    endHold(); endFloHold();
    setPhase('idle');
    const line = `sync released: ${why || `${c.name} refused this library`}`;
    requestAnimationFrame(() => requestAnimationFrame(() => say(line)));
  }
  fee.bus.on('bank-set', (name, d) => carryBank('fee', d));
  flo.bus.on('bank-set', (name, d) => carryBank('flo', d));
  fee.bus.on('load-done', (name, d) => carryBank('fee', { slot: d.slot, by: 'reader' }));
  flo.bus.on('load-done', (name, d) => carryBank('flo', { slot: d.slot, by: 'reader' }));
  fee.bus.on('preset', (name, d) => {
    if (!armedNow() || flo.state().run === bare(d.id)) return;
    const j = floSlotOf(bare(d.id)); if (j >= 0) flo.choose(j);
  });
  flo.bus.on('preset', (name, d) => {
    if (!armedNow() || fee.state().run === bare(d.id)) return;
    const j = feeSlotOf(bare(d.id)); if (j >= 0) fee.choose(j);
  });
  fee.bus.on('preset', () => { endHold(); endFloHold(); });

  fee.bus.on('mode', (name, d) => { if (d.mode === 'LOAD' && flo.state().mode === 'LOAD') flo.drawer.setMode('PLAY'); });
  flo.bus.on('mode', (name, d) => { if (d.mode === 'LOAD' && fee.state().mode === 'LOAD') fee.drawer.setMode('PLAY'); });

  function announceClose() {
    requestAnimationFrame(() => {
      if (armedNow()) {
        const s = feeK();
        say(s ? `Flo follows FEE at S${s}` : 'Flo follows FEE at the leader');
      } else {
        const k = flo.state().k;
        say(k ? `Flo holds S${k}` : 'Flo holds the leader');
      }
    });
  }
  for (const b of [fee.bus, flo.bus]) {
    b.on('mode', (name, d) => {
      if (d.mode === 'LOAD') syncNow();
      else if (d.mode === 'PLAY') { syncNow(); announceClose(); }
    });
  }

  T.fee = {
    fee,
    marks: fee.marks, off: fee.off, events: fee.events, geometry: fee.geometry,
    six: fee.six, bankKey: fee.bankKey, rooms: FEE_ROOMS,
    state: () => fee.state(),
    readings: () => fee.readings(),
    bank: () => fee.bank.map(s => s.key),
    settle: () => fee.settle(),
    choose: i => fee.choose(i),
    load: id => fee.load(id),
    setForm: f => fee.setForm(f),
    step: () => fee.step(),
    rewind: () => fee.rewind(),
    togglePeak: () => fee.togglePeak(),
    go: k => fee.goTo(k),
    drawer: fee.drawer,
    keys: fee.keys,
    provenance: Object.fromEntries(FEE_ROOMS.map(c => [c, rooms[c].json.provenance])),
  };
  const F = window.__flo = { ready: false, events: [], step: 7 };
  F.width = flo.width;
  F.marks = flo.marks;
  F.vocabulary = flo.events;
  F.ladder = flo.ladder;
  F.state = () => flo.state();
  F.readings = () => flo.readings();
  F.setSynced = v => flo.setSynced(v);
  F.setRing = v => flo.setRing(v);
  F.idle = () => flo.idle();
  F.go = s => flo.goTo(s);
  F.setWindow = w => flo.setWindow(w);
  F.setRoom = c => flo.setRoom(c);
  F.setView = v => flo.setView(v);
  F.setFloor = on => flo.setFloor(on);
  F.setDisplay = p => flo.setDisplay(p);
  F.zoomTo = s => flo.zoomTo(s);
  F.leaveZoom = () => flo.keys.zoom.click();
  F.rewind = () => flo.rewind();
  F.choose = i => flo.choose(i);
  F.bank = () => flo.bank.map(s => s.key);
  F.keys = flo.keys;
  F.drawer = flo.drawer;
  F.counter = flo.counter;
  flo.bus.on('*', (name, detail) => {
    F.events.push([name, detail]);
    if (F.events.length > 500) F.events.shift();
  });
  T.flo = F;
  T.sync = () => {
    const { armed, synced, ring } = computeSync();
    return { armed, synced, ring, fee: feeK(), flo: flo.state().k,
             mode: fee.state().mode, floMode: flo.state().mode,
             hold: feeHold, floHold, phase: hs.phase, by: hs.by };
  };
  T.load = id => {
    const rest = index.runs.map(r => r.run).filter(r => r !== id).slice(0, 5);
    return fee.drawer.setBank({ kind: 'run', keys: [id, ...rest], slot: 0 }, 'check');
  };

  flo.drawer.setBank({ kind: 'run', keys: fee.bank.map(x => x.key), slot: fee.state().slot }, 'peer:fee');
  setPhase('synced', 'fee');
  syncNow();

  function tick() { syncNow(); requestAnimationFrame(tick); }
  requestAnimationFrame(tick);

  window.__pair = window.__pair || {};
  window.__pair.width = width;
  if (!$('deck-data')) {
    const el = document.createElement('script');
    el.type = 'application/json';
    el.id = 'deck-data';
    el.textContent = JSON.stringify({ index });
    document.body.appendChild(el);
  }


  const SND = makeFeeSound(await loadCues({
    sets: [['cues.json', [...ZOE_SHARED, 'beat']], ['fee-cues.json', null], ['flo-cues.json', null]], lazy: ['beat'] }));
  wireFee(SND, fee);
  wireFlo(SND, flo, { following: armedNow });
  T.sound = SND;
  F.ready = true;
  window.__pair.ready = true;
  T.ready = true;

  const glowRoom = JSON.stringify({
    caption: bounds.caption,
    room_sentence: bounds.room_sentence,
    passages: Object.fromEntries(FLO_ROOMS.map(c => [c, Object.fromEntries(
      Object.entries(floors[c].sources).map(([k, v]) => [k, v.passages]))])),
  });

})().catch(err => { T.errors.push(String(err && err.message ? err.message : err)); throw err; });

