// Run in the chrome context of a disposable Zen profile with the candidate
// installed through Sine, restored folders and overflowing ordinary tabs.
// The injected offset exercises recovery deterministically; it is separate
// from the natural startup failure observed in the normal browser.
return (async () => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const paint = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  await (window.gZenStartup?.promiseInitialized ?? window.gZenWorkspaces.promiseInitialized);
  await paint();
  const button = document.getElementById('vertical-tabs-newtab-button');
  const normal = document.querySelector('#tabbrowser-arrowscrollbox > zen-workspace[active="true"] .zen-workspace-normal-tabs-section');
  const error = () => button.getBoundingClientRect().top - (normal.getBoundingClientRect().top
    - button.getBoundingClientRect().height - parseFloat(getComputedStyle(button).marginBlockEnd));
  assert(Math.abs(error()) <= 1, 'Restored candidate is misaligned');
  const prefs = ['btrnewtab.sticky', 'btrnewtab.plusanim', 'zen.view.show-newtab-button-top'];
  const beforePrefs = prefs.map(p => Services.prefs.getBoolPref(p));
  const beforeTabs = [...gBrowser.tabs];
  const beforeFolders = [...document.querySelectorAll('zen-folder')].map(f => [f, f.collapsed]);
  const originalNormal = Object.getOwnPropertyDescriptor(normal, 'getBoundingClientRect');
  const originalButton = Object.getOwnPropertyDescriptor(button, 'getBoundingClientRect');
  const normalRect = normal.getBoundingClientRect.bind(normal), buttonRect = button.getBoundingClientRect.bind(button);
  const observed = [];
  let hiddenRead = false;
  try {
    normal.getBoundingClientRect = () => {
      const r = normalRect();
      return new DOMRect(r.x, r.y + 120, r.width, r.height);
    };
    button.getBoundingClientRect = () => {
      const r = buttonRect();
      if (button.hasAttribute('btrnewtab-rebuild-frame')) {
        observed.push(r.height);
        hiddenRead = true;
      }
      return r;
    };
    const previousOwner = window.__evenBetterNewTabSlotSizing;
    await ChromeUtils.importESModule('chrome://userscripts/content/core/manager.sys.mjs').default.rebuildMods();
    const deadline = performance.now() + 5000;
    while ((!hiddenRead || window.__evenBetterNewTabSlotSizing === previousOwner) && performance.now() < deadline) {
      await paint();
    }
    assert(hiddenRead && observed.every(height => height === 0), 'Candidate did not reconstruct the real button frame');
    assert(!button.hasAttribute('btrnewtab-rebuild-frame'), 'Temporary attribute leaked');
  } finally {
    for (const [element, descriptor] of [[normal, originalNormal], [button, originalButton]]) {
      if (descriptor) Object.defineProperty(element, 'getBoundingClientRect', descriptor);
      else delete element.getBoundingClientRect;
    }
  }
  await paint();
  assert(Math.abs(error()) <= 1, 'Button moved out of its native slot');
  assert(beforeTabs.length === gBrowser.tabs.length && beforeTabs.every(t => gBrowser.tabs.includes(t)), 'Tab identity changed');
  assert(beforeFolders.every(([folder, collapsed]) => folder.isConnected && folder.collapsed === collapsed), 'Folder state changed');
  assert(prefs.every((pref, index) => Services.prefs.getBoolPref(pref) === beforePrefs[index]), 'Preference changed');
  assert(document.querySelectorAll('#even-better-new-tab-slot-sizing').length === 1, 'Duplicate runtime style');
  return { pass: true, zen: Services.appinfo.version, gecko: Services.appinfo.platformVersion,
    hiddenMeasurements: observed, finalPlacementError: error(), tabCount: beforeTabs.length,
    folderCount: beforeFolders.length, owners: window.__zenSectionScrollRepair?.owners.size };
})();
