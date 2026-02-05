console.log("CMS Post-Auction Portal loaded");

const { jsPDF } = window.jspdf;

/* =========================
   CONFIG
========================= */
const CONFIG = {
  PIN: "0623",

  REPORT_PDF: { orientation: "landscape" }, // DO NOT TOUCH REPORTS
  CONTRACT_PDF: { orientation: "portrait" }, // contracts only

  COLORS: {
    sellerHeader: "#818589"
  }
};

/* =========================
   PIN + COLLAPSE LOGIC
========================= */
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-toggle]").forEach(header => {
    header.addEventListener("click", e => {
      if (e.target.classList.contains("zip-btn")) return;

      header.classList.toggle("open");
      header.nextElementSibling.classList.toggle("collapsed");
    });
  });

  document.getElementById("pinBtn").onclick = () => {
    if (document.getElementById("pinInput").value === CONFIG.PIN) {
      document.getElementById("pinGate").classList.add("hidden");
      document.getElementById("uploadSection").classList.remove("hidden");
    }
  };
});

/* =========================
   CSV UPLOAD
========================= */
document.getElementById("csvInput").addEventListener("change", e => {
  Papa.parse(e.target.files[0], {
    header:true,
    skipEmptyLines:true,
    complete: res => buildAll(res.data)
  });
});

/* =========================
   MAIN
========================= */
function buildAll(rows) {
  document.getElementById("results").classList.remove("hidden");

  buildBuyerReports(rows);
  buildSellerContracts(rows);
  buildBuyerContracts(rows);
}

/* =========================
   BUYER REPORTS (FILENAME ONLY)
========================= */
function buildBuyerReports(rows) {
  const wrap = document.getElementById("buyerReports");
  wrap.innerHTML = "";

  groupBy(rows, "Buyer").forEach(([buyer, lots]) => {
    const a = document.createElement("div");
    a.className = "download-link";
    a.textContent = `${buyer} - Buyer Recap`;

    a.onclick = () => {
      const pdf = new jsPDF(CONFIG.REPORT_PDF);
      pdf.text(`Buyer Recap: ${buyer}`, 20, 20);

      const safe = fileSafe(`${buyer} - Buyer Recap.pdf`);
      pdf.save(safe);
    };
    wrap.appendChild(a);
  });
}

/* =========================
   SELLER CONTRACTS (PORTRAIT)
========================= */
function buildSellerContracts(rows) {
  const wrap = document.getElementById("sellerContracts");
  wrap.innerHTML = "";

  rows.forEach(r => {
    const a = document.createElement("div");
    a.className = "download-link";
    a.textContent = `Lot ${r["Lot Number"]} - ${r["Consignor"]}`;

    a.onclick = () => sellerPDF(r);
    wrap.appendChild(a);
  });
}

function sellerPDF(r) {
  const pdf = new jsPDF(CONFIG.CONTRACT_PDF);

  // header bar
  pdf.setFillColor(CONFIG.COLORS.sellerHeader);
  pdf.rect(0,0,215,15,"F");

  pdf.setTextColor(0);
  pdf.setFontSize(12);
  pdf.text("CMS Orita Calf Auctions", 10, 25);
  pdf.text(r["Auction Date"], 10, 32);
  pdf.setFont(undefined,"bold");
  pdf.text(r["Consignor"], 10, 39);
  pdf.setFont(undefined,"normal");

  pdf.text(`Lot ${r["Lot Number"]} - ${r["Consignor"]}`, 140, 32);

  drawLotGrid(pdf, r, 55);

  drawSignatures(pdf, 235);

  pdf.save(fileSafe(`${r["Consignor"]}-${r["Contract Number"]}.pdf`));
}

/* =========================
   BUYER CONTRACTS (PORTRAIT)
========================= */
function buildBuyerContracts(rows) {
  const wrap = document.getElementById("buyerContracts");
  wrap.innerHTML = "";

  rows.forEach(r => {
    const a = document.createElement("div");
    a.className = "download-link";
    a.textContent = `Lot ${r["Lot Number"]} - ${r["Consignor"]}`;

    a.onclick = () => buyerContractPDF(r);
    wrap.appendChild(a);
  });
}

function buyerContractPDF(r) {
  const pdf = new jsPDF(CONFIG.CONTRACT_PDF);

  pdf.text(`Buyer: ${r["Buyer"]}`, 10, 20);
  pdf.text(`Lot ${r["Lot Number"]} - ${r["Consignor"]}`, 140, 20);

  drawLotGrid(pdf, r, 40);
  drawSignatures(pdf, 215);

  pdf.save(fileSafe(`${r["Contract Number"]}-${r["Buyer"]}.pdf`));
}

/* =========================
   SHARED HELPERS
========================= */
function drawLotGrid(pdf, r, y) {
  pdf.text(`Loads: ${r["Load Count"]}`, 10, y);
  pdf.text(`Head: ${r["Head Count"]}`, 60, y);
  pdf.text(`Sex: ${r["Sex"]}`, 110, y);
  pdf.text(`Base Wt: ${r["Base Weight"]}`, 150, y);

  y += 10;
  pdf.text(`Delivery: ${r["Delivery"]}`, 10, y);
  pdf.text(`Location: ${r["Location"]}`, 80, y);
  pdf.text(`Shrink: ${r["Shrink"]}`, 140, y);

  y += 10;
  pdf.text(`Slide: ${r["Slide"]}`, 10, y);
  pdf.text(`Price: ${r["Price/CWT"]}`, 80, y);
}

function drawSignatures(pdf, y) {
  pdf.line(10, y, 90, y);
  pdf.text("Seller Signature", 10, y + 6);

  y += 20;
  pdf.line(10, y, 90, y);
  pdf.text("CMS Orita Signature", 10, y + 6);
}

function groupBy(arr, key) {
  const map = {};
  arr.forEach(r => {
    if (!map[r[key]]) map[r[key]] = [];
    map[r[key]].push(r);
  });
  return Object.entries(map);
}

function fileSafe(name) {
  return name.replace(/[\/\\:*?"<>|]/g,"").trim();
}
