/* ==========================================================
   CMS Post-Auction Portal + Pre-Auction Listings — app.js
   ========================================================== */

console.log("CMS Auction app.js loaded ✅");

const CONFIG = {
  PIN: "0623",

  // POST-AUCTION COLS
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

  // PRE-AUCTION COLS
  PRE_COLS: {
    rep: "Rep",
    consignor: "Consignor",
    lotNumber: "Lot Number",
    option: "Option",
    loads: "# of loads",
    head: "Head",
    breed: "Breed",
    sex: "Sex",
    baseWeight: "Weight",
    delivery: "Delivery",
    location: "Location",
    shrink: "Shrink",
    slide: "Slide",
    description: "Description",
    secondDescription: "Description 2",
    type: "Type",
  },

  CONTRACT_COL_CANDIDATES: [
    "Contract #",
    "Contract",
    "Contract Number",
    "Contract No",
    "Contract No."
  ],

  // Header right block
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
Buyer does hereby agree to payment by wire transfer the day following delivery of the cattle or by overnight carrier at Buyer's expense. Payments if sent overnight shall be sent to: 
CMS Livestock Auction 
6900 I-40 West, Suite 135 
Amarillo, TX 79106. 
The CMS Livestock Auction Video Auction Terms of Service Agreement as stated in auction registration and participation are incorporated by reference into this contract. If a discrepancy between this contract and the CMS Livestock Auction Video Auction Terms of Service Agreement arises, the CMS Livestock Auction Video Auction Terms of Service Agreement  shall take priority.`,

    seller: `All cattle shall be in good physical condition and shall be free of any defects including to but not limited to lameness, crippled, bad eyes, and lump jaws.
Seller agrees to deliver the above-described cattle to Buyer as sold through CMS Livestock Auction on the agreed-upon delivery date. Seller further agrees that once the cattle are sold through CMS Livestock Auction, Seller shall not sell, transfer, or otherwise dispose of the cattle to any party other than the Buyer prior to the delivery date without written consent from CMS Livestock Auction.
Seller represents and warrants that all information provided regarding the cattle, including weight, breed, age, and health status, is accurate to the best of Seller's knowledge.
Seller does hereby warrant that all cattle shall have clear title and be free of any and all encumbrances.  
The CMS Livestock Auction Seller's Terms of Service Agreement as signed prior to the auction are incorporated by reference into this contract. If a discrepancy between this contract and the CMS Livestock Auction Seller's Terms of Service Agreement arises, the CMS Livestock Auction Seller's Terms of Service Agreement shall take priority.`
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
    highlightBg: [0.95, 0.95, 0.95], // Light gray for highlighting
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
let chkPreConsignor, chkPreRep;
let chkShowCmsNotes;
let chkSalesByConsignor, chkSalesByBuyer, chkSalesByRep, chkCompleteBuyer, chkCompleteConsignor, chkAuctionRecap;
let buildBtn, builderError;

let csvPreview, csvPreviewContent;

let listBuyerReports, listLotByLot, listConsignorReports, listRepReports;
let listBuyerContracts, listSellerContracts;
let listPreConsignorReports, listPreRepReports;
let listSalesByConsignor, listSalesByBuyer, listSalesByRep;
let listCompleteBuyer, listCompleteConsignor, listAuctionRecap;

let zipBuyerReports, zipLotByLot, zipConsignorReports, zipRepReports, zipAll;
let zipBuyerContracts, zipSellerContracts;
let zipPreConsignorReports, zipPreRepReports;
let zipSalesByConsignor, zipSalesByBuyer, zipSalesByRep, zipSpecialReports;

let togBuyerReports, togLotByLot, togBuyerContracts, togSellerContracts, togConsignorReports, togRepReports;
let togPreConsignorReports, togPreRepReports;
let togSalesByConsignor, togSalesByBuyer, togSalesByRep;
let togCompleteBuyer, togCompleteConsignor, togAuctionRecap;

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

  chkPreConsignor = mustGet("chkPreConsignor");
  chkPreRep = mustGet("chkPreRep");

  chkShowCmsNotes = mustGet("chkShowCmsNotes");

  chkSalesByConsignor = mustGet("chkSalesByConsignor");
  chkSalesByBuyer = mustGet("chkSalesByBuyer");
  chkSalesByRep = mustGet("chkSalesByRep");
  chkCompleteBuyer = mustGet("chkCompleteBuyer");
  chkCompleteConsignor = mustGet("chkCompleteConsignor");
  chkAuctionRecap = mustGet("chkAuctionRecap");

  buildBtn = mustGet("buildBtn");
  builderError = mustGet("builderError");

  csvPreview = mustGet("csvPreview");
  csvPreviewContent = mustGet("csvPreviewContent");

  listBuyerReports = mustGet("listBuyerReports");
  listLotByLot = mustGet("listLotByLot");
  listConsignorReports = mustGet("listConsignorReports");
  listRepReports = mustGet("listRepReports");
  listBuyerContracts = mustGet("listBuyerContracts");
  listSellerContracts = mustGet("listSellerContracts");

  listPreConsignorReports = mustGet("listPreConsignorReports");
  listPreRepReports = mustGet("listPreRepReports");

  listSalesByConsignor = mustGet("listSalesByConsignor");
  listSalesByBuyer = mustGet("listSalesByBuyer");
  listSalesByRep = mustGet("listSalesByRep");
  listCompleteBuyer = mustGet("listCompleteBuyer");
  listCompleteConsignor = mustGet("listCompleteConsignor");
  listAuctionRecap = mustGet("listAuctionRecap");

  zipBuyerReports = mustGet("zipBuyerReports");
  zipLotByLot = mustGet("zipLotByLot");
  zipBuyerContracts = mustGet("zipBuyerContracts");
  zipSellerContracts = mustGet("zipSellerContracts");
  zipConsignorReports = mustGet("zipConsignorReports");
  zipRepReports = mustGet("zipRepReports");

  zipPreConsignorReports = mustGet("zipPreConsignorReports");
  zipPreRepReports = mustGet("zipPreRepReports");
  
  zipSalesByConsignor = mustGet("zipSalesByConsignor");
  zipSalesByBuyer = mustGet("zipSalesByBuyer");
  zipSalesByRep = mustGet("zipSalesByRep");
  zipSpecialReports = mustGet("zipSpecialReports");
  
  zipAll = mustGet("zipAll");

  togBuyerReports = mustGet("togBuyerReports");
  togLotByLot = mustGet("togLotByLot");
  togBuyerContracts = mustGet("togBuyerContracts");
  togSellerContracts = mustGet("togSellerContracts");
  togConsignorReports = mustGet("togConsignorReports");
  togRepReports = mustGet("togRepReports");

  togPreConsignorReports = mustGet("togPreConsignorReports");
  togPreRepReports = mustGet("togPreRepReports");

  togSalesByConsignor = mustGet("togSalesByConsignor");
  togSalesByBuyer = mustGet("togSalesByBuyer");
  togSalesByRep = mustGet("togSalesByRep");
  togCompleteBuyer = mustGet("togCompleteBuyer");
  togCompleteConsignor = mustGet("togCompleteConsignor");
  togAuctionRecap = mustGet("togAuctionRecap");

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
  preConsignorReports: [],
  preRepReports: [],
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
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
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

// Helper to check for Representative or Rep column
function getRepColumn(row){
  if(row[CONFIG.COLS.rep]) return row[CONFIG.COLS.rep];
  if(row[CONFIG.PRE_COLS.rep]) return row[CONFIG.PRE_COLS.rep];
  return "";
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

// Pre-auction lot number logic
function getPreLotNumber(row){
  const lotNum = safeStr(row[CONFIG.PRE_COLS.lotNumber]);
  if(lotNum) return lotNum;
  
  const option = safeStr(row[CONFIG.PRE_COLS.option]);
  if(option) return option;
  
  return "TBD";
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

/* ---------------- TYPE COLOR ---------------- */
function pickTypeColorHex(row, isPre = false){
  const typeKey = isPre ? CONFIG.PRE_COLS.type : CONFIG.COLS.type;
  const breedKey = isPre ? CONFIG.PRE_COLS.breed : CONFIG.COLS.breed;
  const descKey = isPre ? CONFIG.PRE_COLS.description : CONFIG.COLS.description;

  const type = safeStr(row[typeKey]).toLowerCase();
  const desc = safeStr(row[descKey]).toLowerCase();
  const breed = safeStr(row[breedKey]).toLowerCase();
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

/* ---------------- DROPZONE ---------------- */
function wireDropZone({zoneEl, inputEl, onFile, metaEl}){
  zoneEl.addEventListener("dragover", (e)=>{ e.preventDefault(); zoneEl.classList.add("dragover"); });
  zoneEl.addEventListener("dragleave", ()=> zoneEl.classList.remove("dragover"));
  zoneEl.addEventListener("drop", (e)=>{
    e.preventDefault();
    zoneEl.classList.remove("dragover");
    const f = e.dataTransfer.files?.[0];
    if(f){ inputEl.value = ""; onFile(f); }
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

function setBuildEnabled(){
  const anyChecked =
    chkBuyer.checked ||
    chkConsignor.checked ||
    chkRep.checked ||
    chkLotByLot.checked ||
    chkBuyerContracts.checked ||
    chkSellerContracts.checked ||
    chkPreConsignor.checked ||
    chkPreRep.checked;

  buildBtn.disabled = !(csvRows.length > 0 && anyChecked);
  
  // Update CSV preview
  updateCsvPreview();
}

function updateCsvPreview(){
  if(csvRows.length === 0 || !anyChecked()){
    hide(csvPreview);
    return;
  }

  const counts = {
    buyerReports: 0,
    lotByLot: 0,
    buyerContracts: 0,
    sellerContracts: 0,
    consignorReports: 0,
    repReports: 0,
    preConsignorReports: 0,
    preRepReports: 0
  };

  // Count unique entities
  if(chkBuyer.checked){
    const buyers = new Set(csvRows.map(r => safeStr(r[CONFIG.COLS.buyer])).filter(Boolean));
    counts.buyerReports = buyers.size;
  }

  if(chkLotByLot.checked || chkBuyerContracts.checked || chkSellerContracts.checked){
    const contracts = csvRows.filter(r => getContract(r)).length;
    if(chkLotByLot.checked) counts.lotByLot = contracts;
    if(chkBuyerContracts.checked) counts.buyerContracts = contracts;
    if(chkSellerContracts.checked) counts.sellerContracts = contracts;
  }

  if(chkConsignor.checked){
    const consignors = new Set(csvRows.map(r => safeStr(r[CONFIG.COLS.consignor])).filter(Boolean));
    counts.consignorReports = consignors.size;
  }

  if(chkRep.checked){
    const reps = new Set(csvRows.map(r => getRepColumn(r)).filter(Boolean));
    counts.repReports = reps.size;
  }

  if(chkPreConsignor.checked){
    const consignors = new Set(csvRows.map(r => safeStr(r[CONFIG.PRE_COLS.consignor])).filter(Boolean));
    counts.preConsignorReports = consignors.size;
  }

  if(chkPreRep.checked){
    const reps = new Set(csvRows.map(r => safeStr(r[CONFIG.PRE_COLS.rep])).filter(Boolean));
    counts.preRepReports = reps.size;
  }

  // Build preview HTML
  const lines = [];
  lines.push(`✓ CSV loaded: <b>${csvRows.length} rows</b>`);
  lines.push(`✓ Will generate:`);
  
  const items = [];
  if(counts.buyerReports) items.push(`${counts.buyerReports} Buyer Report${counts.buyerReports > 1 ? 's' : ''}`);
  if(counts.lotByLot) items.push(`${counts.lotByLot} Contract Detail${counts.lotByLot > 1 ? 's' : ''}`);
  if(counts.buyerContracts) items.push(`${counts.buyerContracts} Buyer Contract${counts.buyerContracts > 1 ? 's' : ''}`);
  if(counts.sellerContracts) items.push(`${counts.sellerContracts} Seller Contract${counts.sellerContracts > 1 ? 's' : ''}`);
  if(counts.consignorReports) items.push(`${counts.consignorReports} Consignor Trade Confirmation${counts.consignorReports > 1 ? 's' : ''}`);
  if(counts.repReports) items.push(`${counts.repReports} Rep Trade Confirmation${counts.repReports > 1 ? 's' : ''}`);
  if(counts.preConsignorReports) items.push(`${counts.preConsignorReports} Consignor Listing Confirmation${counts.preConsignorReports > 1 ? 's' : ''}`);
  if(counts.preRepReports) items.push(`${counts.preRepReports} Rep Listing Confirmation${counts.preRepReports > 1 ? 's' : ''}`);

  items.forEach(item => lines.push(`&nbsp;&nbsp;• ${item}`));

  csvPreviewContent.innerHTML = lines.join('<br>');
  show(csvPreview);
}

function anyChecked(){
  return chkBuyer.checked ||
    chkConsignor.checked ||
    chkRep.checked ||
    chkLotByLot.checked ||
    chkBuyerContracts.checked ||
    chkSellerContracts.checked ||
    chkPreConsignor.checked ||
    chkPreRep.checked;
}

/* ---------------- SECTION SELECT/DESELECT ---------------- */

/* ---------------- RESULTS DROPDOWNS ---------------- */
function wireResultsDropdowns(){
  const pairs = [
    [togBuyerReports, listBuyerReports],
    [togLotByLot, listLotByLot],
    [togBuyerContracts, listBuyerContracts],
    [togSellerContracts, listSellerContracts],
    [togConsignorReports, listConsignorReports],
    [togRepReports, listRepReports],
    [togPreConsignorReports, listPreConsignorReports],
    [togPreRepReports, listPreRepReports],
    [togSalesByConsignor, listSalesByConsignor],
    [togSalesByBuyer, listSalesByBuyer],
    [togSalesByRep, listSalesByRep],
    [togCompleteBuyer, listCompleteBuyer],
    [togCompleteConsignor, listCompleteConsignor],
    [togAuctionRecap, listAuctionRecap],
  ];

  for(const [btn, list] of pairs){
    const sync = () => {
      const collapsed = list.classList.contains("collapsed");
      btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    };
    btn.addEventListener("click", ()=>{
      list.classList.toggle("collapsed");
      sync();
    });
    sync();
  }
}

/* ---------------- CSV ---------------- */
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

      // Don't require specific columns - just load it
      contractColName = detectContractColumn(csvRows);
      
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


/* =========================================================================
   PDF: PRE-AUCTION LISTING CONFIRMATIONS (Consignor / Rep)
   PRICE COLUMN REMOVED
   ========================================================================= */
async function buildPreAuctionListingPdf({entityName, rows, mode, showCmsNotes=false}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const BLACK = rgb(0,0,0);

  const topBarHex = mode === "consignor" ? CONFIG.COLORS.consignorColor : CONFIG.COLORS.repBar;
  const topBarColor = rgb(...hexToRgb01(topBarHex));

  const W = CONFIG.PDF.pageSize.width;
  const H = CONFIG.PDF.pageSize.height;
  const M = CONFIG.PDF.margin;
  const bottomLimit = CONFIG.PDF.bottomLimit;
  const contentW = W - 2*M;

  // Removed price column from pre-auction
  const colDefs = [
    { key: "loads", label: "Loads",   w: 50 },
    { key: "head",  label: "Head",    w: 50 },
    { key: "sex",   label: "Sex",     w: 80 },
    { key: "bw",    label: "Base Wt", w: 75 },
    { key: "del",   label: "Delivery",w: 150 },
    { key: "loc",   label: "Location",w: 120 },
    { key: "shr",   label: "Shrink",  w: 55 },
    { key: "sld",   label: "Slide",   w: 160 },
  ];
  const gridW = colDefs.reduce((s,c)=>s+c.w,0);

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  const leftLabel = mode === "consignor" ? "Consignor" : "Rep";
  const docTitle = "Listing Confirmations";
  const nameSize = CONFIG.PDF.otherNameSize;

  let page = pdfDoc.addPage([W,H]);
  let pageIndex = 0;
  let y = H - M;

  function drawTopBar(){
    page.drawRectangle({ x: 0, y: H - CONFIG.PDF.topBarH, width: W, height: CONFIG.PDF.topBarH, color: topBarColor });
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

    page.drawText(`${leftLabel}: ${safeStr(entityName)}`, { x: lx, y: topY, size: nameSize, font: fontBold, color: BLACK });

    drawRightHeaderBlockAligned(rx, topY);

    if(pageIndex === 0){
      page.drawText(safeStr(auctionTitle), { x: lx, y: topY - 18, size: 10.0, font, color: BLACK });
      if(aDate){
        page.drawText(safeStr(aDate), { x: lx, y: topY - 30, size: 10.0, font, color: BLACK });
      }
      page.drawText(docTitle, { x: lx, y: topY - 54, size: CONFIG.PDF.title, font: fontBold, color: BLACK });
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

  function computeGridWrapped(record){
    const values = {
      loads: safeStr(record[CONFIG.PRE_COLS.loads]) || "0",
      head:  safeStr(record[CONFIG.PRE_COLS.head])  || "0",
      sex:   safeStr(record[CONFIG.PRE_COLS.sex]),
      bw:    safeStr(record[CONFIG.PRE_COLS.baseWeight]),
      del:   safeStr(record[CONFIG.PRE_COLS.delivery]),
      loc:   safeStr(record[CONFIG.PRE_COLS.location]),
      shr:   safeStr(record[CONFIG.PRE_COLS.shrink]),
      sld:   safeStr(record[CONFIG.PRE_COLS.slide]),
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
    const desc = safeStr(record[CONFIG.PRE_COLS.description]);
    const desc2 = safeStr(record[CONFIG.PRE_COLS.secondDescription]);
    const notesText = [desc, desc2].filter(Boolean).join("  |  ");
    const notesLine = safeStr(`Notes: ${notesText}`);
    const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
    const regularLines = wrapLines(font, notesLine, CONFIG.PDF.notes, maxW);
    
    // For rep mode, add CMS Internal Notes below (bold) - ONLY if showCmsNotes is enabled
    // Pre-auction CSVs may not have this column, so check if it exists
    const cmsNotes = (mode === "rep" && showCmsNotes && record[CONFIG.COLS.cmsInternalNotes]) 
      ? safeStr(record[CONFIG.COLS.cmsInternalNotes]) 
      : "";
    
    return { regularLines, cmsNotes };
  }

  function lotBlockHeight(record){
    const row1H = 32;
    const labelH = 14;

    const { maxLines } = computeGridWrapped(record);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    const { regularLines, cmsNotes } = computeNotesLines(record);
    let notesLineCount = regularLines.length;
    
    // Add lines for CMS Internal Notes if present (rep mode)
    if(cmsNotes){
      const cmsText = `CMS Internal Notes: ${cmsNotes}`;
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, cmsText, CONFIG.PDF.notes, maxW);
      notesLineCount += cmsLines.length;
    }
    
    const notesH = 8 + (notesLineCount * CONFIG.PDF.notesLineH) + 2;

    return row1H + gridH + notesH + CONFIG.PDF.lotGap;
  }

  function ensureRoom(record){
    const need = lotBlockHeight(record);
    if((y - need) < bottomLimit) newPage();
  }

  function drawLotHeaderRow({textLeft, fillHex=null}){
    const fill = fillHex ? rgb(...hexToRgb01(fillHex)) : rgb(1,1,1);
    const textColor = fillHex ? rgb(...CONFIG.COLORS.textWhite) : BLACK;

    const row1H = 32;
    page.drawRectangle({
      x: M, y: y - row1H,
      width: contentW, height: row1H,
      color: fill,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: rgb(0.55, 0.55, 0.55)
    });

    page.drawText(textLeft, { x: M + CONFIG.PDF.padX, y: y - 14, size: CONFIG.PDF.lotTitle, font: fontBold, color: textColor });
    return row1H;
  }

  function drawCenteredLines(lines, xCenter, yTop, lineH, size){
    let yy = yTop;
    for(const ln of lines){
      const w = font.widthOfTextAtSize(ln || "", size);
      page.drawText(ln, { x: xCenter - w/2, y: yy, size, font, color: BLACK });
      yy -= lineH;
    }
  }

  function drawLotBlock(r){
    const lotNum = getPreLotNumber(r);
    const consignor = safeStr(r[CONFIG.PRE_COLS.consignor]);
    const breed = safeStr(r[CONFIG.PRE_COLS.breed]) || safeStr(r[CONFIG.PRE_COLS.description]);

    let headerFillHex = null;
    if(mode === "rep"){
      const idx = hashIndex(consignor, CONFIG.REP_CONSIGNOR_PALETTE.length);
      headerFillHex = CONFIG.REP_CONSIGNOR_PALETTE[idx];
    } else if(mode === "consignor"){
      headerFillHex = pickTypeColorHex(r, true);
    }

    const topLine = `Lot # ${lotNum} - ${consignor}`;
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
        page.drawLine({ start:{x:cx, y:y}, end:{x:cx, y:y-gridH}, thickness: CONFIG.PDF.innerW, color: rgb(0.55,0.55,0.55) });
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

    const { regularLines, cmsNotes } = computeNotesLines(r);
    let notesLineCount = regularLines.length;
    if(cmsNotes){
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, `CMS Internal Notes: ${cmsNotes}`, CONFIG.PDF.notes, maxW);
      notesLineCount += cmsLines.length;
    }
    
    const notesH = 8 + (notesLineCount * CONFIG.PDF.notesLineH) + 2;
    page.drawRectangle({ x:M, y:y-notesH, width:contentW, height:notesH, color: rgb(1,1,1), borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });

    let ny = y - 12;
    
    // Draw regular notes
    for(const ln of regularLines){
      page.drawText(ln, { x:M + CONFIG.PDF.padX, y:ny, size: CONFIG.PDF.notes, font, color: BLACK });
      ny -= CONFIG.PDF.notesLineH;
    }
    
    // Draw CMS Internal Notes (bold) for rep mode
    if(cmsNotes){
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, `CMS Internal Notes: ${cmsNotes}`, CONFIG.PDF.notes, maxW);
      for(const ln of cmsLines){
        page.drawText(ln, { x:M + CONFIG.PDF.padX, y:ny, size: CONFIG.PDF.notes, font: fontBold, color: BLACK });
        ny -= CONFIG.PDF.notesLineH;
      }
    }
    
    y -= notesH;

    y -= CONFIG.PDF.lotGap;
  }

  // Keep CSV order for pre-auction
  const sorted = [...rows];
  for(const r of sorted){
    ensureRoom(r);
    drawLotBlock(r);
  }

  return await pdfDoc.save();
}


/* =========================================================================
   PDF: POST-AUCTION GROUP + CONTRACT DETAILS (LANDSCAPE - unchanged)
   ========================================================================= */
async function buildPdfForGroup({entityName, rows, mode, singleLotMode=false, forceBuyerName=null, headerRightBig=null, showCmsNotes=false}){
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
    { key: "sex",   label: "Sex",     w: 80 },
    { key: "bw",    label: "Base Wt", w: 75 },
    { key: "del",   label: "Delivery",w: 150 },
    { key: "loc",   label: "Location",w: 110 },
    { key: "shr",   label: "Shrink",  w: 48 },
    { key: "sld",   label: "Slide",   w: 134 },
    { key: "price", label: "Price",   w: 53 },
  ];
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

  let page = pdfDoc.addPage([W,H]);
  let pageIndex = 0;
  let y = H - M;

  function drawTopBar(){
    page.drawRectangle({ x: 0, y: H - CONFIG.PDF.topBarH, width: W, height: CONFIG.PDF.topBarH, color: topBarColor });
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
      page.drawText(`${leftLabel}: ${leftName}`, { x: lx, y: topY, size: nameSize, font: fontBold, color: BLACK });
    }

    const isContractDetailsFirstPage = (singleLotMode && pageIndex === 0 && !!headerRightBig);
    if(!isContractDetailsFirstPage){
      drawRightHeaderBlockAligned(rx, topY);
    }

    if(pageIndex === 0){
      if(singleLotMode){
        page.drawText(docTitle, { x: lx, y: topY - 20, size: 12.2, font: fontBold, color: BLACK });
        page.drawText(safeStr(auctionTitle), { x: lx, y: topY - 38, size: 10.0, font, color: BLACK });
        if(aDate){
          page.drawText(safeStr(aDate), { x: lx, y: topY - 50, size: 10.0, font, color: BLACK });
        }

        if(headerRightBig){
          const DROP = 44;
          const t = safeStr(headerRightBig);
          const s = 17.5;
          const w = fontBold.widthOfTextAtSize(t, s);
          page.drawText(t, { x: rx - w, y: topY + 18 - DROP, size: s, font: fontBold, color: BLACK });
          drawRightHeaderBlockAligned(rx, topY - DROP);
        }
      } else {
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
    const notesLine = safeStr(`Notes: ${notesText}`);
    const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
    const regularLines = wrapLines(font, notesLine, CONFIG.PDF.notes, maxW);
    
    // For rep mode, add CMS Internal Notes below (bold) - ONLY if showCmsNotes is enabled
    const cmsNotes = (mode === "rep" && showCmsNotes) ? safeStr(record[CONFIG.COLS.cmsInternalNotes]) : "";
    
    return { regularLines, cmsNotes };
  }

  function drawSingleLotBuyerAndRepBlock(r){
    const buyer = safeStr(r[CONFIG.COLS.buyer]);
    const rep = getRepColumn(r);
    let used = 0;

    if(buyer){
      page.drawText(`Buyer: ${buyer}`, { x: M, y: y - 12, size: 12.2, font: fontBold, color: BLACK });
      used += 14;
    }
    if(rep){
      page.drawText(`Rep: ${rep}`, { x: M, y: y - 12 - used, size: 10.6, font, color: BLACK });
      used += 14;
    }

    used += 10;
    y -= Math.max(0, used);
  }

  function drawDownMoneyReceivedBlock(){
    const rowY = y - 14;
    const box = 12;
    const boxY = rowY - (box/2) + 4;

    page.drawRectangle({
      x: M, y: boxY, width: box, height: box,
      borderWidth: 1.0, borderColor: BLACK,
      color: rgb(1,1,1)
    });

    const labelX = M + box + 8;
    page.drawText("Down Money Received", { x: labelX, y: rowY, size: 10.2, font: fontBold, color: BLACK });

    const lineY = rowY - 2;
    const initialsX = M + 305;
    const dateX = M + 505;

    page.drawText("Initials:", { x: initialsX - 52, y: rowY, size: 9.6, font, color: BLACK });
    page.drawLine({ start:{x: initialsX, y: lineY}, end:{x: initialsX + 96, y: lineY}, thickness:1.0, color: BLACK });

    page.drawText("Date:", { x: dateX - 34, y: rowY, size: 9.6, font, color: BLACK });
    page.drawLine({ start:{x: dateX, y: lineY}, end:{x: dateX + 110, y: lineY}, thickness:1.0, color: BLACK });

    y = rowY - 18;
  }

  function drawCmsInternalNotesIfAny(r){
    const n = safeStr(r[CONFIG.COLS.cmsInternalNotes]);
    if(!n) return;

    y -= 26;

    const label = "CMS Internal Notes: ";
    const size = 10.0;

    const labelW = fontBold.widthOfTextAtSize(label, size);
    const maxW = (W - 2*M) - labelW;
    const lines = wrapLines(fontBold, n, size, maxW);

    let yy = y - 10;

    page.drawText(label, { x: M, y: yy, size, font: fontBold, color: BLACK });
    page.drawText(lines[0] || "", { x: M + labelW, y: yy, size, font: fontBold, color: BLACK });
    yy -= 12;

    for(let i=1;i<lines.length;i++){
      page.drawText(lines[i], { x: M + labelW, y: yy, size, font: fontBold, color: BLACK });
      yy -= 12;
    }

    y = yy;
  }

  function lotBlockHeight(record){
    const row1H = 32;
    const labelH = 14;

    const { maxLines } = computeGridWrapped(record);
    const valueH = CONFIG.PDF.cellPadY + (maxLines * CONFIG.PDF.gridLineH) + 2;
    const gridH = labelH + valueH;

    const { regularLines, cmsNotes } = computeNotesLines(record);
    let notesLineCount = regularLines.length;
    
    // Add lines for CMS Internal Notes if present (rep mode)
    if(cmsNotes){
      const cmsText = `CMS Internal Notes: ${cmsNotes}`;
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, cmsText, CONFIG.PDF.notes, maxW);
      notesLineCount += cmsLines.length;
    }
    
    const notesH = 8 + (notesLineCount * CONFIG.PDF.notesLineH) + 2;

    const dmRowH = (mode === "buyer") ? 18 : 0;
    const preLinesH = singleLotMode ? 40 : 0;

    const dm = toNumber(record[CONFIG.COLS.downMoney]);
    const receivedBlockH = (singleLotMode && dm > 0) ? 26 : 0;
    const internalNotesH = (singleLotMode && safeStr(record[CONFIG.COLS.cmsInternalNotes])) ? 44 : 0;

    return preLinesH + row1H + gridH + notesH + dmRowH + receivedBlockH + internalNotesH + CONFIG.PDF.lotGap;
  }

  function ensureRoom(record){
    const need = lotBlockHeight(record);
    if((y - need) < bottomLimit) newPage();
  }

  function drawLotHeaderRow({textLeft, fillHex=null}){
    const fill = fillHex ? rgb(...hexToRgb01(fillHex)) : rgb(1,1,1);
    const textColor = fillHex ? rgb(...CONFIG.COLORS.textWhite) : BLACK;

    const row1H = 32;
    page.drawRectangle({
      x: M, y: y - row1H,
      width: contentW, height: row1H,
      color: fill,
      borderWidth: CONFIG.PDF.borderW,
      borderColor: rgb(0.55, 0.55, 0.55)
    });

    page.drawText(textLeft, { x: M + CONFIG.PDF.padX, y: y - 14, size: CONFIG.PDF.lotTitle, font: fontBold, color: textColor });
    return row1H;
  }

  function drawCenteredLines(lines, xCenter, yTop, lineH, size){
    let yy = yTop;
    for(const ln of lines){
      const w = font.widthOfTextAtSize(ln || "", size);
      page.drawText(ln, { x: xCenter - w/2, y: yy, size, font, color: BLACK });
      yy -= lineH;
    }
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
        page.drawLine({ start:{x:cx, y:y}, end:{x:cx, y:y-gridH}, thickness: CONFIG.PDF.innerW, color: rgb(0.55,0.55,0.55) });
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

    const { regularLines, cmsNotes } = computeNotesLines(r);
    let notesLineCount = regularLines.length;
    if(cmsNotes){
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, `CMS Internal Notes: ${cmsNotes}`, CONFIG.PDF.notes, maxW);
      notesLineCount += cmsLines.length;
    }
    
    const notesH = 8 + (notesLineCount * CONFIG.PDF.notesLineH) + 2;
    page.drawRectangle({ x:M, y:y-notesH, width:contentW, height:notesH, color: rgb(1,1,1), borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });

    let ny = y - 12;
    
    // Draw regular notes
    for(const ln of regularLines){
      page.drawText(ln, { x:M + CONFIG.PDF.padX, y:ny, size: CONFIG.PDF.notes, font, color: BLACK });
      ny -= CONFIG.PDF.notesLineH;
    }
    
    // Draw CMS Internal Notes (bold) for rep mode
    if(cmsNotes){
      const maxW = (W - 2*M) - 2*CONFIG.PDF.padX;
      const cmsLines = wrapLines(fontBold, `CMS Internal Notes: ${cmsNotes}`, CONFIG.PDF.notes, maxW);
      for(const ln of cmsLines){
        page.drawText(ln, { x:M + CONFIG.PDF.padX, y:ny, size: CONFIG.PDF.notes, font: fontBold, color: BLACK });
        ny -= CONFIG.PDF.notesLineH;
      }
    }
    
    y -= notesH;

    if(mode === "buyer"){
      const dmRowH = 18;
      const dm = downMoneyDisplay(r[CONFIG.COLS.downMoney]);
      page.drawRectangle({ x:M, y:y-dmRowH, width:contentW, height:dmRowH, color: FILL, borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });
      page.drawText(`Down Money Due: ${dm}`, { x:M + CONFIG.PDF.padX, y:y-13, size: 10.0, font: fontBold, color: BLACK });
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

  // Buyer footer
  if(mode === "buyer" && !singleLotMode){
    const footerNeed = CONFIG.PDF.footerMinH + 36;
    if(y < bottomLimit + footerNeed) newPage();

    const totalBoxW = 270;
    const totalBoxH = 22;
    const totalX = M + contentW - totalBoxW;
    const totalY = y - totalBoxH;

    page.drawRectangle({ x: totalX, y: totalY, width: totalBoxW, height: totalBoxH, color: rgb(1,1,1), borderWidth: CONFIG.PDF.borderW, borderColor: rgb(0.55,0.55,0.55) });

    const totalText = `Total Down Money Due: ${formatMoney(buyerDownMoneyTotal)}`;
    let ts = 10.6;
    while(ts > 8.6 && fontBold.widthOfTextAtSize(totalText, ts) > (totalBoxW - 12)) ts -= 0.2;

    page.drawText(totalText, { x: totalX + 6, y: totalY + 6, size: ts, font: fontBold, color: BLACK });
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

    page.drawText(footerHeader, { x: M, y: y, size: 8.2, font: fontBold, color: BLACK });
    y -= (CONFIG.PDF.footerLineH + 4);

    let ly = y;
    for(const ln of leftLines){
      page.drawText(ln, { x: leftX, y: ly, size: 7.9, font, color: BLACK });
      ly -= CONFIG.PDF.footerLineH;
    }

    let ry = y;
    for(const ln of rightLines){
      page.drawText(ln, { x: rightX, y: ry, size: 7.9, font, color: BLACK });
      ry -= CONFIG.PDF.footerLineH;
    }
  }

  return await pdfDoc.save();
}


/* =========================================================================
   PDF: BUYER/SELLER CONTRACTS — PORTRAIT, TABLE LAYOUT
   - Portrait 8.5×11
   - Optimized for single-page fit
   - Terms section restructured (no separate Terms header)
   - Location: FOB, City format
   - Price with full border box
   - Tight spacing throughout
   ========================================================================= */
async function buildSalesContractPdf({row, side}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Portrait 8.5×11
  const W = 612;
  const H = 792;
  const M = 36;
  const contentW = W - 2*M;

  // Seller contracts use consignor color for top bar
  const topBarHex = (side === "seller") ? CONFIG.COLORS.consignorColor : CONFIG.COLORS.cmsBlue;
  const topBarColor  = rgb(...hexToRgb01(topBarHex));
  
  const BLACK        = rgb(0, 0, 0);
  const DARK_GRAY    = rgb(0.3, 0.3, 0.3);
  const GRAY         = rgb(0.55, 0.55, 0.55);
  const SECTION_BG   = rgb(0.94, 0.94, 0.94);
  const HIGHLIGHT_BG = rgb(...CONFIG.COLORS.highlightBg);
  const WHITE        = rgb(1, 1, 1);

  // ---- Data ----
  const contract       = safeStr(getContract(row));
  const lotNumber      = safeStr(row[CONFIG.COLS.lotNumber]);
  const buyer          = safeStr(row[CONFIG.COLS.buyer]);
  const consignor      = safeStr(row[CONFIG.COLS.consignor]);
  const rep            = getRepColumn(row);
  const downMoneyAmt   = toNumber(row[CONFIG.COLS.downMoney]);
  const downMoney      = downMoneyDisplay(row[CONFIG.COLS.downMoney]);
  const breed          = safeStr(row[CONFIG.COLS.breed]) || safeStr(row[CONFIG.COLS.description]);
  const loads          = safeStr(row[CONFIG.COLS.loads])      || "0";
  const head           = safeStr(row[CONFIG.COLS.head])       || "0";
  const sex            = safeStr(row[CONFIG.COLS.sex]);
  const bw             = safeStr(row[CONFIG.COLS.baseWeight]);
  const del            = safeStr(row[CONFIG.COLS.delivery]);
  const loc            = safeStr(row[CONFIG.COLS.location]);
  const shr            = safeStr(row[CONFIG.COLS.shrink]);
  const sld            = safeStr(row[CONFIG.COLS.slide]);
  const price          = priceDisplay(row[CONFIG.COLS.price]);

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra            = safeStr(auctionLabel.value);
  const auctionTitle     = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate            = safeStr(auctionDate.value) || "";

  // ---- Table geometry (tightened for single-page fit) ----
  const tableW  = contentW;
  const labelW  = 130;
  const valueW  = tableW - labelW;
  const secH    = 16;   // section header (reduced from 18)
  const dataH   = 15;   // data row height (reduced from 17)
  const padX    = 8;
  const termsLineH = 10.5;  // tighter (was 11.5)
  const paraGap    = 2;     // tighter (was 3)

  // ---- Helper: draw page header ----
  function drawPageHeader(pg, pageNum){
    pg.drawRectangle({ x:0, y:H-8, width:W, height:8, color: topBarColor });

    const topY = H - 8 - 28;

    // Left: "Cattle Sales Contract"
    pg.drawText("Cattle Sales Contract", {
      x: M, y: topY, size: 18, font: fontBold, color: BLACK
    });

    // Right: Contract #
    const cnText = `Contract #: ${contract}`.trim();
    const cnW    = fontBold.widthOfTextAtSize(cnText, 16);
    pg.drawText(cnText, {
      x: M + contentW - cnW, y: topY, size: 16, font: fontBold, color: BLACK
    });

    // Page 1: Company address right-aligned
    // Page 2+: Simple header
    if(pageNum === 1){
      const addrLines = [
        "CMS Livestock Auction",  // Changed from CMS Orita Calf Auctions
        "6900 I-40 West, Suite 135",
        "Amarillo, TX 79106",
        "(806) 355-7505"
      ];
      let ay = topY - 14;
      const addrX = M + contentW;
      pg.drawText(addrLines[0], { x: addrX - fontBold.widthOfTextAtSize(addrLines[0],9.6), y:ay, size:9.6, font:fontBold, color:BLACK });
      for(let i=1;i<addrLines.length;i++){
        ay -= 11;
        pg.drawText(addrLines[i], { x: addrX - font.widthOfTextAtSize(addrLines[i],9.2), y:ay, size:9.2, font, color:BLACK });
      }

      // Auction info (left)
      let lY = topY - 18;
      pg.drawText(safeStr(auctionTitle), { x:M, y:lY, size:9.8, font, color:BLACK });
      lY -= 12;
      if(aDate){ pg.drawText(safeStr(aDate), { x:M, y:lY, size:9.8, font, color:BLACK }); lY -= 12; }
    } else {
      // Page 2+ header: simple centered text
      const hdrText = "CMS Livestock Auction\n6900 I-40 West, Suite 135\nAmarillo, TX 79106\n(806) 355-7505";
      const lines = hdrText.split('\n');
      let hy = topY - 14;
      for(const ln of lines){
        const lw = font.widthOfTextAtSize(ln, 9);
        pg.drawText(ln, { x: W/2 - lw/2, y: hy, size: 9, font, color: BLACK });
        hy -= 11;
      }
    }

    // Page number on page 2+
    if(pageNum > 1){
      const pnText = `Page ${pageNum}`;
      const pnW = font.widthOfTextAtSize(pnText, 9);
      pg.drawText(pnText, { x: W/2 - pnW/2, y: 20, size:9, font, color:GRAY });
    }

    return pageNum === 1 ? (H - 8 - 110) : (H - 8 - 80);
  }

  // ---- MEASURE table height (data rows may be multiline) ----
  // Restructured: Quantity & Description, then Terms (with Delivery, Location, Shrink, Slide)
  const tableData = [
    { section: "Quantity & Description" },
    { label: "Loads:",        value: loads },
    { label: "Head Count:",   value: head },
    { label: "Sex:",          value: sex },
    { label: "Base Weight:",  value: bw + " lbs" },

    { section: "Terms" },
    { label: "Delivery:",     value: del },
    { label: "Location:",     value: `FOB, ${loc}` },  // Format: FOB, Clovis, NM
    { label: "Shrink:",       value: shr },
    { label: "Slide:",        value: sld },
  ];

  // Pre-compute actual row heights (data rows may wrap)
  function rowHeight(item){
    if(item.section) return secH;
    const lines = wrapLines(font, item.value, 9.5, valueW - padX*2);
    return Math.max(dataH, lines.length * 11 + 4);
  }

  const rowHeights = tableData.map(rowHeight);
  const priceRowH  = 20;  // tighter (was 22)
  const totalTableH = rowHeights.reduce((s,h)=>s+h, 0) + priceRowH;

  // ---- NOTES dynamic height ----
  const desc  = safeStr(row[CONFIG.COLS.description]);
  const desc2 = safeStr(row[CONFIG.COLS.secondDescription]);
  const notesRaw  = [desc, desc2].filter(Boolean).join("  |  ");
  const notesText = safeStr(`Notes: ${notesRaw}`);
  const notesWrapW = contentW - padX*2 - 8;
  const notesWrapped = wrapLines(font, notesText, 8.5, notesWrapW);  // smaller font
  const notesH = 6 + notesWrapped.length * 10 + 4;  // tighter

  // ---- DOWN MONEY row height ----
  const dmH = 18;  // tighter (was 22)

  // ---- CONTRACT TERMS: pre-render all lines ----
  const rawTerms   = (side==="buyer") ? CONFIG.CONTRACT_TERMS.buyer : CONFIG.CONTRACT_TERMS.seller;
  const termsText2 = rawTerms.replace(/\{\{\s*Down Money Due\s*\}\}/g, downMoney);
  const boldStart  = "Buyer does hereby agree to a down payment of $30.00";
  const termsParas = termsText2.split("\n").map(s=>safeStr(s)).filter(p=>p.length>0);

  const termLines = [];
  for(const p of termsParas){
    const useBold = (side==="buyer") && p.startsWith(boldStart);
    const f = useBold ? fontBold : font;
    const wrapped = wrapLines(f, p, 9.0, contentW - padX*2);  // smaller font
    for(const ln of wrapped) termLines.push({ text: ln, bold: useBold });
    termLines.push({ text: "", gap: true });
  }

  // ---- SIGNATURE block height ----
  const sigBlockH = 50;  // tighter

  // ---- Page 1 setup ----
  let pages = [pdfDoc.addPage([W,H])];
  let pageNum = 1;
  let curPage = pages[0];
  let y = drawPageHeader(curPage, 1);

  // ---- Intro text (starts right after phone number) ----
  y -= 4;  // minimal gap

  if(side === "buyer"){
    const introText = `CMS Livestock Auction does hereby agree to sell and '${buyer}' does hereby agree to the purchase of the following livestock:`;
    const introLines = wrapLines(font, introText, 10.0, contentW - 10);
    for(const ln of introLines){
      curPage.drawText(ln, { x:M, y, size:10.0, font, color:BLACK });
      y -= 11.5;
    }
    y -= 6;  // reduced from 8
    curPage.drawText(`Buyer: ${buyer}`, { x:M, y, size:12.2, font:fontBold, color:BLACK });
    y -= 14;
    if(rep){
      curPage.drawText(rep, { x:M, y, size:10.6, font, color:BLACK });
      y -= 14;
    }
  } else {
    const introText = `CMS Livestock Auction does hereby confirm the following cattle were sold on CMS Livestock Auction:`;
    const introLines = wrapLines(font, introText, 10.0, contentW - 10);
    for(const ln of introLines){
      curPage.drawText(ln, { x:M, y, size:10.0, font, color:BLACK });
      y -= 11.5;
    }
    y -= 6;  // reduced from 8
  }

  y -= 4;  // reduced gap before top box

  // ---- TOP BOX: Lot # + (Seller for seller side) + Breed ----
  const topBoxLines = [];
  if(lotNumber){ topBoxLines.push({ text: `Lot # ${lotNumber}`, bold: true, size: 10.6 }); }
  if(side === "seller"){ topBoxLines.push({ text: `Seller: ${consignor}`, bold: true, size: 10.6 }); }
  topBoxLines.push({ text: safeStr(breed), bold: side === "buyer", size: 9.6 });

  const topBoxH = 8 + topBoxLines.length * 13;  // tighter
  curPage.drawRectangle({
    x:M, y:y-topBoxH, width:contentW, height:topBoxH,
    color:WHITE, borderWidth:1.0, borderColor:GRAY
  });
  let bby = y - 11;
  for(const item of topBoxLines){
    curPage.drawText(item.text, {
      x: M+padX, y: bby,
      size: item.size,
      font: item.bold ? fontBold : font,
      color: BLACK
    });
    bby -= 13;
  }
  y -= topBoxH + 3;  // reduced from 4

  // ---- TABLE ----
  // Draw outer border first
  curPage.drawRectangle({
    x:M, y:y-totalTableH, width:tableW, height:totalTableH,
    color:WHITE, borderWidth:1.0, borderColor:GRAY
  });

  let ty = y;
  for(let i=0; i<tableData.length; i++){
    const item = tableData[i];
    const rh   = rowHeights[i];

    if(item.section){
      // Section header background
      curPage.drawRectangle({
        x:M, y:ty-rh, width:tableW, height:rh,
        color:SECTION_BG, borderWidth:0
      });
      // Redraw left + right borders
      curPage.drawLine({ start:{x:M,     y:ty},    end:{x:M,          y:ty-rh}, thickness:1.0, color:GRAY });
      curPage.drawLine({ start:{x:M+tableW, y:ty}, end:{x:M+tableW,   y:ty-rh}, thickness:1.0, color:GRAY });

      curPage.drawText(item.section, {
        x:M+padX, y:ty-11, size:9.5, font:fontBold, color:BLACK
      });
    } else {
      // Data row — redraw left + right side borders
      curPage.drawLine({ start:{x:M,       y:ty}, end:{x:M,         y:ty-rh}, thickness:1.0, color:GRAY });
      curPage.drawLine({ start:{x:M+tableW,y:ty}, end:{x:M+tableW, y:ty-rh}, thickness:1.0, color:GRAY });

      // Label
      curPage.drawText(item.label, {
        x:M+padX, y:ty-11, size:9.0, font, color:DARK_GRAY
      });

      // Vertical divider
      curPage.drawLine({
        start:{x:M+labelW, y:ty}, end:{x:M+labelW, y:ty-rh},
        thickness:0.8, color:GRAY
      });

      // Value (may wrap)
      const vLines = wrapLines(font, item.value, 9.5, valueW - padX*2);
      let vy = ty - 11;
      for(const vl of vLines){
        curPage.drawText(vl, { x:M+labelW+padX, y:vy, size:9.5, font, color:BLACK });
        vy -= 11;
      }
    }

    // Row bottom divider
    curPage.drawLine({
      start:{x:M, y:ty-rh}, end:{x:M+tableW, y:ty-rh},
      thickness:0.8, color:GRAY
    });

    ty -= rh;
  }

  // ---- PRICE ROW (highlighted, left-aligned, FULL BORDER BOX) ----
  curPage.drawRectangle({
    x:M, y:ty-priceRowH, width:tableW, height:priceRowH,
    color:HIGHLIGHT_BG, borderWidth:1.0, borderColor:GRAY  // Add full border
  });

  // Left-aligned label + value
  curPage.drawText("Purchase Price:", {
    x:M+padX, y:ty-13, size:9.0, font:fontBold, color:DARK_GRAY
  });
  curPage.drawLine({ start:{x:M+labelW,y:ty}, end:{x:M+labelW,y:ty-priceRowH}, thickness:0.8, color:GRAY });
  curPage.drawText(`${price}/cwt`, {
    x:M+labelW+padX, y:ty-13, size:11.5, font:fontBold, color:BLACK
  });

  ty -= priceRowH;
  y = ty;
  y -= 4;  // reduced from 6

  // ---- NOTES (dynamic height, proper right padding) ----
  curPage.drawRectangle({
    x:M, y:y-notesH, width:contentW, height:notesH,
    color:WHITE, borderWidth:1.0, borderColor:GRAY
  });
  let ny = y - 8;
  for(const ln of notesWrapped){
    curPage.drawText(ln, { x:M+padX, y:ny, size:8.5, font, color:BLACK });
    ny -= 10;
  }
  y -= notesH;
  y -= 4;  // reduced from 6

  // ---- DOWN MONEY (buyer only) ----
  if(side === "buyer"){
    if(downMoneyAmt > 0){
      curPage.drawRectangle({
        x:M, y:y-dmH, width:contentW, height:dmH,
        color:HIGHLIGHT_BG, borderWidth:1.0, borderColor:GRAY
      });
      curPage.drawText(`Down Money Due: ${downMoney}`, {
        x:M+padX, y:y-12, size:10.5, font:fontBold, color:BLACK
      });
    } else {
      curPage.drawRectangle({
        x:M, y:y-dmH, width:contentW, height:dmH,
        color:WHITE, borderWidth:1.0, borderColor:GRAY
      });
      curPage.drawText(`Down Money Due: ${downMoney}`, {
        x:M+padX, y:y-12, size:9.5, font, color:BLACK
      });
    }
    y -= dmH;
    y -= 18;   // reduced from 26
  } else {
    y -= 18;   // reduced from 26 (after notes on seller)
  }

  // ---- CONTRACT TERMS (never cut off, overflow gracefully) ----
  const termsX = M;
  const termsWrap = contentW - padX;

  // Signature block helper — draws side-by-side sigs on current page
  function drawSignatures(pg){
    const sigY  = 60;  // tighter
    const sigW  = (contentW - 30) / 2;
    const lX    = M;
    const rX    = M + sigW + 30;

    pg.drawLine({ start:{x:lX, y:sigY}, end:{x:lX+sigW, y:sigY}, thickness:1.0, color:BLACK });
    pg.drawLine({ start:{x:rX, y:sigY}, end:{x:rX+sigW, y:sigY}, thickness:1.0, color:BLACK });

    const lLabel = (side==="buyer") ? "Buyer Signature / Date" : "Seller Signature / Date";
    pg.drawText(lLabel,                               { x:lX, y:sigY-13, size:8.5, font, color:BLACK });
    pg.drawText("CMS Livestock Auction Signature / Date", { x:rX, y:sigY-13, size:8.5, font, color:BLACK });
  }

  // Add a new page and return starting y
  function addContractPage(){
    pageNum++;
    const pg = pdfDoc.addPage([W,H]);
    pages.push(pg);
    const startY = drawPageHeader(pg, pageNum);
    return { pg, startY };
  }

  const SIG_CLEARANCE = 80;  // space needed at bottom for signatures

  for(let i=0; i<termLines.length; i++){
    const tl = termLines[i];

    if(tl.gap){
      y -= paraGap;
      continue;
    }

    // Need room for this line + signature block
    if(y < SIG_CLEARANCE + termsLineH){
      // Overflow to new page
      const { pg, startY } = addContractPage();
      curPage = pg;
      y = startY;
      
      // Add page number to previous page
      const prevPg = pages[pageNum-2];
      const pnPrev = `Page ${pageNum-1}`;
      const pnPrevW = font.widthOfTextAtSize(pnPrev, 9);
      prevPg.drawText(pnPrev, { x:W/2-pnPrevW/2, y:20, size:9, font, color:GRAY });
    }

    curPage.drawText(tl.text, {
      x: termsX,
      y,
      size: 9.0,
      font: tl.bold ? fontBold : font,
      color: BLACK
    });
    y -= termsLineH;
  }

  // ---- SIGNATURES on final page ----
  drawSignatures(curPage);

  return await pdfDoc.save();
}

/* =========================================================================
   SPECIAL REPORTS: HELPER FUNCTIONS
   ========================================================================= */

function getWeightClass(baseWeight){
  const w = toNumber(baseWeight);
  if(w < 400) return "<400 lbs";
  if(w <= 500) return "400-500 lbs";
  return "500+ lbs";
}

function isPO(row){
  const p = safeStr(row[CONFIG.COLS.price]);
  return p.toUpperCase() === 'PO' || p === '';
}

function groupLotsByType(rows){
  const groups = new Map();
  for(const r of rows){
    const type = safeStr(r[CONFIG.COLS.type]) || "Other";
    if(!groups.has(type)) groups.set(type, []);
    groups.get(type).push(r);
  }
  return groups;
}

function calculateLotTotal(row){
  if(isPO(row)) return 0;
  const head = toNumber(row[CONFIG.COLS.head]);
  const baseWt = toNumber(row[CONFIG.COLS.baseWeight]);
  const price = toNumber(row[CONFIG.COLS.price]);
  return (head * baseWt * price) / 100;
}


/* =========================================================================
   SPECIAL REPORT 1-3: SALES SUMMARY (Consignor/Buyer/Rep)
   Individual PDFs with sold/PO sections, grouped by type
   ========================================================================= */
async function buildSalesSummaryPdf({entityName, rows, mode}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const M = 36;
  const contentW = W - 2*M;

  const BLACK = rgb(0,0,0);
  const GRAY = rgb(0.55, 0.55, 0.55);
  const DARK_GRAY = rgb(0.3,0.3,0.3);
  const LIGHT_BG = rgb(0.95, 0.95, 0.95);

  let page = pdfDoc.addPage([W,H]);
  let y = H - 50;

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;

  // Header
  const title = mode === "consignor" ? "SALES SUMMARY - CONSIGNOR" : 
                mode === "buyer" ? "SALES SUMMARY - BUYER" : "SALES SUMMARY - REPRESENTATIVE";
  page.drawText(title, { x:M, y, size:14, font:fontBold, color:BLACK });
  y -= 16;
  page.drawText(entityName, { x:M, y, size:12, font:fontBold, color:BLACK });
  y -= 14;
  page.drawText(auctionTitle, { x:M, y, size:9, font, color:DARK_GRAY });
  y -= 20;

  // Calculate totals
  const soldRows = rows.filter(r => !isPO(r));
  const poRows = rows.filter(r => isPO(r));
  
  const totalHead = soldRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);
  const totalSales = soldRows.reduce((sum, r) => sum + calculateLotTotal(r), 0);
  const avgPrice = totalHead > 0 ? (totalSales / (soldRows.reduce((sum,r) => sum + (toNumber(r[CONFIG.COLS.head]) * toNumber(r[CONFIG.COLS.baseWeight])), 0) / 100)) : 0;

  // Summary box
  page.drawText(`Total Head: ${totalHead}`, { x:M, y, size:10, font:fontBold, color:BLACK });
  page.drawText(`Total Sales: ${formatMoney(totalSales)}`, { x:M+200, y, size:10, font:fontBold, color:BLACK });
  page.drawText(`Avg Price: $${avgPrice.toFixed(2)}/cwt`, { x:M+380, y, size:10, font:fontBold, color:BLACK });
  y -= 25;

  // Draw horizontal line
  page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
  y -= 15;

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    y = H - 50;
  }

  function drawSectionHeader(text){
    if(y < 80){ newPage(); }
    page.drawRectangle({ x:M, y:y-16, width:contentW, height:16, color:LIGHT_BG, borderWidth:0 });
    page.drawText(text, { x:M+4, y:y-12, size:10, font:fontBold, color:BLACK });
    y -= 18;
  }

  function drawTableHeader(){
    if(y < 80){ newPage(); }
    const cols = [
      {label:"Lot #", x:M, w:50},
      {label:"Head", x:M+50, w:45},
      {label:"Sex", x:M+95, w:60},
      {label:"Base Wt", x:M+155, w:60},
      {label:"Delivery", x:M+215, w:80},
      {label:"Price", x:M+295, w:70},
      {label:"Total", x:M+365, w:75},
    ];
    
    for(const c of cols){
      page.drawText(c.label, { x:c.x+2, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
    }
    y -= 14;
  }

  function drawLotRow(row, includePrice=true){
    if(y < 50){ newPage(); drawTableHeader(); }
    
    const lotNum = safeStr(row[CONFIG.COLS.lotNumber]) || "";
    const head = safeStr(row[CONFIG.COLS.head]);
    const sex = safeStr(row[CONFIG.COLS.sex]);
    const baseWt = safeStr(row[CONFIG.COLS.baseWeight]) + " lbs";
    const delivery = safeStr(row[CONFIG.COLS.delivery]);
    const price = includePrice ? priceDisplay(row[CONFIG.COLS.price]) + "/cwt" : "-";
    const total = includePrice ? formatMoney(calculateLotTotal(row)) : "-";

    page.drawText(lotNum, { x:M+2, y:y-9, size:8, font, color:BLACK });
    page.drawText(head, { x:M+52, y:y-9, size:8, font, color:BLACK });
    page.drawText(sex, { x:M+97, y:y-9, size:8, font, color:BLACK });
    page.drawText(baseWt, { x:M+157, y:y-9, size:8, font, color:BLACK });
    page.drawText(delivery, { x:M+217, y:y-9, size:8, font, color:BLACK });
    page.drawText(price, { x:M+297, y:y-9, size:8, font, color:BLACK });
    page.drawText(total, { x:M+367, y:y-9, size:8, font, color:BLACK });
    
    y -= 12;
  }

  // SOLD LOTS
  if(soldRows.length > 0){
    drawSectionHeader("SOLD LOTS");
    drawTableHeader();

    const byType = groupLotsByType(soldRows);
    const sortedTypes = Array.from(byType.keys()).sort();

    for(const type of sortedTypes){
      const typeRows = byType.get(type).sort(sortLots);
      
      // Type header
      if(y < 60){ newPage(); }
      page.drawText(type.toUpperCase(), { x:M, y:y-10, size:9, font:fontBold, color:BLACK });
      y -= 14;

      for(const row of typeRows){
        drawLotRow(row, true);
      }

      // Type subtotal
      const typeHead = typeRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);
      const typeTotal = typeRows.reduce((sum, r) => sum + calculateLotTotal(r), 0);
      
      if(y < 40){ newPage(); }
      page.drawText(`${type} Subtotal:`, { x:M+217, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
      page.drawText(`${typeHead} head`, { x:M+297, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
      page.drawText(formatMoney(typeTotal), { x:M+367, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
      y -= 18;
    }

    // Grand total for sold
    if(y < 40){ newPage(); }
    page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
    y -= 14;
    page.drawText("TOTAL SOLD:", { x:M+217, y:y-10, size:9, font:fontBold, color:BLACK });
    page.drawText(`${totalHead} head`, { x:M+297, y:y-10, size:9, font:fontBold, color:BLACK });
    page.drawText(formatMoney(totalSales), { x:M+367, y:y-10, size:9, font:fontBold, color:BLACK });
    y -= 25;
  }

  // PASSED/PO LOTS
  if(poRows.length > 0){
    if(y < 100){ newPage(); }
    
    drawSectionHeader("PASSED/PO LOTS");
    
    // PO header (no price/total columns)
    const poCols = [
      {label:"Lot #", x:M},
      {label:"Head", x:M+50},
      {label:"Sex", x:M+95},
      {label:"Base Wt", x:M+155},
      {label:"Delivery", x:M+215},
    ];
    
    for(const c of poCols){
      page.drawText(c.label, { x:c.x+2, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
    }
    y -= 14;

    const poSorted = [...poRows].sort(sortLots);
    for(const row of poSorted){
      if(y < 50){ newPage(); }
      
      const lotNum = safeStr(row[CONFIG.COLS.lotNumber]) || "";
      const head = safeStr(row[CONFIG.COLS.head]);
      const sex = safeStr(row[CONFIG.COLS.sex]);
      const baseWt = safeStr(row[CONFIG.COLS.baseWeight]) + " lbs";
      const delivery = safeStr(row[CONFIG.COLS.delivery]);

      page.drawText(lotNum, { x:M+2, y:y-9, size:8, font, color:DARK_GRAY });
      page.drawText(head, { x:M+52, y:y-9, size:8, font, color:DARK_GRAY });
      page.drawText(sex, { x:M+97, y:y-9, size:8, font, color:DARK_GRAY });
      page.drawText(baseWt, { x:M+157, y:y-9, size:8, font, color:DARK_GRAY });
      page.drawText(delivery, { x:M+217, y:y-9, size:8, font, color:DARK_GRAY });
      
      y -= 12;
    }

    const poHead = poRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);
    if(y < 40){ newPage(); }
    page.drawText(`PO'd: ${poHead} head`, { x:M, y:y-10, size:8, font:fontBold, color:DARK_GRAY });
    y -= 20;
  }

  // Buyer-specific: Down Money
  if(mode === "buyer"){
    const totalDownMoney = soldRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.downMoney]), 0);
    if(totalDownMoney > 0){
      if(y < 40){ newPage(); }
      page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
      y -= 14;
      page.drawText("Total Down Money Due:", { x:M, y:y-10, size:10, font:fontBold, color:BLACK });
      page.drawText(formatMoney(totalDownMoney), { x:M+367, y:y-10, size:10, font:fontBold, color:BLACK });
    }
  }

  return await pdfDoc.save();
}


/* =========================================================================
   SPECIAL REPORT 4-5: COMPLETE BUYER/CONSIGNOR SUMMARY
   Single portrait PDF listing all entities with totals
   ========================================================================= */
async function buildCompleteSummaryPdf({summaries, mode}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const M = 36;
  const contentW = W - 2*M;

  const BLACK = rgb(0,0,0);
  const GRAY = rgb(0.55, 0.55, 0.55);
  const DARK_GRAY = rgb(0.3,0.3,0.3);

  let page = pdfDoc.addPage([W,H]);
  let y = H - 50;

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;

  // Header
  const title = mode === "buyer" ? "COMPLETE BUYER SUMMARY" : "COMPLETE CONSIGNOR SUMMARY";
  page.drawText(title, { x:M, y, size:14, font:fontBold, color:BLACK });
  y -= 16;
  page.drawText(auctionTitle, { x:M, y, size:9, font, color:DARK_GRAY });
  y -= 25;

  page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
  y -= 15;

  // Table header
  const nameCol = mode === "buyer" ? "Buyer Name" : "Consignor Name";
  page.drawText(nameCol, { x:M+5, y:y-10, size:9, font:fontBold, color:DARK_GRAY });
  page.drawText("# Lots", { x:M+280, y:y-10, size:9, font:fontBold, color:DARK_GRAY });
  page.drawText("Head", { x:M+350, y:y-10, size:9, font:fontBold, color:DARK_GRAY });
  page.drawText("Total $", { x:M+420, y:y-10, size:9, font:fontBold, color:DARK_GRAY });
  y -= 14;

  page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:0.5, color:GRAY });
  y -= 12;

  function newPage(){
    page = pdfDoc.addPage([W,H]);
    y = H - 50;
  }

  // Sort by total $ descending
  const sorted = [...summaries].sort((a,b) => b.totalSales - a.totalSales);

  for(const s of sorted){
    if(y < 50){ newPage(); }

    page.drawText(s.name, { x:M+5, y:y-9, size:9, font, color:BLACK });
    page.drawText(s.lotCount.toString(), { x:M+280, y:y-9, size:9, font, color:BLACK });
    page.drawText(s.totalHead.toString(), { x:M+350, y:y-9, size:9, font, color:BLACK });
    page.drawText(formatMoney(s.totalSales), { x:M+420, y:y-9, size:9, font, color:BLACK });
    
    y -= 12;
  }

  // Grand totals
  const grandLots = summaries.reduce((sum, s) => sum + s.lotCount, 0);
  const grandHead = summaries.reduce((sum, s) => sum + s.totalHead, 0);
  const grandSales = summaries.reduce((sum, s) => sum + s.totalSales, 0);

  if(y < 50){ newPage(); }
  page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
  y -= 14;

  page.drawText("TOTALS:", { x:M+5, y:y-10, size:10, font:fontBold, color:BLACK });
  page.drawText(grandLots.toString(), { x:M+280, y:y-10, size:10, font:fontBold, color:BLACK });
  page.drawText(grandHead.toString(), { x:M+350, y:y-10, size:10, font:fontBold, color:BLACK });
  page.drawText(formatMoney(grandSales), { x:M+420, y:y-10, size:10, font:fontBold, color:BLACK });

  return await pdfDoc.save();
}


/* =========================================================================
   SPECIAL REPORT 6: AUCTION RECAP SUMMARY
   Single portrait PDF (can overflow to page 2) with comprehensive stats
   ========================================================================= */
async function buildAuctionRecapPdf({allRows}){
  assertLibsLoaded();
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 612;
  const H = 792;
  const M = 36;
  const contentW = W - 2*M;

  const BLACK = rgb(0,0,0);
  const GRAY = rgb(0.55, 0.55, 0.55);
  const DARK_GRAY = rgb(0.3,0.3,0.3);
  const SECTION_BG = rgb(0.94, 0.94, 0.94);

  let page = pdfDoc.addPage([W,H]);
  let y = H - 50;
  let pageNum = 1;

  const auctionTitleBase = safeStr(auctionName.value) || "Auction";
  const extra = safeStr(auctionLabel.value);
  const auctionTitle = extra ? `${auctionTitleBase} — ${extra}` : auctionTitleBase;
  const aDate = safeStr(auctionDate.value) || "";

  function newPage(){
    pageNum++;
    page = pdfDoc.addPage([W,H]);
    y = H - 50;
    // Add page number
    page.drawText(`Page ${pageNum}`, { x:W/2-15, y:20, size:8, font, color:GRAY });
  }

  function drawSectionHeader(text){
    if(y < 60){ newPage(); }
    page.drawRectangle({ x:M, y:y-14, width:contentW, height:14, color:SECTION_BG, borderWidth:0 });
    page.drawText(text, { x:M+4, y:y-10, size:9, font:fontBold, color:BLACK });
    y -= 18;
  }

  function drawLine(label, value){
    if(y < 30){ newPage(); }
    page.drawText(label, { x:M+10, y:y-9, size:8.5, font, color:BLACK });
    page.drawText(value, { x:M+250, y:y-9, size:8.5, font:fontBold, color:BLACK });
    y -= 11;
  }

  // Header
  page.drawText("AUCTION RECAP SUMMARY", { x:M, y, size:14, font:fontBold, color:BLACK });
  y -= 16;
  page.drawText(auctionTitle, { x:M, y, size:10, font:fontBold, color:DARK_GRAY });
  y -= 12;
  if(aDate){ page.drawText(aDate, { x:M, y, size:9, font, color:DARK_GRAY }); y -= 16; }
  else { y -= 10; }

  page.drawLine({ start:{x:M, y}, end:{x:M+contentW, y}, thickness:1, color:GRAY });
  y -= 15;

  // Calculate all metrics
  const soldRows = allRows.filter(r => !isPO(r));
  const poRows = allRows.filter(r => isPO(r));

  const totalLotsOffered = allRows.length;
  const totalLotsSold = soldRows.length;
  const sellThroughPct = totalLotsOffered > 0 ? ((totalLotsSold / totalLotsOffered) * 100).toFixed(1) : "0.0";

  const totalHeadOffered = allRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);
  const totalHeadSold = soldRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);
  const headSoldPct = totalHeadOffered > 0 ? ((totalHeadSold / totalHeadOffered) * 100).toFixed(1) : "0.0";

  const lotsPO = poRows.length;
  const headPO = poRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.head]), 0);

  const grossSales = soldRows.reduce((sum, r) => sum + calculateLotTotal(r), 0);
  
  const prices = soldRows.map(r => toNumber(r[CONFIG.COLS.price])).filter(p => p > 0);
  const avgPrice = prices.length > 0 ? (prices.reduce((s,p)=>s+p,0) / prices.length).toFixed(2) : "0.00";
  const minPrice = prices.length > 0 ? Math.min(...prices).toFixed(2) : "0.00";
  const maxPrice = prices.length > 0 ? Math.max(...prices).toFixed(2) : "0.00";

  const totalDownMoney = soldRows.reduce((sum, r) => sum + toNumber(r[CONFIG.COLS.downMoney]), 0);

  const buyers = new Set(soldRows.map(r => safeStr(r[CONFIG.COLS.buyer])).filter(Boolean));
  const consignors = new Set(allRows.map(r => safeStr(r[CONFIG.COLS.consignor])).filter(Boolean));
  const reps = new Set(allRows.map(r => getRepColumn(r)).filter(Boolean));

  // AUCTION OVERVIEW
  drawSectionHeader("📊 AUCTION OVERVIEW");
  drawLine("Total Lots Offered:", totalLotsOffered.toString());
  drawLine("Total Lots Sold:", totalLotsSold.toString());
  drawLine("Sell-Through Rate:", `${sellThroughPct}%`);
  y -= 4;
  drawLine("Total Head Offered:", totalHeadOffered.toString());
  drawLine("Total Head Sold:", totalHeadSold.toString());
  drawLine("Head Sold Rate:", `${headSoldPct}%`);
  y -= 4;
  drawLine("Lots Passed/PO:", `${lotsPO} (${((lotsPO/totalLotsOffered)*100).toFixed(1)}%)`);
  drawLine("Head Passed/PO:", `${headPO} (${((headPO/totalHeadOffered)*100).toFixed(1)}%)`);
  y -= 8;

  // FINANCIAL SUMMARY
  drawSectionHeader("💰 FINANCIAL SUMMARY");
  drawLine("Gross Sales:", formatMoney(grossSales));
  drawLine("Average Price (all sold):", `$${avgPrice}/cwt`);
  drawLine("Price Range:", `$${minPrice} - $${maxPrice}/cwt`);
  if(totalDownMoney > 0){
    drawLine("Total Down Money Due:", formatMoney(totalDownMoney));
  }
  y -= 8;

  // PARTICIPATION
  drawSectionHeader("👥 PARTICIPATION");
  drawLine("Number of Buyers:", buyers.size.toString());
  drawLine("Number of Consignors:", consignors.size.toString());
  drawLine("Number of Representatives:", reps.size.toString());

  // Top buyer/consignor by head
  const byBuyer = new Map();
  for(const r of soldRows){
    const buyer = safeStr(r[CONFIG.COLS.buyer]);
    if(!buyer) continue;
    if(!byBuyer.has(buyer)) byBuyer.set(buyer, 0);
    byBuyer.set(buyer, byBuyer.get(buyer) + toNumber(r[CONFIG.COLS.head]));
  }
  const topBuyer = Array.from(byBuyer.entries()).sort((a,b) => b[1] - a[1])[0];
  if(topBuyer) drawLine("Top Buyer:", `${topBuyer[0]} (${topBuyer[1]} head)`);

  const byConsignor = new Map();
  for(const r of soldRows){
    const consignor = safeStr(r[CONFIG.COLS.consignor]);
    if(!consignor) continue;
    if(!byConsignor.has(consignor)) byConsignor.set(consignor, 0);
    byConsignor.set(consignor, byConsignor.get(consignor) + toNumber(r[CONFIG.COLS.head]));
  }
  const topConsignor = Array.from(byConsignor.entries()).sort((a,b) => b[1] - a[1])[0];
  if(topConsignor) drawLine("Top Consignor:", `${topConsignor[0]} (${topConsignor[1]} head)`);
  y -= 8;

  // TOP 3 REPS
  drawSectionHeader("🏆 TOP 3 REPS");
  const byRep = new Map();
  for(const r of soldRows){
    const rep = getRepColumn(r);
    if(!rep) continue;
    if(!byRep.has(rep)) byRep.set(rep, {head:0, sales:0});
    const stats = byRep.get(rep);
    stats.head += toNumber(r[CONFIG.COLS.head]);
    stats.sales += calculateLotTotal(r);
  }
  const topReps = Array.from(byRep.entries())
    .sort((a,b) => b[1].sales - a[1].sales)
    .slice(0, 3);
  
  for(let i=0; i<topReps.length; i++){
    const [rep, stats] = topReps[i];
    drawLine(`${i+1}. ${rep}:`, `${stats.head} head, ${formatMoney(stats.sales)}`);
  }
  y -= 8;

  // PRICE ANALYSIS BY TYPE, SEX & WEIGHT
  drawSectionHeader("📈 PRICE ANALYSIS BY TYPE, SEX & WEIGHT");
  y -= 4;

  // Group by type, sex, weight
  const priceData = new Map();
  for(const r of soldRows){
    const type = safeStr(r[CONFIG.COLS.type]) || "Other";
    const sex = safeStr(r[CONFIG.COLS.sex]) || "Unknown";
    const weightClass = getWeightClass(toNumber(r[CONFIG.COLS.baseWeight]));
    const price = toNumber(r[CONFIG.COLS.price]);
    
    const key = `${type}|${sex}|${weightClass}`;
    if(!priceData.has(key)) priceData.set(key, []);
    priceData.get(key).push(price);
  }

  // Build nested structure
  const typeMap = new Map();
  for(const [key, prices] of priceData.entries()){
    const [type, sex, weightClass] = key.split('|');
    if(!typeMap.has(type)) typeMap.set(type, new Map());
    if(!typeMap.get(type).has(sex)) typeMap.get(type).set(sex, new Map());
    typeMap.get(type).get(sex).set(weightClass, prices);
  }

  const sortedTypes = Array.from(typeMap.keys()).sort();
  
  for(const type of sortedTypes){
    if(y < 100){ newPage(); drawSectionHeader("📈 PRICE ANALYSIS (continued)"); y -= 4; }
    
    page.drawText(type.toUpperCase(), { x:M+10, y:y-9, size:8.5, font:fontBold, color:BLACK });
    y -= 12;

    const sexMap = typeMap.get(type);
    const sortedSexes = Array.from(sexMap.keys()).sort();

    for(const sex of sortedSexes){
      if(y < 50){ newPage(); }
      
      page.drawText(`  ${sex}:`, { x:M+15, y:y-9, size:8, font:fontBold, color:DARK_GRAY });
      y -= 11;

      const weightMap = sexMap.get(sex);
      const weightOrder = ["<400 lbs", "400-500 lbs", "500+ lbs"];
      
      for(const wc of weightOrder){
        if(!weightMap.has(wc)) continue;
        if(y < 40){ newPage(); }

        const prices = weightMap.get(wc);
        const min = Math.min(...prices).toFixed(2);
        const max = Math.max(...prices).toFixed(2);
        
        page.drawText(`    ${wc}:`, { x:M+20, y:y-8, size:7.5, font, color:BLACK });
        page.drawText(`$${min}-$${max}/cwt`, { x:M+100, y:y-8, size:7.5, font, color:DARK_GRAY });
        y -= 10;
      }
    }
    y -= 4;
  }

  y -= 6;

  // CATTLE BREAKDOWN
  if(y < 80){ newPage(); }
  drawSectionHeader("🐄 CATTLE BREAKDOWN");
  
  // By Type
  const headByType = new Map();
  for(const r of soldRows){
    const type = safeStr(r[CONFIG.COLS.type]) || "Other";
    headByType.set(type, (headByType.get(type) || 0) + toNumber(r[CONFIG.COLS.head]));
  }
  const sortedByType = Array.from(headByType.entries()).sort((a,b) => b[1] - a[1]);
  
  page.drawText("By Type:", { x:M+10, y:y-9, size:8.5, font:fontBold, color:BLACK });
  y -= 11;
  for(const [type, head] of sortedByType){
    if(y < 40){ newPage(); }
    const pct = ((head / totalHeadSold) * 100).toFixed(1);
    page.drawText(`  ${type}:`, { x:M+15, y:y-8, size:8, font, color:BLACK });
    page.drawText(`${head} head (${pct}%)`, { x:M+150, y:y-8, size:8, font, color:DARK_GRAY });
    y -= 10;
  }
  y -= 4;

  // By Sex
  const headBySex = new Map();
  for(const r of soldRows){
    const sex = safeStr(r[CONFIG.COLS.sex]) || "Unknown";
    headBySex.set(sex, (headBySex.get(sex) || 0) + toNumber(r[CONFIG.COLS.head]));
  }
  const sortedBySex = Array.from(headBySex.entries()).sort((a,b) => b[1] - a[1]);
  
  if(y < 50){ newPage(); }
  page.drawText("By Sex:", { x:M+10, y:y-9, size:8.5, font:fontBold, color:BLACK });
  y -= 11;
  for(const [sex, head] of sortedBySex){
    if(y < 40){ newPage(); }
    const pct = ((head / totalHeadSold) * 100).toFixed(1);
    page.drawText(`  ${sex}:`, { x:M+15, y:y-8, size:8, font, color:BLACK });
    page.drawText(`${head} head (${pct}%)`, { x:M+150, y:y-8, size:8, font, color:DARK_GRAY });
    y -= 10;
  }
  y -= 8;

  // DELIVERY SCHEDULE
  if(y < 80){ newPage(); }
  drawSectionHeader("📅 DELIVERY SCHEDULE");
  
  const headByDelivery = new Map();
  for(const r of soldRows){
    const delivery = safeStr(r[CONFIG.COLS.delivery]) || "Unknown";
    headByDelivery.set(delivery, (headByDelivery.get(delivery) || 0) + toNumber(r[CONFIG.COLS.head]));
  }
  const sortedByDelivery = Array.from(headByDelivery.entries()).sort((a,b) => b[1] - a[1]);
  
  for(const [delivery, head] of sortedByDelivery){
    if(y < 40){ newPage(); }
    page.drawText(`  ${delivery}:`, { x:M+15, y:y-8, size:8, font, color:BLACK });
    page.drawText(`${head} head`, { x:M+150, y:y-8, size:8, font, color:DARK_GRAY });
    y -= 10;
  }

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

async function downloadZip(items, zipName, folderName=null){
  const zip = new JSZip();
  
  // If folder name provided, create subfolder structure
  const folder = folderName ? zip.folder(folderName) : zip;
  
  for(const it of items) folder.file(it.filename, it.bytes);

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
    generated.repReports.length +
    generated.preConsignorReports.length +
    generated.preRepReports.length +
    generated.salesByConsignor.length +
    generated.salesByBuyer.length +
    generated.salesByRep.length +
    (generated.completeBuyer ? 1 : 0) +
    (generated.completeConsignor ? 1 : 0) +
    (generated.auctionRecap ? 1 : 0);

  resultsMeta.textContent = `Generated ${total} file(s) from ${csvRows.length} row(s).`;

  renderList(listBuyerReports, generated.buyerReports);
  renderList(listLotByLot, generated.lotByLot);
  renderList(listBuyerContracts, generated.buyerContracts);
  renderList(listSellerContracts, generated.sellerContracts);
  renderList(listConsignorReports, generated.consignorReports);
  renderList(listRepReports, generated.repReports);
  renderList(listPreConsignorReports, generated.preConsignorReports);
  renderList(listPreRepReports, generated.preRepReports);
  
  // Special reports
  renderList(listSalesByConsignor, generated.salesByConsignor);
  renderList(listSalesByBuyer, generated.salesByBuyer);
  renderList(listSalesByRep, generated.salesByRep);
  renderList(listCompleteBuyer, generated.completeBuyer ? [generated.completeBuyer] : []);
  renderList(listCompleteConsignor, generated.completeConsignor ? [generated.completeConsignor] : []);
  renderList(listAuctionRecap, generated.auctionRecap ? [generated.auctionRecap] : []);

  zipBuyerReports.disabled = generated.buyerReports.length === 0;
  zipLotByLot.disabled = generated.lotByLot.length === 0;
  zipBuyerContracts.disabled = generated.buyerContracts.length === 0;
  zipSellerContracts.disabled = generated.sellerContracts.length === 0;
  zipConsignorReports.disabled = generated.consignorReports.length === 0;
  zipRepReports.disabled = generated.repReports.length === 0;
  zipPreConsignorReports.disabled = generated.preConsignorReports.length === 0;
  zipPreRepReports.disabled = generated.preRepReports.length === 0;
  
  // Special reports ZIP buttons
  zipSalesByConsignor.disabled = generated.salesByConsignor.length === 0;
  zipSalesByBuyer.disabled = generated.salesByBuyer.length === 0;
  zipSalesByRep.disabled = generated.salesByRep.length === 0;
  
  const hasSpecialReports = generated.salesByConsignor.length > 0 || 
                            generated.salesByBuyer.length > 0 || 
                            generated.salesByRep.length > 0 ||
                            generated.completeBuyer ||
                            generated.completeConsignor ||
                            generated.auctionRecap;
  zipSpecialReports.disabled = !hasSpecialReports;
  
  zipAll.disabled = total === 0;
}


/* ---------------- SECTION SELECT/DESELECT ALL ---------------- */
function wireSectionSelectors(){
  // Pre-Auction
  const selectAllPre = document.getElementById("selectAllPre");
  const deselectAllPre = document.getElementById("deselectAllPre");
  if(selectAllPre){
    selectAllPre.addEventListener("click", (e) => {
      e.preventDefault();
      chkPreConsignor.checked = true;
      chkPreRep.checked = true;
      setBuildEnabled();
    });
  }
  if(deselectAllPre){
    deselectAllPre.addEventListener("click", (e) => {
      e.preventDefault();
      chkPreConsignor.checked = false;
      chkPreRep.checked = false;
      setBuildEnabled();
    });
  }

  // Post-Auction
  const selectAllPost = document.getElementById("selectAllPost");
  const deselectAllPost = document.getElementById("deselectAllPost");
  if(selectAllPost){
    selectAllPost.addEventListener("click", (e) => {
      e.preventDefault();
      chkBuyer.checked = true;
      chkLotByLot.checked = true;
      chkConsignor.checked = true;
      chkRep.checked = true;
      setBuildEnabled();
    });
  }
  if(deselectAllPost){
    deselectAllPost.addEventListener("click", (e) => {
      e.preventDefault();
      chkBuyer.checked = false;
      chkLotByLot.checked = false;
      chkConsignor.checked = false;
      chkRep.checked = false;
      setBuildEnabled();
    });
  }

  // Contracts
  const selectAllContracts = document.getElementById("selectAllContracts");
  const deselectAllContracts = document.getElementById("deselectAllContracts");
  if(selectAllContracts){
    selectAllContracts.addEventListener("click", (e) => {
      e.preventDefault();
      chkBuyerContracts.checked = true;
      chkSellerContracts.checked = true;
      setBuildEnabled();
    });
  }
  if(deselectAllContracts){
    deselectAllContracts.addEventListener("click", (e) => {
      e.preventDefault();
      chkBuyerContracts.checked = false;
      chkSellerContracts.checked = false;
      setBuildEnabled();
    });
  }

  // Special Reports
  const selectAllSpecial = document.getElementById("selectAllSpecial");
  const deselectAllSpecial = document.getElementById("deselectAllSpecial");
  if(selectAllSpecial){
    selectAllSpecial.addEventListener("click", (e) => {
      e.preventDefault();
      chkSalesByConsignor.checked = true;
      chkSalesByBuyer.checked = true;
      chkSalesByRep.checked = true;
      chkCompleteBuyer.checked = true;
      chkCompleteConsignor.checked = true;
      chkAuctionRecap.checked = true;
      setBuildEnabled();
    });
  }
  if(deselectAllSpecial){
    deselectAllSpecial.addEventListener("click", (e) => {
      e.preventDefault();
      chkSalesByConsignor.checked = false;
      chkSalesByBuyer.checked = false;
      chkSalesByRep.checked = false;
      chkCompleteBuyer.checked = false;
      chkCompleteConsignor.checked = false;
      chkAuctionRecap.checked = false;
      setBuildEnabled();
    });
  }
}

/* ---------------- BUILD ---------------- */
function wireBuild(){
  buildBtn.addEventListener("click", async ()=>{
    setError(builderError, "");
    buildBtn.disabled = true;
    buildBtn.textContent = "Generating…";

    const errors = []; // Track errors

    try{
      assertLibsLoaded();
      if(csvRows.length === 0) throw new Error("Upload a CSV first.");

      const anyChecked =
        chkBuyer.checked ||
        chkConsignor.checked ||
        chkRep.checked ||
        chkLotByLot.checked ||
        chkBuyerContracts.checked ||
        chkSellerContracts.checked ||
        chkPreConsignor.checked ||
        chkPreRep.checked ||
        chkSalesByConsignor.checked ||
        chkSalesByBuyer.checked ||
        chkSalesByRep.checked ||
        chkCompleteBuyer.checked ||
        chkCompleteConsignor.checked ||
        chkAuctionRecap.checked;

      if(!anyChecked) throw new Error("Select at least one output option.");

      generated = { 
        buyerReports:[], 
        lotByLot:[], 
        buyerContracts:[], 
        sellerContracts:[], 
        consignorReports:[], 
        repReports:[],
        preConsignorReports: [],
        preRepReports: [],
        salesByConsignor: [],
        salesByBuyer: [],
        salesByRep: [],
        completeBuyer: null,
        completeConsignor: null,
        auctionRecap: null,
      };

      // POST-AUCTION GENERATION
      const postAuctionRequested = chkBuyer.checked || chkConsignor.checked || chkRep.checked || 
                                   chkLotByLot.checked || chkBuyerContracts.checked || chkSellerContracts.checked;

      if(postAuctionRequested){
        const chk = requiredColsPresent(csvRows);
        if(!chk.ok) throw new Error(`CSV missing required column(s) for post-auction: ${chk.missing.join(", ")}`);
        
        contractColName = detectContractColumn(csvRows);
        if(!contractColName) throw new Error(`CSV is missing a Contract column. Expected one of: ${CONFIG.CONTRACT_COL_CANDIDATES.join(", ")}`);

        const byBuyer = groupBy(csvRows, CONFIG.COLS.buyer);
        const byConsignor = groupBy(csvRows, CONFIG.COLS.consignor);
        
        // Check for rep in both Representative and Rep columns
        const repRows = csvRows.filter(r => {
          const rep = getRepColumn(r);
          return safeStr(rep) !== "";
        });
        const byRep = new Map();
        for(const r of repRows){
          const rep = safeStr(getRepColumn(r));
          if(!rep) continue;
          if(!byRep.has(rep)) byRep.set(rep, []);
          byRep.get(rep).push(r);
        }

        if(chkBuyer.checked){
          for(const [buyer, rows] of byBuyer.entries()){
            if(!buyer) continue;
            try{
              const bytes = await buildPdfForGroup({ entityName: buyer, rows, mode:"buyer", singleLotMode:false, forceBuyerName:buyer });
              generated.buyerReports.push({ filename: `${fileSafeName(buyer)}-Buyer Recap.pdf`, bytes, count: rows.length });
            } catch(err){
              errors.push(`Buyer Report for "${buyer}": ${err.message}`);
            }
          }
        }

        if(chkLotByLot.checked){
          const sorted = [...csvRows].sort(sortLots);
          for(const row of sorted){
            const contract = safeStr(getContract(row)) || "Contract";
            const buyer = safeStr(row[CONFIG.COLS.buyer]) || "Buyer";
            try{
              const bytes = await buildPdfForGroup({
                entityName: buyer,
                rows: [row],
                mode: "buyer",
                singleLotMode: true,
                forceBuyerName: buyer,
                headerRightBig: `Contract # ${contract}`
              });
              generated.lotByLot.push({ filename: `Contract-Details-${fileSafeName(contract)}.pdf`, bytes, count: 1 });
            } catch(err){
              errors.push(`Contract Details for "${contract}": ${err.message}`);
            }
          }
        }

        if(chkBuyerContracts.checked){
          const sorted = [...csvRows].sort(sortLots);
          for(const row of sorted){
            const contract = safeStr(getContract(row)) || "Contract";
            const buyer = safeStr(row[CONFIG.COLS.buyer]) || "Buyer";
            try{
              const bytes = await buildSalesContractPdf({ row, side:"buyer" });
              generated.buyerContracts.push({ filename: `${fileSafeName(contract)}-${fileSafeName(buyer)}.pdf`, bytes, count: 1 });
            } catch(err){
              errors.push(`Buyer Contract "${contract}": ${err.message}`);
            }
          }
        }

        if(chkSellerContracts.checked){
          const sorted = [...csvRows].sort(sortLots);
          for(const row of sorted){
            const contract = safeStr(getContract(row)) || "Contract";
            const seller = safeStr(row[CONFIG.COLS.consignor]) || "Seller";
            try{
              const bytes = await buildSalesContractPdf({ row, side:"seller" });
              generated.sellerContracts.push({ filename: `${fileSafeName(seller)}-${fileSafeName(contract)}.pdf`, bytes, count: 1 });
            } catch(err){
              errors.push(`Seller Contract "${contract}": ${err.message}`);
            }
          }
        }

        if(chkConsignor.checked){
          for(const [consignor, rows] of byConsignor.entries()){
            if(!consignor) continue;
            try{
              const bytes = await buildPdfForGroup({ entityName: consignor, rows, mode:"consignor" });
              generated.consignorReports.push({ filename: `Trade Confirmations-${fileSafeName(consignor)}.pdf`, bytes, count: rows.length });
            } catch(err){
              errors.push(`Consignor Report for "${consignor}": ${err.message}`);
            }
          }
        }

        if(chkRep.checked){
          for(const [rep, rows] of byRep.entries()){
            if(!rep) continue;
            try{
              const bytes = await buildPdfForGroup({ entityName: rep, rows, mode:"rep", showCmsNotes: chkShowCmsNotes.checked });
              generated.repReports.push({ filename: `Rep-${fileSafeName(rep)}-Trade Confirmations.pdf`, bytes, count: rows.length });
            } catch(err){
              errors.push(`Rep Report for "${rep}": ${err.message}`);
            }
          }
        }
      }

      // PRE-AUCTION GENERATION
      if(chkPreConsignor.checked || chkPreRep.checked){
        // Pre-auction doesn't require all the post-auction columns
        const row0 = csvRows[0] || {};
        const keys = new Set(Object.keys(row0));
        const requiredPreCols = [
          CONFIG.PRE_COLS.consignor,
          CONFIG.PRE_COLS.head,
          CONFIG.PRE_COLS.sex,
          CONFIG.PRE_COLS.delivery,
          CONFIG.PRE_COLS.location,
        ];
        const missingPre = requiredPreCols.filter(c => !keys.has(c));
        if(missingPre.length > 0){
          throw new Error(`CSV missing required columns for pre-auction: ${missingPre.join(", ")}`);
        }

        if(chkPreConsignor.checked){
          const byConsignor = groupBy(csvRows, CONFIG.PRE_COLS.consignor);
          for(const [consignor, rows] of byConsignor.entries()){
            if(!consignor) continue;
            try{
              const bytes = await buildPreAuctionListingPdf({ entityName: consignor, rows, mode:"consignor" });
              generated.preConsignorReports.push({ 
                filename: `Listing-Confirmations-${fileSafeName(consignor)}.pdf`, 
                bytes, 
                count: rows.length 
              });
            } catch(err){
              errors.push(`Pre-Auction Consignor for "${consignor}": ${err.message}`);
            }
          }
        }

        if(chkPreRep.checked){
          // Check for rep in Rep column (pre-auction uses "Rep" not "Representative")
          const repRows = csvRows.filter(r => safeStr(r[CONFIG.PRE_COLS.rep]) !== "");
          const byRep = groupBy(repRows, CONFIG.PRE_COLS.rep);
          for(const [rep, rows] of byRep.entries()){
            if(!rep) continue;
            try{
              const bytes = await buildPreAuctionListingPdf({ entityName: rep, rows, mode:"rep", showCmsNotes: chkShowCmsNotes.checked });
              generated.preRepReports.push({ 
                filename: `Rep-${fileSafeName(rep)}-Listing-Confirmations.pdf`, 
                bytes, 
                count: rows.length 
              });
            } catch(err){
              errors.push(`Pre-Auction Rep for "${rep}": ${err.message}`);
            }
          }
        }
      }

      // Show errors if any
      if(errors.length > 0){
        const errorMsg = `⚠ ${errors.length} PDF(s) failed to generate:\n\n${errors.map((e,i) => `${i+1}. ${e}`).join('\n')}`;
        alert(errorMsg);
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

  zipBuyerReports.addEventListener("click", async ()=> generated.buyerReports.length && downloadZip(generated.buyerReports, "Buyer-Reports.zip"));
  zipLotByLot.addEventListener("click", async ()=> generated.lotByLot.length && downloadZip(generated.lotByLot, "Contract-Details.zip"));
  zipBuyerContracts.addEventListener("click", async ()=> generated.buyerContracts.length && downloadZip(generated.buyerContracts, "Buyer-Contracts.zip"));
  zipSellerContracts.addEventListener("click", async ()=> generated.sellerContracts.length && downloadZip(generated.sellerContracts, "Seller-Contracts.zip"));
  zipConsignorReports.addEventListener("click", async ()=> generated.consignorReports.length && downloadZip(generated.consignorReports, "Consignor-Reports.zip"));
  zipRepReports.addEventListener("click", async ()=> generated.repReports.length && downloadZip(generated.repReports, "Rep-Reports.zip"));
  zipPreConsignorReports.addEventListener("click", async ()=> generated.preConsignorReports.length && downloadZip(generated.preConsignorReports, "Listing-Confirmations-Consignor.zip"));
  zipPreRepReports.addEventListener("click", async ()=> generated.preRepReports.length && downloadZip(generated.preRepReports, "Listing-Confirmations-Rep.zip"));

  // Special Reports ZIP handlers
  zipSalesByConsignor.addEventListener("click", async ()=> generated.salesByConsignor.length && downloadZip(generated.salesByConsignor, "Sales-Summaries-Consignor.zip"));
  zipSalesByBuyer.addEventListener("click", async ()=> generated.salesByBuyer.length && downloadZip(generated.salesByBuyer, "Sales-Summaries-Buyer.zip"));
  zipSalesByRep.addEventListener("click", async ()=> generated.salesByRep.length && downloadZip(generated.salesByRep, "Sales-Summaries-Rep.zip"));

  zipSpecialReports.addEventListener("click", async ()=>{
    const zip = new JSZip();
    const folder = zip.folder("Special-Reports");
    
    for(const it of generated.salesByConsignor) folder.file(it.filename, it.bytes);
    for(const it of generated.salesByBuyer) folder.file(it.filename, it.bytes);
    for(const it of generated.salesByRep) folder.file(it.filename, it.bytes);
    if(generated.completeBuyer) folder.file(generated.completeBuyer.filename, generated.completeBuyer.bytes);
    if(generated.completeConsignor) folder.file(generated.completeConsignor.filename, generated.completeConsignor.bytes);
    if(generated.auctionRecap) folder.file(generated.auctionRecap.filename, generated.auctionRecap.bytes);

    if(Object.keys(zip.files).length > 0){
      const blob = await zip.generateAsync({type:"blob"});
      const url = URL.createObjectURL(blob);
      blobUrls.push(url);

      const a = document.createElement("a");
      a.href = url;
      a.download = "Special-Reports.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(()=>{
        try{ URL.revokeObjectURL(url); }catch{}
        blobUrls = blobUrls.filter(u => u !== url);
      }, 25000);
    }
  });

  zipAll.addEventListener("click", async ()=>{
    const zip = new JSZip();
    
    // Create organized folder structure
    if(generated.buyerContracts.length > 0){
      const folder = zip.folder("Buyer-Contracts");
      for(const it of generated.buyerContracts) folder.file(it.filename, it.bytes);
    }
    
    if(generated.sellerContracts.length > 0){
      const folder = zip.folder("Seller-Contracts");
      for(const it of generated.sellerContracts) folder.file(it.filename, it.bytes);
    }
    
    if(generated.buyerReports.length > 0){
      const folder = zip.folder("Buyer-Reports");
      for(const it of generated.buyerReports) folder.file(it.filename, it.bytes);
    }
    
    if(generated.lotByLot.length > 0){
      const folder = zip.folder("Contract-Details");
      for(const it of generated.lotByLot) folder.file(it.filename, it.bytes);
    }
    
    if(generated.consignorReports.length > 0){
      const folder = zip.folder("Consignor-Trade-Confirmations");
      for(const it of generated.consignorReports) folder.file(it.filename, it.bytes);
    }
    
    if(generated.repReports.length > 0){
      const folder = zip.folder("Rep-Trade-Confirmations");
      for(const it of generated.repReports) folder.file(it.filename, it.bytes);
    }
    
    if(generated.preConsignorReports.length > 0){
      const folder = zip.folder("Consignor-Listing-Confirmations");
      for(const it of generated.preConsignorReports) folder.file(it.filename, it.bytes);
    }
    
    if(generated.preRepReports.length > 0){
      const folder = zip.folder("Rep-Listing-Confirmations");
      for(const it of generated.preRepReports) folder.file(it.filename, it.bytes);
    }

    // Special Reports
    if(generated.salesByConsignor.length > 0 || generated.salesByBuyer.length > 0 || generated.salesByRep.length > 0 ||
       generated.completeBuyer || generated.completeConsignor || generated.auctionRecap){
      const folder = zip.folder("Special-Reports");
      for(const it of generated.salesByConsignor) folder.file(it.filename, it.bytes);
      for(const it of generated.salesByBuyer) folder.file(it.filename, it.bytes);
      for(const it of generated.salesByRep) folder.file(it.filename, it.bytes);
      if(generated.completeBuyer) folder.file(generated.completeBuyer.filename, generated.completeBuyer.bytes);
      if(generated.completeConsignor) folder.file(generated.completeConsignor.filename, generated.completeConsignor.bytes);
      if(generated.auctionRecap) folder.file(generated.auctionRecap.filename, generated.auctionRecap.bytes);
    }
    
    if(zip.files && Object.keys(zip.files).length > 0){
      const blob = await zip.generateAsync({type:"blob"});
      const url = URL.createObjectURL(blob);
      blobUrls.push(url);

      const a = document.createElement("a");
      a.href = url;
      a.download = "CMS-Auction-All.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(()=>{
        try{ URL.revokeObjectURL(url); }catch{}
        blobUrls = blobUrls.filter(u => u !== url);
      }, 25000);
    }
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

    listBuyerReports.innerHTML = "";
    listLotByLot.innerHTML = "";
    listBuyerContracts.innerHTML = "";
    listSellerContracts.innerHTML = "";
    listConsignorReports.innerHTML = "";
    listRepReports.innerHTML = "";
    listPreConsignorReports.innerHTML = "";
    listPreRepReports.innerHTML = "";

    zipBuyerReports.disabled = true;
    zipLotByLot.disabled = true;
    zipBuyerContracts.disabled = true;
    zipSellerContracts.disabled = true;
    zipConsignorReports.disabled = true;
    zipRepReports.disabled = true;
    zipPreConsignorReports.disabled = true;
    zipPreRepReports.disabled = true;
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

  [chkBuyer, chkConsignor, chkRep, chkLotByLot, chkBuyerContracts, chkSellerContracts, chkPreConsignor, chkPreRep,
   chkSalesByConsignor, chkSalesByBuyer, chkSalesByRep, chkCompleteBuyer, chkCompleteConsignor, chkAuctionRecap]
    .forEach(el => el.addEventListener("change", setBuildEnabled));

  wireSectionSelectors();
  wireBuild();
  wireExit();
  wireResultsDropdowns();

  goto(pageAuth);
  setBuildEnabled();
  
  // Ensure everything is cleared on page load/refresh
  csvRows = [];
  contractColName = null;
  blobUrls.forEach(url => { try{ URL.revokeObjectURL(url); }catch{} });
  blobUrls = [];
  generated = { 
    buyerReports:[], 
    lotByLot:[], 
    buyerContracts:[], 
    sellerContracts:[], 
    consignorReports:[], 
    repReports:[],
    preConsignorReports: [],
    preRepReports: [],
  };
}

document.addEventListener("DOMContentLoaded", init);

// Also clear on page unload (browser refresh, navigation away, tab close)
window.addEventListener("beforeunload", ()=>{
  for(const u of blobUrls){ try{ URL.revokeObjectURL(u); }catch{} }
  blobUrls = [];
});
