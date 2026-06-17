(function () {
  "use strict";

  const ROOT_ID = "cp-sample-downloader";
  const BUTTON_LABEL = "Sample DL";
  const DOWNLOADED_LABEL = "Downloaded";
  const EMPTY_LABEL = "No Samples";
  const FAILED_LABEL = "Failed";
  const CRC32_TABLE = createCrc32Table();
  const textEncoder = new TextEncoder();

  function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
  }

  function sanitizeFilename(name, fallbackName) {
    return (
      (name || fallbackName).replace(/[\\/:*?"<>|]+/g, "_").trim() ||
      fallbackName
    );
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  }

  function getElementText(element) {
    return (element?.textContent || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");
  }

  function getPreText(pre) {
    const clone = pre.cloneNode(true);
    clone
      .querySelectorAll("button, .btn, .btn-copy, script, style")
      .forEach((element) => element.remove());

    const numberedLines = Array.from(clone.querySelectorAll("ol.linenums > li"));

    if (numberedLines.length > 0) {
      return `${numberedLines
        .map((line) => line.textContent)
        .join("\n")
        .replace(/^\n/, "")}\n`;
    }

    return getElementText(clone).replace(/^\n/, "");
  }

  function findPreAfterHeadingInContainer(heading, container) {
    const preNodes = Array.from(container.querySelectorAll("pre"));
    const visiblePreNodes = preNodes.filter(isVisible);
    const candidates = visiblePreNodes.length > 0 ? visiblePreNodes : preNodes;

    return candidates.find((pre) => {
      return Boolean(
        heading.compareDocumentPosition(pre) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
  }

  function findSamplePre(heading) {
    const section = heading.closest("section");

    if (section) {
      const pre = findPreAfterHeadingInContainer(heading, section);

      if (pre) {
        return pre;
      }
    }

    for (
      let element = heading.nextElementSibling;
      element;
      element = element.nextElementSibling
    ) {
      if (element.matches("pre")) {
        return element;
      }

      const pre = element.querySelector("pre");

      if (pre) {
        return pre;
      }
    }

    return null;
  }

  function parseAtCoderSampleHeading(text) {
    const normalizedText = normalizeText(text);
    const patterns = [
      { regex: /^入力例\s*(\d+)/, kind: "in" },
      { regex: /^出力例\s*(\d+)/, kind: "out" },
      { regex: /^Sample Input\s*(\d+)/i, kind: "in" },
      { regex: /^Sample Output\s*(\d+)/i, kind: "out" }
    ];

    for (const pattern of patterns) {
      const match = normalizedText.match(pattern.regex);

      if (match) {
        return {
          kind: pattern.kind,
          number: Number(match[1])
        };
      }
    }

    return null;
  }

  function getAtCoderSampleEntries() {
    const root = document.querySelector("#task-statement") || document;
    const entriesByName = new Map();
    const headings = Array.from(root.querySelectorAll("h2, h3, h4"));

    headings.forEach((heading) => {
      if (!isVisible(heading)) {
        return;
      }

      const sampleHeading = parseAtCoderSampleHeading(heading.textContent);

      if (!sampleHeading || sampleHeading.number < 1) {
        return;
      }

      const pre = findSamplePre(heading);

      if (!pre) {
        return;
      }

      const sampleIndex = sampleHeading.number - 1;
      const name = `sample-${sampleIndex}.${sampleHeading.kind}`;

      if (!entriesByName.has(name)) {
        entriesByName.set(name, {
          name,
          sampleIndex,
          kind: sampleHeading.kind,
          content: getPreText(pre)
        });
      }
    });

    return sortEntries(entriesByName);
  }

  function getYukicoderSampleEntries() {
    const samples = Array.from(document.querySelectorAll(".sample"));
    const entries = [];

    samples.forEach((sample, index) => {
      let kind = null;

      Array.from(sample.querySelectorAll("h6, pre")).forEach((element) => {
        if (element.tagName === "H6") {
          const heading = normalizeText(element.textContent);

          if (/^入力$/i.test(heading) || /^Input$/i.test(heading)) {
            kind = "in";
          } else if (/^出力$/i.test(heading) || /^Output$/i.test(heading)) {
            kind = "out";
          } else {
            kind = null;
          }

          return;
        }

        if (element.tagName === "PRE" && kind) {
          entries.push({
            name: `sample-${index}.${kind}`,
            sampleIndex: index,
            kind,
            content: getPreText(element)
          });
          kind = null;
        }
      });
    });

    return sortEntries(new Map(entries.map((entry) => [entry.name, entry])));
  }

  function getAojSampleEntries() {
    const root =
      document.querySelector("#problemStatement") ||
      document.querySelector(".description") ||
      document.querySelector("#content") ||
      document;
    const entriesByName = new Map();
    const headings = Array.from(root.querySelectorAll("h2, h3, h4"));

    headings.forEach((heading) => {
      if (!isVisible(heading)) {
        return;
      }

      const text = normalizeText(heading.textContent);
      const match = text.match(/^Sample (Input|Output)\s*(\d+)/i);

      if (!match) {
        return;
      }

      const pre = findSamplePre(heading);

      if (!pre) {
        return;
      }

      const sampleIndex = Number(match[2]) - 1;
      const kind = match[1].toLowerCase() === "input" ? "in" : "out";
      const name = `sample-${sampleIndex}.${kind}`;

      if (!entriesByName.has(name)) {
        entriesByName.set(name, {
          name,
          sampleIndex,
          kind,
          content: getPreText(pre)
        });
      }
    });

    return sortEntries(entriesByName);
  }

  function sortEntries(entriesByName) {
    return Array.from(entriesByName.values())
      .sort((left, right) => {
        if (left.sampleIndex !== right.sampleIndex) {
          return left.sampleIndex - right.sampleIndex;
        }

        return left.kind === "in" ? -1 : 1;
      })
      .map((entry) => ({
        name: entry.name,
        content: entry.content
      }));
  }

  const SITE_CONFIGS = [
    {
      name: "atcoder",
      matches: () =>
        /(^|\.)atcoder\.jp$/.test(location.hostname) &&
        /\/tasks\//.test(location.pathname),
      findTitle: () =>
        document.querySelector(
          "#main-div .row > div > .h2, #main-div h2, .row > div > .h2, h2"
        ),
      getProblemName: () => {
        const pathParts = location.pathname.split("/").filter(Boolean);
        return sanitizeFilename(
          pathParts[pathParts.length - 1],
          "atcoder-samples"
        );
      },
      getSampleEntries: getAtCoderSampleEntries
    },
    {
      name: "aoj",
      matches: () =>
        /(^|\.)(onlinejudge|judge)\.u-aizu\.ac\.jp$/.test(location.hostname) &&
        (/\/problems\//.test(location.pathname) ||
          /description\.jsp/.test(location.pathname)),
      findTitle: () =>
        document.querySelector(
          "#problemTitle, h1.title, .problem-title, main h1, #content h1"
        ),
      getProblemName: () => {
        const pageTitle = normalizeText(
          getElementText(
            document.querySelector("#problemTitle, h1.title, .problem-title")
          )
        );

        if (pageTitle) {
          return sanitizeFilename(pageTitle, "aoj-samples");
        }

        const pathParts = location.pathname.split("/").filter(Boolean);
        return sanitizeFilename(pathParts[pathParts.length - 1], "aoj-samples");
      },
      getSampleEntries: getAojSampleEntries
    },
    {
      name: "yukicoder",
      matches: () =>
        /(^|\.)yukicoder\.me$/.test(location.hostname) &&
        /\/problems\//.test(location.pathname),
      findTitle: () => document.querySelector("#content > h3, #content h3"),
      getProblemName: () => {
        const pageTitle = normalizeText(
          getElementText(document.querySelector("#content > h3, #content h3"))
        );

        if (pageTitle) {
          return sanitizeFilename(pageTitle, "yukicoder-samples");
        }

        const pathParts = location.pathname.split("/").filter(Boolean);
        return sanitizeFilename(
          pathParts.slice(-2).join("-"),
          "yukicoder-samples"
        );
      },
      getSampleEntries: getYukicoderSampleEntries
    }
  ];

  function getSiteConfig() {
    return SITE_CONFIGS.find((config) => config.matches()) || null;
  }

  function createCrc32Table() {
    const table = new Uint32Array(256);

    for (let i = 0; i < table.length; i += 1) {
      let value = i;

      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }

      table[i] = value >>> 0;
    }

    return table;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;

    for (const byte of bytes) {
      crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }

    return (crc ^ 0xffffffff) >>> 0;
  }

  function createZipHeader(size) {
    const bytes = new Uint8Array(size);
    const view = new DataView(bytes.buffer);

    return { bytes, view };
  }

  function setBytes(target, offset, source) {
    target.set(source, offset);
  }

  function createZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const entry of entries) {
      const nameBytes = textEncoder.encode(entry.name);
      const dataBytes = textEncoder.encode(entry.content);
      const checksum = crc32(dataBytes);

      const local = createZipHeader(30 + nameBytes.length);
      local.view.setUint32(0, 0x04034b50, true);
      local.view.setUint16(4, 20, true);
      local.view.setUint16(6, 0x0800, true);
      local.view.setUint16(8, 0, true);
      local.view.setUint16(10, 0, true);
      local.view.setUint16(12, 0, true);
      local.view.setUint32(14, checksum, true);
      local.view.setUint32(18, dataBytes.length, true);
      local.view.setUint32(22, dataBytes.length, true);
      local.view.setUint16(26, nameBytes.length, true);
      local.view.setUint16(28, 0, true);
      setBytes(local.bytes, 30, nameBytes);

      localParts.push(local.bytes, dataBytes);

      const central = createZipHeader(46 + nameBytes.length);
      central.view.setUint32(0, 0x02014b50, true);
      central.view.setUint16(4, 20, true);
      central.view.setUint16(6, 20, true);
      central.view.setUint16(8, 0x0800, true);
      central.view.setUint16(10, 0, true);
      central.view.setUint16(12, 0, true);
      central.view.setUint16(14, 0, true);
      central.view.setUint32(16, checksum, true);
      central.view.setUint32(20, dataBytes.length, true);
      central.view.setUint32(24, dataBytes.length, true);
      central.view.setUint16(28, nameBytes.length, true);
      central.view.setUint16(30, 0, true);
      central.view.setUint16(32, 0, true);
      central.view.setUint16(34, 0, true);
      central.view.setUint16(36, 0, true);
      central.view.setUint32(38, 0, true);
      central.view.setUint32(42, offset, true);
      setBytes(central.bytes, 46, nameBytes);

      centralParts.push(central.bytes);
      offset += local.bytes.length + dataBytes.length;
    }

    const centralOffset = offset;
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = createZipHeader(22);
    end.view.setUint32(0, 0x06054b50, true);
    end.view.setUint16(4, 0, true);
    end.view.setUint16(6, 0, true);
    end.view.setUint16(8, entries.length, true);
    end.view.setUint16(10, entries.length, true);
    end.view.setUint32(12, centralSize, true);
    end.view.setUint32(16, centralOffset, true);
    end.view.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, end.bytes], {
      type: "application/zip"
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 1000);
  }

  function setTemporaryLabel(button, label) {
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = BUTTON_LABEL;
      button.disabled = false;
    }, 1200);
  }

  function createButton(siteConfig) {
    const button = document.createElement("button");
    button.id = ROOT_ID;
    button.type = "button";
    button.className = "cp-sample-downloader";
    button.textContent = BUTTON_LABEL;
    button.addEventListener("click", () => {
      button.disabled = true;

      try {
        const entries = siteConfig.getSampleEntries();

        if (entries.length === 0) {
          setTemporaryLabel(button, EMPTY_LABEL);
          return;
        }

        downloadBlob(createZip(entries), `${siteConfig.getProblemName()}.zip`);
        setTemporaryLabel(button, DOWNLOADED_LABEL);
      } catch (error) {
        console.error("[CP Sample Downloader]", siteConfig.name, error);
        setTemporaryLabel(button, FAILED_LABEL);
      }
    });

    return button;
  }

  function inject(siteConfig) {
    if (document.getElementById(ROOT_ID)) {
      return true;
    }

    const title = siteConfig.findTitle();

    if (!title) {
      return false;
    }

    title.appendChild(createButton(siteConfig));
    return true;
  }

  const siteConfig = getSiteConfig();

  if (!siteConfig) {
    return;
  }

  if (!inject(siteConfig)) {
    const observer = new MutationObserver(() => {
      if (inject(siteConfig)) {
        observer.disconnect();
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });

    window.setTimeout(() => observer.disconnect(), 15000);
  }
})();
