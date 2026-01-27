/* CMS Post-Auction Portal (client-only) — FULL app.js
   Updates included (per your latest notes):

   1) Header tweaks
      - Buyer/Consignor/Rep name moved DOWN (prevents print cutoff)
      - Buyer name slightly bigger
      - Buyer name + Auction name + Auction date shown on EVERY page

   2) Colored line
      - Thin colored line runs FULL width of page (edge-to-edge)

   3) Lot layout changes
      - "Lot # " prefix
      - Breed moved to a NEW line under Lot/Seller
      - Column grid: centered labels + centered values
      - Down money REMOVED from the grid line (still shown in dedicated row below)
      - Grid spans full content width
      - If cell value doesn't fit, it WRAPS to additional lines and the cell/row HEIGHT expands
      - “All information must be on the page” — no truncation; wrapping is used instead

   4) Buyer footer fixes
      - Space added after last lot before footer
      - "Total Down Money Due: $X" moved to RIGHT side in a BOX
      - Footer text spacing adjusted to prevent overlap
      - If footer won’t fit, it moves to a new page cleanly

   Requires in index.html BEFORE app.js:
     papaparse, pdf-lib, jszip
*/

const CONFIG = {
  PIN: "0623",

  COLS: {
    buyer: "Buyer",
    consignor: "Consignor",
    rep: "Representative",
    breed: "Breed", // optional; fallback to Description

    lotNumber: "Lot Number",
    lotSeq: "Lot Sequence",
    head: "Head Count",
    loads: "Load Count",
    description: "Description",
    secondDescription: "Second Description",
    sex: "Sex",
    baseWeight: "Base Weight",
    delivery: "Delivery",
    location: "Location",
    shrink: "Shrink",
    slide: "Slide",
    price: "Calculated High Bid",
    downMoney: "Down Money Due",
  },

  PDF: {
    // LANDSCAPE letter
    pageSize: { width: 792, height: 612 },
    margin: 26,

    // full-width top bar
    topBarH: 8,

    // header heights
    headerHFirst: 74,   // page 1
    headerHOther: 42,   // pages 2+

    // typography
    buyerNameSize: 13.8,      // slightly bigger than before
    otherNameSize: 12.3,
    headerSmall: 10.0,
    title: 12.2,

    // lot typography
    lotTitle: 10.4,
    lotBreed: 9.4,
    gridLabel: 7.7,
    gridValue: 8.6,
    notes: 7.8,

    // line heights
    gridLineH: 10.2,
    notesLineH: 10.0,

    // spacing
    lotGap: 10,
    spaceBeforeFooter: 14,

    // padding
    padX: 8,
    cellPadX: 5,
    cellPadY: 4,

    // footer
    footerLineH: 10.8,
    footerMinH: 98,

    // boxes
    borderW: 1.0,
    innerW: 0.8,
  }
};

// ====== DOM ======
const pageAuth = document.getElementById("pageAuth");
const pageBuilder = document.getElementById("pageBuilder");
const pageResults = document.getElementById("pageResults");

const pinInput = document.getElementById("pinInput");
const pinSubmit = document.getElementById("pinSubmit");
const authError = document.getElementById("authError");

const auctionName = document.getElementById("auctionName");
const auctionDate = document.getElementById("auctionDate");
const auctionLabel = document.getElementById("auctionLabel");

const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const fileMeta = document.getElementById("fileMeta");

const chkBuyer = document.getElementById("chkBuyer");
const chkConsignor = document.getElementById("chkConsignor");
const chkRep = document.getElementById("chkRep");
const buildBtn = document.getElementById("buildBtn");
const builderError = document.getElementById("builderError");

const listBuyers = document.getElementById("listBuyers");
const listConsignors = document.getElementById("listConsignors");
const listReps = document.getElementById("listReps");

const zipBuyers = document.getElementById("zipBuyers");
const zipConsignors = document.getElementById("zipConsignors");
const zipReps = document.getElementById("zipReps");
const zipAll = document.getElementById("zipAll");

const backBtn = document.getElementById("backBtn");
const exitBtn = document.getElementById("exitBtn");
const resultsMeta = document.getElementById("resultsMeta");

// ====== STATE ======
let csvRows = [];
let generated = { buyers: [], consignors: [], reps: [] };
let blobUrls = [];

// ====== UTIL ======
function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }
function goto(page){
  [pageAuth, pageBuilder, pageResults].forEach(hide);
  show(page);
}
function setError(el, msg){
  if(!msg){ hide(el); el.textContent=""; return; }
  el.textContent = msg;
  show(el);
}

/**
 * Critical: sanitize for pdf-lib StandardFonts (WinAnsi)
 * - removes newlines/control chars (fixes 0x000a)
 * - normalizes smart punctuation
 */
function safeStr(v){
  if(v === null || v === undefined) return "";
  return String(v)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .trim();
}
function toNumber(v){
  const s = safeStr(v);
  if(!s) return 0;
  const cleaned = s.replace(/\$/g,"").replace(/,/g,"").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
function formatMoney(n){
  const fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + fmt.format(Number.isFinite(n) ? n : 0);
}
function priceDisplay(v){
  const n = toNumber(v);
  return (n === 0) ? "PO" : formatMoney(n);
}
function downMoneyDisplay(v){
  const n = toNumber(v);
  return formatMoney(n);
}
function fileSafeName(name){
  return safeStr(name)
    .replace(/[\/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
function sortLots(a,b){
  const sa = toNumber(a[CONFIG.COLS.lotSeq]);
  const sb = toNumber(b[CONFIG.COLS.lotSeq]);
  if(sa !== sb) return sa - sb;
  const la = toNumber(a[CONFIG.COLS.lotNumber]);
  const lb = toNumber(b[CONFIG.COLS.lotNumber]);
  return la - lb;
}
function groupBy(rows, key){
  const map = new Map();
  for(const r of rows){
    const k = safeStr(r[key]);
    if(!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}
function assertLibsLoaded(){
  if(!window.PDFLib) throw new Error("PDF library not loaded (PDFLib). Check index.html script tag for pdf-lib.");
  if(!window.Papa) throw new Error("CSV parser not loaded (Papa). Check index.html script tag for papaparse.");
  if(!window.JSZip) throw new Error("ZIP library not loaded (JSZip). Check index.html script tag for jszip.");
}
function requiredColsPresent(rows){
  const required = Object.values(CONFIG.COLS).filter(c => c !== CONFIG.COLS.breed);
  const row0 = rows[0] || {};
  const keys = new Set(Object.keys(row0));
  const missing = required.filter(c => !keys.has(c));
  return { ok: missing.length === 0, missing };
}

// ====== TEXT + WRAP HELPERS ======
function textWidth(font, text, size){
  return font.widthOfTextAtSize(text || "", size);
}
function wrapLinesByWords(font, text, size, maxW){
  const words = safeStr(text).split(/\s+/).filter(Boolean);
  if(words.length === 0) return [""];
  const lines = [];
  let line = words[0];
  for(let i=1;i<words.length;i++){
    const test = line + " " + words[i];
    if(textWidth(font, test, size) <= maxW){
      line = test;
    }else{
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}
function drawCenteredLines(page, font, lines, xCenter, yTop, lineH, size, color){
  let y = yTop;
  for(const ln of lines){
    const w = textWidth(font, ln, size);
    page.drawText(ln, { x: xCenter - w/2, y, size, font, color });
    y -= lineH;
  }
  return y;
}

// ====== AUTH ======
pinSubmit.addEventListener("click", () => {
  const entered = safeStr(pinInput.value);
  if(entered === CONFIG.PIN){
    setError(authError, "");
    pinInput.value = "";
    goto(pageBuilder);
  }else{
    setError(authError, "Incorrect PIN.");
  }
});
pinInput.addEventListener("keydown", (e)=>{
  if(e.key === "Enter") pinSubmit.click();
});

// ====== FILE UPLOAD ======
function setBuildEnabled(){
  const anyChecked = chkBuyer.checked || chkConsignor.checked || chkRep.checked;
  buildBtn.disabled = !(csvRows.length > 0 && anyChecked);
}
function handleFile(file){
  setError(builderError, "");
  if(!file) return;

  fileMeta.textContent = `Loaded: ${file.name || "uploaded.csv"}`;
  show(fileMeta);

  try{
    assertLibsLoaded();
  }catch(err){
    setError(builderError, err.message);
    csvRows = [];
    setBuildEnabled();
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      csvRows = (results.data || []).filter(r => Object.values(r).some(v => safeStr(v) !== ""));
      if(csvRows.length === 0){
        setError(builderError, "CSV parsed, but it contains no rows.");
        return;
      }

      // sanitize everything immediately
      csvRows = csvRows.map(row => {
        const cleaned = {};
        for(const k of Object.keys(row)) cleaned[k] = safeStr(row[k]);
        return cleaned;
      });

      const chk = requiredColsPresent(csvRows);
      if(!chk.ok){
        setError(builderError, `CSV is missing required column(s): ${chk.missing.join(", ")}`);
        csvRows = [];
        setBuildEnabled();
        return;
      }

      setBuildEnabled();
    },
    error: () => {
      setError(builderError, "Could not parse CSV. Make sure it's a valid CSV export.");
      csvRows = [];
      setBuildEnabled();
    }
  });
}
fileInput.addEventListener("change", (e) => handleFile(e.target.files?.[0]));
dropZone.addEventListener("dragover", (e)=>{ e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave", ()=> dropZone.classList.remove("dragover"));
dropZone.addEventListener("drop", (e)=>{
  e.preventDefault();
  dropZone.classList.remove("dragover");
  handleFile(e.dataTransfer.files?.[0]);
});
[chkBuyer, chkConsignor, chkRep].forEach(el => el.addEventListener("change", setBuildEnabled));

// ====== EXIT / WIPE ======
function wipeAll(){
  for(const u of blobUrls){
    try{ URL.revokeObjectURL(u); }catch{}
  }
  blobUrls = [];

  csvRows = [];
  generated = { buyers:[], consignors:[], reps:[] };

  fileInput.value = "";
  fileMeta.textContent = "";
  hide(fileMeta);

  auctionName.value = "";
  auctionDate.value = "";
  auctionLabel.value = "";

  listBuyers.innerHTML = "";
  listConsignors.innerHTML = "";
  listReps.innerHTML = "";

  zipBuyers.disabled = true;
  zipConsignors.disabled = true;
  zipReps.disabled = true;
  zipAll.disabled = true;

  resultsMeta.textContent = "";

  setBuildEnabled();
  goto(pageAuth);
}
exitBtn.addEventListener("click", wipeAll);
window.addEventListener("beforeunload", ()=>{
  for(const u of blobUrls){
    try{ URL.revokeObjectURL(u); }catch{}
  }
});

// ====== PDF GENERATION ======
async function buildPdfForGroup({entityName, rows, mode}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const BLACK = rgb(0,0,0);
  const WHITE = rgb(1,1,1);
  const GRID = rgb(0.55, 0.55, 0.55);
  const FILL = rgb(0.98, 0.98, 0.98);

  const topBarColor =
    mode === "buyer" ? rgb(0.20, 0.39, 0.60) :
    mode === "consignor" ? rgb(0.55, 0.55, 0.55) :
    rgb(0.15, 0.15, 0.15);

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const contentW = W - 2*M;

  // Full-width grid columns (no Down Money column)
  // Sum MUST equal contentW (740 with M=26)
  const colDefs = [
    { key: "loads", label: "Loads",   w: 45 },
    { key: "head",  label: "Head",    w: 45 },
    { key: "sex",   label: "Sex",     w: 50 },
    { key: "bw",    label: "Base Wt", w: 60 },
    { key: "del",   label: "Delivery",w: 95 },
    { key: "loc",   label: "Location",w: 130 },
    { key: "shr",   label: "Shrink",  w: 55 },
    { key: "sld",   label: "Slide",   w: 150 },
    { key: "price", label: "Price",   w: 110 },
  ];
  const gridX = M;
  const gridW = colDefs.reduce((s,c)=>s+c.w,0); // should be contentW

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  const leftLabel =
    mode === "buyer" ? "Buyer" : (mode === "consignor" ? "Consignor" : "Rep");

  const centerTitle =
    mode === "buyer" ? "Buyer Recap and Down Money Invoice" : "Trade Confirmations";

  const nameSize =
    mode === "buyer" ? CONFIG.PDF.buyerNameSize : CONFIG.PDF.otherNameSize;

  let page = pdfDoc.addPage([W,H]);
  let pageIndex = 0;

  // cursor
  let y = H - M;

  function drawTopBar(){
    // FULL width edge-to-edge
    page.drawRectangle({
      x: 0,
      y: H - CONFIG.PDF.topBarH,
      width: W,
      height: CONFIG.PDF.topBarH,
      color: topBarColor
    });
  }

  function drawHeader(){
    drawTopBar();

    const headerH = (pageIndex === 0) ? CONFIG.PDF.headerHFirst : CONFIG.PDF.headerHOther;

    // Move everything DOWN a bit to avoid print cutoff
    const topY = H - CONFIG.PDF.topBarH - 18;

    // Left: entity name (bigger), then auction title + date
    const lx = M;
    page.drawText(`${leftLabel}: ${safeStr(entityName)}`, {
      x: lx,
      y: topY,
      size: nameSize,
      font: fontBold,
      color: BLACK
    });

    page.drawText(safeStr(auctionTitle), {
      x: lx,
      y: topY - 14,
      size: CONFIG.PDF.headerSmall,
      font,
      color: BLACK
    });

    if(aDate){
      page.drawText(safeStr(aDate), {
        x: lx,
        y: topY - 26,
        size: CONFIG.PDF.headerSmall,
        font,
        color: BLACK
      });
    }

    // Center title ONLY on first page (keeps later pages tighter)
    if(pageIndex === 0){
      const tW = textWidth(fontBold, centerTitle, CONFIG.PDF.title);
      page.drawText(centerTitle, {
        x: M + (contentW - tW)/2,
        y: topY - 14,
        size: CONFIG.PDF.title,
        font: fontBold,
        color: BLACK
      });
    }

    // y start under header block
    y = H - CONFIG.PDF.topBarH - headerH;
  }

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    pageIndex += 1;
    y = H - M;
    drawHeader(); // header on EVERY page
  }

  // initial header
  drawHeader();

  // rep group separator
  let currentConsignor = "";
  function drawRepConsignorDivider(name){
    const barH = 16;
    page.drawRectangle({
      x: M,
      y: y - barH,
      width: contentW,
      height: barH,
      color: rgb(0.92,0.92,0.92),
      borderWidth: CONFIG.PDF.innerW,
      borderColor: GRID
    });
    page.drawText(`Consignor: ${safeStr(name)}`, {
      x: M + 8,
      y: y - 12,
      size: 10.0,
      font: fontBold,
      color: BLACK
    });
    y -= (barH + 8);
  }

  // buyer totals
  let buyerDownMoneyTotal = 0;

  // helper to compute dynamic grid height based on wrapped values
  function computeGridValueLines(record){
    const values = {
      loads: safeStr(record[CONFIG.COLS.loads]) || "0",
      head:  safeStr(record[CONFIG.COLS.head])  || "0",
      sex:   safeStr(record[CONFIG.COLS.sex]),
      bw:    safeStr(record[CONFIG.COLS.baseWeight]),
      del:   safeStr(record[CONFIG.COLS.delivery]),
      loc:   safeStr(record[CONFIG.COLS.location]),
      shr:   safeStr(record[CONFIG.COLS.shrink]),
      sld:   safeStr(record[CONFIG.COLS.slide]),
      price: priceDisplay(record[CONFIG.COLS.price]),
    };

    const wrapped = {};
    let maxLines = 1;

    for(const c of colDefs){
      const cellW = c.w - 2*CONFIG.PDF.cellPadX;
      const lines = wrapLinesByWords(font, values[c.key], CONFIG.PDF.gridValue, cellW);
      wrapped[c.key] = lines;
      if(lines.length > maxLines) maxLines = lines.length;
    }
    return { wrapped, maxLines };
  }

  function computeNotesLines(record){
    const desc = safeStr(record[CONFIG.COLS.description]);
    const desc2 = safeStr(record[CONFIG.COLS.secondDescription]);
    const notesText = [desc, desc2].filter(Boolean).join("  |  ");
    const notesFull = safeStr(`Notes: ${notesText}`);
    const maxW = contentW - 2*CONFIG.PDF.padX;
    const lines = wrapLinesByWords(font, notesFull, CONFIG.PDF.notes, maxW);
    return { notesFull, lines };
  }

  function lotBlockHeight(record){
    // Row 1: Lot/Seller line + Breed line
    const row1H = 32;

    // Grid: label row fixed + value row dynamic
    const labelH = 14;
    const { maxLines } = computeGridValueLines(record);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    // Notes: dynamic full wrap
    const { lines } = computeNotesLines(record);
    const notesH = 8 + (lines.length * CONFIG.PDF.notesLineH) + 2;

    // Buyer: down money row (always one line)
    const dmRowH = (mode === "buyer") ? 18 : 0;

    return row1H + gridH + notesH + dmRowH + CONFIG.PDF.lotGap;
  }

  function ensureRoom(record, footerReserve){
    const need = lotBlockHeight(record);
    if(y - need < footerReserve){
      newPage();

      // for rep, repeat the consignor divider at top of new page
      if(mode === "rep" && currentConsignor){
        drawRepConsignorDivider(currentConsignor);
      }
    }
  }

  function drawLotBlock(r){
    const lot = safeStr(r[CONFIG.COLS.lotNumber]);
    const seller = safeStr(r[CONFIG.COLS.consignor]);
    const breed = safeStr(r[CONFIG.COLS.breed]) || safeStr(r[CONFIG.COLS.description]);

    const loads = safeStr(r[CONFIG.COLS.loads]) || "0";
    const head  = safeStr(r[CONFIG.COLS.head])  || "0";
    const sex   = safeStr(r[CONFIG.COLS.sex]);
    const bw    = safeStr(r[CONFIG.COLS.baseWeight]);
    const del   = safeStr(r[CONFIG.COLS.delivery]);
    const loc   = safeStr(r[CONFIG.COLS.location]);
    const shr   = safeStr(r[CONFIG.COLS.shrink]);
    const sld   = safeStr(r[CONFIG.COLS.slide]);
    const price = priceDisplay(r[CONFIG.COLS.price]);
    const dm    = downMoneyDisplay(r[CONFIG.COLS.downMoney]);

    if(mode === "buyer"){
      buyerDownMoneyTotal += toNumber(r[CONFIG.COLS.downMoney]);
    }

    // === Row 1 box (Lot/Seller + Breed on new line) ===
    const row1H = 32;
    page.drawRectangle({
      x: M, y: y - row1H, width: contentW, height: row1H,
      color: WHITE,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: GRID
    });

    const line1 = `Lot # ${lot} - ${seller}`;
    page.drawText(line1, {
      x: M + CONFIG.PDF.padX,
      y: y - 14,
      size: CONFIG.PDF.lotTitle,
      font: fontBold,
      color: BLACK
    });

    // Breed on NEW line, left aligned
    page.drawText(safeStr(breed), {
      x: M + CONFIG.PDF.padX,
      y: y - 27,
      size: CONFIG.PDF.lotBreed,
      font,
      color: BLACK
    });

    y -= row1H;

    // === Grid box (labels + dynamic wrapped values, centered) ===
    const labelH = 14;
    const { wrapped, maxLines } = computeGridValueLines(r);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    // Outer grid
    page.drawRectangle({
      x: gridX, y: y - gridH, width: gridW, height: gridH,
      color: WHITE,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: GRID
    });

    // label/value separator
    page.drawLine({
      start: { x: gridX, y: y - labelH },
      end:   { x: gridX + gridW, y: y - labelH },
      thickness: CONFIG.PDF.innerW,
      color: GRID
    });

    // vertical separators + content
    let cx = gridX;
    for(let i=0;i<colDefs.length;i++){
      const c = colDefs[i];
      if(i !== 0){
        page.drawLine({
          start: { x: cx, y: y },
          end:   { x: cx, y: y - gridH },
          thickness: CONFIG.PDF.innerW,
          color: GRID
        });
      }

      const cellCenter = cx + c.w/2;

      // centered label
      const label = c.label;
      const lw = textWidth(fontBold, label, CONFIG.PDF.gridLabel);
      page.drawText(label, {
        x: cellCenter - lw/2,
        y: y - 11,
        size: CONFIG.PDF.gridLabel,
        font: fontBold,
        color: BLACK
      });

      // centered wrapped value lines
      const lines = wrapped[c.key] || [""];
      const startY = y - labelH - 11; // first line y
      drawCenteredLines(
        page,
        font,
        lines,
        cellCenter,
        startY,
        CONFIG.PDF.gridLineH,
        CONFIG.PDF.gridValue,
        BLACK
      );

      cx += c.w;
    }

    y -= gridH;

    // === Notes box (wrap FULLY; no truncation) ===
    const { notesFull, lines: noteLines } = computeNotesLines(r);
    const notesH = 8 + (noteLines.length * CONFIG.PDF.notesLineH) + 2;

    page.drawRectangle({
      x: M, y: y - notesH, width: contentW, height: notesH,
      color: WHITE,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: GRID
    });

    // left aligned notes inside
    let ny = y - 12;
    for(const ln of noteLines){
      page.drawText(ln, {
        x: M + CONFIG.PDF.padX,
        y: ny,
        size: CONFIG.PDF.notes,
        font,
        color: BLACK
      });
      ny -= CONFIG.PDF.notesLineH;
    }

    y -= notesH;

    // === Buyer: Down Money row (separate; NOT in grid) ===
    if(mode === "buyer"){
      const dmRowH = 18;
      page.drawRectangle({
        x: M, y: y - dmRowH, width: contentW, height: dmRowH,
        color: FILL,
        borderWidth: CONFIG.PDF.borderW,
        borderColor: GRID
      });
      page.drawText(`Down Money Due: ${dm}`, {
        x: M + CONFIG.PDF.padX,
        y: y - 13,
        size: 10.0,
        font: fontBold,
        color: BLACK
      });
      y -= dmRowH;
    }

    // space after each lot
    y -= CONFIG.PDF.lotGap;
  }

  // ===== Build content =====
  const sorted = [...rows].sort(sortLots);

  // footer reserve: for buyer, reserve enough room for total box + footer text
  const footerReserve = (mode === "buyer")
    ? (CONFIG.PDF.footerMinH + 36) // safe reserve
    : (40);

  for(const r of sorted){
    // Rep: split clearly by consignor
    if(mode === "rep"){
      const consignor = safeStr(r[CONFIG.COLS.consignor]);
      if(consignor && consignor !== currentConsignor){
        // ensure room for divider + at least one lot
        if(y < M + footerReserve + 60) newPage();
        currentConsignor = consignor;
        drawRepConsignorDivider(currentConsignor);
      }
    }

    ensureRoom(r, M + footerReserve);
    drawLotBlock(r);
  }

  // ===== Buyer Footer =====
  if(mode === "buyer"){
    // Add space after last lot to avoid overlap with footer
    y -= CONFIG.PDF.spaceBeforeFooter;

    // If footer won't fit, move to new page
    if(y < M + CONFIG.PDF.footerMinH + 40){
      newPage();
    }

    // Total box on RIGHT side
    const totalBoxW = 260;
    const totalBoxH = 22;
    const totalX = M + contentW - totalBoxW;
    const totalY = y - totalBoxH;

    page.drawRectangle({
      x: totalX,
      y: totalY,
      width: totalBoxW,
      height: totalBoxH,
      color: WHITE,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: GRID
    });

    const totalText = `Total Down Money Due: ${formatMoney(buyerDownMoneyTotal)}`;
    // shrink a little if needed to fit inside the box (but keep one line)
    let ts = 10.6;
    while(ts > 8.6 && textWidth(fontBold, totalText, ts) > (totalBoxW - 12)){
      ts -= 0.2;
    }
    page.drawText(totalText, {
      x: totalX + 6,
      y: totalY + 6,
      size: ts,
      font: fontBold,
      color: BLACK
    });

    y = totalY - 12;

    // Footer: two columns, with enough line spacing to avoid overlap
    const leftFooter =
`REMIT TO CMS LIVESTOCK AUCTION VIA WIRE TRANSFER, ACH, OR OVERNIGHT DELIVERY OF A CHECK
PLEASE INCLUDE BUYER NAME AND LOT NUMBERS ON PAYMENT
Wire Instructions for CMS Livestock Auction:
Send Overnight Payments to:
CMS Livestock Auction
6900 I-40 West,
Suite 135
Amarillo, TX 79106.`;

    const rightFooter =
`Wire funds to:
Happy State Bank 200 Main Street
Canadian, Tx 79014
Contact our office at (806) 355-7505 or CMSCattleAuctions@gmail.com for account and routing number`;

    const colGap = 22;
    const colW = (contentW - colGap) / 2;
    const leftX = M;
    const rightX = M + colW + colGap;

    const leftLines = leftFooter.split("\n").map(safeStr).filter(Boolean);
    const rightLines = rightFooter.split("\n").map(safeStr).filter(Boolean);

    // If still too tight, force to new page
    const footerNeedH = (Math.max(leftLines.length, rightLines.length) * CONFIG.PDF.footerLineH) + 14;
    if(y < M + footerNeedH){
      newPage();
      y = H - CONFIG.PDF.topBarH - CONFIG.PDF.headerHOther - 10;
    }

    let ly = y;
    for(const ln of leftLines){
      page.drawText(ln, { x: leftX, y: ly, size: 7.9, font, color: BLACK });
      ly -= CONFIG.PDF.footerLineH;
    }

    let ry = y;
    for(const ln of rightLines){
      page.drawText(ln, { x: rightX, y: ry, size: 7.9, font, color: BLACK });
      ry -= CONFIG.PDF.footerLineH;
    }
  }

  return await pdfDoc.save();
}

// ====== DOWNLOAD / ZIP ======
function downloadBytes(bytes, filename){
  const blob = new Blob([bytes], {type:"application/pdf"});
  const url = URL.createObjectURL(blob);
  blobUrls.push(url);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>{
    try{ URL.revokeObjectURL(url); }catch{}
    blobUrls = blobUrls.filter(u => u !== url);
  }, 15000);
}
async function downloadZip(items, zipName){
  const zip = new JSZip();
  for(const it of items){
    zip.file(it.filename, it.bytes);
  }
  const blob = await zip.generateAsync({type:"blob"});
  const url = URL.createObjectURL(blob);
  blobUrls.push(url);

  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>{
    try{ URL.revokeObjectURL(url); }catch{}
    blobUrls = blobUrls.filter(u => u !== url);
  }, 20000);
}

// ====== RESULTS UI ======
function renderList(container, items){
  container.innerHTML = "";
  if(items.length === 0){
    const div = document.createElement("div");
    div.className = "muted small";
    div.textContent = "None generated.";
    container.appendChild(div);
    return;
  }

  for(const it of items){
    const row = document.createElement("div");
    row.className = "listItem";

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "listName";
    name.textContent = it.filename;

    const meta = document.createElement("div");
    meta.className = "listMeta";
    meta.textContent = `${it.count} lot line(s)`;

    left.appendChild(name);
    left.appendChild(meta);

    const btn = document.createElement("button");
    btn.className = "btn btnSmall";
    btn.textContent = "Download";
    btn.addEventListener("click", ()=> downloadBytes(it.bytes, it.filename));

    row.appendChild(left);
    row.appendChild(btn);

    container.appendChild(row);
  }
}
function renderResults(){
  const total = generated.buyers.length + generated.consignors.length + generated.reps.length;
  resultsMeta.textContent = `Generated ${total} PDF(s) from ${csvRows.length} row(s).`;

  renderList(listBuyers, generated.buyers);
  renderList(listConsignors, generated.consignors);
  renderList(listReps, generated.reps);

  zipBuyers.disabled = generated.buyers.length === 0;
  zipConsignors.disabled = generated.consignors.length === 0;
  zipReps.disabled = generated.reps.length === 0;
  zipAll.disabled = total === 0;
}

// ====== BUILD PDFs ======
buildBtn.addEventListener("click", async ()=>{
  setError(builderError, "");
  buildBtn.disabled = true;
  buildBtn.textContent = "Generating…";

  try{
    assertLibsLoaded();

    if(csvRows.length === 0) throw new Error("Upload a CSV first.");
    if(!(chkBuyer.checked || chkConsignor.checked || chkRep.checked)){
      throw new Error("Select at least one report type.");
    }

    const chk = requiredColsPresent(csvRows);
    if(!chk.ok) throw new Error(`CSV is missing required column(s): ${chk.missing.join(", ")}`);

    generated = { buyers:[], consignors:[], reps:[] };
    listBuyers.innerHTML = "";
    listConsignors.innerHTML = "";
    listReps.innerHTML = "";

    zipBuyers.disabled = true;
    zipConsignors.disabled = true;
    zipReps.disabled = true;
    zipAll.disabled = true;
    resultsMeta.textContent = "";

    if(chkBuyer.checked){
      const buyers = groupBy(csvRows, CONFIG.COLS.buyer);
      for(const [buyer, rows] of buyers.entries()){
        if(!buyer) continue;
        const bytes = await buildPdfForGroup({ entityName: buyer, rows, mode: "buyer" });
        const filename = `${fileSafeName(buyer)}-Contract.pdf`;
        generated.buyers.push({name: buyer, filename, bytes, count: rows.length});
      }
      generated.buyers.sort((a,b)=> a.name.localeCompare(b.name));
    }

    if(chkConsignor.checked){
      const consignors = groupBy(csvRows, CONFIG.COLS.consignor);
      for(const [consignor, rows] of consignors.entries()){
        if(!consignor) continue;
        const bytes = await buildPdfForGroup({ entityName: consignor, rows, mode: "consignor" });
        const filename = `Contract-${fileSafeName(consignor)}.pdf`;
        generated.consignors.push({name: consignor, filename, bytes, count: rows.length});
      }
      generated.consignors.sort((a,b)=> a.name.localeCompare(b.name));
    }

    if(chkRep.checked){
      const repRows = csvRows.filter(r => safeStr(r[CONFIG.COLS.rep]) !== "");
      const reps = groupBy(repRows, CONFIG.COLS.rep);
      for(const [rep, rows] of reps.entries()){
        if(!rep) continue;
        const bytes = await buildPdfForGroup({ entityName: rep, rows, mode: "rep" });
        const filename = `Rep-${fileSafeName(rep)}-Contract.pdf`;
        generated.reps.push({name: rep, filename, bytes, count: rows.length});
      }
      generated.reps.sort((a,b)=> a.name.localeCompare(b.name));
    }

    renderResults();
    goto(pageResults);

  } catch (err) {
    console.error(err);
    const msg = (err && err.message) ? err.message : String(err);
    setError(builderError, `PDF generation error: ${msg}`);
  } finally {
    buildBtn.disabled = false;
    buildBtn.textContent = "Generate PDFs";
    setBuildEnabled();
  }
});

// ====== ZIP BUTTONS ======
zipBuyers.addEventListener("click", ()=> downloadZip(generated.buyers, "Buyer-Reports.zip"));
zipConsignors.addEventListener("click", ()=> downloadZip(generated.consignors, "Consignor-Reports.zip"));
zipReps.addEventListener("click", ()=> downloadZip(generated.reps, "Representative-Reports.zip"));
zipAll.addEventListener("click", ()=>{
  const all = [...generated.buyers, ...generated.consignors, ...generated.reps];
  downloadZip(all, "All-Reports.zip");
});
backBtn.addEventListener("click", ()=> goto(pageBuilder));

// ====== INIT ======
goto(pageAuth);
setBuildEnabled();
