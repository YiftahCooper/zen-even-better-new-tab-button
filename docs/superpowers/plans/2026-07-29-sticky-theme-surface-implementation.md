# Sticky Theme Surface Implementation Plan

> **Status:** Rejected by headed Zen 1.21.9b testing. Do not execute. The live
> element image excludes the Windows Mica backdrop and leaves a dark band.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sticky wrapper's opaque fallback with Zen's live themed toolbar surface while continuing to occlude scrolling tabs and preserve the native New Tab interaction and animation.

**Architecture:** Keep the existing wrapper-only sticky layout. Paint a non-interactive pseudo-element from Firefox's active live `#zen-browser-background` image, align it to the window, and apply Zen's acrylic filter underneath so transparent/Mica themes do not reveal scrolling tabs. The headed capability probe rejected the zero-sized, hidden `#zen-toolbar-background` in single-toolbar mode.

**Tech Stack:** CSS/XUL userChrome, Firefox `-moz-element()`, Python standard-library `unittest`, Zen Browser 1.21.9b disposable profiles.

## Global Constraints

- Preserve every upstream CSS byte before the extension delimiter.
- Do not modify the normal Zen profile or the user-owned `Errors/` directory.
- Do not position `#tabs-newtab-button` or `.workspace-arrowscrollbox`.
- Do not use fixed or absolute positioning on the wrapper or button.
- Do not copy Zen's gradient declarations, grain asset, or literal theme colors.
- Preserve the enabled-by-default press animation and all eight preferences.
- Stop with diagnostics if live background capture does not align or occlude tabs.
- Commit, push, release, and installation require separate user authorization.

---

### Task 1: Bind the theme-surface regression contract

**Files:**
- Modify: `tests/test_mod.py`

**Interfaces:**
- Consumes: `StickyCssContractTests.extension`, the CSS after `EXTENSION_DELIMITER`.
- Produces: static requirements for the live Zen surface and rejection of the failed fallback.

- [ ] **Step 1: Replace the old background assertion with a failing contract**

Require `-moz-element(#zen-browser-background)`, a pseudo-element, fixed
background attachment, `var(--zen-urlbar-filter)`, pointer-event isolation, and
logical right-side alignment. Reject `Canvas`, `--zen-sidebar-background`,
`grain-bg.png`, and direct `--zen-main-browser-background*` reconstruction.

- [ ] **Step 2: Run the focused test and verify red**

Run: `python -m unittest tests.test_mod.StickyCssContractTests.test_sticky_wrapper_uses_live_zen_theme_surface -v`

Expected: FAIL because the extension still contains
`background: var(--zen-sidebar-background, Canvas)` and no live surface.

### Task 2: Implement the smallest captured-surface candidate

**Files:**
- Modify: `userChrome.css`
- Test: `tests/test_mod.py`

**Interfaces:**
- Consumes: Zen's live `#zen-browser-background` element and inherited
  `--zen-urlbar-filter` custom property.
- Produces: `#tabbrowser-arrowscrollbox-periphery::before` as a non-layout,
  non-interactive surface behind the native button.

- [ ] **Step 1: Replace the opaque wrapper background**

Keep sticky offsets and `z-index`. Add `isolation: isolate` and a generated
`::before` layer using `background-image: -moz-element(#zen-browser-background)`,
fixed attachment, no repeat, left-top positioning, Zen's filter, and
`pointer-events: none`. Add a right-sidebar selector that changes only the
background position to `right top`.

- [ ] **Step 2: Run the focused contract and verify green**

Run: `python -m unittest tests.test_mod.StickyCssContractTests.test_sticky_wrapper_uses_live_zen_theme_surface -v`

Expected: PASS.

- [ ] **Step 3: Run the full static suite**

Run: `python -m unittest discover -s tests -v`

Expected: all tests pass.

- [ ] **Step 4: Mutation-check the regression**

Temporarily replace the captured surface with the former `Canvas` declaration,
run the focused test and observe failure, then restore the candidate and rerun
to pass.

### Task 3: Verify the candidate in disposable Zen

**Files:**
- Create: `verification/theme-surface/theme-surface-receipt.json`
- Create: `verification/theme-surface/*.png`
- Modify: `VERIFICATION.md`

**Interfaces:**
- Consumes: the exact local `userChrome.css` hash and an isolated copy of the
  user's Sine mod stack.
- Produces: computed-style, geometry, hit-test, screenshot, and animation
  evidence bound to that hash.

- [ ] **Step 1: Create the isolated candidate profile**

Copy only the required profile configuration and Sine mod stack into a
workspace-local disposable profile. Replace only the copied mod CSS with the
candidate. Record Zen and Sine versions and candidate SHA-256.

- [ ] **Step 2: Verify capability and paint inputs**

Record `CSS.supports("background-image", "-moz-element(#zen-toolbar-background)")`,
the source background element's rectangle/attributes, the wrapper's computed
background properties, and the active inherited acrylic filter. Stop if the
function is unsupported or the source has zero dimensions.

- [ ] **Step 3: Run the geometry and appearance matrix**

With enough tabs for overflow, capture start/middle/end positions for top and
bottom placement, expanded and collapsed sidebar, plus right-side placement.
Record one-pixel drift checks, first/last tab reachability, hit testing, tab
legibility beneath the wrapper, and screenshots for the user's gradient/grain,
light, dark, private, and one custom theme.

- [ ] **Step 4: Verify interactions and animation**

Exercise hover, focus, trusted press/release, tooltip, and New Tab activation.
With animation enabled, require the plus to reach 90 degrees and the button to
reach scale 0.95 while active; with animation disabled, require no icon rotation
while activation remains functional.

- [ ] **Step 5: Evaluate performance and stop rules**

Scroll continuously through overflowed tabs and record whether the live image
causes visible jank or stale frames. If alignment, occlusion, or performance
fails, retain the receipt and do not update release claims.

### Task 4: Record the evidence and final local gates

**Files:**
- Modify: `VERIFICATION.md`
- Modify only if supported by evidence: `README.md`

**Interfaces:**
- Consumes: the exact-candidate receipt and screenshots.
- Produces: an honest local readiness statement without publication.

- [ ] **Step 1: Document observed results and limitations**

Replace the obsolete `Canvas` rationale with the headed-profile result. Do not
promote compatibility claims for any appearance or interaction that was not
observed on the exact candidate.

- [ ] **Step 2: Run final verification**

Run: `python -m unittest discover -s tests -v`

Run: `git diff --check`

Run: `git status --short --branch`

Expected: tests and diff check exit zero; status contains only intended tracked
changes plus the untouched untracked `Errors/` directory.

- [ ] **Step 3: Stop at the authorization boundary**

Present the diff and evidence. Do not stage, commit, push, publish, or install in
the user's normal profile without a new explicit request.
