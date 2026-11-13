/* Gecko needs author-origin ::part sizing for the native shadow slot.
 * Section scrolling keeps native input behavior through the shared support below.
 * No preferences, tabs, folders, or native methods are changed by this module.
 */
(() => {
  const key = "__evenBetterNewTabSlotSizing";
  window[key]?.destroy();
  const query = "(-moz-pref(\"zen.tabs.vertical\")) and (-moz-pref(\"btrnewtab.sticky\")) and (-moz-pref(\"zen.view.show-newtab-button-top\"))";
  const style = document.createElementNS('http://www.w3.org/1999/xhtml', 'style');
  style.id = "even-better-new-tab-slot-sizing";
  style.textContent = `@media ${query} {
    #tabbrowser-arrowscrollbox > zen-workspace[active="true"] >
    arrowscrollbox.workspace-arrowscrollbox::part(items-wrapper) { min-height: 0 !important; }
  }`;
  document.documentElement.appendChild(style);
  let release, startupFrame = 0, alive = true;
  const owner = { destroy() {
    alive = false;
    cancelAnimationFrame(startupFrame);
    release?.(); style.remove();
    window.removeEventListener('unload', owner.destroy);
    if (window[key] === owner) delete window[key];
  }};
  window[key] = owner;
  const media = window.matchMedia(query);
  release = acquireSectionScrolling(owner, media);
  if (typeof window.addUnloadListener === 'function') window.addUnloadListener(owner.destroy);
  else window.addEventListener('unload', owner.destroy, {once: true});

  // Gecko can retain the anchor's pre-restoration coordinates even after the
  // pinned section has grown. Reconstruct only this button's frame if its
  // rendered position is still wrong after native startup and layout settle.
  const ready = window.gZenStartup?.promiseInitialized
    ?? window.gZenWorkspaces?.promiseInitialized ?? Promise.resolve();
  ready.then(() => {
    if (!alive) return;
    startupFrame = requestAnimationFrame(() => {
      startupFrame = requestAnimationFrame(repairStartupAnchor);
    });
  }, () => {});

  function repairStartupAnchor() {
    startupFrame = 0;
    if (!alive || !media.matches) return;
    const button = document.getElementById('vertical-tabs-newtab-button');
    const normal = document.querySelector('#tabbrowser-arrowscrollbox > zen-workspace[active="true"] .zen-workspace-normal-tabs-section');
    if (!button || !normal || document.activeElement === button) return;
    const style = getComputedStyle(button);
    if (style.position !== 'absolute' || style.positionAnchor !== '--btrnewtab-active-normal') return;
    const b = button.getBoundingClientRect(), n = normal.getBoundingClientRect();
    const margin = parseFloat(style.marginBlockEnd);
    const expectedTop = n.top - b.height - margin;
    if (!b.height || !n.height || !Number.isFinite(expectedTop)
        || Math.abs(b.top - expectedTop) <= 1) return;
    const attribute = 'btrnewtab-rebuild-frame';
    if (button.hasAttribute(attribute)) return;
    try {
      button.setAttribute(attribute, '');
      button.getBoundingClientRect(); // Flush removal before restoring the frame.
    } finally {
      button.removeAttribute(attribute);
    }
  }
// Both mods share one set of listeners; unloading either keeps the other alive.
// The native selection reveal is gated on the outer scroller overflowing, which
// is false once these mods use section scrollers. No keyboard/drop handlers are
// replaced, and all actual selection, grouping and dropping remains native.
// Version 2 adds drag edge-scrolling for the ordinary tab list. Each mod ships a
// copy, so a newer copy takes over an older one whichever mod loads first.
function acquireSectionScrolling(owner, media) {
  const key = '__zenSectionScrollRepair', version = 2;
  let shared = window[key];
  if (shared && !(shared.version >= version)) {
    const previous = shared, moved = [...previous.owners];
    for (const [old] of moved) previous.release(old);
    shared = create();
    for (const [old, query] of moved) shared.owners.set(old, query);
    // The older mod still holds the old object; route its unload here.
    previous.release = old => shared.release(old);
  } else if (!shared) shared = create();
  shared.owners.set(owner, media);
  return () => shared.release(owner);

  function create() {
    const PINNED = 'zen-workspace[active="true"] .zen-workspace-pinned-tabs-section';
    const NORMAL = '#tabbrowser-arrowscrollbox > zen-workspace[active="true"] .zen-workspace-normal-tabs-section';
    // Edge strip in px; speed in px per ms, rising with depth into the strip.
    const EDGE = 48, SLOW = .25, FAST = 1.6;
    const rate = depth => SLOW + (FAST - SLOW) * Math.min(1, depth) ** 2;
    const owners = new Map();
    let revealFrame = 0, dragFrame = 0, dragPane = null, dragSpeed = 0, lastTime = 0;
    const active = () => [...owners.values()].some(query => query.matches);
    const reveal = event => {
      if (!active()) return;
      const target = event.type === 'focusin'
        ? event.target.closest?.('tab, .tab-group-label-container')
        : gBrowser.selectedTab;
      if (!target?.closest('zen-workspace[active="true"] .zen-workspace-tabs-section')) return;
      cancelAnimationFrame(revealFrame);
      revealFrame = requestAnimationFrame(() => {
        revealFrame = 0;
        if (active() && target.isConnected && target.getBoundingClientRect().height) {
          target.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'instant'});
        }
      });
    };
    const stopDrag = () => {
      cancelAnimationFrame(dragFrame);
      dragFrame = 0; dragPane = null; dragSpeed = 0; lastTime = 0;
    };
    const atLimit = (pane, speed) => speed < 0 ? pane.scrollTop <= 0
      : pane.scrollTop + pane.clientHeight >= pane.scrollHeight - 1;
    const tick = now => {
      dragFrame = 0;
      if (!active() || !dragPane?.isConnected || atLimit(dragPane, dragSpeed)) { stopDrag(); return; }
      const elapsed = lastTime ? Math.min(now - lastTime, 50) : 16;
      lastTime = now;
      dragPane.scrollTop += dragSpeed * elapsed;
      dragFrame = requestAnimationFrame(tick);
    };
    const overflows = pane => pane.scrollHeight > pane.clientHeight;
    // Returns [pane, speed] for a drag at an overflowing section's top or bottom
    // strip, or just above the ordinary list (the New Tab row or the separator,
    // where the pointer lands when moving tabs up), otherwise null.
    const edgeScroll = event => {
      const x = event.clientX, y = event.clientY, target = event.target;
      const pane = target?.closest?.(PINNED) || target?.closest?.(NORMAL);
      if (pane) {
        if (!overflows(pane)) return null;
        const r = pane.getBoundingClientRect(), edge = Math.min(EDGE, r.height / 3);
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
        if (y < r.top + edge) return [pane, -rate((r.top + edge - y) / edge)];
        if (y > r.bottom - edge) return [pane, rate((y - r.bottom + edge) / edge)];
        return null;
      }
      const normal = document.querySelector?.(NORMAL);
      if (!normal || !overflows(normal) || normal.scrollTop <= 0) return null;
      const r = normal.getBoundingClientRect();
      return x >= r.left && x <= r.right && y < r.top && y >= r.top - EDGE
        ? [normal, -FAST] : null;
    };
    const dragOver = event => {
      const scroll = active() && event.dataTransfer?.types.length ? edgeScroll(event) : null;
      if (!scroll) { stopDrag(); return; }
      [dragPane, dragSpeed] = scroll;
      if (!dragFrame) dragFrame = requestAnimationFrame(tick);
    };
    // dragover recomputes the zone; only leaving the window needs a stop here.
    const dragLeave = event => { if (dragPane && !event.relatedTarget) stopDrag(); };
    const events = [['TabSelect', reveal], ['focusin', reveal], ['resize', reveal],
      ['dragover', dragOver], ['dragleave', dragLeave], ['drop', stopDrag],
      ['dragend', stopDrag], ['blur', stopDrag]];
    for (const [name, fn] of events) window.addEventListener(name, fn, true);
    const created = { version, owners, release(owner) {
      owners.delete(owner);
      if (owners.size) return;
      cancelAnimationFrame(revealFrame); stopDrag();
      for (const [name, fn] of events) window.removeEventListener(name, fn, true);
      if (window[key] === created) delete window[key];
    }};
    window[key] = created;
    return created;
  }
}

})();
