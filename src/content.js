/*
 * Orchestrator (ISOLATED world).
 *
 * Job: work out which market and price the user is about to trade, how big the
 * order is, and keep the panel in sync.
 *
 * Design note on why this is not just querySelector work. The Polymarket app
 * ships no data-testid hooks, its class names are hashed Tailwind utilities,
 * and every label is machine-translated per region (the same page renders as
 * "Buy Yes 80c" or "..."). So we lean on things that do not
 * change between locales or redesigns:
 *
 *   - the URL slug            -> which event (Gamma API)
 *   - GET /rewards/markets/ID -> which market inside that event
 *   - input[inputmode=decimal]-> the size the user typed
 *   - the U+00A2 cent glyph   -> which outcome was clicked
 *
 * Anything that cannot be determined confidently is left to the user rather
 * than guessed at: the panel is a working calculator on its own.
 */
(function () {
  'use strict';

  var F = window.PMFees;
  var M = window.PMMarket;

  var panel = null;
  var ctx = {
    title: null,
    markets: [],
    market: null,
    outcomeIdx: 0,
    side: 'buy',
    price: 0,
    pageAmount: null,
    live: false
  };

  var lastConditionId = null;
  var lastClickPrice = null;
  var priceCache = new Map();

  // ---------------------------------------------------------------- utils

  function debounce(fn, ms) {
    var t = null;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  function num(v) {
    var n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
    return isFinite(n) ? n : null;
  }

  // ------------------------------------------------------- price discovery

  /* Best executable price for a taker. bid <= ask always holds, so taking the
   * max for a buy and the min for a sell is correct without having to rely on
   * how the CLOB labels its `side` parameter. */
  function fetchTakerPrice(tokenId, side) {
    var key = tokenId + ':' + side;
    var hit = priceCache.get(key);
    if (hit && Date.now() - hit.t < 8000) return hit.p;

    var base = 'https://clob.polymarket.com/price?token_id=' + encodeURIComponent(tokenId);
    var p = Promise.all([
      fetch(base + '&side=buy', { credentials: 'omit' }).then(function (r) { return r.json(); }),
      fetch(base + '&side=sell', { credentials: 'omit' }).then(function (r) { return r.json(); })
    ]).then(function (rs) {
      var a = parseFloat(rs[0] && rs[0].price);
      var b = parseFloat(rs[1] && rs[1].price);
      var vals = [a, b].filter(function (x) { return isFinite(x) && x > 0 && x < 1; });
      if (!vals.length) return null;
      return side === 'sell' ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
    }).catch(function () { return null; });

    priceCache.set(key, { t: Date.now(), p: p });
    return p;
  }

  function refreshPrice() {
    var m = ctx.market;
    if (!m) return;
    var fallback = (m.prices && m.prices[ctx.outcomeIdx]) || 0;
    var tid = m.tokenIds && m.tokenIds[ctx.outcomeIdx];
    if (!tid) {
      ctx.price = fallback;
      ctx.live = false;
      push();
      return;
    }
    fetchTakerPrice(tid, ctx.side).then(function (p) {
      ctx.price = p || fallback;
      ctx.live = !!p;
      push();
    });
  }

  // ----------------------------------------------------- reading the widget

  /* The order-size box. Identified structurally: it is the only decimal-mode
   * input on the page (the header search box is type=text with an id). Our own
   * input lives in a shadow root, so it is invisible to this query. */
  function readPageAmount() {
    var els = document.querySelectorAll('input[inputmode="decimal"]');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.id === 'search-input') continue;
      if (!e.offsetParent) continue;              // not rendered
      var v = num(e.value);
      return v != null && v > 0 ? v : null;       // first visible one wins
    }
    return null;
  }

  /* Which outcome was clicked. Buttons render the price with a cent glyph, and
   * that glyph survives translation, so we match the number the user clicked
   * against the market's outcome prices. */
  function outcomeFromPrice(market, clicked) {
    if (!market || clicked == null || !market.prices || market.prices.length < 2) return null;
    var best = null, bestD = Infinity;
    for (var i = 0; i < market.prices.length; i++) {
      var d = Math.abs(market.prices[i] - clicked);
      if (d < bestD) { bestD = d; best = i; }
    }
    return bestD <= 0.06 ? best : null;
  }

  document.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('button,a,[role="button"]');
    if (!btn) return;
    var txt = btn.textContent || '';
    var m = /([0-9]+(?:\.[0-9]+)?)\s*¢/.exec(txt);
    if (m) lastClickPrice = parseFloat(m[1]) / 100;
  }, true);

  // ------------------------------------------------------- hook plumbing

  window.addEventListener('pm-fee-lens', function (e) {
    var d = e.detail || {};
    if (d.type === 'market-selected' && d.conditionId) {
      if (d.conditionId === lastConditionId) return;
      lastConditionId = d.conditionId;
      selectMarket(d.conditionId);
    } else if (d.type === 'order-submitted' && d.order) {
      onOrder(d.order);
    }
  });

  function selectMarket(conditionId) {
    var found = null;
    for (var i = 0; i < ctx.markets.length; i++) {
      if (ctx.markets[i].conditionId === conditionId) { found = ctx.markets[i]; break; }
    }
    if (!found) return;
    ctx.market = found;
    var idx = outcomeFromPrice(found, lastClickPrice);
    if (idx != null) ctx.outcomeIdx = idx;
    refreshPrice();
    push();
  }

  /* An order actually went out: report the fee it really incurred. */
  function onOrder(order) {
    var m = ctx.market;
    if (!m && ctx.markets.length === 1) m = ctx.markets[0];
    if (order.tokenId) {
      for (var i = 0; i < ctx.markets.length; i++) {
        var ids = ctx.markets[i].tokenIds || [];
        var j = ids.indexOf(order.tokenId);
        if (j >= 0) { m = ctx.markets[i]; ctx.outcomeIdx = j; break; }
      }
    }
    if (!m) return;
    ctx.market = m;
    ctx.side = order.side;
    ctx.price = order.price;
    ctx.live = true;
    if (panel) {
      panel.pageAmount = order.shares * order.price;
      panel.mode = 'dollars';
      panel.amount = null;
    }
    var fee = F.feeFor(order.shares, order.price, m.schedule);
    recordFee(fee, m);
    push();
  }

  /* Running tally, shown in the popup. Local only -- nothing leaves the
   * browser, and no wallet or identity data is touched. */
  function recordFee(fee, market) {
    if (!(fee > 0)) return;
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
    try {
      chrome.storage.local.get({ tally: { count: 0, total: 0, since: Date.now() } }, function (r) {
        var t = r.tally || { count: 0, total: 0, since: Date.now() };
        t.count += 1;
        t.total = Math.round((t.total + fee) * 1e5) / 1e5;
        t.last = { fee: fee, q: market.question, at: Date.now() };
        chrome.storage.local.set({ tally: t });
      });
    } catch (e) { /* storage unavailable */ }
  }

  // --------------------------------------------------------------- wiring

  function push() {
    if (!panel) return;
    panel.update({
      title: ctx.title,
      market: ctx.market,
      side: ctx.side,
      outcomeIdx: ctx.outcomeIdx,
      price: ctx.price,
      pageAmount: ctx.pageAmount,
      live: ctx.live
    });
  }

  var syncAmount = debounce(function () {
    var v = readPageAmount();
    if (v !== ctx.pageAmount) {
      ctx.pageAmount = v;
      if (panel) panel.pageAmount = v;
      push();
    }
  }, 120);

  function loadForPath() {
    lastConditionId = null;
    lastClickPrice = null;
    ctx.market = null;
    ctx.markets = [];
    ctx.outcomeIdx = 0;
    ctx.price = 0;
    ctx.live = false;

    if (!M.parsePath(location.pathname)) { teardown(); return; }

    M.resolve(location.pathname).then(function (res) {
      if (!res) { teardown(); return; }
      ensurePanel();
      ctx.title = res.title;
      ctx.markets = res.markets;
      // Until /rewards/markets tells us which one the widget is showing, show
      // the busiest market in the event -- markets are sorted by 24h volume.
      ctx.market = res.markets[0];
      refreshPrice();
      push();
    }).catch(function () { teardown(); });
  }

  function ensurePanel() {
    if (!panel) panel = new window.PMPanel();
  }

  /* Off a market page the panel has nothing to say, so get out of the way. */
  function teardown() {
    if (panel) { panel.destroy(); panel = null; }
  }

  function watchNavigation(onChange) {
    var last = location.pathname;
    function check() {
      if (location.pathname !== last) { last = location.pathname; onChange(); }
    }
    ['pushState', 'replaceState'].forEach(function (k) {
      var orig = history[k];
      history[k] = function () {
        var r = orig.apply(this, arguments);
        setTimeout(check, 0);
        return r;
      };
    });
    window.addEventListener('popstate', check);
    setInterval(check, 800);
  }

  function start() {
    loadForPath();

    document.addEventListener('input', syncAmount, true);
    document.addEventListener('change', syncAmount, true);
    new MutationObserver(syncAmount).observe(document.documentElement, {
      subtree: true, childList: true
    });
    setInterval(syncAmount, 700);
    setInterval(refreshPrice, 15000);

    watchNavigation(loadForPath);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
