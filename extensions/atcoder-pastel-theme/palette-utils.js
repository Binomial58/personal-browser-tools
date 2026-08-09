// Shared by content.js and popup.js (loaded as a plain script by both, no
// module system needed for a couple of small pure functions).
(function (root) {
  "use strict";

  function hexToRgb(hex) {
    const normalized = hex.replace("#", "");
    const value =
      normalized.length === 3
        ? normalized
            .split("")
            .map((c) => c + c)
            .join("")
        : normalized;
    const int = parseInt(value, 16);
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255
    };
  }

  function rgbToHex(r, g, b) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    return (
      "#" +
      [clamp(r), clamp(g), clamp(b)]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")
    );
  }

  // Mixes `hex` toward `targetHex` by `amount` (0 = unchanged, 1 = targetHex).
  function mix(hex, targetHex, amount) {
    const a = hexToRgb(hex);
    const b = hexToRgb(targetHex);
    return rgbToHex(
      a.r + (b.r - a.r) * amount,
      a.g + (b.g - a.g) * amount,
      a.b + (b.b - a.b) * amount
    );
  }

  function darken(hex, amount) {
    return mix(hex, "#000000", amount);
  }

  function lighten(hex, amount) {
    return mix(hex, "#ffffff", amount);
  }

  // Derives the full role set (surface/text stay a fixed light neutral;
  // only primary/accent/secondary come from the user's 3 picks) that a
  // custom light palette needs, from just the three colors the popup asks
  // the user to choose.
  function deriveCustomPalette({ primary, accent, secondary }) {
    return {
      "--apt-primary": primary,
      "--apt-primary-deep": darken(primary, 0.3),
      "--apt-primary-soft": lighten(primary, 0.88),
      "--apt-primary-bright": darken(primary, 0.3),

      "--apt-accent": lighten(accent, 0.35),
      "--apt-accent-deep": darken(accent, 0.15),
      "--apt-accent-darker": darken(accent, 0.35),

      "--apt-secondary": lighten(secondary, 0.3),
      "--apt-secondary-deep": darken(secondary, 0.35)
    };
  }

  const api = { hexToRgb, rgbToHex, mix, darken, lighten, deriveCustomPalette };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.AptPaletteUtils = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
