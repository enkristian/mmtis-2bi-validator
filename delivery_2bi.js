// Leveransereglar (DEL-*) for MMTIS 2b.i. Berre i nettlesaren: dei er ikkje porta til Python og er ikkje
// med i test_parity.js. Reglane står i validator/RULES.md, «Regel 5». Les datasettet som
// Validate2bi.validate() returnerer, og gir funn i same form som kjernen, pluss ein indeks for UI-et.
// Fungerer både i nettlesaren (global Delivery2bi) og i Node (module.exports).
(function (root) {
  "use strict";

  const DEFAULT_EXTERNAL_PREFIXES = ["NSR:"];
  const EXTERNAL_REF_ELEMENTS = new Set(["TypeOfFrameRef"]);
  const DELIVERY = "";  // file-verdien for funn som gjeld heile leveransen

  const basename = (f) => f.split(/[\\/]/).pop();
  const isShared = (name) => basename(name).startsWith("_");
  const isFrame = (nd) => nd.tag.endsWith("Frame");
  const child = (nd, tag) => nd.children.find((c) => c.tag === tag) || null;
  const value = (nd) => (nd.text || "").trim();
  const hasValidity = (nd) => !!(child(nd, "ValidBetween") || child(nd, "validityConditions"));
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
  // Toppobjekt: element med @id som ligg rett i ei samling i ei ramme (Frame > samling > objekt).
  const isTop = (nd) => "id" in nd.attrib && !isFrame(nd) && !!nd.parent && !!nd.parent.parent && isFrame(nd.parent.parent);
  function topObject(nd) {
    for (let x = nd; x; x = x.parent) if (isTop(x)) return x;
    return null;
  }

  function check(dataset, opts) {
    opts = opts || {};
    const prefixes = DEFAULT_EXTERNAL_PREFIXES.concat(opts.allowExternal || []);
    const files = dataset.files.filter((f) => f.root.tag === "PublicationDelivery");
    const role = new Map(files.map((f) => [f.name, isShared(f.name) ? "shared" : "unit"]));
    const order = new Map(files.map((f, k) => [f.name, k]));
    const index = {
      files: files.map((f) => ({ name: f.name, role: role.get(f.name), sops: [...iter(f.root, "SalesOfferPackage")].length, dependsOn: [] })),
      objects: [],
      crossRefs: [],
    };
    const items = [];
    if (files.length < 2) return { items, index };
    const warn = (rule, nd, msg) => items.push({ level: "WARN", rule, file: nd.file, line: nd.line, where: path(nd), msg });
    const loc = (nd) => `${basename(nd.file)}:${nd.line}`;
    const hasRoles = files.some((f) => role.get(f.name) === "shared");

    // DEL-01: ingen delt fil
    if (!hasRoles) {
      items.push({ level: "WARN", rule: "DEL-01", file: DELIVERY, line: null, where: "leveranse",
        msg: `ingen av dei ${files.length} filene er ei delt fil (namn som byrjar med «_»); tilrådd namn er _<CODESPACE>_shared_data.xml` });
    }

    // DEL-02: ParticipantRef og @version skal vere like
    const participant = (f) => child(f.root, "ParticipantRef");
    const first = files[0];
    const firstPr = participant(first) ? value(participant(first)) : "";
    for (const f of files.slice(1)) {
      const pr = participant(f);
      if ((pr ? value(pr) : "") !== firstPr) {
        warn("DEL-02", pr || f.root, `ParticipantRef «${pr ? value(pr) : ""}» er ulik «${firstPr}» i ${basename(first.name)}`);
      }
      if ((f.root.attrib.version || "") !== (first.root.attrib.version || "")) {
        warn("DEL-02", f.root, `PublicationDelivery version=«${f.root.attrib.version || ""}» er ulik «${first.root.attrib.version || ""}» i ${basename(first.name)}`);
      }
    }

    // Referansar og kva dei treffer. Ein referanse som har treff i si eiga fil, er ikkje på tvers av filer.
    const cands = (id) => (dataset.byId.get(id) || []).filter((c) => role.has(c.file));
    const external = (nd) => EXTERNAL_REF_ELEMENTS.has(nd.tag) || prefixes.some((p) => nd.attrib.ref.startsWith(p));
    const wanted = (nd) => {
      const v = nd.attrib.version !== undefined ? nd.attrib.version : nd.attrib.versionRef;
      return v && v !== "any" ? v : null;
    };
    function targets(nd) {
      const all = cands(nd.attrib.ref);
      const v = wanted(nd);
      const hit = v ? all.filter((c) => c.attrib.version === v) : all;
      return hit.length ? hit : all;
    }
    const refs = [];
    for (const f of files) for (const nd of iter(f.root)) {
      if (nd.tag.endsWith("Ref") && "ref" in nd.attrib && !external(nd)) refs.push(nd);
    }
    const cross = new Map();  // ref-node -> filene han treffer (berre andre filer)
    for (const nd of refs) {
      const t = targets(nd);
      if (!t.length || t.some((c) => c.file === nd.file)) continue;
      const tfiles = [...new Set(t.map((c) => c.file))].sort((a, b) => order.get(a) - order.get(b));
      cross.set(nd, tfiles);
      const best = t.find((c) => role.get(c.file) === "shared") || t[0];
      index.crossRefs.push({ file: nd.file, line: nd.line, ref: nd.attrib.ref, target: { file: best.file, line: best.line } });
    }

    const depsOf = new Map(files.map((f) => [f.name, new Map()]));  // fil -> (målfil -> første ref-node)
    for (const [nd, tfiles] of cross) {
      const deps = depsOf.get(nd.file);
      for (const t of tfiles) if (!deps.has(t)) deps.set(t, nd);
      const all = (r) => tfiles.every((t) => role.get(t) === r);
      const shown = tfiles.map(basename).join(", ");
      // DEL-03 og DEL-05: retningane mellom delte filer og einingsfiler. Ein prerequisites-referanse
      // berre erklærer avhengnaden; objektreferansen som skaper han, gir funnet.
      const declared = nd.parent && nd.parent.tag === "prerequisites";
      if (hasRoles && !declared && role.get(nd.file) === "unit" && all("unit")) {
        warn("DEL-03", nd, `${nd.tag} ref=«${nd.attrib.ref}» finst berre i ei anna einingsfil (${shown})`);
      }
      if (hasRoles && !declared && role.get(nd.file) === "shared" && all("unit")) {
        warn("DEL-05", nd, `${nd.tag} ref=«${nd.attrib.ref}» i ei delt fil finst berre i einingsfila ${shown}`);
      }
      // DEL-10: referansar til ei anna fil skal bruke versionRef
      if ("version" in nd.attrib) {
        warn("DEL-10", nd, `${nd.tag} ref=«${nd.attrib.ref}» peikar til ${shown} med version=; bruk versionRef for referansar til ei anna fil`);
      }
    }
    for (const fi of index.files) {
      fi.dependsOn = [...depsOf.get(fi.name).keys()].sort((a, b) => order.get(a) - order.get(b));
    }

    // DEL-11: prerequisites til ei ramme i kvar fil som fila er avhengig av
    for (const f of files) {
      const covered = new Set();
      for (const pre of iter(f.root, "prerequisites")) for (const r of pre.children) {
        if (r.attrib.ref) for (const c of cands(r.attrib.ref)) if (isFrame(c)) covered.add(c.file);
      }
      for (const [t, nd] of depsOf.get(f.name)) if (!covered.has(t)) {
        warn("DEL-11", nd, `fila brukar objekt frå ${basename(t)}, men ingen ramme har prerequisites til ei ramme i den fila`);
      }
    }

    // DEL-12: versionRef må finnast i leveransen
    for (const nd of refs) {
      const vr = nd.attrib.versionRef;
      if (!vr || vr === "any") continue;
      const all = cands(nd.attrib.ref);
      if (all.length && !all.some((c) => c.attrib.version === vr)) {
        const have = [...new Set(all.map((c) => c.attrib.version || "-"))].sort();
        warn("DEL-12", nd, `${nd.tag} ref=«${nd.attrib.ref}» versionRef=«${vr}» finst ikkje (finst i version ${have.join(", ")})`);
      }
    }
    // Toppobjekt og kven som brukar dei. Ei einingsfil brukar sine eigne toppobjekt og alt dei når
    // gjennom referansar, òg vidare gjennom objekt i delte filer.
    const objectsIn = new Map(files.map((f) => [f.name, [...iter(f.root)].filter(isTop)]));
    const refsIn = new Map();
    const frameRefs = new Map(files.map((f) => [f.name, []]));  // referansar på rammenivå, t.d. DefaultCodespaceRef
    for (const r of refs) {
      const o = topObject(r);
      if (!o) {
        if (r.parent && r.parent.tag !== "prerequisites") frameRefs.get(r.file).push(r);
        continue;
      }
      if (!refsIn.has(o)) refsIn.set(o, []);
      refsIn.get(o).push(r);
    }
    const usedBy = new Map();
    for (const f of files) for (const o of objectsIn.get(f.name)) usedBy.set(o, new Set());
    for (const u of files) {
      if (role.get(u.name) !== "unit") continue;
      const queue = objectsIn.get(u.name).slice();
      for (const r of frameRefs.get(u.name)) for (const t of targets(r)) {
        const to = topObject(t);
        if (to) queue.push(to);
      }
      const seen = new Set(queue);
      while (queue.length) {
        const o = queue.pop();
        usedBy.get(o).add(u.name);
        for (const r of refsIn.get(o) || []) for (const t of targets(r)) {
          const to = topObject(t);
          if (to && !seen.has(to)) { seen.add(to); queue.push(to); }
        }
      }
    }
    for (const f of files) for (const o of objectsIn.get(f.name)) {
      index.objects.push({ id: o.attrib.id, version: o.attrib.version || "", tag: o.tag, file: f.name, line: o.line,
        usedBy: [...usedBy.get(o)].sort((a, b) => order.get(a) - order.get(b)) });
    }

    if (hasRoles) for (const f of files) {
      if (role.get(f.name) !== "shared") continue;
      // DEL-04: salspakkar høyrer til i einingsfilene
      for (const sop of iter(f.root, "SalesOfferPackage")) {
        warn("DEL-04", sop, `SalesOfferPackage «${sop.attrib.id || ""}» ligg i ei delt fil; han høyrer til i ei einingsfil`);
      }
      // DEL-06: ubrukte objekt i delte filer
      for (const o of objectsIn.get(f.name)) if (!usedBy.get(o).size) {
        warn("DEL-06", o, `${o.tag} «${o.attrib.id}» i ei delt fil blir ikkje brukt av nokon einingsfil`);
      }
    }

    // DEL-07: gyldigheit på CompositeFrame, ikkje på rammene inni
    for (const f of files) for (const cf of iter(f.root, "CompositeFrame")) {
      if (!hasValidity(cf)) warn("DEL-07", cf, "CompositeFrame manglar ValidBetween eller validityConditions");
      const inner = child(cf, "frames");
      for (const fr of inner ? inner.children : []) {
        if (isFrame(fr) && hasValidity(fr)) warn("DEL-07", fr, `${fr.tag} har eiga gyldigheit inne i ein CompositeFrame`);
      }
    }

    // DEL-08 og DEL-09: same id i fleire einingsfiler eller i fleire delte filer (rammer er unnatekne).
    // Utan delt fil er alle filene einingsfiler, så DEL-08 gjeld då òg.
    const where = new Map();  // id -> (fil -> første node)
    for (const f of files) for (const nd of iter(f.root)) {
      const id = nd.attrib.id;
      if (!id || isFrame(nd)) continue;
      if (!where.has(id)) where.set(id, new Map());
      if (!where.get(id).has(f.name)) where.get(id).set(f.name, nd);
    }
    for (const [id, perFile] of where) {
      for (const [r, rule, what, hint] of [["unit", "DEL-08", "einingsfiler", "; flytt objektet til ei delt fil"], ["shared", "DEL-09", "delte filer", ""]]) {
        const nodes = [...perFile].filter(([name]) => role.get(name) === r).map(([, nd]) => nd);
        for (const nd of nodes.slice(1)) warn(rule, nd, `id «${id}» er definert i fleire ${what}, òg i ${loc(nodes[0])}${hint}`);
      }
    }
    return { items, index };
  }

  function combine(core, delivery) {
    const items = core.items.concat(delivery.items);
    items.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : (a.line || 0) - (b.line || 0)));
    return { items, errors: items.filter((x) => x.level === "ERROR"), warnings: items.filter((x) => x.level === "WARN") };
  }

  const api = { check, combine, isShared };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Delivery2bi = api;
})(typeof window !== "undefined" ? window : globalThis);
