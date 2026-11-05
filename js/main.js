(function () {
  "use strict";

  var DICT = window.WEBBI_I18N || {};
  var root = document.documentElement;
  var state = { lang: "en", view: "month" };

  /* ---------- storage helpers (never required) ---------- */
  function load(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function save(key, val) { try { localStorage.setItem(key, val); } catch (e) { /* ignore */ } }

  function t(key) {
    var d = DICT[state.lang] || {};
    return d[key] != null ? d[key] : (DICT.en && DICT.en[key]) || "";
  }
  function fill(str, vars) { return str.replace(/\{(\w+)\}/g, function (_, k) { return vars[k]; }); }

  /* CAD money, local convention: EN "$1,788", FR "1 788 $" */
  function money(n) {
    var s = Math.round(n).toLocaleString(state.lang === "fr" ? "fr-CA" : "en-CA");
    return state.lang === "fr" ? s + " $" : "$" + s;
  }

  /* EN "$2,388–3,108", FR "2 388–3 108 $" */
  function moneyRange(lo, hi) {
    var loc = state.lang === "fr" ? "fr-CA" : "en-CA";
    var a = Math.round(lo).toLocaleString(loc), b = Math.round(hi).toLocaleString(loc);
    return state.lang === "fr" ? a + "–" + b + " $" : "$" + a + "–" + b;
  }

  /* ---------- language ---------- */
  function initialLang() {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "fr" || q === "en") return q;
    var saved = load("webbi-lang");
    if (saved === "fr" || saved === "en") return saved;
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "en";
    return /^fr/i.test(nav) ? "fr" : "en";
  }

  function applyLang(lang) {
    state.lang = lang;
    root.lang = lang === "fr" ? "fr-CA" : "en-CA";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n"));
      if (v) el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = t(el.getAttribute("data-i18n-html"));
      if (v) el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria")));
    });
    document.querySelectorAll("[data-lang]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-lang") === lang));
    });
    document.title = t("meta.title");
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", t("meta.desc"));
    renderPrices();
    renderTicker();
  }

  /* ---------- prices ---------- */
  function renderPrices() {
    document.querySelectorAll("[data-price]").forEach(function (el) {
      if (el.closest(".plan")) return; // plans are rendered below
      el.textContent = money(+el.getAttribute("data-price"));
    });
    document.querySelectorAll(".plan").forEach(function (plan) {
      var then = plan.querySelector(".plan-then");
      var amt = plan.querySelector(".amt");
      var setup = +then.dataset.setup, min = +then.dataset.min, max = +then.dataset.max;
      var range = min !== max;
      if (state.view === "year") {
        var lo = setup + 12 * min, hi = setup + 12 * max;
        amt.textContent = range ? moneyRange(lo, hi) : money(lo);
        var fee = range ? moneyRange(min, max) : money(min);
        then.innerHTML = "";
        var yr = document.createElement("span");
        yr.className = "yr";
        yr.textContent = fill(t("year.calc"), { setup: money(setup), fee: fee });
        then.append(yr, " · " + t("year.total"));
      } else {
        amt.textContent = money(setup);
        then.textContent = t("then") + " " + (range ? money(min) + " " + t("to") + " " + money(max) : money(min)) + " " + t("permonth");
      }
      amt.classList.remove("flip"); void amt.offsetWidth; amt.classList.add("flip");
    });
    document.querySelectorAll("[data-view]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-view") === state.view));
    });
  }

  /* ---------- hero build ticker: days 1→7 then "Live" ---------- */
  var tick = { day: 0, timer: null };
  var daysEl = document.getElementById("days");
  var stateEl = document.getElementById("ticker-state");
  function renderTicker() {
    if (!daysEl) return;
    var spans = daysEl.children;
    for (var i = 0; i < spans.length; i++) spans[i].classList.toggle("on", i < tick.day);
    stateEl.textContent = tick.day >= 7 || tick.day === 0 ? t("ticker.live") : t("ticker.day") + " " + tick.day;
  }
  function runTicker() {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { tick.day = 7; renderTicker(); return; }
    tick.day = 0; renderTicker();
    var step = function () {
      tick.day++;
      renderTicker();
      if (tick.day < 7) tick.timer = setTimeout(step, 380);
      else tick.timer = setTimeout(function () { tick.day = 0; renderTicker(); tick.timer = setTimeout(step, 900); }, 4200);
    };
    tick.timer = setTimeout(step, 1600);
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

  /* ---------- header, menu, active nav ---------- */
  function initHeader() {
    var top = document.getElementById("top");
    var onScroll = function () { top.classList.toggle("is-scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();

    var btn = document.getElementById("menu-btn"), nav = document.getElementById("nav");
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
    });
    nav.addEventListener("click", function (e) {
      if (e.target.closest("a")) { btn.setAttribute("aria-expanded", "false"); nav.classList.remove("is-open"); }
    });

    if (!("IntersectionObserver" in window)) return;
    var links = {};
    nav.querySelectorAll("a").forEach(function (a) { links[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && links[en.target.id]) {
          Object.keys(links).forEach(function (k) { links[k].classList.toggle("is-active", k === en.target.id); });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) io.observe(s); });
  }

  /* ---------- theme ---------- */
  function initTheme() {
    var saved = load("webbi-theme");
    if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);
    document.getElementById("theme-toggle").addEventListener("click", function () {
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
        var text = btn.getAttribute("data-copy");
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
          navigator.clipboard.writeText(text).then(done, fallback);
        } else fallback();
      });
    });
  }

  /* ---------- contact form → prefilled email ---------- */
  function initForm() {
    var form = document.getElementById("contact-form");
    var status = document.getElementById("form-status");
    var plan = document.getElementById("f-plan");

    document.querySelectorAll("[data-plan]").forEach(function (a) {
      a.addEventListener("click", function () { plan.value = a.getAttribute("data-plan"); });
    });

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

  /* ---------- boot ---------- */
  document.querySelectorAll("[data-lang]").forEach(function (b) {
    b.addEventListener("click", function () {
      var l = b.getAttribute("data-lang");
      save("webbi-lang", l);
      applyLang(l);
    });
  });
  document.querySelectorAll("[data-view]").forEach(function (b) {
    b.addEventListener("click", function () { state.view = b.getAttribute("data-view"); renderPrices(); });
  });

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  initTheme();
  applyLang(initialLang());
  runTicker();
  initTilt();
  initHeader();
  initCopy();
  initForm();
})();
