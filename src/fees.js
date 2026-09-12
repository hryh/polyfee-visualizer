/*
 * Polymarket taker-fee math.
 *
 * Source of truth: docs.polymarket.com/polymarket-learn/trading/fees
 *   fee = C x feeRate x p x (1 - p)
 * where C = shares and p = share price in dollars.
 *
 * The live Gamma API carries a per-market `feeSchedule`:
 *   { exponent: 1, rate: 0.05, takerOnly: true, rebateRate: 0.25 }
 * so we generalise the documented formula to
 *   fee = shares * rate * (p * (1 - p)) ** exponent
 * which reduces to the documented one when exponent === 1 (currently always
 * true, but the field exists so we honour it).
 *
 * Fees are charged in USDC, to takers only. Makers pay nothing and receive
 * `rebateRate` of the fee their counterparty paid.
 */
(function (root) {
  'use strict';

  // Polymarket rounds fees to 5dp and skips anything below the minimum.
  var FEE_DP = 5;
  var MIN_FEE = 0.00001;

  function roundFee(x) {
    var r = Math.round(x * 1e5) / 1e5;
    return r < MIN_FEE ? 0 : r;
  }

  /** Raw fee in USDC for `shares` contracts executed at price `price`. */
  function feeFor(shares, price, schedule) {
    if (!schedule || !schedule.rate) return 0;
    if (!(shares > 0)) return 0;
    var p = Math.min(Math.max(Number(price) || 0, 0), 1);
    var exponent = schedule.exponent == null ? 1 : Number(schedule.exponent);
    var base = p * (1 - p);
    if (base <= 0) return 0;
    return roundFee(shares * Number(schedule.rate) * Math.pow(base, exponent));
  }

  /**
   * Full cost breakdown for one taker order.
   *
   * @param {object} o
   * @param {'buy'|'sell'} o.side
   * @param {number} o.price     price per share, 0..1
   * @param {number} [o.shares]  contract count -- supply this OR o.dollars
   * @param {number} [o.dollars] stake in USDC (buy) / proceeds (sell)
   * @param {object} o.schedule  feeSchedule from the Gamma API
   * @param {boolean} [o.maker]  true for a resting limit order
   */
  function quote(o) {
    var side = o.side === 'sell' ? 'sell' : 'buy';
    var price = Math.min(Math.max(Number(o.price) || 0, 0), 1);
    var schedule = o.schedule || null;

    var shares = Number(o.shares) || 0;
    if (!shares && o.dollars && price > 0) shares = Number(o.dollars) / price;
    var notional = shares * price;

    // takerOnly schedules charge resting limit orders nothing.
    var isMaker = !!o.maker;
    var chargeable = !isMaker || !(schedule && schedule.takerOnly);
    var fee = chargeable ? feeFor(shares, price, schedule) : 0;

    // A maker earns a share of the fee their counterparty pays.
    var rebate = 0;
    if (isMaker && schedule && schedule.rebateRate) {
      rebate = roundFee(feeFor(shares, price, schedule) * Number(schedule.rebateRate));
    }

    // Buying: you pay notional + fee. Selling: you receive notional - fee.
    var cashOut = side === 'buy' ? notional + fee : -(notional - fee);
    var effectivePrice = shares > 0
      ? (side === 'buy' ? (notional + fee) / shares : (notional - fee) / shares)
      : price;

    return {
      side: side,
      price: price,
      shares: shares,
      notional: notional,
      fee: fee,
      rebate: rebate,
      isMaker: isMaker,
      feesEnabled: !!(schedule && schedule.rate),

      // What you actually hand over / walk away with.
      totalCost: side === 'buy' ? notional + fee : notional - fee,
      cashOut: cashOut,

      // Price you really got, once the fee is folded in.
      effectivePrice: effectivePrice,

      // Held to resolution, a buy breaks even iff P(win) >= effective price.
      breakEvenProb: side === 'buy' ? effectivePrice : 1 - effectivePrice,

      // Fee as a share of money at risk. For exponent 1 this is rate*(1-p) on a
      // buy -- i.e. cheap longshots are taxed hardest relative to stake.
      feePctOfNotional: notional > 0 ? fee / notional : 0,

      // Fee against the $1 max payout.
      feePctOfPayout: shares > 0 ? fee / shares : 0,

      // Buy now and sell back at the same price: you eat the fee twice.
      roundTripFee: chargeable ? fee * 2 : 0,

      // Price the market must reach for a round trip to break even.
      roundTripBreakEven: roundTripBreakEven(price, schedule)
    };
  }

  /**
   * Buy at `price`, later sell at `x`. Ignoring size, break-even needs
   *   x - rate*(x(1-x))^e = price + rate*(price(1-price))^e
   * Solved numerically (monotonic in x above the entry price).
   */
  function roundTripBreakEven(price, schedule) {
    if (!schedule || !schedule.rate) return price;
    var target = price + perShareFee(price, schedule);
    var lo = price, hi = 1;
    for (var i = 0; i < 60; i++) {
      var mid = (lo + hi) / 2;
      if (mid - perShareFee(mid, schedule) < target) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  function perShareFee(p, schedule) {
    if (!schedule || !schedule.rate) return 0;
    var e = schedule.exponent == null ? 1 : Number(schedule.exponent);
    return Number(schedule.rate) * Math.pow(p * (1 - p), e);
  }

  /** Fee in USDC per 100 shares -- the unit Polymarket quotes publicly. */
  function feePer100(price, schedule) {
    return feeFor(100, price, schedule);
  }

  /** Worst-case fee per 100 shares (always at p = 0.5). */
  function maxFeePer100(schedule) {
    return feeFor(100, 0.5, schedule);
  }

  var api = {
    feeFor: feeFor,
    quote: quote,
    feePer100: feePer100,
    maxFeePer100: maxFeePer100,
    perShareFee: perShareFee,
    roundTripBreakEven: roundTripBreakEven,
    MIN_FEE: MIN_FEE,
    FEE_DP: FEE_DP
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.PMFees = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
