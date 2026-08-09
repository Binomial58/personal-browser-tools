(function () {
  "use strict";

  const STORAGE_KEY = "atcoder-pastel-theme:palette";
  const DEFAULT_PALETTE = "fairyfloss";

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
    }
  ];

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

  function render(selected) {
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
      button.addEventListener("click", () => {
        chrome.storage.local.set({ [STORAGE_KEY]: palette.id }, () => {
          render(palette.id);
        });
      });

      grid.appendChild(button);
    }
  }

  chrome.storage.local.get([STORAGE_KEY], (items) => {
    render(items[STORAGE_KEY] || DEFAULT_PALETTE);
  });
})();
