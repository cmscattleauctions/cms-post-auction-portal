/* ==========================================================
   CMS Post-Auction Portal (client-only) — app.js
   ========================================================== */

console.log("CMS Post-Auction app.js loaded ✅");

const CONFIG = {
  PIN: "0623",

  COLS: {
    buyer: "Buyer",
    consignor: "Consignor",
    rep: "Representative",

    breed: "Breed",
    type: "Type",
    year: "Year",

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

    cmsInternalNotes: "CMS Internal Notes",
  },

  CONTRACT_COL_CANDIDATES: [
    "Contract #",
    "Contract",
    "Contract Number",
    "Contract No",
    "Contract No."
  ],

  HEADER_RIGHT_TITLE: "CMS Livestock Auction",
  HEADER_ADDRESS_LINES: [
    "6900 I-40 West, Suite 135",
    "Amarillo, TX 79106",
    "(806) 355-7505"
  ],

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
    pageSize: { width: 792, height: 612 },
    margin: 26,
    bottomLimit: 9,
    topBarH: 8,

    headerHFirst: 98,
    headerHOther: 62,

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
    cmsBlue: "#336699",
    consignorColor: "#818589",
    repBar: "#6F8FAF",
    textWhite: [1,1,1],
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
let chkConsignorListing, chkRepListing;
let buildBtn, builderError;

let listConsignorReports, listRepReports;

let zipConsignorReports, zipRepReports, zipAll;
let togConsignorReports, togRepReports;

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

  chkConsignorListing = mustGet("chkConsignorListing");
  chkRepListing = mustGet("chkRepListing");

  buildBtn = mustGet("buildBtn");
  builderError = mustGet("builderError");

  listConsignorReports = mustGet("listConsignorReports");
  listRepReports = mustGet("listRepReports");

  zipConsignorReports = mustGet("zipConsignorReports");
  zipRepReports = mustGet("zipRepReports");
  zipAll = mustGet("zipAll");

  togConsignorReports = mustGet("togConsignorReports");
  togRepReports = mustGet("togRepReports");

  backBtn = mustGet("backBtn");
  exitBtn = mustGet("exitBtn");
  resultsMeta = mustGet("resultsMeta");
}

/* ---------------- STATE ---------------- */
let csvRows = [];
let contractColName = null;

let blobUrls = [];
let generated = {
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

/* ---------------- GROUP REPORTS ---------------- */
async function buildPdfForGroup({entityName, rows, mode, singleLotMode=false, forceBuyerName=null, headerRightBig=null}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const BLACK = rgb(0,0,0);
  const FILL = rgb(0.98,0.98,0.98);

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const bottomLimit = CONFIG.PDF.bottomLimit;
  const contentW = W - 2*M;

  const colDefs = [
    { key: "loads",   label: "Loads",   w: 45 },
    { key: "head",    label: "Head",    w: 45 },
    { key: "sex",     label: "Sex",     w: 100 },
    { key: "bw",      label: "Base Wt", w: 38 },
    { key: "del",     label: "Delivery",w: 170 },
    { key: "loc",     label: "Location",w: 110 },
    { key: "shr",     label: "Shrink",  w: 48 },
    { key: "sld",     label: "Slide",   w: 134 },
    { key: "price",   label: "Price",   w: 50 },
  ];

  const gridW = colDefs.reduce((s,c)=>s+c.w,0);

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  const docTitle = mode === "buyer" ? "Buyer Recap and Down Money Invoice" : "Trade Confirmations";

  const leftLabel =
    mode === "buyer" ? "Buyer" : (mode === "consignor" ? "Consignor" : "Rep");

  const docSize = (mode === "buyer") ? CONFIG.PDF.buyerNameSize : CONFIG.PDF.otherNameSize;

  let page = pdfDoc.addPage([W,H]);
  let pageIndex = 0;
  let y = H - M;

  function drawTopBar(){
    page.drawRectangle({ x: 0, y: H - CONFIG.PDF.topBarH, width: W, height: CONFIG.PDF.topBarH, color: FILL });
  }

  function drawRightHeaderBlockAligned(rx, topY){
    const title = CONFIG.HEADER_RIGHT_TITLE;
    const titleSize = 12.6;
    const addrSize = 9.2;
    const lh = 11;

    const tw = fontBold.widthOfTextAtSize(title, titleSize);
    page.drawText(title, { x: rx - tw, y: topY, size: titleSize, font: fontBold, color: BLACK });

    let yy = topY - (lh + 2);
    for(const ln of CONFIG.HEADER_ADDRESS_LINES){
      const w = font.widthOfTextAtSize(ln, addrSize);
      page.drawText(ln, { x: rx - w, y: yy, size: addrSize, font, color: BLACK });
      yy -= lh;
    }
  }

  function drawHeader(){
    drawTopBar();

    const headerH = (pageIndex === 0) ? CONFIG.PDF.headerHFirst : CONFIG.PDF.headerHOther;
    const topY = (pageIndex === 0)
      ? (H - CONFIG.PDF.topBarH - 20)
      : (H - CONFIG.PDF.topBarH - 22);

    const lx = M;
    const rx = M + contentW;

    if(!singleLotMode){
      const leftName = forceBuyerName ? safeStr(forceBuyerName) : safeStr(entityName);
      page.drawText(`${leftLabel}: ${leftName}`, { x: lx, y: topY, size: docSize, font: fontBold, color: BLACK });
    }

    // Right block on every page for normal docs
    drawRightHeaderBlockAligned(rx, topY);

    if(pageIndex === 0){
      if(singleLotMode){
        // Contract Details header (left)
        page.drawText(docTitle, { x: lx, y: topY - 20, size: 12.2, font: fontBold, color: BLACK });
        page.drawText(safeStr(auctionTitle), { x: lx, y: topY - 38, size: 10.0, font, color: BLACK });
        if(aDate){
          page.drawText(safeStr(aDate), { x: lx, y: topY - 50, size: 10.0, font, color: BLACK });
        }

        // Contract Details top-right (only once)
        drawRightHeaderBlockAligned(rx, topY);
      } else {
        // Group headers
        page.drawText(safeStr(auctionTitle), { x: lx, y: topY - 18, size: 10.0, font, color: BLACK });
        if(aDate){
          page.drawText(safeStr(aDate), { x: lx, y: topY - 30, size: 10.0, font, color: BLACK });
        }
        page.drawText(docTitle, { x: lx, y: topY - 54, size: CONFIG.PDF.title, font: fontBold, color: BLACK });
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

  function drawLotBlock(r){
    const contract = safeStr(getContract(r));
    const consignor = safeStr(r[CONFIG.COLS.consignor]);
    const breed = safeStr(r[CONFIG.COLS.breed]) || safeStr(r[CONFIG.COLS.description]);

    if(mode === "buyer") buyerDownMoneyTotal += toNumber(r[CONFIG.COLS.downMoney]);

    if(mode === "buyer" && singleLotMode) drawSingleLotBuyerAndRepBlock(r);

    let headerFillHex = null;
    if(mode === "rep"){
      const idx = hashIndex(consignor, CONFIG.REP_CONSIGNOR_PALETTE.length);
      headerFillHex = CONFIG.REP_CONSIGNOR_PALETTE[idx];
    } else if(mode === "consignor"){
      headerFillHex = pickTypeColorHex(r);
    }

    const topLine = `Contract # ${contract} - ${consignor}`;
    const row1H = drawLotHeaderRow({ textLeft: topLine, fillHex: headerFillHex });

    const breedColor = headerFillHex ? rgb(...CONFIG.COLORS.textWhite) : BLACK;
    page.drawText(safeStr(breed), { x: M + CONFIG.PDF.padX, y: y - 27, size: CONFIG.PDF.lotBreed, font, color: breedColor });
    y -= row1H;

    const labelH = 14;

    const { wrapped, maxLines } = computeGridWrapped(r);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    page.drawRectangle({ x:M, y:y-gridH, width:gridW, height:gridH, color: rgb(1,1,1), borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });
    page.drawLine({ start:{x:M, y:y-labelH}, end:{x:M+gridW, y:y-labelH}, thickness: CONFIG.PDF.innerW, color: rgb(0.55,0.55,0.55) });

    let cx = M;
    for(let i=0;i<colDefs.length;i++){
      const c = colDefs[i];
      if(i !== 0){
        page.drawLine({ start:{x:cx, y:y}, end:{x:cx, y:y-gridH}, thickness:CONFIG.PDF.innerW, color: rgb(0.55,0.55,0.55) });
      }

      const cellCenter = cx + c.w/2;
      const lw = fontBold.widthOfTextAtSize(c.label, CONFIG.PDF.gridLabel);
      page.drawText(c.label, { x: cellCenter - lw/2, y: y - 11, size: CONFIG.PDF.gridLabel, font: fontBold, color: BLACK });

      const lines = wrapped[c.key] || [""];
      const startY = y - labelH - 11;
      drawCenteredLines(lines, cellCenter, startY, CONFIG.PDF.gridLineH, CONFIG.PDF.gridValue);

      cx += c.w;
    }

    y -= gridH;

    const notesLines = computeNotesLines(r);
    const notesH = 8 + (notesLines.length * CONFIG.PDF.notesLineH) + 2;
    page.drawRectangle({ x:M, y:y-notesH, width:contentW, height:notesH, color: rgb(1,1,1), borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });

    let ny = y - 12;
    for(const ln of notesLines){
      page.drawText(ln, { x:M + CONFIG.PDF.padX, y:ny, size: CONFIG.PDF.notes, font, color: BLACK });
      ny -= CONFIG.PDF.notesLineH;
    }
    y -= notesH;

    if(mode === "buyer"){
      const dmRowH = 18;
      const dm = downMoneyDisplay(r[CONFIG.COLS.downMoney]);
      page.drawRectangle({ x:M, y:y-dmRowH, width:contentW, height:dmRowH, color: rgb(1,1,1), borderWidth:CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });
      page.drawText(`Down Money Due: ${dm}`, { x:M + CONFIG.PDF.padX, y:y-13, size: 10.0, font:fontBold, color:BLACK });
      y -= dmRowH;
    }

    if(mode === "buyer" && singleLotMode){
      const dm = toNumber(r[CONFIG.COLS.downMoney]);
      if(dm > 0){ y -= 8; drawDownMoneyReceivedBlock(); }
      drawCmsInternalNotesIfAny(r);
    }

    y -= CONFIG.PDF.lotGap;
  }

  const sorted = [...rows].sort(sortLots);
  for(const r of sorted){
    ensureRoom(r);
    drawLotBlock(r);
  }

  return await pdfDoc.save();
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
    btn.addEventListener("click", ()=> downloadBytes(it.bytes, it.filename, "application/pdf"));

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

  renderList(listConsignorReports, generated.consignorReports);
  renderList(listRepReports, generated.repReports);

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
        chkConsignorListing.checked ||
        chkRepListing.checked;

      if(!anyChecked) throw new Error("Select at least one output option.");

      const chk = requiredColsPresent(csvRows);
      if(!chk.ok) throw new Error(`CSV missing required column(s): ${chk.missing.join(", ")}`);
      if(!contractColName) throw new Error("Contract column not detected. Re-upload CSV.");

      generated = { consignorReports:[], repReports:[] };

      const byConsignor = groupBy(csvRows, CONFIG.COLS.consignor);
      const repRows = csvRows.filter(r => safeStr(r[CONFIG.COLS.rep]) !== "");
      const byRep = groupBy(repRows, CONFIG.COLS.rep);

      if(chkConsignorListing.checked){
        for(const [consignor, rows] of byConsignor.entries()){
          if(!consignor) continue;
          const bytes = await buildPdfForGroup({ entityName: consignor, rows, mode:"consignor", preAuction:true });
          generated.consignorReports.push({ filename: `Consignor-Lot Listing Report-${fileSafeName(consignor)}.pdf`, bytes, count: rows.length });
        }
      }

      if(chkRepListing.checked){
        for(const [rep, rows] of byRep.entries()){
          if(!rep) continue;
          const bytes = await buildPdfForGroup({ entityName: rep, rows, mode:"rep", preAuction:true });
          generated.repReports.push({ filename: `Rep-${fileSafeName(rep)}-Lot Listing Report.pdf`, bytes, count: rows.length });
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

  zipConsignorReports.addEventListener("click", async ()=> generated.consignorReports.length && downloadZip(generated.consignorReports, "Consignor-Lot Listing Reports.zip"));
  zipRepReports.addEventListener("click", async ()=> generated.repReports.length && downloadZip(generated.repReports, "Rep-Lot Listing Reports.zip"));
  zipAll.addEventListener("click", async ()=>{
    const all = [
      ...generated.consignorReports,
      ...generated.repReports
    ];
    all.length && downloadZip(all, "Pre-Auction-All.zip");
  });
}

/* ---------------- EXIT / WIPE ---------------- */
function wireExit(){
  function wipeAll(){
    for(const u of blobUrls){ try{ URL.revokeObjectURL(u); }catch{} }
    blobUrls = [];

    csvRows = [];
    contractColName = null;

    fileInput.value = "";
    fileMeta.textContent = "";
    hide(fileMeta);

    auctionName.value = "";
    auctionDate.value = "";
    auctionLabel.value = "";

    listConsignorReports.innerHTML = "";
    listRepReports.innerHTML = "";

    zipConsignorReports.disabled = true;
    zipRepReports.disabled = true;
    zipAll.disabled = true;

    resultsMeta.textContent = "";
    setBuildEnabled();
    goto(pageAuth);
  }

  exitBtn.addEventListener("click", wipeAll);

  window.addEventListener("beforeunload", ()=>{
    for(const u of blobUrls){ try{ URL.revokeObjectURL(u); }catch{} }
  });

  backBtn.addEventListener("click", ()=> goto(pageBuilder));
}

/* ---------------- INIT ---------------- */
function init(){
  try{ bindDom(); }
  catch(e){ console.error(e); alert(e.message); return; }

  wireAuth();

  wireDropZone({ zoneEl: dropZone, inputEl: fileInput, onFile: handleCsvFile, metaEl: fileMeta });

  [chkConsignorListing, chkRepListing]
    .forEach(el => el.addEventListener("change", setBuildEnabled));

  wireBuild();
  wireExit();
  wireResultsDropdowns();

  goto(pageAuth);
  setBuildEnabled();
}

document.addEventListener("DOMContentLoaded", init);
