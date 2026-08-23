# Sticky New Tab Theme Surface Design

## Status

Rejected by headed Zen 1.21.9b testing. Retained as diagnostic history only;
this design must not be implemented or published.

## Problem

Sticky positioning works, but the wrapper currently paints
`var(--zen-sidebar-background, Canvas)`. Zen 1.21.9b does not define that
sidebar token, so Windows resolves the fallback to an opaque system canvas.
That blocks scrolling tabs but also replaces Zen's Mica, workspace gradient,
background transition, and grain layers with a flat rectangle.

A transparent wrapper is not acceptable by itself. Existing live evidence
shows an ordinary tab remains visible behind the sticky button when the wrapper
does not occlude the scrolling content.

## Verified Zen architecture

The installed Zen 1.21.9b browser chrome contains two dedicated rendered
background elements. In the user's single-toolbar configuration,
`#zen-toolbar-background` computes to `display: none` with a zero-sized box and
cannot be sampled. The headed probe confirmed that `#zen-browser-background`
is the active full-window `.zen-browser-generic-background`; its `::before` and
`::after` layers render the old and current backgrounds during transitions, and
its `.zen-browser-grain` child renders the optional grain texture.

The sticky New Tab wrapper is a foreground descendant of the tab scrollbox. It
cannot inherit the already-composited toolbar surface because CSS backgrounds
are not inherited and Zen's actual background is rendered by a separate
element, not a single color token.

Firefox exposes `-moz-element(#id)` for using a live DOM element as a CSS image.
That makes it possible to sample Zen's rendered toolbar background rather than
reconstructing its theme pipeline or guessing a color.

## Chosen architecture

Keep sticky positioning on `#tabbrowser-arrowscrollbox-periphery` unchanged.
Replace its opaque color with an isolated pseudo-element that:

- covers the wrapper without changing layout or hit testing;
- uses `-moz-element(#zen-browser-background)` as its background image;
- uses fixed background attachment and logical left/right alignment so the
  sampled browser surface remains registered with the window while the wrapper
  sticks at either edge;
- uses Zen's existing `--zen-urlbar-filter` acrylic filter to obscure scrolling
  tab pixels beneath transparent or Mica toolbar surfaces;
- remains behind the native `#tabs-newtab-button`, preserving its hover,
  active, focus, tooltip, command, sizing, and press animation.

The implementation must not copy Zen's gradient declarations, grain asset, or
theme colors. It must not add fixed or absolute positioning to the wrapper or
button. Absolute positioning is permitted only for the wrapper's non-layout
pseudo-element.

## Fallback and stop rules

The candidate is acceptable only if Zen 1.21.9b parses `-moz-element()` and the
captured surface aligns in a disposable profile. If it does not align, leaves
tab content legible, creates a seam, or causes visible scrolling degradation,
stop and retain diagnostics. Do not fall back to `Canvas`, a literal color,
JavaScript relocation, or a hand-copied version of Zen's background pipeline.

## Acceptance

- The opaque rectangle in the supplied screenshots is absent.
- The sticky area follows workspace gradient, grain, light/dark mode, private
  windows, and one custom theme without a visible boundary.
- Ordinary tab icons and text are not legible beneath the sticky wrapper.
- Top/bottom and expanded/collapsed geometry retain the previous drift and
  reachability results.
- Right-side sidebar placement aligns the sampled background correctly.
- New Tab activation and the enabled/disabled plus-button press animation retain
  their existing computed transforms.
- Static tests reject `Canvas`, literal theme colors, and direct reconstruction
  of Zen's grain or gradient layers in the extension.
- No normal-profile file is modified during automated testing.

## Publication boundary

Implementation and local verification do not authorize a commit, push, release,
or normal-profile installation. Those require separate user authorization.

## Rejection evidence

The Firefox function parsed and the full-window source had non-zero dimensions,
but the resulting wrapper remained a visibly dark rectangular band. Zen's
source element contains a translucent black overlay; Windows Mica is composed
behind the browser and is not part of the element image. Applying Zen's acrylic
filter further darkened the sampled area. See
`verification/theme-surface/theme-surface-receipt.json`, `top-start.png`, and
`top-middle.png`.
