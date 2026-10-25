#!/usr/bin/env python3
"""Synthetic SOLO contract-import fixtures. Not contracts and never for signing.
Run: python3 generate_fixtures.py [output-directory]
Requires reportlab and DejaVu Sans fonts; makes three PDFs and deterministic mock plans.
The plans are test-controlled Gemini responses, NOT evidence of actual Gemini extraction.
"""
from pathlib import Path
import json, os, sys
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)
FONT_DIRS = [Path(os.environ.get('DEJAVU_FONT_DIR', '/usr/share/fonts/truetype/dejavu')), Path('/usr/share/fonts/dejavu')]
FD = next((p for p in FONT_DIRS if (p/'DejaVuSans.ttf').exists()), None)
if FD is None:
    raise RuntimeError('Install fonts-dejavu-core or set DEJAVU_FONT_DIR')
pdfmetrics.registerFont(TTFont('DejaVu', str(FD/'DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DejaVuBold', str(FD/'DejaVuSans-Bold.ttf')))
DATE = '2026-10-25'
COMMON = {
    'customer_name': 'TEST Örnek İnşaat',
    'contract_date': DATE, 'start_date': DATE,
    'kdv_rate': 20, 'kdv_included': False,
    'scope_out': ['İzin ve ruhsatlar müşterinin sorumluluğundadır.'],
    'scrap': None, 'deadline': None,
    'notes': 'Yalnız sentetik uygulama testi. İş yapılmamıştır. Ödeme alınmamıştır. İmzalanmaz.',
}
EXTRAS = [
    {'label': 'Kırıcı', 'unit': 'Saat', 'price': 3000},
    {'label': 'Mini Kazıcı', 'unit': 'Saat', 'price': 2000},
    {'label': 'Kamyon', 'unit': 'Sefer', 'price': 5000},
    {'label': 'İşçilik', 'unit': 'Yevmiye', 'price': 1800},
    {'label': 'Dolgu', 'unit': 'm³', 'price': 900},
    {'label': 'Taşıma', 'unit': 'Ton', 'price': 400},
]
PLANS = {
    'goturu': dict(COMMON, site_name='TEST Yıkım Sahası', basis='Götürü', price=200000,
        scope_in=['Binanın yıkımı', 'Molozun kaldırılması', 'Molozun dökümü'],
        extra_rates=[EXTRAS[0]], payment_plan='%30 avans, kalan iş tamamlandığında.',
        quotes=[{'field':'price','text':'Götürü toplam bedel: 200.000 TL + KDV %20.'},
                {'field':'extra_rates','text':'Ekstra Kırıcı: 3.000 TL / Saat.'},
                {'field':'payment_plan','text':'Ödeme planı: %30 avans, kalan iş tamamlandığında.'}]),
    'extras-six': dict(COMMON, site_name='TEST Altı Ekstra', basis='Götürü', price=120000,
        scope_in=['Ana yıkım işi'], extra_rates=EXTRAS, payment_plan='İş tamamlandığında.',
        quotes=[{'field':'price','text':'Götürü toplam bedel: 120.000 TL + KDV %20.'},
                {'field':'extra_rates','text':'Altı ekstra fiyat aşağıda tanımlanmıştır.'}]),
    # The following is the faithful response for an unsupported hourly-only main agreement.
    # Main equipment rates are NOT silently relabeled as extras or completed work.
    'hourly-only': dict(COMMON, site_name='TEST Saatlik Kiralama', basis=None, price=None,
        scope_in=['Ekskavatör kiralama: planlanan 8 Saat; birim fiyat 2.500 TL / Saat.',
                  'JCB kiralama: planlanan 2 Yevmiye; birim fiyat 15.000 TL / Yevmiye.'],
        extra_rates=[], payment_plan='Planlanan iş tamamlandığında.',
        quotes=[{'field':'scope_in','text':'Ekskavatör: planlanan 8 Saat x 2.500 TL / Saat.'},
                {'field':'scope_in','text':'JCB: planlanan 2 Yevmiye x 15.000 TL / Yevmiye.'},
                {'field':'kdv_rate','text':'Birim fiyatlar KDV hariçtir; KDV oranı %20.'}]),
}

def tl(n):
    return f'{n:,.0f}'.replace(',', '.')

def make(name, title, lines):
    c = canvas.Canvas(str(OUT/(name+'.pdf')), pagesize=A4, pageCompression=1, invariant=1)
    c.setTitle('TEST / ÖRNEK - İMZALANMAZ | '+title)
    c.setAuthor('SAHAPRO sentetik doğrulama')
    W, H = A4
    c.setFillColor(colors.HexColor('#fff4e9')); c.rect(0, H-112, W, 112, fill=1, stroke=0)
    c.setFillColor(colors.HexColor('#9b3000')); c.setFont('DejaVuBold', 21)
    c.drawString(42, H-44, 'TEST / ÖRNEK - İMZALANMAZ')
    c.setFont('DejaVu', 10); c.drawString(42, H-66, 'Yalnız yazılım testi. Gerçek taraf, borç, iş veya ödeme kaydı değildir.')
    c.setFillColor(colors.HexColor('#24374b')); c.setFont('DejaVuBold', 15)
    c.drawString(42, H-94, title)
    # Large pale diagonal watermark remains behind all readable content.
    c.saveState(); c.translate(W/2, H/2); c.rotate(43)
    c.setFillColor(colors.HexColor('#f1e9e1')); c.setFont('DejaVuBold', 43)
    c.drawCentredString(0, 0, 'TEST / ÖRNEK'); c.restoreState()
    y=H-144
    for kind, value in lines:
        if kind=='gap': y-=9; continue
        c.setFont('DejaVuBold' if kind=='head' else 'DejaVu', 10.5)
        c.setFillColor(colors.HexColor('#9b3000') if kind=='head' else colors.HexColor('#24374b'))
        if pdfmetrics.stringWidth(value, 'DejaVuBold' if kind=='head' else 'DejaVu', 10.5) > W-84:
            raise ValueError(f'Line too wide: {value}')
        c.drawString(42, y, value); y-=19
    assert y>85, (name,y)
    c.setStrokeColor(colors.HexColor('#dfb68f')); c.line(42, 76, W-42, 76)
    c.setFillColor(colors.HexColor('#9b3000')); c.setFont('DejaVuBold', 10)
    c.drawString(42, 57, 'İŞ YAPILMAMIŞTIR. ÖDEME ALINMAMIŞTIR. İMZA ALANI YOKTUR.')
    c.setFont('DejaVu', 8.5); c.setFillColor(colors.HexColor('#667281'))
    c.drawString(42, 38, 'Sentetik fixture | 25.10.2026 | Verileri gerçek kayıtlara aktarmayın.')
    c.drawRightString(W-42, 38, '1 / 1')
    c.save()

prefix = lambda p: [('line','Müşteri: '+p['customer_name']),('line','Şantiye / iş: '+p['site_name']),
    ('line','Sözleşme tarihi: '+DATE+' | Başlangıç tarihi: '+DATE),('gap','')]
for name in ['goturu','extras-six']:
    p=PLANS[name]
    lines=prefix(p)+[('head',f'Götürü toplam bedel: {tl(p["price"])} TL + KDV %20.'),
        ('line','Fiyat KDV hariçtir. Bu bedel henüz cariye yazılmamıştır.'),('gap',''),('head','Dahil olan işler:')]
    lines += [('line', '- '+x) for x in p['scope_in']]
    lines += [('line','Hariç: İzin ve ruhsatlar müşterinin sorumluluğundadır.'),('gap',''),('head','Ekstra iş birim fiyatları:')]
    if name=='extras-six': lines += [('line','Altı ekstra fiyat aşağıda tanımlanmıştır.')]
    lines += [('line',f'Ekstra {r["label"]}: {tl(r["price"])} TL / {r["unit"]}.') for r in p['extra_rates']]
    lines += [('gap',''),('line','Ödeme planı: '+p['payment_plan']),('line','Bu yalnız ödeme planıdır; avans veya tahsilat yapılmamıştır.')]
    make(name,'Götürü iş anlaşması - sentetik test',lines)
p=PLANS['hourly-only']
make('hourly-only','Saatlik / yevmiyeli kiralama - sentetik test',prefix(p)+[
    ('head','Ana iş birim fiyatları (ekstra iş değildir):'),
    ('line','Ekskavatör: planlanan 8 Saat x 2.500 TL / Saat.'),
    ('line','JCB: planlanan 2 Yevmiye x 15.000 TL / Yevmiye.'),
    ('line','Birim fiyatlar KDV hariçtir; KDV oranı %20.'),('gap',''),
    ('head','Miktarların niteliği:'),
    ('line','8 saat ve 2 yevmiye yalnız planlanan miktarlardır.'),
    ('line','Bunlar yapılmış iş, kesin ölçüm veya geçmiş faaliyet değildir.'),
    ('line','Götürü toplam, m³ fiyatı veya sefer fiyatı belirlenmemiştir.'),
    ('line','Ekstra iş fiyatı tanımlanmamıştır.'),('gap',''),
    ('line','Hariç: İzin ve ruhsatlar müşterinin sorumluluğundadır.'),
    ('line','Ödeme planı: Planlanan iş tamamlandığında.'),
    ('line','Herhangi bir ödeme veya avans alınmamıştır.')])
(OUT/'mock-plans.json').write_text(json.dumps(PLANS, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'pdfs':[str(OUT/(x+'.pdf')) for x in PLANS], 'mock_plans': str(OUT/'mock-plans.json')}, ensure_ascii=False, indent=2))
