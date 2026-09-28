(() => {
  "use strict";
  const V = window.Validate2bi;
  const D = window.Delivery2bi;
  const DELIVERY_TAB = "#leveranse";  // kan ikkje kollidere med eit filnamn, sidan filene må slutte på .xml
  const $ = (id) => document.getElementById(id);
  const files = new Map();        // namn -> tekst, i innlasta rekkjefølgje
  let result = null, delivery = null, current = null, ruleFilter = null, cursor = -1;
  let objFilter = "", unusedOnly = false;

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------------------------------------------------------------- innlasting
  async function addFiles(list) {
    for (const f of list) {
      if (!/\.xml$/i.test(f.name) && !/xml/.test(f.type)) continue;
      files.set(f.name, await f.text());
      if (!current) current = f.name;
    }
    run();
  }
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault(); drop.classList.add("over");
  }));
  ["dragleave", "drop"].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === "drop" || e.target === document.documentElement || !e.relatedTarget) drop.classList.remove("over");
  }));
  document.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files.length) addFiles([...e.dataTransfer.files]); });
  $("picker").addEventListener("change", (e) => { addFiles([...e.target.files]); e.target.value = ""; });
  $("clear").addEventListener("click", () => { files.clear(); current = null; ruleFilter = null; run(); });
  $("showWarn").addEventListener("change", () => render());

  // ---------------------------------------------------------------- validering
  function run() {
    if (!files.size) {
      result = null;
      $("summary").hidden = $("viewer").hidden = $("clear").hidden = true;
      $("rules").innerHTML = "";
      return;
    }
    if (current === DELIVERY_TAB && files.size < 2) current = null;
    if (current !== DELIVERY_TAB && !files.has(current)) current = files.keys().next().value;
    const core = V.validate([...files].map(([name, text]) => ({ name, text })), META);
    delivery = D.check(core.dataset);
    result = D.combine(core, delivery);
    $("summary").hidden = $("viewer").hidden = $("clear").hidden = false;
    render();
  }

  const showWarn = () => $("showWarn").checked;
  const visible = (items) => items.filter((x) => (showWarn() || x.level === "ERROR") && (!ruleFilter || x.rule === ruleFilter));

  function render() {
    if (!result) return;
    const ne = result.errors.length, nw = result.warnings.length;
    const st = $("status");
    st.className = "badge " + (ne ? "err" : "ok");
    st.textContent = ne ? `${ne} ERROR` : "OK";
    $("counts").innerHTML = `${files.size} fil${files.size === 1 ? "" : "er"} · ` +
      `<span class="badge warn">${nw} WARN</span>`;

    // regelteljing
    const tally = new Map();
    for (const x of result.items) {
      if (x.level === "WARN" && !showWarn()) continue;
      const k = x.rule;
      if (!tally.has(k)) tally.set(k, { level: x.level, n: 0 });
      tally.get(k).n++;
      if (x.level === "ERROR") tally.get(k).level = "ERROR";
    }
    if (ruleFilter && !tally.has(ruleFilter)) ruleFilter = null;
    const chips = [...tally].sort((a, b) => (a[1].level === b[1].level ? b[1].n - a[1].n : a[1].level === "ERROR" ? -1 : 1));
    $("rules").innerHTML = chips.map(([rule, t]) =>
      `<span class="chip ${t.level}${rule === ruleFilter ? " active" : ""}" data-rule="${esc(rule)}" title="${esc(ruleText(rule, t.level))}"><b>${esc(rule)}</b> ${t.n}</span>`
    ).join("") + (ruleFilter ? ` <span class="chip" data-rule="">Vis alle reglar</span>` : "");
    $("rules").querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
      ruleFilter = c.dataset.rule && c.dataset.rule !== ruleFilter ? c.dataset.rule : null;
      render();
    }));

    // faner
    const top = visible(result.items.filter((x) => x.file === ""));
    $("tabs").innerHTML = (files.size >= 2 ? `<div class="tab${current === DELIVERY_TAB ? " active" : ""}" data-name="${DELIVERY_TAB}">` +
      `<span>Leveranse</span>` + (top.length ? `<span class="n w">${top.length}</span>` : "") + `</div>` : "") +
      [...files.keys()].map((name) => {
      const mine = visible(result.items.filter((x) => x.file === name));
      const e = mine.filter((x) => x.level === "ERROR").length, w = mine.length - e;
      return `<div class="tab${name === current ? " active" : ""}" data-name="${esc(name)}">` +
        `<span>${esc(name)}</span>` +
        (e ? `<span class="n e">${e}</span>` : "") + (w ? `<span class="n w">${w}</span>` : "") +
        `<button class="x" title="Fjern fila" data-remove="${esc(name)}">×</button></div>`;
      }).join("");
    $("tabs").querySelectorAll(".tab").forEach((t) => t.addEventListener("click", (e) => {
      if (e.target.dataset.remove) { files.delete(e.target.dataset.remove); run(); return; }
      current = t.dataset.name; cursor = -1; render();
    }));
    if (current === DELIVERY_TAB) renderDelivery(); else renderFile();
  }

  // ---------------------------------------------------------------- kodevising
  function highlight(lines) {
    // Enkel XML-farging med tilstand for kommentarar som går over fleire linjer.
    let inCom = false, comIsGap = false;
    return lines.map((raw) => {
      let out = "", i = 0;
      while (i < raw.length) {
        if (inCom) {
          const end = raw.indexOf("-->", i);
          const seg = end < 0 ? raw.slice(i) : raw.slice(i, end + 3);
          out += `<span class="t-com${comIsGap ? " t-gap" : ""}">${esc(seg)}</span>`;
          if (end < 0) break;
          inCom = false; i = end + 3; continue;
        }
        const lt = raw.indexOf("<", i);
        if (lt < 0) { out += esc(raw.slice(i)); break; }
        out += esc(raw.slice(i, lt));
        if (raw.startsWith("<!--", lt)) {
          inCom = true; comIsGap = /^<!--\s*GAP/.test(raw.slice(lt)); i = lt; continue;
        }
        const gt = raw.indexOf(">", lt);
        const tag = gt < 0 ? raw.slice(lt) : raw.slice(lt, gt + 1);
        out += tag.replace(/^(<\/?[?]?)([^\s>/]+)|([\w:.-]+)(=)("[^"]*"|'[^']*')|(\/?\??>)$/g,
          (m, open, name, an, eq, av, close) => {
            if (open) return `<span class="t-tag">${esc(open + name)}</span>`;
            if (an) return `<span class="t-attr">${esc(an)}</span>${eq}<span class="t-val">${esc(av)}</span>`;
            return `<span class="t-tag">${esc(close)}</span>`;
          }).replace(/<(?!\/?span)/g, "&lt;");
        if (gt < 0) break;
        i = gt + 1;
      }
      return out;
    });
  }

  // Regeltekst frå RULES.md. Nokre regel-id-ar (t.d. REF-03) har ulik tekst per nivå.
  function ruleText(rule, level) {
    const rows = META.rules[rule] || [];
    const mine = rows.filter((r) => !level || r.level === level);
    return (mine.length ? mine : rows).map((r) => r.text).join(" / ");
  }

  const note = (x) => `<div class="note ${x.level}"><span class="rid">${esc(x.rule)}</span>${esc(x.msg)}` +
    (ruleText(x.rule, x.level) ? `<span class="why">Regel: ${esc(ruleText(x.rule, x.level))}</span>` : "") +
    `<span class="where">${esc(x.where)}</span></div>`;

  function renderList(mine, empty) {
    $("list").innerHTML = mine.length ? mine.map((x, idx) =>
      `<div class="item ${x.level}" data-idx="${idx}" data-line="${x.line || ""}"><div class="top">` +
      `<span class="lno">${x.line ? "l. " + x.line : x.file ? "fil" : "leveranse"}</span><span class="rid">${esc(x.rule)}</span></div>` +
      `<div class="msg">${esc(x.msg)}</div></div>`).join("")
      : `<div class="empty">${empty}${showWarn() ? "" : " (åtvaringar er skjulte)"}.</div>`;
    $("list").querySelectorAll(".item").forEach((it) => it.addEventListener("click", () => {
      cursor = +it.dataset.idx; jump(it.dataset.line);
    }));
  }

  // Opnar fana til ei fil og hoppar til linja (frå referanselenkjer og tabellane i Leveranse).
  function open(file, line) {
    if (!files.has(file)) return;
    current = file; cursor = -1; render(); jump(line);
  }
  $("code").addEventListener("click", (e) => {
    const a = e.target.closest("[data-file]");
    if (!a) return;
    e.preventDefault();
    open(a.dataset.file, a.dataset.line);
  });
  $("code").addEventListener("input", (e) => {
    if (e.target.id === "objFilter") { objFilter = e.target.value; renderObjects(); }
  });
  $("code").addEventListener("change", (e) => {
    if (e.target.id === "unusedOnly") { unusedOnly = e.target.checked; renderObjects(); }
  });

  // ---------------------------------------------------------------- leveransevising
  function renderDelivery() {
    $("sideTitle").textContent = "Funn for leveransen";
    const idx = delivery.index;
    const count = (name, level) => visible(result.items.filter((x) => x.file === name && x.level === level)).length;
    const n = (k, cls) => (k ? `<span class="n ${cls}">${k}</span>` : "0");
    const roles = { shared: "delt", unit: "eining" };
    const known = new Set(idx.files.map((f) => f.name));
    const fileRows = idx.files.map((f) =>
      `<tr data-file="${esc(f.name)}"><td class="mono">${esc(f.name)}</td><td>${roles[f.role]}</td><td>${f.sops}</td>` +
      `<td>${n(count(f.name, "ERROR"), "e")}</td><td>${n(count(f.name, "WARN"), "w")}</td>` +
      `<td class="mono">${f.dependsOn.map(esc).join("<br>") || "–"}</td></tr>`).concat(
      [...files.keys()].filter((name) => !known.has(name)).map((name) =>
        `<tr data-file="${esc(name)}"><td class="mono">${esc(name)}</td><td colspan="2">ikkje lesen</td>` +
        `<td>${n(count(name, "ERROR"), "e")}</td><td>${n(count(name, "WARN"), "w")}</td><td>–</td></tr>`)).join("");
    const top = visible(result.items.filter((x) => x.file === ""));
    $("code").innerHTML = `<div class="delivery">` +
      `<h3>Filer</h3><table class="dtable"><thead><tr><th>Fil</th><th>Rolle</th><th>SOP</th><th>ERROR</th><th>WARN</th>` +
      `<th>Avhengig av</th></tr></thead><tbody>${fileRows}</tbody></table>` +
      `<h3>Funn for heile leveransen</h3>` + (top.length ? top.map(note).join("") : `<p class="empty">Ingen.</p>`) +
      `<h3>Objekt</h3><div class="objbar"><input type="search" id="objFilter" placeholder="Filtrer på id, type eller fil" value="${esc(objFilter)}">` +
      `<label class="toggle"><input type="checkbox" id="unusedOnly"${unusedOnly ? " checked" : ""}> berre ubrukte i delte filer</label></div>` +
      `<div id="objects"></div></div>`;
    renderObjects();
    renderList(top, "Ingen funn for heile leveransen");
  }

  function renderObjects() {
    const MAX = 500;
    const q = objFilter.trim().toLowerCase();
    const shared = new Set(delivery.index.files.filter((f) => f.role === "shared").map((f) => f.name));
    const list = delivery.index.objects.filter((o) => (!unusedOnly || (shared.has(o.file) && !o.usedBy.length)) &&
      (!q || `${o.id} ${o.tag} ${o.file}`.toLowerCase().includes(q)));
    $("objects").innerHTML = list.length
      ? `<table class="dtable"><thead><tr><th>id</th><th>version</th><th>Type</th><th>Definert i</th><th>Brukt av</th></tr></thead><tbody>` +
        list.slice(0, MAX).map((o) => `<tr data-file="${esc(o.file)}" data-line="${o.line}"><td class="mono">${esc(o.id)}</td>` +
          `<td>${esc(o.version)}</td><td>${esc(o.tag)}</td><td class="mono">${esc(o.file)}:${o.line}</td>` +
          `<td title="${esc(o.usedBy.join(", "))}">${o.usedBy.length}</td></tr>`).join("") + `</tbody></table>` +
        (list.length > MAX ? `<p class="empty">Viser ${MAX} av ${list.length}. Snevra inn med filteret.</p>` : "")
      : `<p class="empty">Ingen objekt passar.</p>`;
  }

  // Gjer ref="…" om til ei lenkje når referansen treffer i ei anna fil. Berre linja der elementet startar.
  function linkRefs(lineHtml, targets) {
    return lineHtml.replace(/(<span class="t-attr">ref<\/span>=<span class="t-val">)(&quot;|')(.*?)\2(<\/span>)/g, (all, pre, q, id, post) => {
      const t = targets.get(id);
      return t ? `${pre}${q}<a class="xref" href="#" data-file="${esc(t.file)}" data-line="${t.line}" title="Opne ${esc(t.file)}:${t.line}">${id}</a>${q}${post}` : all;
    });
  }

  function renderFile() {
    $("sideTitle").textContent = "Funn i fila";
    const text = files.get(current) || "";
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    const html = highlight(lines);
    const links = new Map();  // linjenummer -> (ref, HTML-escapa -> mål)
    for (const c of delivery.index.crossRefs) if (c.file === current) {
      if (!links.has(c.line)) links.set(c.line, new Map());
      links.get(c.line).set(esc(c.ref), c.target);
    }
    for (const [no, targets] of links) if (html[no - 1] !== undefined) html[no - 1] = linkRefs(html[no - 1], targets);
    const mine = visible(result.items.filter((x) => x.file === current));
    const byLine = new Map();
    const fileLevel = [];
    for (const x of mine) {
      if (!x.line) { fileLevel.push(x); continue; }
      if (!byLine.has(x.line)) byLine.set(x.line, []);
      byLine.get(x.line).push(x);
    }
    const out = [];
    for (let k = 0; k < html.length; k++) {
      const no = k + 1, f = byLine.get(no);
      const cls = f ? (f.some((x) => x.level === "ERROR") ? " hasERROR" : " hasWARN") : "";
      out.push(`<div class="ln${cls}" id="L${no}"><span class="no">${no}</span><span class="src">${html[k] || " "}</span>` +
        (f ? `<div class="notes">${f.map(note).join("")}</div>` : "") + `</div>`);
    }
    $("code").innerHTML = (fileLevel.length ? `<div class="filelevel">${fileLevel.map(note).join("")}</div>` : "") + out.join("");

    renderList(mine, "Ingen funn i denne fila");
  }

  function jump(line) {
    if (!line) { $("codewrap").scrollTop = 0; return; }
    const el = $("L" + line);
    if (!el) return;
    const wrap = $("codewrap");
    wrap.scrollTop = el.offsetTop - wrap.clientHeight / 3;
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 900);
  }
  function step(d) {
    const items = [...$("list").querySelectorAll(".item")];
    if (!items.length) return;
    cursor = (cursor + d + items.length) % items.length;
    jump(items[cursor].dataset.line);
  }
  $("next").addEventListener("click", () => step(1));
  $("prev").addEventListener("click", () => step(-1));
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || !result) return;
    if (e.key === "j") step(1);
    if (e.key === "k") step(-1);
  });
})();
