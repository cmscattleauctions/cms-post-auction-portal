/* ==========================================================
   CMS Post-Auction Portal (client-only) — FULL app.js (PART 2/2)
   ========================================================== */

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
    generated.consignorReports.length +
    generated.repReports.length;

  resultsMeta.textContent = `Generated ${total} file(s) from ${csvRows.length} row(s).`;

  renderList(listBuyerReports, generated.buyerReports);
  renderList(listLotByLot, generated.lotByLot);
  renderList(listConsignorReports, generated.consignorReports);
  renderList(listRepReports, generated.repReports);

  zipBuyerReports.disabled = generated.buyerReports.length === 0;
  zipLotByLot.disabled = generated.lotByLot.length === 0;
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
        chkBuyer.checked || chkConsignor.checked || chkRep.checked || chkLotByLot.checked;

      if(!anyChecked) throw new Error("Select at least one output option.");

      const chk = requiredColsPresent(csvRows);
      if(!chk.ok) throw new Error(`CSV missing required column(s): ${chk.missing.join(", ")}`);

      if(!contractColName) throw new Error("Contract column not detected. Re-upload CSV.");

      // Reset generated state
      generated = { buyerReports: [], lotByLot: [], consignorReports: [], repReports: [] };

      // Build groups
      const byBuyer = groupBy(csvRows, CONFIG.COLS.buyer);
      const byConsignor = groupBy(csvRows, CONFIG.COLS.consignor);
      const repRows = csvRows.filter(r => safeStr(r[CONFIG.COLS.rep]) !== "");
      const byRep = groupBy(repRows, CONFIG.COLS.rep);

      // 1) Buyer reports (one PDF per buyer, includes all contracts)
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

      // 2) Lot-by-lot (one PDF per lot/contract, buyer mode header)
      // Title placement is the SAME as buyer recap (left under date), because mode is buyer.
      if(chkLotByLot.checked){
        const sorted = [...csvRows].sort(sortLots);
        for(const row of sorted){
          const buyer = safeStr(row[CONFIG.COLS.buyer]) || "Buyer";
          const contract = safeStr(getContract(row)) || "Contract";
          const bytes = await buildPdfForGroup({
            entityName: buyer,
            rows: [row],
            mode: "buyer",
            singleLotMode: true,
            forceBuyerName: buyer
          });
          generated.lotByLot.push({
            filename: `Contract-${fileSafeName(contract)}.pdf`,
            bytes,
            count: 1
          });
        }
      }

      // 3) Consignor reports (one PDF per consignor)
      if(chkConsignor.checked){
        for(const [consignor, rows] of byConsignor.entries()){
          if(!consignor) continue;
          const bytes = await buildPdfForGroup({
            entityName: consignor,
            rows,
            mode: "consignor"
          });
          generated.consignorReports.push({
            filename: `Contract-${fileSafeName(consignor)}.pdf`,
            bytes,
            count: rows.length
          });
        }
      }

      // 4) Rep reports (ignore blank reps)
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

      // Show results
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

  // ZIP buttons
  zipBuyerReports.addEventListener("click", async ()=>{
    if(generated.buyerReports.length) await downloadZip(generated.buyerReports, "Buyer-Reports.zip");
  });

  zipLotByLot.addEventListener("click", async ()=>{
    if(generated.lotByLot.length) await downloadZip(generated.lotByLot, "Lot-by-Lot.zip");
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
    listConsignorReports.innerHTML = "";
    listRepReports.innerHTML = "";

    zipBuyerReports.disabled = true;
    zipLotByLot.disabled = true;
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

  [chkBuyer, chkConsignor, chkRep, chkLotByLot].forEach(el => {
    el.addEventListener("change", setBuildEnabled);
  });

  wireBuild();
  wireExit();

  // Start at auth
  goto(pageAuth);
  setBuildEnabled();
}

document.addEventListener("DOMContentLoaded", init);
/* ==========================================================
   CMS Post-Auction Portal (client-only) — FULL app.js (PART 2/2)
   ========================================================== */

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
    generated.consignorReports.length +
    generated.repReports.length;

  resultsMeta.textContent = `Generated ${total} file(s) from ${csvRows.length} row(s).`;

  renderList(listBuyerReports, generated.buyerReports);
  renderList(listLotByLot, generated.lotByLot);
  renderList(listConsignorReports, generated.consignorReports);
  renderList(listRepReports, generated.repReports);

  zipBuyerReports.disabled = generated.buyerReports.length === 0;
  zipLotByLot.disabled = generated.lotByLot.length === 0;
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
        chkBuyer.checked || chkConsignor.checked || chkRep.checked || chkLotByLot.checked;

      if(!anyChecked) throw new Error("Select at least one output option.");

      const chk = requiredColsPresent(csvRows);
      if(!chk.ok) throw new Error(`CSV missing required column(s): ${chk.missing.join(", ")}`);

      if(!contractColName) throw new Error("Contract column not detected. Re-upload CSV.");

      // Reset generated state
      generated = { buyerReports: [], lotByLot: [], consignorReports: [], repReports: [] };

      // Build groups
      const byBuyer = groupBy(csvRows, CONFIG.COLS.buyer);
      const byConsignor = groupBy(csvRows, CONFIG.COLS.consignor);
      const repRows = csvRows.filter(r => safeStr(r[CONFIG.COLS.rep]) !== "");
      const byRep = groupBy(repRows, CONFIG.COLS.rep);

      // 1) Buyer reports (one PDF per buyer)
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

      // 2) Lot-by-lot (one PDF per contract/row, buyer header)
      if(chkLotByLot.checked){
        const sorted = [...csvRows].sort(sortLots);
        for(const row of sorted){
          const buyer = safeStr(row[CONFIG.COLS.buyer]) || "Buyer";
          const contract = safeStr(getContract(row)) || "Contract";
          const bytes = await buildPdfForGroup({
            entityName: buyer,
            rows: [row],
            mode: "buyer",
            singleLotMode: true,
            forceBuyerName: buyer
          });
          generated.lotByLot.push({
            filename: `Contract-${fileSafeName(contract)}.pdf`,
            bytes,
            count: 1
          });
        }
      }

      // 3) Consignor reports (one PDF per consignor)
      if(chkConsignor.checked){
        for(const [consignor, rows] of byConsignor.entries()){
          if(!consignor) continue;
          const bytes = await buildPdfForGroup({
            entityName: consignor,
            rows,
            mode: "consignor"
          });
          generated.consignorReports.push({
            filename: `Contract-${fileSafeName(consignor)}.pdf`,
            bytes,
            count: rows.length
          });
        }
      }

      // 4) Rep reports (ignore blank reps)
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

      // Show results
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

  // ZIP buttons
  zipBuyerReports.addEventListener("click", async ()=>{
    if(generated.buyerReports.length) await downloadZip(generated.buyerReports, "Buyer-Reports.zip");
  });

  zipLotByLot.addEventListener("click", async ()=>{
    if(generated.lotByLot.length) await downloadZip(generated.lotByLot, "Lot-by-Lot.zip");
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
    listConsignorReports.innerHTML = "";
    listRepReports.innerHTML = "";

    zipBuyerReports.disabled = true;
    zipLotByLot.disabled = true;
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

  [chkBuyer, chkConsignor, chkRep, chkLotByLot].forEach(el => {
    el.addEventListener("change", setBuildEnabled);
  });

  wireBuild();
  wireExit();

  // Start at auth
  goto(pageAuth);
  setBuildEnabled();
}

document.addEventListener("DOMContentLoaded", init);
