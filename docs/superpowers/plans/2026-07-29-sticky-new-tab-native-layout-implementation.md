# Sticky New Tab Native-Layout Implementation Plan

**Goal:** Verify and finish the separator-agnostic sticky wrapper implementation
in clean Zen and in the user's separator-free mod stack.

## Constraints

- Preserve every upstream CSS byte before the extension delimiter.
- Preserve all seven upstream preferences and the enabled-by-default animation.
- Target only `#tabbrowser-arrowscrollbox-periphery` for sticky positioning.
- Do not modify the pinned-tab separator, the inner New Tab button's positioning,
  or the workspace scrollbox.
- Do not use fixed/absolute positioning, JavaScript relocation, CSS anchors, or
  hardcoded sidebar geometry.
- Use Zen's sidebar surface token with a system `Canvas` fallback; reject the
  toolbar token if it creates a visible block against the sidebar.
- Leave the user-owned `Errors/` directory untouched.
- Stop at the publication boundary.

## Task 1: Bind the static separator-independence contract

1. Add a test that rejects any separator selector or separator display/layout
   declaration in the extension.
2. Mutation-test the new check by temporarily adding a separator rule, observe
   the expected failure, restore the candidate, and observe the pass.
3. Run the entire standard-library test suite.

## Task 2: Verify clean Zen geometry

1. Install the exact local candidate through Sine in a disposable profile.
2. Force overflow with at least 50 ordinary tabs.
3. Test sticky on/off, top/bottom placement, and expanded/collapsed sidebar.
4. Repeat the top case with a pinned tab.
5. For clean top placement, permit only one transition no larger than the live
   native layout preceding the wrapper plus one pixel; require post-transition
   drift of at most one pixel. Require bottom drift of at most one pixel.
6. Record reachability, hit testing, background styles, and screenshots.

## Task 3: Verify the user's separator-free behavior

1. Use an isolated copy of the user's Sine mod stack; never edit the normal
   profile.
2. Confirm the separator computes to `display: none` with and without a pinned
   tab.
3. Repeat top/bottom, expanded/collapsed sticky geometry. With no pinned tabs,
   require at most one pixel of drift throughout; with a pinned tab, permit only
   that measured native pinned section to scroll away.
4. Record which installed rule wins the cascade, without making it a dependency
   or compatibility promise for every third-party mod.

## Task 4: Verify interactions and animation

1. Reuse privileged event synthesis on the real active-workspace button to verify
   enabled/disabled press transforms and trusted input.
2. In a headed disposable profile, physically verify that one New Tab activation
   opens exactly one tab.
3. Verify hover, active state, keyboard focus, tooltip, tab dragging, autoscroll,
   workspace switching, and sticky/animation preference persistence.

## Task 5: Verify appearances and documentation

1. Check light, dark, private-window, workspace-gradient, and one custom-theme
   appearance for bleed and seams.
2. Update `VERIFICATION.md` with raw receipts, measurements, limitations, and the
   final readiness decision.
3. Promote README release claims only if all mandatory cases pass.
4. Run `python -m unittest discover -s tests -v`, `git diff --check`, and inspect
   `git status --short --branch`.
5. Do not push, publish, or open a pull request without separate authorization.
