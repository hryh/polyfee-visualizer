/*
 * Resolves the market under the current URL and its live fee schedule.
 *
 * Everything comes from Polymarket's public Gamma API. We never invent or
 * hardcode a fee rate: category->rate tables go stale (sports currently runs
 * two schedules at once, sports_fees_v2 at 0.03 and sports_fees_v3 at 0.05),
 * so the per-market feeSchedule object is the only trustworthy source.
 */
(function (root) {
  'use strict';

  var GAMMA = 'https://gamma-api.polymarket.com';
  var TTL_MS = 5 * 60 * 1000;
  var cache = new Map();

  function cached(key, fn) {
    var hit = cache.get(key);
    if (hit && Date.now() - hit.t < TTL_MS) return hit.p;
    var p = fn().catch(function (e) { cache.delete(key); throw e; });
    cache.set(key, { t: Date.now(), p: p });
    return p;
  }

  function getJSON(url) {
    return fetch(url, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('gamma ' + r.status);
      return r.json();
    });
  }

  var LOCALE_RE = /^[a-z]{2}(-[a-z]{2,4})?$/i;

  /* Pull {kind, slug} out of a Polymarket URL, tolerating /zh-hant/ prefixes. */
  function parsePath(pathname) {
    var parts = String(pathname || '').split('/').filter(Boolean);
    if (parts.length && LOCALE_RE.test(parts[0]) && parts[0] !== 'event') parts.shift();
    if (!parts.length) return null;
    if (parts[0] === 'event' && parts[1]) {
      return { kind: 'event', slug: parts[1], sub: parts[2] || null };
    }
    if (parts[0] === 'market' && parts[1]) {
      return { kind: 'market', slug: parts[1], sub: null };
    }
    return null;
  }

  function normaliseSchedule(m) {
    var s = m && m.feeSchedule;
    if (m && m.feesEnabled === false) return null;
    if (!s || !s.rate) return null;
    return {
      rate: Number(s.rate),
      exponent: s.exponent == null ? 1 : Number(s.exponent),
      takerOnly: s.takerOnly !== false,
      rebateRate: Number(s.rebateRate) || 0
    };
  }

  function parseJSONish(v, fallback) {
    if (Array.isArray(v)) return v;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch (e) { return fallback; } }
    return fallback;
  }

  /* Flatten a Gamma market record into what the panel needs. */
  function shapeMarket(m) {
    return {
      conditionId: String(m.conditionId || '').toLowerCase(),
      slug: m.slug,
      question: m.groupItemTitle || m.question || m.slug,
      outcomes: parseJSONish(m.outcomes, ['Yes', 'No']),
      prices: parseJSONish(m.outcomePrices, []).map(Number),
      tokenIds: parseJSONish(m.clobTokenIds, []).map(String),
      tickSize: Number(m.orderPriceMinTickSize) || 0.01,
      minSize: Number(m.orderMinSize) || 0,
      feeType: m.feeType || null,
      feesEnabled: m.feesEnabled !== false && !!(m.feeSchedule && m.feeSchedule.rate),
      schedule: normaliseSchedule(m)
    };
  }

  function byVolume(a, b) { return (Number(b.volume24hr) || 0) - (Number(a.volume24hr) || 0); }

  function resolve(pathname) {
    var loc = parsePath(pathname);
    if (!loc) return Promise.resolve(null);

    if (loc.kind === 'market') {
      return cached('m:' + loc.slug, function () {
        return getJSON(GAMMA + '/markets?slug=' + encodeURIComponent(loc.slug));
      }).then(function (arr) {
        if (!arr || !arr.length) return null;
        return { title: arr[0].question || loc.slug, markets: arr.map(shapeMarket) };
      });
    }

    return cached('e:' + loc.slug, function () {
      return getJSON(GAMMA + '/events?slug=' + encodeURIComponent(loc.slug));
    }).then(function (arr) {
      if (!arr || !arr.length) return null;
      var ev = arr[0];
      var mkts = (ev.markets || []).slice().sort(byVolume).map(shapeMarket);
      if (!mkts.length) return null;
      return { title: ev.title || ev.slug, markets: mkts, sub: loc.sub };
    });
  }

  var api = {
    resolve: resolve,
    parsePath: parsePath,
    shapeMarket: shapeMarket,
    normaliseSchedule: normaliseSchedule
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PMMarket = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
