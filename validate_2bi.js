// Validator for MMTIS nivå 2b.i i NeTEx 2.0 — JavaScript-port av validator/validate_2bi.py.
// Reglane er dokumenterte i validator/RULES.md. XSD-01 (xmllint) er ikkje med; enumar og
// produktreferansar frå XSD-en blir bygde inn av build_html.py (META).
// Fungerer både i nettlesaren (global Validate2bi) og i Node (module.exports).
(function (root) {
  "use strict";

  const Rules = typeof require === "function" ? require("./rules.js") : root.Rules;

  const EXTERNAL_REF_ELEMENTS = new Set(["TypeOfFrameRef"]);
  const DEFAULT_EXTERNAL_PREFIXES = ["NSR:"];
  const GENERIC_VALUES = {
    DistributionChannelType: ["other"],
    FulfilmentMethodType: ["other"],
    PaymentMethods: ["other"],
    DistributionRights: ["other", "none"],
    MediaType: ["other", "none"],
    MachineReadable: ["other", "none"],
  };
  const REF_TARGETS = {
    DistributionChannelRef: "DistributionChannel",
    FulfilmentMethodRef: "FulfilmentMethod",
    TypeOfTravelDocumentRef: "TypeOfTravelDocument",
    SalesOfferPackageRef: "SalesOfferPackage",
  };
  const TEST_MARKER = ":Test";

  // ------------------------------------------------------------------ XML-parsar med linjenummer

  class XmlError extends Error {
    constructor(msg, line) { super(msg); this.line = line; }
  }

  const ENTITIES = { lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" };
  function decode(s, line) {
    return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (m, e) => {
      if (e[0] === "#") return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      if (e in ENTITIES) return ENTITIES[e];
      throw new XmlError(`ukjend entitet ${m}`, line);
    });
  }
  const local = (name) => name.includes(":") ? name.split(":").pop() : name;

  function makeNode(tag, attrib, line, file, parent) {
    return { tag, attrib, line, file, parent, children: [], text: "" };
  }

  // Enkel, ikkje-validerande parsar. Gir same tre som expat-parseren i Python-versjonen:
  // lokale namn, attributt utan prefiks, tekst samla per element, kommentarar ignorerte.
  function parseXml(src, file) {
    let i = 0, line = 1;
    const n = src.length;
    const stack = [];
    let rootNode = null;
    const adv = (to) => { for (; i < to; i++) if (src.charCodeAt(i) === 10) line++; };
    if (src.charCodeAt(0) === 0xfeff) i = 1;
    while (i < n) {
      const lt = src.indexOf("<", i);
      if (lt < 0) {
        const rest = src.slice(i);
        if (rest.trim() && !stack.length) throw new XmlError("tekst utanfor rotelementet", line);
        if (stack.length) throw new XmlError(`elementet ${stack[stack.length - 1].tag} er ikkje lukka`, line);
        break;
      }
      if (lt > i) {
        const txt = src.slice(i, lt);
        const startLine = line;
        adv(lt);
        if (stack.length) stack[stack.length - 1].text += decode(txt, startLine);
        else if (txt.trim()) throw new XmlError("tekst utanfor rotelementet", startLine);
      }
      if (src.startsWith("<!--", i)) {
        const end = src.indexOf("-->", i + 4);
        if (end < 0) throw new XmlError("kommentaren er ikkje lukka", line);
        adv(end + 3); continue;
      }
      if (src.startsWith("<![CDATA[", i)) {
        const end = src.indexOf("]]>", i + 9);
        if (end < 0) throw new XmlError("CDATA er ikkje lukka", line);
        if (stack.length) stack[stack.length - 1].text += src.slice(i + 9, end);
        adv(end + 3); continue;
      }
      if (src.startsWith("<?", i)) {
        const end = src.indexOf("?>", i + 2);
        if (end < 0) throw new XmlError("prosesseringsinstruksjonen er ikkje lukka", line);
        adv(end + 2); continue;
      }
      if (src.startsWith("<!DOCTYPE", i) || src.startsWith("<!", i)) {
        throw new XmlError("DOCTYPE er ikkje tillate i NeTEx-inndata", line);
      }
      // start- eller sluttag: finn slutten, med omsyn til attributtverdiar i hermeteikn
      let j = i + 1, q = null;
      for (; j < n; j++) {
        const c = src[j];
        if (q) { if (c === q) q = null; }
        else if (c === '"' || c === "'") q = c;
        else if (c === ">") break;
      }
      if (j >= n) throw new XmlError("taggen er ikkje lukka", line);
      const tagSrc = src.slice(i + 1, j);
      const tagLine = line;
      if (tagSrc[0] === "/") {
        const name = local(tagSrc.slice(1).trim());
        const top = stack.pop();
        if (!top || top.tag !== name) {
          throw new XmlError(`sluttag </${name}> passar ikkje med <${top ? top.tag : "?"}>`, tagLine);
        }
        adv(j + 1); continue;
      }
      const selfClose = tagSrc.endsWith("/");
      const body = selfClose ? tagSrc.slice(0, -1) : tagSrc;
      const m = /^([^\s/>]+)/.exec(body);
      if (!m) throw new XmlError("ugyldig tag", tagLine);
      const attrib = {};
      const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let a;
      const attrPart = body.slice(m[1].length);
      while ((a = re.exec(attrPart))) {
        const key = a[1];
        if (key === "xmlns" || key.startsWith("xmlns:")) continue;
        attrib[local(key)] = decode(a[3] !== undefined ? a[3] : a[4], tagLine);
      }
      const node = makeNode(local(m[1]), attrib, tagLine, file, stack.length ? stack[stack.length - 1] : null);
      if (stack.length) stack[stack.length - 1].children.push(node);
      else if (rootNode) throw new XmlError("meir enn eitt rotelement", tagLine);
      else rootNode = node;
      if (!selfClose) stack.push(node);
      adv(j + 1);
    }
    if (stack.length) throw new XmlError(`elementet ${stack[stack.length - 1].tag} er ikkje lukka`, line);
    if (!rootNode) throw new XmlError("fila har ikkje noko rotelement", 1);
    return rootNode;
  }

  // ------------------------------------------------------------------ hjelpefunksjonar

  const child = (nd, tag) => nd.children.find((c) => c.tag === tag) || null;
  const value = (nd) => (nd.text || "").trim();
  const hasText = (nd, tag) => { const c = child(nd, tag); return !!c && value(c) !== ""; };
  function* iter(nd, tag) {
    const stack = [nd];
    while (stack.length) {
      const x = stack.pop();
      if (!tag || x.tag === tag) yield x;
      for (let k = x.children.length - 1; k >= 0; k--) stack.push(x.children[k]);
    }
  }
  function path(nd) {
    const parts = [];
    for (let x = nd; x; x = x.parent) {
      if ("id" in x.attrib) { parts.push(`${x.tag}[@id='${x.attrib.id}']`); break; }
      parts.push(x.tag);
    }
    return parts.reverse().join("/");
  }
  function canonical(nd) {
    const attrs = Object.keys(nd.attrib).sort().map((k) => [k, nd.attrib[k]]);
    return JSON.stringify([nd.tag, attrs, value(nd), nd.children.map(canonical)]);
  }
  const basename = (f) => f.split(/[\\/]/).pop();

  // ------------------------------------------------------------------ REF-06: utgått ValidBetween

  function parseNetexDate(text) {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(text || "");
    if (!m) return null;
    const d = new Date(`${m[1]}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function normalizeAsOf(asOf) {
    if (asOf instanceof Date) return new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
    if (typeof asOf === "string") return parseNetexDate(asOf);
    return null;
  }
  // validityConditions blir ikkje tolka, same avgrensing som Python-versjonen.
  function targetExpired(nd, asOf) {
    const vb = child(nd, "ValidBetween");
    const to = vb && child(vb, "ToDate");
    const d = to && parseNetexDate(value(to));
    return !!d && d < asOf;
  }

  // ------------------------------------------------------------------ validering

  function validate(files, meta, opts) {
    opts = opts || {};
    const prefixes = DEFAULT_EXTERNAL_PREFIXES.concat(opts.allowExternal || []);
    const asOf = normalizeAsOf(opts.asOf) || normalizeAsOf(new Date());
    const enumValues = {};
    for (const k of Object.keys(meta.enums)) enumValues[k] = new Set(meta.enums[k]);
    const productRefs = new Set(meta.productRefs);
    const items = [];
    const add = (level, rule, nd, msg) => items.push({ level, rule, file: nd.file, line: nd.line, where: path(nd), msg });
    const addFile = (level, rule, file, line, where, msg) => items.push({ level, rule, file, line, where, msg });
    const error = (rule, nd, msg) => add("ERROR", rule, nd, msg);
    const warn = (rule, nd, msg) => add("WARN", rule, nd, msg);

    // Regel 0: les filene
    const roots = [];
    const seenNames = new Set();
    for (const f of files) {
      if (seenNames.has(f.name)) continue;
      seenNames.add(f.name);
      let r;
      try { r = parseXml(f.text, f.name); }
      catch (e) {
        addFile("ERROR", "XML-01", f.name, e.line || null, "-", `kan ikkje lesast som XML: ${e.message}`);
        continue;
      }
      if (r.tag !== "PublicationDelivery") {
        addFile("ERROR", "XML-02", f.name, r.line, r.tag, `rotelementet er ${r.tag}, ikkje PublicationDelivery`);
      }
      roots.push(r);
    }
    if (!roots.length) return finish(items, { files: [], byId: new Map() });

    const byId = new Map();
    for (const r of roots) for (const nd of iter(r)) if ("id" in nd.attrib) {
      if (!byId.has(nd.attrib.id)) byId.set(nd.attrib.id, []);
      byId.get(nd.attrib.id).push(nd);
    }
    const all = (tag) => roots.flatMap((r) => [...iter(r, tag)]);
    function resolve(ref, version) {
      const cands = byId.get(ref) || [];
      const hit = version && version !== "any" ? cands.filter((c) => c.attrib.version === version) : cands;
      return [hit[0] || null, cands.length > 0];
    }

    // Regel 2: kompletthet (Må-/Bør-felt), som Rule-objekt i rules.js
    const rulesDataset = { roots, all, resolve, productRefs };
    for (const f of Rules.runRules(rulesDataset, Rules.RULES)) {
      if (f.node) add(f.level, f.rule, f.node, f.message);
      else addFile(f.level, f.rule, f.file, null, "PublicationDelivery", f.message);
    }

    // Regel 3: enumverdiar
    for (const [elem, allowed] of Object.entries(enumValues)) {
      for (const nd of all(elem)) {
        if (nd.children.length) continue;
        for (const t of value(nd).split(/\s+/).filter(Boolean)) {
          if (!allowed.has(t)) error("ENUM-01", nd, `«${t}» er ikkje ein gyldig ${elem}-verdi i NeTEx 2.0`);
          else if ((GENERIC_VALUES[elem] || []).includes(t)) warn("ENUM-02", nd, `generisk verdi «${t}» seier ikkje kvar/korleis`);
        }
      }
    }

    // Regel 4: referansar
    const seen = new Map();
    const loc = (o) => `${basename(o.file)}:${o.line}`;
    for (const r of roots) for (const nd of iter(r)) {
      const nid = nd.attrib.id;
      if (nid) {
        const key = nid + "\u0000" + (nd.attrib.version || "");
        const earlier = seen.get(key);
        if (earlier) {
          const ver = nd.attrib.version || "-";
          const sameFile = earlier.filter((o) => o.file === nd.file);
          if (sameFile.length) error("REF-03", nd, `duplikat id+version (${nid}, ${ver}) i same fil; òg i ${loc(sameFile[0])}`);
          else if (canonical(nd) !== canonical(earlier[0])) error("REF-03", nd, `duplikat id+version (${nid}, ${ver}) med ulikt innhald: ${loc(nd)} og ${loc(earlier[0])}`);
          else warn("REF-03", nd, `identisk duplikat på tvers av filer (${nid}, ${ver}); òg i ${loc(earlier[0])}`);
          earlier.push(nd);
        } else seen.set(key, [nd]);
        if (nid.includes(TEST_MARKER)) error("REF-04", nd, `testverdi i id «${nid}»`);
      }
      if (nd.tag.endsWith("Ref") && "ref" in nd.attrib) {
        const ref = nd.attrib.ref;
        if (ref.includes(TEST_MARKER)) error("REF-04", nd, `testverdi i ref «${ref}»`);
        if (EXTERNAL_REF_ELEMENTS.has(nd.tag) || prefixes.some((p) => ref.startsWith(p))) continue;
        const ver = nd.attrib.version;
        const [hit, exists] = resolve(ref, ver);
        if (!hit && !exists) error("REF-01", nd, `${nd.tag} ref=«${ref}» treffer ikkje noko element i datasettet`);
        else if (!hit) {
          const have = [...new Set(byId.get(ref).map((c) => c.attrib.version || "-"))].sort();
          error("REF-02", nd, `${nd.tag} ref=«${ref}» version=«${ver}» finst ikkje (finst i version ${have.join(", ")})`);
        } else {
          if (REF_TARGETS[nd.tag] && hit.tag !== REF_TARGETS[nd.tag]) {
            error("REF-05", nd, `${nd.tag} ref=«${ref}» peikar på eit ${hit.tag}`);
          }
          if (ver && ver !== "any" && targetExpired(hit, asOf)) {
            const to = value(child(child(hit, "ValidBetween"), "ToDate"));
            error("REF-06", nd, `${nd.tag} ref=«${ref}» version=«${ver}» peikar på eit element som gjekk ut ${to.slice(0, 10)} (ValidBetween/ToDate)`);
          }
        }
      }
    }
    return finish(items, { files: roots.map((r) => ({ name: r.file, root: r })), byId });
  }

  // dataset er dei lesne filene og id-indeksen, for leveransereglane i delivery_2bi.js.
  function finish(items, dataset) {
    items.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : (a.line || 0) - (b.line || 0)));
    return {
      items,
      errors: items.filter((x) => x.level === "ERROR"),
      warnings: items.filter((x) => x.level === "WARN"),
      dataset,
    };
  }

  function format(f) {
    return `${f.level} [${f.rule}] ${basename(f.file)}${f.line ? ":" + f.line : ""} ${f.where}: ${f.msg}`;
  }

  const api = { parseXml, validate, format, XmlError };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Validate2bi = api;
})(typeof window !== "undefined" ? window : globalThis);
