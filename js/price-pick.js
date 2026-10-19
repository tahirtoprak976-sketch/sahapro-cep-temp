// Ekranlar için fiyat seçimi: belirsiz kuralda kullanıcıya sorar (sessiz seçim yok). Kayıt yazmaz.
import { priceDecision, candidateLabel } from "./price-decision.js";
import { priceSnapshot } from "./business.js";
import { choiceDialog } from "./ui.js";

// Dönüş: { snap } (kural ya da fiyatsız → snap null) | { cancel: true }
// memo: aynı aday kümesi için bir kez sorulsun (toplu satırlar)
export async function askPriceSnapshot(entries, w, crane, { title = "Hangi fiyat kuralı uygulansın?", label = "", memo = null } = {}) {
  const dec = priceDecision(entries, w);
  if (!dec.ambiguous) return { snap: priceSnapshot(w, entries, crane) };
  const key = dec.candidates.map((c) => c.id).sort().join(",");
  let pick = memo?.has(key) ? memo.get(key) : undefined;
  if (pick === undefined) {
    pick = await choiceDialog(title, `${label ? label + ": " : ""}${dec.reason}`, [...dec.candidates.map((c) => [c.id, candidateLabel(c)]), ["", "Fiyatsız bırak (sonra girerim)"]]);
    if (pick == null) return { cancel: true };
    memo?.set(key, pick);
  }
  if (!pick) return { snap: null };
  const snap = priceSnapshot(w, entries.filter((x) => x.id === pick).map((x) => ({ ...x, valid_from: null, valid_to: null })), crane);
  if (snap) snap.price_choice = "kullanıcı seçti: " + dec.reason;
  return { snap };
}
