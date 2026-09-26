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
  let release;
  const owner = { destroy() {
    release?.(); style.remove();
    window.removeEventListener('unload', owner.destroy);
    if (window[key] === owner) delete window[key];
  }};
  window[key] = owner;
  release = acquireSectionScrolling(owner, window.matchMedia(query));
  if (typeof window.addUnloadListener === 'function') window.addUnloadListener(owner.destroy);
  else window.addEventListener('unload', owner.destroy, {once: true});
// Both mods share one set of listeners; unloading either keeps the other alive.
// The native selection reveal is gated on the outer scroller overflowing, which
// is false once these mods use section scrollers. No keyboard/drop handlers are
// replaced, and all actual selection, grouping and dropping remains native.
function acquireSectionScrolling(owner, media) {
  const key = '__zenSectionScrollRepair';
  let shared = window[key];
  if (!shared) {
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
    const tick = now => {
      dragFrame = 0;
      if (!active() || !dragPane?.isConnected) { stopDrag(); return; }
      const elapsed = lastTime ? Math.min(now - lastTime, 50) : 16;
      lastTime = now;
      dragPane.scrollTop += dragSpeed * elapsed;
      dragFrame = requestAnimationFrame(tick);
    };
    const dragOver = event => {
      const pane = event.target.closest?.('zen-workspace[active="true"] .zen-workspace-pinned-tabs-section');
      if (!active() || !pane || !event.dataTransfer?.types.length || pane.scrollHeight <= pane.clientHeight) {
        stopDrag(); return;
      }
      const r = pane.getBoundingClientRect(), edge = Math.min(40, r.height / 3);
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) {
        stopDrag(); return;
      }
      dragSpeed = event.clientY < r.top + edge ? -.45 : event.clientY > r.bottom - edge ? .45 : 0;
      if (!dragSpeed) { stopDrag(); return; }
      dragPane = pane;
      if (!dragFrame) dragFrame = requestAnimationFrame(tick);
    };
    const dragLeave = event => {
      if (dragPane && !dragPane.contains(event.relatedTarget)) stopDrag();
    };
    const events = [['TabSelect', reveal], ['focusin', reveal], ['resize', reveal],
      ['dragover', dragOver], ['dragleave', dragLeave], ['drop', stopDrag],
      ['dragend', stopDrag], ['blur', stopDrag]];
    for (const [name, fn] of events) window.addEventListener(name, fn, true);
    shared = { owners, release(owner) {
      owners.delete(owner);
      if (owners.size) return;
      cancelAnimationFrame(revealFrame); stopDrag();
      for (const [name, fn] of events) window.removeEventListener(name, fn, true);
      if (window[key] === shared) delete window[key];
    }};
    window[key] = shared;
  }
  shared.owners.set(owner, media);
  return () => shared.release(owner);
}

})();
