/*
 * The injected panel. Lives in a shadow root so Polymarket's stylesheet cannot
 * reach in and ours cannot leak out.
 */
(function (root) {
  'use strict';

  var F = root.PMFees;

  function money(x) {
    var a = Math.abs(x);
    if (a === 0) return '$0.00';
    if (a < 0.01) return '$' + x.toFixed(4);
    return '$' + x.toFixed(2);
  }
  function cents(p) {
    var c = p * 100;
    return (c < 10 ? c.toFixed(1) : c.toFixed(0)) + '¢';
  }
  function pct(x, dp) { return (x * 100).toFixed(dp == null ? 1 : dp) + '%'; }

  function niceFeeType(t) {
    if (!t) return 'No fee schedule';
    return String(t)
      .replace(/_fees?(_v\d+)?$/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  var CSS = [
    ':host{all:initial}',
    '*{box-sizing:border-box;margin:0;padding:0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}',
    '.wrap{position:fixed;z-index:2147483600;width:310px;color:#e8ecf3;',
    'background:#151a23;border:1px solid #2a3443;border-radius:14px;',
    'box-shadow:0 10px 34px rgba(0,0,0,.5);font-size:13px;overflow:hidden}',
    '.hd{display:flex;align-items:center;gap:8px;padding:9px 11px;background:#1b2330;',
    'border-bottom:1px solid #2a3443;cursor:grab;user-select:none}',
    '.hd.drag{cursor:grabbing}',
    '.dot{width:7px;height:7px;border-radius:50%;background:#39d98a;flex:none}',
    '.dot.off{background:#5b6676}',
    '.ttl{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#93a1b5;flex:1}',
    '.ico{width:20px;height:20px;border:0;background:transparent;color:#7f8ea5;cursor:pointer;',
    'border-radius:5px;font-size:14px;line-height:1;display:grid;place-items:center}',
    '.ico:hover{background:#2a3443;color:#e8ecf3}',
    '.bd{padding:11px}',
    '.q{font-size:12px;color:#aab6c8;line-height:1.35;margin-bottom:9px;',
    'display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.tier{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px}',
    '.chip{font-size:10.5px;font-weight:600;padding:2.5px 7px;border-radius:999px;',
    'background:#232d3c;color:#9fb0c7;border:1px solid #2f3b4d;white-space:nowrap}',
    '.chip.hot{background:#3a2420;color:#ffb4a2;border-color:#5c352e}',
    '.chip.free{background:#12331f;color:#5ee08f;border-color:#1d5133}',
    '.hero{background:#101720;border:1px solid #263142;border-radius:10px;padding:10px 11px;margin-bottom:9px}',
    '.heroTop{display:flex;align-items:baseline;justify-content:space-between;gap:8px}',
    '.lbl{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#7f8ea5;font-weight:600}',
    '.fee{font-size:25px;font-weight:700;color:#ff8f6b;letter-spacing:-.02em;line-height:1.1}',
    '.fee.zero{color:#5ee08f}',
    '.sub{font-size:11px;color:#8b98ab;margin-top:3px;line-height:1.35}',
    '.rows{display:flex;flex-direction:column;gap:1px;background:#263142;border:1px solid #263142;',
    'border-radius:9px;overflow:hidden;margin-bottom:9px}',
    '.row{display:flex;justify-content:space-between;align-items:center;gap:10px;',
    'padding:6.5px 10px;background:#131a24}',
    '.row .k{color:#8b98ab;font-size:11.5px}',
    '.row .v{font-variant-numeric:tabular-nums;font-weight:600;font-size:12px;color:#e8ecf3}',
    '.row .v.warn{color:#ffb4a2}',
    '.inp{display:flex;align-items:center;gap:7px;margin-bottom:9px}',
    '.inp label{font-size:10.5px;text-transform:uppercase;letter-spacing:.07em;color:#7f8ea5;font-weight:600}',
    '.inp .box{flex:1;min-width:0;display:flex;align-items:center;background:#101720;',
    'border:1px solid #2a3443;border-radius:8px;padding:5px 9px;gap:4px}',
    '.inp .box:focus-within{border-color:#3d7dff}',
    '.inp .box span{color:#7f8ea5;font-size:12px}',
    '.inp input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#e8ecf3;',
    'font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;width:100%}',
    '.seg{display:flex;background:#101720;border:1px solid #2a3443;border-radius:8px;padding:2px;gap:2px}',
    '.seg button{border:0;background:transparent;color:#8b98ab;font-size:11px;font-weight:600;',
    'padding:4px 8px;border-radius:6px;cursor:pointer}',
    '.seg button.on{background:#3d7dff;color:#fff}',
    'svg{display:block;width:100%;height:52px;margin-bottom:3px}',
    '.cap{font-size:10px;color:#6f7d91;text-align:center;margin-bottom:8px}',
    '.note{font-size:10.5px;color:#6f7d91;line-height:1.4;border-top:1px solid #263142;padding-top:8px}',
    '.note b{color:#9fb0c7;font-weight:600}',
    '.pill{position:fixed;z-index:2147483600;display:flex;align-items:center;gap:7px;',
    'background:#151a23;border:1px solid #2a3443;border-radius:999px;padding:7px 13px;cursor:pointer;',
    'box-shadow:0 6px 22px rgba(0,0,0,.45);color:#e8ecf3;font-size:12.5px;font-weight:600;',
    'font-variant-numeric:tabular-nums}',
    '.pill:hover{border-color:#3d7dff}',
    '.pill .t{font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#7f8ea5;font-weight:700}',
    '.hide{display:none!important}'
  ].join('');

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function Panel() {
    this.host = document.createElement('div');
    this.host.id = 'pm-fee-lens-host';
    this.shadow = this.host.attachShadow({ mode: 'open' });
    var st = document.createElement('style');
    st.textContent = CSS;
    this.shadow.appendChild(st);

    this.collapsed = false;
    this.mode = 'dollars';   // how the user is expressing size
    this.amount = null;      // user override; null means follow the page
    this.pageAmount = null;  // last value read off the trade widget
    this.state = null;
    this.build();
    (document.documentElement || document.body).appendChild(this.host);

    try {
      if (localStorage.getItem('pmfl.collapsed') === '1') this.setCollapsed(true);
    } catch (e) { /* storage may be blocked */ }
  }

  Panel.prototype.build = function () {
    var self = this;

    var wrap = el('div', 'wrap');
    this.wrap = wrap;

    var hd = el('div', 'hd');
    this.dot = el('span', 'dot');
    hd.appendChild(this.dot);
    hd.appendChild(el('span', 'ttl', 'Fee Lens'));
    var min = el('button', 'ico', '–');
    min.title = 'Collapse';
    min.addEventListener('click', function (e) { e.stopPropagation(); self.setCollapsed(true); });
    hd.appendChild(min);
    wrap.appendChild(hd);
    this.makeDraggable(hd);

    var bd = el('div', 'bd');
    this.q = el('div', 'q');
    bd.appendChild(this.q);
    this.tier = el('div', 'tier');
    bd.appendChild(this.tier);

    // size input -------------------------------------------------------
    var inp = el('div', 'inp');
    inp.appendChild(el('label', null, 'Size'));
    var box = el('div', 'box');
    this.unit = el('span', null, '$');
    box.appendChild(this.unit);
    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.inputMode = 'decimal';
    this.input.placeholder = '0';
    this.input.addEventListener('input', function () {
      var v = parseFloat(self.input.value.replace(/[^0-9.]/g, ''));
      self.amount = isFinite(v) && v > 0 ? v : null;
      self.render();
    });
    box.appendChild(this.input);
    inp.appendChild(box);
    var seg = el('div', 'seg');
    this.btnUsd = el('button', 'on', '$');
    this.btnSh = el('button', null, 'sh');
    this.btnUsd.addEventListener('click', function () { self.setMode('dollars'); });
    this.btnSh.addEventListener('click', function () { self.setMode('shares'); });
    seg.appendChild(this.btnUsd);
    seg.appendChild(this.btnSh);
    inp.appendChild(seg);
    bd.appendChild(inp);

    // headline fee -----------------------------------------------------
    var hero = el('div', 'hero');
    var top = el('div', 'heroTop');
    this.heroLbl = el('span', 'lbl', 'Taker fee');
    top.appendChild(this.heroLbl);
    this.heroSide = el('span', 'lbl');
    top.appendChild(this.heroSide);
    hero.appendChild(top);
    this.fee = el('div', 'fee', '--');
    hero.appendChild(this.fee);
    this.feeSub = el('div', 'sub');
    hero.appendChild(this.feeSub);
    bd.appendChild(hero);

    // breakdown --------------------------------------------------------
    this.rows = el('div', 'rows');
    bd.appendChild(this.rows);

    // fee curve --------------------------------------------------------
    this.svgBox = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svgBox.setAttribute('viewBox', '0 0 300 52');
    this.svgBox.setAttribute('preserveAspectRatio', 'none');
    bd.appendChild(this.svgBox);
    this.cap = el('div', 'cap', 'Fee per 100 shares across price');
    bd.appendChild(this.cap);

    this.note = el('div', 'note');
    bd.appendChild(this.note);

    wrap.appendChild(bd);
    this.shadow.appendChild(wrap);

    // collapsed pill ---------------------------------------------------
    this.pill = el('div', 'pill hide');
    this.pillLbl = el('span', 't', 'FEE');
    this.pillVal = el('span', null, '--');
    this.pill.appendChild(this.pillLbl);
    this.pill.appendChild(this.pillVal);
    this.pill.addEventListener('click', function () { self.setCollapsed(false); });
    this.shadow.appendChild(this.pill);

    this.setPos(this.loadPos());
  };

  Panel.prototype.setMode = function (m) {
    this.mode = m;
    this.btnUsd.classList.toggle('on', m === 'dollars');
    this.btnSh.classList.toggle('on', m === 'shares');
    this.unit.textContent = m === 'dollars' ? '$' : '#';
    this.amount = null;          // fall back to the page value in the new unit
    this.input.value = '';
    this.render();
  };

  Panel.prototype.setCollapsed = function (v) {
    this.collapsed = v;
    this.wrap.classList.toggle('hide', v);
    this.pill.classList.toggle('hide', !v);
    try { localStorage.setItem('pmfl.collapsed', v ? '1' : '0'); } catch (e) {}
  };

  Panel.prototype.loadPos = function () {
    try {
      var p = JSON.parse(localStorage.getItem('pmfl.pos') || 'null');
      if (p && isFinite(p.r) && isFinite(p.b)) return p;
    } catch (e) {}
    return { r: 18, b: 18 };
  };

  Panel.prototype.setPos = function (p) {
    this.pos = p;
    [this.wrap, this.pill].forEach(function (n) {
      n.style.right = p.r + 'px';
      n.style.bottom = p.b + 'px';
    });
  };

  Panel.prototype.makeDraggable = function (handle) {
    var self = this, sx = 0, sy = 0, sr = 0, sb = 0, on = false;
    handle.addEventListener('mousedown', function (e) {
      on = true; sx = e.clientX; sy = e.clientY;
      sr = self.pos.r; sb = self.pos.b;
      handle.classList.add('drag');
      e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!on) return;
      var r = Math.max(6, Math.min(window.innerWidth - 120, sr - (e.clientX - sx)));
      var b = Math.max(6, Math.min(window.innerHeight - 60, sb - (e.clientY - sy)));
      self.setPos({ r: r, b: b });
    });
    window.addEventListener('mouseup', function () {
      if (!on) return;
      on = false;
      handle.classList.remove('drag');
      try { localStorage.setItem('pmfl.pos', JSON.stringify(self.pos)); } catch (e) {}
    });
  };

  /* state: {title, market, side, outcomeIdx, price, pageAmount, maker, live} */
  Panel.prototype.update = function (state) {
    this.state = state;
    if (state && state.pageAmount != null) this.pageAmount = state.pageAmount;
    this.render();
  };

  Panel.prototype.effectiveSize = function (price) {
    // User override wins; otherwise mirror whatever is typed into the widget.
    var v = this.amount != null ? this.amount : this.pageAmount;
    if (!(v > 0)) return { shares: 0, dollars: 0 };
    if (this.mode === 'shares') return { shares: v, dollars: v * price };
    return { shares: price > 0 ? v / price : 0, dollars: v };
  };

  Panel.prototype.render = function () {
    var s = this.state;
    if (!s || !s.market) {
      this.dot.classList.add('off');
      this.q.textContent = 'Open a market page to see its fees.';
      this.tier.textContent = '';
      this.rows.textContent = '';
      this.fee.textContent = '--';
      this.feeSub.textContent = '';
      this.note.textContent = '';
      this.svgBox.textContent = '';
      this.cap.classList.add('hide');
      return;
    }

    var m = s.market;
    var sch = m.schedule;
    this.dot.classList.toggle('off', !s.live);
    this.q.textContent = m.question || s.title || '';

    // tier chips
    this.tier.textContent = '';
    if (!sch) {
      this.tier.appendChild(el('span', 'chip free', 'No trading fee'));
    } else {
      this.tier.appendChild(el('span', 'chip', niceFeeType(m.feeType)));
      this.tier.appendChild(el('span', 'chip' + (sch.rate >= 0.06 ? ' hot' : ''),
        'rate ' + pct(sch.rate, 0) + ' × p(1−p)'));
      this.tier.appendChild(el('span', 'chip',
        'max ' + money(F.maxFeePer100(sch)) + '/100sh'));
      if (sch.rebateRate) {
        this.tier.appendChild(el('span', 'chip', 'maker rebate ' + pct(sch.rebateRate, 0)));
      }
    }

    var price = s.price > 0 ? s.price : (m.prices && m.prices[s.outcomeIdx || 0]) || 0.5;
    var size = this.effectiveSize(price);

    // keep the input mirroring the page value until the user types their own
    if (this.amount == null) {
      var shown = this.mode === 'shares' ? size.shares : size.dollars;
      this.input.value = shown > 0 ? shown.toFixed(2) : '';
    }

    var q = F.quote({
      side: s.side || 'buy',
      price: price,
      shares: size.shares,
      schedule: sch,
      maker: !!s.maker
    });

    var outcome = (m.outcomes && m.outcomes[s.outcomeIdx || 0]) || '';
    this.heroLbl.textContent = s.maker ? 'Maker fee' : 'Taker fee';
    this.heroSide.textContent = (q.side === 'sell' ? 'SELL ' : 'BUY ')
      + outcome + ' @ ' + cents(price);

    var noFee = !sch || q.fee === 0;
    this.fee.textContent = (!sch || size.shares > 0) ? money(q.fee) : '--';
    this.fee.classList.toggle('zero', noFee);

    if (!sch) {
      this.feeSub.textContent = 'This market charges no trading fee.';
    } else if (s.maker) {
      this.feeSub.textContent = 'Resting limit order — makers pay nothing'
        + (q.rebate ? ' and earn about ' + money(q.rebate) + ' back.' : '.');
    } else if (size.shares > 0) {
      this.feeSub.textContent = pct(q.feePctOfNotional) + ' of your '
        + money(q.notional) + ' stake · ' + money(F.feePer100(price, sch)) + ' per 100 shares';
    } else {
      this.feeSub.textContent = 'Type a size here, or into the trade box.';
    }

    // breakdown rows
    this.rows.textContent = '';
    var self = this;
    function addRow(k, v, warn) {
      var r = el('div', 'row');
      r.appendChild(el('span', 'k', k));
      r.appendChild(el('span', 'v' + (warn ? ' warn' : ''), v));
      self.rows.appendChild(r);
    }
    if (size.shares > 0) {
      addRow('Shares', size.shares.toFixed(2));
      addRow(q.side === 'buy' ? 'You pay' : 'You receive', money(q.totalCost));
      if (sch && !s.maker) {
        addRow('Effective price', cents(q.effectivePrice), q.effectivePrice > price + 0.005);
        addRow('Break-even odds', pct(q.breakEvenProb, 1), true);
        addRow('Round trip fee', money(q.roundTripFee));
        addRow('Exit above', cents(q.roundTripBreakEven) + ' to profit');
      }
    } else if (sch) {
      addRow('At 10¢, per 100 sh', money(F.feePer100(0.10, sch)));
      addRow('At 50¢, per 100 sh', money(F.feePer100(0.50, sch)));
      addRow('At 90¢, per 100 sh', money(F.feePer100(0.90, sch)));
    }

    this.drawCurve(sch, price);

    this.note.textContent = '';
    if (sch) {
      this.note.appendChild(el('b', null, 'Takers only. '));
      this.note.appendChild(document.createTextNode(
        'A limit order that rests on the book pays no fee'
        + (sch.rebateRate ? ' and earns back ' + pct(sch.rebateRate, 0) + ' of the taker fee' : '')
        + '. The fee peaks at 50¢ and is symmetric, so ' + cents(price)
        + ' costs the same as ' + cents(1 - price) + '.'));
    } else {
      this.note.appendChild(document.createTextNode(
        'Fees are set per market by Polymarket and can change. This panel always '
        + 'reads the live schedule rather than a cached table.'));
    }

    this.pillVal.textContent = (!sch || size.shares > 0) ? money(q.fee) : '--';
  };

  Panel.prototype.drawCurve = function (sch, price) {
    var svg = this.svgBox;
    svg.textContent = '';
    if (!sch) { this.cap.classList.add('hide'); return; }
    this.cap.classList.remove('hide');

    var W = 300, H = 52, pad = 4;
    var peak = F.maxFeePer100(sch) || 1;
    var pts = [];
    for (var i = 0; i <= 100; i++) {
      var p = i / 100;
      var y = F.feePer100(p, sch);
      pts.push([pad + p * (W - 2 * pad), H - pad - (y / peak) * (H - 2 * pad - 6)]);
    }
    var NS = 'http://www.w3.org/2000/svg';
    var d = 'M' + pts.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join('L');

    var area = document.createElementNS(NS, 'path');
    area.setAttribute('d', d + 'L' + (W - pad) + ',' + (H - pad) + 'L' + pad + ',' + (H - pad) + 'Z');
    area.setAttribute('fill', 'rgba(255,143,107,.13)');
    svg.appendChild(area);

    var line = document.createElementNS(NS, 'path');
    line.setAttribute('d', d);
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', '#ff8f6b');
    line.setAttribute('stroke-width', '1.6');
    svg.appendChild(line);

    var cx = pad + Math.min(Math.max(price, 0), 1) * (W - 2 * pad);
    var cy = H - pad - (F.feePer100(price, sch) / peak) * (H - 2 * pad - 6);

    var v = document.createElementNS(NS, 'line');
    v.setAttribute('x1', cx); v.setAttribute('x2', cx);
    v.setAttribute('y1', cy); v.setAttribute('y2', H - pad);
    v.setAttribute('stroke', '#3d7dff');
    v.setAttribute('stroke-width', '1');
    v.setAttribute('stroke-dasharray', '2 2');
    svg.appendChild(v);

    var dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('r', '3');
    dot.setAttribute('fill', '#3d7dff');
    svg.appendChild(dot);
  };

  Panel.prototype.destroy = function () {
    if (this.host && this.host.parentNode) this.host.parentNode.removeChild(this.host);
  };

  root.PMPanel = Panel;
})(typeof globalThis !== 'undefined' ? globalThis : this);
