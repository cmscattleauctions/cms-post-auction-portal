/* CMS Post-Auction Portal (client-only) — FULL app.js (UPDATED to your latest notes)

APPLIES to ALL PDF types (Buyer / Consignor / Rep):

1) FIRST PAGE ONLY: adds top-right address block:
   CMS Livestock Auction
   6900 I-40 West, Suite 135
   Amarillo, TX 79106
   (806) 355-7505

2) PAGES AFTER FIRST: moves Auction Title + Auction Date to TOP RIGHT.
   (Left side still shows Buyer/Consignor/Rep.)

3) Lot grid widths adjusted:
   - Delivery box narrower
   - Location wider
   - Others adjusted to keep total width full-page.

4) Bottom whitespace reduced significantly (more lots per page).

5) REP PDFs:
   - Top bar/header color changed to a CMS-friendly TEAL (not buyer blue or consignor gray)
   - Each consignor divider uses a rotating palette of CMS-friendly colors so it’s obvious when consignor changes.

6) CONSIGNOR PDFs:
   - If CSV has a "Type" column AND multiple types exist in that consignor’s rows,
     inserts colored "Type" headers (divider bars) when type changes (CMS-friendly palette).

Dependencies in index.html before app.js:
  - papaparse
  - pdf-lib
  - jszip
*/

const CONFIG = {
  PIN: "0623",

  COLS: {
    buyer: "Buyer",
    consignor: "Consignor",
    rep: "Representative",
    breed: "Breed", // optional; fallback to Description
    type: "Type",  // optional; used for consignor type headers

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
    pageSize: { width: 792, height: 612 }, // landscape letter

    margin: 26,

    // SIGNIFICANTLY reduce bottom whitespace:
    // allow lots down to ~0.12" from bottom (printing-dependent but you asked to push it)
    bottomLimit: 9,

    topBarH: 8,

    headerHFirst: 74,
    headerHOther: 44, // tighter than before to fit more lots/page

    buyerNameSize: 13.8,
    otherNameSize: 12.3,
    headerSmall: 10.0,
    title: 12.2,

    lotTitle: 10.4,
    lotBreed: 9.4,
    gridLabel: 7.7,
    gridValue: 8.6,
    notes: 7.8,

    gridLineH: 10.2,
    notesLineH: 10.0,

    lotGap: 8, // slightly tighter -> more lots/page

    padX: 8,
    cellPadX: 5,
    cellPadY: 4,

    footerLineH: 10.6,
    footerMinH: 92,

    borderW: 1.0,
    innerW: 0.8,
  },

  // CMS-friendly palette for Rep consignor dividers and Consignor Type dividers
  PALETTE: [
    { fill: [0.86, 0.93, 0.98], stroke: [0.20, 0.39, 0.60] }, // light CMS blue
    { fill: [0.88, 0.96, 0.94], stroke: [0.12, 0.55, 0.55] }, // teal
    { fill: [0.90, 0.96, 0.90], stroke: [0.20, 0.55, 0.25] }, // green
    { fill: [0.93, 0.94, 0.98], stroke: [0.34, 0.34, 0.70] }, // indigo-ish
    { fill: [0.94, 0.94, 0.94], stroke: [0.45, 0.45, 0.45] }, // neutral gray
  ]
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
  const required = Object.values(CONFIG.COLS).filter(c => c !== CONFIG.COLS.breed && c !== CONFIG.COLS.type);
  const row0 = rows[0] || {};
  const keys = new Set(Object.keys(row0));
  const missing = required.filter(c => !keys.has(c));
  return { ok: missing.length === 0, missing };
}

// stable hash -> palette index
function hashIndex(str, mod){
  let h = 0;
  const s = safeStr(str);
  for(let i=0;i<s.length;i++){
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % mod;
}

// ====== TEXT HELPERS ======
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

  // Header/topbar colors:
  // buyer = CMS blue, consignor = gray, rep = teal (easier to see than black, distinct from others)
  const topBarColor =
    mode === "buyer" ? rgb(0.20, 0.39, 0.60) :
    mode === "consignor" ? rgb(0.55, 0.55, 0.55) :
    rgb(0.12, 0.55, 0.55); // rep teal

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const bottomLimit = CONFIG.PDF.bottomLimit;
  const contentW = W - 2*M;

  // UPDATED widths (sum = 740 = contentW)
  // Delivery narrower, Location wider, adjust others to keep full width.
  const colDefs = [
    { key: "loads", label: "Loads",   w: 45 },
    { key: "head",  label: "Head",    w: 45 },
    { key: "sex",   label: "Sex",     w: 100 },
    { key: "bw",    label: "Base Wt", w: 38 },
    { key: "del",   label: "Delivery",w: 170 }, // narrower
    { key: "loc",   label: "Location",w: 110 }, // wider
    { key: "shr",   label: "Shrink",  w: 48 },
    { key: "sld",   label: "Slide",   w: 134 },
    { key: "price", label: "Price",   w: 50 },
  ];
  const gridX = M;
  const gridW = colDefs.reduce((s,c)=>s+c.w,0); // 740

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

  // Address block lines for first page top-right
  const addrLines = [
    "CMS Livestock Auction",
    "6900 I-40 West, Suite 135",
    "Amarillo, TX 79106",
    "(806) 355-7505"
  ];

  // For consignor PDFs: check whether multiple Types exist for this consignor group
  const typeColExists = rows.length > 0 && Object.prototype.hasOwnProperty.call(rows[0], CONFIG.COLS.type);
  const typesInGroup = new Set();
  if(mode === "consignor" && typeColExists){
    for(const r of rows){
      const t = safeStr(r[CONFIG.COLS.type]) || "Other";
      typesInGroup.add(t);
    }
  }
  const useTypeHeaders = (mode === "consignor" && typeColExists && typesInGroup.size > 1);

  let page = pdfDoc.addPage([W,H]);
  let pageIndex = 0;
  let y = H - M;

  function drawTopBar(){
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

    // Print-safe: move down slightly on all pages; a touch more on later pages
    const topY = (pageIndex === 0)
      ? (H - CONFIG.PDF.topBarH - 18)
      : (H - CONFIG.PDF.topBarH - 24);

    const lx = M;

    // LEFT: Buyer/Consignor/Rep
    page.drawText(`${leftLabel}: ${safeStr(entityName)}`, {
      x: lx,
      y: topY,
      size: nameSize,
      font: fontBold,
      color: BLACK
    });

    // FIRST PAGE:
    // - Keep auction title/date on left (as you had)
    // - Add address block on top-right
    if(pageIndex === 0){
      // auction title/date left
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

      // center title only on page 1
      const tW = textWidth(fontBold, centerTitle, CONFIG.PDF.title);
      page.drawText(centerTitle, {
        x: M + (contentW - tW)/2,
        y: topY - 14,
        size: CONFIG.PDF.title,
        font: fontBold,
        color: BLACK
      });

      // address block top-right
      const blockW = 240;
      const rx = M + contentW - blockW;
      let ry = topY + 2; // slightly above the buyer line for best fit

      page.drawText(addrLines[0], { x: rx, y: ry, size: 10.2, font: fontBold, color: BLACK });
      ry -= 12;
      for(let i=1;i<addrLines.length;i++){
        page.drawText(addrLines[i], { x: rx, y: ry, size: 9.3, font, color: BLACK });
        ry -= 11;
      }

    } else {
      // PAGES AFTER FIRST:
      // Move auction title + date to TOP RIGHT
      const blockW = 310;
      const rx = M + contentW - blockW;
      let ry = topY;

      page.drawText(safeStr(auctionTitle), {
        x: rx,
        y: ry,
        size: CONFIG.PDF.headerSmall,
        font: font,
        color: BLACK
      });
      ry -= 13;

      if(aDate){
        page.drawText(safeStr(aDate), {
          x: rx,
          y: ry,
          size: CONFIG.PDF.headerSmall,
          font: font,
          color: BLACK
        });
      }
    }

    // where lots start
    y = H - CONFIG.PDF.topBarH - headerH;
  }

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    pageIndex += 1;
    y = H - M;
    drawHeader();
  }

  drawHeader();

  // Rep: per-consignor divider colors (CMS palette), clear transitions
  let currentConsignor = "";
  let repConsignorColorIndex = 0;

  // Consignor: optional Type divider colors (CMS palette)
  let currentType = "";

  function drawColoredDivider({label, value, colorSpec, height=16, gapAfter=3}){
    const fill = rgb(colorSpec.fill[0], colorSpec.fill[1], colorSpec.fill[2]);
    const stroke = rgb(colorSpec.stroke[0], colorSpec.stroke[1], colorSpec.stroke[2]);

    page.drawRectangle({
      x: M,
      y: y - height,
      width: contentW,
      height: height,
      color: fill,
      borderWidth: CONFIG.PDF.innerW,
      borderColor: stroke
    });

    page.drawText(`${label}: ${safeStr(value)}`, {
      x: M + 8,
      y: y - 12,
      size: 10.0,
      font: fontBold,
      color: BLACK
    });

    y -= (height + gapAfter);
  }

  // Buyer totals
  let buyerDownMoneyTotal = 0;

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
    return { lines };
  }

  function lotBlockHeight(record){
    const row1H = 32;

    const labelH = 14;
    const { maxLines } = computeGridValueLines(record);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    const { lines } = computeNotesLines(record);
    const notesH = 8 + (lines.length * CONFIG.PDF.notesLineH) + 2;

    const dmRowH = (mode === "buyer") ? 18 : 0;

    return row1H + gridH + notesH + dmRowH + CONFIG.PDF.lotGap;
  }

  function ensureRoom(record, footerReserve){
    const need = lotBlockHeight(record);
    if((y - need) < footerReserve){
      newPage();

      // Rep: repeat current consignor divider at top of a new page
      if(mode === "rep" && currentConsignor){
        const idx = hashIndex(currentConsignor, CONFIG.PALETTE.length);
        drawColoredDivider({ label: "Consignor", value: currentConsignor, colorSpec: CONFIG.PALETTE[idx], height: 16, gapAfter: 2 });
      }

      // Consignor: repeat current type divider at top of a new page (if enabled)
      if(mode === "consignor" && useTypeHeaders && currentType){
        const idx = hashIndex(currentType, CONFIG.PALETTE.length);
        drawColoredDivider({ label: "Type", value: currentType, colorSpec: CONFIG.PALETTE[idx], height: 14, gapAfter: 2 });
      }
    }
  }

  function drawLotBlock(r){
    const lot = safeStr(r[CONFIG.COLS.lotNumber]);
    const seller = safeStr(r[CONFIG.COLS.consignor]);
    const breed = safeStr(r[CONFIG.COLS.breed]) || safeStr(r[CONFIG.COLS.description]);

    const dm = downMoneyDisplay(r[CONFIG.COLS.downMoney]);

    if(mode === "buyer"){
      buyerDownMoneyTotal += toNumber(r[CONFIG.COLS.downMoney]);
    }

    // Row 1 (Lot/Seller + Breed)
    const row1H = 32;
    page.drawRectangle({
      x: M, y: y - row1H, width: contentW, height: row1H,
      color: WHITE,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: GRID
    });

    page.drawText(`Lot # ${lot} - ${seller}`, {
      x: M + CONFIG.PDF.padX,
      y: y - 14,
      size: CONFIG.PDF.lotTitle,
      font: fontBold,
      color: BLACK
    });

    page.drawText(safeStr(breed), {
      x: M + CONFIG.PDF.padX,
      y: y - 27,
      size: CONFIG.PDF.lotBreed,
      font,
      color: BLACK
    });

    y -= row1H;

    // Grid (labels + wrapped centered values)
    const labelH = 14;
    const { wrapped, maxLines } = computeGridValueLines(r);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    page.drawRectangle({
      x: gridX, y: y - gridH, width: gridW, height: gridH,
      color: WHITE,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: GRID
    });

    page.drawLine({
      start: { x: gridX, y: y - labelH },
      end:   { x: gridX + gridW, y: y - labelH },
      thickness: CONFIG.PDF.innerW,
      color: GRID
    });

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
      const lw = textWidth(fontBold, c.label, CONFIG.PDF.gridLabel);
      page.drawText(c.label, {
        x: cellCenter - lw/2,
        y: y - 11,
        size: CONFIG.PDF.gridLabel,
        font: fontBold,
        color: BLACK
      });

      // centered wrapped value lines (no truncation)
      const lines = wrapped[c.key] || [""];
      const startY = y - labelH - 11;
      drawCenteredLines(page, font, lines, cellCenter, startY, CONFIG.PDF.gridLineH, CONFIG.PDF.gridValue, BLACK);

      cx += c.w;
    }

    y -= gridH;

    // Notes box (full wrap)
    const { lines: noteLines } = computeNotesLines(r);
    const notesH = 8 + (noteLines.length * CONFIG.PDF.notesLineH) + 2;

    page.drawRectangle({
      x: M, y: y - notesH, width: contentW, height: notesH,
      color: WHITE,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: GRID
    });

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

    // Buyer down money row (separate)
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

    y -= CONFIG.PDF.lotGap;
  }

  const sorted = [...rows].sort(sortLots);

  // Reserve space to pack lots lower on page:
  // buyer: keep enough room for total box + footer near bottom
  // others: minimal reserve near bottomLimit
  const footerReserve = (mode === "buyer")
    ? (bottomLimit + CONFIG.PDF.footerMinH + 18)
    : (bottomLimit + 6);

  for(const r of sorted){
    // REP: colored consignor divider whenever consignor changes
    if(mode === "rep"){
      const consignor = safeStr(r[CONFIG.COLS.consignor]);
      if(consignor && consignor !== currentConsignor){
        // ensure room for divider + next lot
        if(y < footerReserve + 40) newPage();

        currentConsignor = consignor;

        // choose a stable palette color based on consignor name
        const idx = hashIndex(currentConsignor, CONFIG.PALETTE.length);
        drawColoredDivider({
          label: "Consignor",
          value: currentConsignor,
          colorSpec: CONFIG.PALETTE[idx],
          height: 16,
          gapAfter: 2 // keep tight; you wanted less padding
        });
      }
    }

    // CONSIGNOR: type headers if enabled and type changes
    if(mode === "consignor" && useTypeHeaders){
      const t = safeStr(r[CONFIG.COLS.type]) || "Other";
      if(t !== currentType){
        if(y < footerReserve + 32) newPage();
        currentType = t;

        const idx = hashIndex(currentType, CONFIG.PALETTE.length);
        drawColoredDivider({
          label: "Type",
          value: currentType,
          colorSpec: CONFIG.PALETTE[idx],
          height: 14,
          gapAfter: 2
        });
      }
    }

    ensureRoom(r, footerReserve);
    drawLotBlock(r);
  }

  // ===== Buyer footer (same across all buyer PDFs) =====
  if(mode === "buyer"){
    // If footer won't fit, move to new page
    if(y < bottomLimit + CONFIG.PDF.footerMinH + 34){
      newPage();
    }

    // Total Down Money box immediately after last lot
    const totalBoxW = 270;
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

    y = totalY - 10;

    // Footer header line alone
    const footerHeader = "REMIT TO CMS LIVESTOCK AUCTION VIA WIRE TRANSFER, ACH, OR OVERNIGHT DELIVERY OF A CHECK";
    const footerLeft =
`PLEASE INCLUDE BUYER NAME AND LOT NUMBERS ON PAYMENT
Wire Instructions for CMS Livestock Auction:
Send Overnight Payments to:
CMS Livestock Auction
6900 I-40 West,
Suite 135
Amarillo, TX 79106.`;

    const footerRight =
`Wire funds to:
Happy State Bank 200 Main Street
Canadian, Tx 79014
Contact our office at (806) 355-7505 or CMSCattleAuctions@gmail.com for account and routing number`;

    const colGap = 22;
    const colW = (contentW - colGap) / 2;
    const leftX = M;
    const rightX = M + colW + colGap;

    const leftLines = footerLeft.split("\n").map(safeStr).filter(Boolean);
    const rightLines = footerRight.split("\n").map(safeStr).filter(Boolean);

    const neededLines = Math.max(leftLines.length, rightLines.length);
    const footerNeedH = 16 + (neededLines * CONFIG.PDF.footerLineH) + 22;

    if(y < bottomLimit + footerNeedH){
      newPage();
      y = H - CONFIG.PDF.topBarH - CONFIG.PDF.headerHOther - 10;
    }

    // header alone
    page.drawText(footerHeader, {
      x: M,
      y: y,
      size: 8.2,
      font: fontBold,
      color: BLACK
    });
    y -= (CONFIG.PDF.footerLineH + 4);

    // columns
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
