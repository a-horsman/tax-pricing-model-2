/* "Tape" layout: a step-by-step wizard. Every service gets its own step with an Include / Skip choice,
   so services can be added or dropped at any point. Ends on a printed receipt. */
const S = createState();
let step = 0, period = "month";
const $ = id => document.getElementById(id);
const STEPS = [...SERVICES.map(s => s.key), "review"];
const svcOf = k => SERVICES.find(s => s.key === k);
const lower = n => n.charAt(0).toLowerCase() + n.slice(1);

function receipt(e) {
  const k = period === "year" ? 12 : 1, sfx = period === "year" ? "per year" : "per month";
  const recurring = e.groups.some(g => g.lines.length);
  if (!e.groups.length) return `<div class="tape"><div class="sum-head"><div class="lbl">Estimated recurring fee</div><div class="total"><small>No services included yet</small></div></div></div>`;
  return `<div class="tape">
    <div class="sum-head">
      <div class="lbl">Estimated recurring fee</div>
      <div class="total">${recurring ? `${money(e.low * k)} – ${money(e.high * k)}<small>${sfx}</small>` : `<small>No recurring services</small>`}</div>
      ${e.customCount ? `<div class="note">${e.customCount} item${e.customCount > 1 ? "s" : ""} quoted separately by your CPA.</div>` : ""}
    </div>
    <div class="lines">${e.groups.filter(g => g.lines.length).map(g => `<div class="grp"><h3>${g.svc.name}<span>${money(g.sub * k)}</span></h3>${g.lines.map(l =>
      `<div class="row${l.monthly < 0 ? " neg" : ""}"><span>${esc(l.label)}</span><span class="${l.custom ? "cq" : ""}">${l.custom ? "Custom quote" : (l.monthly < 0 ? "−" : "") + money(Math.abs(l.monthly) * k)}</span></div>`).join("")}</div>`).join("")}</div>
    ${e.oneTime.length ? `<div class="onetime"><div class="lbl">One-time</div>${e.oneTime.map(o =>
      `<div class="row"><span>${esc(o.label)}</span><span class="${o.amount == null ? "cq" : ""}">${o.amount == null ? "Custom quote" : money(o.amount)}</span></div>`).join("")}</div>` : ""}
    <div class="foot">
      <a class="btn primary" href="${CONFIG.bookingUrl}" target="_blank" rel="noopener">Book a consultation</a>
      <button type="button" class="btn ghost" id="copy">Copy estimate summary</button>
      <p class="fine">Assumes clean, current records and a standard scope. Ranges include a ${CONFIG.rangeAllowance * 100}% allowance for complexity found during onboarding.</p>
    </div>
  </div>`;
}

function sectionNote(e, key) {
  const g = e.groups.find(g => g.svc.key === key);
  if (!g) return "Skipped. This service isn't in your estimate.";
  if (g.lines.length) return `Adds <b>${money(g.sub)}/mo</b> to your estimate.`;
  if (g.oneTime.length) return `One-time fee of <b>${g.oneTime[0].amount == null ? "custom quote" : money(g.oneTime[0].amount)}</b>.`;
  return "";
}

function light() {
  const e = estimate(S);
  $("running").textContent = e.groups.some(g => g.lines.length) ? `${money(e.low)} – ${money(e.high)}/mo` : "—";
  const n = $("secnote"); if (n) n.innerHTML = sectionNote(e, n.dataset.key);
}

function renderRail() {
  $("rail").innerHTML = STEPS.map((k, i) => {
    const review = k === "review", on = !review && S.selected.has(k);
    const mark = review ? "✓" : on ? "✓" : "–";
    const state = review ? "" : on ? "in" : "out";
    return `<li><button type="button" data-step="${i}" class="${state}" aria-current="${i === step ? "step" : "false"}"
      aria-label="${review ? "Estimate" : `${svcOf(k).name}, ${on ? "included" : "skipped"}`}"><span class="n" aria-hidden="true">${review ? i + 1 : mark}</span>${review ? "Estimate" : svcOf(k).name}</button></li>`;
  }).join("");
}

function render() {
  const cur = STEPS[step], e = estimate(S);
  renderRail();
  let html = `<p class="step">Step ${step + 1} of ${STEPS.length}</p>`;
  if (cur === "review") {
    html += `<h1>Your estimate</h1>
      <div class="review-picks">
        <span class="lbl">Services in this estimate. Tap to add or remove.</span>
        <div class="picker compact">${SERVICES.map(s => `<button type="button" class="svc" id="svc-${s.key}" data-pick="${s.key}" aria-pressed="${S.selected.has(s.key)}"><b>${s.name}</b></button>`).join("")}</div>
      </div>
      <div class="period" role="group" aria-label="Show prices">${["month", "year"].map(p =>
        `<button type="button" id="p-${p}" data-period="${p}" aria-pressed="${period === p}">${p === "month" ? "Monthly" : "Annual"}</button>`).join("")}</div>
      ${receipt(e)}`;
  } else {
    const svc = svcOf(cur), on = S.selected.has(cur);
    html += `<h1>${svc.name}</h1>
      <p class="lede">${svc.blurb}.</p>
      <div class="include" role="group" aria-label="Include ${svc.name}">
        <button type="button" class="choice" id="inc-yes" data-include="yes" aria-pressed="${on}"><b>Include</b><small>Price ${lower(svc.name)} in my estimate</small></button>
        <button type="button" class="choice" id="inc-no" data-include="no" aria-pressed="${!on}"><b>Skip</b><small>I don't need this</small></button>
      </div>
      <p class="secnote" id="secnote" data-key="${cur}">${sectionNote(e, cur)}</p>
      ${on ? `<div class="fields">${renderFields(S, cur)}</div>` : ""}`;
  }
  $("stage").innerHTML = html;
  $("back").disabled = step === 0;
  $("next").hidden = cur === "review";
  const nextKey = STEPS[step + 1];
  if (nextKey) $("next").textContent = nextKey === "review" ? "See estimate →" : `Next: ${svcOf(nextKey).name} →`;
  $("count").textContent = `${S.selected.size} of ${SERVICES.length} services included`;
  light();
}

const goTo = i => { step = Math.max(0, Math.min(STEPS.length - 1, i)); render(); $("rail").scrollIntoView({ block: "nearest" }); };

document.addEventListener("click", ev => {
  const t = ev.target.closest("button"); if (!t) return;
  if (t.dataset.include) {
    const k = STEPS[step];
    if (t.dataset.include === "yes") S.selected.add(k); else S.selected.delete(k);
    render(); $(t.id).focus(); return;
  }
  if (t.dataset.pick) { const k = t.dataset.pick; S.selected.has(k) ? S.selected.delete(k) : S.selected.add(k); render(); $(t.id).focus(); return; }
  if (t.dataset.step) { goTo(Number(t.dataset.step)); return; }
  if (t.dataset.period) { period = t.dataset.period; render(); return; }
  if (t.id === "back") { goTo(step - 1); return; }
  if (t.id === "next") { goTo(step + 1); return; }
  if (t.id === "copy") { copyText(summaryText(estimate(S), period), t); return; }
  if (handleFieldEvent(S, ev)) render();
});
["change", "input"].forEach(type => document.addEventListener(type, ev => {
  const r = handleFieldEvent(S, ev); if (r === "full") render(); else if (r === "light") light();
}));

render();
