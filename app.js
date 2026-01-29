/* CMS Post-Auction Portal (client-only) — FULL app.js (UPDATED)

Includes:
- Branding-correct colors for rep/consignor confirmations
- Rep: NO consignor divider headers; top lot box colored by consignor
- Consignor: NO type headers; top lot box colored by Type mapping you provided
- Buyer: packs lots to bottom; footer moves to new page if needed
- "CMS Livestock Auction" on EVERY page (top-right); address block only on page 1
- Anywhere Lot # label appeared -> uses Contract # instead (auto-detects column name)
- New generators:
  1) Lot-by-lot PDFs (one lot per PDF)
  2) Buyer Contract DOCX per lot (editable, from template)  :contentReference[oaicite:2]{index=2}
  3) Seller Contract DOCX per lot (editable, from template) :contentReference[oaicite:3]{index=3}

Dependencies in index.html BEFORE app.js:
  - papaparse
  - pdf-lib
  - jszip
  - pizzip
  - docxtemplater
*/

const CONFIG = {
  PIN: "0623",

  COLS: {
    buyer: "Buyer",
    consignor: "Consignor",
    rep: "Representative",
    breed: "Breed",     // optional; fallback to Description
    type: "Type",       // optional; used for consignor lot color mapping
    year: "Year",       // optional; fallback to current year if blank

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

  // Contract column auto-detection candidates
  CONTRACT_COL_CANDIDATES: [
    "Contract #",
    "Contract",
    "Contract Number",
    "Contract No",
    "Contract No."
  ],

  PDF: {
    pageSize: { width: 792, height: 612 }, // landscape letter
    margin: 26,

    // pack close to bottom for more lots/page
    bottomLimit: 9, // ~0.12"

    topBarH: 8,

    headerHFirst: 74,
    headerHOther: 44, // tighter for more lots

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

    lotGap: 7, // tighter

    padX: 8,
    cellPadX: 5,
    cellPadY: 4,

    footerLineH: 10.6,
    footerMinH: 92,

    borderW: 1.0,
    innerW: 0.8,
  },

  // Brand colors
  COLORS: {
    cmsBlue: "#336699",
    consignorTopBar: "#6F8FAF", // softer blue-gray
    repTopBar: "#3FA796",       // teal-green (distinct from buyer & consignor)
    textWhite: [1,1,1],
    textBlack: [0,0,0],
  },

  // Rep lot header: rotate CMS-ish palette (fill + white text)
  REP_CONSIGNOR_PALETTE: [
    "#202E4A", // navy
    "#336699", // CMS blue
    "#3FA796", // teal
    "#6F8FAF", // steel blue
    "#C9A66B", // gold
  ],

  // Consignor lot header color by Type mapping (your exact)
  TYPE_COLOR_MAP: [
    { match: ["blackx", "beef on dairy", "beefx dairy", "beef x dairy"], hex: "#202E4A" },
    { match: ["charolais"], hex: "#C9A66B" },
    { match: ["native", "natives"], hex: "#3FA796" },
    { match: ["holstein", "holsteins"], hex: "#6F8FAF" },
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

// NEW
const chkLotByLot = document.getElementById("chkLotByLot");
const chkBuyerContracts = document.getElementById("chkBuyerContracts");
const chkSellerContracts = document.getElementById("chkSellerContracts");

// NEW template inputs
const buyerTemplateInput = document.getElementById("buyerTemplateInput");
const sellerTemplateInput = document.getElementById("sellerTemplateInput");

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
let generated = { buyers: [], consignors: [], reps: [], lotbylot: [], buyerDocs: [], sellerDocs: [] };
let blobUrls = [];
let contractColName = null;

// loaded template bytes
let buyerTemplateBytes = null;
let sellerTemplateBytes = null;

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

// sanitize for WinAnsi + stable layout
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
  const la = safeStr(getContract(a));
  const lb = safeStr(getContract(b));
  return la.localeCompare(lb, undefined, {numeric:true});
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
  if(!window.PDFLib) throw new Error("PDF library not loaded (PDFLib).");
  if(!window.Papa) throw new Error("CSV parser not loaded (Papa).");
  if(!window.JSZip) throw new Error("ZIP library not loaded (JSZip).");
  // DOCX libs only required if those options are selected
}
function requiredColsPresent(rows){
  // Make contract column required by detection (we’ll error if missing)
  const required = Object.values(CONFIG.COLS).filter(c => ![CONFIG.COLS.breed, CONFIG.COLS.type, CONFIG.COLS.year].includes(c));
  const row0 = rows[0] || {};
  const keys = new Set(Object.keys(row0));
  const missing = required.filter(c => !keys.has(c));
  return { ok: missing.length === 0, missing };
}

function detectContractColumn(rows){
  const row0 = rows[0] || {};
  const keys = Object.keys(row0);
  for(const cand of CONFIG.CONTRACT_COL_CANDIDATES){
    if(keys.includes(cand)) return cand;
  }
  // also allow case-insensitive match
  const lower = keys.map(k => k.toLowerCase());
  for(const cand of CONFIG.CONTRACT_COL_CANDIDATES){
    const idx = lower.indexOf(cand.toLowerCase());
    if(idx >= 0) return keys[idx];
  }
  return null;
}
function getContract(row){
  if(!contractColName) return "";
  return safeStr(row[contractColName]);
}

function hexToRgb01(hex){
  const h = hex.replace("#","").trim();
  const n = parseInt(h.length === 3 ? h.split("").map(c=>c+c).join("") : h, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  return [r,g,b];
}

// stable index
function hashIndex(str, mod){
  let h = 0;
  const s = safeStr(str);
  for(let i=0;i<s.length;i++){
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % mod;
}

function pickTypeColorHex(row){
  const type = safeStr(row[CONFIG.COLS.type]).toLowerCase();
  const desc = safeStr(row[CONFIG.COLS.description]).toLowerCase();
  const breed = safeStr(row[CONFIG.COLS.breed]).toLowerCase();

  const hay = `${type} ${breed} ${desc}`.trim();
  for(const m of CONFIG.TYPE_COLOR_MAP){
    for(const token of m.match){
      if(hay.includes(token)) return m.hex;
    }
  }
  // fallback: CMS blue
  return CONFIG.COLORS.cmsBlue;
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

// ====== TEMPLATE LOADERS ======
async function readFileBytes(file){
  if(!file) return null;
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}
buyerTemplateInput?.addEventListener("change", async (e)=>{
  buyerTemplateBytes = await readFileBytes(e.target.files?.[0]);
});
sellerTemplateInput?.addEventListener("change", async (e)=>{
  sellerTemplateBytes = await readFileBytes(e.target.files?.[0]);
});

// ====== FILE UPLOAD ======
function setBuildEnabled(){
  const anyChecked =
    chkBuyer.checked || chkConsignor.checked || chkRep.checked ||
    chkLotByLot.checked || chkBuyerContracts.checked || chkSellerContracts.checked;

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

      contractColName = detectContractColumn(csvRows);
      if(!contractColName){
        setError(builderError, `CSV is missing a Contract column. Expected one of: ${CONFIG.CONTRACT_COL_CANDIDATES.join(", ")}`);
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
[chkBuyer, chkConsignor, chkRep, chkLotByLot, chkBuyerContracts, chkSellerContracts].forEach(el => el?.addEventListener("change", setBuildEnabled));

// ====== EXIT / WIPE ======
function wipeAll(){
  for(const u of blobUrls){
    try{ URL.revokeObjectURL(u); }catch{}
  }
  blobUrls = [];

  csvRows = [];
  generated = { buyers:[], consignors:[], reps:[], lotbylot:[], buyerDocs:[], sellerDocs:[] };

  fileInput.value = "";
  fileMeta.textContent = "";
  hide(fileMeta);

  auctionName.value = "";
  auctionDate.value = "";
  auctionLabel.value = "";

  buyerTemplateInput && (buyerTemplateInput.value = "");
  sellerTemplateInput && (sellerTemplateInput.value = "");
  buyerTemplateBytes = null;
  sellerTemplateBytes = null;

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
async function buildPdfForGroup({entityName, rows, mode, singleLotMode=false}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const BLACK = rgb(0,0,0);
  const WHITE = rgb(1,1,1);
  const GRID = rgb(0.55, 0.55, 0.55);
  const FILL = rgb(0.98, 0.98, 0.98);

  const topBarHex =
    mode === "buyer" ? CONFIG.COLORS.cmsBlue :
    mode === "consignor" ? CONFIG.COLORS.consignorTopBar :
    CONFIG.COLORS.repTopBar;

  const topBarColor = rgb(...hexToRgb01(topBarHex));

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const bottomLimit = CONFIG.PDF.bottomLimit;
  const contentW = W - 2*M;

  // Grid widths (sum = 740)
  const colDefs = [
    { key: "loads", label: "Loads",   w: 45 },
    { key: "head",  label: "Head",    w: 45 },
    { key: "sex",   label: "Sex",     w: 100 },
    { key: "bw",    label: "Base Wt", w: 38 },
    { key: "del",   label: "Delivery",w: 170 },
    { key: "loc",   label: "Location",w: 110 },
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

  const addrLines = [
    "CMS Livestock Auction",
    "6900 I-40 West, Suite 135",
    "Amarillo, TX 79106",
    "(806) 355-7505"
  ];

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

    const topY = (pageIndex === 0)
      ? (H - CONFIG.PDF.topBarH - 18)
      : (H - CONFIG.PDF.topBarH - 22);

    const lx = M;

    // LEFT: Entity label
    page.drawText(`${leftLabel}: ${safeStr(entityName)}`, {
      x: lx,
      y: topY,
      size: nameSize,
      font: fontBold,
      color: BLACK
    });

    // TOP-RIGHT: Always show "CMS Livestock Auction" (every page)
    const rightBlockW = 310;
    const rx = M + contentW - rightBlockW;

    page.drawText("CMS Livestock Auction", {
      x: rx,
      y: topY,
      size: 10.2,
      font: fontBold,
      color: BLACK
    });

    if(pageIndex === 0){
      // FIRST PAGE: address block under CMS Livestock Auction
      let ry = topY - 12;
      page.drawText(addrLines[1], { x: rx, y: ry, size: 9.3, font, color: BLACK }); ry -= 11;
      page.drawText(addrLines[2], { x: rx, y: ry, size: 9.3, font, color: BLACK }); ry -= 11;
      page.drawText(addrLines[3], { x: rx, y: ry, size: 9.3, font, color: BLACK });

      // auction title/date remain on left on first page
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

      // centered title only on page 1
      const tW = textWidth(fontBold, centerTitle, CONFIG.PDF.title);
      page.drawText(centerTitle, {
        x: M + (contentW - tW)/2,
        y: topY - 14,
        size: CONFIG.PDF.title,
        font: fontBold,
        color: BLACK
      });

    } else {
      // PAGES AFTER FIRST: auction title/date move to top-right (under CMS Livestock Auction)
      let ry = topY - 12;
      page.drawText(safeStr(auctionTitle), {
        x: rx,
        y: ry,
        size: 9.4,
        font,
        color: BLACK
      });
      ry -= 12;
      if(aDate){
        page.drawText(safeStr(aDate), {
          x: rx,
          y: ry,
          size: 9.4,
          font,
          color: BLACK
        });
      }
    }

    y = H - CONFIG.PDF.topBarH - headerH;
  }

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    pageIndex += 1;
    y = H - M;
    drawHeader();
  }

  drawHeader();

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

  // IMPORTANT: For buyers, DO NOT reserve footer space while placing lots.
  // This is the “more lots per page” fix.
  function ensureRoom(record){
    const need = lotBlockHeight(record);
    if((y - need) < bottomLimit){
      newPage();
    }
  }

  function drawLotHeaderRow({textLeft, fillHex=null}){
    const row1H = 32;

    const fill = fillHex ? rgb(...hexToRgb01(fillHex)) : WHITE;
    const textColor = fillHex ? rgb(...CONFIG.COLORS.textWhite) : BLACK;

    page.drawRectangle({
      x: M, y: y - row1H, width: contentW, height: row1H,
      color: fill,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: rgb(0.55, 0.55, 0.55)
    });

    page.drawText(textLeft, {
      x: M + CONFIG.PDF.padX,
      y: y - 14,
      size: CONFIG.PDF.lotTitle,
      font: fontBold,
      color: textColor
    });

    return row1H;
  }

  function drawLotBlock(r){
    const contract = safeStr(getContract(r));
    const consignor = safeStr(r[CONFIG.COLS.consignor]);
    const buyer = safeStr(r[CONFIG.COLS.buyer]);
    const breed = safeStr(r[CONFIG.COLS.breed]) || safeStr(r[CONFIG.COLS.description]);

    const dm = downMoneyDisplay(r[CONFIG.COLS.downMoney]);

    if(mode === "buyer"){
      buyerDownMoneyTotal += toNumber(r[CONFIG.COLS.downMoney]);
    }

    // TOP LOT BOX coloring rules:
    // - Rep: color by consignor (stable per consignor)
    // - Consignor: color by Type mapping
    // - Buyer: no color
    let headerFillHex = null;

    if(mode === "rep"){
      const idx = hashIndex(consignor, CONFIG.REP_CONSIGNOR_PALETTE.length);
      headerFillHex = CONFIG.REP_CONSIGNOR_PALETTE[idx];
    } else if(mode === "consignor"){
      headerFillHex = pickTypeColorHex(r);
    }

    // Replace "Lot #" with Contract #
    // For buyer/consignor/rep, show Contract + Consignor (and for buyer, it’s still consignor on that line)
    const topLine = `Contract # ${contract} - ${consignor}`;

    const row1H = drawLotHeaderRow({textLeft: topLine, fillHex: headerFillHex});

    // Breed line (always black text if colored header? You wanted white text; but breed should remain readable)
    // We'll draw breed line inside same box at y-27 with same text color as header for consistency.
    const breedColor = headerFillHex ? rgb(...CONFIG.COLORS.textWhite) : rgb(0,0,0);
    page.drawText(safeStr(breed), {
      x: CONFIG.PDF.margin + CONFIG.PDF.padX,
      y: y - 27,
      size: CONFIG.PDF.lotBreed,
      font,
      color: breedColor
    });

    y -= row1H;

    // Grid
    const labelH = 14;
    const { wrapped, maxLines } = computeGridValueLines(r);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    page.drawRectangle({
      x: gridX, y: y - gridH, width: gridW, height: gridH,
      color: rgb(1,1,1),
      borderWidth: CONFIG.PDF.borderW,
      borderColor: rgb(0.55, 0.55, 0.55)
    });

    page.drawLine({
      start: { x: gridX, y: y - labelH },
      end:   { x: gridX + gridW, y: y - labelH },
      thickness: CONFIG.PDF.innerW,
      color: rgb(0.55, 0.55, 0.55)
    });

    let cx = gridX;
    for(let i=0;i<colDefs.length;i++){
      const c = colDefs[i];
      if(i !== 0){
        page.drawLine({
          start: { x: cx, y: y },
          end:   { x: cx, y: y - gridH },
          thickness: CONFIG.PDF.innerW,
          color: rgb(0.55, 0.55, 0.55)
        });
      }

      const cellCenter = cx + c.w/2;

      const lw = textWidth(fontBold, c.label, CONFIG.PDF.gridLabel);
      page.drawText(c.label, {
        x: cellCenter - lw/2,
        y: y - 11,
        size: CONFIG.PDF.gridLabel,
        font: fontBold,
        color: rgb(0,0,0)
      });

      const lines = wrapped[c.key] || [""];
      const startY = y - labelH - 11;
      drawCenteredLines(page, font, lines, cellCenter, startY, CONFIG.PDF.gridLineH, CONFIG.PDF.gridValue, rgb(0,0,0));

      cx += c.w;
    }

    y -= gridH;

    // Notes
    const { lines: noteLines } = computeNotesLines(r);
    const notesH = 8 + (noteLines.length * CONFIG.PDF.notesLineH) + 2;

    page.drawRectangle({
      x: M, y: y - notesH, width: contentW, height: notesH,
      color: rgb(1,1,1),
      borderWidth: CONFIG.PDF.borderW,
      borderColor: rgb(0.55, 0.55, 0.55)
    });

    let ny = y - 12;
    for(const ln of noteLines){
      page.drawText(ln, {
        x: M + CONFIG.PDF.padX,
        y: ny,
        size: CONFIG.PDF.notes,
        font,
        color: rgb(0,0,0)
      });
      ny -= CONFIG.PDF.notesLineH;
    }

    y -= notesH;

    // Buyer down money row
    if(mode === "buyer"){
      const dmRowH = 18;
      page.drawRectangle({
        x: M, y: y - dmRowH, width: contentW, height: dmRowH,
        color: FILL,
        borderWidth: CONFIG.PDF.borderW,
        borderColor: rgb(0.55, 0.55, 0.55)
      });
      page.drawText(`Down Money Due: ${dm}`, {
        x: M + CONFIG.PDF.padX,
        y: y - 13,
        size: 10.0,
        font: fontBold,
        color: rgb(0,0,0)
      });
      y -= dmRowH;
    }

    y -= CONFIG.PDF.lotGap;
  }

  const sorted = [...rows].sort(sortLots);

  for(const r of sorted){
    ensureRoom(r);
    drawLotBlock(r);
  }

  // ===== Buyer footer =====
  if(mode === "buyer" && !singleLotMode){
    // now decide if footer fits; if not, add a page (this is the lots-per-page fix)
    const footerNeed = CONFIG.PDF.footerMinH + 36;
    if(y < bottomLimit + footerNeed){
      newPage();
    }

    // Total box immediately after last lot
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
      borderColor: rgb(0.55,0.55,0.55)
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
      color: rgb(0,0,0)
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

    page.drawText(footerHeader, {
      x: M,
      y: y,
      size: 8.2,
      font: fontBold,
      color: rgb(0,0,0)
    });
    y -= (CONFIG.PDF.footerLineH + 4);

    let ly = y;
    for(const ln of leftLines){
      page.drawText(ln, { x: leftX, y: ly, size: 7.9, font, color: rgb(0,0,0) });
      ly -= CONFIG.PDF.footerLineH;
    }

    let ry = y;
    for(const ln of rightLines){
      page.drawText(ln, { x: rightX, y: ry, size: 7.9, font, color: rgb(0,0,0) });
      ry -= CONFIG.PDF.footerLineH;
    }
  }

  return await pdfDoc.save();
}

// ====== DOCX GENERATION ======
function ensureDocxLibs(){
  if(!window.PizZip) throw new Error("PizZip not loaded. Add pizzip script tag.");
  if(!window.docxtemplater) throw new Error("docxtemplater not loaded. Add docxtemplater script tag.");
}

function buildDocxFromTemplate(templateBytes, data){
  ensureDocxLibs();
  const zip = new window.PizZip(templateBytes);
  const doc = new window.docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.setData(data);
  doc.render();
  const out = doc.getZip().generate({ type: "uint8array" });
  return out;
}

function yearFromRow(row){
  const y = safeStr(row[CONFIG.COLS.year]);
  if(y) return y;
  const now = new Date();
  return String(now.getFullYear());
}

// Map CSV row -> placeholders in your templates
function contractTemplateData(row){
  const contract = safeStr(getContract(row));
  const consignor = safeStr(row[CONFIG.COLS.consignor]);
  const buyer = safeStr(row[CONFIG.COLS.buyer]);
  const lotNumber2 = contract; // you asked to pull contract anywhere lot# appears
  const headCount = safeStr(row[CONFIG.COLS.head]) || "0";
  const breed = safeStr(row[CONFIG.COLS.breed]) || safeStr(row[CONFIG.COLS.description]);
  const sex = safeStr(row[CONFIG.COLS.sex]);
  const baseWeight = safeStr(row[CONFIG.COLS.baseWeight]);
  const delivery = safeStr(row[CONFIG.COLS.delivery]);
  const year = yearFromRow(row);
  const price = safeStr(row[CONFIG.COLS.price]) ? safeStr(row[CONFIG.COLS.price]) : "0";
  const calcHighBid = priceDisplay(price).replace("$",""); // template expects numeric-ish; keep clean
  const location = safeStr(row[CONFIG.COLS.location]);
  const shrink = safeStr(row[CONFIG.COLS.shrink]);
  const slide = safeStr(row[CONFIG.COLS.slide]);
  const desc = safeStr(row[CONFIG.COLS.description]);
  const desc2 = safeStr(row[CONFIG.COLS.secondDescription]);
  const downMoney = downMoneyDisplay(row[CONFIG.COLS.downMoney]);

  // Use the exact placeholder keys from your docx templates:
  // Seller template :contentReference[oaicite:4]{index=4} and Buyer template :contentReference[oaicite:5]{index=5}
  return {
    "Contract #": contract,
    "Consignor": consignor,
    "Buyer": buyer,
    "Lot Number #2": lotNumber2,
    "Head Count": headCount,
    "Breed": breed,
    "Sex": sex,
    "Base Weight": baseWeight,
    "Delivery": delivery,
    "Year": year,
    "Calculated High Bid": calcHighBid,
    "Location": location,
    "shrink": shrink,
    "Shrink": shrink, // both variants exist across templates
    "Slide": slide,
    "Description": desc,
    "Second Description": desc2,
    "Down Money Due": downMoney
  };
}

// ====== DOWNLOAD / ZIP ======
function downloadBytes(bytes, filename, mime="application/pdf"){
  const blob = new Blob([bytes], {type:mime});
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
  }, 20000);
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
  }, 25000);
}

// ====== RESULTS UI ======
function renderList(container, items, mimeHint="pdf"){
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
    meta.textContent = `${it.count || 1} item(s)`;

    left.appendChild(name);
    left.appendChild(meta);

    const btn = document.createElement("button");
    btn.className = "btn btnSmall";
    btn.textContent = "Download";
    btn.addEventListener("click", ()=> {
      const mime = (mimeHint === "docx")
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/pdf";
      downloadBytes(it.bytes, it.filename, mime);
    });

    row.appendChild(left);
    row.appendChild(btn);

    container.appendChild(row);
  }
}

function renderResults(){
  const total =
    generated.buyers.length +
    generated.consignors.length +
    generated.reps.length +
    generated.lotbylot.length +
    generated.buyerDocs.length +
    generated.sellerDocs.length;

  resultsMeta.textContent = `Generated ${total} file(s) from ${csvRows.length} row(s).`;

  // Existing three lists are reused as:
  // Buyers list -> buyer PDFs + lot-by-lot PDFs
  // Consignors list -> consignor PDFs + seller docs
  // Reps list -> rep PDFs + buyer docs
  // (If you want separate sections in the UI, say so and I’ll split them cleanly.)
  const buyersCombined = [...generated.buyers, ...generated.lotbylot];
  const consignorsCombined = [...generated.consignors, ...generated.sellerDocs];
  const repsCombined = [...generated.reps, ...generated.buyerDocs];

  renderList(listBuyers, buyersCombined, "pdf");
  renderList(listConsignors, consignorsCombined, "pdf"); // mixed; download uses stored filename/mime at click time
  renderList(listReps, repsCombined, "pdf");

  zipBuyers.disabled = buyersCombined.length === 0;
  zipConsignors.disabled = consignorsCombined.length === 0;
  zipReps.disabled = repsCombined.length === 0;
  zipAll.disabled = total === 0;
}

// ====== BUILD ======
buildBtn.addEventListener("click", async ()=>{
  setError(builderError, "");
  buildBtn.disabled = true;
  buildBtn.textContent = "Generating…";

  try{
    assertLibsLoaded();

    if(csvRows.length === 0) throw new Error("Upload a CSV first.");

    const anyChecked =
      chkBuyer.checked || chkConsignor.checked || chkRep.checked ||
      chkLotByLot.checked || chkBuyerContracts.checked || chkSellerContracts.checked;

    if(!anyChecked) throw new Error("Select at least one output option.");

    const chk = requiredColsPresent(csvRows);
    if(!chk.ok) throw new Error(`CSV missing required column(s): ${chk.missing.join(", ")}`);

    if(!contractColName) throw new Error("Contract column not detected. Re-upload CSV.");

    // DOCX template requirements
    if(chkBuyerContracts.checked && !buyerTemplateBytes){
      throw new Error("Buyer Contract DOCX selected — please upload the Buyer Contract template (.docx) first.");
    }
    if(chkSellerContracts.checked && !sellerTemplateBytes){
      throw new Error("Seller Contract DOCX selected — please upload the Seller Contract template (.docx) first.");
    }

    generated = { buyers:[], consignors:[], reps:[], lotbylot:[], buyerDocs:[], sellerDocs:[] };
    listBuyers.innerHTML = "";
    listConsignors.innerHTML = "";
    listReps.innerHTML = "";

    zipBuyers.disabled = true;
    zipConsignors.disabled = true;
    zipReps.disabled = true;
    zipAll.disabled = true;
    resultsMeta.textContent = "";

    // BUYER PDFs (grouped)
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

    // CONSIGNOR PDFs (grouped)
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

    // REP PDFs (grouped)
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

    // LOT-BY-LOT PDFs (one lot per file; buyer-report style but no totals/footer)
    if(chkLotByLot.checked){
      const sorted = [...csvRows].sort(sortLots);
      for(const r of sorted){
        const contract = safeStr(getContract(r));
        const bytes = await buildPdfForGroup({
          entityName: `Contract # ${contract}`,
          rows: [r],
          mode: "buyer",
          singleLotMode: true
        });
        const filename = `Contract-${fileSafeName(contract)}.pdf`;
        generated.lotbylot.push({name: contract, filename, bytes, count: 1});
      }
    }

    // BUYER CONTRACT DOCX (per lot)
    if(chkBuyerContracts.checked){
      for(const r of [...csvRows].sort(sortLots)){
        const contract = safeStr(getContract(r));
        const data = contractTemplateData(r);
        const bytes = buildDocxFromTemplate(buyerTemplateBytes, data);
        const filename = `Buyer-Contract-${fileSafeName(contract)}.docx`;
        generated.buyerDocs.push({name: contract, filename, bytes, count: 1});
      }
    }

    // SELLER CONTRACT DOCX (per lot)
    if(chkSellerContracts.checked){
      for(const r of [...csvRows].sort(sortLots)){
        const contract = safeStr(getContract(r));
        const data = contractTemplateData(r);
        const bytes = buildDocxFromTemplate(sellerTemplateBytes, data);
        const filename = `Seller-Contract-${fileSafeName(contract)}.docx`;
        generated.sellerDocs.push({name: contract, filename, bytes, count: 1});
      }
    }

    // Results view
    renderResults();
    goto(pageResults);

  } catch (err) {
    console.error(err);
    const msg = (err && err.message) ? err.message : String(err);
    setError(builderError, `Generation error: ${msg}`);
  } finally {
    buildBtn.disabled = false;
    buildBtn.textContent = "Generate Files";
    setBuildEnabled();
  }
});

// ====== ZIP BUTTONS ======
zipBuyers.addEventListener("click", ()=>{
  const buyersCombined = [...generated.buyers, ...generated.lotbylot];
  downloadZip(buyersCombined, "Buyer-and-Lot-Reports.zip");
});
zipConsignors.addEventListener("click", ()=>{
  const consignorsCombined = [...generated.consignors, ...generated.sellerDocs];
  downloadZip(consignorsCombined, "Consignor-Reports-and-Seller-Contracts.zip");
});
zipReps.addEventListener("click", ()=>{
  const repsCombined = [...generated.reps, ...generated.buyerDocs];
  downloadZip(repsCombined, "Rep-Reports-and-Buyer-Contracts.zip");
});
zipAll.addEventListener("click", ()=>{
  const all = [
    ...generated.buyers,
    ...generated.consignors,
    ...generated.reps,
    ...generated.lotbylot,
    ...generated.buyerDocs,
    ...generated.sellerDocs
  ];
  downloadZip(all, "All-Generated-Files.zip");
});

backBtn.addEventListener("click", ()=> goto(pageBuilder));

// ====== INIT ======
goto(pageAuth);
setBuildEnabled();
