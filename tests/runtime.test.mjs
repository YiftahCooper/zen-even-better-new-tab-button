// Executes the shipped module with a bounded browser API fixture. These tests
// verify lifecycle/input logic, not Gecko layout or Sine's implementation.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../newtab-layout.uc.mjs', import.meta.url), 'utf8');
const ownerKey = '__evenBetterNewTabSlotSizing';
const sharedKey = '__zenSectionScrollRepair';
const query = '(-moz-pref("zen.tabs.vertical")) and (-moz-pref("btrnewtab.sticky")) and (-moz-pref("zen.view.show-newtab-button-top"))';

function fixture({ sine = true } = {}) {
  const styles = new Set(), listeners = new Map(), frames = new Map(), unloads = [];
  const prefs = new Map(['zen.tabs.vertical', 'btrnewtab.sticky',
    'zen.view.show-newtab-button-top'].map(p => [p, true]));
  let frameId = 0;
  const window = {
    matchMedia(q) {
      assert.equal(q, query);
      return { get matches() { return [...prefs.values()].every(Boolean); } };
    },
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
  };
  if (sine) window.addUnloadListener = fn => unloads.push(fn);
  const document = {
    createElementNS(ns, tag) {
      assert.equal(ns, 'http://www.w3.org/1999/xhtml');
      assert.equal(tag, 'style');
      const element = { remove() { styles.delete(element); } };
      return element;
    },
    documentElement: { appendChild(element) { styles.add(element); } },
  };
  const gBrowser = { selectedTab: null };
  const context = vm.createContext({ window, document, gBrowser,
    requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  return {
    window, styles, listeners, frames, prefs, gBrowser, unloads,
    load() { vm.runInContext(source, context); },
    fire(type, extra = {}) {
      for (const fn of [...(listeners.get(type) ?? [])]) fn({ type, ...extra });
    },
    step(time = 16) {
      const pending = [...frames.values()]; frames.clear();
      for (const fn of pending) fn(time);
    },
    listenerCount() { return [...listeners.values()].reduce((n, set) => n + set.size, 0); },
  };
}

function tab({ active = true, height = 40 } = {}) {
  return {
    isConnected: true, calls: [],
    closest(selector) {
      assert.equal(selector, 'zen-workspace[active="true"] .zen-workspace-tabs-section');
      return active ? {} : null;
    },
    getBoundingClientRect() { return { height }; },
    scrollIntoView(options) { this.calls.push(JSON.parse(JSON.stringify(options))); },
  };
}

function dragTarget() {
  const pane = {
    isConnected: true, scrollHeight: 900, clientHeight: 300, scrollTop: 100,
    getBoundingClientRect() { return { left: 0, right: 200, top: 100, bottom: 400, height: 300 }; },
    contains(node) { return node === pane; },
  };
  const target = { closest(selector) {
    assert.equal(selector, 'zen-workspace[active="true"] .zen-workspace-pinned-tabs-section');
    return pane;
  } };
  return { pane, event: { target, clientX: 50, clientY: 395, dataTransfer: { types: ['application/x-moz-tabbrowser-tab'] } } };
}

test('load and repeated load leave one author style and one set of listeners', () => {
  const f = fixture(); f.load(); f.load();
  assert.equal(f.styles.size, 1);
  const style = [...f.styles][0];
  assert.equal(style.id, 'even-better-new-tab-slot-sizing');
  assert.ok(style.textContent.includes(`@media ${query}`));
  assert.match(style.textContent, /::part\(items-wrapper\) \{ min-height: 0 !important;/);
  assert.equal(f.window[sharedKey].owners.size, 1);
  assert.equal(f.listenerCount(), 8);
  // Sine can still hold a callback from an earlier generation.
  f.unloads[0]();
  assert.equal(f.styles.size, 1);
  f.unloads.at(-1)();
  assert.equal(f.styles.size, 0);
  assert.equal(f.listenerCount(), 0);
  assert.equal(f.window[sharedKey], undefined);
  assert.equal(f.window[ownerKey], undefined);
});

test('native window unload cleans up when no Sine unload API is present', () => {
  const f = fixture({ sine: false }); f.load(); f.fire('unload');
  assert.equal(f.styles.size, 0);
  assert.equal(f.listenerCount(), 0);
  assert.equal(f.window[sharedKey], undefined);
});

test('selection and focused folder reveal use nearest scrolling, not tab mutations', () => {
  const f = fixture(); f.load();
  const selected = tab(), focused = tab(); f.gBrowser.selectedTab = selected;
  f.fire('TabSelect'); f.step();
  assert.deepEqual(selected.calls, [{ block: 'nearest', inline: 'nearest', behavior: 'instant' }]);
  f.fire('focusin', { target: { closest(selector) {
    assert.equal(selector, 'tab, .tab-group-label-container'); return focused;
  } } }); f.step();
  assert.equal(focused.calls.length, 1);
  f.fire('resize'); f.step();
  assert.equal(selected.calls.length, 2);
});

test('each controlling preference disables reveal and resumes without reload', () => {
  const f = fixture(); f.load(); const selected = tab(); f.gBrowser.selectedTab = selected;
  for (const pref of f.prefs.keys()) {
    f.prefs.set(pref, false); f.fire('TabSelect'); f.step();
    assert.equal(selected.calls.length, 0);
    f.prefs.set(pref, true);
  }
  f.fire('TabSelect'); f.prefs.set('btrnewtab.sticky', false); f.step();
  assert.equal(selected.calls.length, 0);
  f.prefs.set('btrnewtab.sticky', true); f.fire('TabSelect'); f.step();
  assert.equal(selected.calls.length, 1);
});

test('inactive, hidden, disconnected and superseded selections do not get revealed', () => {
  const f = fixture(); f.load();
  for (const selected of [tab({ active: false }), tab({ height: 0 }), Object.assign(tab(), { isConnected: false })]) {
    f.gBrowser.selectedTab = selected; f.fire('TabSelect'); f.step();
    assert.equal(selected.calls.length, 0);
  }
  const first = tab(), last = tab();
  f.gBrowser.selectedTab = first; f.fire('TabSelect');
  f.gBrowser.selectedTab = last; f.fire('TabSelect'); f.step();
  assert.equal(first.calls.length, 0); assert.equal(last.calls.length, 1);
});

test('pinned edge drag scrolls in both directions and stops away from edges', () => {
  const f = fixture(); f.load(); const { pane, event } = dragTarget();
  f.fire('dragover', event); f.step(); assert.ok(pane.scrollTop > 100);
  const lower = pane.scrollTop;
  f.fire('dragover', { ...event, clientY: 105 }); f.step(32);
  assert.ok(pane.scrollTop < lower);
  f.fire('dragover', { ...event, clientY: 250 });
  assert.equal(f.frames.size, 0);
});

test('invalid drags and disabled preferences cannot keep an autoscroll loop alive', () => {
  const f = fixture(); f.load(); const { pane, event } = dragTarget();
  for (const extra of [{ clientX: 250 }, { clientY: 99 }, { dataTransfer: { types: [] } }, { target: { closest: () => null } }]) {
    f.fire('dragover', event); f.fire('dragover', { ...event, ...extra });
    assert.equal(f.frames.size, 0);
  }
  pane.scrollHeight = 300; f.fire('dragover', event); assert.equal(f.frames.size, 0);
  pane.scrollHeight = 900; f.fire('dragover', event);
  f.prefs.set('btrnewtab.sticky', false); f.step();
  assert.equal(pane.scrollTop, 100); assert.equal(f.frames.size, 0);
});

test('drop, dragend, blur, leaving the pane and unload cancel outstanding frames', () => {
  for (const type of ['drop', 'dragend', 'blur', 'dragleave', 'unload']) {
    const f = fixture(); f.load(); const { pane, event } = dragTarget();
    f.fire('dragover', event);
    if (type === 'unload') f.unloads[0](); else f.fire(type, { relatedTarget: null });
    f.step(); assert.equal(pane.scrollTop, 100); assert.equal(f.frames.size, 0);
  }
  const f = fixture(); f.load(); f.gBrowser.selectedTab = tab();
  f.fire('TabSelect'); f.unloads[0](); f.step();
  assert.equal(f.gBrowser.selectedTab.calls.length, 0);
});

test('shared owner protocol keeps a peer alive in either unload order', () => {
  for (const newtabFirst of [true, false]) {
    const f = fixture(); f.load(); const shared = f.window[sharedKey];
    const peer = {}; shared.owners.set(peer, { matches: true });
    const selected = tab(); f.gBrowser.selectedTab = selected;
    if (newtabFirst) {
      f.unloads[0](); assert.equal(f.styles.size, 0);
      f.fire('TabSelect'); f.step(); assert.equal(selected.calls.length, 1);
      shared.release(peer);
    } else {
      shared.release(peer); f.fire('TabSelect'); f.step();
      assert.equal(selected.calls.length, 1); f.unloads[0]();
    }
    assert.equal(f.listenerCount(), 0); assert.equal(f.window[sharedKey], undefined);
  }
});
