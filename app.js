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
    pageSize: { width: 612, height: 792 }, // US Letter
    margin: 36,
    headerTopPad: 24,
    fontSize: 10,
    small: 9,
    tiny: 8,
    title: 12,
    lineGap: 12,
    blockGap: 12,      // spacing between lots
    blockInnerGap: 8,  // spacing within lot block
    bottomGuard: 150
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
const contractLabel = document.getElementById("contractLabel"); // kept for UI but NOT printed in header now
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
  if(n === 0) return "PO";
  return "$" + n.toFixed(2);
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
  const needed = Object.values(CONFIG.COLS);
  const row0 = rows[0] || {};
  const keys = new Set(Object.keys(row0));
  const missing = needed.filter(c => !keys.has(c));
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
  contractLabel.value = "";
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

// ====== PDF HELPERS ======
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

function drawWrappedLines({page, font, color, x, y, text, size, maxWidth, lineHeight}){
  const lines = wrapText(font, text, size, maxWidth);
  for(const ln of lines){
    page.drawText(ln, { x, y, size, font, color, maxWidth });
    y -= lineHeight;
  }
  return y;
}

// ====== PDF GENERATION ======
async function buildPdfForGroup({entityName, rows, mode}){
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const INK = rgb(0,0,0);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Embed logo
  let logoImg = null;
  try{
    const logoBytes = await getLogoBytes();
    logoImg = await pdfDoc.embedPng(logoBytes);
  }catch{
    // If logo load fails, we continue without it (PDF still generates)
    logoImg = null;
  }

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const maxX = W - M;

  let page = pdfDoc.addPage([W, H]);
  let y = H - M;

  const lineH = CONFIG.PDF.lineGap;

  const drawText = (text, x, y, opts={})=>{
    page.drawText(safeStr(text), {
      x,
      y,
      size: opts.size ?? CONFIG.PDF.fontSize,
      font: opts.bold ? fontBold : font,
      color: opts.color ?? INK,
      maxWidth: opts.maxWidth
    });
  };

  const drawLine = (x1,y1,x2,y2, thickness=1)=>{
    page.drawLine({ start:{x:x1,y:y1}, end:{x:x2,y:y2}, thickness, color: INK });
  };

  const newPage = ()=>{
    page = pdfDoc.addPage([W, H]);
    y = H - M;
    drawHeader(); // repeat header on new pages for clarity
    y -= 10;
  };

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  const centerTitle =
    mode === "buyer"
      ? "Buyer Recap and Down Money Invoice"
      : "Trade Confirmations";

  const rightLabel =
    mode === "buyer" ? "Buyer" :
    mode === "consignor" ? "Consignor" :
    "Rep";

  const headerLeftLines = [
    "CMS Livestock Auction",
    "6900 I-40 West, Suite 135",
    "Amarillo, TX 79106",
    "(806) 355-7505"
  ];

  function drawHeader(){
    // logo + left block
    const logoW = 58;
    const logoH = logoImg ? (logoImg.height / logoImg.width) * logoW : 0;

    const leftX = M;
    let leftY = H - M;

    if(logoImg){
      // draw logo slightly below top margin so it doesn't clip
      page.drawImage(logoImg, {
        x: leftX,
        y: leftY - logoH,
        width: logoW,
        height: logoH
      });
    }

    const textStartX = logoImg ? (leftX + logoW + 10) : leftX;
    let ty = leftY - 2; // top baseline

    // Left address (bold first line)
    drawText(headerLeftLines[0], textStartX, ty, { bold:true, size: 11 });
    ty -= 13;
    drawText(headerLeftLines[1], textStartX, ty, { size: 10 }); ty -= 12;
    drawText(headerLeftLines[2], textStartX, ty, { size: 10 }); ty -= 12;
    drawText(headerLeftLines[3], textStartX, ty, { size: 10 });

    // Right block
    const rightX = maxX - 250; // right column width
    let ry = leftY - 2;

    drawText(`${rightLabel}: ${entityName}`, rightX, ry, { bold:true, size: 11 });
    ry -= 13;
    drawText(auctionTitle, rightX, ry, { size: 10, maxWidth: 250 });
    ry -= 12;
    drawText(aDate, rightX, ry, { size: 10 });

    // Center title
    const centerY = leftY - 60;
    const titleWidth = fontBold.widthOfTextAtSize(centerTitle, 12);
    const cx = (W - titleWidth) / 2;
    drawText(centerTitle, cx, centerY, { bold:true, size: 12 });

    // divider line
    drawLine(M, centerY - 12, maxX, centerY - 12, 1);

    // set y start for body
    y = centerY - 24;
  }

  drawHeader();

  const sorted = [...rows].sort(sortLots);

  // Buyer totals for invoice box
  let buyerDownMoneyTotal = 0;

  for(const r of sorted){
    if(y < M + CONFIG.PDF.bottomGuard){
      newPage();
    }

    const lot = safeStr(r[CONFIG.COLS.lotNumber]);
    const seller = safeStr(r[CONFIG.COLS.consignor]);

    // Description should pull “breed” — we use the Description column as the primary breed/description line.
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

    const dm = toNumber(r[CONFIG.COLS.downMoney]); // blank=>0
    if(mode === "buyer") buyerDownMoneyTotal += dm;

    // ---- LOT BLOCK ----
    // Line 1: Lot # - Seller
    drawText(`${lot} - ${seller}`, M, y, { bold:true, size: 11 });
    y -= 14;

    // Line 2: Description (wrapped)
    y = drawWrappedLines({
      page,
      font,
      color: INK,
      x: M,
      y,
      text: desc,
      size: 10,
      maxWidth: maxX - M,
      lineHeight: 12
    });

    // small gap
    y -= 2;

    // Labels row
    const labels = "Loads: Head: Sex: Base Weight: Delivery: Location: Shrink: Slide: Price";
    drawText(labels, M, y, { size: 9 });
    y -= 12;

    // Values row (the colon-separated values)
    const values = `${loads}:${head}:${sex}:${bw}:${del}:${loc}:${shr}:${sld}:${price}`;
    y = drawWrappedLines({
      page,
      font,
      color: INK,
      x: M,
      y,
      text: values,
      size: 10,
      maxWidth: maxX - M,
      lineHeight: 12
    });

    // Notes (your rule: description then second description on a new row if it exists)
    // Also: "A new line cannot be started until all letters/words used" -> enforced via wrapText()
    const notesHeader = "Notes:";
    drawText(notesHeader, M, y, { bold:true, size: 10 });
    y -= 12;

    // First notes line: Description
    y = drawWrappedLines({
      page,
      font,
      color: INK,
      x: M + 36,
      y,
      text: desc,
      size: 9,
      maxWidth: (maxX - M) - 36,
      lineHeight: 11
    });

    // Second notes line: Second Description if available
    if(desc2){
      y = drawWrappedLines({
        page,
        font,
        color: INK,
        x: M + 36,
        y,
        text: desc2,
        size: 9,
        maxWidth: (maxX - M) - 36,
        lineHeight: 11
      });
    }

    // Down money per lot (buyer only)
    if(mode === "buyer"){
      const dmLine = `Down Money Due: ${downMoneyDisplay(r[CONFIG.COLS.downMoney])}`;
      drawText(dmLine, M, y, { bold:true, size: 11 });
      y -= 14;
    }else{
      y -= 6;
    }

    // separator + spacing between lots
    drawLine(M, y, maxX, y, 0.6);
    y -= CONFIG.PDF.blockGap;
  }

  // Buyer total box + footer remittance instructions
  if(mode === "buyer"){
    if(y < M + 220) newPage();

    // Total box
    const boxW = 240;
    const boxH = 46;
    const boxX = maxX - boxW;
    const boxY = y - boxH;

    page.drawRectangle({
      x: boxX, y: boxY,
      width: boxW, height: boxH,
      borderWidth: 1,
      borderColor: INK,
    });

    drawText("Total Down Money Due:", boxX + 10, boxY + 26, { bold:true, size: 11 });
    drawText(money2(buyerDownMoneyTotal), boxX + 10, boxY + 8, { bold:true, size: 13 });

    y = boxY - 18;

    // Remit / wiring footer block (as you provided)
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
Account Number: 504831484`;

    y = drawWrappedLines({
      page,
      font,
      color: INK,
      x: M,
      y,
      text: footerText,
      size: 8.5,
      maxWidth: maxX - M,
      lineHeight: 11
    });

    y -= 6;

    // Your “something else here”
    const closing =
      "We appreciate your business. If you have any questions regarding lots, delivery, or payment, please call our office.";
    y = drawWrappedLines({
      page,
      font,
      color: INK,
      x: M,
      y,
      text: closing,
      size: 9,
      maxWidth: maxX - M,
      lineHeight: 12
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

    // Buyers (one PDF per buyer includes all their rows)
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

    // Consignors
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

    // Reps (ignore blanks)
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
