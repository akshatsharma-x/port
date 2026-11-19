import { RAF_FUNNEL_SCRIPT } from "./raf-funnel";
import { boot } from "./motion";
import { STORAGE_KEY } from "./store";

/**
 * Runs in <head> before first paint: applies the persisted theme, the reduced-motion preference
 * and the `js` class (so reveals only hide content when JS can reveal it). Must stay tiny and
 * dependency-free.
 */
export const themeScript = `(function(){var d=document.documentElement;try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(
  STORAGE_KEY,
)})||"null");var t=s&&s.state&&s.state.theme;if(t==="phosphor"||t==="amber"||t==="paper")d.setAttribute("data-theme",t);}catch(e){}try{d.setAttribute("data-motion",matchMedia("(prefers-reduced-motion: reduce)").matches?"reduce":"full");}catch(e){}d.classList.add("js");})();`;

/**
 * Dev overlay only (?debug=1): records every WebGL context any code creates, before any code can,
 * so "contexts alive" in the overlay is measured — not taken on trust from our own factory.
 */
const GL_CENSUS_SCRIPT = `(function(w){if(!/[?&]debug=1(&|$)/.test(w.location.search))return;var all=w.__glContexts=[];function patch(P){if(!P)return;var g=P.prototype.getContext;P.prototype.getContext=function(t){var c=g.apply(this,arguments);if(c&&/webgl/.test(String(t))&&all.indexOf(c)<0)all.push(c);return c}}patch(w.HTMLCanvasElement);patch(w.OffscreenCanvas)})(window);`;

/**
 * The boot decision (DESIGN.md §7.4 POST), before first paint, so neither the overlay nor the
 * content ever flashes: html[data-boot] = "run" on the first visit to / in a session (no #hash),
 * else "fast" (POWER ON-fast over the painted page). The session flag is set at once — a reload
 * mid-boot never replays it. window.__boot.t0 is the boot's clock origin; Esc, a click or a tap
 * skips from frame one (html[data-boot-skip]), before any script has loaded, until the hard cap.
 */
export const BOOT_SCRIPT = `(function(w,d){var h=d.documentElement,m="fast",k="retrograde:booted";try{if(w.location.pathname==="/"&&!w.location.hash&&!w.sessionStorage.getItem(k))m="run";w.sessionStorage.setItem(k,"1")}catch(e){}h.setAttribute("data-boot",m);var b=w.__boot={mode:m,t0:w.performance.now(),skip:0};if(m!=="run")return;var o=function(){w.removeEventListener("keydown",s,true);w.removeEventListener("pointerdown",s,true)},s=function(e){if(e.type==="keydown"&&e.key!=="Escape")return;o();if(w.performance.now()-b.t0>${boot.capMs})return;b.skip=w.performance.now();h.setAttribute("data-boot-skip","")};b.off=o;w.addEventListener("keydown",s,true);w.addEventListener("pointerdown",s,true)})(window,document);`;

/**
 * The print edition's sheet (DESIGN.md §2.4, public/print.css), linked from here rather than rendered:
 * React preloads every stylesheet <link> it renders, and a preload of a print sheet is a warning
 * in Firefox on every load (its media never matches a screen). Appended by script, it's fetched as
 * a print link is — last, never render-blocking. The layout's <noscript> carries it without JS.
 */
export const PRINT_HREF = "/print.css";
const PRINT_SCRIPT = `(function(d){var l=d.createElement("link");l.rel="stylesheet";l.href=${JSON.stringify(PRINT_HREF)};l.media="print";d.head.appendChild(l)})(document);`;

/** Everything <head> runs before first paint: the one-RAF funnel first, then theme, motion and the boot, then the print sheet. */
export const headScript = RAF_FUNNEL_SCRIPT + GL_CENSUS_SCRIPT + themeScript + BOOT_SCRIPT + PRINT_SCRIPT;
