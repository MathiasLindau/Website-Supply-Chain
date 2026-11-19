// 1. HTML ELEMENTS

const overlay = document.querySelector("#demo-overlay");
const openButton = document.querySelector("#demo-open");
const closeButton = document.querySelector("#demo-close");
const refreshButton = document.querySelector("#demo-refresh");
const tableBody = document.querySelector("#shipment-rows");
const runButton = document.querySelector("#demo-run");
const loader = document.querySelector("#demo-loader");
const tableWrap = document.querySelector(".demo-table-wrap");
const results = document.querySelector("#demo-results");
const savingsOutput = document.querySelector("#demo-savings");
const reviewHint = document.querySelector("#demo-review-hint");
const demoIntro = document.querySelector("#demo-intro");
const demoContinue = document.querySelector("#demo-continue");
const demoActions = document.querySelector("#demo-actions");
const invoiceReview = document.querySelector("#invoice-review");
const invoiceReviewClose = document.querySelector("#invoice-review-close");
const invoiceScenarios = new Map();
let reviewReturnFocus = null;

// 2. EU TRANSPORT ROUTES

const routes = [
  ["Rotterdam, Netherlands", "Antwerp, Belgium", 105],
  ["Amsterdam, Netherlands", "Frankfurt, Germany", 440],
  ["Brussels, Belgium", "Paris, France", 315],
  ["Hamburg, Germany", "Copenhagen, Denmark", 340],
  ["Berlin, Germany", "Poznan, Poland", 275],
  ["Munich, Germany", "Vienna, Austria", 435],
  ["Lyon, France", "Turin, Italy", 315],
  ["Paris, France", "Barcelona, Spain", 1035],
  ["Milan, Italy", "Stuttgart, Germany", 390],
  ["Madrid, Spain", "Lisbon, Portugal", 625],
  ["Barcelona, Spain", "Toulouse, France", 395],
  ["Warsaw, Poland", "Prague, Czech Republic", 680],
  ["Prague, Czech Republic", "Vienna, Austria", 295],
  ["Budapest, Hungary", "Bucharest, Romania", 835],
  ["Stockholm, Sweden", "Gothenburg, Sweden", 470],
  ["Porto, Portugal", "Vigo, Spain", 155],
  ["Sofia, Bulgaria", "Thessaloniki, Greece", 230],
  ["Bratislava, Slovakia", "Budapest, Hungary", 200],
  ["Lille, France", "Antwerp, Belgium", 115],
  ["Cologne, Germany", "Luxembourg, Luxembourg", 190],
  ["Cologne, Germany", "Amsterdam, Netherlands", 350]
];

// 3. TRANSPORT SERVICES

const services = [
  { name: "Full truckload (FTL)", base: 85, rate: 1.45, benchmarkFactor: 1 },
  { name: "Groupage (LTL)", base: 45, rate: 0.82, benchmarkFactor: 0.75 },
  { name: "Temperature-controlled", base: 130, rate: 1.80, benchmarkFactor: 1.3 },
  { name: "Express road freight", base: 110, rate: 1.95, benchmarkFactor: 1.2 },
  { name: "Intermodal road / rail", base: 95, rate: 1.12, benchmarkFactor: 0.85 }
];

const demoStages = {
  1: ["THE PROBLEM", "Invoices keep arriving.", "Carrier billing sends invoices straight to the office. Manual review struggles to keep up.", "icon-problem"],
  2: ["DATA PREPARATION", "European transport orders", "10 randomly selected records from 1,000 simulated shipments, with different routes in every sample.", "icon-preparation"],
  3: ["TECHNICAL SOLUTION", "European transport orders", "The model compares each invoice with the benchmark for its own route and service.", "icon-technical"]
};

// 4. FORMATTING

const dateFormat = new Intl.DateTimeFormat("en-GB");

const euroFormat = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR"
});

const round = value => Math.round(value * 100) / 100;

// 5. GENERATE 1,000 DUMMY SHIPMENTS

const shipments = Array.from({ length: 1000 }, (_, index) => {

  const route = routes[Math.floor(Math.random() * routes.length)];
  const service = services[Math.floor(Math.random() * services.length)];

  const loadingDate = new Date();
  loadingDate.setDate(
    loadingDate.getDate() - Math.floor(Math.random() * 75)
  );

  const deliveryDate = new Date(loadingDate);
  deliveryDate.setDate(
    deliveryDate.getDate() +
    Math.max(1, Math.ceil(route[2] / 700)) +
    Math.floor(Math.random() * 2)
  );

  const costs =
    (service.base + route[2] * service.rate) *
    (0.90 + Math.random() * 0.20);

  return {
    id: String(index + 1).padStart(4, "0"),
    shipment: `EU-${loadingDate.getFullYear()}-${String(index + 1).padStart(5, "0")}`,
    loading: dateFormat.format(loadingDate),
    delivery: dateFormat.format(deliveryDate),
    from: route[0],
    to: route[1],
    distance: route[2],
    service: service.name,
    costs: Number(costs.toFixed(2))
  };

});

// Scenario benchmarks are fictional, attached to the actual route and service.
// Keep review-only fields outside the nine-column shipment records.
function createBenchmark(distance, service, carrier) {
  const serviceFactor = services.find(entry => entry.name === service)?.benchmarkFactor ?? 1;
  return {
    carrier, service, distance,
    drivingMin: round(distance / 87.5),
    drivingMax: round(distance / 43.75),
    extraMin: round(distance * (200 / 350) * serviceFactor),
    extraMax: round(distance * (400 / 350) * serviceFactor)
  };
}

shipments.forEach((order, index) => {
  const route = routes.find(route => route[0] === order.from && route[1] === order.to);
  const carrier = ["Demo Road Logistics", "Demo Freight Partners", "Demo Cargo Services"][index % 3];
  const benchmark = createBenchmark(route[2], order.service, carrier);
  const actual = {
    carrier,
    drivingHours: round((benchmark.drivingMin + benchmark.drivingMax) / 2),
    extraCosts: round(benchmark.extraMin + (benchmark.extraMax - benchmark.extraMin) * (0.25 + (index % 4) * 0.15))
  };
  const variant = index % 10;
  const injectedDeviations = variant >= 7 ? variant - 6 : 0;
  const checks = ["distance", "drivingHours", "extraCosts"];
  for (let n = 0; n < injectedDeviations; n++) {
    const field = checks[(n + index) % checks.length];
    const below = index % 2 !== 0;
    if (field === "distance") order.distance = Math.round(benchmark.distance * (below ? 0.7 : 1.35));
    if (field === "drivingHours") actual.drivingHours = round(below ? benchmark.drivingMin * 0.5 : benchmark.drivingMax * 1.3);
    if (field === "extraCosts") actual.extraCosts = round(below ? benchmark.extraMin * 0.5 : benchmark.extraMax * 1.35);
  }
  // Total includes the same extra-service amount shown in the invoice review.
  actual.transportCosts = order.costs;
  order.costs = Number((actual.transportCosts + actual.extraCosts).toFixed(2));
  invoiceScenarios.set(order.id, { benchmark, actual });
});

function compareInvoice(order) {
  const { benchmark, actual } = invoiceScenarios.get(order.id);
  return [
    { label: "Carrier", actual: actual.carrier, expected: benchmark.carrier, mismatch: actual.carrier !== benchmark.carrier },
    { label: "Service", actual: order.service, expected: benchmark.service, mismatch: order.service !== benchmark.service },
    { label: "Distance", actual: `${order.distance} km`, expected: `${benchmark.distance} km`, mismatch: order.distance !== benchmark.distance },
    { label: "Driving time", actual: `${actual.drivingHours} h`, expected: `${benchmark.drivingMin}–${benchmark.drivingMax} h`, mismatch: actual.drivingHours < benchmark.drivingMin || actual.drivingHours > benchmark.drivingMax },
    { label: "Extra services", actual: euroFormat.format(actual.extraCosts), expected: `${euroFormat.format(benchmark.extraMin)}–${euroFormat.format(benchmark.extraMax)}`, mismatch: actual.extraCosts < benchmark.extraMin || actual.extraCosts > benchmark.extraMax }
  ];
}

function deviationCount(order) {
  return compareInvoice(order).filter(field => field.mismatch).length;
}

// 6. SELECT 10 RANDOM SHIPMENTS

function getRandomShipments() {

  const pool = [...shipments];

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const sample = [];
  const routeKey = order => `${order.from}|${order.to}`;
  const seenRoutes = new Set();
  for (const order of pool) {
    if (seenRoutes.has(routeKey(order))) continue;
    sample.push(order);
    seenRoutes.add(routeKey(order));
    if (sample.length === 10) break;
  }
  // Vary routes in each sample and always offer a red invoice to inspect.
  if (!sample.some(order => deviationCount(order) > 1)) {
    const retainedRoutes = new Set(sample.slice(0, 9).map(routeKey));
    sample[9] = pool.find(order => deviationCount(order) > 1 && !retainedRoutes.has(routeKey(order)));
  }
  return sample;
}

// 7. DISPLAY SHIPMENTS IN THE HTML TABLE

let currentSample = [];
let analysisTimer = null;

// DISPLAY SHIPMENTS

function displayShipments() {

  setDemoStage(2);
  currentSample = getRandomShipments();

  renderShipments(currentSample);

  results.hidden = true;
  reviewHint.hidden = true;
  runButton.disabled = false;

}

// BUILD HTML TABLE

function createTextElement(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function renderShipments(orders, flaggedIds = null) {
  const fragment = document.createDocumentFragment();
  orders.forEach(order => {
    const row = document.createElement("tr");
    const isFlagged = flaggedIds !== null && flaggedIds.has(order.id);
    if (isFlagged) {
      row.classList.add("invoice-flagged-row");
      row.dataset.invoiceId = order.id;
    }

    Object.entries(order).forEach(([key, value]) => {
      const isCost = key === "costs";
      const cell = createTextElement("td", isCost ? euroFormat.format(value) : value);
      if (isCost && flaggedIds !== null) {
        cell.classList.add(isFlagged ? "cost-flagged" : "cost-normal");
      }
      if (isCost && isFlagged) {
        const reviewButton = createTextElement("button", euroFormat.format(value));
        reviewButton.type = "button";
        reviewButton.className = "invoice-review-trigger";
        reviewButton.setAttribute("aria-label", `Review invoice ${order.shipment}: ${deviationCount(order)} deviations, total ${euroFormat.format(value)}`);
        cell.replaceChildren(reviewButton);
      }
      row.appendChild(cell);
    });
    fragment.appendChild(row);
  });
  tableBody.replaceChildren(fragment);
}

// 8. OPEN AND CLOSE DEMO

function setDemoStage(stage) {
  const [label, title, description, icon] = demoStages[stage];
  document.querySelector("#demo-stage-label").textContent = label;
  document.querySelector("#demo-title").textContent = title;
  document.querySelector("#demo-description").textContent = description;
  document.querySelector("#demo-stage-icon").setAttribute("href", `#${icon}`);
}

function openDemo() {
  demoIntro.hidden = false;
  demoActions.hidden = true;
  tableWrap.hidden = true;
  loader.hidden = true;
  results.hidden = true;
  reviewHint.hidden = true;
  setDemoStage(1);
  overlay.hidden = false;
  document.body.classList.add("demo-open");
  demoContinue.focus();
}

function prepareDemoData() {
  displayShipments();
  demoIntro.hidden = true;
  demoActions.hidden = false;
  tableWrap.hidden = false;
  runButton.focus();
}

function closeDemo() {

  reviewReturnFocus = null;
  if (invoiceReview.open) invoiceReview.close();
  overlay.inert = false;

  clearTimeout(analysisTimer);
  analysisTimer = null;

  loader.hidden = true;
  tableWrap.hidden = false;

  runButton.disabled = false;
  refreshButton.disabled = false;

  overlay.hidden = true;
  document.body.classList.remove("demo-open");

  openButton.focus();

}

// 9. RUN SIMULATED ANALYSIS

function runAnalysis() {

  setDemoStage(3);
  runButton.disabled = true;
  refreshButton.disabled = true;

  tableWrap.hidden = true;
  results.hidden = true;
  loader.hidden = false;
  reviewHint.hidden = true;

  const waiting = 1500 + Math.random() * 800;

  analysisTimer = setTimeout(() => {

    // Flag using exactly the same comparisons shown in the detail dialog.
    const flaggedIds = new Set(
      currentSample.filter(order => deviationCount(order) > 1).map(order => order.id)
    );

    // CALCULATE FLAGGED COSTS

    const potentialSavings = currentSample
      .filter(order => flaggedIds.has(order.id))
      .reduce((total, order) => total + order.costs, 0);

    // UPDATE TABLE

    renderShipments(currentSample, flaggedIds);

    // DISPLAY RESULTS

    savingsOutput.textContent =
      euroFormat.format(potentialSavings);

    loader.hidden = true;
    tableWrap.hidden = false;
    results.hidden = false;
    reviewHint.hidden = false;

    runButton.disabled = false;
    refreshButton.disabled = false;

    analysisTimer = null;

  }, waiting);

}

// Invoice details and benchmark comparison share the selected shipment data.
function openInvoiceReview(order, returnFocus) {
  const { actual } = invoiceScenarios.get(order.id);
  const comparisons = compareInvoice(order);
  const count = comparisons.filter(field => field.mismatch).length;
  const facts = [
    ["Invoice ID", order.id], ["Shipment", order.shipment],
    ["Loading date", order.loading], ["Delivery date", order.delivery],
    ["Carrier", actual.carrier], ["From", order.from], ["To", order.to],
    ["Service", order.service], ["Distance", `${order.distance} km`],
    ["Driving time", `${actual.drivingHours} h`],
    ["Transport", euroFormat.format(actual.transportCosts)],
    ["Extra services", euroFormat.format(actual.extraCosts)],
    ["Invoice total", euroFormat.format(order.costs)]
  ];
  const details = document.querySelector("#invoice-review-details");
  details.replaceChildren();
  facts.forEach(([label, value]) => {
    details.append(createTextElement("dt", label), createTextElement("dd", value));
  });
  document.querySelector("#invoice-review-title").textContent = `Invoice ${order.shipment}`;
  const status = document.querySelector("#invoice-review-status");
  status.textContent = `${count} deviation${count === 1 ? "" : "s"} · ${count > 1 ? "Flagged for review" : "Within demo threshold"}`;
  status.classList.toggle("is-flagged", count > 1);
  document.querySelector("#invoice-benchmark-route").textContent = `${order.from} → ${order.to} · ${order.service}`;
  const comparisonBody = document.querySelector("#invoice-review-comparison");
  comparisonBody.replaceChildren();
  comparisons.forEach(field => {
    const row = document.createElement("tr");
    const label = createTextElement("th", field.label);
    label.scope = "row";
    const actualCell = createTextElement("td", field.actual);
    if (field.mismatch) {
      actualCell.classList.add("invoice-mismatch");
      const marker = createTextElement("span", "Deviation");
      marker.className = "invoice-mismatch-label";
      actualCell.appendChild(marker);
    }
    const benchmarkCell = createTextElement("td", field.expected);
    row.append(label, actualCell, benchmarkCell);
    comparisonBody.appendChild(row);
  });
  reviewReturnFocus = returnFocus;
  invoiceReview.showModal();
  overlay.inert = true;
  invoiceReviewClose.focus();
}

// 10. EVENT LISTENERS

invoiceReviewClose.addEventListener("click", () => invoiceReview.close());
invoiceReview.addEventListener("close", () => {
  overlay.inert = false;
  if (!overlay.hidden && reviewReturnFocus?.isConnected) reviewReturnFocus.focus();
  reviewReturnFocus = null;
});
invoiceReview.addEventListener("click", event => {
  if (event.target !== invoiceReview) return;
  const bounds = invoiceReview.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) invoiceReview.close();
});
tableBody.addEventListener("click", event => {
  const row = event.target.closest("tr[data-invoice-id]");
  if (!row) return;
  const order = currentSample.find(order => order.id === row.dataset.invoiceId);
  if (order) openInvoiceReview(order, row.querySelector("button"));
});

openButton.addEventListener("click", openDemo);
demoContinue.addEventListener("click", prepareDemoData);
closeButton.addEventListener("click", closeDemo);

refreshButton.addEventListener("click", displayShipments);
runButton.addEventListener("click", runAnalysis);

overlay.addEventListener("click", event => {

  if (event.target === overlay) {
    closeDemo();
  }

});

document.addEventListener("keydown", event => {

  if (event.key === "Escape" && !overlay.hidden && !invoiceReview.open) {
    closeDemo();
  }

});

/* 11. CARD INFO OVERLAYS — independent of the freight demo */
(() => {
  const hoverInput = window.matchMedia("(hover: hover) and (pointer: fine)");

  document.querySelectorAll(".logistics-explainer .card-info-trigger").forEach(trigger => {
    const card = trigger.closest(".tool-card");
    const panel = card.querySelector(".card-info-panel");
    const close = card.querySelector(".card-info-close");

    function setCardInfo(open) {
      if (!open && panel.contains(document.activeElement)) {
        trigger.focus();
      }
      card.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", String(open));
      panel.setAttribute("aria-hidden", String(!open));
      panel.inert = !open;
    }

    card.addEventListener("pointerenter", event => {
      if (hoverInput.matches && event.pointerType === "mouse") setCardInfo(true);
    });
    card.addEventListener("pointerleave", event => {
      if (hoverInput.matches && event.pointerType === "mouse") setCardInfo(false);
    });

    trigger.addEventListener("click", () => {
      const open = !card.classList.contains("is-open");
      setCardInfo(open);
      if (open) close.focus();
    });
    close.addEventListener("click", () => setCardInfo(false));
    card.addEventListener("keydown", event => {
      if (event.key === "Escape" && card.classList.contains("is-open")) {
        setCardInfo(false);
      }
    });
  });
})();
