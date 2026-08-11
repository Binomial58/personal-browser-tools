(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const BUTTON_LABEL = "📊 図で見る";
  const MAX_POINTS = 2000;
  const MAX_GRAPH_NODES = 300;
  const MAX_GRAPH_EDGES = 2000;
  const VIEW_SIZE = 360;
  const PAD = 36;

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

  // ---- graph structural analysis, for the checklist ----

  function analyzeGraph(n, edges, zeroIndexed) {
    const lo = zeroIndexed ? 0 : 1;
    const idx = (v) => v - lo;

    const selfLoops = edges.filter((e) => e.u === e.v).length;

    const pairCounts = new Map();
    edges.forEach((e) => {
      if (e.u === e.v) {
        return;
      }

      const a = Math.min(e.u, e.v);
      const b = Math.max(e.u, e.v);
      const key = `${a}-${b}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    });
    const multiEdgeGroups = Array.from(pairCounts.values()).filter(
      (count) => count > 1
    ).length;

    // Union-Find for connected components + a plain cycle flag.
    const parent = Array.from({ length: n }, (_, i) => i);

    function find(x) {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    }

    let hasCycle = selfLoops > 0 || multiEdgeGroups > 0;

    edges.forEach((e) => {
      if (e.u === e.v) {
        return;
      }

      const a = find(idx(e.u));
      const b = find(idx(e.v));

      if (a === b) {
        hasCycle = true;
      } else {
        parent[a] = b;
      }
    });

    const roots = new Set();
    for (let i = 0; i < n; i += 1) {
      roots.add(find(i));
    }
    const componentCount = roots.size;
    const connected = componentCount === 1;
    const isTree = connected && !hasCycle && edges.length === n - 1;

    // Bipartite check (2-coloring via BFS). A self-loop always breaks it.
    const adjacency = Array.from({ length: n }, () => []);
    edges.forEach((e) => {
      if (e.u === e.v) {
        return;
      }

      adjacency[idx(e.u)].push(idx(e.v));
      adjacency[idx(e.v)].push(idx(e.u));
    });

    let bipartite = selfLoops === 0;
    const color = new Array(n).fill(-1);

    for (let start = 0; start < n && bipartite; start += 1) {
      if (color[start] !== -1) {
        continue;
      }

      color[start] = 0;
      const queue = [start];

      while (queue.length > 0 && bipartite) {
        const u = queue.shift();

        for (const v of adjacency[u]) {
          if (color[v] === -1) {
            color[v] = color[u] ^ 1;
            queue.push(v);
          } else if (color[v] === color[u]) {
            bipartite = false;
            break;
          }
        }
      }
    }

    return {
      n,
      m: edges.length,
      selfLoops,
      multiEdgeGroups,
      connected,
      componentCount,
      hasCycle,
      isTree,
      bipartite
    };
  }

  // ---- "nice" grid step (1/2/5 * 10^k), like a chart library would pick ----

  function niceStep(range) {
    if (!(range > 0)) {
      return 1;
    }

    const rough = range / 5;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
    const residual = rough / magnitude;

    if (residual > 5) {
      return 10 * magnitude;
    }
    if (residual > 2) {
      return 5 * magnitude;
    }
    if (residual > 1) {
      return 2 * magnitude;
    }
    return magnitude;
  }

  function formatTick(value) {
    const rounded = Math.round(value * 1e6) / 1e6;
    return String(rounded);
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

  function renderCaption(text) {
    const caption = document.createElement("p");
    caption.className = "asv-caption";
    caption.textContent = text;
    return caption;
  }

  function renderGrid(toSvgX, toSvgY, minX, maxX, minY, maxY, flipY) {
    const group = document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", "asv-grid");

    const stepX = niceStep(maxX - minX);
    const startX = Math.ceil(minX / stepX) * stepX;

    for (let gx = startX; gx <= maxX + stepX * 1e-6; gx += stepX) {
      const x = toSvgX(gx);

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", x);
      line.setAttribute("y1", PAD);
      line.setAttribute("x2", x);
      line.setAttribute("y2", VIEW_SIZE - PAD);
      line.setAttribute("class", "asv-grid-line");
      group.appendChild(line);

      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", x);
      label.setAttribute("y", VIEW_SIZE - PAD + 14);
      label.setAttribute("class", "asv-tick-label");
      label.setAttribute("text-anchor", "middle");
      label.textContent = formatTick(gx);
      group.appendChild(label);
    }

    const stepY = niceStep(maxY - minY);
    const startY = Math.ceil(minY / stepY) * stepY;

    for (let gy = startY; gy <= maxY + stepY * 1e-6; gy += stepY) {
      const y = toSvgY(gy);

      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", PAD);
      line.setAttribute("y1", y);
      line.setAttribute("x2", VIEW_SIZE - PAD);
      line.setAttribute("y2", y);
      line.setAttribute("class", "asv-grid-line");
      group.appendChild(line);

      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", PAD - 6);
      label.setAttribute("y", y);
      label.setAttribute("class", "asv-tick-label asv-tick-label--y");
      label.setAttribute("text-anchor", "end");
      label.setAttribute("dominant-baseline", "middle");
      label.textContent = formatTick(gy);
      group.appendChild(label);
    }

    return group;
  }

  function renderPointsSvg(points) {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const { minX, maxX, minY, maxY, scale } = fitScale(xs, ys);

    const toSvgX = (x) => PAD + (x - minX) * scale;
    // Flip Y: math coordinates go up, SVG coordinates go down.
    const toSvgY = (y) => VIEW_SIZE - PAD - (y - minY) * scale;

    const wrapper = document.createElement("div");
    wrapper.appendChild(renderCaption(`点: ${points.length} 個`));

    const svg = makeSvgRoot();
    svg.appendChild(renderGrid(toSvgX, toSvgY, minX, maxX, minY, maxY, true));

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

    wrapper.appendChild(svg);
    return wrapper;
  }

  function renderChecklist(info) {
    const table = document.createElement("table");
    table.className = "asv-checklist";

    const rows = [
      ["頂点数 / 辺数", `${info.n} / ${info.m}`, null],
      [
        "連結",
        info.connected ? "はい" : `いいえ(${info.componentCount}成分)`,
        info.connected
      ],
      ["木構造", info.isTree ? "はい" : "いいえ", info.isTree],
      ["閉路", info.hasCycle ? "あり" : "なし", !info.hasCycle],
      [
        "自己ループ",
        info.selfLoops > 0 ? `あり(${info.selfLoops}本)` : "なし",
        info.selfLoops === 0
      ],
      [
        "多重辺",
        info.multiEdgeGroups > 0 ? `あり(${info.multiEdgeGroups}組)` : "なし",
        info.multiEdgeGroups === 0
      ],
      ["二部グラフ", info.bipartite ? "はい" : "いいえ", info.bipartite]
    ];

    rows.forEach(([label, value, ok]) => {
      const tr = document.createElement("tr");

      const th = document.createElement("th");
      th.textContent = label;
      tr.appendChild(th);

      const td = document.createElement("td");
      if (ok !== null) {
        const mark = document.createElement("span");
        mark.className = ok ? "asv-mark asv-mark--yes" : "asv-mark asv-mark--no";
        mark.textContent = ok ? "✓" : "×";
        td.appendChild(mark);
      }
      td.append(value);
      tr.appendChild(td);

      table.appendChild(tr);
    });

    return table;
  }

  function renderGraphSvg(n, edges, zeroIndexed) {
    const lo = zeroIndexed ? 0 : 1;
    const positions = computeForceLayout(n, edges, zeroIndexed);
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const { minX, minY, scale } = fitScale(xs, ys);

    const toSvgX = (x) => PAD + (x - minX) * scale;
    const toSvgY = (y) => PAD + (y - minY) * scale;

    const wrapper = document.createElement("div");
    wrapper.appendChild(renderCaption(`頂点数: ${n} / 辺数: ${edges.length}`));

    const svg = makeSvgRoot();
    const edgeGroup = document.createElementNS(SVG_NS, "g");

    // Count how many times each unordered pair repeats, so repeats can be
    // drawn as offset curves instead of invisibly overlapping straight lines.
    const pairCounts = new Map();
    edges.forEach((edge) => {
      if (edge.u === edge.v) {
        return;
      }

      const a = Math.min(edge.u, edge.v);
      const b = Math.max(edge.u, edge.v);
      const key = `${a}-${b}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    });
    const pairSeen = new Map();

    edges.forEach((edge) => {
      if (edge.u === edge.v) {
        const i = edge.u - lo;
        const cx = toSvgX(positions[i].x);
        const cy = toSvgY(positions[i].y);
        const r = 14;

        const loop = document.createElementNS(SVG_NS, "path");
        loop.setAttribute(
          "d",
          `M ${cx - 6} ${cy - 8} C ${cx - r - 8} ${cy - r - 14}, ${cx + r + 8} ${
            cy - r - 14
          }, ${cx + 6} ${cy - 8}`
        );
        loop.setAttribute("class", "asv-edge asv-edge--loop");

        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = `自己ループ: ${edge.u}`;
        loop.appendChild(title);
        edgeGroup.appendChild(loop);
        return;
      }

      const a = Math.min(edge.u, edge.v);
      const b = Math.max(edge.u, edge.v);
      const key = `${a}-${b}`;
      const count = pairCounts.get(key);
      const seenSoFar = pairSeen.get(key) || 0;
      pairSeen.set(key, seenSoFar + 1);

      const i = edge.u - lo;
      const j = edge.v - lo;
      const x1 = toSvgX(positions[i].x);
      const y1 = toSvgY(positions[i].y);
      const x2 = toSvgX(positions[j].x);
      const y2 = toSvgY(positions[j].y);

      let el;

      if (count > 1) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const side = seenSoFar % 2 === 0 ? 1 : -1;
        const magnitude = 10 * (Math.floor(seenSoFar / 2) + 1);
        const cxp = mx + nx * magnitude * side;
        const cyp = my + ny * magnitude * side;

        el = document.createElementNS(SVG_NS, "path");
        el.setAttribute("d", `M ${x1} ${y1} Q ${cxp} ${cyp} ${x2} ${y2}`);
        el.setAttribute("class", "asv-edge asv-edge--multi");
      } else {
        el = document.createElementNS(SVG_NS, "line");
        el.setAttribute("x1", x1);
        el.setAttribute("y1", y1);
        el.setAttribute("x2", x2);
        el.setAttribute("y2", y2);
        el.setAttribute("class", "asv-edge");
      }

      const title = document.createElementNS(SVG_NS, "title");
      title.textContent =
        edge.w !== undefined
          ? `${edge.u} - ${edge.v} (${edge.w})`
          : `${edge.u} - ${edge.v}`;
      el.appendChild(title);
      edgeGroup.appendChild(el);

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

    wrapper.appendChild(svg);
    wrapper.appendChild(renderChecklist(analyzeGraph(n, edges, zeroIndexed)));
    return wrapper;
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
