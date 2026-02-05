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
    price: "Price/CWT",
    downMoney: "Down Money",

    comments: "Comments",
    buyerComments: "Buyer Comments",
    sellerComments: "Seller Comments",

    contract: "Contract",
  },

  COLORS: {
    cmsBlue: "#336699",
    consignorHeader: "#818589",
  },

  PDF: {
    pageSize: { width: 792, height: 612 }, // landscape letter (non-contract PDFs)
    margin: 26,
    bottomLimit: 9,
    topBarH: 8,

    headerHFirst: 92,
    headerHOther: 56,

    buyerNameSize: 14.4,
    otherNameSize: 12.6,
    title: 12.0,

    lotTitle: 12.6,
    cellPadX: 6,
  },

  CONTRACT_TERMS: {
    buyer: `Buyer agrees to remit payment for all cattle purchased through CMS Livestock Auction on the agreed upon date. Payment shall be made by wire transfer or cashier's check unless otherwise approved in writing by CMS Livestock Auction.
Buyer understands and agrees that down money in the amount of {{ Down Money Due }} is due immediately upon purchase of the cattle.
Buyer agrees to accept delivery of the cattle as sold through CMS Livestock Auction on the agreed-upon delivery date.
Buyer understands and agrees that once the cattle are purchased through CMS Livestock Auction, Buyer shall take possession of the cattle on the agreed-upon delivery date and assumes all risk of loss upon delivery.
Buyer represents and warrants that Buyer has inspected the cattle or has had the opportunity to inspect the cattle prior to purchase.
Buyer understands and agrees that all cattle are sold "as is" and "where is" with no warranties, express or implied, except as expressly stated in this contract.
Buyer understands and agrees that CMS Livestock Auction acts as an agent for the Seller and is not responsible for any defects or issues with the cattle sold.
Buyer agrees to comply with all applicable laws and regulations regarding the transportation and handling of livestock.
Buyer agrees that any disputes arising from this contract shall be resolved in the courts of the State of Texas.`,

    seller: `All cattle shall be in good physical condition and shall be free of any defects including to but not limited to lameness, crippled, bad eyes, and lump jaws.
Seller agrees to deliver the above-described cattle to Buyer as sold through CMS Livestock Auction on the agreed-upon delivery date. Seller further agrees that once the cattle are sold through CMS Livestock Auction, Seller shall not sell, transfer, or otherwise dispose of the cattle to any party other than the Buyer prior to the delivery date without written consent from CMS Livestock Auction.
Seller represents and warrants that all information provided regarding the cattle, including weight, breed, age, and health status, is accurate to the best of Seller’s knowledge.
Seller does hereby warrant that all cattle shall have clear title and be free of any and all encumbrances.
The CMS Livestock Auction Seller’s Terms of Service Agreement as signed prior to the auction are incorporated by reference into this contract.`
  }
};

/* ---------------- DOM HELPERS ---------------- */

function $(id){ return document.getElementById(id); }

function show(el){ el.classList.remove("hidden"); }
function hide(el){ el.classList.add("hidden"); }

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
    const k = safeStr(r[key] ?? "");
    if(!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

function num(v){
  const n = Number(String(v).replace(/[^0-9.\-]/g,""));
  return Number.isFinite(n) ? n : 0;
}

/* ---------------- LIB ASSERT ---------------- */

function assertLibsLoaded(){
  if(!window.PDFLib) throw new Error("PDF-lib not loaded (window.PDFLib undefined).");
  if(!window.Papa) throw new Error("PapaParse not loaded (window.Papa undefined).");
  if(!window.JSZip) throw new Error("JSZip not loaded (window.JSZip undefined).");
}

/* ---------------- CSV ---------------- */

let csvRows = [];
let csvFilename = "";

function parseCsvFile(file){
  return new Promise((resolve, reject) => {
    assertLibsLoaded();

    window.Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if(res.errors && res.errors.length){
          reject(new Error(res.errors[0].message || "CSV parse failed"));
          return;
        }
        resolve(res.data || []);
      },
      error: (err) => reject(err)
    });
  });
}

/* ---------------- UI STATE ---------------- */

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
  pageAuth = $("pageAuth");
  pageBuilder = $("pageBuilder");
  pageResults = $("pageResults");

  pinInput = $("pinInput");
  pinSubmit = $("pinSubmit");
  authError = $("authError");

  auctionName = $("auctionName");
  auctionDate = $("auctionDate");
  auctionLabel = $("auctionLabel");

  dropZone = $("dropZone");
  fileInput = $("fileInput");
  fileMeta = $("fileMeta");

  chkBuyer = $("chkBuyer");
  chkConsignor = $("chkConsignor");
  chkRep = $("chkRep");
  chkLotByLot = $("chkLotByLot");
  chkBuyerContracts = $("chkBuyerContracts");
  chkSellerContracts = $("chkSellerContracts");

  buildBtn = $("buildBtn");
  builderError = $("builderError");

  listBuyerReports = $("listBuyerReports");
  listLotByLot = $("listLotByLot");
  listConsignorReports = $("listConsignorReports");
  listRepReports = $("listRepReports");

  listBuyerContracts = $("listBuyerContracts");
  listSellerContracts = $("listSellerContracts");

  zipBuyerReports = $("zipBuyerReports");
  zipLotByLot = $("zipLotByLot");
  zipConsignorReports = $("zipConsignorReports");
  zipRepReports = $("zipRepReports");
  zipBuyerContracts = $("zipBuyerContracts");
  zipSellerContracts = $("zipSellerContracts");
  zipAll = $("zipAll");

  backBtn = $("backBtn");
  exitBtn = $("exitBtn");
  resultsMeta = $("resultsMeta");
}

function setupResultsAccordions(){
  // Safe-by-default: if JS fails, lists remain visible (HTML default expanded).
  const cols = document.querySelectorAll("#pageResults .resultsCol");
  cols.forEach(col => col.classList.add("collapsed"));

  const toggles = document.querySelectorAll("#pageResults .accToggle");
  toggles.forEach(btn => {
    const col = btn.closest(".resultsCol");
    if(!col) return;

    btn.setAttribute("aria-expanded", "false");

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const isCollapsed = col.classList.toggle("collapsed");
      btn.setAttribute("aria-expanded", String(!isCollapsed));
    });
  });
}

function goto(el){
  [pageAuth, pageBuilder, pageResults].forEach(hide);
  show(el);
}

function setBuildEnabled(){
  const hasCsv = csvRows && csvRows.length > 0;
  const anyChecked = [chkBuyer, chkConsignor, chkRep, chkLotByLot, chkBuyerContracts, chkSellerContracts].some(c => c.checked);
  buildBtn.disabled = !(hasCsv && anyChecked);
}

/* ---------------- AUTH ---------------- */

function wireAuth(){
  function attempt(){
    hide(authError);
    const v = safeStr(pinInput.value);
    if(v !== CONFIG.PIN){
      authError.textContent = "Invalid PIN.";
      show(authError);
      return;
    }
    goto(pageBuilder);
    setBuildEnabled();
  }

  pinSubmit.addEventListener("click", attempt);
  pinInput.addEventListener("keydown", (e) => {
    if(e.key === "Enter") attempt();
  });
}

/* ---------------- DROPZONE ---------------- */

function wireDropZone({zoneEl, inputEl, onFile, metaEl}){
  function setMeta(msg){
    metaEl.textContent = msg;
    show(metaEl);
  }

  zoneEl.addEventListener("dragover", (e) => {
    e.preventDefault();
    zoneEl.style.borderColor = "rgba(96,165,250,.85)";
  });

  zoneEl.addEventListener("dragleave", () => {
    zoneEl.style.borderColor = "";
  });

  zoneEl.addEventListener("drop", (e) => {
    e.preventDefault();
    zoneEl.style.borderColor = "";
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if(!f) return;
    onFile(f, setMeta);
  });

  inputEl.addEventListener("change", () => {
    const f = inputEl.files && inputEl.files[0];
    if(!f) return;
    onFile(f, setMeta);
  });
}

async function handleCsvFile(file, setMeta){
  hide(builderError);
  csvFilename = file.name || "auction.csv";
  setMeta(`Reading CSV: ${csvFilename} ...`);

  try{
    const rows = await parseCsvFile(file);
    csvRows = rows;
    setMeta(`Loaded ${rows.length.toLocaleString()} rows from ${csvFilename}`);
  }catch(err){
    csvRows = [];
    setMeta(`CSV failed: ${err.message}`);
    builderError.textContent = err.message;
    show(builderError);
  }

  setBuildEnabled();
}

/* ---------------- PDF HELPERS ---------------- */

function hexToRgb01(hex){
  const h = hex.replace("#","").trim();
  const full = (h.length === 3) ? h.split("").map(ch=>ch+ch).join("") : h;
  const n = parseInt(full,16);
  const r = (n>>16)&255;
  const g = (n>>8)&255;
  const b = n&255;
  return [r/255,g/255,b/255];
}

function wrapLines(font, text, size, maxW){
  const t = safeStr(text);
  if(!t) return [""];
  const words = t.split(/\s+/);
  const lines = [];
  let cur = "";

  for(const w of words){
    const test = cur ? `${cur} ${w}` : w;
    const width = font.widthOfTextAtSize(test, size);
    if(width <= maxW){
      cur = test;
    }else{
      if(cur) lines.push(cur);
      cur = w;
    }
  }
  if(cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function getContract(row){
  return safeStr(row[CONFIG.COLS.contract] || row[CONFIG.COLS.lotSeq] || row[CONFIG.COLS.lotNumber] || "");
}

function sortLot(a,b){
  const na = num(a[CONFIG.COLS.lotSeq] || a[CONFIG.COLS.lotNumber]);
  const nb = num(b[CONFIG.COLS.lotSeq] || b[CONFIG.COLS.lotNumber]);
  return na - nb;
}

function priceDisplay(v){
  const s = safeStr(v);
  if(!s) return "";
  const n = num(s);
  return n ? `$${n.toFixed(2)}` : s;
}

function downMoneyDisplay(v){
  const s = safeStr(v);
  if(!s) return "";
  const n = num(s);
  return n ? `$${n.toFixed(2)}` : s;
}

/* ---------------- BUYER / CONSIGNOR / REP / LOT PDF ---------------- */

async function buildSummaryPdf({rows, mode, singleLotMode=false}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const contentW = W - 2*M;

  const cmsBlue = rgb(...hexToRgb01(CONFIG.COLORS.cmsBlue));
  const headerGray = rgb(...hexToRgb01(CONFIG.COLORS.consignorHeader));
  const topBarColor = (mode === "consignor") ? headerGray : cmsBlue;

  const BLACK = rgb(0,0,0);
  const WHITE = rgb(1,1,1);

  const page = pdfDoc.addPage([W,H]);

  // Top stripe
  page.drawRectangle({ x:0, y:H-CONFIG.PDF.topBarH, width:W, height:CONFIG.PDF.topBarH, color: topBarColor });

  const name = (mode === "buyer")
    ? safeStr(rows[0][CONFIG.COLS.buyer])
    : (mode === "consignor")
      ? safeStr(rows[0][CONFIG.COLS.consignor])
      : safeStr(rows[0][CONFIG.COLS.rep]);

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

  let y = H - CONFIG.PDF.topBarH - 28;

  // Left header
  page.drawText(docTitle, { x:M, y, size: 16, font: fontBold, color: BLACK });
  y -= 18;

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  page.drawText(auctionTitle, { x:M, y, size: 10.2, font: fontBold, color: BLACK });
  y -= 14;
  if(aDate){
    page.drawText(aDate, { x:M, y, size: 10.0, font, color: BLACK });
  }

  // Right header box
  const boxW = 230;
  const boxH = 54;
  const boxX = M + contentW - boxW;
  const boxY = H - CONFIG.PDF.topBarH - 22 - boxH;

  page.drawRectangle({ x:boxX, y:boxY, width:boxW, height:boxH, color: WHITE, borderWidth: 1.2, borderColor: BLACK });

  let ty = boxY + boxH - 14;
  for(const ln of addrLines){
    page.drawText(ln, { x:boxX+10, y:ty, size: 8.9, font, color: BLACK });
    ty -= 10.5;
  }

  // Name band
  const bandY = H - CONFIG.PDF.topBarH - 82;
  page.drawRectangle({ x: M, y: bandY, width: contentW, height: 28, color: WHITE, borderWidth: 1.2, borderColor: BLACK });

  const label = (mode === "buyer") ? "Buyer:" : (mode === "consignor") ? "Consignor:" : "Representative:";
  page.drawText(label, { x:M+10, y:bandY+9, size: 11.0, font: fontBold, color: BLACK });

  const nameX = M + 70;
  page.drawText(name, { x:nameX, y:bandY+8.5, size: nameSize, font: fontBold, color: BLACK });

  // Body list
  let by = bandY - 18;
  const headerLine = (mode === "buyer")
    ? "Lots purchased:"
    : "Lots sold:";

  page.drawText(headerLine, { x:M, y:by, size: 10.2, font: fontBold, color: BLACK });
  by -= 12;

  // Simple lot list
  const listSize = 9.4;
  const maxLines = 22;

  const sorted = [...rows].sort(sortLot);
  let count = 0;

  for(const r of sorted){
    if(count >= maxLines) break;

    const lot = safeStr(r[CONFIG.COLS.lotNumber] || r[CONFIG.COLS.lotSeq]);
    const head = safeStr(r[CONFIG.COLS.head]);
    const desc = safeStr(r[CONFIG.COLS.description]);
    const del = safeStr(r[CONFIG.COLS.delivery]);
    const px = priceDisplay(r[CONFIG.COLS.price]);

    const line = `Lot ${lot} — ${head} hd — ${desc}${del ? " — " + del : ""}${px ? " — " + px : ""}`;
    const lines = wrapLines(font, line, listSize, contentW);

    for(const ln of lines){
      if(count >= maxLines) break;
      page.drawText(ln, { x:M, y:by, size:listSize, font, color: BLACK });
      by -= 11;
      count++;
    }
  }

  // Down money section (buyer mode)
  if(mode === "buyer"){
    by -= 6;
    const totalDM = rows.reduce((s,r)=>s+num(r[CONFIG.COLS.downMoney]), 0);
    page.drawText(`Down Money Total: $${totalDM.toFixed(2)}`, { x:M, y:by, size: 11.0, font: fontBold, color: BLACK });
  }

  return await pdfDoc.save();
}

/* ---------------- CONTRACT DETAILS (LOT PDF) ---------------- */

async function buildLotDetailPdf({row}){
  return await buildSummaryPdf({ rows:[row], mode:"buyer", singleLotMode:true });
}

/* ---------------- BUYER / SELLER CONTRACTS (ONE LOT) ---------------- */

async function buildSalesContractPdf({row, side}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Contracts only: portrait letter (keep global landscape for other PDFs)
  const W = 612;
  const H = 792;
  const M = 34;
  const contentW = W - 2*M;

  const BLUE = rgb(...hexToRgb01(CONFIG.COLORS.cmsBlue));
  const SELLER_GRAY = rgb(...hexToRgb01("#818589"));
  const topBarColor = (side === "seller") ? SELLER_GRAY : BLUE;

  const BLACK = rgb(0,0,0);
  const GRAY = rgb(0.55, 0.55, 0.55);

  // ----- helpers -----
  const lineH = 11.5;

  function drawTopBar(page){
    page.drawRectangle({ x:0, y:H-CONFIG.PDF.topBarH, width:W, height:CONFIG.PDF.topBarH, color: topBarColor });
  }

  function drawHeader(page, {isContinued=false}={}){
    drawTopBar(page);

    const contract = safeStr(getContract(row));
    const consignor = safeStr(row[CONFIG.COLS.consignor]);

    const titleY = H - CONFIG.PDF.topBarH - 44;

    page.drawText("Cattle Sales Contract", {
      x: M,
      y: titleY,
      size: 18,
      font: fontBold,
      color: BLACK
    });

    const cnText = `Contract #${contract ? ": " + contract : ""}`.trim();
    const cnSize = 16;
    const cnW = fontBold.widthOfTextAtSize(cnText, cnSize);
    page.drawText(cnText, {
      x: M + contentW - cnW,
      y: titleY,
      size: cnSize,
      font: fontBold,
      color: BLACK
    });

    const auctionTitleBase = safeStr(auctionName.value) || "Auction";
    const extra = safeStr(auctionLabel.value);
    const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
    const aDate = safeStr(auctionDate.value) || "";
    const subLine = `${auctionTitle}${aDate ? " — " + aDate : ""}${isContinued ? " (continued)" : ""}`;

    const subY = titleY - 18;
    page.drawText(subLine, { x: M, y: subY, size: 9.8, font, color: BLACK });

    // Seller contract: add consignor bold under the auction line
    if(side === "seller"){
      page.drawText(consignor, { x: M, y: subY - 12.5, size: 10.2, font: fontBold, color: BLACK });
    }

    return (side === "seller") ? (subY - 28) : (subY - 18);
  }

  function drawBand(page, y){
    const lotNum = safeStr(row[CONFIG.COLS.lotNumber]);
    const consignor = safeStr(row[CONFIG.COLS.consignor]);
    const sellerLine = `Seller: ${[lotNum, consignor].filter(Boolean).join(" - ")}`.trim();

    const breed = safeStr(row[CONFIG.COLS.breed] || row[CONFIG.COLS.description] || "");
    const bandH = 36;

    page.drawRectangle({
      x: M,
      y: y - bandH,
      width: contentW,
      height: bandH,
      color: rgb(1,1,1),
      borderWidth: 1.0,
      borderColor: GRAY
    });

    page.drawText(sellerLine, { x:M+8, y:y-15, size:10.6, font:fontBold, color:BLACK });
    if(breed){
      page.drawText(breed, { x:M+8, y:y-29, size:9.4, font, color:BLACK });
    }
    return y - bandH;
  }

  function drawGridRow(page, y, cols){
    // cols: [{label,value,flex}]
    const rowH = 32;
    const labelH = 13;

    const totalFlex = cols.reduce((s,c)=>s+(c.flex||1),0);
    let x = M;

    for(const c of cols){
      const w = contentW * ((c.flex||1)/totalFlex);

      page.drawRectangle({
        x, y: y - rowH,
        width: w,
        height: rowH,
        color: rgb(1,1,1),
        borderWidth: 1.0,
        borderColor: GRAY
      });

      // label
      page.drawText(c.label, { x:x+6, y:y-12, size:8.6, font:fontBold, color:GRAY });

      // value (wrapped)
      const maxW = w - 12;
      const lines = wrapLines(font, safeStr(c.value), 10.2, maxW);
      const valY = y - labelH - 6;
      for(let i=0;i<Math.min(2, lines.length);i++){
        page.drawText(lines[i], { x:x+6, y:valY - (i*11), size:10.2, font, color:BLACK });
      }

      x += w;
    }

    return y - rowH;
  }

  function drawFullWidthField(page, y, label, value){
    const rowH = 26;

    page.drawRectangle({
      x: M,
      y: y - rowH,
      width: contentW,
      height: rowH,
      color: rgb(1,1,1),
      borderWidth: 1.0,
      borderColor: GRAY
    });

    page.drawText(label, { x:M+8, y:y-11, size:8.6, font:fontBold, color:GRAY });

    const lines = wrapLines(font, safeStr(value), 10.2, contentW - 16);
    if(lines[0]){
      page.drawText(lines[0], { x:M+8, y:y-22, size:10.2, font, color:BLACK });
    }
    return y - rowH;
  }

  function ensureSpace(cur, needed, pages){
    // cur: {page,y}. If insufficient, start a new page with continued header.
    if(cur.y - needed >= 90) return cur;
    const page = pdfDoc.addPage([W,H]);
    const headerBottomY = drawHeader(page, {isContinued:true});
    pages.push(page);
    return { page, y: headerBottomY - 10 };
  }

  function drawTerms(pages, cur, termsText){
    const paragraphs = termsText.split("\n");
    for(const p of paragraphs){
      const t = safeStr(p);
      const lines = t ? wrapLines(font, t, 9.2, contentW) : [""];
      for(const ln of lines){
        cur = ensureSpace(cur, lineH, pages);
        cur.page.drawText(ln, { x:M, y:cur.y, size:9.2, font, color:BLACK });
        cur.y -= lineH;
      }
      // paragraph spacing
      cur.y -= 2;
    }
    return cur;
  }

  function drawStackedSignatures(page){
    const sigLineW = contentW;
    const baseY = 72;

    const topLineY = baseY + 48;
    const botLineY = baseY + 18;

    page.drawLine({ start:{x:M, y:topLineY}, end:{x:M+sigLineW, y:topLineY}, thickness:1.0, color:BLACK });
    page.drawLine({ start:{x:M, y:botLineY}, end:{x:M+sigLineW, y:botLineY}, thickness:1.0, color:BLACK });

    const topLabel = (side === "buyer") ? "Buyer Signature / Date" : "Seller Signature / Date";
    const botLabel = "CMS Orita Calf Auctions, LLC Signature / Date";

    page.drawText(topLabel, { x:M, y:topLineY-14, size:9.6, font, color:BLACK });
    page.drawText(botLabel, { x:M, y:botLineY-14, size:9.6, font, color:BLACK });
  }

  // ----- build pages -----
  const pages = [];
  let page = pdfDoc.addPage([W,H]);
  pages.push(page);

  let y = drawHeader(page, {isContinued:false});
  y -= 6;

  // Intro sentence
  const buyer = safeStr(row[CONFIG.COLS.buyer]);
  const pre = (side === "buyer")
    ? `CMS Livestock Auction does hereby agree to sell and '${buyer}' does hereby agree to the purchase of the following livestock:`
    : `CMS Livestock Auction does hereby agree to sell and the below Seller does hereby agree to the sale of the following livestock:`;

  {
    const lines = wrapLines(font, pre, 10.4, contentW);
    for(const ln of lines){
      page.drawText(ln, { x:M, y, size:10.4, font, color:BLACK });
      y -= 12.2;
    }
  }

  y -= 6;

  // Seller band + lot detail rows
  y = drawBand(page, y);

  const loads = safeStr(row[CONFIG.COLS.loads]);
  const head  = safeStr(row[CONFIG.COLS.head]);
  const sex   = safeStr(row[CONFIG.COLS.sex]);
  const bw    = safeStr(row[CONFIG.COLS.baseWeight]);

  const loc   = safeStr(row[CONFIG.COLS.location]);
  const shr   = safeStr(row[CONFIG.COLS.shrink]);
  const sld   = safeStr(row[CONFIG.COLS.slide]);
  const price = priceDisplay(row[CONFIG.COLS.price]);

  const del   = safeStr(row[CONFIG.COLS.delivery]);

  // Row 1: Loads | Head | Sex | Base Wt
  y = drawGridRow(page, y, [
    {label:"Loads", value:loads, flex:1},
    {label:"Head", value:head, flex:1},
    {label:"Sex", value:sex, flex:2.2},
    {label:"Base Wt", value:bw, flex:1.1},
  ]);

  // Row 2: Location | Shrink | Slide | Price
  y = drawGridRow(page, y, [
    {label:"Location", value:loc, flex:2.0},
    {label:"Shrink", value:shr, flex:1.0},
    {label:"Slide", value:sld, flex:3.0},
    {label:"Price", value:price, flex:1.2},
  ]);

  // Delivery as its own row (keeps it readable in portrait)
  y = drawFullWidthField(page, y, "Delivery", del);

  y -= 10;

  // Down money box for buyer side (if present)
  const downMoney = downMoneyDisplay(row[CONFIG.COLS.downMoney]);
  if(side === "buyer" && downMoney){
    const dmH = 26;
    page.drawRectangle({
      x: M,
      y: y - dmH,
      width: contentW,
      height: dmH,
      color: rgb(1,1,1),
      borderWidth: 1.0,
      borderColor: GRAY
    });
    const dmText = `Down Money Due: ${downMoney}`;
    page.drawText(dmText, { x:M+8, y:y-17, size:11.2, font:fontBold, color:BLACK });
    y -= dmH + 8;
  }

  // Terms (with automatic page continuation)
  const rawTerms = (side === "buyer") ? CONFIG.CONTRACT_TERMS.buyer : CONFIG.CONTRACT_TERMS.seller;
  const termsText = rawTerms.replace(/\{\{\s*Down Money Due\s*\}\}/g, downMoney);

  let cur = { page, y };
  cur = drawTerms(pages, cur, termsText);

  // Signatures on the LAST page
  drawStackedSignatures(cur.page);

  return await pdfDoc.save();
}

/* ---------------- DOWNLOAD / ZIP ---------------- */

function downloadBytes(bytes, filename, mime="application/pdf"){
  const blob = new Blob([bytes], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
}

function renderList(listEl, items){
  listEl.innerHTML = "";
  for(const it of items){
    const row = document.createElement("div");
    row.className = "listItem";

    const left = document.createElement("div");
    const name = document.createElement("div");
    name.className = "listName";
    name.textContent = it.filename;

    const meta = document.createElement("div");
    meta.className = "listMeta";
    meta.textContent = `${it.count || 1} lot(s)`;

    left.appendChild(name);
    left.appendChild(meta);

    const btn = document.createElement("button");
    btn.className = "btn btnSmall btnGhost";
    btn.textContent = "Download";
    btn.addEventListener("click", () => downloadBytes(it.bytes, it.filename));

    row.appendChild(left);
    row.appendChild(btn);
    listEl.appendChild(row);
  }
}

async function zipItems(items, zipName){
  assertLibsLoaded();
  const zip = new window.JSZip();
  for(const it of items){
    zip.file(it.filename, it.bytes);
  }
  const blob = await zip.generateAsync({type:"blob"});
  downloadBytes(await blob.arrayBuffer(), zipName, "application/zip");
}

/* ---------------- BUILD ---------------- */

function wireBuild(){
  buildBtn.addEventListener("click", async () => {
    hide(builderError);

    try{
      const generated = {
        buyerReports: [],
        consignorReports: [],
        repReports: [],
        lotByLot: [],
        buyerContracts: [],
        sellerContracts: []
      };

      // Buyer Reports
      if(chkBuyer.checked){
        const byBuyer = groupBy(csvRows, CONFIG.COLS.buyer);
        for(const [buyer, rows] of byBuyer.entries()){
          if(!buyer) continue;
          const bytes = await buildSummaryPdf({rows, mode:"buyer"});
          generated.buyerReports.push({
            filename: `${fileSafeName(buyer)} - Buyer Recap.pdf`,
            bytes,
            count: rows.length
          });
        }
      }

      // Consignor Reports
      if(chkConsignor.checked){
        const byCons = groupBy(csvRows, CONFIG.COLS.consignor);
        for(const [consignor, rows] of byCons.entries()){
          if(!consignor) continue;
          const bytes = await buildSummaryPdf({rows, mode:"consignor"});
          generated.consignorReports.push({
            filename: `Contract-${fileSafeName(consignor)}.pdf`,
            bytes,
            count: rows.length
          });
        }
      }

      // Rep Reports
      if(chkRep.checked){
        const byRep = groupBy(csvRows, CONFIG.COLS.rep);
        for(const [rep, rows] of byRep.entries()){
          if(!rep) continue;
          const bytes = await buildSummaryPdf({rows, mode:"rep"});
          generated.repReports.push({
            filename: `Rep-${fileSafeName(rep)}-Contract.pdf`,
            bytes,
            count: rows.length
          });
        }
      }

      // Lot-by-lot detail PDFs
      if(chkLotByLot.checked){
        const sorted = [...csvRows].sort(sortLot);
        for(const r of sorted){
          const contract = safeStr(getContract(r));
          const bytes = await buildLotDetailPdf({row:r});
          generated.lotByLot.push({
            filename: `Contract-Details-${fileSafeName(contract)}.pdf`,
            bytes,
            count: 1
          });
        }
      }

      // Buyer Contracts (one per lot) — filename: ContractNumber-Buyer.pdf
      if(chkBuyerContracts.checked){
        const sorted = [...csvRows].sort(sortLot);
        for(const r of sorted){
          const contract = safeStr(getContract(r));
          const buyer = safeStr(r[CONFIG.COLS.buyer]);
          const bytes = await buildSalesContractPdf({row:r, side:"buyer"});
          generated.buyerContracts.push({
            filename: `${fileSafeName(contract)}-${fileSafeName(buyer)}.pdf`,
            bytes,
            count: 1
          });
        }
      }

      // Seller Contracts (one per lot) — filename: Seller-ContractNumber.pdf
      if(chkSellerContracts.checked){
        const sorted = [...csvRows].sort(sortLot);
        for(const r of sorted){
          const contract = safeStr(getContract(r));
          const seller = safeStr(r[CONFIG.COLS.consignor]);
          const bytes = await buildSalesContractPdf({row:r, side:"seller"});
          generated.sellerContracts.push({
            filename: `${fileSafeName(seller)}-${fileSafeName(contract)}.pdf`,
            bytes,
            count: 1
          });
        }
      }

      // Render
      renderList(listBuyerReports, generated.buyerReports);
      renderList(listConsignorReports, generated.consignorReports);
      renderList(listRepReports, generated.repReports);
      renderList(listLotByLot, generated.lotByLot);
      renderList(listBuyerContracts, generated.buyerContracts);
      renderList(listSellerContracts, generated.sellerContracts);

      // Enable ZIP buttons
      zipBuyerReports.disabled = generated.buyerReports.length === 0;
      zipConsignorReports.disabled = generated.consignorReports.length === 0;
      zipRepReports.disabled = generated.repReports.length === 0;
      zipLotByLot.disabled = generated.lotByLot.length === 0;
      zipBuyerContracts.disabled = generated.buyerContracts.length === 0;
      zipSellerContracts.disabled = generated.sellerContracts.length === 0;

      zipAll.disabled = !(
        generated.buyerReports.length ||
        generated.consignorReports.length ||
        generated.repReports.length ||
        generated.lotByLot.length ||
        generated.buyerContracts.length ||
        generated.sellerContracts.length
      );

      // Wire ZIP actions
      zipBuyerReports.onclick = () => zipItems(generated.buyerReports, "Buyer-Reports.zip");
      zipConsignorReports.onclick = () => zipItems(generated.consignorReports, "Consignor-Reports.zip");
      zipRepReports.onclick = () => zipItems(generated.repReports, "Rep-Reports.zip");
      zipLotByLot.onclick = () => zipItems(generated.lotByLot, "Lot-By-Lot.zip");
      zipBuyerContracts.onclick = () => zipItems(generated.buyerContracts, "Buyer-Contracts.zip");
      zipSellerContracts.onclick = () => zipItems(generated.sellerContracts, "Seller-Contracts.zip");

      zipAll.onclick = async () => {
        const all = [
          ...generated.buyerReports,
          ...generated.consignorReports,
          ...generated.repReports,
          ...generated.lotByLot,
          ...generated.buyerContracts,
          ...generated.sellerContracts
        ];
        await zipItems(all, "All-Reports.zip");
      };

      resultsMeta.textContent = `Generated ${(
        generated.buyerReports.length +
        generated.consignorReports.length +
        generated.repReports.length +
        generated.lotByLot.length +
        generated.buyerContracts.length +
        generated.sellerContracts.length
      ).toLocaleString()} PDF(s).`;

      goto(pageResults);

    }catch(err){
      console.error(err);
      builderError.textContent = err.message;
      show(builderError);
    }
  });
}

/* ---------------- EXIT / NAV ---------------- */

function wireExit(){
  backBtn.addEventListener("click", () => goto(pageBuilder));

  exitBtn.addEventListener("click", () => {
    // Clear everything on exit
    csvRows = [];
    csvFilename = "";
    fileInput.value = "";
    fileMeta.textContent = "";
    hide(fileMeta);

    listBuyerReports.innerHTML = "";
    listConsignorReports.innerHTML = "";
    listRepReports.innerHTML = "";
    listLotByLot.innerHTML = "";
    listBuyerContracts.innerHTML = "";
    listSellerContracts.innerHTML = "";

    zipBuyerReports.disabled = true;
    zipConsignorReports.disabled = true;
    zipRepReports.disabled = true;
    zipLotByLot.disabled = true;
    zipBuyerContracts.disabled = true;
    zipSellerContracts.disabled = true;
    zipAll.disabled = true;

    pinInput.value = "";
    goto(pageAuth);
  });
}

/* ---------------- INIT ---------------- */

function init(){
  try{
    bindDom();
    setupResultsAccordions();
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
