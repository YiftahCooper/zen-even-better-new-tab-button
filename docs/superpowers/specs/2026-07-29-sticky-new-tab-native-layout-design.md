# Sticky New Tab Native-Layout Design

## Status

Approved design for the final CSS-only implementation cycle. This specification
replaces the rejected CSS-anchor experiment.

## Objective

Keep Zen's live workspace New Tab button visible while ordinary tabs scroll at
both native top and native bottom placement. Preserve upstream button behavior,
including the optional press animation, without hardcoded sidebar geometry,
fixed or absolute positioning, JavaScript relocation, or modification of Zen's
pinned-tab separator.

## Verified layout facts

Zen creates a live `#tabbrowser-arrowscrollbox-periphery` in each workspace. The
New Tab button is inside that wrapper. Applying `position: sticky` to the wrapper
keeps the native button, sizing, command, tooltip, focus behavior, and animation
together.

In unmodified Zen, `.pinned-tabs-container-separator` can occupy 22 CSS pixels
before a top-placed New Tab wrapper. The separator is both the visual pinned-tab
divider and a native close-unpinned-tabs control. As the separator scrolls away,
a zero-inset sticky wrapper moves upward once by the separator's live height and
then remains clamped to the top of the scrollport.

The user's normal mod stack includes the independently installed Remove Tabs
Separator mod, which removes the separator with `display: none` even when pinned
tabs exist. In that environment the separator contributes no layout height. With
no pinned tabs, the top wrapper must remain stationary to within one CSS pixel;
native pinned tabs may still contribute their own preceding layout height.

CSS `anchor-size()` cannot solve the clean-profile transition: the installed
engine parses the function but resolves its fallback on a sticky-positioned box.
Fixed or absolute positioning would violate the native-layout constraints and is
not an acceptable fallback.

## Chosen architecture

The extension targets only `#tabbrowser-arrowscrollbox-periphery`:

- sticky enabled and native bottom placement: `top: auto; bottom: 0`;
- sticky enabled and native top placement: `top: 0; bottom: auto`;
- `z-index: 1` so scrolling tabs cannot paint over the wrapper;
- `background: var(--zen-sidebar-background, Canvas)` so a theme-provided
  sidebar surface wins when available and the browser's light/dark system canvas
  is used otherwise, without introducing a literal theme color.

The extension does not select or alter the separator. Consequently it works with
Zen's native separator and with unrelated mods that remove the separator from
layout. It does not position `#tabs-newtab-button` or
`.workspace-arrowscrollbox`.

## Acceptance rules

### Clean Zen profile

With top placement and sticky enabled, the button must remain fully visible. Its
only permitted movement is one monotonic transition no larger than the measured
native layout preceding the wrapper plus one CSS pixel. With no pinned tabs this
is the separator height; with pinned tabs it also includes their native section.
After the preceding layout leaves the scrollport, active-edge drift is at most
one pixel. Bottom placement drift is at most one pixel throughout.

The separator must retain its native display state, command, and pinned-tab
relationship. The extension must not claim perfectly stationary top placement in
this environment.

### User separator-free profile

Confirm the separator's computed display is `none` with both zero and at least
one pinned tab. With no pinned tabs, top or bottom active-edge drift across start,
middle, and end is at most one CSS pixel. With pinned tabs, only their measured
native preceding layout may scroll away before the wrapper becomes stationary.

This is a compatibility observation, not a dependency: the mod must not require,
install, name, or configure the unrelated separator-removal mod.

### Shared behavior

For both environments:

- sticky disabled reproduces upstream scrolling behavior;
- the first and last ordinary tabs remain reachable;
- tabs do not paint through or over the wrapper;
- no visible background seam appears in the tested appearances;
- pinned tabs, dragging, autoscroll, and workspace switching remain functional;
- New Tab activation, hover, active state, keyboard focus, tooltip, and preference
  persistence remain functional;
- with `btrnewtab.plusanim=true`, trusted press input rotates the plus icon to 90
  degrees and applies the native pressed scale; with it disabled, the plus icon
  does not rotate while activation still works.

## Evidence and release boundary

Record raw geometry, computed styles, screenshots, input receipts, Zen/Sine
versions, and pass/fail decisions in `VERIFICATION.md` and `verification/`. README
claims may be promoted only after every mandatory case passes. Publishing,
pushing, and opening a pull request require separate authorization.
