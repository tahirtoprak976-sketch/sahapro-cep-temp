// Every module delegates to one offline document engine.
import { fmtTL, fmtNum, trDate, daySummary } from "./core.js";
import { customerWorkLines } from "./business.js";
import { exportDocument } from "./document-engine.js";
const tl = (n) => fmtTL(n) + " TL";
const name = (names, store, id) => names[store]?.[id] || "—";
export async function tableReportPdf(title, headers, rows, total, filename) {
  return exportDocument({
    title,
    audience: "internal",
    orientation: headers.length > 6 ? "landscape" : "portrait",
    filename: filename || "SAHAPRO_Rapor.pdf",
    sections: [{ headers, rows }, { text: total || "" }],
  });
}
export function slipSpec(s, names, sigBlob) {
  if ((s.status === "İmzalandı" || s.signed_at) && !sigBlob)
    throw Error("İmzalı fişin imzası bulunamadı; PDF engellendi");
  return {
    title: "Dijital İş Fişi",
    number: s.slip_no,
    audience: "customer",
    filename: `SAHAPRO_Fis_${s.slip_no}.pdf`,
    sections: [
      {
        pairs: [
          ["Tarih", trDate(s.date)],
          ["Durum", s.status],
          ["Müşteri", name(names, "customers", s.customer_id)],
          ["Şantiye", name(names, "sites", s.site_id)],
          ["Araç", name(names, "vehicles", s.vehicle_id)],
          ["Plaka", s.plate],
          ["Yapılan iş", s.work_text],
          ["Miktar", fmtNum(s.quantity) + " " + s.unit],
          ["Açıklama", s.description],
          ["Teslim alan", s.receiver_name],
        ],
      },
      ...(s.customer_items?.length
        ? [
            {
              headers: ["Şantiye", "İş", "Miktar", "Birim", "Birim fiyat"],
              rows: customerWorkLines(s.customer_items).map((i) => [
                name(names, "sites", i.site_id),
                i.work_type,
                fmtNum(i.quantity),
                i.unit,
                i.unit_price == null ? "—" : tl(i.unit_price),
              ]),
            },
          ]
        : []),
      ...(sigBlob
        ? [{ title: "Teslim Alan İmzası", image: sigBlob, text: s.signed_at }]
        : [{ text: "TASLAK — imza bekleniyor" }]),
    ],
  };
}
export async function slipPdf(s, names, sigBlob) {
  return exportDocument(slipSpec(s, names, sigBlob));
}
export const COMMERCIAL_LABELS = {
  title: "Başlık",
  valid_until: "Geçerlilik",
  contact: "Yetkili",
  phone: "Telefon",
  email: "E-posta",
  scope: "İşin kapsamı",
  payment_terms: "Ödeme koşulları",
  maturity: "Vade",
  schedule: "İş programı",
  delivery_time: "Teslim süresi",
  fuel_terms: "Mazot",
  dump_terms: "Döküm",
  special_terms: "Özel şartlar",
  general_terms: "Genel şartlar",
  notes: "Notlar",
  start_date: "Başlangıç",
  end_date: "Bitiş",
  progress_period: "Hakediş periyodu",
  safety_terms: "İş güvenliği",
  responsibilities: "Taraf sorumlulukları",
  termination_terms: "Fesih koşulları",
  extra_terms: "Ek maddeler",
};
export function commercialSpec(t, names, tot, contract = false) {
  return {
    title: contract ? t.template || "Hizmet Sözleşmesi" : "Teklif",
    number: contract ? t.contract_no : t.quote_no,
    audience: "customer",
    filename: `SAHAPRO_${contract ? "Sozlesme" : "Teklif"}_${contract ? t.contract_no : t.quote_no}.pdf`,
    sections: [
      {
        pairs: [
          ["Tarih", trDate(t.date)],
          ["Müşteri", name(names, "customers", t.customer_id)],
          ["Şantiye", name(names, "sites", t.site_id)],
          ["Fiyatlandırma", t.type || t.pricing_method],
          ["Durum", t.status],
          ...Object.entries(COMMERCIAL_LABELS).map(([k, l]) => [l, t[k]]),
        ],
      },
      {
        title: "Fiyat Kalemleri",
        headers: ["Kalem", "Birim", "Miktar", "Birim Fiyat", "Tutar"],
        rows: tot.lines.map((l) => [
          l.label,
          l.unit,
          l.quantity ? fmtNum(l.quantity) : "—",
          tl(l.unit_price),
          l.line_total == null ? "—" : tl(l.line_total),
        ]),
      },
      {
        pairs: tot.show_total
          ? [
              ["Ara toplam", tl(tot.subtotal)],
              ["KDV %" + tot.kdv_rate, tl(tot.kdv)],
              ["Genel toplam", tl(tot.grand)],
            ]
          : [["KDV", "%" + tot.kdv_rate]],
        text: tot.show_total
          ? ""
          : t.type === "ALTERNATIVE"
            ? "Alternatif kalemler toplanmaz."
            : "Birim fiyatlar toplanmaz. Gerçekleşen miktarlar üzerinden hakediş yapılır.",
      },
    ],
    signatures: contract ? ["İşveren", "Yüklenici"] : null,
  };
}
export async function quotePdf(t, names, tot) {
  return exportDocument(commercialSpec(t, names, tot));
}
export function hakedisSpec(h, names) {
  const row = (i) => [
    trDate(i.date),
    [i.site_name, i.work_type, i.material].filter(Boolean).join(" · "),
    i.vehicle_name,
    fmtNum(i.quantity),
    i.unit,
    i.formula
      ? "Vinç tarifesi"
      : tl(i.unit_price) + (i.kdv_included ? " (KDV dahil)" : " (+KDV)"),
    tl(i.total),
  ];
  return {
    title: "Hakediş",
    number: h.hakedis_no,
    audience: "customer",
    filename: `SAHAPRO_Hakedis_${h.hakedis_no}.pdf`,
    orientation: "landscape",
    sections: [
      {
        pairs: [
          ["Müşteri", name(names, "customers", h.customer_id)],
          ["Şantiye", name(names, "sites", h.site_id)],
          ["Dönem", trDate(h.date_from) + " — " + trDate(h.date_to)],
          ["Durum", h.status],
        ],
      },
      ...["Sefer", "Makine"]
        .filter((group) =>
          (h.items || []).some((i) =>
            group === "Sefer" ? i.unit === "Sefer" : i.unit !== "Sefer",
          ),
        )
        .map((group) => ({
          title:
            group === "Sefer" ? "Nakliye Kalemleri" : "Makine / Diğer Kalemler",
          headers: [
            "Tarih",
            "İş",
            "Araç",
            "Miktar",
            "Birim",
            "Fiyat",
            "KDV Dahil Tutar",
          ],
          rows: customerWorkLines(h.items || [])
            .filter((i) =>
              group === "Sefer" ? i.unit === "Sefer" : i.unit !== "Sefer",
            )
            .map(row),
        })),
      {
        pairs: [
          ["Ara toplam", tl(h.subtotal)],
          ["KDV", tl(h.kdv_total)],
          ["Genel toplam", tl(h.grand_total)],
        ],
      },
    ],
  };
}
export async function hakedisPdf(h, names) {
  return exportDocument(hakedisSpec(h, names));
}
export async function dailyReportPdf(date, data, names) {
  const sum = daySummary(date, data);
  return exportDocument({
    title: "Günlük Operasyon Raporu",
    number: date,
    audience: "internal",
    filename: `SAHAPRO_Gunluk_${date}.pdf`,
    sections: [
      {
        pairs: [
          ["İş sayısı", sum.work_count],
          ["Sefer", sum.total_sefer],
          ["Saat", sum.total_saat],
          ["Yevmiye", sum.total_yevmiye],
          ["Yakıt", fmtNum(sum.fuel_liters) + " Lt"],
          ["Gider", tl(sum.expense_total)],
          ["Tahsilat", tl(sum.tahsilat_total)],
        ],
      },
      {
        headers: ["Müşteri", "Araç", "İş", "Miktar"],
        rows: (data.work_records || [])
          .filter((w) => !w.deleted_at && w.date === date)
          .map((w) => [
            name(names, "customers", w.customer_id),
            name(names, "vehicles", w.vehicle_id),
            w.work_type,
            fmtNum(w.quantity) + " " + w.unit,
          ]),
      },
    ],
  });
}
export async function tankPdf(rows, bal, names) {
  return tableReportPdf(
    "Depo Tank Raporu",
    ["Tarih", "İşlem", "Litre", "Araç", "Personel"],
    rows.map((r) => [
      trDate(r.date),
      r.move_type,
      fmtNum(r.liters),
      name(names, "vehicles", r.vehicle_id),
      name(names, "personnel", r.personnel_id),
    ]),
    `Giriş ${fmtNum(bal.in)} Lt · Çıkış ${fmtNum(bal.out)} Lt · Kalan ${fmtNum(bal.remaining)} Lt`,
    "SAHAPRO_Tank.pdf",
  );
}
