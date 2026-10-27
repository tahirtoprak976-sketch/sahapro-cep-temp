// Single capability catalog for guide, cards and model tool descriptions.
// Model can read/prepare only. Every real write is an existing user-approved service.
const entry = (id, group, title, detail, read, draft, evidence, commit, extra = {}) => ({ id, group, title, detail, read, draft, evidence, commit, model_write: false, ...extra });
export const CAPABILITY_CATALOG = [
  entry("payment_agenda", "Rapor", "Kime ödeme yapacağım?", "Vadeler ve bağlı ödemelerden kalan borçlar; internetsiz.", "Alış ve ödeme kayıtları", "Yerel borç özeti", "Dönem ve taraf", "Yok — salt okuma", { text: "Kime ödeme yapacağım?" }),
  entry("overview", "Rapor", "İşletme panosu", "Dönem, grafik ve kaynak kayıt bağlantıları.", "İş, cari, masraf ve stok", "Kapsamlı okuma panosu", "Dönem/filtre", "Yok — salt okuma", { hash: "#/isletme-panosu" }),
  entry("priorities", "Kontrol", "Bugün ne yapmalıyım?", "Kaynaklı günlük öncelikler; internetsiz.", "Tahsilat, nakit, bakım ve eksikler", "Eylem önerileri", "Güncel kayıtlar", "Yok — salt okuma", { text: "Bugün ne yapmalıyım?" }),
  entry("today", "Rapor", "Bugünkü durum", "İş, tahsilat, maliyet ve ayrı birim özeti.", "Seçili günün kayıtları", "Günlük özet", "Gün", "Yok — salt okuma", { text: "Bugünkü durum" }),
  entry("month", "Rapor", "Bu ayın özeti", "Bu cihazdaki aylık kayıt özeti.", "Aylık seri", "Özet ve eksiklik", "Ay", "Yok — salt okuma", { text: "Bu ayın özeti" }),
  entry("week", "Rapor", "Son 7 günün özeti", "İş, fiyat ve tahsilat özeti.", "Son 7 gün", "Haftalık özet", "Tarih aralığı", "Yok — salt okuma", { text: "Son 7 günün özeti" }),
  entry("pending", "Kontrol", "Bekleyen işler", "Fiyatı eksikler ve inceleme adayları.", "İş ve PDF taslakları", "Bekleyen listesi", "Kayıt eksikleri", "Yok — salt okuma", { text: "Bekleyen işler" }),
  entry("quantity", "Kayıt", "İş miktarını düzelt", "Hedef iş ve miktarı seç; tutar önizlemesi ve onay gerekir.", "Hedef iş kaydı", "Miktar düzeltme taslağı", "İş kimliği ve yeni miktar", "saveExisting + revizyon denetimi", { text: "Dünkü işi 3 saat yap" }),
  entry("work", "Kayıt", "Yeni iş kaydı", "Müşteri, araç, tarih ve miktarı tamamla; kartı onayla.", "Kartlar ve fiyat kuralları", "İş taslağı", "Tarih, müşteri, araç, miktar, fiyat", "saveNew/saveWorkBatch + op koruması", { text: "Yeni iş kaydı oluştur" }),
  entry("cash", "Kayıt", "Tahsilat gir", "Müşteri, tarih, tutar ve yöntemi onayla.", "Müşteri ve kasa", "Tahsilat taslağı", "Tarih, müşteri, tutar, yöntem", "saveCashEvent + op koruması", { text: "Tahsilat gir" }),
  entry("customer_fuel", "Kayıt", "Müşterinin forkliftine mazot", "Depodan düş ve gerçek satış bedeliyle müşteriye borç yaz.", "Depo, müşteri ve fiyat", "Stok+cari önizleme", "Litre, gerçek satış fiyatı, tarih", "Atomik müşteri mazotu servisi", { text: "Müşteri adının forkliftine 20 litre mazot verildi, litresi 45 TL" }),
  entry("fuel", "Kayıt", "Yakıt kaydı", "Araç, litre, tarih ve kaynağı tamamla.", "Araç, depo ve kaynaklar", "Yakıt taslağı", "Araç, litre, tarih, kaynak", "saveFuelEvent + stok denetimi", { text: "Yeni yakıt kaydı oluştur" }),
  entry("expense", "Kayıt", "Gider kaydı", "Tarih, tutar, kategori ve açıklamayı onayla.", "Gider kategorileri", "Gider taslağı", "Tarih, tutar, kategori", "saveNew + op koruması", { text: "Yeni gider ekle" }),
  entry("maintenance", "Kayıt", "Bakım / arıza bildir", "Araç, tarih ve açıklamayı onayla.", "Araç ve bakım planı", "Bakım taslağı", "Araç, tarih, açıklama", "saveNew + op koruması", { text: "Yeni bakım kaydı oluştur" }),
  entry("pdf", "Aktarım", "Geçmiş PDF aktarımı", "Satırları oku ve taslaktan devam et; ilk okuma Gemini ister.", "PDF ve mevcut kayıtlar", "Kontrol taslağı", "Geçerli PDF, açık onay", "Ayrı satır onay servisleri", { hash: "#/akilli-asistan/pdf-gecmis" }),
  entry("wa", "Aktarım", "WhatsApp grubu", "Mesajları ve fotoğrafları kontrol kartlarına hazırla.", "Mesajlar ve güvenli ekler", "Toplu taslak", "Kaynak mesaj/dosya", "Mevcut toplu işlem servisleri", { hash: "#/whatsapp-toplu" }),
  entry("fuel_accounts", "Kontrol", "Mazot alacakları", "Hak/alınan/kalan litreyi ayrı izle.", "İş ve yakıt hareketleri", "Litre hesabı", "Müşteri ve dönem", "Yok — salt okuma", { hash: "#/mazot-hesaplari" }),
  entry("backup", "Kontrol", "Yedek ve geri yükleme", "Yedekleri ayarlardan yönet.", "Yedek kapsamı", "Dışa aktarma / geri yükleme", "Kullanıcı dosyası ve açık onay", "Mevcut yedek servisleri", { hash: "#/ayarlar?tab=yedek" }),
  entry("health", "Kontrol", "Veri sağlığı", "Kopuk bağ ve yarım geri yükleme denetimi.", "Bütünlük sonuçları", "İnceleme listesi", "Kaynak kimlikleri", "Yok — salt okuma", { hash: "#/veri-sagligi" }),
];
export function assistantCapability(id) { return CAPABILITY_CATALOG.find(x => x.id === id) || null; }
export function capabilitiesForTools(tools = []) {
  return tools.map(tool => ({ ...tool, read: tool.description, draft: "Salt okuma veya şemalı öneri", evidence: "Doğrulanmış araç girdileri", commit: "Yok — model doğrudan veritabanına yazamaz", model_write: false }));
}
