(function () {
  'use strict';
  var F = window.PMFees;

  var $ = function (id) { return document.getElementById(id); };
  function money(x) {
    if (!(Math.abs(x) > 0)) return '$0.00';
    return Math.abs(x) < 0.01 ? '$' + x.toFixed(4) : '$' + x.toFixed(2);
  }
  function num(el, dflt) {
    var v = parseFloat(String(el.value).replace(/[^0-9.]/g, ''));
    return isFinite(v) ? v : dflt;
  }

  // ---- tally -------------------------------------------------------------
  var store = (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local)
    ? chrome.storage.local : null;

  function renderTally() {
    if (!store) { $('tallySub').textContent = 'Storage unavailable.'; return; }
    store.get({ tally: null }, function (r) {
      var t = r.tally;
      if (!t || !t.count) {
        $('total').textContent = '$0.00';
        $('tallySub').textContent = 'No trades seen yet.';
        return;
      }
      $('total').textContent = money(t.total);
      var avg = t.total / t.count;
      var bits = [t.count + (t.count === 1 ? ' trade' : ' trades'), money(avg) + ' avg'];
      if (t.since) {
        bits.push('since ' + new Date(t.since).toLocaleDateString());
      }
      $('tallySub').textContent = bits.join(' · ');
    });
  }

  $('reset').addEventListener('click', function () {
    if (!store) return;
    store.set({ tally: { count: 0, total: 0, since: Date.now() } }, renderTally);
  });

  // ---- calculator --------------------------------------------------------
  function calc() {
    var rate = parseFloat($('cat').value);
    var price = num($('price'), 50) / 100;
    var stake = num($('stake'), 0);
    price = Math.min(Math.max(price, 0), 1);

    var schedule = rate > 0 ? { rate: rate, exponent: 1, takerOnly: true, rebateRate: 0 } : null;
    var q = F.quote({ side: 'buy', price: price, dollars: stake, schedule: schedule });

    $('oShares').textContent = q.shares > 0 ? q.shares.toFixed(2) : '—';
    $('oFee').textContent = money(q.fee);
    $('oEff').textContent = q.shares > 0 ? (q.effectivePrice * 100).toFixed(2) + '¢' : '—';
    $('oBe').textContent = q.shares > 0 ? (q.breakEvenProb * 100).toFixed(1) + '%' : '—';
    $('oPct').textContent = q.notional > 0 ? (q.feePctOfNotional * 100).toFixed(2) + '%' : '—';
  }

  ['cat', 'price', 'stake'].forEach(function (id) {
    $(id).addEventListener('input', calc);
    $(id).addEventListener('change', calc);
  });

  calc();
  renderTally();
})();
