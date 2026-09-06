import hashlib
import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CSS_PATH = ROOT / "userChrome.css"
PREFERENCES_PATH = ROOT / "preferences.json"
THEME_PATH = ROOT / "theme.json"

UPSTREAM_COMMIT = "f1a23de04c7a63d14647b9626756ad58184bff19"
UPSTREAM_CSS_SHA256 = "1c1908174deb5ead45597e9d14f438d56014fe32ef3d3f01beb2ba1cfb244e73"
EXTENSION_DELIMITER = "\n\n/* === Even Better New Tab Button: sticky extension === */\n"

UPSTREAM_PREFERENCES = [
    {
        "type": "checkbox",
        "property": "btrnewtab.plusanim",
        "label": "Animate the plus icon on click",
        "defaultValue": True,
    },
    {
        "type": "checkbox",
        "property": "btrnewtab.enable-border-radius",
        "label": "Enable custom roundness for the New Tab button",
        "defaultValue": False,
    },
    {
        "type": "string",
        "property": "btrnewtab.border-radius",
        "defaultValue": "8px",
        "label": "Customise how round the new tab button is (default 8px)",
        "conditions": [
            {
                "if": {
                    "property": "btrnewtab.enable-border-radius",
                    "value": True,
                }
            }
        ],
    },
    {
        "type": "checkbox",
        "property": "btrtabs.enable-border-radius",
        "label": "Enable custom roundness for tabs",
        "defaultValue": False,
    },
    {
        "type": "string",
        "property": "btrtabs.border-radius",
        "defaultValue": "8px",
        "label": "Customise how round tabs are (default 8px)",
        "conditions": [
            {
                "if": {
                    "property": "btrtabs.enable-border-radius",
                    "value": True,
                }
            }
        ],
    },
    {
        "type": "checkbox",
        "property": "btrfolders.enable-border-radius",
        "label": "Enable custom roundness for folders",
        "defaultValue": False,
    },
    {
        "type": "string",
        "property": "btrfolders.border-radius",
        "defaultValue": "8px",
        "label": "Customise how round folders are (default 8px)",
        "conditions": [
            {
                "if": {
                    "property": "btrfolders.enable-border-radius",
                    "value": True,
                }
            }
        ],
    },
]

STICKY_PREFERENCE = {
    "type": "checkbox",
    "property": "btrnewtab.sticky",
    "label": "Keep the New Tab button visible while tabs scroll",
    "defaultValue": True,
}


def read_json(path: Path):
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


class UpstreamPreservationTests(unittest.TestCase):
    def test_css_before_extension_is_exact_pinned_upstream(self):
        css = CSS_PATH.read_text(encoding="utf-8")
        upstream_css, separator, _extension = css.partition(EXTENSION_DELIMITER)

        self.assertEqual(separator, EXTENSION_DELIMITER)
        self.assertEqual(
            hashlib.sha256(upstream_css.encode("utf-8")).hexdigest(),
            UPSTREAM_CSS_SHA256,
            f"CSS before the extension must remain byte-identical to {UPSTREAM_COMMIT}",
        )

    def test_upstream_preferences_are_preserved_and_sticky_is_appended(self):
        preferences = read_json(PREFERENCES_PATH)

        self.assertEqual(preferences[:7], UPSTREAM_PREFERENCES)
        self.assertEqual(preferences[7:], [STICKY_PREFERENCE])


class ExternalButtonCssContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        css = CSS_PATH.read_text(encoding="utf-8")
        _upstream, separator, cls.extension = css.partition(EXTENSION_DELIMITER)
        if separator != EXTENSION_DELIMITER:
            cls.extension = ""

    def test_extension_uses_zen_external_control_outside_workspace_scrolling(self):
        self.assertIn("#zen-tabs-wrapper", self.extension)
        self.assertIn("#tabbrowser-arrowscrollbox", self.extension)
        self.assertIn("#tabs-newtab-button", self.extension)
        self.assertIn("#vertical-tabs-newtab-button", self.extension)
        self.assertNotIn("#tabbrowser-arrowscrollbox-periphery", self.extension)

        inner_button = re.search(
            r"#tabs-newtab-button\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(inner_button)
        self.assertIn("display: none !important", inner_button.group(1))

        external_button = re.search(
            r"#vertical-tabs-newtab-button\.toolbarbutton-1\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(external_button)
        self.assertIn("display: flex !important", external_button.group(1))
        self.assertIn("flex: 0 0 auto !important", external_button.group(1))
        self.assertIn(
            "z-index: 1",
            external_button.group(1),
            "Zen's absolutely positioned workspace otherwise covers the bottom button's hit target",
        )

    def test_extension_makes_the_native_arrowscrollbox_the_clipped_flex_child(self):
        self.assertIn('@media (-moz-pref("btrnewtab.sticky"))', self.extension)
        wrapper = re.search(
            r"#zen-tabs-wrapper\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(wrapper)
        self.assertIn("display: flex !important", wrapper.group(1))
        self.assertIn("flex-direction: column !important", wrapper.group(1))
        self.assertIn("min-height: 0 !important", wrapper.group(1))
        self.assertIn("overflow: hidden !important", wrapper.group(1))
        self.assertNotIn("background", wrapper.group(1))

        arrowscrollbox = re.search(
            r"#tabbrowser-arrowscrollbox\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(arrowscrollbox)
        self.assertIn("flex: 1 1 auto !important", arrowscrollbox.group(1))
        self.assertIn("min-height: 0 !important", arrowscrollbox.group(1))
        self.assertIn("overflow: hidden !important", arrowscrollbox.group(1))
        self.assertNotRegex(
            arrowscrollbox.group(1),
            r"\bposition\s*:",
            "positioning this element changes Zen's workspace containing block "
            "and widens every ordinary tab by twice --zen-toolbox-padding",
        )

    def test_native_top_preference_anchors_button_before_active_normal_tabs(self):
        top_media = re.search(
            r'@media \(-moz-pref\("zen\.view\.show-newtab-button-top"\)\)\s*\{(.*)\n\s*\}',
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(top_media)
        top_rules = top_media.group(1)
        self.assertNotIn(
            "order: -1",
            top_rules,
            "reordering the external button moves it under Zen's absolutely positioned Essentials region",
        )

        self.assertIsNone(
            re.search(
                r"#zen-tabs-wrapper\s*\{[^{}]*\bposition\s*:",
                top_rules,
                re.DOTALL,
            ),
            "positioning the wrapper changes Zen's workspace containing block "
            "and widens every ordinary tab by twice --zen-toolbox-padding",
        )

        normal_tabs = re.search(
            r'#tabbrowser-arrowscrollbox > zen-workspace\[active="true"\]\s*'
            r'\.zen-workspace-normal-tabs-section\s*\{([^{}]*)\}',
            top_rules,
            re.DOTALL,
        )
        self.assertIsNotNone(normal_tabs)
        self.assertIn("anchor-name: --btrnewtab-active-normal", normal_tabs.group(1))
        self.assertIn("flex: 1 1 0 !important", normal_tabs.group(1))
        self.assertIn("min-height: 0 !important", normal_tabs.group(1))
        self.assertIn("overflow-y: auto !important", normal_tabs.group(1))
        self.assertRegex(
            normal_tabs.group(1),
            r"margin-block-start:\s*"
            r"calc\(var\(--btrnewtab-button-height\) \+\s*"
            r"2 \* var\(--btrnewtab-button-block-margin\)\) !important",
        )

        workspace_scroller = re.search(
            r'#tabbrowser-arrowscrollbox > zen-workspace\[active="true"\] >\s*'
            r'arrowscrollbox\.workspace-arrowscrollbox\s*\{([^{}]*)\}',
            top_rules,
            re.DOTALL,
        )
        self.assertIsNotNone(workspace_scroller)
        self.assertIn("overflow-y: hidden !important", workspace_scroller.group(1))
        self.assertIn("flex-basis: 100% !important", workspace_scroller.group(1))

        pinned_tabs = re.search(
            r'#tabbrowser-arrowscrollbox > zen-workspace\[active="true"\]\s*'
            r'\.zen-workspace-pinned-tabs-section\s*\{([^{}]*)\}',
            top_rules,
            re.DOTALL,
        )
        self.assertIsNotNone(pinned_tabs)
        self.assertIn("flex: 0 1 0 !important", pinned_tabs.group(1))

        external_button = re.search(
            r'#vertical-tabs-newtab-button\.toolbarbutton-1\s*\{([^{}]*)\}',
            top_rules,
            re.DOTALL,
        )
        self.assertIsNotNone(external_button)
        self.assertIn("position: absolute !important", external_button.group(1))
        self.assertIn(
            "position-anchor: --btrnewtab-active-normal",
            external_button.group(1),
        )
        self.assertIn("bottom: anchor(top) !important", external_button.group(1))
        self.assertIn(
            "inset-inline-start: anchor(start) !important",
            external_button.group(1),
        )
        self.assertIn(
            "inset-inline-end: anchor(end) !important",
            external_button.group(1),
        )
        self.assertNotIn(
            "width: auto",
            external_button.group(1),
            "the top-positioning rule must not replace Zen's native collapsed button width",
        )

        collapsed_button = re.search(
            r':root:not\(\[zen-sidebar-expanded="true"\]\)\s*'
            r'#vertical-tabs-newtab-button\.toolbarbutton-1\s*\{([^{}]*)\}',
            top_rules,
            re.DOTALL,
        )
        self.assertIsNotNone(collapsed_button)
        self.assertIn(
            "inset-inline-start: anchor(center) !important",
            collapsed_button.group(1),
        )
        self.assertIn("translate: -50% 0 !important", collapsed_button.group(1))

    def test_sticky_slot_survives_zen_spacing_token_renames(self):
        tabbrowser_tabs = re.search(
            r"#tabbrowser-tabs\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(tabbrowser_tabs)
        self.assertRegex(
            tabbrowser_tabs.group(1),
            r"--btrnewtab-button-block-margin:\s*"
            r"var\(--tab-margin-block, var\(--tab-block-margin, 2px\)\)",
        )
        self.assertIn(
            "--btrnewtab-button-height: var(--tab-min-height, 36px)",
            tabbrowser_tabs.group(1),
        )

        external_button = re.search(
            r"#vertical-tabs-newtab-button\.toolbarbutton-1\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(external_button)
        self.assertIn(
            "min-height: var(--btrnewtab-button-height) !important",
            external_button.group(1),
        )
        self.assertIn(
            "margin-block: var(--btrnewtab-button-block-margin) !important",
            external_button.group(1),
        )

    def test_extension_does_not_control_the_native_separator(self):
        for native_separator_contract in (
            ".pinned-tabs-container-separator",
            "[hide-separator]",
            "cmd_zenCloseUnpinnedTabs",
        ):
            with self.subTest(native_separator_contract=native_separator_contract):
                self.assertNotIn(
                    native_separator_contract,
                    self.extension,
                    "the sticky extension must work with either Zen's separator or an unrelated mod that removes it",
                )

    def test_external_button_is_transparent_until_native_interaction_states(self):
        button = re.search(
            r"#vertical-tabs-newtab-button\.toolbarbutton-1\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(button)
        self.assertIn("background: transparent !important", button.group(1))

        hover_rule = re.search(
            r"#vertical-tabs-newtab-button\.toolbarbutton-1:hover\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(hover_rule)
        self.assertIn(
            "var(--toolbarbutton-background-color-hover, var(--toolbarbutton-hover-background)) !important",
            hover_rule.group(1),
        )

        active_rule = re.search(
            r"#vertical-tabs-newtab-button\.toolbarbutton-1:is\(:active, \[open\], \[checked\]\)\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(active_rule)
        self.assertIn(
            "var(--toolbarbutton-background-color-active, var(--toolbarbutton-active-background)) !important",
            active_rule.group(1),
        )

        child_state_rule = re.search(
            r"#vertical-tabs-newtab-button\.toolbarbutton-1:is\(:hover, :active, \[open\], \[checked\]\)\s*"
            r":is\(\.toolbarbutton-icon, \.toolbarbutton-text\)\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(
            child_state_rule,
            "Zen's full-width button surface requires the icon's generic Firefox hover surface to stay transparent",
        )
        self.assertIn("background: transparent !important", child_state_rule.group(1))

        for rejected_background in (
            "var(--zen-colors-tertiary",
            "var(--zen-main-browser-background-toolbar",
            "var(--zen-sidebar-background",
            "Canvas",
        ):
            with self.subTest(rejected_background=rejected_background):
                self.assertNotIn(rejected_background, self.extension)

    def test_external_button_preserves_press_and_plus_animations(self):
        button = re.search(
            r"#vertical-tabs-newtab-button\.toolbarbutton-1\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(button)
        self.assertIn(
            "transition: transform 0.1s ease-out !important",
            button.group(1),
        )

        press_rule = re.search(
            r"#vertical-tabs-newtab-button\.toolbarbutton-1:hover:active,\s*"
            r"#vertical-tabs-newtab-button\.toolbarbutton-1:active\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(press_rule)
        self.assertIn("transform: scale(0.95) !important", press_rule.group(1))

        icon_rule = re.search(
            r"#vertical-tabs-newtab-button\.toolbarbutton-1 \.toolbarbutton-icon\s*\{([^{}]*)\}",
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(icon_rule)
        self.assertIn("transition: transform 0.15s ease-in-out !important", icon_rule.group(1))
        self.assertIn("transform: translateX(0) rotate(0deg) !important", icon_rule.group(1))

        plus_media = re.search(
            r'@media \(-moz-pref\("btrnewtab\.plusanim"\)\)\s*\{\s*'
            r'#vertical-tabs-newtab-button\.toolbarbutton-1:active \.toolbarbutton-icon\s*\{([^{}]*)\}',
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(plus_media)
        self.assertIn("transform: translateX(0) rotate(90deg) !important", plus_media.group(1))

    def test_external_button_receives_the_upstream_roundness_preference(self):
        radius_media = re.search(
            r'@media \(-moz-pref\("btrnewtab\.enable-border-radius"\)\)\s*\{\s*'
            r'#vertical-tabs-newtab-button\.toolbarbutton-1\s*\{([^{}]*)\}',
            self.extension,
            re.DOTALL,
        )
        self.assertIsNotNone(radius_media)
        self.assertIn(
            "border-radius: var(--btrnewtab-border-radius) !important",
            radius_media.group(1),
        )

    def test_extension_avoids_failed_positioning_and_hardcoded_styling(self):
        self.assertTrue(self.extension, "the independently designed extension must exist")
        forbidden_literals = (
            "position: sticky",
            "position: fixed",
            "zen-newtab-button-bottom",
            "anchor-size(",
            "anchor-scope:",
        )
        for forbidden in forbidden_literals:
            with self.subTest(forbidden=forbidden):
                self.assertNotIn(forbidden, self.extension)

        self.assertIsNone(
            re.search(
                r"(?i)(?:background|background-color|color|border-color)\s*:\s*(?:#|rgba?\()",
                self.extension,
            )
        )


class MetadataContractTests(unittest.TestCase):
    def test_theme_has_independent_release_identity(self):
        theme = read_json(THEME_PATH)

        self.assertEqual(theme["id"], "7f126d94-71d0-4c21-9de6-64f933edf185")
        self.assertNotEqual(theme["id"], "bada16c1-3b14-483b")
        self.assertEqual(theme["name"], "Even Better New Tab Button")
        self.assertEqual(theme["version"], "1.0.3")
        self.assertEqual(
            theme["homepage"],
            "https://github.com/YiftahCooper/zen-even-better-new-tab-button",
        )
        self.assertEqual(theme["style"], {"chrome": "userChrome.css"})
        self.assertEqual(theme["ai"], "yes")


if __name__ == "__main__":
    unittest.main()
