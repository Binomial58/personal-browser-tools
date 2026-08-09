(function () {
  "use strict";

  const STORAGE_KEY = "atcoder-pastel-theme:palette";
  const DEFAULT_PALETTE = "fairyfloss";

  function applyPalette(palette) {
    if (palette && palette !== DEFAULT_PALETTE) {
      document.documentElement.setAttribute("data-apt-palette", palette);
    } else {
      document.documentElement.removeAttribute("data-apt-palette");
    }
  }

  chrome.storage.local.get([STORAGE_KEY], (items) => {
    applyPalette(items[STORAGE_KEY]);
  });

  // Re-color already-open tabs the moment the palette is changed from the
  // popup, instead of waiting for the next page load.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEY]) {
      applyPalette(changes[STORAGE_KEY].newValue);
    }
  });
})();
