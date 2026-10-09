// SAHAPRO Document Engine — local Unicode TrueType PDF, no CDN or external data.
import { downloadBlob, shareOrDownload } from "./ui.js";
let fontPromise;
const encoder = new TextEncoder();
const bytes = (s) => encoder.encode(s);
function concat(arr) {
  const r = new Uint8Array(arr.reduce((s, a) => s + a.length, 0));
  let o = 0;
  for (const a of arr) {
    r.set(a, o);
    o += a.length;
  }
  return r;
}
async function font() {
  if (!fontPromise)
    fontPromise = (async () => {
      const response = await fetch(
        new URL("../vendor/DejaVuSans.ttf", import.meta.url),
      );
      if (!response.ok) throw Error("Türkçe PDF fontu yüklenemedi");
      const data = new Uint8Array(await response.arrayBuffer()),
        v = new DataView(data.buffer);
      const tables = {};
      for (let i = 0; i < v.getUint16(4); i++) {
        const o = 12 + i * 16;
        tables[String.fromCharCode(...data.slice(o, o + 4))] = v.getUint32(
          o + 8,
        );
      }
      const units = v.getUint16(tables.head + 18),
        nmetrics = v.getUint16(tables.hhea + 34);
      let cmap;
      const base = tables.cmap;
      for (let i = 0; i < v.getUint16(base + 2); i++) {
        const p = base + 4 + i * 8,
          o = base + v.getUint32(p + 4);
        if (v.getUint16(o) === 4 && (v.getUint16(p) === 3 || !cmap)) cmap = o;
      }
      if (!cmap) throw Error("Unicode font tablosu bulunamadı");
      const seg = v.getUint16(cmap + 6) / 2,
        end = cmap + 14,
        start = end + seg * 2 + 2,
        delta = start + seg * 2,
        range = delta + seg * 2;
      function glyph(code) {
        for (let i = 0; i < seg; i++) {
          const en = v.getUint16(end + 2 * i),
            st = v.getUint16(start + 2 * i);
          if (code > en) continue;
          if (code < st) return 0;
          const d = v.getInt16(delta + 2 * i),
            r = v.getUint16(range + 2 * i);
          if (!r) return (code + d) & 65535;
          const pos = range + 2 * i + r + 2 * (code - st);
          if (pos + 2 > data.length) return 0;
          const g = v.getUint16(pos);
          return g ? (g + d) & 65535 : 0;
        }
        return 0;
      }
      const width = (code) =>
        Math.round(
          (v.getUint16(tables.hmtx + 4 * Math.min(glyph(code), nmetrics - 1)) *
            1000) /
            units,
        );
      return { data, glyph, width };
    })().catch((e) => {
      fontPromise = null;
      throw e;
    });
  return fontPromise;
}
function clean(s) {
  return String(s ?? "")
    .replace(/[^\u0009\u000a\u000d\u0020-\uffff]/gu, "")
    .replace(/\t/g, " ");
}
function hex(s) {
  return [...s]
    .map((c) => c.charCodeAt(0).toString(16).padStart(4, "0"))
    .join("");
}
function wrap(s, width, size, f) {
  const output = [];
  for (const paragraph of clean(s).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      let trial = line ? line + " " + word : word;
      const measure = (t) =>
        [...t].reduce(
          (n, c) => n + (f.width(c.charCodeAt(0)) * size) / 1000,
          0,
        );
      if (measure(trial) <= width) {
        line = trial;
        continue;
      }
      if (line) output.push(line);
      line = "";
      for (const c of word) {
        if (line && measure(line + c) > width) {
          output.push(line);
          line = "";
        }
        line += c;
      }
    }
    output.push(line);
  }
  return output.length ? output : [""];
}
export async function buildDocument(spec) {
  const f = await font(),
    land = spec.orientation === "landscape",
    W = land ? 841.89 : 595.28,
    H = land ? 595.28 : 841.89,
    M = 36,
    bottom = H - 42,
    used = new Set(),
    pages = [],
    images = [];
  let page, y;
  function text(s, x, top, size = 9) {
    s = clean(s);
    for (const c of s) used.add(c.charCodeAt(0));
    page.push(
      `BT /F1 ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${(H - top).toFixed(2)} Tm <${hex(s)}> Tj ET`,
    );
  }
  function line(x1, y1, x2, y2) {
    page.push(`0.72 G 0.35 w ${x1} ${H - y1} m ${x2} ${H - y2} l S 0 g`);
  }
  function newPage() {
    page = [];
    pages.push(page);
    y = 34;
    text("MURATOĞLU HAFRİYAT", M, y, 14);
    y += 20;
    const title = wrap(spec.title || "SAHAPRO", W - 2 * M, 12, f);
    for (const t of title) {
      text(t, M, y, 12);
      y += 15;
    }
    text(
      `${spec.audience === "internal" ? "İç Yönetim Raporu" : "Müşteri Belgesi"} · ${spec.number ? "No: " + spec.number + " · " : ""}${new Date().toLocaleString("tr-TR")}`,
      M,
      y,
      7,
    );
    y += 10;
    line(M, y, W - M, y);
    y += 16;
  }
  newPage();
  function paragraph(value, size = 9) {
    for (const row of wrap(value, W - 2 * M, size, f)) {
      if (y + 14 > bottom) newPage();
      text(row, M, y, size);
      y += size + 5;
    }
    y += 5;
  }
  for (const section of spec.sections || []) {
    if (section.title) {
      if (y + 32 > bottom) newPage();
      paragraph(section.title, 11);
    }
    if (section.pairs)
      for (const [label, value] of section.pairs)
        if (value !== null && value !== undefined && value !== "")
          paragraph(label + ": " + value);
    if (section.text) paragraph(section.text);
    if (section.image) {
      const bitmap = await createImageBitmap(section.image);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");
      context.fillStyle = "white";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      const jpg = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!jpg) throw Error("İmza görüntüsü hazırlanamadı");
      const imageWidth = 180,
        imageHeight = Math.min(
          100,
          (imageWidth * canvas.height) / canvas.width,
        );
      if (y + imageHeight + 15 > bottom) newPage();
      const name = "Im" + images.length;
      images.push({
        name,
        data: new Uint8Array(await jpg.arrayBuffer()),
        width: canvas.width,
        height: canvas.height,
      });
      page.push(
        `q ${imageWidth} 0 0 ${imageHeight} ${M} ${H - y - imageHeight} cm /${name} Do Q`,
      );
      y += imageHeight + 15;
    }
    if (section.headers) {
      const n = section.headers.length;
      if (!n) continue;
      const ratios =
        section.widths ||
        section.headers.map((h, i) =>
          Math.min(
            35,
            Math.max(
              9,
              clean(h).length,
              ...(section.rows || [])
                .slice(0, 80)
                .map((r) => Math.min(clean(r[i]).length, 35)),
            ),
          ),
        );
      const sum = ratios.reduce((a, b) => a + b, 0),
        widths = ratios.map((r) => ((W - 2 * M) * r) / sum);
      const size = n > 7 ? 7 : 8;
      const header = () => {
        const lines = section.headers.map((s, i) =>
            wrap(s, widths[i] - 8, size, f),
          ),
          count = Math.max(...lines.map((a) => a.length));
        if (y + count * 11 + 12 > bottom) newPage();
        let x = M;
        for (let i = 0; i < n; i++) {
          lines[i].forEach((s, k) => text(s, x + 4, y + 10 + k * 11, size));
          x += widths[i];
        }
        y += count * 11 + 8;
        line(M, y, W - M, y);
      };
      header();
      for (const row of section.rows || []) {
        const cells = section.headers.map((_, i) =>
          wrap(row[i] ?? "", widths[i] - 8, size, f),
        );
        let k = 0,
          count = Math.max(...cells.map((c) => c.length));
        while (k < count) {
          if (y + 22 > bottom) {
            newPage();
            header();
          }
          const fit = Math.min(count - k, Math.floor((bottom - y - 8) / 11));
          if (fit < 1) {
            newPage();
            header();
            continue;
          }
          let x = M;
          for (let i = 0; i < n; i++) {
            for (let j = 0; j < fit; j++)
              if (cells[i][k + j])
                text(cells[i][k + j], x + 4, y + 11 + j * 11, size);
            x += widths[i];
          }
          y += fit * 11 + 7;
          line(M, y, W - M, y);
          k += fit;
        }
      }
      y += 12;
    }
  }
  if (spec.signatures) {
    if (y + 65 > bottom) newPage();
    for (let i = 0; i < spec.signatures.length; i++) {
      const x = M + (i * (W - 2 * M)) / spec.signatures.length;
      text(spec.signatures[i], x, y + 12, 9);
      line(x, y + 50, x + (W - 2 * M) / spec.signatures.length - 15, y + 50);
    }
    y += 65;
  }
  for (let i = 0; i < pages.length; i++) {
    page = pages[i];
    text(`SAHAPRO SOLO · Sayfa ${i + 1} / ${pages.length}`, M, H - 24, 7);
  }
  const objs = [];
  const add = (body) => {
    objs.push(typeof body === "string" ? bytes(body) : body);
    return objs.length;
  };
  const stream = (data, extra = "") =>
    concat([
      bytes(`<< /Length ${data.length} ${extra} >>\nstream\n`),
      data,
      bytes("\nendstream"),
    ]);
  const catalog = add(""),
    tree = add(""),
    fontFile = add(stream(f.data, `/Length1 ${f.data.length}`));
  const descriptor = add(
    `<< /Type /FontDescriptor /FontName /DejaVuSans /Flags 32 /FontBBox [-1100 -500 2100 1600] /ItalicAngle 0 /Ascent 928 /Descent -236 /CapHeight 729 /StemV 80 /FontFile2 ${fontFile} 0 R >>`,
  );
  const cidMap = new Uint8Array(131072);
  for (const c of used) {
    const g = f.glyph(c);
    cidMap[c * 2] = g >> 8;
    cidMap[c * 2 + 1] = g & 255;
  }
  const mapping = add(stream(cidMap));
  const sorted = [...used].sort((a, b) => a - b);
  let cmap =
    "/CIDInit /ProcSet findresource begin\n12 dict begin begincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /SAHAPROUnicode def /CMapType 2 def\n1 begincodespacerange <0000> <FFFF> endcodespacerange\n";
  for (let i = 0; i < sorted.length; i += 100) {
    const block = sorted.slice(i, i + 100);
    cmap +=
      block.length +
      " beginbfchar\n" +
      block
        .map(
          (c) =>
            `<${c.toString(16).padStart(4, "0")}> <${c.toString(16).padStart(4, "0")}>`,
        )
        .join("\n") +
      "\nendbfchar\n";
  }
  cmap += "endcmap CMapName currentdict /CMap defineresource pop end end";
  const unicode = add(stream(bytes(cmap)));
  const cidFont = add(
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /DejaVuSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /DW 600 /W [${sorted.map((c) => c + " [" + f.width(c) + "]").join(" ")}] /CIDToGIDMap ${mapping} 0 R >>`,
  );
  const type0 = add(
      `<< /Type /Font /Subtype /Type0 /BaseFont /DejaVuSans /Encoding /Identity-H /DescendantFonts [${cidFont} 0 R] /ToUnicode ${unicode} 0 R >>`,
    ),
    kids = [];
  const imageRefs = images.map((i) => ({
    ...i,
    ref: add(
      stream(
        i.data,
        `/Type /XObject /Subtype /Image /Width ${i.width} /Height ${i.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      ),
    ),
  }));
  for (const commands of pages) {
    const content = add(stream(bytes(commands.join("\n"))));
    kids.push(
      add(
        `<< /Type /Page /Parent ${tree} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${type0} 0 R >> /XObject << ${imageRefs.map((i) => `/${i.name} ${i.ref} 0 R`).join(" ")} >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objs[catalog - 1] = bytes(`<< /Type /Catalog /Pages ${tree} 0 R >>`);
  objs[tree - 1] = bytes(
    `<< /Type /Pages /Kids [${kids.map((k) => k + " 0 R").join(" ")}] /Count ${kids.length} >>`,
  );
  const chunks = [bytes("%PDF-1.7\n")],
    offsets = [0];
  let offset = chunks[0].length;
  for (let i = 0; i < objs.length; i++) {
    offsets.push(offset);
    const chunk = concat([
      bytes(`${i + 1} 0 obj\n`),
      objs[i],
      bytes("\nendobj\n"),
    ]);
    chunks.push(chunk);
    offset += chunk.length;
  }
  chunks.push(
    bytes(
      `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
        .join(
          "",
        )}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${offset}\n%%EOF`,
    ),
  );
  return new Blob(chunks, { type: "application/pdf" });
}
export async function exportDocument(spec, mode = "download") {
  const printWindow = mode === "print" ? window.open("", "_blank") : null;
  if (mode === "print" && !printWindow)
    throw Error("Yazdırma penceresine izin verin");
  try {
    const blob = await buildDocument(spec),
      name = spec.filename || "SAHAPRO_Belge.pdf";
    if (mode === "share") await shareOrDownload(blob, name, spec.title);
    else if (mode === "print") {
      const url = URL.createObjectURL(blob);
      printWindow.location.href = url;
      printWindow.addEventListener("load", () => {
        try {
          printWindow.focus();
          printWindow.print();
        } catch (e) {
          /* PDF viewer print toolbar remains available */
        }
      });
      setTimeout(() => URL.revokeObjectURL(url), 120000);
    } else downloadBlob(blob, name);
    return blob;
  } catch (error) {
    printWindow?.close();
    throw error;
  }
}
