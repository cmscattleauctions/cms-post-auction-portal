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
Seller does hereby warrant that all cattle shall have clear title and be free of any and all encumbrances.  Buyer hereby agrees that payment in full for above purchased livestock shall be made in the form of a wire transfer or in the form of a check issued by Buyer’s bank and provided to CMS Livestock Auction within 2 business days following the auction unless other payment terms are agreed upon by the parties in writing. Buyer acknowledges that CMS Livestock Auction is acting as agent only in this transaction.
If any dispute arises between the parties, the parties agree to submit to binding arbitration in accordance with the rules of the American Arbitration Association.
Buyer acknowledges and agrees that CMS Livestock Auction may require down payment prior to delivery of cattle or by overnight carrier at Buyer’s expense. Payments if sent overnight shall be sent to:
CMS Livestock Auction
6900 I-40 West, Suite 135
Amarillo, TX 79106.
The CMS Livestock Auction Video Auction Terms of Service Agreement as stated in auction registration and participation are incorporated by reference into this contract.`,

    seller: `All cattle shall be in good physical condition and shall be free of any defects including to but not limited to lameness, crippled, bad eyes, and lump jaws.
Seller agrees to deliver the above-described cattle to Buyer as sold through CMS Livestock Auction on the agreed-upon delivery date. Seller further agrees that once the cattle are sold through CMS Livestock Auction, Seller shall not sell, transfer, or otherwise dispose of the cattle to any party other than the Buyer prior to the delivery date without written consent from CMS Livestock Auction.
Seller represents and warrants that all information provided regarding the cattle, including weight, breed, age, and health status, is accurate to the best of Seller’s knowledge.
Seller does hereby warrant that all cattle shall have clear title and be free of any and all encumbrances.
The CMS Livestock Auction Seller’s Terms of Service Agreement as signed prior to the auction are incorporated by reference into this contract.`
  },

  PDF: {
    pageSize: { width: 792, height: 612 }, // landscape letter (REPORTS)
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

  // CONTRACTS ONLY (PORTRAIT)
  CONTRACT_PDF: {
    pageSize: { width: 612, height: 792 }, // portrait letter
    margin: 26,
    topBarH: 8,
  },

  COLORS: {
    cmsBlue: "#336699",        // buyer top bar
    consignorColor: "#818589", // consignor top bar color
    repBar: "#6F8FAF",         // rep top bar
    textWhite: [1,1,1],
    textBlack: [0,0,0],
  },

  REP_CONSIGNOR_PALETTE: [
    "#2E6F7E",
    "#4C6793",
    "#5C6B7C",
    "#6C7A89",
    "#7C8C9C",
    "#526B8F",
    "#3B5A6B",
    "#2C4A5C",
  ]
};

/* ---------------- DOM ---------------- */
let pageAuth, pageBuilder, pageResults;
let pinInput, pinSubmit, authError;

let dropZone, fileInput, fileMeta, builderError;
let auctionName, auctionLabel, auctionDate;

let chkBuyer, chkConsignor, chkRep, chkLotByLot, chkBuyerContracts, chkSellerContracts;
let btnBuild, btnClear, statusBox;

let resultsMeta, zipAll, btnBack;
let listBuyerReports, listLotByLot, listBuyerContracts, listSellerContracts, listConsignorReports, listRepReports;
let zipBuyerReports, zipLotByLot, zipBuyerContracts, zipSellerContracts, zipConsignorReports, zipRepReports;
let btnExit;

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
  return String(v).trim();
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

function hexToRgb01(hex){
  const h = safeStr(hex).replace("#","");
  const full = h.length === 3 ? h.split("").map(c=>c+c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return [r/255, g/255, b/255];
}

function assertLibsLoaded(){
  if(!window.PDFLib) throw new Error("pdf-lib not loaded.");
  if(!window.JSZip) throw new Error("JSZip not loaded.");
  if(!window.Papa) throw new Error("PapaParse not loaded.");
}

function mustGet(id){
  const el = document.getElementById(id);
  if(!el) throw new Error(`Missing DOM element: #${id}`);
  return el;
}

function priceDisplay(v){
  const s = safeStr(v);
  if(!s) return "";
  return s;
}

function downMoneyDisplay(v){
  const s = safeStr(v);
  if(!s) return "";
  return s;
}

function wrapLines(font, text, size, maxW){
  const words = safeStr(text).split(/\s+/).filter(Boolean);
  if(words.length === 0) return [""];
  const lines = [];
  let cur = words[0];
  for(let i=1;i<words.length;i++){
    const test = cur + " " + words[i];
    const w = font.widthOfTextAtSize(test, size);
    if(w <= maxW) cur = test;
    else { lines.push(cur); cur = words[i]; }
  }
  lines.push(cur);
  return lines;
}

/* ---------------- INIT ---------------- */
function bindDom(){
  pageAuth = mustGet("pageAuth");
  pageBuilder = mustGet("pageBuilder");
  pageResults = mustGet("pageResults");

  pinInput = mustGet("pinInput");
  pinSubmit = mustGet("pinSubmit");
  authError = mustGet("authError");

  dropZone = mustGet("dropZone");
  fileInput = mustGet("fileInput");
  fileMeta = mustGet("fileMeta");
  builderError = mustGet("builderError");

  auctionName = mustGet("auctionName");
  auctionLabel = mustGet("auctionLabel");
  auctionDate = mustGet("auctionDate");

  chkBuyer = mustGet("chkBuyer");
  chkConsignor = mustGet("chkConsignor");
  chkRep = mustGet("chkRep");
  chkLotByLot = mustGet("chkLotByLot");
  chkBuyerContracts = mustGet("chkBuyerContracts");
  chkSellerContracts = mustGet("chkSellerContracts");

  btnBuild = mustGet("btnBuild");
  btnClear = mustGet("btnClear");
  statusBox = mustGet("statusBox");

  resultsMeta = mustGet("resultsMeta");
  zipAll = mustGet("zipAll");
  btnBack = mustGet("btnBack");

  listBuyerReports = mustGet("listBuyerReports");
  listLotByLot = mustGet("listLotByLot");
  listBuyerContracts = mustGet("listBuyerContracts");
  listSellerContracts = mustGet("listSellerContracts");
  listConsignorReports = mustGet("listConsignorReports");
  listRepReports = mustGet("listRepReports");

  zipBuyerReports = mustGet("zipBuyerReports");
  zipLotByLot = mustGet("zipLotByLot");
  zipBuyerContracts = mustGet("zipBuyerContracts");
  zipSellerContracts = mustGet("zipSellerContracts");
  zipConsignorReports = mustGet("zipConsignorReports");
  zipRepReports = mustGet("zipRepReports");

  btnExit = mustGet("btnExit");
  btnBack = mustGet("btnBack");
}

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

function wireCollapsibles(){
  const headers = Array.from(document.querySelectorAll(".resultsHeader[data-collapse][data-target]"));

  // collapsed by default
  headers.forEach(h => {
    h.classList.remove("open");
    const targetId = h.getAttribute("data-target");
    const body = document.getElementById(targetId);
    if(body) body.classList.add("collapsed");
  });

  headers.forEach(h => {
    h.addEventListener("click", (e) => {
      // ZIP buttons should never toggle
      if(e.target && e.target.closest && e.target.closest("button")) return;

      const targetId = h.getAttribute("data-target");
      const body = document.getElementById(targetId);
      if(!body) return;

      const isCollapsed = body.classList.contains("collapsed");
      if(isCollapsed){
        body.classList.remove("collapsed");
        h.classList.add("open");
      } else {
        body.classList.add("collapsed");
        h.classList.remove("open");
      }
    });
  });
}

function wireDropZone({zoneEl, inputEl, onFile, metaEl}){
  zoneEl.addEventListener("dragover", (e)=>{
    e.preventDefault();
    zoneEl.classList.add("drag");
  });

  zoneEl.addEventListener("dragleave", ()=>{
    zoneEl.classList.remove("drag");
  });

  zoneEl.addEventListener("drop", (e)=>{
    e.preventDefault();
    zoneEl.classList.remove("drag");
    const f = e.dataTransfer.files?.[0];
    if(f) onFile(f);
  });

  inputEl.addEventListener("change", ()=>{
    const f = inputEl.files?.[0];
    if(f) onFile(f);
  });
}

function setBuildEnabled(){
  const any =
    chkBuyer.checked ||
    chkConsignor.checked ||
    chkRep.checked ||
    chkLotByLot.checked ||
    chkBuyerContracts.checked ||
    chkSellerContracts.checked;

  btnBuild.disabled = !(any && csvRows.length > 0);
}

function clearAll(){
  csvRows = [];
  contractColName = null;
  fileInput.value = "";
  fileMeta.textContent = "";
  statusBox.textContent = "Upload a CSV to begin.";
  setError(builderError, "");
  btnBuild.disabled = true;
  btnClear.disabled = true;
  zipAll.disabled = true;

  // clear lists
  [listBuyerReports, listLotByLot, listBuyerContracts, listSellerContracts, listConsignorReports, listRepReports].forEach(el=>{
    el.innerHTML = "";
  });

  generated = {
    buyerReports: [],
    lotByLot: [],
    buyerContracts: [],
    sellerContracts: [],
    consignorReports: [],
    repReports: [],
  };
}

function detectContractColumn(rows){
  if(!rows || rows.length === 0) return null;
  const cols = Object.keys(rows[0] || {});
  for(const cand of CONFIG.CONTRACT_COL_CANDIDATES){
    const found = cols.find(c => safeStr(c).toLowerCase() === cand.toLowerCase());
    if(found) return found;
  }
  return null;
}

function getContract(row){
  return safeStr(row[contractColName || ""] || "");
}

function byLotSort(a,b){
  const la = safeStr(a[CONFIG.COLS.lotSeq] || a[CONFIG.COLS.lotNumber] || "");
  const lb = safeStr(b[CONFIG.COLS.lotSeq] || b[CONFIG.COLS.lotNumber] || "");
  return la.localeCompare(lb, undefined, {numeric:true});
}

/* ---------------- FILE HANDLING ---------------- */
function handleCsvFile(file){
  try{
    assertLibsLoaded();
  }catch(e){
    setError(builderError, e.message);
    return;
  }

  setError(builderError, "");
  statusBox.textContent = "Reading CSV…";

  fileMeta.textContent = `${file.name} (${Math.round(file.size/1024)} KB)`;

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (res) => {
      if(res.errors?.length){
        console.error(res.errors);
        setError(builderError, "CSV parse error. Check file format.");
        statusBox.textContent = "CSV parse error.";
        return;
      }

      csvRows = (res.data || []).filter(r => Object.keys(r).length > 0);
      if(csvRows.length === 0){
        setError(builderError, "No rows found in CSV.");
        statusBox.textContent = "No rows found.";
        return;
      }

      contractColName = detectContractColumn(csvRows);
      if(!contractColName){
        setError(builderError, `CSV is missing a Contract column. Expected one of: ${CONFIG.CONTRACT_COL_CANDIDATES.join(", ")}`);
        statusBox.textContent = "Missing Contract column.";
        return;
      }

      statusBox.textContent = `Loaded ${csvRows.length} row(s). Ready to build.`;
      btnBuild.disabled = false;
      btnClear.disabled = false;
      setBuildEnabled();
    }
  });
}

/* ---------------- PDF BUILDERS (REPORTS) ---------------- */
/* NOTE: REPORT PDF CONTENT IS LEFT UNCHANGED.
   Only buyer report FILENAME string is changed later. */

async function buildPdfForGroup({entityName, rows, mode, singleLotMode, forceBuyerName}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const contentW = W - 2*M;

  const topBarColor =
    (mode === "buyer") ? rgb(...hexToRgb01(CONFIG.COLORS.cmsBlue)) :
    (mode === "rep") ? rgb(...hexToRgb01(CONFIG.COLORS.repBar)) :
    rgb(...hexToRgb01(CONFIG.COLORS.consignorColor));

  const BLACK = rgb(0,0,0);
  const WHITE = rgb(1,1,1);
  const GRAY = rgb(0.55, 0.55, 0.55);

  function addPage(){
    const p = pdfDoc.addPage([W,H]);
    p.drawRectangle({ x:0, y:H-CONFIG.PDF.topBarH, width:W, height:CONFIG.PDF.topBarH, color: topBarColor });
    return p;
  }

  let page = addPage();
  let y = H - CONFIG.PDF.topBarH - 30;

  const titleText =
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

  const aTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const aTitle = extra ? `${aTitleBase} — ${extra}` : aTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  page.drawText(aTitle, { x:M, y, size:CONFIG.PDF.title, font:fontBold, color:WHITE });
  if(aDate) page.drawText(aDate, { x:M, y:y-14, size:9.5, font, color:WHITE });

  const rightX = M + contentW - 210;
  let ay = y;
  for(const ln of addrLines){
    page.drawText(ln, { x:rightX, y:ay, size:8.8, font, color:WHITE });
    ay -= 11;
  }

  y -= CONFIG.PDF.headerHFirst;

  const headerName = safeStr(forceBuyerName || entityName || "");
  page.drawText(headerName, { x:M, y:y+20, size:nameSize, font:fontBold, color:BLACK });

  y -= 6;

  // Sort rows by lot
  const sorted = [...rows].sort(byLotSort);

  // (Everything below remains unchanged from your working code)
  // ... your full report rendering code continues ...

  // For brevity in this message: the remainder of the report builder section
  // stays identical to your working file. The changes you requested are NOT in that section.

  // IMPORTANT: This placeholder comment is NOT in your real file.
  // In the actual code you paste here, keep your existing report body exactly as-is.

  return await pdfDoc.save();
}

/* ---------------- CONTRACTS (PORTRAIT) ---------------- */
async function buildSalesContractPdf({row, side}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = CONFIG.CONTRACT_PDF.pageSize.width;
  const H = CONFIG.CONTRACT_PDF.pageSize.height;
  const M = CONFIG.CONTRACT_PDF.margin;
  const contentW = W - 2*M;

  const topBarColor = rgb(...hexToRgb01(side === "seller" ? CONFIG.COLORS.consignorColor : CONFIG.COLORS.cmsBlue));
  const BLACK = rgb(0,0,0);
  const GRAY = rgb(0.55, 0.55, 0.55);

  const page = pdfDoc.addPage([W,H]);

  page.drawRectangle({ x:0, y:H-CONFIG.CONTRACT_PDF.topBarH, width:W, height:CONFIG.CONTRACT_PDF.topBarH, color: topBarColor });

  const contract = safeStr(getContract(row));
  const buyer = safeStr(row[CONFIG.COLS.buyer]);
  const consignor = safeStr(row[CONFIG.COLS.consignor]);
  const rep = safeStr(row[CONFIG.COLS.rep]);
  const downMoney = downMoneyDisplay(row[CONFIG.COLS.downMoney]);

  const headerY = H - CONFIG.CONTRACT_PDF.topBarH - 34;

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

  // Auction Title (line 1)
  page.drawText(`${auctionTitle}`, {
    x: M,
    y: subY,
    size: 10.2,
    font,
    color: BLACK
  });

  // Auction date/time (line 2)
  const dateY = subY - 12;
  if(aDate){
    page.drawText(aDate, {
      x: M,
      y: dateY,
      size: 9.8,
      font,
      color: BLACK
    });
  }

  // Seller contracts: bold consignor under date/time
  let y = dateY - 16;
  if(side === "seller" && consignor){
    page.drawText(consignor, { x:M, y, size:11.2, font:fontBold, color:BLACK });
    y -= 16;
  }

  if(side === "buyer"){
    const pre = `CMS Livestock Auction does hereby agree to sell and '${buyer}' does hereby agree to the purchase of the following livestock:`;
    const lines = wrapLines(font, pre, 10.4, contentW);
    for(const ln of lines){
      page.drawText(ln, { x:M, y, size:10.4, font, color:BLACK });
      y -= 12;
    }
    y -= 6;

    page.drawText(`Buyer: ${buyer}`, { x:M, y, size:12.2, font:fontBold, color:BLACK });
    y -= 14;

    if(rep){
      page.drawText(rep, { x:M, y, size:10.6, font, color:BLACK });
      y -= 14;
    }

  } else {
    const pre = `CMS Livestock Auction does hereby agree to sell the following livestock for '${consignor}':`;
    const lines = wrapLines(font, pre, 10.4, contentW);
    for(const ln of lines){
      page.drawText(ln, { x:M, y, size:10.4, font, color:BLACK });
      y -= 12;
    }
    y -= 6;

    page.drawText(`Seller: ${consignor}`, { x:M, y, size:12.2, font:fontBold, color:BLACK });
    y -= 14;

    if(rep){
      page.drawText(rep, { x:M, y, size:10.6, font, color:BLACK });
      y -= 14;
    }
  }

  const lotNumber = safeStr(row[CONFIG.COLS.lotNumber] || row[CONFIG.COLS.lotSeq] || "");
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

  const bandText = `Lot #${lotNumber} - ${consignor}`;
  page.drawText(bandText, { x:M+8, y:y-14, size:10.6, font:fontBold, color:BLACK });
  page.drawText(safeStr(breed), { x:M+8, y:y-27, size:9.4, font, color:BLACK });

  y -= bandH;

  const row1Defs = [
    { label:"Loads",   value:loads, w: 70 },
    { label:"Head",    value:head,  w: 70 },
    { label:"Sex",     value:sex,   w: 220 },
    { label:"Base Wt", value:bw,    w: 0 }, // remainder
  ];

  const row2Defs = [
    { label:"Delivery",value:del,   w: 180 },
    { label:"Location",value:loc,   w: 160 },
    { label:"Shrink",  value:shr,   w: 70 },
    { label:"Slide",   value:sld,   w: 100 },
    { label:"Price",   value:price, w: 0 }, // remainder
  ];

  function fillRemainders(defs){
    const fixed = defs.reduce((s,c)=>s+(c.w||0),0);
    const rem = Math.max(0, contentW - fixed);
    for(let i=defs.length-1;i>=0;i--){
      if(!defs[i].w){ defs[i].w = rem; break; }
    }
    return defs;
  }

  function drawGridRow(defs, yTop){
    defs = fillRemainders(defs);

    const labelH = 14;
    const maxCellW = (w)=> w - 2*CONFIG.PDF.cellPadX;
    const wrapped = defs.map(c => wrapLines(font, c.value, 8.6, maxCellW(c.w)));
    const maxLines = Math.max(...wrapped.map(a=>a.length), 1);
    const valueH = maxLines * CONFIG.PDF.gridLineH + (2*CONFIG.PDF.cellPadY);
    const gridH = labelH + valueH;

    page.drawRectangle({
      x: M,
      y: yTop - gridH,
      width: contentW,
      height: gridH,
      color: rgb(1,1,1),
      borderWidth: 1.0,
      borderColor: GRAY
    });

    page.drawLine({ start:{x:M, y:yTop-labelH}, end:{x:M+contentW, y:yTop-labelH}, thickness:0.8, color:GRAY });

    let cx = M;
    for(let i=0;i<defs.length;i++){
      const c = defs[i];
      if(i !== 0){
        page.drawLine({ start:{x:cx, y:yTop}, end:{x:cx, y:yTop-gridH}, thickness:0.8, color:GRAY });
      }

      const cellCenter = cx + c.w/2;

      const lw = fontBold.widthOfTextAtSize(c.label, 7.7);
      page.drawText(c.label, { x:cellCenter - lw/2, y:yTop-11, size:7.7, font:fontBold, color:BLACK });

      let ty = yTop - labelH - 11;
      for(const ln of wrapped[i]){
        const tw = font.widthOfTextAtSize(ln || "", 8.6);
        page.drawText(ln, { x:cellCenter - tw/2, y:ty, size:8.6, font, color:BLACK });
        ty -= CONFIG.PDF.gridLineH;
      }

      cx += c.w;
    }

    return gridH;
  }

  const gridH1 = drawGridRow(row1Defs, y);
  y -= gridH1;

  const gridH2 = drawGridRow(row2Defs, y);
  y -= gridH2;

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
      color: rgb(1,1,1),
      borderWidth: 1.0,
      borderColor: GRAY
    });

    page.drawText(`Down Money Due: ${downMoney}`, { x:M+8, y:y-13, size:10.2, font:fontBold, color:BLACK });
    y -= dmH + 10;
  } else {
    y -= 10;
  }

  const terms = (side === "buyer") ? CONFIG.CONTRACT_TERMS.buyer : CONFIG.CONTRACT_TERMS.seller;
  const tLines = wrapLines(font, terms, 9.4, contentW);
  for(const ln of tLines){
    if(y < 90) break;
    page.drawText(ln, { x:M, y, size:9.4, font, color:BLACK });
    y -= 11;
  }

  y -= 10;

  // STACKED signatures (vertical)
  const sigYTop = Math.max(140, y);

  page.drawLine({ start:{x:M, y:sigYTop}, end:{x:M+contentW, y:sigYTop}, thickness:1.0, color:BLACK });
  const sig1Label = (side === "buyer") ? "Buyer Signature / Date" : "Seller Signature / Date";
  page.drawText(sig1Label, { x:M, y:sigYTop-14, size:9.6, font, color:BLACK });

  const sig2Y = sigYTop - 42;
  page.drawLine({ start:{x:M, y:sig2Y}, end:{x:M+contentW, y:sig2Y}, thickness:1.0, color:BLACK });
  page.drawText("CMS Orita Calf Auctions, LLC Signature / Date", { x:M, y:sig2Y-14, size:9.6, font, color:BLACK });

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
  }, 2000);
}

async function zipFiles(files, zipName){
  const zip = new JSZip();
  for(const f of files){
    zip.file(f.filename, f.bytes);
  }
  const blob = await zip.generateAsync({type:"blob"});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch{} }, 3000);
}

/* ---------------- RESULTS RENDER ---------------- */
function renderList(container, items){
  container.innerHTML = "";
  for(const it of items){
    const row = document.createElement("div");
    row.className = "listItem";

    const left = document.createElement("div");
    left.className = "listName";
    left.textContent = it.filename;

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
async function buildAll(){
  setError(builderError, "");
  statusBox.textContent = "Building PDFs…";

  generated = {
    buyerReports: [],
    lotByLot: [],
    buyerContracts: [],
    sellerContracts: [],
    consignorReports: [],
    repReports: [],
  };

  try{
    const rows = [...csvRows].sort(byLotSort);

    const byBuyer = groupBy(rows, CONFIG.COLS.buyer);
    const byConsignor = groupBy(rows, CONFIG.COLS.consignor);
    const repRows = rows.filter(r => safeStr(r[CONFIG.COLS.rep]) !== "");
    const byRep = groupBy(repRows, CONFIG.COLS.rep);

    // Buyer reports (one PDF per buyer) — ONLY FILENAME UPDATED
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
          filename: `${fileSafeName(buyer)} - Buyer Recap.pdf`,
          bytes,
          count: rows.length
        });
      }
    }

    // Contract Details (lot-by-lot)
    if(chkLotByLot.checked){
      for(const r of rows){
        const lot = safeStr(r[CONFIG.COLS.lotNumber] || r[CONFIG.COLS.lotSeq] || "");
        const bytes = await buildPdfForGroup({
          entityName: lot ? `Lot ${lot}` : "Lot",
          rows: [r],
          mode: "buyer",
          singleLotMode: true,
          forceBuyerName: lot ? `Lot ${lot}` : "Lot"
        });
        generated.lotByLot.push({
          filename: `${fileSafeName(lot ? `Lot ${lot}` : "Lot")}-Contract-Details.pdf`,
          bytes,
          count: 1
        });
      }
    }

    // Buyer Contracts (portrait)
    if(chkBuyerContracts.checked){
      for(const r of rows){
        const contract = safeStr(getContract(r));
        const buyer = safeStr(r[CONFIG.COLS.buyer]);
        const bytes = await buildSalesContractPdf({ row:r, side:"buyer" });
        generated.buyerContracts.push({
          filename: `${fileSafeName(contract)}-${fileSafeName(buyer)}.pdf`,
          bytes,
          count: 1
        });
      }
    }

    // Seller Contracts (portrait + seller top bar gray)
    if(chkSellerContracts.checked){
      for(const r of rows){
        const consignor = safeStr(r[CONFIG.COLS.consignor]);
        const contract = safeStr(getContract(r));
        const bytes = await buildSalesContractPdf({ row:r, side:"seller" });
        generated.sellerContracts.push({
          filename: `${fileSafeName(consignor)}-${fileSafeName(contract)}.pdf`,
          bytes,
          count: 1
        });
      }
    }

    // Consignor Reports
    if(chkConsignor.checked){
      for(const [consignor, rows] of byConsignor.entries()){
        if(!consignor) continue;
        const bytes = await buildPdfForGroup({
          entityName: consignor,
          rows,
          mode: "consignor",
          singleLotMode: false
        });
        generated.consignorReports.push({
          filename: `${fileSafeName(consignor)}-Trade-Confirmations.pdf`,
          bytes,
          count: rows.length
        });
      }
    }

    // Rep Reports
    if(chkRep.checked){
      for(const [rep, rows] of byRep.entries()){
        if(!rep) continue;
        const bytes = await buildPdfForGroup({
          entityName: rep,
          rows,
          mode: "rep",
          singleLotMode: false
        });
        generated.repReports.push({
          filename: `${fileSafeName(rep)}-Trade-Confirmations.pdf`,
          bytes,
          count: rows.length
        });
      }
    }

    statusBox.textContent = "Done. Review downloads below.";
    goto(pageResults);
    renderResults();

  } catch(e){
    console.error(e);
    setError(builderError, e.message || "Build failed.");
    statusBox.textContent = "Build failed.";
  }
}

/* ---------------- EVENTS ---------------- */
function init(){
  try{
    bindDom();
  }catch(e){
    console.error(e);
    alert(e.message);
    return;
  }

  wireAuth();
  wireCollapsibles();

  wireDropZone({
    zoneEl: dropZone,
    inputEl: fileInput,
    onFile: handleCsvFile,
    metaEl: fileMeta
  });

  [chkBuyer, chkConsignor, chkRep, chkLotByLot, chkBuyerContracts, chkSellerContracts]
    .forEach(el => el.addEventListener("change", setBuildEnabled));

  btnBuild.addEventListener("click", buildAll);
  btnClear.addEventListener("click", clearAll);

  btnBack.addEventListener("click", ()=> goto(pageBuilder));
  btnExit.addEventListener("click", ()=>{
    // revoke any blobs
    blobUrls.forEach(u => { try{ URL.revokeObjectURL(u); }catch{} });
    blobUrls = [];
    clearAll();
    goto(pageAuth);
  });

  zipBuyerReports.addEventListener("click", ()=> zipFiles(generated.buyerReports, "Buyer-Reports.zip"));
  zipLotByLot.addEventListener("click", ()=> zipFiles(generated.lotByLot, "Contract-Details-Lot-by-lot.zip"));
  zipBuyerContracts.addEventListener("click", ()=> zipFiles(generated.buyerContracts, "Buyer-Contracts.zip"));
  zipSellerContracts.addEventListener("click", ()=> zipFiles(generated.sellerContracts, "Seller-Contracts.zip"));
  zipConsignorReports.addEventListener("click", ()=> zipFiles(generated.consignorReports, "Consignor-Reports.zip"));
  zipRepReports.addEventListener("click", ()=> zipFiles(generated.repReports, "Rep-Reports.zip"));
  zipAll.addEventListener("click", ()=>{
    const all = [
      ...generated.buyerReports,
      ...generated.lotByLot,
      ...generated.buyerContracts,
      ...generated.sellerContracts,
      ...generated.consignorReports,
      ...generated.repReports
    ];
    zipFiles(all, "CMS-Post-Auction-All.zip");
  });

  goto(pageAuth);
}

document.addEventListener("DOMContentLoaded", init);
