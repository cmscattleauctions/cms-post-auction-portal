/* CMS Post-Auction Portal (client-only)
   Robust version:
   - Shows the REAL error on-screen (no DevTools needed)
   - Validates libraries are loaded
   - Validates CSV columns and prints missing columns clearly
   - Landscape PDF, compact lots, header only on first page, thin top bar only
*/

const CONFIG = {
  PIN: "0623",

  COLS: {
    buyer: "Buyer",
    consignor: "Consignor",
    rep: "Representative",
    breed: "Breed", // optional; falls back to Description

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

    // thin top bar (only page 1)
    topBarH: 8,

    // header block (only page 1)
    headerBlockH: 68,

    // typography
    font: 9.3,
    small: 8.3,
    tiny: 7.6,
    title: 12.5,

    // table sizing
    lotGap: 8,
    cellPadX: 5,

    // limits to keep lots compact
    maxNotesLines: 2,

    // footer area
    footerH: 92,

    // fit rules
    minCellFont: 7.0
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
  // Breed is optional; everything else required.
  const required = Object.values(CONFIG.COLS).filter(c => c !== CONFIG.COLS.breed);
  const row0 = rows[0] || {};
  const keys = new Set(Object.keys(row0));
  const missing = required.filter(c => !keys.has(c));
  return { ok: missing.length === 0, missing };
}

// ====== TEXT HELPERS ======
function textWidth(font, text, size){
  return font.widthOfTextAtSize(text || "", size);
}
function fitTextOneLine({font, text, size, maxW, minSize}){
  let s = size;
  while(s >= minSize){
    if(textWidth(font, text, s) <= maxW) return { text, size: s };
    s -= 0.3;
  }
  const ell = "…";
  let t = String(text || "");
  while(t.length > 0 && textWidth(font, t + ell, minSize) > maxW){
    t = t.slice(0, -1);
  }
  return { text: (t ? t + ell : ""), size: minSize };
}
function wrapLines(font, text, size, maxW){
  const words = safeStr(text).split(/\s+/).filter(Boolean);
  if(words.length === 0) return [];
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
function drawNotesLimited({page, font, x, y, text, size, maxW, maxLines, lineH, color}){
  const lines = wrapLines(font, text, size, maxW);
  const use = lines.slice(0, maxLines);
  if(lines.length > maxLines && use.length){
    const last = use[use.length-1] + " …";
    const fitted = fitTextOneLine({ font, text: last, size, maxW, minSize: CONFIG.PDF.minCellFont });
    use[use.length-1] = fitted.text;
  }
  for(const ln of use){
    page.drawText(ln, { x, y, size, font, color });
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

// ====== PDF GENERATION ======
async function buildPdfForGroup({entityName, rows, mode}){
  assertLibsLoaded();

  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const BLACK = rgb(0,0,0);
  const WHITE = rgb(1,1,1);
  const gridStroke = rgb(0.55, 0.55, 0.55);
  const gridFill = rgb(0.98, 0.98, 0.98);

  const topBarColor =
    mode === "buyer" ? rgb(0.20, 0.39, 0.60) :
    mode === "consignor" ? rgb(0.55, 0.55, 0.55) :
    rgb(0.15, 0.15, 0.15);

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const contentW = W - 2*M;

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  const centerTitle =
    mode === "buyer" ? "Buyer Recap and Down Money Invoice" : "Trade Confirmations";

  const leftLabel =
    mode === "buyer" ? "Buyer" : (mode === "consignor" ? "Consignor" : "Rep");

  const addressLines = [
    "CMS Livestock Auction",
    "6900 I-40 West, Suite 135",
    "Amarillo, TX 79106",
    "(806) 355-7505"
  ];

  // Compact columns tuned to fit 5 lots/page more often
  const colDefs = [
    { key: "loads", label: "Loads", w: 44 },
    { key: "head",  label: "Head",  w: 44 },
    { key: "sex",   label: "Sex",   w: 56 },
    { key: "bw",    label: "Base Wt", w: 58 },
    { key: "del",   label: "Delivery", w: 98 },
    { key: "loc",   label: "Location", w: 130 },
    { key: "shr",   label: "Shrink", w: 52 },
    { key: "sld",   label: "Slide",  w: 110 },
    { key: "price", label: "Price",  w: 62 },
  ];
  if(mode === "buyer"){
    colDefs.push({ key: "dm", label: "Down $", w: 70 });
  }

  const gridX = M;
  const gridW = colDefs.reduce((s,c)=>s+c.w,0);

  let page = pdfDoc.addPage([W,H]);
  let pageIndex = 0;
  let y = H - M;

  const drawTopBarFirstPageOnly = () => {
    if(pageIndex !== 0) return;
    page.drawRectangle({
      x: M,
      y: H - CONFIG.PDF.topBarH,
      width: contentW,
      height: CONFIG.PDF.topBarH,
      color: topBarColor
    });
  };

  const drawHeaderFirstPageOnly = () => {
    if(pageIndex !== 0) return;

    drawTopBarFirstPageOnly();

    let hy = H - CONFIG.PDF.topBarH - 10;

    // Left: label/name + auction info
    const leftX = M;
    page.drawText(`${leftLabel}: ${entityName}`, {
      x: leftX, y: hy, size: 12, font: fontBold, color: BLACK
    });
    hy -= 14;

    page.drawText(auctionTitle, {
      x: leftX, y: hy, size: 10, font, color: BLACK
    });
    hy -= 12;

    if(aDate){
      page.drawText(aDate, {
        x: leftX, y: hy, size: 10, font, color: BLACK
      });
    }

    // Right: address
    const rightW = 250;
    const rx = M + contentW - rightW;
    let ry = H - CONFIG.PDF.topBarH - 10;

    page.drawText(addressLines[0], {
      x: rx, y: ry, size: 10.5, font: fontBold, color: BLACK
    });
    ry -= 12;
    for(let i=1;i<addressLines.length;i++){
      page.drawText(addressLines[i], {
        x: rx, y: ry, size: 9.4, font, color: BLACK
      });
      ry -= 11;
    }

    // Center title
    const tW = textWidth(fontBold, centerTitle, CONFIG.PDF.title);
    page.drawText(centerTitle, {
      x: M + (contentW - tW)/2,
      y: H - CONFIG.PDF.topBarH - 46,
      size: CONFIG.PDF.title,
      font: fontBold,
      color: BLACK
    });

    y = H - CONFIG.PDF.topBarH - CONFIG.PDF.headerBlockH;
  };

  const newPage = () => {
    page = pdfDoc.addPage([W,H]);
    pageIndex += 1;
    y = H - M; // no header on later pages
  };

  drawHeaderFirstPageOnly();

  const sorted = [...rows].sort(sortLots);

  let buyerDownMoneyTotal = 0;
  let currentConsignor = "";

  const drawRepConsignorDivider = (name) => {
    const barH = 14;
    page.drawRectangle({
      x: M,
      y: y - barH,
      width: contentW,
      height: barH,
      color: rgb(0.90,0.90,0.90),
      borderWidth: 0.8,
      borderColor: gridStroke
    });
    page.drawText(`Consignor: ${name}`, {
      x: M + 8,
      y: y - barH + 3.5,
      size: 9.8,
      font: fontBold,
      color: BLACK
    });
    y -= (barH + 6);
  };

  const drawLotBlock = (r) => {
    const lot = safeStr(r[CONFIG.COLS.lotNumber]);
    const seller = safeStr(r[CONFIG.COLS.consignor]);
    const breed = safeStr(r[CONFIG.COLS.breed]) || safeStr(r[CONFIG.COLS.description]);

    const desc = safeStr(r[CONFIG.COLS.description]);
    const desc2 = safeStr(r[CONFIG.COLS.secondDescription]);
    const notesText = [desc, desc2].filter(Boolean).join("  |  ");

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

    const dmNum = toNumber(r[CONFIG.COLS.downMoney]);
    if(mode === "buyer") buyerDownMoneyTotal += dmNum;

    const padX = 8;

    // Row 1
    const row1H = 18;
    page.drawRectangle({
      x: M, y: y - row1H, width: contentW, height: row1H,
      color: WHITE, borderWidth: 1, borderColor: gridStroke
    });

    page.drawText(`${lot} - ${seller}`, {
      x: M + padX,
      y: y - 13,
      size: 10.3,
      font: fontBold,
      color: BLACK
    });

    const breedMaxW = 300;
    const fittedBreed = fitTextOneLine({
      font,
      text: breed,
      size: 9.4,
      maxW: breedMaxW,
      minSize: CONFIG.PDF.minCellFont
    });

    page.drawText(fittedBreed.text, {
      x: M + contentW - padX - textWidth(font, fittedBreed.text, fittedBreed.size),
      y: y - 13,
      size: fittedBreed.size,
      font,
      color: BLACK
    });

    y -= row1H;

    // Grid rows
    const labelH = 14;
    const valueH = 18;
    const gridH = labelH + valueH;

    page.drawRectangle({
      x: gridX, y: y - gridH, width: gridW, height: gridH,
      color: WHITE, borderWidth: 1, borderColor: gridStroke
    });

    // separator
    page.drawLine({
      start: { x: gridX, y: y - labelH },
      end:   { x: gridX + gridW, y: y - labelH },
      thickness: 0.8, color: gridStroke
    });

    let cx = gridX;
    for(let i=0;i<colDefs.length;i++){
      const c = colDefs[i];

      if(i !== 0){
        page.drawLine({
          start: { x: cx, y: y },
          end:   { x: cx, y: y - gridH },
          thickness: 0.8, color: gridStroke
        });
      }

      page.drawText(c.label, {
        x: cx + CONFIG.PDF.cellPadX,
        y: y - 11,
        size: CONFIG.PDF.tiny,
        font: fontBold,
        color: BLACK
      });

      const maxTextW = c.w - 2*CONFIG.PDF.cellPadX;

      let rawVal = "";
      switch(c.key){
        case "loads": rawVal = loads; break;
        case "head":  rawVal = head; break;
        case "sex":   rawVal = sex; break;
        case "bw":    rawVal = bw; break;
        case "del":   rawVal = del; break;
        case "loc":   rawVal = loc; break;
        case "shr":   rawVal = shr; break;
        case "sld":   rawVal = sld; break;
        case "price": rawVal = price; break;
        case "dm":    rawVal = dm; break;
        default: rawVal = "";
      }

      const fitted = fitTextOneLine({
        font,
        text: rawVal,
        size: CONFIG.PDF.small,
        maxW: maxTextW,
        minSize: CONFIG.PDF.minCellFont
      });

      page.drawText(fitted.text, {
        x: cx + CONFIG.PDF.cellPadX,
        y: y - labelH - 13,
        size: fitted.size,
        font,
        color: BLACK
      });

      cx += c.w;
    }

    y -= gridH;

    // Notes row
    const notesLineH = 10;
    const notesBoxMinH = 18;

    const notesHeader = "Notes: ";
    const notesTextFull = notesHeader + notesText;

    const notesLines = wrapLines(font, notesTextFull, CONFIG.PDF.tiny, contentW - 2*padX);
    const useLines = Math.min(notesLines.length, CONFIG.PDF.maxNotesLines);
    const notesH = Math.max(notesBoxMinH, 6 + useLines*notesLineH + 2);

    page.drawRectangle({
      x: M, y: y - notesH, width: contentW, height: notesH,
      color: WHITE, borderWidth: 1, borderColor: gridStroke
    });

    drawNotesLimited({
      page, font,
      x: M + padX,
      y: y - 10,
      text: notesTextFull,
      size: CONFIG.PDF.tiny,
      maxW: contentW - 2*padX,
      maxLines: CONFIG.PDF.maxNotesLines,
      lineH: notesLineH,
      color: BLACK
    });

    y -= notesH;

    // Buyer down money line (compact)
    if(mode === "buyer"){
      const dmRowH = 16;
      page.drawRectangle({
        x: M, y: y - dmRowH, width: contentW, height: dmRowH,
        color: gridFill, borderWidth: 1, borderColor: gridStroke
      });

      page.drawText(`Down Money Due: ${dm}`, {
        x: M + padX,
        y: y - 11.5,
        size: 9.6,
        font: fontBold,
        color: BLACK
      });

      y -= dmRowH;
    }

    y -= CONFIG.PDF.lotGap;
  };

  for(const r of sorted){

    if(mode === "rep"){
      const consignor = safeStr(r[CONFIG.COLS.consignor]);
      if(consignor && consignor !== currentConsignor){
        if(y < M + CONFIG.PDF.footerH + 40) newPage();
        currentConsignor = consignor;
        drawRepConsignorDivider(currentConsignor);
      }
    }

    // room check (rough but safe)
    if(y < M + CONFIG.PDF.footerH + 110){
      newPage();
      if(mode === "rep" && currentConsignor){
        drawRepConsignorDivider(currentConsignor);
      }
    }

    drawLotBlock(r);
  }

  // Buyer footer
  if(mode === "buyer"){
    if(y < M + CONFIG.PDF.footerH + 10){
      newPage();
    }

    const totalLine = `Total Down Money Due: ${formatMoney(buyerDownMoneyTotal)}`;
    page.drawText(totalLine, {
      x: M,
      y: y - 4,
      size: 11.3,
      font: fontBold,
      color: BLACK
    });
    y -= 18;

    const colGap = 22;
    const colW = (contentW - colGap) / 2;
    const leftX = M;
    const rightX = M + colW + colGap;

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

    const lineH = 10.5;

    let ly = y;
    for(const ln of leftFooter.split("\n")){
      page.drawText(ln, { x: leftX, y: ly, size: CONFIG.PDF.tiny, font, color: BLACK });
      ly -= lineH;
    }

    let ry = y;
    for(const ln of rightFooter.split("\n")){
      page.drawText(ln, { x: rightX, y: ry, size: CONFIG.PDF.tiny, font, color: BLACK });
      ry -= lineH;
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

// ====== Build PDFs ======
buildBtn.addEventListener("click", async ()=>{
  setError(builderError, "");
  buildBtn.disabled = true;
  buildBtn.textContent = "Generating…";

  try{
    assertLibsLoaded();

    if(csvRows.length === 0){
      throw new Error("Upload a CSV first.");
    }
    if(!(chkBuyer.checked || chkConsignor.checked || chkRep.checked)){
      throw new Error("Select at least one report type.");
    }

    // Validate columns again right before build (helps if CSV changed)
    const chk = requiredColsPresent(csvRows);
    if(!chk.ok){
      throw new Error(`CSV is missing required column(s): ${chk.missing.join(", ")}`);
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
    // Show the REAL error on-screen
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
