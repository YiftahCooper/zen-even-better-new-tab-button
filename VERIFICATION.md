# Verification record

## Current candidate: version 1.0.3

Version `1.0.3` restores the sticky button's native hover and pressed backgrounds
on Zen `1.22b` (Firefox `155.0.1`, build `20260904060728`). It uses
`--toolbarbutton-background-color-hover` and
`--toolbarbutton-background-color-active`, with the previous variable names as
fallbacks. No layout or animation declarations were changed.

On 2026-09-06, the previous rules reproduced fully transparent backgrounds
during actual WebDriver pointer hover and press in a disposable headless Zen
profile. With the candidate stylesheet registered as a user stylesheet, the
background matched Zen's native color values in light and dark color schemes,
with both expanded and collapsed sidebar attributes. Native opacity was 7% on
hover and 10% while pressed. Resting appearance remained transparent; press
scale was 0.95 and plus rotation was 90 degrees, resetting to 1 and 0 degrees
on release.

The legacy fallback also passed with the new tokens unset and only the old
tokens supplied in the current engine (an emulation, not an old-version browser
test). Disabling the plus-animation preference kept rotation at zero while the
press scale and both highlights continued to work. All 12 static tests passed.
Candidate CSS SHA-256:
`53BD14007CA690CDDD531DD89B941F4C92A819934A014D0EB6C7870652C89080`.

This is an engine-level interaction check, not a new Sine installation test or
a visual check in the user's profile. The top-placement requirement and known
bottom-placement limitation below continue to apply. The earlier release's
CSS hashes below describe that release, not this candidate.

## Previous decision: version 1.0.2

Version `1.0.2` corrects the Zen `1.21.15b` top-placement layout regression.
Sticky mode is qualified only with Zen's **Move New Tab button to top** setting
enabled. The exact candidate was loaded through the Sine mod directory of a
disposable profile cloned from the real Sine setup; the real profile was not
modified.

### Bound candidate

- Zen Browser: `1.21.15b`, Firefox `154.0`, build `20260818101929`
- Sine engine: `2.3.3.0`
- Mod version: `1.0.2`
- Candidate CSS SHA-256:
  `53D5D276564E58C4F812E77ABC2B09D880419266E0BCBE8D0A76E9AA33C13684`
- Pinned upstream commit:
  `f1a23de04c7a63d14647b9626756ad58184bff19`
- Profile: disposable clone of the real profile

### Regression and correction

Zen's Firefox 154 sync renamed `--tab-block-margin` to
`--tab-margin-block`. Version `1.0.1` used the removed name in the top-slot
reservation. An unresolved custom property invalidated the entire declaration,
so the reserved margin computed to `0px` while the anchored button remained
visible. The button therefore painted over Zen's current-space row.

Version `1.0.2` defines mod-owned height and margin values. The margin prefers
the current token, accepts the previous token, and falls back to `2px`; height
prefers Firefox's native `--tab-min-height` and falls back to `36px`. A missing
upstream spacing token can therefore no longer invalidate the reservation.

A later geometry-focused check found that bottom placement is not usable: the
last ordinary tab and the New Tab row overlap. The button measured
`857.5–893.5px` while the last tab measured `855.5–895.5px`. This was reproduced
through Sine in a clean profile and independently confirmed in a normal browser
profile. The earlier hit-target check did not detect this layout collision.

### Static verification

`python -m unittest discover -s tests -v`: **12 tests passed**.

The new regression checks fail if the slot returns to a single unguarded Zen
spacing token or if the external button loses its minimal stacking level.

### Live verification

With 40 overflow tabs, the corrected top placement measured:

| Sidebar | Button top at start/middle/end | Button hit target | Ordinary tab width, sticky off/on |
|---|---|---|---|
| Expanded | `126.5 / 126.5 / 126.5` px | Pass | `181 / 181` px |
| Collapsed | `158.5 / 158.5 / 158.5` px | Pass | `49.333 / 49.333` px |

The current-space row ended at `124.5px`; the button occupied
`126.5–162.5px`; and the first ordinary tab began at `164.5px`. The corrected
normal-tab section reserved `40px`, compared with `0px` under the removed
variable.

A real pointer hold produced button scale `0.95` and plus rotation `90deg`;
release restored scale `1` and rotation `0deg`.

A separate README media run used 38 generic overflow tabs with top placement.
Across seven scroll samples spanning a `771px` range, the button's top edge was
`148.5px` at every sample. The captured pointer hold measured scale `0.95` and
plus rotation `90deg`; release restored scale `1` and rotation `0deg`.

### Source durability assessment

- Zen's current `dev` source uses `--tab-margin-block` in its own vertical-tab
  geometry.
- The Firefox 154 sync commit changed both Firefox's New Tab margin and Zen's
  consumers from `--tab-block-margin` to `--tab-margin-block`, confirming the
  regression was an upstream rename rather than a guessed diagnosis.
- Current Zen workspace markup comments that
  `#tabbrowser-arrowscrollbox-periphery` remains an ID for Firefox
  compatibility, and Zen code still exposes `#tabs-newtab-button`,
  `#vertical-tabs-newtab-button`, and `zen.view.show-newtab-button-top`.

This is reasonably resilient to spacing-token churn, but userChrome/Sine mods
still depend on undocumented browser chrome and cannot be guaranteed across a
future structural DOM rewrite.

### Normal-profile confirmation

The isolated browser confirms top-placement geometry, hit testing, and
animation. The mod's top-placement behavior and New Tab function were
subsequently confirmed in the normal browser profile. Bottom placement remains
unsupported because of the reproduced overlap above.

## Previous 1.0.1 decision (superseded)

Version `1.0.1` is a candidate for headed user confirmation. Its layout,
hit-target, scrolling, workspace-switching, transparency, and press animations
passed in an isolated clone of the real Sine profile. Opening a tab remains an
interactive confirmation because the isolated browser's New Tab command
controller was unavailable.

Detailed raw browser-automation receipts are intentionally excluded from the
public repository because they contain machine-specific runtime metadata. This
document retains the claim-level results needed to understand the release
without publishing local paths, profile identifiers, or session state.

## Bound candidate

- Zen Browser: `1.21.9b`, build `20260725024203`
- Sine engine: `2.3.3.0`
- Mod version: `1.0.1`
- Candidate CSS SHA-256:
  `ABA020E197935544D5444E9B92F8CA45667B0A6086D7112797EE961D816A979D`
- Installed Sine CSS SHA-256:
  `ABA020E197935544D5444E9B92F8CA45667B0A6086D7112797EE961D816A979D`
- Pinned upstream commit:
  `f1a23de04c7a63d14647b9626756ad58184bff19`
- Upstream CSS-prefix SHA-256:
  `1c1908174deb5ead45597e9d14f438d56014fe32ef3d3f01beb2ba1cfb244e73`
- Profile: disposable clone of the real profile; the real profile was not
  modified

## Root cause and correction

Version `1.0.0` hid the scrolling `#tabs-newtab-button` and revealed Zen's
native external `#vertical-tabs-newtab-button`. For top placement it applied
`order: -1`, which moved that external button to the start of
`#zen-tabs-wrapper`. Zen's absolutely positioned Essentials region then painted
over it. The visible blank space was the replacement button's flow allocation,
while the button itself was underneath Essentials.

Version `1.0.1` keeps the external button in the original visual slot: after
the pinned section and immediately before ordinary tabs. It reserves one native
tab-height slot, anchors the external control to the active ordinary-tab
section, and makes ordinary tabs own vertical scrolling during sticky top
placement. The latter is necessary because native Zen otherwise scrolls the
anchor itself; it also means pinned tabs remain fixed while sticky top placement
is enabled. Sticky bottom placement keeps the existing external flex layout.

The resting surface remains transparent. No literal theme color, fixed
positioning, `z-index`, or guessed sidebar dimension was added.

## Static verification

Command:

```powershell
python -m unittest discover -s tests -v
```

Result: **11 tests passed**.

The suite binds all upstream CSS bytes and seven upstream preferences, validates
the metadata and sticky preference, rejects the failed `order: -1` rule, and
requires the active-workspace anchor, native collapsed width, isolated normal
tab scroller, transparent native surfaces, and both animations.

## Live verification

The exact repository CSS was copied into the cloned profile's installed Sine
mod directory. Both files produced the same SHA-256 shown above. Zen was then
restarted before measurement.

| Sidebar | Placement | Measured edge at start/middle/end | Hit target | First/last tab |
|---|---|---|---|---|
| Expanded | Top | `370 / 370 / 370` px top | Button | Reachable |
| Collapsed | Top | `598 / 598 / 598` px top | Button | Reachable |
| Expanded | Bottom | `1039 / 1039 / 1039` px bottom | Button | Reachable* |
| Collapsed | Bottom | `843.8 / 843.8 / 843.8` px bottom | Button | Reachable* |

\* These historical bottom checks measured edge stability and the hit target,
but did not test whether the final ordinary tab occupied the same row. The
later overlap measurement invalidates bottom-placement support.

The top matrix also passed with the SuperPins `stay-at-top` feature disabled,
which restored Zen's native workspace scroller before this mod isolated the
ordinary-tab scroller. In both states the measured drift was `0` px.

A real workspace-button click switched to another workspace with no pinned tabs
and 68 ordinary tabs. The anchor followed the newly active workspace; the
button remained the top hit target and stayed at `558` px through the current
`2475` px scroll range.

The expanded button kept its native `287 × 36` px geometry. The collapsed
button kept Zen's native `48 × 36` px geometry. The control retained:

- command: `cmd_newNavigatorTab`
- tooltip: `dynamic-shortcut-tooltip`
- label: `New Tab`
- transparent resting background

## Animation verification

A real WebDriver mouse pointer was moved onto the corrected collapsed/top
button and held down. After the transitions settled:

- `:active` was true;
- button scale was `0.95`;
- plus rotation was `90` degrees;
- release restored scale `1` and rotation `0`.

This verifies the actual pointer state and animations at the corrected button
location, rather than only matching CSS text.

## Remaining headed-user gate

The isolated process displayed a crashed content tab and had no controller for
`cmd_newNavigatorTab`; pointer release therefore could not prove tab creation.
Before treating `1.0.1` as qualified, confirm in the normal headed browser:

1. The button is visible in the same slot shown when sticky mode is disabled.
2. One click opens exactly one tab and both enabled animations play.
3. Hover, pressed, focus, and tooltip behavior remain native.
4. Top placement works after a normal Zen restart. Bottom placement is
   unsupported because ordinary tabs can overlap the New Tab row.

No universal compatibility claim is made.
