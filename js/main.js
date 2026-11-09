(function () {
  "use strict";

  var DICT = window.WEBBI_I18N || {};
  var root = document.documentElement;
  var state = {
    lang: /^fr/i.test(root.lang) ? "fr" : "en",
    page: document.body.getAttribute("data-page") || "home",
    view: "month"
  };

  /* ---------- helpers ---------- */
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function save(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* ignore */ } }
  function t(key) {
    var d = DICT[state.lang] || {};
    return d[key] != null ? d[key] : (DICT.en && DICT.en[key]) || "";
  }
  function fill(str, vars) { return str.replace(/\{(\w+)\}/g, function (_, k) { return vars[k]; }); }
  function fmt(n) { return Math.round(n).toLocaleString(state.lang === "fr" ? "fr-CA" : "en-CA"); }
  /* CAD money, local convention: EN "$1,788", FR "1 788 $" */
  function money(n) { return state.lang === "fr" ? fmt(n) + " $" : "$" + fmt(n); }
  function moneyRange(lo, hi) {
    return state.lang === "fr" ? fmt(lo) + "–" + fmt(hi) + " $" : "$" + fmt(lo) + "–" + fmt(hi);
  }

  /* ---------- language: remember the visitor's choice for the home address ---------- */
  save("webbi-lang", state.lang);
  document.querySelectorAll(".lang a[data-lang]").forEach(function (a) {
    a.addEventListener("click", function () {
      save("webbi-lang", a.getAttribute("data-lang"));
      // keep the visitor on the same section of the page in the other language
      if (location.hash) a.href = a.href.split("#")[0] + location.hash;
    });
  });

  /* ---------- pricing: monthly vs first-year total ---------- */
  function renderPrices(animate) {
    document.querySelectorAll(".plan").forEach(function (plan) {
      var then = plan.querySelector(".plan-then");
      var amt = plan.querySelector(".amt");
      var setup = +then.dataset.setup, min = +then.dataset.min, max = +then.dataset.max;
      var range = min !== max;
      if (state.view === "year") {
        var lo = setup + 12 * min, hi = setup + 12 * max;
        amt.textContent = range ? moneyRange(lo, hi) : money(lo);
        var fee = range ? moneyRange(min, max) : money(min);
        then.textContent = "";
        var yr = document.createElement("span");
        yr.className = "yr";
        yr.textContent = fill(t("year.calc"), { setup: money(setup), fee: fee });
        then.append(yr, " · " + t("year.total"));
      } else {
        amt.textContent = money(setup);
        then.textContent = t("then") + " " + (range ? money(min) + " " + t("to") + " " + money(max) : money(min)) + " " + t("permonth");
      }
      if (animate) { amt.classList.remove("flip"); void amt.offsetWidth; amt.classList.add("flip"); }
    });
    document.querySelectorAll("[data-view]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === state.view));
    });
  }
  document.querySelectorAll("[data-view]").forEach(function (b) {
    b.addEventListener("click", function () { state.view = b.getAttribute("data-view"); renderPrices(true); });
  });

  /* ---------- hero build ticker: days 1→7 then "Live" ---------- */
  function runTicker() {
    var daysEl = document.getElementById("days");
    var stateEl = document.getElementById("ticker-state");
    if (!daysEl) return;
    var day = 0;
    function render() {
      for (var i = 0; i < daysEl.children.length; i++) daysEl.children[i].classList.toggle("on", i < day);
      stateEl.textContent = day >= 7 || day === 0 ? t("ticker.live") : t("ticker.day") + " " + day;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { day = 7; render(); return; }
    function step() {
      day++; render();
      if (day < 7) setTimeout(step, 380);
      else setTimeout(function () { day = 0; render(); setTimeout(step, 900); }, 4200);
    }
    render();
    setTimeout(step, 1600);
  }

  /* ---------- subtle parallax on the hero stage ---------- */
  function initTilt() {
    var stage = document.querySelector(".stage");
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce), (hover: none)").matches) return;
    var browser = stage.querySelector(".browser"), phone = stage.querySelector(".phone");
    stage.classList.add("is-tilting");
    stage.addEventListener("pointermove", function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      browser.style.transform = "translate(" + x * -10 + "px," + y * -8 + "px)";
      phone.style.transform = "translate(" + x * 16 + "px," + y * 12 + "px)";
    });
    stage.addEventListener("pointerleave", function () { browser.style.transform = phone.style.transform = ""; });
  }

  /* ---------- header ---------- */
  function initHeader() {
    var top = document.getElementById("top");
    var onScroll = function () { top.classList.toggle("is-scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

    // on narrow screens the menu is a tab row that may scroll sideways: keep the current tab in view
    var nav = document.getElementById("nav");
    var cur = nav && nav.querySelector('[aria-current="page"]');
    if (cur && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft = cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2;
    }
  }

  /* ---------- swipe left/right on phones to go to the next/previous page ---------- */
  function initSwipe() {
    var next = document.querySelector('.pager a[rel="next"]');
    var prev = document.querySelector('.pager a[rel="prev"]');
    if (!next && !prev) return;
    var x0 = null, y0 = 0, t0 = 0;
    var ignore = "input, textarea, select, button, .nav, .seg, .stage, .faq summary";
    document.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1 || e.target.closest(ignore)) { x0 = null; return; }
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Date.now() - t0 > 700 || Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return;
      var target = dx < 0 ? next : prev;
      if (target) location.href = target.href;
    }, { passive: true });
  }

  /* ---------- theme ---------- */
  function initTheme() {
    var saved = load("webbi-theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var cur = root.getAttribute("data-theme") ||
        (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      var next = cur === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      save("webbi-theme", next);
    });
  }

  /* ---------- copy buttons ---------- */
  function initCopy() {
    document.querySelectorAll("[data-copy]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var done = function () {
          btn.textContent = t("copied");
          setTimeout(function () { btn.textContent = t("copy"); }, 1600);
        };
        var fallback = function () {
          var v = btn.parentElement.querySelector(".cl-value");
          var range = document.createRange(); range.selectNodeContents(v);
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(btn.getAttribute("data-copy")).then(done, fallback);
        } else fallback();
      });
    });
  }

  /* ---------- contact form → prefilled email ---------- */
  function initForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;
    var status = document.getElementById("form-status");
    var plan = document.getElementById("f-plan");

    // "Choose Growth" etc. link here with ?plan=growth
    var wanted = new URLSearchParams(location.search).get("plan");
    if (wanted && plan.querySelector('option[value="' + wanted.replace(/[^a-z]/g, "") + '"]')) plan.value = wanted;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim(), email = form.email.value.trim(), msg = form.message.value.trim();
      var bad = [];
      if (!name) bad.push(form.name);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) bad.push(form.email);
      if (!msg) bad.push(form.message);
      form.querySelectorAll(".invalid").forEach(function (el) { el.classList.remove("invalid"); });
      if (bad.length) {
        bad.forEach(function (el) { el.classList.add("invalid"); });
        bad[0].focus();
        status.className = "form-status err"; status.textContent = t("form.err");
        return;
      }
      var lines = [
        t("mail.name") + ": " + name,
        t("mail.email") + ": " + email,
        t("mail.phone") + ": " + (form.phone.value.trim() || "-"),
        t("mail.business") + ": " + (form.business.value.trim() || "-"),
        t("mail.plan") + ": " + plan.options[plan.selectedIndex].text,
        "",
        t("mail.msg") + ":",
        msg
      ];
      var href = "mailto:webbicontacts@gmail.com?subject=" + encodeURIComponent(fill(t("mail.subject"), { name: name })) +
        "&body=" + encodeURIComponent(lines.join("\n"));
      status.className = "form-status ok"; status.textContent = t("form.ok");
      window.location.href = href;
    });
  }

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  initTheme();
  runTicker();
  initTilt();
  initHeader();
  initSwipe();
  initCopy();
  initForm();
})();
