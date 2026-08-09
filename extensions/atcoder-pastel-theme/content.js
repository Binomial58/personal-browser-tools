(function () {
  "use strict";

  const PALETTE_KEY = "atcoder-pastel-theme:palette";
  const CUSTOM_COLORS_KEY = "atcoder-pastel-theme:custom-colors";
  const CODE_THEME_KEY = "atcoder-pastel-theme:code-theme";
  const DEFAULT_PALETTE = "fairyfloss";

  function clearCustomProperties() {
    const style = document.documentElement.style;
    [
      "--apt-primary",
      "--apt-primary-deep",
      "--apt-primary-soft",
      "--apt-primary-bright",
      "--apt-accent",
      "--apt-accent-deep",
      "--apt-accent-darker",
      "--apt-secondary",
      "--apt-secondary-deep"
    ].forEach((prop) => style.removeProperty(prop));
  }

  function applyCustomColors(customColors) {
    clearCustomProperties();

    if (!customColors || !window.AptPaletteUtils) {
      return;
    }

    const derived = window.AptPaletteUtils.deriveCustomPalette(customColors);
    const style = document.documentElement.style;

    for (const [prop, value] of Object.entries(derived)) {
      style.setProperty(prop, value);
    }
  }

  function applyPalette(palette, customColors) {
    const root = document.documentElement;

    if (palette && palette !== DEFAULT_PALETTE) {
      root.setAttribute("data-apt-palette", palette);
    } else {
      root.removeAttribute("data-apt-palette");
    }

    if (palette === "custom") {
      applyCustomColors(customColors);
    } else {
      clearCustomProperties();
    }
  }

  function applyCodeTheme(codeTheme) {
    const root = document.documentElement;

    if (codeTheme === "dark" || codeTheme === "light") {
      root.setAttribute("data-apt-code-theme", codeTheme);
    } else {
      root.removeAttribute("data-apt-code-theme");
    }
  }

  chrome.storage.local.get(
    [PALETTE_KEY, CUSTOM_COLORS_KEY, CODE_THEME_KEY],
    (items) => {
      applyPalette(items[PALETTE_KEY], items[CUSTOM_COLORS_KEY]);
      applyCodeTheme(items[CODE_THEME_KEY]);
    }
  );

  // Re-color already-open tabs the moment a setting changes from the
  // popup, instead of waiting for the next page load.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }

    if (changes[PALETTE_KEY] || changes[CUSTOM_COLORS_KEY]) {
      chrome.storage.local.get([PALETTE_KEY, CUSTOM_COLORS_KEY], (items) => {
        applyPalette(items[PALETTE_KEY], items[CUSTOM_COLORS_KEY]);
      });
    }

    if (changes[CODE_THEME_KEY]) {
      applyCodeTheme(changes[CODE_THEME_KEY].newValue);
    }
  });
})();
