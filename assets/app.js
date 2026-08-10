/* Прототип-рантайм: табы, push-экраны, шторки, флоу покупки, квиз, тосты. */
(function () {
  "use strict";

  var device = document.querySelector(".device-screen");
  if (!device) return;

  function $(sel, root) { return (root || device).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || device).querySelectorAll(sel)); }
  function fmt(n) { return n.toLocaleString("ru-RU") + " ₽"; }

  /* ---------- Живое состояние приложения ---------- */
  var S = {
    balance: 52340, invested: 50000, xp: 240, xpNext: 400,
    goal: 100000, bonds: 31400, stocks: 15700, cash: 5240,
    tasks: { visit: true, lesson: false, topup: false },
    awarded: { lesson: false, buy: false, topup: false }
  };
  var lastBuyAmount = 10000;

  function setBind(name, text) {
    $all('[data-bind="' + name + '"]').forEach(function (el) { el.textContent = text; });
  }
  function render() {
    setBind("balance", fmt(S.balance));
    setBind("invested", fmt(S.invested));
    setBind("profit", "+" + fmt(S.balance - S.invested));
    setBind("xp", S.xp + " / " + S.xpNext + " XP");
    setBind("xp-chip", S.xp + " XP");
    $all('[data-bind="xp-bar"]').forEach(function (el) { el.style.width = Math.min(100, S.xp / S.xpNext * 100) + "%"; });

    var pct = Math.min(100, Math.round(S.balance / S.goal * 100));
    setBind("goal-pct", pct + " %");
    setBind("goal-remaining", fmt(Math.max(0, S.goal - S.balance)));
    setBind("goal-summary", fmt(S.balance) + " из " + fmt(S.goal) + " · к июню");
    $all('[data-bind="goal-bar"]').forEach(function (el) { el.style.width = pct + "%"; });

    var total = S.bonds + S.stocks + S.cash;
    [["bonds", S.bonds], ["stocks", S.stocks], ["cash", S.cash]].forEach(function (pair) {
      $all('[data-alloc="' + pair[0] + '"]').forEach(function (row) {
        var v = row.querySelector(".v"); var d = row.querySelector(".d");
        if (v) v.textContent = fmt(pair[1]);
        if (d) d.textContent = Math.round(pair[1] / total * 100) + " %";
      });
    });

    var done = (S.tasks.visit ? 1 : 0) + (S.tasks.lesson ? 1 : 0) + (S.tasks.topup ? 1 : 0);
    setBind("ring-count", done + "/3");
    $all('[data-bind="ring"]').forEach(function (el) { el.setAttribute("stroke-dashoffset", String(113 * (1 - done / 3))); });
    $all("[data-task]").forEach(function (row) { row.classList.toggle("task-done", !!S.tasks[row.dataset.task]); });
  }

  /* ---------- Tabs ---------- */
  var tabButtons = $all(".tabbar [data-tab]");
  var screens = $all(".screen");
  function showTab(name) {
    screens.forEach(function (s) { s.classList.toggle("active", s.dataset.screen === name); });
    tabButtons.forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === name)); });
    var active = screens.find ? screens.find(function (s) { return s.dataset.screen === name; }) : null;
    $all(".screen.active").forEach(function (s) { s.scrollTop = 0; });
  }
  tabButtons.forEach(function (b) {
    b.addEventListener("click", function () { showTab(b.dataset.tab); });
  });

  $all("[data-go-tab]").forEach(function (el) {
    el.addEventListener("click", function () { showTab(el.dataset.goTab); });
  });

  /* ---------- Push screens ---------- */
  $all("[data-push]").forEach(function (el) {
    el.addEventListener("click", function () {
      var p = $("#push-" + el.dataset.push);
      if (p) { p.classList.add("open"); p.scrollTop = 0; }
    });
  });
  $all("[data-back]").forEach(function (el) {
    el.addEventListener("click", function () {
      var p = el.closest(".push");
      if (p) p.classList.remove("open");
    });
  });

  /* ---------- Sheets ---------- */
  var dim = $(".dim");
  var openSheet = null;
  function sheetOpen(id) {
    var s = $("#sheet-" + id);
    if (!s) return;
    openSheet = s;
    resetSheet(s);
    s.classList.add("open");
    if (dim) dim.classList.add("open");
  }
  function sheetClose() {
    if (openSheet) openSheet.classList.remove("open");
    if (dim) dim.classList.remove("open");
    openSheet = null;
  }
  function resetSheet(s) {
    var steps = $all(".sheet-step", s);
    steps.forEach(function (st, i) { st.classList.toggle("on", i === 0); });
    $all(".quiz-opt", s).forEach(function (o) { o.classList.remove("correct", "wrong"); o.disabled = false; });
    $all(".quiz-note", s).forEach(function (n) { n.textContent = ""; n.classList.remove("ok"); });
    $all("[data-quiz-done]", s).forEach(function (b) { b.disabled = true; });
  }
  $all("[data-sheet]").forEach(function (el) {
    el.addEventListener("click", function () { sheetOpen(el.dataset.sheet); });
  });
  $all("[data-close-sheet]").forEach(function (el) {
    el.addEventListener("click", sheetClose);
  });
  if (dim) dim.addEventListener("click", sheetClose);

  /* ---------- Steps inside sheets ---------- */
  $all("[data-goto]").forEach(function (el) {
    el.addEventListener("click", function () {
      var sheet = el.closest(".sheet");
      if (!sheet) return;
      var target = $('.sheet-step[data-step="' + el.dataset.goto + '"]', sheet);
      if (!target) return;
      $all(".sheet-step", sheet).forEach(function (st) { st.classList.remove("on"); });
      target.classList.add("on");
      if (el.dataset.toast) toast(el.dataset.toast, el.dataset.toastXp || "");
    });
  });

  /* ---------- Amount presets + projection ---------- */
  $all(".amounts").forEach(function (group) {
    var buttons = $all("button", group);
    var sheet = group.closest(".sheet");
    function select(btn) {
      buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b === btn)); });
      var amount = parseInt(btn.dataset.amount, 10);
      lastBuyAmount = amount;
      var growth = parseFloat(group.dataset.growth || "1.12");
      $all("[data-projection]", sheet).forEach(function (el) { el.textContent = fmt(Math.round(amount * growth / 100) * 100); });
      $all("[data-amount-out]", sheet).forEach(function (el) { el.textContent = fmt(amount); });
      $all("[data-shares-out]", sheet).forEach(function (el) {
        var price = parseFloat(el.dataset.price || "312");
        el.textContent = "≈ " + Math.floor(amount / price) + " акции";
      });
    }
    buttons.forEach(function (b) { b.addEventListener("click", function () { select(b); }); });
    var preset = buttons.filter(function (b) { return b.getAttribute("aria-pressed") === "true"; })[0] || buttons[1] || buttons[0];
    if (preset) select(preset);
  });

  /* ---------- Quiz ---------- */
  $all(".quiz-opt").forEach(function (opt) {
    opt.addEventListener("click", function () {
      var sheet = opt.closest(".sheet");
      var note = $(".quiz-note", opt.closest(".sheet-step") || sheet);
      if (opt.dataset.correct === "true") {
        opt.classList.add("correct");
        $all(".quiz-opt", sheet).forEach(function (o) { o.disabled = true; });
        if (note) { note.textContent = "Верно! Спокойствие — суперсила инвестора."; note.classList.add("ok"); }
        $all("[data-quiz-done]", sheet).forEach(function (b) { b.disabled = false; });
      } else {
        opt.classList.add("wrong");
        opt.disabled = true;
        if (note) note.textContent = "Не спешите: продажа в просадку закрепляет убыток. Попробуйте ещё раз.";
      }
    });
  });

  /* ---------- Toast ---------- */
  var toastEl = $(".toast");
  var toastTimer = null;
  function toast(text, xp) {
    if (!toastEl) return;
    $(".t-text", toastEl).textContent = text;
    var xpEl = $(".t-xp", toastEl);
    if (xpEl) xpEl.textContent = xp || "";
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }
  $all("[data-toast-btn]").forEach(function (el) {
    el.addEventListener("click", function () { toast(el.dataset.toastBtn, el.dataset.toastXp || ""); });
  });

  /* Приветственный тост серии — как в концепции: через секунду после входа */
  if (device.dataset.welcomeToast) {
    setTimeout(function () { toast(device.dataset.welcomeToast, device.dataset.welcomeXp || ""); }, 1100);
  }

  /* ---------- Пополнение: клавиатура ввода ---------- */
  var numValue = 5000;
  function numRender() {
    setBind("num-display", numValue > 0 ? numValue.toLocaleString("ru-RU") : "0");
    $all("[data-topup-confirm]").forEach(function (b) { b.disabled = numValue <= 0; });
  }
  $all("[data-num]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.num === "del") numValue = Math.floor(numValue / 10);
      else if (String(numValue).length < 7) numValue = numValue * 10 + parseInt(b.dataset.num, 10);
      numRender();
    });
  });
  $all("[data-num-add]").forEach(function (b) {
    b.addEventListener("click", function () {
      numValue = Math.min(9999999, numValue + parseInt(b.dataset.numAdd, 10));
      numRender();
    });
  });
  $all("[data-topup-confirm]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (numValue <= 0) return;
      S.balance += numValue; S.invested += numValue; S.cash += numValue;
      S.tasks.topup = true;
      setBind("topup-out", "+" + fmt(numValue));
      var gotXp = !S.awarded.topup;
      if (gotXp) { S.awarded.topup = true; S.xp += 10; }
      render();
      var sheet = b.closest(".sheet");
      var next = sheet ? sheet.querySelector('.sheet-step[data-step="2"]') : null;
      if (next) {
        $all(".sheet-step", sheet).forEach(function (st) { st.classList.remove("on"); });
        next.classList.add("on");
      }
      if (gotXp) toast("Задание выполнено", "+10 XP");
    });
  });

  /* ---------- Подтверждение покупки ---------- */
  $all("[data-buy-confirm]").forEach(function (b) {
    b.addEventListener("click", function () {
      S.balance += lastBuyAmount; S.invested += lastBuyAmount; S.stocks += lastBuyAmount;
      if (!S.awarded.buy) { S.awarded.buy = true; S.xp += 100; }
      render();
    });
  });

  /* ---------- Завершение урока ---------- */
  $all("[data-lesson-done]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (!S.awarded.lesson) {
        S.awarded.lesson = true;
        S.xp += 20;
        S.tasks.lesson = true;
        render();
      }
    });
  });

  /* ---------- Demo state: есть портфель / новичок ---------- */
  var stateButtons = document.querySelectorAll(".proto-controls [data-state]");
  function setState(state) {
    stateButtons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.state === state)); });
    $all("[data-when]").forEach(function (el) { el.hidden = el.dataset.when !== state; });
  }
  stateButtons.forEach(function (b) {
    b.addEventListener("click", function () { setState(b.dataset.state); });
  });
  if (stateButtons.length) setState("full");
  else $all("[data-when]").forEach(function (el) { el.hidden = el.dataset.when !== "full"; });

  /* ---------- Success → домой ---------- */
  $all("[data-finish]").forEach(function (el) {
    el.addEventListener("click", function () {
      sheetClose();
      $all(".push.open").forEach(function (p) { p.classList.remove("open"); });
      showTab("home");
    });
  });

  render();
  numRender();
})();
