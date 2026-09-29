// Reglane for MMTIS 2b.i regel 2 (kompletthet: Må-/Bør-felt), som new Rule(...)-liknande objekt.
// Kvar regel er { id, level, appliesTo, check }. appliesTo er ein tag-streng — runRules() finn
// nodane av den taggen og kallar check(node, dataset) på kvar av dei — eller null for regelen som
// gjeld heile datasettet (MA-SOP-00), som får check(dataset) i staden. check() returnerer null
// eller fleire meldingar, sidan éin node kan bryte same regel fleire gonger (t.d. manglar både
// @id og @version).
//
// dataset er { roots, all(tag), resolve(ref, version), productRefs } — same form som validate_2bi.js
// byggjer internt. Fungerer både i nettlesaren (global Rules) og i Node (module.exports).
(function (root) {
  "use strict";

  const ORG_REFS = new Set(["OrganisationRef", "AuthorityRef", "OperatorRef", "GeneralOrganisationRef",
    "RetailConsortiumRef", "OtherOrganisationRef", "ManagementAgentRef", "TravelAgentRef",
    "ServicedOrganisationRef"]);

  // ------------------------------------------------------------------ hjelpefunksjonar (som validate_2bi.js)
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
  function ancestor(nd, tag) {
    for (let p = nd.parent; p; p = p.parent) if (p.tag === tag) return p;
    return null;
  }

  function rule({ id, level, appliesTo, check }) {
    return { id, level, appliesTo, check };
  }

  // ------------------------------------------------------------------ DistributionAssignment: delt oppslag
  // DA-ar kan liggje inne i ein SalesOfferPackage, utanfor med ein SalesOfferPackageRef til han
  // («ekstern»), eller høyre til ingen av delane («foreldrelaus»). MA-DA-01 (per SOP) og
  // collectDistributionAssignments() (per DA) treng begge denne oppdelinga, så ho blir rekna ut
  // éin gong per dataset og mellomlagra.
  const externalDaCache = new WeakMap();
  function externalDaIndex(dataset) {
    let idx = externalDaCache.get(dataset);
    if (!idx) {
      idx = new Map();
      for (const da of dataset.all("DistributionAssignment")) {
        if (!ancestor(da, "SalesOfferPackage")) {
          const r = child(da, "SalesOfferPackageRef");
          if (r && r.attrib.ref) {
            if (!idx.has(r.attrib.ref)) idx.set(r.attrib.ref, []);
            idx.get(r.attrib.ref).push(da);
          }
        }
      }
      externalDaCache.set(dataset, idx);
    }
    return idx;
  }

  function collectDistributionAssignments(dataset) {
    const idx = externalDaIndex(dataset);
    const seen = new Set();
    const result = [];
    for (const sop of dataset.all("SalesOfferPackage")) {
      const das = [...iter(sop, "DistributionAssignment")].concat(idx.get(sop.attrib.id || "") || []);
      for (const da of das) if (!seen.has(da)) { seen.add(da); result.push(da); }
    }
    for (const da of dataset.all("DistributionAssignment")) if (!seen.has(da)) { seen.add(da); result.push(da); }
    return result;
  }

  const COLLECTORS = { DistributionAssignment: collectDistributionAssignments };

  // ------------------------------------------------------------------ reglane (regel 2: kompletthet)

  const RULES = [
    rule({
      id: "MA-SOP-00", level: "ERROR", appliesTo: null,
      check(dataset) {
        if (dataset.roots.length && !dataset.all("SalesOfferPackage").length) {
          return [{ file: dataset.roots[0].file, message: "datasettet har ingen SalesOfferPackage" }];
        }
        return [];
      },
    }),
    rule({
      id: "MA-SOP-01", level: "ERROR", appliesTo: "SalesOfferPackage",
      check(sop) {
        const msgs = [];
        for (const attr of ["id", "version"]) if (!sop.attrib[attr]) msgs.push(`SalesOfferPackage manglar @${attr}`);
        return msgs;
      },
    }),
    rule({
      id: "MA-SOP-02", level: "ERROR", appliesTo: "SalesOfferPackage",
      check: (sop) => (hasText(sop, "Name") ? [] : ["SalesOfferPackage manglar Name"]),
    }),
    rule({
      id: "MA-SOP-03", level: "ERROR", appliesTo: "SalesOfferPackage",
      check: (sop) => ((child(sop, "ValidBetween") || child(sop, "validityConditions"))
        ? [] : ["SalesOfferPackage manglar ValidBetween eller validityConditions"]),
    }),
    rule({
      id: "MA-SPE-01", level: "ERROR", appliesTo: "SalesOfferPackage",
      check(sop, dataset) {
        const spes = [...iter(sop, "SalesOfferPackageElement")];
        const withProduct = spes.some((s) => s.children.some((c) => dataset.productRefs.has(c.tag) && c.attrib.ref));
        return withProduct ? [] : ["ingen SalesOfferPackageElement med produktreferanse (PreassignedFareProductRef e.l.)"];
      },
    }),
    rule({
      id: "BOR-SPE-01", level: "WARN", appliesTo: "SalesOfferPackageElement",
      check: (s) => (child(s, "TypeOfTravelDocumentRef") ? [] : ["SalesOfferPackageElement manglar TypeOfTravelDocumentRef"]),
    }),
    rule({
      id: "MA-DA-01", level: "ERROR", appliesTo: "SalesOfferPackage",
      check(sop, dataset) {
        const idx = externalDaIndex(dataset);
        const das = [...iter(sop, "DistributionAssignment")].concat(idx.get(sop.attrib.id || "") || []);
        return das.length ? [] : ["SalesOfferPackage har ingen DistributionAssignment"];
      },
    }),
    rule({
      id: "MA-DA-02", level: "ERROR", appliesTo: "DistributionAssignment",
      check(da) {
        const chref = child(da, "DistributionChannelRef");
        const missingRef = !chref || !chref.attrib.ref;
        return (missingRef && !hasText(da, "DistributionChannelType"))
          ? ["DistributionAssignment manglar DistributionChannelRef og DistributionChannelType"] : [];
      },
    }),
    rule({
      id: "MA-DA-03", level: "ERROR", appliesTo: "DistributionAssignment",
      check(da) {
        const fmref = child(da, "FulfilmentMethodRef");
        return (!fmref || !fmref.attrib.ref) ? ["DistributionAssignment manglar FulfilmentMethodRef"] : [];
      },
    }),
    rule({
      id: "MA-DA-04", level: "ERROR", appliesTo: "DistributionAssignment",
      check(da, dataset) {
        if (hasText(da, "PaymentMethods")) return [];
        const chref = child(da, "DistributionChannelRef");
        const channel = (chref && chref.attrib.ref) ? dataset.resolve(chref.attrib.ref, chref.attrib.version)[0] : null;
        return (!channel || !hasText(channel, "PaymentMethods"))
          ? ["ingen PaymentMethods på DistributionAssignment eller på kanalen han peikar til"] : [];
      },
    }),
    rule({
      id: "BOR-DA-01", level: "WARN", appliesTo: "DistributionAssignment",
      check: (da) => (hasText(da, "DistributionRights") ? [] : ["DistributionAssignment manglar DistributionRights"]),
    }),
    rule({
      id: "MA-DC-01", level: "ERROR", appliesTo: "DistributionChannel",
      check: (dc) => (hasText(dc, "Name") ? [] : ["DistributionChannel manglar Name"]),
    }),
    rule({
      id: "MA-DC-02", level: "ERROR", appliesTo: "DistributionChannel",
      check: (dc) => (hasText(dc, "DistributionChannelType") ? [] : ["DistributionChannel manglar DistributionChannelType"]),
    }),
    rule({
      id: "BOR-DC-01", level: "WARN", appliesTo: "DistributionChannel",
      check(dc) {
        const cd = child(dc, "ContactDetails");
        return (!cd || !hasText(cd, "Url")) ? ["DistributionChannel manglar ContactDetails/Url"] : [];
      },
    }),
    rule({
      id: "BOR-DC-02", level: "WARN", appliesTo: "DistributionChannel",
      check: (dc) => (dc.children.some((c) => ORG_REFS.has(c.tag)) ? [] : ["DistributionChannel manglar OrganisationRef (eigar)"]),
    }),
    rule({
      id: "MA-FM-01", level: "ERROR", appliesTo: "FulfilmentMethod",
      check: (fm) => (hasText(fm, "FulfilmentMethodType") ? [] : ["FulfilmentMethod manglar FulfilmentMethodType"]),
    }),
    rule({
      id: "MA-FM-02", level: "ERROR", appliesTo: "FulfilmentMethod",
      check: (fm) => (hasText(fm, "Name") ? [] : ["FulfilmentMethod manglar Name"]),
    }),
    rule({
      id: "BOR-TOTD-01", level: "WARN", appliesTo: "TypeOfTravelDocument",
      check: (td) => (hasText(td, "MediaType") ? [] : ["TypeOfTravelDocument manglar MediaType"]),
    }),
    rule({
      id: "BOR-TOTD-02", level: "WARN", appliesTo: "TypeOfTravelDocument",
      check: (td) => (hasText(td, "MachineReadable") ? [] : ["TypeOfTravelDocument manglar MachineReadable"]),
    }),
  ];

  // ------------------------------------------------------------------ evaluator

  function runRules(dataset, rules) {
    const findings = [];
    for (const r of rules) {
      if (r.appliesTo === null) {
        for (const f of r.check(dataset)) findings.push({ level: r.level, rule: r.id, file: f.file, message: f.message });
        continue;
      }
      const collect = COLLECTORS[r.appliesTo] || ((ds) => ds.all(r.appliesTo));
      for (const node of collect(dataset)) {
        for (const message of r.check(node, dataset)) findings.push({ level: r.level, rule: r.id, node, message });
      }
    }
    return findings;
  }

  const api = { rule, RULES, runRules };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Rules = api;
})(typeof window !== "undefined" ? window : globalThis);
