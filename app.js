/* ==========================================================
   CMS Post-Auction Portal (client-only) — app.js
   - PDF only
   - CSV -> Buyer, Consignor, Rep, Contract Details (lot), Buyer Contracts, Seller Contracts
   - Drag/drop CSV
   - ZIP downloads
   - PIN gate (0623)
   ========================================================== */

console.log("CMS Post-Auction app.js loaded ✅");

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

    cmsInternalNotes: "CMS Internal Notes", // optional
  },

  CONTRACT_COL_CANDIDATES: [
    "Contract #",
    "Contract",
    "Contract Number",
    "Contract No",
    "Contract No."
  ],

  // EASY-EDIT TERMS (update here anytime)
  CONTRACT_TERMS: {
    buyer: `All cattle shall be in good physical condition and shall be free of any defects including to but not limited to lameness, crippled, bad eyes, and lump jaws.
Seller does hereby warrant that all cattle shall have clear title and be free of any and all encumbrances.  Buyer hereby grants a purchase money security interest in the above-described cattle to CMS Orita Calf Auctions, LLC to secure full payment and collection of the purchase price. 
Buyer does hereby agree to a down payment of $30.00 Per head ({{Down Money Due}} of Down Money Due) if delivery date is more than 30 days past the auction date as good faith money to be applied at the time of delivery.
Buyer does hereby agree to payment by wire transfer the day following delivery of the cattle or by overnight carrier at Buyer’s expense. Payments if sent overnight shall be sent to: 
CMS Livestock Auction 
6900 I-40 West, Suite 135 
Amarillo, TX 79106. 
The CMS Livestock Auction Video Auction Terms of Service Agreement as stated in auction registration and participation are incorporated by reference into this contract. If a discrepancy between this contract and the CMS Livestock Auction Video Auction Terms of Service Agreement arises, the CMS Livestock Auction Video Auction Terms of Service Agreement  shall take priority.`,

    seller: `All cattle shall be in good physical condition and shall be free of any defects including to but not limited to lameness, crippled, bad eyes, and lump jaws.
Seller agrees to deliver the above-described cattle to Buyer as sold through CMS Livestock Auction on the agreed-upon delivery date. Seller further agrees that once the cattle are sold through CMS Livestock Auction, Seller shall not sell, transfer, or otherwise dispose of the cattle to any party other than the Buyer prior to the delivery date without written consent from CMS Livestock Auction.
Seller represents and warrants that all information provided regarding the cattle, including weight, breed, age, and health status, is accurate to the best of Seller’s knowledge.
Seller does hereby warrant that all cattle shall have clear title and be free of any and all encumbrances.  
The CMS Livestock Auction Seller’s Terms of Service Agreement as signed prior to the auction are incorporated by reference into this contract. If a discrepancy between this contract and the CMS Livestock Auction Seller’s Terms of Service Agreement arises, the CMS Livestock Auction Seller’s Terms of Service Agreement shall take priority.`
  },

  PDF: {
    pageSize: { width: 792, height: 612 }, // landscape letter
    margin: 26,
    bottomLimit: 9,
    topBarH: 8,

    headerHFirst: 92,
    headerHOther: 56,

    buyerNameSize: 14.4,
    otherNameSize: 12.6,
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
    cmsBlue: "#336699",        // buyer top bar
    consignorColor: "#818589", // consignor top bar color
    repBar: "#6F8FAF",         // rep top bar
    textWhite: [1,1,1],
    textBlack: [0,0,0],
  },

  REP_CONSIGNOR_PALETTE: [
    "#202E4A",
    "#336699",
    "#3FA796",
    "#6F8FAF",
    "#C9A66B",
  ],
};

/* ---------------- DOM ---------------- */
function mustGet(id){
  const el = document.getElementById(id);
  if(!el) throw new Error(`Missing element in HTML: #${id}`);
  return el;
}

let pageAuth, pageBuilder, pageResults;
let pinInput, pinSubmit, authError;

let auctionName, auctionDate, auctionLabel;

let dropZone, fileInput, fileMeta;

let chkBuyer, chkConsignor, chkRep, chkLotByLot, chkBuyerContracts, chkSellerContracts;
let buildBtn, builderError;

let listBuyerReports, listLotByLot, listConsignorReports, listRepReports;
let listBuyerContracts, listSellerContracts;

let zipBuyerReports, zipLotByLot, zipConsignorReports, zipRepReports, zipAll;
let zipBuyerContracts, zipSellerContracts;

let backBtn, exitBtn, resultsMeta;

function bindDom(){
  pageAuth = mustGet("pageAuth");
  pageBuilder = mustGet("pageBuilder");
  pageResults = mustGet("pageResults");

  pinInput = mustGet("pinInput");
  pinSubmit = mustGet("pinSubmit");
  authError = mustGet("authError");

  auctionName = mustGet("auctionName");
  auctionDate = mustGet("auctionDate");
  auctionLabel = mustGet("auctionLabel");

  dropZone = mustGet("dropZone");
  fileInput = mustGet("fileInput");
  fileMeta = mustGet("fileMeta");

  chkBuyer = mustGet("chkBuyer");
  chkConsignor = mustGet("chkConsignor");
  chkRep = mustGet("chkRep");
  chkLotByLot = mustGet("chkLotByLot");
  chkBuyerContracts = mustGet("chkBuyerContracts");
  chkSellerContracts = mustGet("chkSellerContracts");

  buildBtn = mustGet("buildBtn");
  builderError = mustGet("builderError");

  listBuyerReports = mustGet("listBuyerReports");
  listLotByLot = mustGet("listLotByLot");
  listConsignorReports = mustGet("listConsignorReports");
  listRepReports = mustGet("listRepReports");
  listBuyerContracts = mustGet("listBuyerContracts");
  listSellerContracts = mustGet("listSellerContracts");

  zipBuyerReports = mustGet("zipBuyerReports");
  zipLotByLot = mustGet("zipLotByLot");
  zipBuyerContracts = mustGet("zipBuyerContracts");
  zipSellerContracts = mustGet("zipSellerContracts");
  zipConsignorReports = mustGet("zipConsignorReports");
  zipRepReports = mustGet("zipRepReports");
  zipAll = mustGet("zipAll");

  backBtn = mustGet("backBtn");
  exitBtn = mustGet("exitBtn");
  resultsMeta = mustGet("resultsMeta");
}

/* ---------------- STATE ---------------- */
let csvRows = [];
let contractColName = null;

let blobUrls = [];
let generated = {
  buyerReports: [],
  lotByLot: [],
  buyerContracts: [],
  sellerContracts: [],
  consignorReports: [],
  repReports: [],
};

/* ---------------- UTIL ---------------- */
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
  const required = Object.values(CONFIG.COLS).filter(c => ![
    CONFIG.COLS.breed,
    CONFIG.COLS.type,
    CONFIG.COLS.year,
    CONFIG.COLS.cmsInternalNotes
  ].includes(c));
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
  if(!window.PDFLib) throw new Error("pdf-lib not loaded.");
  if(!window.Papa) throw new Error("PapaParse not loaded.");
  if(!window.JSZip) throw new Error("JSZip not loaded.");
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

/* ---------------- TYPE COLOR (Consignor lot header box) ---------------- */
function pickTypeColorHex(row){
  const type = safeStr(row[CONFIG.COLS.type]).toLowerCase();
  const desc = safeStr(row[CONFIG.COLS.description]).toLowerCase();
  const breed = safeStr(row[CONFIG.COLS.breed]).toLowerCase();
  const hay = `${type} ${breed} ${desc}`.trim();

  const hasChar = hay.includes("charolais");
  const hasBod = hay.includes("beef on dairy") || hay.includes("beefx dairy") || hay.includes("beef x dairy");

  if(hasChar && hasBod) return "#C9A66B";
  if(hasChar) return "#C9A66B";
  if(hasBod || hay.includes("blackx") || hay.includes("black x")) return "#202E4A";
  if(hay.includes("native")) return "#3FA796";
  if(hay.includes("holstein")) return "#6F8FAF";

  return CONFIG.COLORS.cmsBlue;
}

/* ---------------- FILE HELPERS ---------------- */
function wireDropZone({zoneEl, inputEl, onFile, metaEl}){
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

/* ---------------- ENABLE BUILD ---------------- */
function setBuildEnabled(){
  const anyChecked =
    chkBuyer.checked ||
    chkConsignor.checked ||
    chkRep.checked ||
    chkLotByLot.checked ||
    chkBuyerContracts.checked ||
    chkSellerContracts.checked;

  buildBtn.disabled = !(csvRows.length > 0 && anyChecked);
}

/* ---------------- CSV HANDLER ---------------- */
function handleCsvFile(file){
  setError(builderError, "");
  if(!file) return;

  fileMeta.textContent = `CSV loaded: ${file.name || "uploaded.csv"}`;
  show(fileMeta);

  try{ assertLibsLoaded(); }
  catch(err){
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

/* ---------------- AUTH ---------------- */
function wireAuth(){
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

  pinInput.addEventListener("keydown", (e)=>{
    if(e.key === "Enter") pinSubmit.click();
  });
}

/* ---------------- SHARED TEXT WRAP ---------------- */
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

/* ---------------- PDF GENERATION: GROUP REPORTS + CONTRACT DETAILS ---------------- */
async function buildPdfForGroup({entityName, rows, mode, singleLotMode=false, forceBuyerName=null, headerRightBig=null}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const BLACK = rgb(0,0,0);
  const FILL = rgb(0.98,0.98,0.98);

  const topBarHex =
    mode === "buyer" ? CONFIG.COLORS.cmsBlue :
    mode === "consignor" ? CONFIG.COLORS.consignorColor :
    CONFIG.COLORS.repBar;

  const topBarColor = rgb(...hexToRgb01(topBarHex));

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const bottomLimit = CONFIG.PDF.bottomLimit;
  const contentW = W - 2*M;

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

  const docTitle =
    (mode === "buyer")
      ? (singleLotMode ? "Contract Details" : "Buyer Recap and Down Money Invoice")
      : "Trade Confirmations";

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
      ? (H - CONFIG.PDF.topBarH - 20)
      : (H - CONFIG.PDF.topBarH - 22);

    const lx = M;
    const rightBlockW = 300;
    const rx = M + contentW - rightBlockW;

    // For single-lot mode: do NOT show Buyer at top (you want it moved down)
    if(!singleLotMode){
      const leftName = forceBuyerName ? safeStr(forceBuyerName) : safeStr(entityName);
      page.drawText(`${leftLabel}: ${leftName}`, {
        x: lx,
        y: topY,
        size: nameSize,
        font: fontBold,
        color: BLACK
      });
    }

    if(pageIndex === 0){
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

      // doc title on left
      page.drawText(docTitle, {
        x: lx,
        y: topY - 40,
        size: CONFIG.PDF.title,
        font: fontBold,
        color: BLACK
      });

      // NEW: Big, top-right Contract # for Contract Details only
      if(singleLotMode && headerRightBig){
        const t = safeStr(headerRightBig);
        const s = 17.5;
        const w = fontBold.widthOfTextAtSize(t, s);
        page.drawText(t, {
          x: M + contentW - w,
          y: topY - 6, // visually top-right
          size: s,
          font: fontBold,
          color: BLACK
        });
      }

      page.drawText(addrLines[0], { x: rx, y: topY,      size: 10.0, font: fontBold, color: BLACK });
      page.drawText(addrLines[1], { x: rx, y: topY - 12, size:  9.2, font,         color: BLACK });
      page.drawText(addrLines[2], { x: rx, y: topY - 24, size:  9.2, font,         color: BLACK });
      page.drawText(addrLines[3], { x: rx, y: topY - 36, size:  9.2, font,         color: BLACK });

    } else {
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

    y = H - CONFIG.PDF.topBarH - headerH;
  }

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    pageIndex += 1;
    y = H - M;
    drawHeader();
  }

  drawHeader();

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

    // Contract Details: Buyer+Rep lines + extra spacing + down money received block + internal notes spacing
    const preLinesH = singleLotMode ? 40 : 0;     // increased: adds spacing under Buyer/Rep
    const receivedBlockH = singleLotMode ? 34 : 0;
    const internalNotesH = (singleLotMode && safeStr(record[CONFIG.COLS.cmsInternalNotes])) ? 36 : 0; // bold, plus added top spacing

    return preLinesH + row1H + gridH + notesH + dmRowH + receivedBlockH + internalNotesH + CONFIG.PDF.lotGap;
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
      x: M,
      y: y - row1H,
      width: contentW,
      height: row1H,
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
      page.drawText(ln, {
        x: xCenter - w/2,
        y: yy,
        size,
        font,
        color: rgb(0,0,0)
      });
      yy -= lineH;
    }
  }

  function drawSingleLotBuyerAndRepBlock(r){
    const buyer = safeStr(r[CONFIG.COLS.buyer]);
    const rep = safeStr(r[CONFIG.COLS.rep]);
    let used = 0;

    if(buyer){
      page.drawText(`Buyer: ${buyer}`, {
        x: M,
        y: y - 12,
        size: 12.2,
        font: fontBold,
        color: window.PDFLib.rgb(0,0,0)
      });
      used += 14;
    }
    if(rep){
      page.drawText(rep, {
        x: M,
        y: y - 12 - used,
        size: 10.6,
        font: font,
        color: window.PDFLib.rgb(0,0,0)
      });
      used += 14;
    }

    // NEW: a touch of spacing below Buyer/Rep block
    used += 10;

    y -= Math.max(0, used);
  }

  function drawDownMoneyReceivedBlock(){
    const { rgb } = window.PDFLib;
    const startY = y - 8;

    // Checkbox
    const box = 12;
    page.drawRectangle({
      x: M,
      y: startY - box + 2,
      width: box,
      height: box,
      borderWidth: 1.0,
      borderColor: rgb(0,0,0),
      color: rgb(1,1,1)
    });

    page.drawText("Down Money Received", {
      x: M + box + 8,
      y: startY,
      size: 10.6,
      font: fontBold,
      color: rgb(0,0,0)
    });

    // Initials + Date lines
    const lineY = startY - 18;
    const initialsX = M + 280;
    const dateX = M + 500;

    page.drawText("Initials:", { x: initialsX - 52, y: lineY + 2, size: 9.6, font, color: rgb(0,0,0) });
    page.drawLine({ start:{x: initialsX, y: lineY}, end:{x: initialsX + 110, y: lineY}, thickness:1.0, color: rgb(0,0,0) });

    page.drawText("Date:", { x: dateX - 34, y: lineY + 2, size: 9.6, font, color: rgb(0,0,0) });
    page.drawLine({ start:{x: dateX, y: lineY}, end:{x: dateX + 120, y: lineY}, thickness:1.0, color: rgb(0,0,0) });

    y = lineY - 6;
  }

  function drawCmsInternalNotesIfAny(r){
    const n = safeStr(r[CONFIG.COLS.cmsInternalNotes]);
    if(!n) return;

    // NEW: add good spacing before internal notes
    y -= 18;

    const { rgb } = window.PDFLib;
    const label = "CMS Internal Notes: ";
    const size = 10.0;

    // Entire internal notes block bold
    const labelW = fontBold.widthOfTextAtSize(label, size);
    const maxW = (W - 2*M) - labelW;
    const lines = wrapLines(fontBold, n, size, maxW);

    let yy = y - 10;

    page.drawText(label, { x: M, y: yy, size, font: fontBold, color: rgb(0,0,0) });
    page.drawText(lines[0] || "", { x: M + labelW, y: yy, size, font: fontBold, color: rgb(0,0,0) });
    yy -= 12;

    for(let i=1;i<lines.length;i++){
      page.drawText(lines[i], { x: M + labelW, y: yy, size, font: fontBold, color: rgb(0,0,0) });
      yy -= 12;
    }

    y = yy;
  }

  function drawLotBlock(r){
    const contract = safeStr(getContract(r));
    const consignor = safeStr(r[CONFIG.COLS.consignor]);
    const breed = safeStr(r[CONFIG.COLS.breed]) || safeStr(r[CONFIG.COLS.description]);

    if(mode === "buyer"){
      buyerDownMoneyTotal += toNumber(r[CONFIG.COLS.downMoney]);
    }

    if(mode === "buyer" && singleLotMode){
      drawSingleLotBuyerAndRepBlock(r);
    }

    let headerFillHex = null;
    if(mode === "rep"){
      const idx = hashIndex(consignor, CONFIG.REP_CONSIGNOR_PALETTE.length);
      headerFillHex = CONFIG.REP_CONSIGNOR_PALETTE[idx];
    } else if(mode === "consignor"){
      headerFillHex = pickTypeColorHex(r);
    }

    const topLine = `Contract # ${contract} - ${consignor}`;
    const row1H = drawLotHeaderRow({ textLeft: topLine, fillHex: headerFillHex });

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

    const labelH = 14;
    const { wrapped, maxLines } = computeGridWrapped(r);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    page.drawRectangle({
      x: gridX,
      y: y - gridH,
      width: gridW,
      height: gridH,
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

    const notesLines = computeNotesLines(r);
    const notesH = 8 + (notesLines.length * CONFIG.PDF.notesLineH) + 2;

    page.drawRectangle({
      x: M,
      y: y - notesH,
      width: contentW,
      height: notesH,
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

    if(mode === "buyer"){
      const dmRowH = 18;
      const dm = downMoneyDisplay(r[CONFIG.COLS.downMoney]);

      page.drawRectangle({
        x: M,
        y: y - dmRowH,
        width: contentW,
        height: dmRowH,
        color: FILL,
        borderWidth: CONFIG.PDF.borderW,
        borderColor: rgb(0.55,0.55,0.55)
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

    // NEW: Contract Details extra separation + checkbox area + spacing before notes
    if(mode === "buyer" && singleLotMode){
      y -= 10;                 // good gap between lot details and the marking area
      drawDownMoneyReceivedBlock();
      drawCmsInternalNotesIfAny(r);
    }

    y -= CONFIG.PDF.lotGap;
  }

  const sorted = [...rows].sort(sortLots);
  for(const r of sorted){
    ensureRoom(r);
    drawLotBlock(r);
  }

  // Buyer footer (skip in single-lot mode)
  if(mode === "buyer" && !singleLotMode){
    const footerNeed = CONFIG.PDF.footerMinH + 36;
    if(y < bottomLimit + footerNeed){
      newPage();
    }

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

/* ---------------- PDF GENERATION: BUYER/SELLER CONTRACTS (ONE LOT) ---------------- */
async function buildSalesContractPdf({row, side}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const contentW = W - 2*M;

  const topBarColor = rgb(...hexToRgb01(CONFIG.COLORS.cmsBlue));
  const BLACK = rgb(0,0,0);
  const GRAY = rgb(0.55, 0.55, 0.55);

  const page = pdfDoc.addPage([W,H]);

  page.drawRectangle({ x:0, y:H-CONFIG.PDF.topBarH, width:W, height:CONFIG.PDF.topBarH, color: topBarColor });

  const contract = safeStr(getContract(row));
  const buyer = safeStr(row[CONFIG.COLS.buyer]);
  const consignor = safeStr(row[CONFIG.COLS.consignor]);
  const rep = safeStr(row[CONFIG.COLS.rep]);
  const downMoney = downMoneyDisplay(row[CONFIG.COLS.downMoney]);

  const headerY = H - CONFIG.PDF.topBarH - 34;

  page.drawText("Cattle Sales Contract", {
    x: M,
    y: headerY,
    size: 18,
    font: fontBold,
    color: BLACK
  });

  const cnText = `Contract #: ${contract || ""}`.trim();
  const cnSize = 18;
  const cnW = fontBold.widthOfTextAtSize(cnText, cnSize);
  page.drawText(cnText, {
    x: M + contentW - cnW,
    y: headerY,
    size: cnSize,
    font: fontBold,
    color: BLACK
  });

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  const subY = headerY - 18;
  page.drawText(`${auctionTitle}${aDate ? " — " + aDate : ""}`, {
    x: M,
    y: subY,
    size: 9.8,
    font,
    color: BLACK
  });

  // NEW: stronger header break (more spacing before preamble)
  let y = subY - 38;

  if(side === "buyer"){
    const pre = `CMS Livestock Auction does hereby agree to sell and '${buyer}' does hereby agree to the purchase of the following livestock:`;
    const lines = wrapLines(font, pre, 10.4, contentW - 10);
    for(const ln of lines){
      page.drawText(ln, { x:M, y, size:10.4, font, color:BLACK });
      y -= 12;
    }
    y -= 10;

    page.drawText(`Buyer: ${buyer}`, { x:M, y, size:12.2, font:fontBold, color:BLACK });
    y -= 14;

    if(rep){
      page.drawText(rep, { x:M, y, size:10.6, font, color:BLACK });
      y -= 14;
    }

  } else {
    const pre = `CMS Livestock Auction does hereby confirm the following cattle were sold on CMS Livestock Auction:`;
    const lines = wrapLines(font, pre, 10.4, contentW - 10);
    for(const ln of lines){
      page.drawText(ln, { x:M, y, size:10.4, font, color:BLACK });
      y -= 12;
    }
    y -= 10;
  }

  const breed = safeStr(row[CONFIG.COLS.breed]) || safeStr(row[CONFIG.COLS.description]);
  const loads = safeStr(row[CONFIG.COLS.loads]) || "0";
  const head  = safeStr(row[CONFIG.COLS.head])  || "0";
  const sex   = safeStr(row[CONFIG.COLS.sex]);
  const bw    = safeStr(row[CONFIG.COLS.baseWeight]);
  const del   = safeStr(row[CONFIG.COLS.delivery]);
  const loc   = safeStr(row[CONFIG.COLS.location]);
  const shr   = safeStr(row[CONFIG.COLS.shrink]);
  const sld   = safeStr(row[CONFIG.COLS.slide]);
  const price = priceDisplay(row[CONFIG.COLS.price]);

  const colDefs = [
    { label:"Loads",   value:loads, w: 45 },
    { label:"Head",    value:head,  w: 45 },
    { label:"Sex",     value:sex,   w: 100 },
    { label:"Base Wt", value:bw,    w: 38 },
    { label:"Delivery",value:del,   w: 170 },
    { label:"Location",value:loc,   w: 110 },
    { label:"Shrink",  value:shr,   w: 48 },
    { label:"Slide",   value:sld,   w: 134 },
    { label:"Price",   value:price, w: 50 },
  ];
  const gridW = colDefs.reduce((s,c)=>s+c.w,0);

  const bandH = 32;
  page.drawRectangle({
    x: M,
    y: y - bandH,
    width: contentW,
    height: bandH,
    color: rgb(1,1,1),
    borderWidth: 1.0,
    borderColor: GRAY
  });

  const bandText = `Seller: ${consignor}`;
  page.drawText(bandText, { x:M+8, y:y-14, size:10.6, font:fontBold, color:BLACK });
  page.drawText(safeStr(breed), { x:M+8, y:y-27, size:9.4, font, color:BLACK });

  y -= bandH;

  const labelH = 14;

  const maxCellW = (w)=> w - 2*CONFIG.PDF.cellPadX;
  const wrapped = colDefs.map(c => wrapLines(font, c.value, 8.6, maxCellW(c.w)));
  const maxLines = Math.max(...wrapped.map(a=>a.length), 1);
  const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
  const gridH = labelH + valueH;

  page.drawRectangle({
    x: M,
    y: y - gridH,
    width: gridW,
    height: gridH,
    color: rgb(1,1,1),
    borderWidth: 1.0,
    borderColor: GRAY
  });

  page.drawLine({ start:{x:M, y:y-labelH}, end:{x:M+gridW, y:y-labelH}, thickness:0.8, color:GRAY });

  let cx = M;
  for(let i=0;i<colDefs.length;i++){
    const c = colDefs[i];
    if(i !== 0){
      page.drawLine({ start:{x:cx, y:y}, end:{x:cx, y:y-gridH}, thickness:0.8, color:GRAY });
    }

    const cellCenter = cx + c.w/2;
    const lw = fontBold.widthOfTextAtSize(c.label, 7.7);
    page.drawText(c.label, { x:cellCenter - lw/2, y:y-11, size:7.7, font:fontBold, color:BLACK });

    let ty = y - labelH - 11;
    for(const ln of wrapped[i]){
      const tw = font.widthOfTextAtSize(ln || "", 8.6);
      page.drawText(ln, { x:cellCenter - tw/2, y:ty, size:8.6, font, color:BLACK });
      ty -= CONFIG.PDF.gridLineH;
    }

    cx += c.w;
  }

  y -= gridH;

  const desc = safeStr(row[CONFIG.COLS.description]);
  const desc2 = safeStr(row[CONFIG.COLS.secondDescription]);
  const notesText = [desc, desc2].filter(Boolean).join("  |  ");
  const notesLine = safeStr(`Notes: ${notesText}`);
  const notesLines = wrapLines(font, notesLine, 7.8, contentW - 16);

  const notesH = 8 + (notesLines.length * CONFIG.PDF.notesLineH) + 2;
  page.drawRectangle({
    x: M,
    y: y - notesH,
    width: contentW,
    height: notesH,
    color: rgb(1,1,1),
    borderWidth: 1.0,
    borderColor: GRAY
  });

  let ny = y - 12;
  for(const ln of notesLines){
    page.drawText(ln, { x:M+8, y:ny, size:7.8, font, color:BLACK });
    ny -= CONFIG.PDF.notesLineH;
  }
  y -= notesH;

  if(side === "buyer"){
    const dmH = 18;
    page.drawRectangle({
      x: M,
      y: y - dmH,
      width: contentW,
      height: dmH,
      color: rgb(0.98,0.98,0.98),
      borderWidth: 1.0,
      borderColor: GRAY
    });
    page.drawText(`Down Money Due: ${downMoney}`, { x:M+8, y:y-13, size:10.0, font:fontBold, color:BLACK });
    y -= dmH;
  }

  // NEW: significantly more spacing between lot details and terms
  y -= 28;

  // Terms width: seller gets larger right margin (narrower measure)
  const termsX = M + 8;
  const termsW = (side === "seller") ? (contentW - 70) : (contentW - 20);
  const rawTerms = (side === "buyer") ? CONFIG.CONTRACT_TERMS.buyer : CONFIG.CONTRACT_TERMS.seller;
  const termsText = rawTerms.replace(/\{\{\s*Down Money Due\s*\}\}/g, downMoney);

  // Render paragraph-by-paragraph so we can bold specific clause
  const boldClauseStartsWith = "Buyer does hereby agree to a down payment of $30.00";
  const paras = termsText.split("\n").map(s => safeStr(s)).filter(p => p.length > 0);

  for(const p of paras){
    const useBold = (side === "buyer") && p.startsWith(boldClauseStartsWith);
    const f = useBold ? fontBold : font;
    const lines = wrapLines(f, p, 9.2, termsW);

    for(const ln of lines){
      if(y < 110) break;
      page.drawText(ln, { x: termsX, y, size: 9.2, font: f, color: BLACK });
      y -= 11;
    }
    y -= 3;
    if(y < 110) break;
  }

  // Signature lines closer to bottom
  const sigLineY = 54; // fixed near-bottom
  const lineW = (contentW - 30) / 2;
  const leftX = M;
  const rightX = M + lineW + 30;

  page.drawLine({ start:{x:leftX, y:sigLineY}, end:{x:leftX+lineW, y:sigLineY}, thickness:1.0, color:BLACK });
  page.drawLine({ start:{x:rightX, y:sigLineY}, end:{x:rightX+lineW, y:sigLineY}, thickness:1.0, color:BLACK });

  const leftLabel = (side === "buyer") ? "Buyer Signature / Date" : "Seller Signature / Date";
  const rightLabel = "CMS Orita Calf Auctions, LLC Signature / Date";

  page.drawText(leftLabel, { x:leftX, y:sigLineY-14, size:9.6, font, color:BLACK });
  page.drawText(rightLabel, { x:rightX, y:sigLineY-14, size:9.6, font, color:BLACK });

  return await pdfDoc.save();
}

/* ---------------- DOWNLOAD / ZIP ---------------- */
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

/* ---------------- RESULTS RENDER ---------------- */
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
    meta.textContent = `${it.count || 1} item(s)`;

    left.appendChild(name);
    left.appendChild(meta);

    const btn = document.createElement("button");
    btn.className = "btn btnSmall";
    btn.textContent = "Download";
    btn.addEventListener("click", ()=> {
      downloadBytes(it.bytes, it.filename, "application/pdf");
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
    generated.buyerContracts.length +
    generated.sellerContracts.length +
    generated.consignorReports.length +
    generated.repReports.length;

  resultsMeta.textContent = `Generated ${total} file(s) from ${csvRows.length} row(s).`;

  renderList(listBuyerReports, generated.buyerReports);
  renderList(listLotByLot, generated.lotByLot);
  renderList(listBuyerContracts, generated.buyerContracts);
  renderList(listSellerContracts, generated.sellerContracts);
  renderList(listConsignorReports, generated.consignorReports);
  renderList(listRepReports, generated.repReports);

  zipBuyerReports.disabled = generated.buyerReports.length === 0;
  zipLotByLot.disabled = generated.lotByLot.length === 0;
  zipBuyerContracts.disabled = generated.buyerContracts.length === 0;
  zipSellerContracts.disabled = generated.sellerContracts.length === 0;
  zipConsignorReports.disabled = generated.consignorReports.length === 0;
  zipRepReports.disabled = generated.repReports.length === 0;
  zipAll.disabled = total === 0;
}

/* ---------------- BUILD ---------------- */
function wireBuild(){
  buildBtn.addEventListener("click", async ()=>{
    setError(builderError, "");
    buildBtn.disabled = true;
    buildBtn.textContent = "Generating…";

    try{
      assertLibsLoaded();

      if(csvRows.length === 0) throw new Error("Upload a CSV first.");

      const anyChecked =
        chkBuyer.checked ||
        chkConsignor.checked ||
        chkRep.checked ||
        chkLotByLot.checked ||
        chkBuyerContracts.checked ||
        chkSellerContracts.checked;

      if(!anyChecked) throw new Error("Select at least one output option.");

      const chk = requiredColsPresent(csvRows);
      if(!chk.ok) throw new Error(`CSV missing required column(s): ${chk.missing.join(", ")}`);

      if(!contractColName) throw new Error("Contract column not detected. Re-upload CSV.");

      generated = {
        buyerReports: [],
        lotByLot: [],
        buyerContracts: [],
        sellerContracts: [],
        consignorReports: [],
        repReports: [],
      };

      const byBuyer = groupBy(csvRows, CONFIG.COLS.buyer);
      const byConsignor = groupBy(csvRows, CONFIG.COLS.consignor);
      const repRows = csvRows.filter(r => safeStr(r[CONFIG.COLS.rep]) !== "");
      const byRep = groupBy(repRows, CONFIG.COLS.rep);

      // Buyer reports (one PDF per buyer)
      if(chkBuyer.checked){
        for(const [buyer, rows] of byBuyer.entries()){
          if(!buyer) continue;
          const bytes = await buildPdfForGroup({
            entityName: buyer,
            rows,
            mode: "buyer",
            singleLotMode: false,
            forceBuyerName: buyer
          });
          generated.buyerReports.push({
            filename: `${fileSafeName(buyer)}-Contract.pdf`,
            bytes,
            count: rows.length
          });
        }
      }

      // Contract Details (lot-by-lot) — adds big contract # top-right and down-money received block
      if(chkLotByLot.checked){
        const sorted = [...csvRows].sort(sortLots);
        for(const row of sorted){
          const contract = safeStr(getContract(row)) || "Contract";
          const buyer = safeStr(row[CONFIG.COLS.buyer]) || "Buyer";
          const bytes = await buildPdfForGroup({
            entityName: buyer,
            rows: [row],
            mode: "buyer",
            singleLotMode: true,
            forceBuyerName: buyer,
            headerRightBig: `Contract # ${contract}`
          });
          generated.lotByLot.push({
            filename: `Contract-Details-${fileSafeName(contract)}.pdf`,
            bytes,
            count: 1
          });
        }
      }

      // Buyer Contracts (one per lot) — filename: ContractNumber-Buyer.pdf
      if(chkBuyerContracts.checked){
        const sorted = [...csvRows].sort(sortLots);
        for(const row of sorted){
          const contract = safeStr(getContract(row)) || "Contract";
          const buyer = safeStr(row[CONFIG.COLS.buyer]) || "Buyer";
          const bytes = await buildSalesContractPdf({ row, side: "buyer" });

          generated.buyerContracts.push({
            filename: `${fileSafeName(contract)}-${fileSafeName(buyer)}.pdf`,
            bytes,
            count: 1
          });
        }
      }

      // Seller Contracts (one per lot) — filename: Seller-ContractNumber.pdf (Seller=Consignor)
      if(chkSellerContracts.checked){
        const sorted = [...csvRows].sort(sortLots);
        for(const row of sorted){
          const contract = safeStr(getContract(row)) || "Contract";
          const seller = safeStr(row[CONFIG.COLS.consignor]) || "Seller";
          const bytes = await buildSalesContractPdf({ row, side: "seller" });

          generated.sellerContracts.push({
            filename: `${fileSafeName(seller)}-${fileSafeName(contract)}.pdf`,
            bytes,
            count: 1
          });
        }
      }

      // Consignor reports (one PDF per consignor) — NEW filename: Trade Confirmations-Consignor
      if(chkConsignor.checked){
        for(const [consignor, rows] of byConsignor.entries()){
          if(!consignor) continue;
          const bytes = await buildPdfForGroup({
            entityName: consignor,
            rows,
            mode: "consignor"
          });
          generated.consignorReports.push({
            filename: `Trade Confirmations-${fileSafeName(consignor)}.pdf`,
            bytes,
            count: rows.length
          });
        }
      }

      // Rep reports
      if(chkRep.checked){
        for(const [rep, rows] of byRep.entries()){
          if(!rep) continue;
          const bytes = await buildPdfForGroup({
            entityName: rep,
            rows,
            mode: "rep"
          });
          generated.repReports.push({
            filename: `Rep-${fileSafeName(rep)}-Contract.pdf`,
            bytes,
            count: rows.length
          });
        }
      }

      renderResults();
      goto(pageResults);

    } catch(err){
      console.error(err);
      setError(builderError, `Generation error: ${err.message || err}`);
    } finally {
      buildBtn.disabled = false;
      buildBtn.textContent = "Generate PDFs";
      setBuildEnabled();
    }
  });

  zipBuyerReports.addEventListener("click", async ()=>{
    if(generated.buyerReports.length) await downloadZip(generated.buyerReports, "Buyer-Reports.zip");
  });

  zipLotByLot.addEventListener("click", async ()=>{
    if(generated.lotByLot.length) await downloadZip(generated.lotByLot, "Contract-Details.zip");
  });

  zipBuyerContracts.addEventListener("click", async ()=>{
    if(generated.buyerContracts.length) await downloadZip(generated.buyerContracts, "Buyer-Contracts.zip");
  });

  zipSellerContracts.addEventListener("click", async ()=>{
    if(generated.sellerContracts.length) await downloadZip(generated.sellerContracts, "Seller-Contracts.zip");
  });

  zipConsignorReports.addEventListener("click", async ()=>{
    if(generated.consignorReports.length) await downloadZip(generated.consignorReports, "Consignor-Reports.zip");
  });

  zipRepReports.addEventListener("click", async ()=>{
    if(generated.repReports.length) await downloadZip(generated.repReports, "Rep-Reports.zip");
  });

  zipAll.addEventListener("click", async ()=>{
    const all = [
      ...generated.buyerReports,
      ...generated.lotByLot,
      ...generated.buyerContracts,
      ...generated.sellerContracts,
      ...generated.consignorReports,
      ...generated.repReports
    ];
    if(all.length) await downloadZip(all, "CMS-PostAuction-All.zip");
  });
}

/* ---------------- EXIT / WIPE ---------------- */
function wireExit(){
  function wipeAll(){
    for(const u of blobUrls){
      try{ URL.revokeObjectURL(u); }catch{}
    }
    blobUrls = [];

    csvRows = [];
    contractColName = null;

    fileInput.value = "";
    fileMeta.textContent = "";
    hide(fileMeta);

    auctionName.value = "";
    auctionDate.value = "";
    auctionLabel.value = "";

    listBuyerReports.innerHTML = "";
    listLotByLot.innerHTML = "";
    listBuyerContracts.innerHTML = "";
    listSellerContracts.innerHTML = "";
    listConsignorReports.innerHTML = "";
    listRepReports.innerHTML = "";

    zipBuyerReports.disabled = true;
    zipLotByLot.disabled = true;
    zipBuyerContracts.disabled = true;
    zipSellerContracts.disabled = true;
    zipConsignorReports.disabled = true;
    zipRepReports.disabled = true;
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

  backBtn.addEventListener("click", ()=>{
    goto(pageBuilder);
  });
}

/* ---------------- INIT ---------------- */
function init(){
  try{
    bindDom();
  }catch(e){
    console.error(e);
    alert(e.message);
    return;
  }

  wireAuth();

  wireDropZone({
    zoneEl: dropZone,
    inputEl: fileInput,
    onFile: handleCsvFile,
    metaEl: fileMeta
  });

  [chkBuyer, chkConsignor, chkRep, chkLotByLot, chkBuyerContracts, chkSellerContracts]
    .forEach(el => el.addEventListener("change", setBuildEnabled));

  wireBuild();
  wireExit();

  goto(pageAuth);
  setBuildEnabled();
}

document.addEventListener("DOMContentLoaded", init);
