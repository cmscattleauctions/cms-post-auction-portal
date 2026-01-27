/* CMS Post-Auction Portal (client-only)
   - CSV parse: PapaParse
   - PDF gen: pdf-lib
   - ZIP: JSZip
*/

const CONFIG = {
  PIN: "0623",

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
    fontSize: 9,
    fontSizeSmall: 8,
    titleSize: 14,
    lineHeight: 12,
    tableRowHeight: 22,
    bottomGuard: 120,
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
const contractLabel = document.getElementById("contractLabel");
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

function moneyDisplay(v){
  const n = toNumber(v);
  if(n === 0) return "PO";
  return "$" + n.toFixed(2);
}

function priceDisplay(v){
  const n = toNumber(v);
  if(n === 0) return "$0.00";
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

// ====== PDF GENERATION ======
async function buildPdfForGroup({entityName, rows, mode}){
  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  // IMPORTANT: black ink so content is visible on white page
  const INK = rgb(0,0,0);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageSize = CONFIG.PDF.pageSize;
  const margin = CONFIG.PDF.margin;
  const maxX = pageSize.width - margin;

  let page = pdfDoc.addPage([pageSize.width, pageSize.height]);
  let y = pageSize.height - margin;

  const drawText = (text, x, y, opts={}) => {
    page.drawText(text, {
      x,
      y,
      size: opts.size ?? CONFIG.PDF.fontSize,
      font: opts.bold ? fontBold : font,
      color: opts.color ?? INK,
      maxWidth: opts.maxWidth,
      lineHeight: opts.lineHeight ?? CONFIG.PDF.lineHeight,
    });
  };

  const drawLine = (x1,y1,x2,y2, thickness=1) => {
    page.drawLine({
      start:{x:x1,y:y1},
      end:{x:x2,y:y2},
      thickness,
      color: INK
    });
  };

  function newPage(){
    page = pdfDoc.addPage([pageSize.width, pageSize.height]);
    y = pageSize.height - margin;
  }

  const titleMid = (mode === "buyer") ? "Buyer Recap" : "Trade Confirmations";

  // Header
  drawText("CMS LIVESTOCK AUCTION", margin, y, {bold:true, size: CONFIG.PDF.titleSize});
  y -= 18;

  if(mode === "buyer"){
    drawText(`Buyer: ${entityName}`, margin, y, {bold:true, size: 12});
  }else{
    drawText(entityName, margin, y, {bold:true, size: 12});
  }
  y -= 14;

  drawText(titleMid, margin, y, {bold:true, size: 12});
  y -= 16;

  const aName = safeStr(auctionName.value) || "Auction";
  const aDate = safeStr(auctionDate.value) || "";
  const extra = safeStr(auctionLabel.value) || "";
  const contractLbl = safeStr(contractLabel.value) || "";

  const line1 = extra ? `${aName} — ${extra}` : aName;

  const line2Parts = [aDate];
  if(mode === "buyer" && contractLbl) line2Parts.push(`Contract: ${contractLbl}`);
  const line2 = line2Parts.filter(Boolean).join("  |  ");

  drawText(line1, margin, y, {size: 10});
  y -= 12;
  if(line2){
    drawText(line2, margin, y, {size: 10});
    y -= 12;
  }

  y -= 6;
  drawLine(margin, y, maxX, y, 1);
  y -= 14;

  // Table columns (NO buyer column)
  const cols = [
    { label:"Lot", w:34 },
    { label:"Seller", w:90 },
    { label:"Loads", w:40 },
    { label:"Head", w:38 },
    { label:"Description / Notes", w:190 },
    { label:"Sex", w:30 },
    { label:"Base Wt", w:48 },
    { label:"Delivery", w:54 },
    { label:"Location", w:64 },
    { label:"Shr", w:28 },
    { label:"Sld", w:28 },
    { label:"Price", w:54 },
  ];

  if(mode === "buyer"){
    cols.push({ label:"Down $", w:54 });
  }

  // Header row
  let x = margin;
  const headerY = y;
  cols.forEach(c=>{
    drawText(c.label, x, headerY, {bold:true, size: 8});
    x += c.w;
  });
  y -= 10;
  drawLine(margin, y, maxX, y, 1);
  y -= 10;

  const sorted = [...rows].sort(sortLots);
  let downMoneyTotal = 0;

  for(const r of sorted){
    if(y < margin + CONFIG.PDF.bottomGuard){
      newPage();

      drawText("CMS LIVESTOCK AUCTION", margin, y, {bold:true, size: 12});
      y -= 16;

      if(mode === "buyer"){
        drawText(`Buyer: ${entityName} — ${titleMid}`, margin, y, {bold:true, size: 10});
      }else{
        drawText(`${entityName} — ${titleMid}`, margin, y, {bold:true, size: 10});
      }
      y -= 14;

      drawLine(margin, y, maxX, y, 1);
      y -= 14;

      x = margin;
      cols.forEach(c=>{
        drawText(c.label, x, y, {bold:true, size: 8});
        x += c.w;
      });
      y -= 10;
      drawLine(margin, y, maxX, y, 1);
      y -= 10;
    }

    const lot = safeStr(r[CONFIG.COLS.lotNumber]);
    const seller = safeStr(r[CONFIG.COLS.consignor]); // confirmed by you
    const loads = safeStr(r[CONFIG.COLS.loads]);
    const head = safeStr(r[CONFIG.COLS.head]);

    const desc = safeStr(r[CONFIG.COLS.description]);
    const desc2 = safeStr(r[CONFIG.COLS.secondDescription]);
    const notes = desc2 ? `${desc}\n${desc2}` : desc;

    const sex = safeStr(r[CONFIG.COLS.sex]);
    const bw = safeStr(r[CONFIG.COLS.baseWeight]);
    const del = safeStr(r[CONFIG.COLS.delivery]);
    const loc = safeStr(r[CONFIG.COLS.location]);
    const shr = safeStr(r[CONFIG.COLS.shrink]);
    const sld = safeStr(r[CONFIG.COLS.slide]);
    const price = priceDisplay(r[CONFIG.COLS.price]);

    const dmVal = toNumber(r[CONFIG.COLS.downMoney]); // blank -> 0
    if(mode === "buyer") downMoneyTotal += dmVal;

    x = margin;
    const rowTop = y;

    const cell = (text, width, opts={})=>{
      page.drawText(text, {
        x,
        y: rowTop,
        size: opts.size ?? CONFIG.PDF.fontSizeSmall,
        font: opts.bold ? fontBold : font,
        color: INK,
        maxWidth: width - 4,
        lineHeight: opts.lineHeight ?? 10,
      });
      x += width;
    };

    cell(lot, cols[0].w);
    cell(seller, cols[1].w);
    cell(loads, cols[2].w);
    cell(head, cols[3].w);
    cell(notes, cols[4].w, { lineHeight: 10 });

    cell(sex, cols[5].w);
    cell(bw, cols[6].w);
    cell(del, cols[7].w);
    cell(loc, cols[8].w);
    cell(shr, cols[9].w);
    cell(sld, cols[10].w);
    cell(price, cols[11].w);

    if(mode === "buyer"){
      cell(moneyDisplay(r[CONFIG.COLS.downMoney]), cols[12].w);
    }

    y -= CONFIG.PDF.tableRowHeight;
    drawLine(margin, y + 6, maxX, y + 6, 0.6);
  }

  // Buyer footer total box
  if(mode === "buyer"){
    y -= 12;
    if(y < margin + 70) newPage();

    const boxW = 220;
    const boxH = 40;
    const boxX = maxX - boxW;
    const boxY = y - boxH;

    page.drawRectangle({
      x: boxX, y: boxY,
      width: boxW, height: boxH,
      borderWidth: 1,
      borderColor: INK,
    });

    drawText("Down Money Due:", boxX + 10, boxY + 22, {bold:true, size: 11});
    drawText("$" + downMoneyTotal.toFixed(2), boxX + 10, boxY + 6, {bold:true, size: 12});

    y = boxY - 18;

    const wiring = "Wiring Instructions: Please contact CMS office for bank details or use the standard CMS wiring profile on file.";
    drawText(wiring, margin, y, {size: 9, maxWidth: maxX - margin});
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

    // Buyers
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
    setError(builderError, "Something went wrong during PDF generation. Check console for details.");
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

// Back button
backBtn.addEventListener("click", ()=> goto(pageBuilder));

// Exit button
exitBtn.addEventListener("click", ()=>{
  // use wipeAll logic above
});

// Start
goto(pageAuth);
setBuildEnabled();
