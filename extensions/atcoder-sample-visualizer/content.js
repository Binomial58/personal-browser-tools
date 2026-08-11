(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const BUTTON_LABEL = "📊 図で見る";
  const MAX_POINTS = 2000;
  const MAX_GRAPH_NODES = 300;
  const MAX_GRAPH_EDGES = 2000;
  const MAX_GRID_CELLS = 3000;
  const VIEW_SIZE = 360;
  const PAD = 36;
  const CATEGORICAL_COLORS = [
    "#2a78d6",
    "#eb6834",
    "#1baf7a",
    "#eda100",
    "#e87ba4",
    "#008300",
    "#4a3aa7",
    "#e34948"
  ];

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

  // ---- parsing: does this sample look like points, a graph, or a grid? ----

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

  // "H W" then H lines, each a string of exactly W characters.
  function tryParseAsGrid(text) {
    const lines = tokenizeLines(text);

    if (lines.length < 1) {
      return null;
    }

    const first = parseNumbers(lines[0]);

    if (!first || first.length !== 2) {
      return null;
    }

    const [h, w] = first;

    if (
      !Number.isInteger(h) ||
      !Number.isInteger(w) ||
      h <= 0 ||
      w <= 0 ||
      h * w > MAX_GRID_CELLS
    ) {
      return null;
    }

    if (lines.length < 1 + h) {
      return null;
    }

    const rows = [];

    for (let i = 0; i < h; i += 1) {
      const row = lines[1 + i];

      if (row.length !== w || /\s/.test(row)) {
        return null;
      }

      rows.push(row);
    }

    return { h, w, rows };
  }

  // ---- graph structural analysis, for the checklist + layout choice ----

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
      bipartite,
      adjacency
    };
  }

  // ---- grid maze analysis: BFS shortest path + connected components.
  // '#' is always a wall; every other character is treated as walkable,
  // since we can't know a problem-specific meaning for other symbols. ----

  const GRID_DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1]
  ];

  function isGridWalkable(ch) {
    return ch !== "#";
  }

  function bfsGridPath(rows, h, w, start, goal) {
    const dist = Array.from({ length: h }, () => new Array(w).fill(-1));
    const prev = Array.from({ length: h }, () => new Array(w).fill(null));
    dist[start.r][start.c] = 0;

    const queue = [start];
    let head = 0;

    while (head < queue.length) {
      const cur = queue[head];
      head += 1;

      if (cur.r === goal.r && cur.c === goal.c) {
        break;
      }

      for (const [dr, dc] of GRID_DIRS) {
        const nr = cur.r + dr;
        const nc = cur.c + dc;

        if (nr < 0 || nr >= h || nc < 0 || nc >= w) {
          continue;
        }
        if (!isGridWalkable(rows[nr][nc]) || dist[nr][nc] !== -1) {
          continue;
        }

        dist[nr][nc] = dist[cur.r][cur.c] + 1;
        prev[nr][nc] = cur;
        queue.push({ r: nr, c: nc });
      }
    }

    if (dist[goal.r][goal.c] === -1) {
      return { reachable: false };
    }

    const path = [];
    let node = goal;
    while (node) {
      path.push(node);
      node = prev[node.r][node.c];
    }
    path.reverse();

    return { reachable: true, distance: dist[goal.r][goal.c], path };
  }

  function computeGridComponents(rows, h, w) {
    const comp = Array.from({ length: h }, () => new Array(w).fill(-1));
    let count = 0;

    for (let r = 0; r < h; r += 1) {
      for (let c = 0; c < w; c += 1) {
        if (!isGridWalkable(rows[r][c]) || comp[r][c] !== -1) {
          continue;
        }

        const queue = [{ r, c }];
        comp[r][c] = count;
        let head = 0;

        while (head < queue.length) {
          const cur = queue[head];
          head += 1;

          for (const [dr, dc] of GRID_DIRS) {
            const nr = cur.r + dr;
            const nc = cur.c + dc;

            if (nr < 0 || nr >= h || nc < 0 || nc >= w) {
              continue;
            }
            if (!isGridWalkable(rows[nr][nc]) || comp[nr][nc] !== -1) {
              continue;
            }

            comp[nr][nc] = count;
            queue.push({ r: nr, c: nc });
          }
        }

        count += 1;
      }
    }

    return { comp, count };
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

  // ---- layouts ----

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

  // Rooted, top-down layout used when the sample is a tree: much more
  // readable than a generic force layout for tree DP / LCA style problems.
  function computeTreeLayout(n, adjacency) {
    const positions = new Array(n);
    const xSpacing = 42;
    const ySpacing = 56;
    let nextLeafSlot = 0;

    function place(node, parent, depth) {
      const children = adjacency[node].filter((c) => c !== parent);

      if (children.length === 0) {
        positions[node] = { x: nextLeafSlot * xSpacing, y: depth * ySpacing };
        nextLeafSlot += 1;
        return positions[node].x;
      }

      const childXs = children.map((c) => place(c, node, depth + 1));
      const x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
      positions[node] = { x, y: depth * ySpacing };
      return x;
    }

    place(0, -1, 0);
    return positions;
  }

  // ---- SVG rendering helpers ----

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

  function renderGrid(toSvgX, toSvgY, minX, maxX, minY, maxY) {
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

  function makeControlsRow() {
    const controls = document.createElement("div");
    controls.className = "asv-controls";
    return controls;
  }

  function makeCheckboxControl(labelText) {
    const label = document.createElement("label");
    label.className = "asv-toggle-label";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    label.append(checkbox, ` ${labelText}`);
    return { label, checkbox };
  }

  function makeButtonControl(labelText) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "asv-clear-button";
    button.textContent = labelText;
    return button;
  }

  // ---- points (with click-to-connect distance/angle) ----

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function angleAtVertex(a, b, c) {
    const v1x = a.x - b.x;
    const v1y = a.y - b.y;
    const v2x = c.x - b.x;
    const v2y = c.y - b.y;
    const mag1 = Math.hypot(v1x, v1y);
    const mag2 = Math.hypot(v2x, v2y);

    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }

    const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / (mag1 * mag2)));
    return (Math.acos(cos) * 180) / Math.PI;
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

    const controls = makeControlsRow();
    const { label: polygonLabel, checkbox: polygonCheckbox } = makeCheckboxControl(
      "順番につなぐ(多角形)"
    );
    const clearButton = makeButtonControl("選択をクリア");
    controls.append(polygonLabel, clearButton);
    wrapper.appendChild(controls);

    const info = document.createElement("p");
    info.className = "asv-info";
    info.textContent = "点を2つか3つクリックすると、距離や角度を表示します。";
    wrapper.appendChild(info);

    const svg = makeSvgRoot();
    svg.appendChild(renderGrid(toSvgX, toSvgY, minX, maxX, minY, maxY));

    const frame = document.createElementNS(SVG_NS, "rect");
    frame.setAttribute("x", PAD);
    frame.setAttribute("y", PAD);
    frame.setAttribute("width", VIEW_SIZE - 2 * PAD);
    frame.setAttribute("height", VIEW_SIZE - 2 * PAD);
    frame.setAttribute("class", "asv-frame");
    svg.appendChild(frame);

    const connectionGroup = document.createElementNS(SVG_NS, "g");
    svg.appendChild(connectionGroup);

    const pointGroup = document.createElementNS(SVG_NS, "g");
    let selected = [];

    function redraw() {
      connectionGroup.textContent = "";

      if (polygonCheckbox.checked && points.length >= 2) {
        for (let i = 0; i < points.length; i += 1) {
          const a = points[i];
          const b = points[(i + 1) % points.length];
          const line = document.createElementNS(SVG_NS, "line");
          line.setAttribute("x1", toSvgX(a.x));
          line.setAttribute("y1", toSvgY(a.y));
          line.setAttribute("x2", toSvgX(b.x));
          line.setAttribute("y2", toSvgY(b.y));
          line.setAttribute("class", "asv-polygon-edge");
          connectionGroup.appendChild(line);
        }
      }

      for (let i = 0; i < selected.length - 1; i += 1) {
        const a = points[selected[i]];
        const b = points[selected[i + 1]];
        const line = document.createElementNS(SVG_NS, "line");
        line.setAttribute("x1", toSvgX(a.x));
        line.setAttribute("y1", toSvgY(a.y));
        line.setAttribute("x2", toSvgX(b.x));
        line.setAttribute("y2", toSvgY(b.y));
        line.setAttribute("class", "asv-connect-edge");
        connectionGroup.appendChild(line);
      }

      if (selected.length === 2) {
        const [ia, ib] = selected;
        info.textContent = `P${ia + 1} - P${ib + 1} の距離: ${distance(
          points[ia],
          points[ib]
        ).toFixed(4)}`;
      } else if (selected.length === 3) {
        const [ia, ib, ic] = selected;
        info.textContent = `∠P${ia + 1}P${ib + 1}P${ic + 1} = ${angleAtVertex(
          points[ia],
          points[ib],
          points[ic]
        ).toFixed(4)}°`;
      } else {
        info.textContent = "点を2つか3つクリックすると、距離や角度を表示します。";
      }

      pointGroup.querySelectorAll(".asv-point").forEach((circle) => {
        const i = Number(circle.dataset.index);
        circle.classList.toggle("asv-point--selected", selected.includes(i));
      });
    }

    points.forEach((p, i) => {
      const cx = toSvgX(p.x);
      const cy = toSvgY(p.y);

      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", 5);
      circle.setAttribute("class", "asv-point");
      circle.dataset.index = String(i);

      const title = document.createElementNS(SVG_NS, "title");
      title.textContent = `P${i + 1} (${p.x}, ${p.y})`;
      circle.appendChild(title);

      circle.addEventListener("click", () => {
        const pos = selected.indexOf(i);

        if (pos !== -1) {
          selected.splice(pos, 1);
        } else {
          selected.push(i);
          if (selected.length > 3) {
            selected.shift();
          }
        }

        redraw();
      });

      pointGroup.appendChild(circle);

      const label = document.createElementNS(SVG_NS, "text");
      label.setAttribute("x", cx + 8);
      label.setAttribute("y", cy - 8);
      label.setAttribute("class", "asv-label");
      label.textContent = `P${i + 1}`;
      pointGroup.appendChild(label);
    });

    svg.appendChild(pointGroup);

    polygonCheckbox.addEventListener("change", redraw);
    clearButton.addEventListener("click", () => {
      selected = [];
      redraw();
    });

    wrapper.appendChild(svg);
    return wrapper;
  }

  // ---- graph (force or tree layout, directed toggle, hover highlight) ----

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

  function renderGraphSvg(n, edges, zeroIndexed, graphInfo) {
    const lo = zeroIndexed ? 0 : 1;
    const positions = graphInfo.isTree
      ? computeTreeLayout(n, graphInfo.adjacency)
      : computeForceLayout(n, edges, zeroIndexed);
    const xs = positions.map((p) => p.x);
    const ys = positions.map((p) => p.y);
    const { minX, minY, scale } = fitScale(xs, ys);

    const toSvgX = (x) => PAD + (x - minX) * scale;
    const toSvgY = (y) => PAD + (y - minY) * scale;

    const wrapper = document.createElement("div");
    wrapper.appendChild(
      renderCaption(
        `頂点数: ${n} / 辺数: ${edges.length}${
          graphInfo.isTree ? "(木構造として階層表示)" : ""
        }`
      )
    );

    const controls = makeControlsRow();
    const { label: directedLabel, checkbox: directedCheckbox } = makeCheckboxControl(
      "有向として表示"
    );
    controls.append(directedLabel);
    wrapper.appendChild(controls);

    const svg = makeSvgRoot();

    const defs = document.createElementNS(SVG_NS, "defs");
    const marker = document.createElementNS(SVG_NS, "marker");
    marker.setAttribute("id", "asv-arrowhead");
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");
    const arrowShape = document.createElementNS(SVG_NS, "path");
    arrowShape.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    arrowShape.setAttribute("class", "asv-arrowhead");
    marker.appendChild(arrowShape);
    defs.appendChild(marker);
    svg.appendChild(defs);

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

    let bodyGroup = null;

    function build() {
      if (bodyGroup) {
        bodyGroup.remove();
      }

      bodyGroup = document.createElementNS(SVG_NS, "g");
      const edgeGroup = document.createElementNS(SVG_NS, "g");
      const nodeGroup = document.createElementNS(SVG_NS, "g");
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
          loop.dataset.a = String(i);
          loop.dataset.b = String(i);

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

        el.dataset.a = String(i);
        el.dataset.b = String(j);

        if (directedCheckbox.checked) {
          el.setAttribute("marker-end", "url(#asv-arrowhead)");
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

      for (let i = 0; i < n; i += 1) {
        const cx = toSvgX(positions[i].x);
        const cy = toSvgY(positions[i].y);

        const nodeWrap = document.createElementNS(SVG_NS, "g");
        nodeWrap.setAttribute("class", "asv-node-wrap");
        nodeWrap.dataset.index = String(i);

        const circle = document.createElementNS(SVG_NS, "circle");
        circle.setAttribute("cx", cx);
        circle.setAttribute("cy", cy);
        circle.setAttribute("r", 10);
        circle.setAttribute("class", "asv-node");

        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = `${i + lo}`;
        circle.appendChild(title);
        nodeWrap.appendChild(circle);

        const label = document.createElementNS(SVG_NS, "text");
        label.setAttribute("x", cx);
        label.setAttribute("y", cy);
        label.setAttribute("class", "asv-node-label");
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("dominant-baseline", "central");
        label.textContent = String(i + lo);
        nodeWrap.appendChild(label);

        nodeWrap.addEventListener("mouseenter", () => {
          const relatedEdges = Array.from(
            edgeGroup.querySelectorAll(`[data-a="${i}"], [data-b="${i}"]`)
          );
          const relatedNodes = new Set([i]);
          relatedEdges.forEach((e) => {
            relatedNodes.add(Number(e.dataset.a));
            relatedNodes.add(Number(e.dataset.b));
          });

          edgeGroup.querySelectorAll(".asv-edge").forEach((e) => {
            const active = relatedEdges.includes(e);
            e.classList.toggle("asv-edge--active", active);
            e.classList.toggle("asv-edge--dim", !active);
          });
          nodeGroup.querySelectorAll(".asv-node-wrap").forEach((w) => {
            w.classList.toggle(
              "asv-node--dim",
              !relatedNodes.has(Number(w.dataset.index))
            );
          });
        });

        nodeWrap.addEventListener("mouseleave", () => {
          edgeGroup
            .querySelectorAll(".asv-edge--active, .asv-edge--dim")
            .forEach((e) => e.classList.remove("asv-edge--active", "asv-edge--dim"));
          nodeGroup
            .querySelectorAll(".asv-node--dim")
            .forEach((w) => w.classList.remove("asv-node--dim"));
        });

        nodeGroup.appendChild(nodeWrap);
      }

      bodyGroup.append(edgeGroup, nodeGroup);
      svg.appendChild(bodyGroup);
    }

    build();
    directedCheckbox.addEventListener("change", build);

    wrapper.appendChild(svg);
    wrapper.appendChild(renderChecklist(graphInfo));
    return wrapper;
  }

  // ---- grid / maze ----

  const PAINT_COLORS = [
    "#2a78d6",
    "#eb6834",
    "#1baf7a",
    "#eda100",
    "#e87ba4",
    "#4a3aa7"
  ];

  function renderGridSvg(h, w, rows) {
    const wrapper = document.createElement("div");
    wrapper.appendChild(renderCaption(`グリッド: ${h} 行 × ${w} 列`));

    const cellSize = Math.min(
      (VIEW_SIZE - 2 * PAD) / w,
      (VIEW_SIZE - 2 * PAD) / h
    );
    const totalW = cellSize * w;
    const totalH = cellSize * h;
    const offsetX = (VIEW_SIZE - totalW) / 2;
    const offsetY = (VIEW_SIZE - totalH) / 2;

    const charOrder = [];
    const seen = new Set();
    rows.forEach((row) => {
      for (const ch of row) {
        if (!seen.has(ch)) {
          seen.add(ch);
          charOrder.push(ch);
        }
      }
    });

    const specialColors = {
      ".": "var(--asv-grid-empty)",
      "#": "var(--asv-grid-wall)"
    };
    let categoricalIndex = 0;
    const colorFor = {};
    charOrder.forEach((ch) => {
      if (specialColors[ch]) {
        colorFor[ch] = specialColors[ch];
        return;
      }
      colorFor[ch] = CATEGORICAL_COLORS[categoricalIndex % CATEGORICAL_COLORS.length];
      categoricalIndex += 1;
    });

    let mode = "paint";

    // ---- mode switch: paint (click/drag to color cells), or measure
    // (pick two walkable cells to see the wall-avoiding shortest path) ----
    const modeRow = document.createElement("div");
    modeRow.className = "asv-mode-controls";

    const paintModeBtn = document.createElement("button");
    paintModeBtn.type = "button";
    paintModeBtn.className = "asv-mode-button asv-mode-button--active";
    paintModeBtn.textContent = "🖌 塗る";

    const measureModeBtn = document.createElement("button");
    measureModeBtn.type = "button";
    measureModeBtn.className = "asv-mode-button";
    measureModeBtn.textContent = "📏 距離を測る";

    modeRow.append(paintModeBtn, measureModeBtn);
    wrapper.appendChild(modeRow);

    // ---- paint palette: click or drag across cells to mark them with the
    // selected color, as a translucent overlay so the original character
    // underneath (and its tooltip) stay intact. ----
    const paintRow = document.createElement("div");
    paintRow.className = "asv-paint-controls";

    let currentPaint = PAINT_COLORS[0];
    const swatchButtons = [];

    function selectSwatch(button, color) {
      currentPaint = color;
      swatchButtons.forEach((b) => b.classList.remove("asv-paint-swatch--active"));
      button.classList.add("asv-paint-swatch--active");
    }

    PAINT_COLORS.forEach((color, i) => {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "asv-paint-swatch";
      swatch.style.background = color;
      swatch.title = "この色で塗る";
      swatch.setAttribute("aria-label", "この色で塗る");
      swatch.addEventListener("click", () => selectSwatch(swatch, color));

      if (i === 0) {
        swatch.classList.add("asv-paint-swatch--active");
      }

      swatchButtons.push(swatch);
      paintRow.appendChild(swatch);
    });

    const eraser = document.createElement("button");
    eraser.type = "button";
    eraser.className = "asv-paint-swatch asv-paint-swatch--eraser";
    eraser.title = "消す";
    eraser.setAttribute("aria-label", "消す");
    eraser.textContent = "✕";
    eraser.addEventListener("click", () => selectSwatch(eraser, null));
    swatchButtons.push(eraser);
    paintRow.appendChild(eraser);

    const componentsButton = makeButtonControl("連結成分に色分け");
    paintRow.appendChild(componentsButton);

    const resetButton = makeButtonControl("すべて消す");
    paintRow.appendChild(resetButton);

    wrapper.appendChild(paintRow);

    const info = document.createElement("p");
    info.className = "asv-info";
    info.textContent = "マス目をドラッグすると、選択中の色で連続して塗れます。";
    wrapper.appendChild(info);

    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`);
    svg.setAttribute("class", "asv-svg");
    svg.setAttribute("role", "img");
    svg.addEventListener("dragstart", (event) => event.preventDefault());

    const overlays = [];
    const pathOverlays = [];
    const cellRects = [];

    for (let r = 0; r < h; r += 1) {
      for (let c = 0; c < w; c += 1) {
        const ch = rows[r][c];
        const x = offsetX + c * cellSize;
        const y = offsetY + r * cellSize;

        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", x);
        rect.setAttribute("y", y);
        rect.setAttribute("width", cellSize);
        rect.setAttribute("height", cellSize);
        rect.setAttribute("class", "asv-grid-cell");
        rect.style.fill = colorFor[ch];
        rect.dataset.r = String(r);
        rect.dataset.c = String(c);

        const title = document.createElementNS(SVG_NS, "title");
        title.textContent = `(${r + 1}, ${c + 1}) = '${ch}'`;
        rect.appendChild(title);

        const overlay = document.createElementNS(SVG_NS, "rect");
        overlay.setAttribute("x", x);
        overlay.setAttribute("y", y);
        overlay.setAttribute("width", cellSize);
        overlay.setAttribute("height", cellSize);
        overlay.setAttribute("class", "asv-grid-paint");
        overlay.style.fill = "none";

        const pathOverlay = document.createElementNS(SVG_NS, "rect");
        pathOverlay.setAttribute("x", x);
        pathOverlay.setAttribute("y", y);
        pathOverlay.setAttribute("width", cellSize);
        pathOverlay.setAttribute("height", cellSize);
        pathOverlay.setAttribute("class", "asv-grid-path");
        pathOverlay.style.opacity = "0";

        svg.appendChild(rect);
        svg.appendChild(overlay);
        svg.appendChild(pathOverlay);

        overlays.push(overlay);
        pathOverlays.push(pathOverlay);
        cellRects.push(rect);
      }
    }

    const overlayAt = (r, c) => overlays[r * w + c];
    const pathOverlayAt = (r, c) => pathOverlays[r * w + c];
    const cellRectAt = (r, c) => cellRects[r * w + c];

    // ---- paint mode: click or drag ----
    let isDragging = false;

    function paintAt(r, c) {
      overlayAt(r, c).style.fill = currentPaint || "none";
    }

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    resetButton.addEventListener("click", () => {
      overlays.forEach((overlay) => {
        overlay.style.fill = "none";
      });
    });

    componentsButton.addEventListener("click", () => {
      const { comp, count } = computeGridComponents(rows, h, w);

      for (let r = 0; r < h; r += 1) {
        for (let c = 0; c < w; c += 1) {
          overlayAt(r, c).style.fill =
            comp[r][c] === -1
              ? "none"
              : CATEGORICAL_COLORS[comp[r][c] % CATEGORICAL_COLORS.length];
        }
      }

      info.textContent = `連結成分(壁を除く): ${count} 個`;
    });

    // ---- measure mode: click two walkable cells for the shortest path ----
    let measureSelection = [];

    function clearPathHighlight() {
      pathOverlays.forEach((overlay) => {
        overlay.style.opacity = "0";
      });
    }

    function clearMeasureMarkers() {
      cellRects.forEach((rect) => rect.classList.remove("asv-grid-cell--selected"));
    }

    function handleMeasureClick(r, c) {
      if (!isGridWalkable(rows[r][c])) {
        info.textContent = "壁のマスは選択できません。";
        return;
      }

      if (measureSelection.length >= 2) {
        measureSelection = [];
        clearPathHighlight();
        clearMeasureMarkers();
      }

      measureSelection.push({ r, c });
      cellRectAt(r, c).classList.add("asv-grid-cell--selected");

      if (measureSelection.length === 1) {
        info.textContent = `(${r + 1}, ${c + 1}) を選択しました。2つ目のマスをクリックしてください。`;
        return;
      }

      const [start, goal] = measureSelection;
      const result = bfsGridPath(rows, h, w, start, goal);
      clearPathHighlight();

      if (!result.reachable) {
        info.textContent = `(${start.r + 1}, ${start.c + 1}) から (${goal.r + 1}, ${
          goal.c + 1
        }) へは壁に阻まれて到達できません。`;
        return;
      }

      result.path.forEach(({ r: pr, c: pc }) => {
        pathOverlayAt(pr, pc).style.opacity = "1";
      });
      info.textContent = `(${start.r + 1}, ${start.c + 1}) から (${goal.r + 1}, ${
        goal.c + 1
      }) までの最短距離: ${result.distance} 歩`;
    }

    cellRects.forEach((rect) => {
      const r = Number(rect.dataset.r);
      const c = Number(rect.dataset.c);

      rect.addEventListener("mousedown", (event) => {
        if (mode !== "paint") {
          return;
        }
        event.preventDefault();
        isDragging = true;
        paintAt(r, c);
      });

      rect.addEventListener("mouseenter", () => {
        if (mode === "paint" && isDragging) {
          paintAt(r, c);
        }
      });

      rect.addEventListener("click", () => {
        if (mode === "measure") {
          handleMeasureClick(r, c);
        }
      });
    });

    function setMode(next) {
      mode = next;
      paintModeBtn.classList.toggle("asv-mode-button--active", mode === "paint");
      measureModeBtn.classList.toggle("asv-mode-button--active", mode === "measure");
      paintRow.hidden = mode !== "paint";
      measureSelection = [];
      clearPathHighlight();
      clearMeasureMarkers();
      info.textContent =
        mode === "paint"
          ? "マス目をドラッグすると、選択中の色で連続して塗れます。"
          : "2つのマスをクリックすると、壁を避けた最短距離を表示します。";
    }

    paintModeBtn.addEventListener("click", () => setMode("paint"));
    measureModeBtn.addEventListener("click", () => setMode("measure"));

    const border = document.createElementNS(SVG_NS, "rect");
    border.setAttribute("x", offsetX);
    border.setAttribute("y", offsetY);
    border.setAttribute("width", totalW);
    border.setAttribute("height", totalH);
    border.setAttribute("class", "asv-frame");
    svg.appendChild(border);

    wrapper.appendChild(svg);

    const legend = document.createElement("div");
    legend.className = "asv-legend";
    charOrder.forEach((ch) => {
      const item = document.createElement("span");
      item.className = "asv-legend-item";
      const swatch = document.createElement("span");
      swatch.className = "asv-legend-swatch";
      swatch.style.background = colorFor[ch];
      const displayCh = ch === " " ? "(space)" : ch;
      item.append(swatch, ` ${displayCh}`);
      legend.appendChild(item);
    });
    wrapper.appendChild(legend);

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
      injectButton(heading, pre, () => {
        const info = analyzeGraph(asGraph.n, asGraph.edges, asGraph.zeroIndexed);
        return renderGraphSvg(asGraph.n, asGraph.edges, asGraph.zeroIndexed, info);
      });
      return;
    }

    const asGrid = tryParseAsGrid(text);

    if (asGrid) {
      injectButton(heading, pre, () => renderGridSvg(asGrid.h, asGrid.w, asGrid.rows));
    }
  }

  function main() {
    const root = document.querySelector("#task-statement") || document;
    const headings = Array.from(root.querySelectorAll("h2, h3, h4"));
    headings.forEach(processHeading);
  }

  main();
})();
