/* Движок графиков: герой-графики с периодами и скраббингом + спарклайны.
   Детализация как в больших брокерских приложениях: сетка, ось цен,
   свечение линии, пульс последней точки, тултип под пальцем. */
(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var N = 48;               // точек в серии
  var W = 352, H = 168;     // viewBox
  var PLOT_W = 312, PAD_T = 12, PAD_B = 14;

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* Случайное блуждание из start в end с заданной «дрожью» */
  function makeSeries(seed, start, end, vol) {
    var rnd = mulberry32(seed);
    var pts = [start];
    var noise = 0; // накопленное блуждание, а не независимые выбросы
    for (var i = 1; i < N; i++) {
      var progress = i / (N - 1);
      var drift = start + (end - start) * progress;
      var wave = Math.sin(progress * Math.PI * (2 + rnd() * 2)) * vol * 0.35;
      noise += (rnd() - 0.5) * 2 * vol * 0.3;
      var pull = 1 - Math.pow(progress, 3) * 0.85; // к концу прижимаемся к цели
      pts.push(drift + (wave * 0.5 + noise) * pull * (end - start === 0 ? 1 : Math.abs(end - start)) * 0.5);
    }
    pts[N - 1] = end;
    return pts;
  }

  function fmtRub(n) { return Math.round(n).toLocaleString("ru-RU") + " ₽"; }

  var CHARTS = {
    portfolio: {
      currency: fmtRub,
      periods: {
        "1d":  { series: makeSeries(11, 52020, 52340, 0.30), delta: "▲ +320 ₽ (0,6 %) сегодня",  times: ["10:00", "12:00", "14:00", "16:00", "19:00"] },
        "1w":  { series: makeSeries(12, 51560, 52340, 0.28), delta: "▲ +780 ₽ (1,5 %) за неделю", times: ["пн", "вт", "ср", "чт", "пт"] },
        "1m":  { series: makeSeries(13, 50420, 52340, 0.30), delta: "▲ +1 920 ₽ (3,8 %) за месяц", times: ["12 июл", "19 июл", "26 июл", "2 авг", "10 авг"] },
        "all": { series: makeSeries(14, 50000, 52340, 0.30), delta: "▲ +2 340 ₽ (4,7 %) с июля",  times: ["июл", "", "", "", "авг"] }
      }
    },
    sber: {
      currency: fmtRub,
      periods: {
        "1d":  { series: makeSeries(21, 309.5, 312, 0.30), delta: "▲ +2,5 ₽ (0,8 %) сегодня",  times: ["10:00", "12:00", "14:00", "16:00", "19:00"] },
        "1w":  { series: makeSeries(22, 306, 312, 0.28),   delta: "▲ +6 ₽ (1,9 %) за неделю",  times: ["пн", "вт", "ср", "чт", "пт"] },
        "1m":  { series: makeSeries(23, 299, 312, 0.30),   delta: "▲ +13 ₽ (4,2 %) за месяц",  times: ["12 июл", "19 июл", "26 июл", "2 авг", "10 авг"] },
        "1y":  { series: makeSeries(24, 254, 312, 0.30),   delta: "▲ +58 ₽ (23 %) за год",     times: ["авг 25", "ноя", "фев", "май", "авг 26"] },
        "5y":  { series: makeSeries(25, 143, 312, 0.34),   delta: "▲ +169 ₽ (118 %) за 5 лет", times: ["2021", "2022", "2023", "2024", "2026"] },
        "all": { series: makeSeries(26, 96, 312, 0.36),    delta: "▲ +216 ₽ (225 %) за всё время", times: ["2007", "2012", "2017", "2022", "2026"] }
      }
    }
  };

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  function niceLabel(v, isMoney) {
    return isMoney ? Math.round(v).toLocaleString("ru-RU") : String(Math.round(v));
  }

  function initChart(wrap) {
    var name = wrap.dataset.chart;
    var cfg = CHARTS[name];
    if (!cfg) return;
    var keys = Object.keys(cfg.periods);
    var current = cfg.periods[keys[0]].series.slice();
    var activeKey = keys[0];
    var animFrame = null;

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "График стоимости" }, null);
    wrap.appendChild(svg);

    var defs = el("defs", {}, svg);
    var gradId = "area-" + name;
    var grad = el("linearGradient", { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el("stop", { offset: "0", "stop-color": "#30D158", "stop-opacity": ".26" }, grad);
    el("stop", { offset: "1", "stop-color": "#30D158", "stop-opacity": "0" }, grad);

    var grid = el("g", { "class": "chart-grid" }, svg);
    var axis = el("g", { "class": "chart-axis" }, svg);
    var gridYs = [PAD_T + 4, H / 2, H - PAD_B - 4];
    var gridLines = gridYs.map(function (y) { return el("line", { x1: 0, x2: PLOT_W, y1: y, y2: y }, grid); });
    var axisTexts = gridYs.map(function (y) { return el("text", { x: PLOT_W + 6, y: y + 3.5 }, axis); });

    var area = el("path", { "class": "chart-area", fill: "url(#" + gradId + ")" }, svg);
    var line = el("path", { "class": "chart-line" }, svg);
    var dotOuter = el("circle", { "class": "chart-dot-outer", r: 7 }, svg);
    var dotInner = el("circle", { "class": "chart-dot-inner", r: 3.5 }, svg);

    var scrubG = el("g", { visibility: "hidden" }, svg);
    var scrubLine = el("line", { "class": "chart-scrub-line", y1: 4, y2: H - PAD_B }, scrubG);
    var scrubDot = el("circle", { "class": "chart-scrub-dot", r: 4 }, scrubG);

    var label = document.createElement("div");
    label.className = "chart-scrub-label";
    label.hidden = true;
    wrap.appendChild(label);

    function bounds(series) {
      var min = Math.min.apply(null, series), max = Math.max.apply(null, series);
      var pad = (max - min) * 0.08 || 1;
      return [min - pad, max + pad];
    }

    function xy(series, i, b) {
      var x = i / (N - 1) * PLOT_W;
      var y = H - PAD_B - (series[i] - b[0]) / (b[1] - b[0]) * (H - PAD_T - PAD_B);
      return [x, y];
    }

    function draw(series) {
      var b = bounds(series);
      var d = "";
      for (var i = 0; i < N; i++) {
        var p = xy(series, i, b);
        d += (i ? "L" : "M") + p[0].toFixed(1) + "," + p[1].toFixed(1);
      }
      line.setAttribute("d", d);
      area.setAttribute("d", d + "L" + PLOT_W + "," + (H - PAD_B) + "L0," + (H - PAD_B) + "Z");
      var last = xy(series, N - 1, b);
      dotOuter.setAttribute("cx", last[0]); dotOuter.setAttribute("cy", last[1]);
      dotInner.setAttribute("cx", last[0]); dotInner.setAttribute("cy", last[1]);
      var isMoney = true;
      axisTexts[0].textContent = niceLabel(b[1], isMoney);
      axisTexts[1].textContent = niceLabel((b[0] + b[1]) / 2, isMoney);
      axisTexts[2].textContent = niceLabel(b[0], isMoney);
      return b;
    }

    var curBounds = draw(current);

    function setPeriod(key) {
      var target = cfg.periods[key];
      if (!target || key === activeKey) return;
      activeKey = key;
      var from = current.slice(), to = target.series;
      var t0 = null;
      if (animFrame) cancelAnimationFrame(animFrame);
      function step(ts) {
        if (!t0) t0 = ts;
        var t = Math.min(1, (ts - t0) / 320);
        var e = 1 - Math.pow(1 - t, 3); // ease-out cubic
        for (var i = 0; i < N; i++) current[i] = from[i] + (to[i] - from[i]) * e;
        curBounds = draw(current);
        if (t < 1) animFrame = requestAnimationFrame(step);
      }
      animFrame = requestAnimationFrame(step);

      document.querySelectorAll('[data-chart-delta="' + name + '"]').forEach(function (elm) {
        elm.textContent = target.delta;
      });
      document.querySelectorAll('[data-chart-times="' + name + '"]').forEach(function (elm) {
        elm.innerHTML = target.times.map(function (t) { return "<span>" + t + "</span>"; }).join("");
      });
    }

    document.querySelectorAll('[data-chart-periods="' + name + '"] button').forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll('[data-chart-periods="' + name + '"] button').forEach(function (b) {
          b.setAttribute("aria-pressed", String(b === btn));
        });
        setPeriod(btn.dataset.period);
      });
    });

    // первичная разметка времени
    document.querySelectorAll('[data-chart-times="' + name + '"]').forEach(function (elm) {
      elm.innerHTML = cfg.periods[activeKey].times.map(function (t) { return "<span>" + t + "</span>"; }).join("");
    });

    /* ---------- Скраббинг пальцем ---------- */
    function scrubAt(clientX) {
      var rect = svg.getBoundingClientRect();
      var scale = rect.width / W;
      var x = (clientX - rect.left) / scale;
      x = Math.max(0, Math.min(PLOT_W, x));
      var i = Math.round(x / PLOT_W * (N - 1));
      var p = xy(current, i, curBounds);
      scrubLine.setAttribute("x1", p[0]); scrubLine.setAttribute("x2", p[0]);
      scrubDot.setAttribute("cx", p[0]); scrubDot.setAttribute("cy", p[1]);
      scrubG.setAttribute("visibility", "visible");
      dotOuter.style.visibility = "hidden";
      var v = current[i];
      var d0 = current[0];
      var pct = d0 ? ((v - d0) / d0 * 100) : 0;
      var sign = pct >= 0 ? "+" : "−";
      label.innerHTML = cfg.currency(v) + '<span class="d">' + sign + Math.abs(pct).toFixed(1).replace(".", ",") + " %</span>";
      label.hidden = false;
      var px = p[0] * scale;
      px = Math.max(46, Math.min(rect.width - 46, px));
      label.style.left = px + "px";
    }
    function scrubEnd() {
      scrubG.setAttribute("visibility", "hidden");
      label.hidden = true;
      dotOuter.style.visibility = "";
    }
    /* Тач: скраббинг включается только когда жест явно горизонтальный,
       чтобы вертикальный скролл по графику не мигал тултипом. */
    var gest = null;
    svg.addEventListener("pointerdown", function (e) {
      svg.setPointerCapture(e.pointerId);
      if (e.pointerType === "touch") {
        gest = { active: false, x: e.clientX, y: e.clientY };
      } else {
        gest = { active: true };
        scrubAt(e.clientX);
      }
    });
    svg.addEventListener("pointermove", function (e) {
      if (!gest) return;
      if (!gest.active) {
        var dx = Math.abs(e.clientX - gest.x), dy = Math.abs(e.clientY - gest.y);
        if (dx > 6 && dx > dy) gest.active = true;
        else if (dy > 8 && dy > dx) { gest = null; return; }
        else return;
      }
      if (e.pointerType === "touch" || e.pressure > 0 || e.buttons) scrubAt(e.clientX);
    });
    function endGesture() { gest = null; scrubEnd(); }
    svg.addEventListener("pointerup", endGesture);
    svg.addEventListener("pointercancel", endGesture);
    svg.addEventListener("lostpointercapture", endGesture);
  }

  /* ---------- Спарклайны ---------- */
  function initSpark(svg) {
    var seed = parseInt(svg.dataset.spark, 10) || 1;
    var down = svg.dataset.trend === "down";
    svg.classList.add(down ? "down" : "up");
    var w = parseInt(svg.getAttribute("width"), 10) || 56;
    var h = parseInt(svg.getAttribute("height"), 10) || 20;
    var rnd = mulberry32(seed);
    var n = 18, pts = [], v = 0.5;
    for (var i = 0; i < n; i++) {
      v += (rnd() - (down ? 0.58 : 0.42)) * 0.22;
      v = Math.max(0.05, Math.min(0.95, v));
      pts.push(v);
    }
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    var span = (max - min) || 1;
    var str = pts.map(function (p, i) {
      var x = (i / (n - 1) * (w - 2) + 1).toFixed(1);
      var y = (h - 2 - (p - min) / span * (h - 4)).toFixed(1);
      return x + "," + y;
    }).join(" ");
    var poly = document.createElementNS(NS, "polyline");
    poly.setAttribute("points", str);
    svg.appendChild(poly);
  }

  document.querySelectorAll(".chart-wrap[data-chart]").forEach(initChart);
  document.querySelectorAll("svg.spark[data-spark]").forEach(initSpark);
})();
