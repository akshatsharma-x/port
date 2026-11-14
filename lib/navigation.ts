import { projector } from "./projection";
import { refreshScroll, scrollStore, teleport } from "./scroll";
import { tear } from "./signatures";

/**
 * Navigation rules, site-wide (DESIGN.md §3.6, §3.8). Every jump is a TRACKING TEAR with the swap
 * under cover, and every history entry belongs to the Next.js router (its patched pushState /
 * replaceState), so Back always restores the page as well as the URL:
 *
 *   same-document #hash link   tear → teleport at the cut → pushState (Back undoes the jump)
 *   continuous scroll          replaceState of the hash (lib/scroll.ts) — no entries
 *   internal route link        tear → router.push(…, { scroll: false }) at the cut → held until the
 *                              route commits → lands on the hash or the top
 *   back / forward             tear entering at its cut (the browser already swapped) → saved scroll
 *
 * Opt-outs: `data-transition="continuity"` (something survives the jump — Part 9's PROJECTION:
 * the stage covers the swap, lib/projection.ts; Back from a case study flies the slide home),
 * `data-transition="none"`, modified clicks, `target`, `download`, other origins.
 * Native truth: positions are saved per URL; history.scrollRestoration is manual.
 */
type Router = { push: (href: string, options?: { scroll?: boolean }) => void };

let router: Router | null = null;
let committedPath = "";
const waiters: { path: string; resolve: () => void }[] = [];

export function bindRouter(next: Router | null): void {
  router = next;
}

const commitListeners = new Set<(path: string) => void>();

/** Hears every committed pathname (a PROJECTION lets its hold go when you leave its case study). */
export function onCommit(cb: (path: string) => void): () => void {
  commitListeners.add(cb);
  return () => commitListeners.delete(cb);
}

/** The NavigationBridge reports each committed pathname. */
export function notifyPath(pathname: string): void {
  committedPath = pathname;
  for (const cb of commitListeners) cb(pathname);
  for (let i = waiters.length - 1; i >= 0; i--) {
    const w = waiters[i];
    if (w && w.path === pathname) {
      waiters.splice(i, 1);
      w.resolve();
    }
  }
}

const waitForPath = (path: string): Promise<void> =>
  committedPath === path ? Promise.resolve() : new Promise((resolve) => waiters.push({ path, resolve }));

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0)).then(() => new Promise<void>((r) => window.setTimeout(r, 16)));

/** Resolves once the document can scroll to `y` (or after a second: then the restore clamps). */
async function tallEnough(y: number, maxMs = 1000): Promise<void> {
  const t0 = performance.now();
  while (document.documentElement.scrollHeight < y + window.innerHeight && performance.now() - t0 < maxMs) await nextFrame();
}

// ── scroll positions, per URL ───────────────────────────────────────────────────────────

const STORE_KEY = "retrograde:scroll";
const MAX_ENTRIES = 60;
const keyOf = (href: string) => {
  const u = new URL(href, location.href);
  return `${u.pathname}${u.search}${u.hash}`;
};

function readStore(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

export function saveScroll(href: string = location.href, y: number = window.scrollY): void {
  try {
    const map = readStore();
    delete map[keyOf(href)];
    map[keyOf(href)] = Math.round(y);
    const keys = Object.keys(map);
    for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ENTRIES))) delete map[k];
    sessionStorage.setItem(STORE_KEY, JSON.stringify(map));
  } catch {
    /* storage full or blocked: restoration degrades to the top */
  }
}

export const savedScroll = (href: string = location.href): number | null => readStore()[keyOf(href)] ?? null;

// ── link classification (pure; tests/navigation.test.ts) ────────────────────────────────

export type LinkKind = "hash" | "route" | null;

export interface LinkFacts {
  href: string;
  target: string | null;
  download: boolean;
  transition: string | null;
  button: number;
  modified: boolean;
  defaultPrevented: boolean;
}

export function classifyLink(link: LinkFacts, here: string): LinkKind {
  if (link.defaultPrevented || link.button !== 0 || link.modified || link.download) return null;
  if (link.target && link.target !== "_self") return null;
  // "dossier": a record opening over the page you're on, with its own entrance (§7.4) — no tear, no jump
  if (link.transition === "none" || link.transition === "dossier") return null;
  const to = new URL(link.href, here);
  const from = new URL(here);
  if (to.origin !== from.origin) return null;
  if (to.pathname === from.pathname && to.search === from.search) return "hash";
  if (link.transition === "continuity") return null;
  return "route";
}

// ── jumps ───────────────────────────────────────────────────────────────────────────────

/** A discontinuous in-page jump to `#id` (or the top for ""), with a router-owned entry. */
export async function jumpToHash(hash: string, { push = true }: { push?: boolean } = {}): Promise<void> {
  const id = hash.replace(/^#/, "");
  const target = id ? document.getElementById(id) : null;
  if (id && !target) return;
  saveScroll();
  await tear({
    seed: hash || "top",
    atCut: () => {
      teleport(target ?? 0);
      const url = `${location.pathname}${location.search}${id ? `#${id}` : ""}`;
      if (push && url !== `${location.pathname}${location.search}${location.hash}`) window.history.pushState(null, "", url);
    },
  });
  saveScroll(); // the landing, on record for a later Forward
}

/**
 * A route change under something else's cover (PROJECTION: the stage holds the viewport): push it,
 * and resolve once it has committed and the page has had a frame. No tear, no scroll.
 */
export async function routeTo(href: string): Promise<void> {
  const url = new URL(href, location.href);
  if (!router) {
    window.location.assign(url.href);
    return;
  }
  saveScroll();
  router.push(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
  await waitForPath(url.pathname);
  await nextFrame();
  refreshScroll();
}

/** A route change with no shared element: the swap happens under the tear's cover. */
export async function navigate(href: string): Promise<void> {
  const url = new URL(href, location.href);
  if (!router) {
    window.location.assign(url.href);
    return;
  }
  saveScroll();
  const push = router.push;
  await tear({
    seed: url.pathname,
    atCut: async () => {
      push(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
      await waitForPath(url.pathname);
      await nextFrame();
      refreshScroll();
      const target = url.hash ? document.getElementById(url.hash.slice(1)) : null;
      teleport(target ?? 0);
    },
  });
  saveScroll();
}

function onClick(e: MouseEvent): void {
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement)) return;
  const kind = classifyLink(
    {
      href: a.href,
      target: a.getAttribute("target"),
      download: a.hasAttribute("download"),
      transition: a.dataset.transition ?? null,
      button: e.button,
      modified: e.metaKey || e.ctrlKey || e.shiftKey || e.altKey,
      defaultPrevented: e.defaultPrevented,
    },
    location.href,
  );
  if (!kind) return;
  // capture phase on document: <Link> (and Lenis) never see it, so nothing navigates before the cut
  e.preventDefault();
  e.stopPropagation();
  if (kind === "hash") void jumpToHash(new URL(a.href).hash);
  else void navigate(a.href);
}

// Positions are saved continuously (debounced, never mid-jump), so the entry you leave by Back or
// Forward — whose URL is already gone when popstate fires — has its place on record.
const SAVE_DEBOUNCE_MS = 150;
let saveTimer = 0;
const onScroll = () => {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    if (!scrollStore.getState().jumping) saveScroll();
  }, SAVE_DEBOUNCE_MS);
};

/**
 * A record's dossier is open over the page (components/research/DossierDialog.tsx): the Back that
 * closes it isn't a route change — the page behind never moved — so it gets no tear and no restore.
 */
let overlay = false;
export function setOverlay(open: boolean): void {
  overlay = open;
}

function onPopState(): void {
  if (overlay) return;
  // Next.js has already dispatched its traversal (its listener runs first). Cover, then restore.
  window.clearTimeout(saveTimer); // a pending save would file the old position under the new URL
  const path = location.pathname;
  const id = location.hash.slice(1);
  const restore = savedScroll();
  const land = async () => {
    await waitForPath(path);
    await nextFrame();
    // the page may still be filling in (measured: home at 2,246 px of ~14,000 one frame after its
    // commit, in dev): a position past its end would clamp, so wait until it fits (≤ 1 s)
    if (restore !== null) await tallEnough(restore);
    refreshScroll();
    teleport(restore ?? (id && document.getElementById(id) ? `#${id}` : 0));
  };
  // Back from a case study the carousel projected: the slide flies home instead of a tear
  const leaving = committedPath;
  const slug = path === "/" && leaving.startsWith("/work/") ? leaving.slice("/work/".length) : null;
  const p = slug ? projector() : null;
  if (slug && p?.canReverse(slug)) {
    void p.reverse(slug, land).then(() => saveScroll());
    return;
  }
  void tear({
    seed: "back",
    enterAtCut: true,
    atCut: land,
  }).then(() => saveScroll());
}

/** A hash typed into the address bar makes an entry the router doesn't own: adopt it, then jump. */
function onHashChange(): void {
  if ((window.history.state as { __NA?: boolean } | null)?.__NA) return;
  window.history.replaceState(null, "", location.href);
  const target = document.getElementById(location.hash.slice(1));
  if (target) void tear({ seed: location.hash, atCut: () => teleport(target) });
}

const onPageHide = () => saveScroll();

/** Installs the rules; returns the cleanup. */
export function installNavigation(): () => void {
  window.history.scrollRestoration = "manual";
  committedPath = location.pathname;
  document.addEventListener("click", onClick, { capture: true });
  window.addEventListener("popstate", onPopState);
  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.clearTimeout(saveTimer);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("click", onClick, { capture: true });
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("hashchange", onHashChange);
    window.removeEventListener("pagehide", onPageHide);
  };
}
