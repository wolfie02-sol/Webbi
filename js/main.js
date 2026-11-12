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

    // run only while the hero is on screen and the tab is visible
    var hero = document.querySelector(".hero"), onScreen = true, timer = null;
    function active() { return onScreen && !document.hidden; }
    function schedule(fn, ms) { clearTimeout(timer); timer = setTimeout(function () { timer = null; if (active()) fn(); }, ms); }
    function step() {
      day++; render();
      if (day < 7) schedule(step, 380);
      else schedule(function () { day = 0; render(); schedule(step, 900); }, 4200);
    }
    function resume() {
      if (hero) hero.classList.toggle("is-paused", !active());
      if (active() && !timer) schedule(step, day >= 7 ? 1200 : 380);
    }
    if ("IntersectionObserver" in window && hero) {
      new IntersectionObserver(function (entries) { onScreen = entries[0].isIntersecting; resume(); }).observe(hero);
    }
    document.addEventListener("visibilitychange", resume);
    render();
    schedule(step, 1600);
  }

  /* ---------- subtle parallax on the hero stage ---------- */
  function initTilt() {
    var stage = document.querySelector(".stage");
    if (!stage || window.matchMedia("(prefers-reduced-motion: reduce), (hover: none)").matches) return;
    var browser = stage.querySelector(".browser"), phone = stage.querySelector(".phone");
    stage.classList.add("is-tilting");
    var pending = null, frame = 0;
    // apply at most once per frame, however fast the mouse moves
    stage.addEventListener("pointermove", function (e) {
      pending = e;
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = 0;
        var r = stage.getBoundingClientRect();
        var x = (pending.clientX - r.left) / r.width - .5, y = (pending.clientY - r.top) / r.height - .5;
        browser.style.transform = "translate(" + x * -10 + "px," + y * -8 + "px)";
        phone.style.transform = "translate(" + x * 16 + "px," + y * 12 + "px)";
      });
    });
    stage.addEventListener("pointerleave", function () {
      if (frame) { cancelAnimationFrame(frame); frame = 0; }
      browser.style.transform = phone.style.transform = "";
    });
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

  /* ---------- contact form: sends through contact.php, falls back to the visitor's email app ---------- */
  function initForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;
    var status = document.getElementById("form-status");
    var plan = document.getElementById("f-plan");
    var submit = document.getElementById("f-submit");
    var started = document.getElementById("f-t");
    if (started) started.value = String(Date.now());

    // "Choose Growth" etc. link here with ?plan=growth
    var wanted = (new URLSearchParams(location.search).get("plan") || "").replace(/[^a-z]/g, "");
    if (wanted && plan.querySelector('option[value="' + wanted + '"]')) plan.value = wanted;

    function setStatus(kind, text) { status.className = "form-status " + kind; status.textContent = text; }

    function mailtoFallback(name, email, msg) {
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
      setStatus("ok", t("form.ok"));
      window.location.href = "mailto:webbicontacts@gmail.com?subject=" +
        encodeURIComponent(fill(t("mail.subject"), { name: name })) + "&body=" + encodeURIComponent(lines.join("\n"));
    }

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
        setStatus("err", t("form.err"));
        return;
      }

      // pages opened straight from disk have no server to send to
      if (location.protocol === "file:" || !window.fetch) { mailtoFallback(name, email, msg); return; }

      submit.disabled = true;
      var label = submit.textContent;
      submit.textContent = t("form.sending");
      setStatus("", "");
      fetch(form.getAttribute("action"), { method: "POST", body: new FormData(form), headers: { Accept: "application/json" } })
        .then(function (r) {
          var type = r.headers.get("content-type") || "";
          if (type.indexOf("json") === -1) throw new Error("no-server"); // e.g. a host without PHP
          return r.json().then(function (data) { return { status: r.status, data: data }; });
        })
        .then(function (res) {
          if (res.data && res.data.ok) {
            form.reset();
            if (started) started.value = String(Date.now());
            setStatus("ok", t("form.sent"));
          } else if (res.status === 400) {
            setStatus("err", t("form.err"));
          } else {
            setStatus("err", t("form.fail"));
          }
        })
        .catch(function () { mailtoFallback(name, email, msg); })
        .then(function () { submit.disabled = false; submit.textContent = label; });
    });
  }

  /* ---------- "Which package is right for you?" quiz ---------- */
  function initQuiz() {
    var box = document.getElementById("quiz-box");
    if (!box) return;
    var qs = Array.prototype.slice.call(box.querySelectorAll(".quiz-q"));
    var result = document.getElementById("quiz-result");
    var stepEl = document.getElementById("quiz-step"), bar = document.getElementById("quiz-bar");
    var back = document.getElementById("quiz-back"), restart = document.getElementById("quiz-restart");
    var answers = {}, at = 0;
    var PLANS = {
      basic: { name: t("pkg.basic"), setup: 200, min: 10, max: 10 },
      starter: { name: t("pkg.starter"), setup: 300, min: 40, max: 40 },
      growth: { name: t("pkg.growth"), setup: 500, min: 60, max: 60 },
      premium: { name: "Premium", setup: 948, min: 120, max: 180 }
    };

    function pick() {
      if (answers.sell === "yes" || answers.custom === "yes") return "premium";
      if (answers.booking === "yes" || answers.seo === "yes") return "growth";
      return answers.edit === "yes" ? "starter" : "basic";
    }

    function show(i) {
      at = i;
      qs.forEach(function (q, k) { q.hidden = k !== i; });
      var done = i >= qs.length;
      result.hidden = !done;
      stepEl.textContent = done ? t("quiz.result") : fill(t("quiz.step"), { n: i + 1, total: qs.length });
      bar.style.width = (done ? 100 : (i / qs.length) * 100) + "%";
      back.hidden = i === 0 || done;
      restart.hidden = !done;
      document.querySelectorAll(".plan.is-recommended").forEach(function (p) { p.classList.remove("is-recommended"); });
      if (done) {
        var id = pick(), p = PLANS[id];
        document.getElementById("quiz-plan").textContent = p.name;
        document.getElementById("quiz-price").textContent = money(p.setup) + " · " + t("then") + " " +
          (p.min === p.max ? money(p.min) : money(p.min) + " " + t("to") + " " + money(p.max)) + " " + t("permonth");
        document.getElementById("quiz-why").textContent = t("quiz.r." + id);
        document.getElementById("quiz-choose").href = box.getAttribute("data-contact") + "?plan=" + id;
        document.getElementById("quiz-see").href = "#plan-" + id;
        var card = document.getElementById("plan-" + id);
        if (card) card.classList.add("is-recommended");
      }
    }

    qs.forEach(function (q, k) {
      q.querySelectorAll("[data-a]").forEach(function (b) {
        b.addEventListener("click", function () {
          answers[q.getAttribute("data-q")] = b.getAttribute("data-a");
          show(k + 1);
          var next = k + 1 < qs.length ? qs[k + 1].querySelector("button") : document.getElementById("quiz-choose");
          if (next) next.focus({ preventScroll: true });
        });
      });
    });
    back.addEventListener("click", function () { show(Math.max(0, at - 1)); });
    restart.addEventListener("click", function () { answers = {}; show(0); });
    show(0);
  }

  /* ---------- open at the top when arriving from a link ----------
     Browsers do this already; previews that show the site inside a frame can keep the old scroll position. */
  function startAtTop() {
    var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
    if (location.hash || (nav && nav.type === "back_forward")) return;
    var go = function () {
      window.scrollTo(0, 0);
      try { document.body.scrollIntoView({ block: "start" }); } catch (e) { /* ignore */ }
    };
    go();
    window.addEventListener("load", go);
  }
  startAtTop();

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  initTheme();
  runTicker();
  initTilt();
  initHeader();
  initSwipe();
  initCopy();
  initForm();
  initQuiz();
})();
