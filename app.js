/* CMS Post-Auction Portal (client-only) — FULL app.js (UPDATED FOR NEW HTML)

Matches new index.html IDs:
- Separate results sections (Buyer Reports, Lot-by-lot, Consignor, Rep, Buyer DOCX, Seller DOCX)
- Separate ZIP buttons per section
- Drag/drop zones for Buyer/Seller template uploads

Fixes:
1) Header overlap: center title placed below auction date (4-line layout)
2) Lots on pages after first start after header (no overlap)
3) Lot-by-lot: Buyer shown correctly (not contract #)
4) Lot-by-lot: separate results section + ZIP
5) CharolaisX Beef on Dairy -> gold color (#C9A66B)
6) Consignor top bar uses Native color (#3FA796)
7) Template uploads are drag/drop + click, with confirmations

DOCX “Multi error” now returns readable messages:
- Missing tags / unmatched braces / missing placeholders, etc.
*/

const CONFIG = {
  PIN: "0623",

  COLS: {
    buyer: "Buyer",
    consignor: "Consignor",
    rep: "Representative",
    breed: "Breed", // optional; fallback to Description
    type: "Type",  // optional; used for consignor lot color
    year: "Year",  // optional

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
    bottomLimit: 9,
    topBarH: 8,

    // Increased header blocks to prevent overlap & ensure lots start below header
    headerHFirst: 92,
    headerHOther: 56,

    buyerNameSize: 14.4,
    otherNameSize: 12.6,
    headerSmall: 10.0,
    title: 12.0,

    lotTitle: 10.4,
    lotBreed: 9.4,
    gridLabel: 7.7,
    gridValue: 8.6,
    notes: 7.8,

    gridLineH: 10.2,
    notesLineH: 10.0,

    lotGap: 7,

    padX: 8,
    cellPadX: 5,
    cellPadY: 4,

    footerLineH: 10.6,
    footerMinH: 92,

    borderW: 1.0,
    innerW: 0.8,
  },

  COLORS: {
    cmsBlue: "#336699",       // Buyer bar
    native: "#3FA796",        // Consignor bar (per your request)
    repBar: "#6F8FAF",        // Rep bar (distinct + readable)
    textWhite: [1,1,1],
    textBlack: [0,0,0],
  },

  // Rep top lot box: stable per consignor palette
  REP_CONSIGNOR_PALETTE: [
    "#202E4A", // navy
    "#336699", // CMS blue
    "#3FA796", // teal
    "#6F8FAF", // steel blue
    "#C9A66B", // gold
  ],
};

// ====== DOM (AUTH/BUILDER/RESULTS) ======
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

const buyerTplDropZone = document.getElementById("buyerTplDropZone");
const sellerTplDropZone = document.getElementById("sellerTplDropZone");
const buyerTemplateInput = document.getElementById("buyerTemplateInput");
const sellerTemplateInput = document.getElementById("sellerTemplateInput");
const buyerTplMeta = document.getElementById("buyerTplMeta");
const sellerTplMeta = document.getElementById("sellerTplMeta");

const chkBuyer = document.getElementById("chkBuyer");
const chkConsignor = document.getElementById("chkConsignor");
const chkRep = document.getElementById("chkRep");
const chkLotByLot = document.getElementById("chkLotByLot");
const chkBuyerContracts = document.getElementById("chkBuyerContracts");
const chkSellerContracts = document.getElementById("chkSellerContracts");

const buildBtn = document.getElementById("buildBtn");
const builderError = document.getElementById("builderError");

const listBuyerReports = document.getElementById("listBuyerReports");
const listLotByLot = document.getElementById("listLotByLot");
const listConsignorReports = document.getElementById("listConsignorReports");
const listRepReports = document.getElementById("listRepReports");
const listBuyerContracts = document.getElementById("listBuyerContracts");
const listSellerContracts = document.getElementById("listSellerContracts");

const zipBuyerReports = document.getElementById("zipBuyerReports");
const zipLotByLot = document.getElementById("zipLotByLot");
const zipConsignorReports = document.getElementById("zipConsignorReports");
const zipRepReports = document.getElementById("zipRepReports");
const zipBuyerContracts = document.getElementById("zipBuyerContracts");
const zipSellerContracts = document.getElementById("zipSellerContracts");
const zipAll = document.getElementById("zipAll");

const backBtn = document.getElementById("backBtn");
const exitBtn = document.getElementById("exitBtn");
const resultsMeta = document.getElementById("resultsMeta");

// ====== STATE ======
let csvRows = [];
let contractColName = null;

let buyerTemplateBytes = null;
let sellerTemplateBytes = null;

let blobUrls = [];
let generated = {
  buyerReports: [],
  lotByLot: [],
  consignorReports: [],
  repReports: [],
  buyerDocs: [],
  sellerDocs: [],
};

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
    .slice(0, 140);
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
function requiredColsPresent(rows){
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
function sortLots(a,b){
  const sa = toNumber(a[CONFIG.COLS.lotSeq]);
  const sb = toNumber(b[CONFIG.COLS.lotSeq]);
  if(sa !== sb) return sa - sb;
  return getContract(a).localeCompare(getContract(b), undefined, {numeric:true});
}
function assertLibsLoaded(){
  if(!window.PDFLib) throw new Error("PDF library not loaded (pdf-lib).");
  if(!window.Papa) throw new Error("CSV parser not loaded (PapaParse).");
  if(!window.JSZip) throw new Error("ZIP library not loaded (JSZip).");
}
function ensureDocxLibs(){
  if(!window.PizZip) throw new Error("PizZip not loaded (pizzip).");
  if(!window.docxtemplater) throw new Error("docxtemplater not loaded.");
}
function hexToRgb01(hex){
  const h = hex.replace("#","").trim();
  const n = parseInt(h.length === 3 ? h.split("").map(c=>c+c).join("") : h, 16);
  return [((n>>16)&255)/255, ((n>>8)&255)/255, (n&255)/255];
}
function hashIndex(str, mod){
  let h = 0;
  const s = safeStr(str);
  for(let i=0;i<s.length;i++){
    h = ((h<<5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % mod;
}

// ====== TYPE COLOR (Consignor lot box) ======
// Your colors:
// BlackX/Beef on Dairy: #202E4A
// CharolaisX: #C9A66B
// Natives: #3FA796
// Holsteins: #6F8FAF
//
// Fix request #5:
// If it’s "CharolaisX Beef on Dairy" (both present), use gold (#C9A66B).
function pickTypeColorHex(row){
  const type = safeStr(row[CONFIG.COLS.type]).toLowerCase();
  const desc = safeStr(row[CONFIG.COLS.description]).toLowerCase();
  const breed = safeStr(row[CONFIG.COLS.breed]).toLowerCase();
  const hay = `${type} ${breed} ${desc}`.trim();

  const hasChar = hay.includes("charolais");
  const hasBod = hay.includes("beef on dairy") || hay.includes("beefx dairy") || hay.includes("beef x dairy");

  if(hasChar && hasBod) return "#C9A66B"; // CharolaisX Beef on Dairy -> GOLD

  if(hasChar) return "#C9A66B";
  if(hasBod || hay.includes("blackx") || hay.includes("black x")) return "#202E4A";
  if(hay.includes("native")) return "#3FA796";
  if(hay.includes("holstein")) return "#6F8FAF";

  return CONFIG.COLORS.cmsBlue;
}

// ====== AUTH ======
pinSubmit.addEventListener("click", () => {
  const entered = safeStr(pinInput.value);
  if(entered === CONFIG.PIN){
    setError(authError, "");
    pinInput.value = "";
    goto(pageBuilder);
  } else {
    setError(authError, "Incorrect PIN.");
  }
});
pinInput.addEventListener("keydown", (e)=>{ if(e.key === "Enter") pinSubmit.click(); });

// ====== FILE READERS ======
async function readFileBytes(file){
  if(!file) return null;
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

// ====== DRAG & DROP HELPERS ======
function wireDropZone({zoneEl, inputEl, onFile, metaEl}){
  if(!zoneEl || !inputEl) return;

  zoneEl.addEventListener("dragover", (e)=>{
    e.preventDefault();
    zoneEl.classList.add("dragover");
  });
  zoneEl.addEventListener("dragleave", ()=>{
    zoneEl.classList.remove("dragover");
  });
  zoneEl.addEventListener("drop", (e)=>{
    e.preventDefault();
    zoneEl.classList.remove("dragover");
    const f = e.dataTransfer.files?.[0];
    if(f){
      inputEl.value = "";
      onFile(f);
    }
  });

  inputEl.addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if(f) onFile(f);
  });

  if(metaEl){
    metaEl.textContent = "";
    metaEl.classList.add("hidden");
  }
}

// ====== CSV UPLOAD ======
function setBuildEnabled(){
  const anyChecked =
    chkBuyer.checked || chkConsignor.checked || chkRep.checked ||
    chkLotByLot.checked || chkBuyerContracts.checked || chkSellerContracts.checked;

  buildBtn.disabled = !(csvRows.length > 0 && anyChecked);
}

function handleCsvFile(file){
  setError(builderError, "");
  if(!file) return;

  fileMeta.textContent = `CSV loaded: ${file.name || "uploaded.csv"}`;
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
        setBuildEnabled();
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

// Wire CSV drop zone
wireDropZone({
  zoneEl: dropZone,
  inputEl: fileInput,
  onFile: handleCsvFile,
  metaEl: fileMeta
});

// ====== TEMPLATE UPLOADS (DRAG/DROP) ======
async function handleBuyerTemplate(file){
  setError(builderError, "");
  if(!file) return;
  buyerTemplateBytes = await readFileBytes(file);
  buyerTplMeta.textContent = `Buyer template loaded: ${file.name} (${buyerTemplateBytes.length.toLocaleString()} bytes)`;
  show(buyerTplMeta);
  setBuildEnabled();
}

async function handleSellerTemplate(file){
  setError(builderError, "");
  if(!file) return;
  sellerTemplateBytes = await readFileBytes(file);
  sellerTplMeta.textContent = `Seller template loaded: ${file.name} (${sellerTemplateBytes.length.toLocaleString()} bytes)`;
  show(sellerTplMeta);
  setBuildEnabled();
}

wireDropZone({
  zoneEl: buyerTplDropZone,
  inputEl: buyerTemplateInput,
  onFile: (f)=>handleBuyerTemplate(f),
  metaEl: buyerTplMeta
});

wireDropZone({
  zoneEl: sellerTplDropZone,
  inputEl: sellerTemplateInput,
  onFile: (f)=>handleSellerTemplate(f),
  metaEl: sellerTplMeta
});

// checkbox changes enable/disable button
[chkBuyer, chkConsignor, chkRep, chkLotByLot, chkBuyerContracts, chkSellerContracts].forEach(el => el?.addEventListener("change", setBuildEnabled));

// ====== EXIT / WIPE ======
function wipeAll(){
  for(const u of blobUrls){
    try{ URL.revokeObjectURL(u); }catch{}
  }
  blobUrls = [];

  csvRows = [];
  contractColName = null;

  buyerTemplateBytes = null;
  sellerTemplateBytes = null;

  fileInput.value = "";
  fileMeta.textContent = "";
  hide(fileMeta);

  buyerTemplateInput.value = "";
  sellerTemplateInput.value = "";
  buyerTplMeta.textContent = "";
  sellerTplMeta.textContent = "";
  hide(buyerTplMeta);
  hide(sellerTplMeta);

  auctionName.value = "";
  auctionDate.value = "";
  auctionLabel.value = "";

  listBuyerReports.innerHTML = "";
  listLotByLot.innerHTML = "";
  listConsignorReports.innerHTML = "";
  listRepReports.innerHTML = "";
  listBuyerContracts.innerHTML = "";
  listSellerContracts.innerHTML = "";

  zipBuyerReports.disabled = true;
  zipLotByLot.disabled = true;
  zipConsignorReports.disabled = true;
  zipRepReports.disabled = true;
  zipBuyerContracts.disabled = true;
  zipSellerContracts.disabled = true;
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
async function buildPdfForGroup({entityName, rows, mode, singleLotMode=false, forceBuyerName=null}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const BLACK = rgb(0,0,0);
  const WHITE = rgb(1,1,1);
  const FILL = rgb(0.98,0.98,0.98);

  // Top bar colors:
  // Buyer: CMS Blue
  // Consignor: Native (per request #6)
  // Rep: RepBar
  const topBarHex =
    mode === "buyer" ? CONFIG.COLORS.cmsBlue :
    mode === "consignor" ? CONFIG.COLORS.native :
    CONFIG.COLORS.repBar;

  const topBarColor = rgb(...hexToRgb01(topBarHex));

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const bottomLimit = CONFIG.PDF.bottomLimit;
  const contentW = W - 2*M;

  // Column widths (sum = 740)
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
  const gridW = colDefs.reduce((s,c)=>s+c.w,0);

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  const leftLabel =
    mode === "buyer" ? "Buyer" : (mode === "consignor" ? "Consignor" : "Rep");

  // The document title:
  // Buyer: "Buyer Recap and Down Money Invoice"
  // Others: "Trade Confirmations"
  const docTitle =
    mode === "buyer" ? "Buyer Recap and Down Money Invoice" : "Trade Confirmations";

  const nameSize = (mode === "buyer") ? CONFIG.PDF.buyerNameSize : CONFIG.PDF.otherNameSize;

  const addrLines = [
    "CMS Livestock Auction",
    "6900 I-40 West, Suite 135",
    "Amarillo, TX 79106",
    "(806) 355-7505"
  ];

  let page = pdfDoc.addPage([W,H]);
  let pageIndex = 0;
  let y = H - M;

  function textWidthLocal(txt, size, bold=false){
    const f = bold ? fontBold : font;
    return f.widthOfTextAtSize(txt || "", size);
  }

  function wrapLines(fontObj, text, size, maxW){
    const words = safeStr(text).split(/\s+/).filter(Boolean);
    if(words.length === 0) return [""];
    const lines = [];
    let line = words[0];
    for(let i=1;i<words.length;i++){
      const test = line + " " + words[i];
      if(fontObj.widthOfTextAtSize(test, size) <= maxW){
        line = test;
      } else {
        lines.push(line);
        line = words[i];
      }
    }
    lines.push(line);
    return lines;
  }

  function drawTopBar(){
    page.drawRectangle({
      x: 0,
      y: H - CONFIG.PDF.topBarH,
      width: W,
      height: CONFIG.PDF.topBarH,
      color: topBarColor
    });
  }

  // ===== HEADER LAYOUT (FIXES #1, #2) =====
  // First page:
  // LEFT block (4 lines):
  // 1) Buyer/Consignor/Rep: NAME
  // 2) Auction Title
  // 3) Auction Date
  // 4) Document Title (centered but placed on its own line)
  //
  // RIGHT block (4 lines):
  // 1) CMS Livestock Auction
  // 2) 6900...
  // 3) Amarillo...
  // 4) phone
  //
  // Other pages:
  // LEFT:
  // 1) Buyer/Consignor/Rep: NAME
  // RIGHT:
  // 1) CMS Livestock Auction
  // 2) Auction Title
  // 3) Auction Date
  //
  function drawHeader(){
    drawTopBar();

    const headerH = (pageIndex === 0) ? CONFIG.PDF.headerHFirst : CONFIG.PDF.headerHOther;

    const topY = (pageIndex === 0)
      ? (H - CONFIG.PDF.topBarH - 20)
      : (H - CONFIG.PDF.topBarH - 22);

    const lx = M;
    const rightBlockW = 300;
    const rx = M + contentW - rightBlockW;

    // LEFT line 1: entity label
    const leftName = forceBuyerName ? safeStr(forceBuyerName) : safeStr(entityName);
    page.drawText(`${leftLabel}: ${leftName}`, {
      x: lx,
      y: topY,
      size: nameSize,
      font: fontBold,
      color: BLACK
    });

    if(pageIndex === 0){
      // LEFT line 2-3: auction title/date
      page.drawText(safeStr(auctionTitle), {
        x: lx,
        y: topY - 14,
        size: 10.0,
        font,
        color: BLACK
      });

      if(aDate){
        page.drawText(safeStr(aDate), {
          x: lx,
          y: topY - 26,
          size: 10.0,
          font,
          color: BLACK
        });
      }

      // DOC TITLE on its own line, centered across page, BELOW auction date (fix overlap)
      const titleY = topY - 42;
      const titleW = textWidthLocal(docTitle, CONFIG.PDF.title, true);
      page.drawText(docTitle, {
        x: M + (contentW - titleW)/2,
        y: titleY,
        size: CONFIG.PDF.title,
        font: fontBold,
        color: BLACK
      });

      // RIGHT 4-line CMS block
      page.drawText(addrLines[0], { x: rx, y: topY,      size: 10.0, font: fontBold, color: BLACK });
      page.drawText(addrLines[1], { x: rx, y: topY - 12, size:  9.2, font,         color: BLACK });
      page.drawText(addrLines[2], { x: rx, y: topY - 24, size:  9.2, font,         color: BLACK });
      page.drawText(addrLines[3], { x: rx, y: topY - 36, size:  9.2, font,         color: BLACK });

    } else {
      // Other pages: move auction title/date to top-right (fix #2)
      page.drawText("CMS Livestock Auction", {
        x: rx,
        y: topY,
        size: 10.0,
        font: fontBold,
        color: BLACK
      });

      page.drawText(safeStr(auctionTitle), {
        x: rx,
        y: topY - 12,
        size: 9.4,
        font,
        color: BLACK
      });

      if(aDate){
        page.drawText(safeStr(aDate), {
          x: rx,
          y: topY - 24,
          size: 9.4,
          font,
          color: BLACK
        });
      }
    }

    // Critical: start lots BELOW header area (fix #2)
    y = H - CONFIG.PDF.topBarH - headerH;
  }

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    pageIndex += 1;
    y = H - M;
    drawHeader();
  }

  drawHeader();

  // ===== LOT BLOCKS =====
  let buyerDownMoneyTotal = 0;

  function computeGridWrapped(record){
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
      const lines = wrapLines(font, values[c.key], CONFIG.PDF.gridValue, cellW);
      wrapped[c.key] = lines;
      maxLines = Math.max(maxLines, lines.length);
    }
    return { wrapped, maxLines };
  }

  function computeNotesLines(record){
    const desc = safeStr(record[CONFIG.COLS.description]);
    const desc2 = safeStr(record[CONFIG.COLS.secondDescription]);
    const notesText = [desc, desc2].filter(Boolean).join("  |  ");
    const full = safeStr(`Notes: ${notesText}`);
    const maxW = contentW - 2*CONFIG.PDF.padX;
    return wrapLines(font, full, CONFIG.PDF.notes, maxW);
  }

  function lotBlockHeight(record){
    const row1H = 32;
    const labelH = 14;
    const { maxLines } = computeGridWrapped(record);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    const notesLines = computeNotesLines(record);
    const notesH = 8 + (notesLines.length * CONFIG.PDF.notesLineH) + 2;

    const dmRowH = (mode === "buyer") ? 18 : 0;
    return row1H + gridH + notesH + dmRowH + CONFIG.PDF.lotGap;
  }

  function ensureRoom(record){
    const need = lotBlockHeight(record);
    if((y - need) < bottomLimit){
      newPage();
    }
  }

  function drawLotHeaderRow({textLeft, fillHex=null}){
    const { rgb } = window.PDFLib;
    const row1H = 32;
    const fill = fillHex ? rgb(...hexToRgb01(fillHex)) : rgb(1,1,1);
    const textColor = fillHex ? rgb(...CONFIG.COLORS.textWhite) : rgb(0,0,0);

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

  function drawCenteredLines(lines, xCenter, yTop, lineH, size){
    const { rgb } = window.PDFLib;
    let yy = yTop;
    for(const ln of lines){
      const w = font.widthOfTextAtSize(ln || "", size);
      page.drawText(ln, { x: xCenter - w/2, y: yy, size, font, color: rgb(0,0,0) });
      yy -= lineH;
    }
  }

  function drawLotBlock(r){
    const contract = safeStr(getContract(r));
    const consignor = safeStr(r[CONFIG.COLS.consignor]);
    const breed = safeStr(r[CONFIG.COLS.breed]) || safeStr(r[CONFIG.COLS.description]);

    if(mode === "buyer"){
      buyerDownMoneyTotal += toNumber(r[CONFIG.COLS.downMoney]);
    }

    // TOP LOT BOX coloring rules:
    // - Rep: color by consignor
    // - Consignor: color by Type mapping
    // - Buyer: none
    let headerFillHex = null;
    if(mode === "rep"){
      const idx = hashIndex(consignor, CONFIG.REP_CONSIGNOR_PALETTE.length);
      headerFillHex = CONFIG.REP_CONSIGNOR_PALETTE[idx];
    } else if(mode === "consignor"){
      headerFillHex = pickTypeColorHex(r);
    }

    // Use Contract # anywhere lot# would appear
    const topLine = `Contract # ${contract} - ${consignor}`;
    const row1H = drawLotHeaderRow({textLeft: topLine, fillHex: headerFillHex});

    // Breed line inside the same top box
    const { rgb } = window.PDFLib;
    const breedColor = headerFillHex ? rgb(...CONFIG.COLORS.textWhite) : rgb(0,0,0);
    page.drawText(safeStr(breed), {
      x: M + CONFIG.PDF.padX,
      y: y - 27,
      size: CONFIG.PDF.lotBreed,
      font,
      color: breedColor
    });

    y -= row1H;

    // Grid box
    const labelH = 14;
    const { wrapped, maxLines } = computeGridWrapped(r);
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

      const lw = fontBold.widthOfTextAtSize(c.label, CONFIG.PDF.gridLabel);
      page.drawText(c.label, {
        x: cellCenter - lw/2,
        y: y - 11,
        size: CONFIG.PDF.gridLabel,
        font: fontBold,
        color: rgb(0,0,0)
      });

      const lines = wrapped[c.key] || [""];
      const startY = y - labelH - 11;
      drawCenteredLines(lines, cellCenter, startY, CONFIG.PDF.gridLineH, CONFIG.PDF.gridValue);

      cx += c.w;
    }

    y -= gridH;

    // Notes box
    const notesLines = computeNotesLines(r);
    const notesH = 8 + (notesLines.length * CONFIG.PDF.notesLineH) + 2;

    page.drawRectangle({
      x: M, y: y - notesH, width: contentW, height: notesH,
      color: rgb(1,1,1),
      borderWidth: CONFIG.PDF.borderW,
      borderColor: rgb(0.55, 0.55, 0.55)
    });

    let ny = y - 12;
    for(const ln of notesLines){
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

    // Buyer down money row per lot
    if(mode === "buyer"){
      const dmRowH = 18;
      const dm = downMoneyDisplay(r[CONFIG.COLS.downMoney]);
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

  // Buyer footer only when not single-lot mode
  if(mode === "buyer" && !singleLotMode){
    const footerNeed = CONFIG.PDF.footerMinH + 36;
    if(y < bottomLimit + footerNeed){
      newPage();
    }

    // Total box immediately after last lot
    const { rgb } = window.PDFLib;
    const totalBoxW = 270;
    const totalBoxH = 22;
    const totalX = M + contentW - totalBoxW;
    const totalY = y - totalBoxH;

    page.drawRectangle({
      x: totalX,
      y: totalY,
      width: totalBoxW,
      height: totalBoxH,
      color: rgb(1,1,1),
      borderWidth: CONFIG.PDF.borderW,
      borderColor: rgb(0.55,0.55,0.55)
    });

    const totalText = `Total Down Money Due: ${formatMoney(buyerDownMoneyTotal)}`;
    let ts = 10.6;
    while(ts > 8.6 && fontBold.widthOfTextAtSize(totalText, ts) > (totalBoxW - 12)){
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

    // Footer (no overlapping)
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
function yearFromRow(row){
  const y = safeStr(row[CONFIG.COLS.year]);
  if(y) return y;
  return String(new Date().getFullYear());
}

function contractTemplateData(row){
  const contract = safeStr(getContract(row));
  const consignor = safeStr(row[CONFIG.COLS.consignor]);
  const buyer = safeStr(row[CONFIG.COLS.buyer]);

  const headCount = safeStr(row[CONFIG.COLS.head]) || "0";
  const breed = safeStr(row[CONFIG.COLS.breed]) || safeStr(row[CONFIG.COLS.description]);
  const sex = safeStr(row[CONFIG.COLS.sex]);
  const baseWeight = safeStr(row[CONFIG.COLS.baseWeight]);
  const delivery = safeStr(row[CONFIG.COLS.delivery]);
  const year = yearFromRow(row);

  const priceRaw = safeStr(row[CONFIG.COLS.price]) || "0";
  const calcHighBid = priceDisplay(priceRaw).replace("$","");

  const location = safeStr(row[CONFIG.COLS.location]);
  const shrink = safeStr(row[CONFIG.COLS.shrink]);
  const slide = safeStr(row[CONFIG.COLS.slide]);
  const desc = safeStr(row[CONFIG.COLS.description]);
  const desc2 = safeStr(row[CONFIG.COLS.secondDescription]);
  const downMoney = downMoneyDisplay(row[CONFIG.COLS.downMoney]);

  // Keys must match your template placeholders EXACTLY.
  // If templates differ, we’ll map them later — but this will now show readable errors.
  return {
    "Contract #": contract,
    "Consignor": consignor,
    "Buyer": buyer,
    "Lot Number #2": contract, // you want contract where lot # shows
    "Head Count": headCount,
    "Breed": breed,
    "Sex": sex,
    "Base Weight": baseWeight,
    "Delivery": delivery,
    "Year": year,
    "Calculated High Bid": calcHighBid,
    "Location": location,
    "Shrink": shrink,
    "shrink": shrink,
    "Slide": slide,
    "Description": desc,
    "Second Description": desc2,
    "Down Money Due": downMoney
  };
}

// Convert docxtemplater errors into readable text
function formatDocxError(err){
  if(!err) return "Unknown DOCX error.";
  if(err.message && err.name !== "MultiError") return err.message;

  // MultiError: err.properties.errors is usually present
  const lines = [];
  lines.push("DOCX template error(s):");

  const errors = err?.properties?.errors || [];
  for(const e of errors){
    const explanation = e.properties?.explanation || e.message || "Unknown issue";
    const id = e.properties?.id ? ` (${e.properties.id})` : "";
    lines.push(`- ${explanation}${id}`);
  }

  // Common: unmatched braces or malformed tags
  const raw = err.message ? `\n${err.message}` : "";
  return lines.join("\n") + raw;
}

function buildDocxFromTemplate(templateBytes, data){
  ensureDocxLibs();
  try{
    const zip = new window.PizZip(templateBytes);
    const doc = new window.docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => "" // prevents "undefined" in output, reduces template errors
    });
    doc.setData(data);
    doc.render();
    return doc.getZip().generate({ type: "uint8array" });
  } catch (e) {
    // Re-throw as readable error
    throw new Error(formatDocxError(e));
  }
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

// ====== RESULTS RENDER ======
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
    generated.buyerReports.length +
    generated.lotByLot.length +
    generated.consignorReports.length +
    generated.repReports.length +
    generated.buyerDocs.length +
    generated.sellerDocs.length;

  resultsMeta.textContent = `Generated ${total} file(s) from ${csvRows.length} row(s).`;

  renderList(listBuyerReports, generated.buyerReports, "pdf");
  renderList(listLotByLot, generated.lotByLot, "pdf");
  renderList(listConsignorReports, generated.consignorReports, "pdf");
  renderList(listRepReports, generated.repReports, "pdf");
  renderList(listBuyerContracts, generated.buyerDocs, "docx");
  renderList(listSellerContracts, generated.sellerDocs, "docx");

  zipBuyerReports.disabled = generated.buyerReports.length === 0;
  zipLotByLot.disabled = generated.lotByLot.length === 0;
  zipConsignorReports.disabled = generated.consignorReports.length === 0;
  zipRepReports.disabled = generated.repReports.length === 0;
  zipBuyerContracts.disabled = generated.buyerDocs.length === 0;
  zipSellerContracts.disabled = generated.sellerDocs.length === 0;
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

    // DOCX requirements
    if(chkBuyerContracts.checked){
      ensureDocx
          // DOCX requirements
    if(chkBuyerContracts.checked){
      ensureDocxLibs();
      if(!buyerTemplateBytes) throw new Error("Buyer Contract template is required for Buyer Contract DOCX. Upload the .docx template first.");
    }
    if(chkSellerContracts.checked){
      ensureDocxLibs();
      if(!sellerTemplateBytes) throw new Error("Seller Contract template is required for Seller Contract DOCX. Upload the .docx template first.");
    }

    // Reset prior generated state
    generated = {
      buyerReports: [],
      lotByLot: [],
      consignorReports: [],
      repReports: [],
      buyerDocs: [],
      sellerDocs: [],
    };

    // ===== PDF GROUPS =====
    // Buyer: group by Buyer (one PDF per buyer, includes all their contracts)
    // Consignor: group by Consignor (one PDF per consignor, includes all their contracts)
    // Rep: group by Representative (one PDF per rep, includes all their consignors/lots; skip blank reps)
    const buyerGroups = groupBy(csvRows, CONFIG.COLS.buyer);
    const consignorGroups = groupBy(csvRows, CONFIG.COLS.consignor);
    const repGroups = groupBy(csvRows.filter(r => safeStr(r[CONFIG.COLS.rep]) !== ""), CONFIG.COLS.rep);

    // Buyer PDFs
    if(chkBuyer.checked){
      for(const [buyerName, rows] of buyerGroups.entries()){
        const cleanName = fileSafeName(buyerName || "Unknown Buyer");
        const pdfBytes = await buildPdfForGroup({
          entityName: buyerName || "Unknown Buyer",
          rows,
          mode: "buyer",
          singleLotMode: false
        });
        generated.buyerReports.push({
          filename: `${cleanName}-Contract.pdf`,
          bytes: pdfBytes,
          count: rows.length
        });
      }
    }

    // Consignor PDFs
    if(chkConsignor.checked){
      for(const [consName, rows] of consignorGroups.entries()){
        const cleanName = fileSafeName(consName || "Unknown Consignor");
        const pdfBytes = await buildPdfForGroup({
          entityName: consName || "Unknown Consignor",
          rows,
          mode: "consignor",
          singleLotMode: false
        });
        generated.consignorReports.push({
          filename: `Contract-${cleanName}.pdf`,
          bytes: pdfBytes,
          count: rows.length
        });
      }
    }

    // Rep PDFs (skip blanks already done)
    if(chkRep.checked){
      for(const [repName, rows] of repGroups.entries()){
        const cleanName = fileSafeName(repName || "Unknown Rep");
        const pdfBytes = await buildPdfForGroup({
          entityName: repName || "Unknown Rep",
          rows,
          mode: "rep",
          singleLotMode: false
        });
        generated.repReports.push({
          filename: `Rep-${cleanName}-Contract.pdf`,
          bytes: pdfBytes,
          count: rows.length
        });
      }
    }

    // ===== LOT-BY-LOT PDFS =====
    // One PDF per row/lot. Looks like buyer report layout, but with a single lot.
    // IMPORTANT: Buyer must be shown as Buyer (not contract number).
    if(chkLotByLot.checked){
      const sortedAll = [...csvRows].sort(sortLots);
      for(const r of sortedAll){
        const contract = safeStr(getContract(r)) || "Unknown";
        const buyer = safeStr(r[CONFIG.COLS.buyer]) || "Unknown Buyer";

        const pdfBytes = await buildPdfForGroup({
          entityName: buyer,
          rows: [r],
          mode: "buyer",
          singleLotMode: true,
          forceBuyerName: buyer
        });

        generated.lotByLot.push({
          filename: `Contract-${fileSafeName(contract)}.pdf`,
          bytes: pdfBytes,
          count: 1
        });
      }
    }

    // ===== DOCX CONTRACTS (PER LOT) =====
    // Buyer Contract DOCX: one per lot
    if(chkBuyerContracts.checked){
      for(const r of [...csvRows].sort(sortLots)){
        const contract = safeStr(getContract(r)) || "Unknown";
        const data = contractTemplateData(r);
        const docBytes = buildDocxFromTemplate(buyerTemplateBytes, data);

        generated.buyerDocs.push({
          filename: `Buyer-Contract-${fileSafeName(contract)}.docx`,
          bytes: docBytes,
          count: 1
        });
      }
    }

    // Seller Contract DOCX: one per lot
    if(chkSellerContracts.checked){
      for(const r of [...csvRows].sort(sortLots)){
        const contract = safeStr(getContract(r)) || "Unknown";
        const data = contractTemplateData(r);
        const docBytes = buildDocxFromTemplate(sellerTemplateBytes, data);

        generated.sellerDocs.push({
          filename: `Seller-Contract-${fileSafeName(contract)}.docx`,
          bytes: docBytes,
          count: 1
        });
      }
    }

    // Show results
    goto(pageResults);
    renderResults();

  } catch(err){
    console.error(err);
    setError(builderError, err?.message || "Generation error.");
  } finally {
    buildBtn.disabled = false;
    buildBtn.textContent = "Generate Files";
    setBuildEnabled();
  }
});

// ====== ZIP BUTTONS ======
zipBuyerReports.addEventListener("click", async ()=>{
  try{ await downloadZip(generated.buyerReports, "Buyer-Reports.zip"); } catch(e){ console.error(e); }
});
zipLotByLot.addEventListener("click", async ()=>{
  try{ await downloadZip(generated.lotByLot, "Lot-by-Lot.zip"); } catch(e){ console.error(e); }
});
zipConsignorReports.addEventListener("click", async ()=>{
  try{ await downloadZip(generated.consignorReports, "Consignor-Reports.zip"); } catch(e){ console.error(e); }
});
zipRepReports.addEventListener("click", async ()=>{
  try{ await downloadZip(generated.repReports, "Rep-Reports.zip"); } catch(e){ console.error(e); }
});
zipBuyerContracts.addEventListener("click", async ()=>{
  try{ await downloadZip(generated.buyerDocs, "Buyer-Contracts.zip"); } catch(e){ console.error(e); }
});
zipSellerContracts.addEventListener("click", async ()=>{
  try{ await downloadZip(generated.sellerDocs, "Seller-Contracts.zip"); } catch(e){ console.error(e); }
});

zipAll.addEventListener("click", async ()=>{
  try{
    const all = [
      ...generated.buyerReports,
      ...generated.lotByLot,
      ...generated.consignorReports,
      ...generated.repReports,
      ...generated.buyerDocs,
      ...generated.sellerDocs
    ];
    await downloadZip(all, "CMS-PostAuction-All.zip");
  } catch(e){
    console.error(e);
  }
});

// ====== NAV ======
backBtn.addEventListener("click", ()=>{
  goto(pageBuilder);
});

// Initialize
goto(pageAuth);
setBuildEnabled();
