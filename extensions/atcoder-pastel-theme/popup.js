(function () {
  "use strict";

  const PALETTE_KEY = "atcoder-pastel-theme:palette";
  const CUSTOM_COLORS_KEY = "atcoder-pastel-theme:custom-colors";
  const CODE_THEME_KEY = "atcoder-pastel-theme:code-theme";
  const DEFAULT_PALETTE = "fairyfloss";
  const DEFAULT_CUSTOM_COLORS = {
    primary: "#6b5c94",
    accent: "#ff8fb3",
    secondary: "#4fc9a0"
  };

  // Kept in sync by hand with the `:root[data-apt-palette="..."]` blocks in
  // theme.css. Only the three preview colors live here; the real palette
  // definitions (all the derived -deep/-soft shades) stay in the stylesheet
  // as the single source of truth.
  const PALETTES = [
    {
      id: "fairyfloss",
      name: "フェアリーフロス",
      colors: ["#6b5c94", "#ffb8d1", "#b9f2da"]
    },
    {
      id: "wisteria",
      name: "藤",
      colors: ["#6a5aab", "#d6b3ea", "#b9d0f2"]
    },
    {
      id: "lavender-milk",
      name: "ラベンダーミルク",
      colors: ["#9584c4", "#ffcfb0", "#cdeee0"]
    },
    {
      id: "grape-soda",
      name: "グレープソーダ",
      colors: ["#7c4fc9", "#ff7fc0", "#7fe8c9"]
    },
    {
      id: "moon-night",
      name: "ムーンナイト",
      colors: ["#6a58a8", "#ff9ecf", "#4fd8ab"]
    }
  ];

  const CODE_THEME_OPTIONS = [
    { id: "auto", label: "自動" },
    { id: "light", label: "ライト" },
    { id: "dark", label: "ダーク" }
  ];

  function storageGet(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (items) => resolve(items));
    });
  }

  function storageSet(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set(values, () => resolve());
    });
  }

  function wheelBackground(colors) {
    const step = 360 / colors.length;
    const stops = colors
      .map((color, index) => {
        const from = Math.round(step * index);
        const to = Math.round(step * (index + 1));
        return `${color} ${from}deg ${to}deg`;
      })
      .join(", ");
    return `conic-gradient(${stops})`;
  }

  function renderPaletteGrid(selected) {
    const grid = document.getElementById("palette-grid");
    grid.innerHTML = "";

    for (const palette of PALETTES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "palette-swatch";
      button.setAttribute("aria-pressed", String(palette.id === selected));

      const wheel = document.createElement("span");
      wheel.className = "palette-swatch__wheel";
      wheel.style.background = wheelBackground(palette.colors);

      const name = document.createElement("span");
      name.className = "palette-swatch__name";
      name.textContent = palette.name;

      const check = document.createElement("span");
      check.className = "palette-swatch__check";
      check.textContent = palette.id === selected ? "✓ 選択中" : "";

      button.append(wheel, name, check);
      button.addEventListener("click", async () => {
        await storageSet({ [PALETTE_KEY]: palette.id });
        refresh();
      });

      grid.appendChild(button);
    }
  }

  function renderCodeThemeGroup(selected) {
    const group = document.getElementById("code-theme-group");
    group.innerHTML = "";

    for (const option of CODE_THEME_OPTIONS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "segmented__option";
      const isActive = (selected || "auto") === option.id;
      button.setAttribute("aria-pressed", String(isActive));
      button.textContent = option.label;
      button.addEventListener("click", async () => {
        await storageSet({ [CODE_THEME_KEY]: option.id });
        refresh();
      });
      group.appendChild(button);
    }
  }

  function setupCustomPicker(selectedPalette, customColors) {
    const primaryInput = document.getElementById("custom-primary");
    const accentInput = document.getElementById("custom-accent");
    const secondaryInput = document.getElementById("custom-secondary");
    const applyButton = document.getElementById("custom-apply");

    const colors = customColors || DEFAULT_CUSTOM_COLORS;
    primaryInput.value = colors.primary;
    accentInput.value = colors.accent;
    secondaryInput.value = colors.secondary;

    applyButton.setAttribute(
      "aria-pressed",
      String(selectedPalette === "custom")
    );

    applyButton.onclick = async () => {
      await storageSet({
        [PALETTE_KEY]: "custom",
        [CUSTOM_COLORS_KEY]: {
          primary: primaryInput.value,
          accent: accentInput.value,
          secondary: secondaryInput.value
        }
      });
      refresh();
    };
  }

  function setupRandomButton() {
    document.getElementById("random-button").onclick = async () => {
      const choice =
        PALETTES[Math.floor(Math.random() * PALETTES.length)].id;
      await storageSet({ [PALETTE_KEY]: choice });
      refresh();
    };
  }

  async function refresh() {
    const items = await storageGet([
      PALETTE_KEY,
      CUSTOM_COLORS_KEY,
      CODE_THEME_KEY
    ]);
    const selectedPalette = items[PALETTE_KEY] || DEFAULT_PALETTE;

    renderPaletteGrid(selectedPalette);
    setupCustomPicker(selectedPalette, items[CUSTOM_COLORS_KEY]);
    renderCodeThemeGroup(items[CODE_THEME_KEY]);
  }

  setupRandomButton();
  refresh();
})();
