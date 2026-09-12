/*
 * MAIN-world observer. Runs at document_start so it wraps fetch/XHR before the
 * app boots.
 *
 * Strictly read-only: every original call is forwarded untouched and the
 * original return value handed back. We never alter, delay, block or replay a
 * request. This must not be able to affect an order the user places.
 *
 * Two things are worth observing:
 *   1. GET /rewards/markets/<conditionId> - fired when an outcome is picked,
 *      which is how we learn which market the trade widget is showing. The DOM
 *      cannot tell us: no test ids, hashed utility classes, and the labels are
 *      auto-translated per region.
 *   2. POST /order - the real signed order, so we can report the fee actually
 *      incurred rather than an estimate.
 */
(function () {
  'use strict';

  var TAG = 'pm-fee-lens';

  function emit(type, detail) {
    try {
      window.dispatchEvent(new CustomEvent(TAG, {
        detail: Object.assign({ type: type }, detail)
      }));
    } catch (e) { /* never let observation break the page */ }
  }

  var COND_RE = /\/rewards\/markets\/(0x[0-9a-fA-F]{16,})/;
  var ORDER_RE = /clob\.polymarket\.com\/orders?(\b|$|\?)/;

  function inspectUrl(url, method, body) {
    try {
      if (typeof url !== 'string') return;
      var m = COND_RE.exec(url);
      if (m) { emit('market-selected', { conditionId: m[1].toLowerCase() }); return; }
      if (method === 'POST' && ORDER_RE.test(url)) {
        var s = summariseOrder(body);
        if (s) emit('order-submitted', { order: s });
      }
    } catch (e) { /* ignore */ }
  }

  /* Pull side/price/size out of a CLOB order payload. Signatures, addresses and
   * any other wallet material are deliberately left behind. */
  function summariseOrder(body) {
    try {
      var o = typeof body === 'string' ? JSON.parse(body) : body;
      if (!o || typeof o !== 'object') return null;
      var ord = o.order || o;
      var maker = Number(ord.makerAmount);
      var taker = Number(ord.takerAmount);
      if (!isFinite(maker) || !isFinite(taker) || !maker || !taker) return null;
      var isBuy = String(ord.side).toUpperCase() === 'BUY' || ord.side === 0;
      /* Amounts are 1e6-scaled; price is the USDC:shares ratio. */
      var price = isBuy ? maker / taker : taker / maker;
      var shares = (isBuy ? taker : maker) / 1e6;
      if (!(price > 0) || !(shares > 0)) return null;
      return {
        side: isBuy ? 'buy' : 'sell',
        price: price,
        shares: shares,
        tokenId: String(ord.tokenId || ord.tokenID || ''),
        orderType: o.orderType || null,
        at: Date.now()
      };
    } catch (e) { return null; }
  }

  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input, init) {
      try {
        var url = typeof input === 'string' ? input : (input && input.url);
        var method = (init && init.method) || (input && input.method) || 'GET';
        inspectUrl(url, String(method).toUpperCase(), init && init.body);
      } catch (e) { /* ignore */ }
      return origFetch.apply(this, arguments);
    };
  }

  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    try { this.__pmfl = { method: String(method || 'GET').toUpperCase(), url: url }; } catch (e) {}
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    try { if (this.__pmfl) inspectUrl(this.__pmfl.url, this.__pmfl.method, body); } catch (e) {}
    return origSend.apply(this, arguments);
  };
})();
