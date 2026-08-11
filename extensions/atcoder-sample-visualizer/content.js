(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const BUTTON_LABEL = "📊 図で見る";
  const MAX_POINTS = 2000;
  const MAX_GRAPH_NODES = 300;
  const MAX_GRAPH_EDGES = 2000;
  const VIEW_SIZE = 360;
  const PAD = 32;

  // ---- sample heading / <pre> discovery (mirrors the logic other
  // extensions in this repo already use to find "入力例 N" blocks) ----

  function normalizeText(text) {
    return text.replace(/\s+/g, " ").trim();
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

  function parseSampleInputHeading(text) {
    const normalized = normalizeText(text);

    if (/^入力例\s*(\d+)/.test(normalized)) {
      return true;
    }

    return /^Sample Input\s*(\d+)/i.test(normalized);
  }

  function findFollowingPre(heading) {
    const section = heading.closest("section") || heading.parentElement;

    if (!section) {
      return null;
    }

    const preNodes = Array.from(section.querySelectorAll("pre"));
    const visible = preNodes.filter(isVisible);
    const candidates = visible.length > 0 ? visible : preNodes;

    return candidates.find((pre) =>
      Boolean(heading.compareDocumentPosition(pre) & Node.DOCUMENT_POSITION_FOLLOWING)
    );
  }

  function getPreText(pre) {
    const clone = pre.cloneNode(true);
    clone
      .querySelectorAll("button, .btn, .btn-copy, script, style")
      .forEach((el) => el.remove());

    const numberedLines = Array.from(clone.querySelectorAll("ol.linenums > li"));

    if (numberedLines.length > 0) {
      return numberedLines.map((line) => line.textContent).join("\n");
    }

    return clone.textContent || "";
  }

  // ---- parsing: does this sample look like points, or a graph? ----

  function tokenizeLines(text) {
    return text
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  function parseNumbers(line) {
    const tokens = line.split(/\s+/).filter(Boolean);
    const numbers = tokens.map(Number);

    if (numbers.length === 0 || numbers.some((n) => Number.isNaN(n))) {
      return null;
    }

    return numbers;
  }

  // "N" then N lines of "X Y".
  function tryParseAsPoints(text) {
    const lines = tokenizeLines(text);

    if (lines.length < 2) {
      return null;
    }

    const first = parseNumbers(lines[0]);

    if (!first || first.length !== 1) {
      return null;
    }

    const n = first[0];

    if (!Number.isInteger(n) || n <= 0 || n > MAX_POINTS) {
      return null;
    }

    if (lines.length < 1 + n) {
      return null;
    }

    const points = [];

    for (let i = 0; i < n; i += 1) {
      const nums = parseNumbers(lines[1 + i]);

      if (!nums || nums.length !== 2) {
        return null;
      }

      points.push({ x: nums[0], y: nums[1] });
    }

    return { points };
  }

  // "N M" then M lines of "u v" or "u v w".
  function tryParseAsGraph(text) {
    const lines = tokenizeLines(text);

    if (lines.length < 1) {
      return null;
    }

    const first = parseNumbers(lines[0]);

    if (!first || first.length !== 2) {
      return null;
    }

    const [n, m] = first;

    if (
      !Number.isInteger(n) ||
      !Number.isInteger(m) ||
      n <= 0 ||
      n > MAX_GRAPH_NODES ||
      m < 0 ||
      m > MAX_GRAPH_EDGES
    ) {
      return null;
    }

    if (lines.length < 1 + m) {
      return null;
    }

    const edges = [];
    let sawZero = false;

    for (let i = 0; i < m; i += 1) {
      const nums = parseNumbers(lines[1 + i]);

      if (!nums || (nums.length !== 2 && nums.length !== 3)) {
        return null;
      }

      const [u, v, w] = nums;

      if (!Number.isInteger(u) || !Number.isInteger(v)) {
        return null;
      }

      if (u === 0 || v === 0) {
        sawZero = true;
      }

      edges.push({ u, v, w });
    }

    const zeroIndexed = sawZero;
    const lo = zeroIndexed ? 0 : 1;
    const hi = zeroIndexed ? n - 1 : n;

    for (const edge of edges) {
      if (edge.u < lo || edge.u > hi || edge.v < lo || edge.v > hi) {
        return null;
      }
    }

    return { n, edges, zeroIndexed };
  }

  // ---- force-directed layout for the graph case (no given coordinates) ----

  function computeForceLayout(n, edges, zeroIndexed) {
    const lo = zeroIndexed ? 0 : 1;
    const idx = (v) => v - lo;
    const k = 60;
    const iterations = n > 150 ? 120 : 240;

    const positions = Array.from({ length: n }, (_, i) => {
      const angle = (2 * Math.PI * i) / n;
      return { x: Math.cos(angle) * 100, y: Math.sin(angle) * 100 };
    });

    for (let iter = 0; iter < iterations; iter += 1) {
      const forces = positions.map(() => ({ x: 0, y: 0 }));

      for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
          const dx = positions[i].x - positions[j].x;
          const dy = positions[i].y - positions[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
          const force = (k * k) / dist;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          forces[i].x += fx;
          forces[i].y += fy;
          forces[j].x -= fx;
          forces[j].y -= fy;
        }
      }

      for (const edge of edges) {
        if (edge.u === edge.v) {
          continue;
        }

        const i = idx(edge.u);
        const j = idx(edge.v);
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const force = (dist * dist) / k;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        forces[i].x -= fx;
        forces[i].y -= fy;
        forces[j].x += fx;
        forces[j].y += fy;
      }

      const cooling = 1 - iter / iterations;

      for (let i = 0; i < n; i += 1) {
        positions[i].x += forces[i].x * 0.02 * cooling;
        positions[i].y += forces[i].y * 0.02 * cooling;
      }
    }

    return positions;
  }

  // ---- SVG rendering ----

  function makeSvgRoot() {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`);
    svg.setAttribute("class", "asv-svg");
    svg.setAttribute("role", "img");
    return svg;
  }

  function fitScale(xs, ys) {
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    if (minX === maxX) {
      minX -= 1;
      maxX += 1;
    }

    if (minY === maxY) {
      minY -= 1;
      maxY += 1;
    }

    const scale = Math.min(
      (VIEW_SIZE - 2 * PAD) / (maxX - minX),
      (VIEW_SIZE - 2 * PAD) / (maxY - minY)
    );

    return { minX, maxX, minY, maxY, scale };
  }

  function renderPointsSvg(points) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const { minX, minY, scale } = fitScale(xs, ys);

    const toSvgX = (x) => PAD + (x - minX) * scale;
    // Flip Y: math coordinates go up, SVG coordinates go down.
    const toSvgY = (y) => VIEW_SIZE - PAD - (y - minY) * scale;

    const svg = makeSvgRoot();

    const frame = document.createElementNS(SVG_NS, "rect");
    frame.setAttribute("x", PAD);
    frame.setAttribute("y", PAD);
    frame.setAttribute("width", VIEW_SIZE - 2 * PAD);
    frame.setAttribute("height", VIEW_SIZE - 2 * PAD);
    frame.setAttribute("class", "asv-frame");
    svg.appendChild(frame);

    points.forEach((p, i) => {
      const cx = toSvgX(p.x);
      const cy = toSvgY(p.y);

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", 5);
      circle.setAttribute("class", "asv-point");

      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = `P${i + 1} (${p.x}, ${p.y})`;
      circle.appendChild(title);
      svg.appendChild(circle);

      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", cx + 8);
      label.setAttribute("y", cy - 8);
      label.setAttribute("class", "asv-label");
      label.textContent = `P${i + 1}`;
      svg.appendChild(label);
    });

    return svg;
  }

  function renderGraphSvg(n, edges, zeroIndexed) {
    const lo = zeroIndexed ? 0 : 1;
    const positions = computeForceLayout(n, edges, zeroIndexed);
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const { minX, minY, scale } = fitScale(xs, ys);

    const toSvgX = (x) => PAD + (x - minX) * scale;
    const toSvgY = (y) => PAD + (y - minY) * scale;

    const svg = makeSvgRoot();
    const edgeGroup = document.createElementNS(SVG_NS, "g");

    edges.forEach((edge) => {
      if (edge.u === edge.v) {
        return;
      }

      const i = edge.u - lo;
      const j = edge.v - lo;
      const x1 = toSvgX(positions[i].x);
      const y1 = toSvgY(positions[i].y);
      const x2 = toSvgX(positions[j].x);
      const y2 = toSvgY(positions[j].y);

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("class", "asv-edge");

      const title = document.createElementNS(SVG_NS, "title");
      title.textContent =
        edge.w !== undefined
          ? `${edge.u} - ${edge.v} (${edge.w})`
          : `${edge.u} - ${edge.v}`;
      line.appendChild(title);
      edgeGroup.appendChild(line);

      if (edge.w !== undefined) {
        const label = document.createElementNS(SVG_NS, "text");
        label.setAttribute("x", (x1 + x2) / 2);
        label.setAttribute("y", (y1 + y2) / 2);
        label.setAttribute("class", "asv-weight");
        label.textContent = String(edge.w);
        edgeGroup.appendChild(label);
      }
    });

    svg.appendChild(edgeGroup);

    for (let i = 0; i < n; i += 1) {
      const cx = toSvgX(positions[i].x);
      const cy = toSvgY(positions[i].y);

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", 10);
      circle.setAttribute("class", "asv-node");

      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = `${i + lo}`;
      circle.appendChild(title);
      svg.appendChild(circle);

      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", cx);
      label.setAttribute("y", cy);
      label.setAttribute("class", "asv-node-label");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "central");
      label.textContent = String(i + lo);
      svg.appendChild(label);
    }

    return svg;
  }

  // ---- wiring a toggle button + panel onto each matching sample ----

  function injectButton(heading, pre, render) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "asv-toggle-button";
    button.textContent = BUTTON_LABEL;

    const panel = document.createElement("div");
    panel.className = "asv-panel";
    panel.hidden = true;

    let rendered = false;

    button.addEventListener("click", () => {
      panel.hidden = !panel.hidden;

      if (!panel.hidden && !rendered) {
        rendered = true;

        try {
          panel.appendChild(render());
        } catch (error) {
          console.warn("[AtCoder Sample Visualizer]", error);
          panel.textContent = "描画に失敗しました。";
        }
      }
    });

    heading.append(" ", button);
    pre.insertAdjacentElement("afterend", panel);
  }

  function processHeading(heading) {
    if (heading.dataset.asvProcessed) {
      return;
    }

    heading.dataset.asvProcessed = "true";

    if (!isVisible(heading) || !parseSampleInputHeading(heading.textContent)) {
      return;
    }

    const pre = findFollowingPre(heading);

    if (!pre) {
      return;
    }

    const text = getPreText(pre);
    const asPoints = tryParseAsPoints(text);

    if (asPoints) {
      injectButton(heading, pre, () => renderPointsSvg(asPoints.points));
      return;
    }

    const asGraph = tryParseAsGraph(text);

    if (asGraph) {
      injectButton(heading, pre, () =>
        renderGraphSvg(asGraph.n, asGraph.edges, asGraph.zeroIndexed)
      );
    }
  }

  function main() {
    const root = document.querySelector("#task-statement") || document;
    const headings = Array.from(root.querySelectorAll("h2, h3, h4"));
    headings.forEach(processHeading);
  }

  main();
})();
