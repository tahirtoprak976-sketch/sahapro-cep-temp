#!/usr/bin/env python3
"""SAHAPRO SOLO — İZOLE ÖNİZLEME derlemesi.

Aynı github.io adresi altında (örn. /sahapro-onizleme/) canlı uygulamayla AYNI tarayıcı kökenini paylaşır.
Bu yüzden bütün tarayıcı depolama adları değiştirilir; önizleme gerçek verileri göremez, silemez, bozamaz:
  IndexedDB  sahapro_cep_db            → sahapro_onizleme_db  (+ _recovery)
  Cache      sahapro-solo-* / -share / -wa / -driver → sahapro-onizleme-*  (SW yalnız kendi önekini temizler)
  localStorage  sp_*  → spx_*     sessionStorage solo_* → solox_*
  manifest   id / ad / kapsam ayrı, ekranda "ÖNİZLEME" şeridi
Kullanım:  python3 tools/preview/build.py <çıkış_klasörü>
Çıkış klasörü yalnız önizleme deposuna yayımlanır; canlı dala (gh-pages) KONMAZ.
"""
import os, re, shutil, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "/tmp/sahapro_onizleme")
SKIP = {".git", "tests", "tools", "docs", "preview", "reports", "research_notes", "node_modules"}
REPL = [
    (r'"sahapro_cep_db"', '"sahapro_onizleme_db"'),
    (r'"sahapro_cep_db_"', '"sahapro_onizleme_db_"'),
    (r'sahapro-solo-', 'sahapro-onizleme-'),
    (r'"sahapro-share"', '"sahapro-onizleme-share"'),
    (r'"sahapro-wa"', '"sahapro-onizleme-wa"'),
    (r'"sahapro-driver"', '"sahapro-onizleme-driver"'),
    (r'(["\'])sp_', r'\1spx_'),
    (r'(["\'])solo_(unlocked|history_)', r'\1solox_\2'),
]
# Canlı adlar önizlemede KALMAMALI (doğrulama)
FORBID = [r'"sahapro_cep_db', r'sahapro-solo-', r'"sahapro-share"', r'"sahapro-wa"', r'"sahapro-driver"', r'["\']sp_[a-z]', r'["\']solo_unlocked']

def build():
    if os.path.exists(OUT): shutil.rmtree(OUT)
    shutil.copytree(ROOT, OUT, ignore=lambda d, names: [n for n in names if n in SKIP and os.path.samefile(d, ROOT)])
    changed = 0
    for dp, _, files in os.walk(OUT):
        for f in files:
            if not f.endswith((".js", ".html", ".webmanifest")): continue
            p = os.path.join(dp, f); s = open(p, encoding="utf-8").read(); o = s
            if "/vendor/" in p.replace("\\", "/"): continue
            for a, b in REPL: s = re.sub(a, b, s)
            if s != o: open(p, "w", encoding="utf-8").write(s); changed += 1
    m = json.load(open(os.path.join(OUT, "manifest.webmanifest"), encoding="utf-8"))
    m.update({"id": "sahapro-onizleme", "name": "SAHAPRO ÖNİZLEME (test)", "short_name": "SAHAPRO TEST", "theme_color": "#8a1c1c"})
    m.pop("share_target", None)  # paylaşım hedefi canlı uygulamada kalsın (iki uygulama aynı paylaşımı yakalamasın)
    json.dump(m, open(os.path.join(OUT, "manifest.webmanifest"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    idx = os.path.join(OUT, "index.html"); s = open(idx, encoding="utf-8").read()
    banner = '<div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#8a1c1c;color:#fff;font:600 12px/1.6 system-ui;text-align:center;pointer-events:none">ÖNİZLEME — test verisi, gerçek kayıtlar burada değil</div>'
    s = s.replace("<body>", "<body>" + banner, 1) if "<body>" in s else re.sub(r"(<body[^>]*>)", r"\1" + banner, s, count=1)
    open(idx, "w", encoding="utf-8").write(s)
    # Doğrulama
    bad = []
    for dp, _, files in os.walk(OUT):
        if "/vendor" in dp.replace("\\", "/"): continue
        for f in files:
            if not f.endswith((".js", ".html", ".webmanifest")): continue
            p = os.path.join(dp, f); s = open(p, encoding="utf-8").read()
            for pat in FORBID:
                for mm in re.finditer(pat, s): bad.append(f"{os.path.relpath(p, OUT)}: {mm.group(0)}")
    if bad:
        print("HATA: canlı depolama adı önizlemede kaldı:\n  " + "\n  ".join(bad[:20])); sys.exit(1)
    print(f"Önizleme hazır: {OUT} ({changed} dosya değişti, canlı depolama adı yok)")

if __name__ == "__main__":
    build()
