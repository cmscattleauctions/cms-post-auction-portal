/* CMS Post-Auction Portal (client-only)
   - CSV parse: PapaParse
   - PDF gen: pdf-lib
   - ZIP: JSZip
*/

const CONFIG = {
  PIN: "0623",

  // CSV columns expected:
  COLS: {
    buyer: "Buyer",
    consignor: "Consignor",
    rep: "Representative",

    // Optional: if present, will be used under Lot#-Seller
    breed: "Breed",

    contract: "Contract #",
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
    // LANDSCAPE US Letter:
    pageSize: { width: 792, height: 612 }, // 11" x 8.5"
    margin: 30,

    headerHeight: 92,
    headerPad: 12,

    font: 10,
    small: 9,
    tiny: 8,
    title: 14,

    lineGap: 12,
    blockGap: 10,

    // Grid styling
    gridLine: 0.8,
    boxLine: 1.0,

    bottomGuard: 90
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

// ====== STATE (in-memory only) ======
let csvRows = [];
let generated = { buyers: [], consignors: [], reps: [] };
let blobUrls = [];
let logoBytesCache = null;

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
  return String(v).trim();
}

function toNumber(v){
  const s = safeStr(v);
  if(!s) return 0;
  const cleaned = s.replace(/\$/g,"").replace(/,/g,"").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function money2(n){
  const x = Number.isFinite(n) ? n : 0;
  return "$" + x.toFixed(2);
}

// PO only for PRICE column:
function priceDisplay(v){
  const n = toNumber(v);
  return (n === 0) ? "PO" : ("$" + n.toFixed(2));
}

// Down money: if 0 => $0.00 (NOT PO)
function downMoneyDisplay(v){
  const n = toNumber(v);
  return "$" + n.toFixed(2);
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

function requiredColsPresent(rows){
  // Note: Breed is optional; everything else here is required.
  const required = Object.values(CONFIG.COLS).filter(c => c !== CONFIG.COLS.breed);
  const row0 = rows[0] || {};
  const keys = new Set(Object.keys(row0));
  const missing = required.filter(c => !keys.has(c));
  return { ok: missing.length === 0, missing };
}

async function getLogoBytes(){
  if(logoBytesCache) return logoBytesCache;
  const res = await fetch("assets/logo.png", { cache: "no-store" });
  if(!res.ok) throw new Error("Could not load assets/logo.png for PDF logo embed.");
  const buf = await res.arrayBuffer();
  logoBytesCache = new Uint8Array(buf);
  return logoBytesCache;
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

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      csvRows = (results.data || []).filter(r => Object.values(r).some(v => safeStr(v) !== ""));
      if(csvRows.length === 0){
        setError(builderError, "CSV parsed, but it contains no rows.");
        return;
      }
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

fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  handleFile(file);
});

dropZone.addEventListener("dragover", (e)=>{
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", ()=>{
  dropZone.classList.remove("dragover");
});
dropZone.addEventListener("drop", (e)=>{
  e.preventDefault();
  dropZone.classList.remove("dragover");
  const file = e.dataTransfer.files?.[0];
  handleFile(file);
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

// ====== TEXT WRAP ======
function wrapText(font, text, size, maxWidth){
  const words = safeStr(text).split(/\s+/).filter(Boolean);
  if(words.length === 0) return [];
  const lines = [];
  let line = words[0];

  for(let i=1; i<words.length; i++){
    const test = line + " " + words[i];
    const w = font.widthOfTextAtSize(test, size);
    if(w <= maxWidth){
      line = test;
    }else{
      lines.push(line);
      line = words[i];
    }
  }
  lines.push(line);
  return lines;
}

function drawWrapped({page, font, color, x, y, text, size, maxWidth, lineHeight}){
  const lines = wrapText(font, text, size, maxWidth);
  for(const ln of lines){
    page.drawText(ln, { x, y, size, font, color });
    y -= lineHeight;
  }
  return y;
}

// ====== PDF GENERATION ======
async function buildPdfForGroup({entityName, rows, mode}){
  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Colors
  const BLACK = rgb(0,0,0);
  const WHITE = rgb(1,1,1);

  const headerFill =
    mode === "buyer" ? rgb(0.20, 0.39, 0.60) :      // blue
    mode === "consignor" ? rgb(0.82, 0.82, 0.82) : // grey
    rgb(0.15, 0.15, 0.15);                         // dark

  const headerText =
    mode === "consignor" ? BLACK : WHITE;

  const gridStroke = rgb(0.55, 0.55, 0.55); // subtle grey

  // Page geometry (LANDSCAPE)
  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const contentW = W - 2*M;

  // Header content
  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  const centerTitle =
    mode === "buyer" ? "Buyer Recap and Down Money Invoice" :
    mode === "consignor" ? "Trade Confirmations" :
    "Trade Confirmations";

  const leftLabel =
    mode === "buyer" ? "Buyer" :
    mode === "consignor" ? "Consignor" :
    "Rep";

  const addressLines = [
    "CMS Livestock Auction",
    "6900 I-40 West, Suite 135",
    "Amarillo, TX 79106",
    "(806) 355-7505"
  ];

  // Embed logo
  let logoImg = null;
  try{
    const logoBytes = await getLogoBytes();
    logoImg = await pdfDoc.embedPng(logoBytes);
  }catch{
    logoImg = null;
  }

  let page = pdfDoc.addPage([W, H]);
  let y = H - M;

  const drawHeader = () => {
    // Header bar
    const headerH = CONFIG.PDF.headerHeight;
    const headerY = H - M - headerH;

    page.drawRectangle({
      x: M,
      y: headerY,
      width: contentW,
      height: headerH,
      color: headerFill
    });

    // Layout inside header: LEFT = buyer/auction/date + centered title; RIGHT = address
    const pad = CONFIG.PDF.headerPad;

    // Bigger logo
    const logoW = 92; // bigger
    const logoH = (logoImg ? (logoImg.height / logoImg.width) * logoW : 0);

    const leftX = M + pad;
    const rightX = M + contentW - pad;

    // Left block text
    let lx = leftX;
    let ly = headerY + headerH - pad - 12;

    if(logoImg){
      page.drawImage(logoImg, {
        x: lx,
        y: headerY + (headerH - logoH)/2,
        width: logoW,
        height: logoH
      });
      lx += logoW + 12;
    }

    page.drawText(`${leftLabel}: ${entityName}`, {
      x: lx,
      y: ly,
      size: 12,
      font: fontBold,
      color: headerText
    });
    ly -= 14;

    // Auction title/date
    const maxLeftW = contentW * 0.55;
    ly = drawWrapped({
      page,
      font,
      color: headerText,
      x: lx,
      y: ly,
      text: auctionTitle,
      size: 10,
      maxWidth: maxLeftW,
      lineHeight: 12
    });

    if(aDate){
      page.drawText(aDate, {
        x: lx,
        y: ly,
        size: 10,
        font,
        color: headerText
      });
    }

    // Centered title
    const titleSize = CONFIG.PDF.title;
    const titleW = fontBold.widthOfTextAtSize(centerTitle, titleSize);
    const cx = M + (contentW - titleW)/2;
    const cy = headerY + 10;
    page.drawText(centerTitle, {
      x: cx,
      y: cy,
      size: titleSize,
      font: fontBold,
      color: headerText
    });

    // Right address block (on the right now)
    const addrW = contentW * 0.34;
    const addrX = rightX - addrW;
    let ay = headerY + headerH - pad - 12;

    // Address lines (first bold)
    page.drawText(addressLines[0], {
      x: addrX,
      y: ay,
      size: 11,
      font: fontBold,
      color: headerText
    });
    ay -= 13;
    for(let i=1; i<addressLines.length; i++){
      page.drawText(addressLines[i], {
        x: addrX,
        y: ay,
        size: 10,
        font,
        color: headerText
      });
      ay -= 12;
    }

    // body start
    y = headerY - 14;
  };

  const newPage = () => {
    page = pdfDoc.addPage([W, H]);
    drawHeader();
  };

  // Column grid positions (aligned like an Excel header)
  // These widths are tuned for landscape readability.
  const colDefs = [
    { key: "loads", label: "Loads", w: 60 },
    { key: "head", label: "Head", w: 60 },
    { key: "sex", label: "Sex", w: 55 },
    { key: "bw", label: "Base Wt", w: 80 },
    { key: "del", label: "Delivery", w: 120 },
    { key: "loc", label: "Location", w: 160 },
    { key: "shr", label: "Shrink", w: 65 },
    { key: "sld", label: "Slide", w: 65 },
    { key: "price", label: "Price", w: 85 },
  ];

  // Buyer only: show down money per lot and total
  if(mode === "buyer"){
    colDefs.push({ key: "dm", label: "Down $", w: 90 });
  }

  const gridX = M;
  const gridW = colDefs.reduce((s,c)=>s+c.w, 0);
  const gridMaxW = Math.min(gridW, contentW); // safety
  const labelRowH = 18;
  const valueRowH = 22;

  const drawGridRow = (topY, labels, values) => {
    // Draw outer box
    const totalH = labelRowH + valueRowH;
    page.drawRectangle({
      x: gridX,
      y: topY - totalH,
      width: gridMaxW,
      height: totalH,
      borderWidth: CONFIG.PDF.boxLine,
      borderColor: gridStroke
    });

    // Vertical lines + text
    let x = gridX;
    for(let i=0; i<colDefs.length; i++){
      const c = colDefs[i];
      const cellW = c.w;

      if(i !== 0){
        page.drawLine({
          start: { x, y: topY },
          end: { x, y: topY - totalH },
          thickness: CONFIG.PDF.gridLine,
          color: gridStroke
        });
      }

      // Label
      page.drawText(labels[i], {
        x: x + 6,
        y: topY - 13,
        size: 9,
        font: fontBold,
        color: BLACK
      });

      // Value (center-ish)
      const v = values[i];
      page.drawText(v, {
        x: x + 6,
        y: topY - 13 - labelRowH,
        size: 10,
        font,
        color: BLACK
      });

      x += cellW;
    }

    // Horizontal line between label/value
    page.drawLine({
      start: { x: gridX, y: topY - labelRowH },
      end: { x: gridX + gridMaxW, y: topY - labelRowH },
      thickness: CONFIG.PDF.gridLine,
      color: gridStroke
    });

    return topY - totalH;
  };

  drawHeader();

  const sorted = [...rows].sort(sortLots);

  let buyerDownMoneyTotal = 0;

  // Rep mode: group by consignor with clear dividers
  let repConsignorOrder = null;
  if(mode === "rep"){
    repConsignorOrder = sorted.map(r => safeStr(r[CONFIG.COLS.consignor]));
  }

  let currentConsignor = "";

  const drawConsignorDivider = (consignorName) => {
    // Shaded divider bar for rep PDFs
    const barH = 18;
    const barY = y - barH;

    page.drawRectangle({
      x: M,
      y: barY,
      width: contentW,
      height: barH,
      color: rgb(0.90, 0.90, 0.90),
      borderWidth: 0.8,
      borderColor: rgb(0.6,0.6,0.6)
    });

    page.drawText(`Consignor: ${consignorName}`, {
      x: M + 10,
      y: barY + 5,
      size: 11,
      font: fontBold,
      color: BLACK
    });

    y = barY - 10;
  };

  for(const r of sorted){
    if(y < M + CONFIG.PDF.bottomGuard){
      newPage();
      // If rep, repeat consignor divider at top of new page for clarity
      if(mode === "rep" && currentConsignor){
        drawConsignorDivider(currentConsignor);
      }
    }

    const lot = safeStr(r[CONFIG.COLS.lotNumber]);
    const seller = safeStr(r[CONFIG.COLS.consignor]);

    // REP: consignor breaks
    if(mode === "rep"){
      const c = seller;
      if(c && c !== currentConsignor){
        currentConsignor = c;
        // extra space before new consignor section
        if(y < M + 140) newPage();
        drawConsignorDivider(currentConsignor);
      }
    }

    // Breed line (preferred). If no Breed column exists or blank, fall back to Description.
    const breed = safeStr(r[CONFIG.COLS.breed]) || safeStr(r[CONFIG.COLS.description]);

    const desc = safeStr(r[CONFIG.COLS.description]);
    const desc2 = safeStr(r[CONFIG.COLS.secondDescription]);

    const loads = safeStr(r[CONFIG.COLS.loads]);
    const head = safeStr(r[CONFIG.COLS.head]);
    const sex = safeStr(r[CONFIG.COLS.sex]);
    const bw = safeStr(r[CONFIG.COLS.baseWeight]);
    const del = safeStr(r[CONFIG.COLS.delivery]);
    const loc = safeStr(r[CONFIG.COLS.location]);
    const shr = safeStr(r[CONFIG.COLS.shrink]);
    const sld = safeStr(r[CONFIG.COLS.slide]);
    const price = priceDisplay(r[CONFIG.COLS.price]);

    const dm = toNumber(r[CONFIG.COLS.downMoney]);
    if(mode === "buyer") buyerDownMoneyTotal += dm;

    // Lot block outer box (excel-like)
    const blockTop = y;
    const blockPad = 10;

    // Line 1: Lot # - Seller
    page.drawText(`${lot} - ${seller}`, {
      x: M + blockPad,
      y,
      size: 12,
      font: fontBold,
      color: BLACK
    });
    y -= 16;

    // Line 2: Breed (not description)
    y = drawWrapped({
      page,
      font,
      color: BLACK,
      x: M + blockPad,
      y,
      text: breed,
      size: 10,
      maxWidth: contentW - 2*blockPad,
      lineHeight: 12
    });

    y -= 6;

    // Grid labels + values aligned
    const labels = colDefs.map(c => c.label);
    const values = colDefs.map(c => {
      switch(c.key){
        case "loads": return loads || "0";
        case "head": return head || "0";
        case "sex": return sex || "";
        case "bw": return bw || "";
        case "del": return del || "";
        case "loc": return loc || "";
        case "shr": return shr || "";
        case "sld": return sld || "";
        case "price": return price;
        case "dm": return downMoneyDisplay(r[CONFIG.COLS.downMoney]);
        default: return "";
      }
    });

    const gridTopY = y;
    y = drawGridRow(gridTopY, labels, values) - 8;

    // Notes inline (no new line after Notes:)
    const notesText = [desc, desc2].filter(Boolean).join("  |  ");
    const notesLine = `Notes: ${notesText}`;
    y = drawWrapped({
      page,
      font,
      color: BLACK,
      x: M + blockPad,
      y,
      text: notesLine,
      size: 9.5,
      maxWidth: contentW - 2*blockPad,
      lineHeight: 12
    });

    // Buyer: per-lot down money bold line (still useful even though grid has Down $)
    if(mode === "buyer"){
      y -= 2;
      page.drawText(`Down Money Due: ${downMoneyDisplay(r[CONFIG.COLS.downMoney])}`, {
        x: M + blockPad,
        y,
        size: 11,
        font: fontBold,
        color: BLACK
      });
      y -= 14;
    } else {
      y -= 8;
    }

    // Draw block border (around everything for that lot)
    const blockBottom = y;
    const blockH = blockTop - blockBottom + 6;

    page.drawRectangle({
      x: M,
      y: blockBottom - 2,
      width: contentW,
      height: blockH,
      borderWidth: 1,
      borderColor: gridStroke
    });

    y -= CONFIG.PDF.blockGap;
  }

  // Buyer: totals + remittance footer
  if(mode === "buyer"){
    if(y < M + 130){
      newPage();
    }

    // Total box
    const boxW = 280;
    const boxH = 42;
    const boxX = M + contentW - boxW;
    const boxY = y - boxH;

    page.drawRectangle({
      x: boxX,
      y: boxY,
      width: boxW,
      height: boxH,
      borderWidth: 1,
      borderColor: gridStroke
    });

    page.drawText("Total Down Money Due:", {
      x: boxX + 10,
      y: boxY + 24,
      size: 11,
      font: fontBold,
      color: BLACK
    });

    page.drawText(money2(buyerDownMoneyTotal), {
      x: boxX + 10,
      y: boxY + 8,
      size: 13,
      font: fontBold,
      color: BLACK
    });

    y = boxY - 10;

    const footerText =
`REMIT TO CMS LIVESTOCK AUCTION VIA WIRE TRANSFER, ACH, OR OVERNIGHT DELIVERY OF A CHECK
PLEASE INCLUDE BUYER NAME AND LOT NUMBERS ON PAYMENT

Wire Instructions for CMS Livestock Auction:
Send Overnight Payments to:
CMS Livestock Auction
6900 I-40 West, Suite 135
Amarillo, TX 79106.

Wire funds to:
Happy State Bank
200 Main Street
Canadian, Tx 79014
Routing Number: 082902757
CMS Orita Calf Auction LLC-Wire Account
Account Number: 504831484

We appreciate your business. Please call our office if you have any questions regarding lots, delivery, or payment.`;

    y = drawWrapped({
      page,
      font,
      color: BLACK,
      x: M,
      y,
      text: footerText,
      size: 8.7,
      maxWidth: contentW,
      lineHeight: 11
    });
  }

  return await pdfDoc.save();
}

// ====== Build PDFs ======
buildBtn.addEventListener("click", async ()=>{
  setError(builderError, "");
  buildBtn.disabled = true;
  buildBtn.textContent = "Generating…";

  try{
    if(csvRows.length === 0){
      setError(builderError, "Upload a CSV first.");
      return;
    }
    if(!(chkBuyer.checked || chkConsignor.checked || chkRep.checked)){
      setError(builderError, "Select at least one report type.");
      return;
    }

    generated = { buyers:[], consignors:[], reps:[] };
    listBuyers.innerHTML = "";
    listConsignors.innerHTML = "";
    listReps.innerHTML = "";

    zipBuyers.disabled = true;
    zipConsignors.disabled = true;
    zipReps.disabled = true;
    zipAll.disabled = true;
    resultsMeta.textContent = "";

    // Buyers (one PDF per buyer)
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

    // Consignors (one PDF per consignor)
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

    // Reps (ignore blank reps)
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
  }catch(err){
    console.error(err);
    setError(builderError, "Something went wrong during PDF generation. Open DevTools Console for details.");
  }finally{
    buildBtn.disabled = false;
    buildBtn.textContent = "Generate PDFs";
    setBuildEnabled();
  }
});

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

// ====== ZIP DOWNLOADS ======
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

zipBuyers.addEventListener("click", ()=> downloadZip(generated.buyers, "Buyer-Reports.zip"));
zipConsignors.addEventListener("click", ()=> downloadZip(generated.consignors, "Consignor-Reports.zip"));
zipReps.addEventListener("click", ()=> downloadZip(generated.reps, "Representative-Reports.zip"));

zipAll.addEventListener("click", ()=>{
  const all = [...generated.buyers, ...generated.consignors, ...generated.reps];
  downloadZip(all, "All-Reports.zip");
});

backBtn.addEventListener("click", ()=> goto(pageBuilder));

// Start
goto(pageAuth);
setBuildEnabled();
