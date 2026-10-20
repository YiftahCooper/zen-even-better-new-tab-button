// Setup for startup-anchor.js, in a new disposable Sine profile only.
// Run once, then quit normally and relaunch the same profile to test restore.
// Requires zen.tabs.vertical, zen.view.show-newtab-button-top and
// btrnewtab.sticky enabled; browser.startup.page=3 preserves ordinary tabs.
if (document.querySelector('zen-folder')) throw new Error('Use a fresh fixture profile');
const add = () => gBrowser.addTab('about:blank', {
  skipAnimation: true, createLazyBrowser: true,
  triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal(),
});
const expanded = gZenFolders.createFolder(Array.from({ length: 5 }, add), { label: 'Fixture A', renameFolder: false });
const collapsed = gZenFolders.createFolder(Array.from({ length: 2 }, add), { label: 'Fixture B', renameFolder: false });
expanded.collapsed = false;
collapsed.collapsed = true;
for (let i = 0; i < 24; i++) add();
