/**
 * One RAF for the whole site (DESIGN.md §4.1). This script runs first in <head>, before Next,
 * React, GSAP or Motion load. From then on every requestAnimationFrame caller — gsap.ticker (which
 * drives Lenis, the scroll tick, the governor and R3F), Motion's frameloop, React, Next — queues
 * into ONE native requestAnimationFrame callback per frame.
 *
 * Platform semantics are kept: callbacks requested during a frame run in the next one, in request
 * order, with that frame's timestamp; cancelAnimationFrame works before and during the batch (a
 * cancelled callback that hasn't run yet is skipped); a throwing callback doesn't stop the rest
 * (its error is still reported). Handles start at 2³⁰, so they can't collide with native handles
 * taken before the funnel existed — those are cancelled natively.
 *
 * window.__rafFunnel counts frames, native requests and funnelled callbacks for the dev overlay.
 */
export const RAF_FUNNEL_SCRIPT = `(function(w){if(!w.requestAnimationFrame||w.__rafFunnel)return;var raf=w.requestAnimationFrame.bind(w),caf=w.cancelAnimationFrame.bind(w),q=new Map(),spare=new Map(),cur=null,id=1073741824,pending=false,s={frames:0,native:0,callbacks:0,last:0};function run(cb,t){try{cb(t)}catch(e){if(w.reportError)w.reportError(e);else setTimeout(function(){throw e})}}function flush(t){pending=false;s.frames++;var b=q;q=spare;cur=b;s.last=b.size;s.callbacks+=b.size;b.forEach(function(cb){run(cb,t)});b.clear();spare=b;cur=null}w.requestAnimationFrame=function(cb){var h=++id;q.set(h,cb);if(!pending){pending=true;s.native++;raf(flush)}return h};w.cancelAnimationFrame=function(h){if(q.delete(h))return;if(cur&&cur.delete(h))return;caf(h)};w.__rafFunnel=s})(window);`;

export interface RafFunnelStats {
  /** frames flushed */
  frames: number;
  /** native requestAnimationFrame calls — equals `frames` when there is one RAF */
  native: number;
  /** callbacks funnelled through, in total */
  callbacks: number;
  /** callbacks in the most recent frame */
  last: number;
}

export const readRafFunnel = (): RafFunnelStats | null =>
  typeof window === "undefined" ? null : ((window as Window & { __rafFunnel?: RafFunnelStats }).__rafFunnel ?? null);
