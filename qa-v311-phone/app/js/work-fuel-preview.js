import { watchRecords } from "./record-refresh.js";
// Manuel işte yalnız görünüm ve kayıt öncesi kontrol. Para/yakıt/iş kaydı yazmaz.
import { fuelAllowance, fuelRulesOf } from "./assistant-rules.js";
import { whyNoRule } from "./fuel-audit.js";
import { collectForm, esc, fmtNum, notice } from "./ui.js";

export function workFuelState(
  data,
  fields,
  previous = null,
  manualPrice = false,
) {
  const oldLiters = Number(previous?.customer_fuel_allowance_l) || 0;
  const quantity = Number(fields.quantity);
  if (
    oldLiters > 0 &&
    previous.customer_id === fields.customer_id &&
    previous.unit === fields.unit
  ) {
    const per =
      Number(previous.price_snapshot?.fuel_liters_per_unit) ||
      oldLiters / Number(previous.quantity);
    const liters =
      Number(previous.quantity) === quantity
        ? oldLiters
        : Math.round(per * quantity * 10) / 10;
    return {
      status: quantity > 0 ? "preserved" : "incomplete",
      liters: quantity > 0 ? liters : 0,
      per,
      only_pay:
        previous.price_snapshot?.price_source === "Mazot karşılığı" &&
        !manualPrice,
      rule_id: previous.fuel_rule_id || null,
      unit: previous.unit,
      locked: !!previous.price_snapshot?.locked,
    };
  }
  const customer = (data.customers || []).find(
    (c) => c.id === fields.customer_id && !c.deleted_at,
  );
  if (!customer || !fuelRulesOf(customer).length)
    return { status: "none", liters: 0 };
  if (!fields.date || !fields.unit || !(quantity > 0))
    return { status: "incomplete", liters: 0, customer: customer.name };
  const allowance = fuelAllowance(data, fields, "");
  return allowance
    ? { status: "matched", ...allowance }
    : {
        status: "unmatched",
        liters: 0,
        customer: customer.name,
        reasons: whyNoRule(data, fields, customer),
      };
}

// Yalnız mali sonucu karşılaştır: kuralın açıklama değişikliği yazmayı gereksiz engellemez.
export const fuelDecisionKey = (state) =>
  JSON.stringify({
    liters: state.liters || 0,
    only_pay: !!state.only_pay,
    rule_id: state.rule_id || null,
  });

export function bindWorkFuelPreview({ form, db, data, previous = null }) {
  const box = form.querySelector("[data-work-fuel-preview]");
  let stopped = false,
    revision = 0;
  const read = () => collectForm(form);
  const manual = (fields) =>
    fields.manual_price != null && fields.manual_price !== "";
  const draw = () => {
    if (stopped || !form.isConnected) return;
    const fields = read(),
      state = workFuelState(data, fields, previous, manual(fields));
    box.hidden = state.status === "none";
    box.dataset.fuelStatus = state.status;
    if (state.status === "none") {
      box.innerHTML = "";
      return state;
    }
    let text;
    if (state.status === "incomplete")
      text =
        "Bu müşteride mazot kuralı var. Bu satırın litre hakkını görmek için tarih, miktar ve birimi tamamlayın.";
    else if (state.status === "unmatched")
      text =
        "Mazot kuralı bu satırla eşleşmiyor: " +
        state.reasons.join(" · ") +
        ". Alanları veya müşteri kuralını kontrol edin; beklemek eşleşmeyi değiştirmez.";
    else
      text =
        (state.status === "preserved"
          ? "Kayıtlı mazot anlaşması korunuyor"
          : "Mazot kuralı eşleşti") +
        ": " +
        fmtNum(state.per) +
        " L / " +
        state.unit +
        " × " +
        fmtNum(fields.quantity) +
        " = " +
        fmtNum(state.liters) +
        " L." +
        (state.only_pay
          ? " Ücret yalnız mazot: bu satırın TL iş tutarı 0 ₺ olur."
          : " İşin TL fiyatı ayrıca korunur.") +
        (state.locked
          ? " Kesinleşmiş kaydı değiştirmek için hakedişi inceleyin."
          : " Kaydetmeden önce bu bir önizlemedir; mazot alınmış sayılmaz.");
    box.innerHTML =
      notice(state.status === "unmatched" ? "warn" : "info", esc(text)) +
      '<button class="btn sm" type="button" data-refresh-fuel>Kuralı yenile</button><div class="tiny muted" data-fuel-refresh></div>';
    box.querySelector("[data-refresh-fuel]").onclick = () => refresh(true);
    return state;
  };
  const remember = (customer) => {
    const i = data.customers.findIndex((c) => c.id === customer.id);
    if (i >= 0) data.customers[i] = customer;
    else data.customers.push(customer);
  };
  const refresh = async (explicit = false) => {
    const version = ++revision,
      cid = read().customer_id;
    if (!cid || cid.startsWith("__")) return;
    try {
      const customer = await db.get("customers", cid);
      if (
        stopped ||
        version !== revision ||
        !form.isConnected ||
        read().customer_id !== cid
      )
        return;
      if (customer) remember(customer);
      draw();
      if (explicit && box.querySelector("[data-fuel-refresh]"))
        box.querySelector("[data-fuel-refresh]").textContent =
          "Bu telefondaki güncel kayıt kontrol edildi.";
    } catch (error) {
      if (explicit && !stopped && box.querySelector("[data-fuel-refresh]"))
        box.querySelector("[data-fuel-refresh]").textContent =
          "Kural yenilenemedi: " + error.message;
    }
  };
  const input = (e) => {
    draw();
    if (e.target.name === "customer_id") void refresh();
  };
  const focus = () => {
    if (document.visibilityState !== "hidden") void refresh();
  };
  form.addEventListener("input", input);
  form.addEventListener("change", input);
  window.addEventListener("focus", focus);
  window.addEventListener("pageshow", focus);
  document.addEventListener("visibilitychange", focus);
  let database = null;
  db.openDB().then((connection) => {
    database = connection.name;
  });
  const unwatch = watchRecords((message) => {
    if (message.database === database && message.stores.includes("customers"))
      void refresh();
  });
  const observer = new MutationObserver(() => {
    if (!form.isConnected) {
      stopped = true;
      unwatch();
      revision++;
      window.removeEventListener("focus", focus);
      window.removeEventListener("pageshow", focus);
      document.removeEventListener("visibilitychange", focus);
      observer.disconnect();
    }
  });
  observer.observe(form.closest("#screen").parentNode, { childList: true });
  draw();
  void refresh();
  return {
    check(latest, fields) {
      const input = read(),
        was = workFuelState(data, fields, previous, manual(input)),
        now = workFuelState(latest, fields, previous, manual(input));
      for (const customer of latest.customers || []) remember(customer);
      draw();
      if (fuelDecisionKey(was) !== fuelDecisionKey(now))
        throw Error(
          "Müşterinin mazot kuralı değişti. Güncel litre önizlemesini kontrol edip tekrar Kaydet’e basın. Henüz iş kaydedilmedi.",
        );
      return now;
    },
  };
}
