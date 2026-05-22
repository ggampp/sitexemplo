const stage = document.getElementById("stage");
const wall = document.getElementById("photo-wall");
const floatLayer = document.getElementById("float-layer");
const featureCard = document.getElementById("feature-card");
const progressFill = document.getElementById("progress-fill");
const titleEl = document.getElementById("card-title");
const kickerEl = document.getElementById("card-kicker");
const imageEl = document.getElementById("card-image");
const metaEl = document.getElementById("card-meta");
const copyEl = document.getElementById("card-copy");
const previousButton = document.getElementById("previous-card");
const nextButton = document.getElementById("next-card");
const themeButton = document.getElementById("theme-button");
const sideActions = document.querySelectorAll(".side-actions");
const leftActions = document.querySelector(".left-actions");
const rightActions = document.querySelector(".right-actions");

const moments = Array.isArray(window.MOMENT_IMAGES) ? window.MOMENT_IMAGES : [];

const layoutOptions = {
  desktop: { width: 2400, targetHeight: 220, gap: 6 },
  mobile: { width: 1600, targetHeight: 150, gap: 4 }
};
const tilePositions = new Map();

let activeIndex = -1;
let manualLight = false;
let panX = 0;
let panY = 0;
const likedMoments = new Set();
const savedMoments = new Set();

function setPan(x, y) {
  panX = x;
  panY = y;
  stage.style.setProperty("--wall-x", `${x}px`);
  stage.style.setProperty("--wall-y", `${y}px`);
}

function clampPan(x, y) {
  const stageRect = stage.getBoundingClientRect();
  const wallRect = wall.getBoundingClientRect();
  const wallW = wallRect.width / (Number(stage.style.getPropertyValue("--wall-scale")) || 1);
  const wallH = wallRect.height / (Number(stage.style.getPropertyValue("--wall-scale")) || 1);
  const margin = 80;
  const minX = stageRect.width - wallW - margin;
  const maxX = margin;
  const minY = stageRect.height - wallH - margin;
  const maxY = margin;
  return [Math.min(maxX, Math.max(minX, x)), Math.min(maxY, Math.max(minY, y))];
}

function centerWallOnTile(tile) {
  const stageRect = stage.getBoundingClientRect();
  const tileRect = tile.getBoundingClientRect();
  const tileCenterX = tileRect.left + tileRect.width / 2;
  const tileCenterY = tileRect.top + tileRect.height / 2;
  const deltaX = stageRect.width / 2 - tileCenterX;
  const deltaY = stageRect.height / 2 - tileCenterY;
  const [x, y] = clampPan(panX + deltaX, panY + deltaY);
  setPan(x, y);
}

function centerWallInitial() {
  const stageRect = stage.getBoundingClientRect();
  const wallRect = wall.getBoundingClientRect();
  setPan((stageRect.width - wallRect.width) / 2, (stageRect.height - wallRect.height) / 2);
}

function getLayoutOptions() {
  return window.matchMedia("(max-width: 980px)").matches ? layoutOptions.mobile : layoutOptions.desktop;
}

function computeJustifiedRows(items, opts) {
  const { width, targetHeight, gap } = opts;
  const rows = [];
  let current = [];
  let aspectSum = 0;

  for (const item of items) {
    const aspect = Math.max(0.3, Math.min(3.2, item.aspectRatio || item.width / item.height || 1));
    current.push({ ...item, aspect });
    aspectSum += aspect;
    const projected = aspectSum * targetHeight + gap * (current.length - 1);
    if (projected >= width) {
      const rowHeight = (width - gap * (current.length - 1)) / aspectSum;
      rows.push({ items: current, height: rowHeight });
      current = [];
      aspectSum = 0;
    }
  }
  if (current.length) {
    const projected = aspectSum * targetHeight + gap * (current.length - 1);
    const rowHeight = projected > width * 0.8 ? (width - gap * (current.length - 1)) / aspectSum : targetHeight;
    rows.push({ items: current, height: rowHeight });
  }
  return rows;
}

function layoutWall() {
  const opts = getLayoutOptions();
  const rows = computeJustifiedRows(moments, opts);
  const gap = opts.gap;
  tilePositions.clear();
  let y = 0;

  rows.forEach(row => {
    let x = 0;
    row.items.forEach(item => {
      const w = item.aspect * row.height;
      tilePositions.set(item.index, { x, y, w, h: row.height, cx: x + w / 2, cy: y + row.height / 2 });
      x += w + gap;
    });
    y += row.height + gap;
  });

  const totalHeight = y - gap;
  const padding = 6;
  wall.style.width = `${opts.width + padding * 2}px`;
  wall.style.height = `${totalHeight + padding * 2}px`;

  document.querySelectorAll(".tile").forEach(tile => {
    const idx = Number(tile.dataset.index);
    const pos = tilePositions.get(idx);
    if (!pos) return;
    tile.style.left = `${pos.x}px`;
    tile.style.top = `${pos.y}px`;
    tile.style.width = `${pos.w}px`;
    tile.style.height = `${pos.h}px`;
  });
}

function buildWall() {
  const fragment = document.createDocumentFragment();

  moments.forEach((moment, index) => {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.style.backgroundImage = `url("${moment.image}")`;
    tile.dataset.index = String(index);
    tile.setAttribute("aria-label", `Open ${moment.title}`);

    tile.addEventListener("pointerenter", () => setHoveredTile(index));
    tile.addEventListener("focus", () => setHoveredTile(index));
    tile.addEventListener("pointerleave", clearHoveredTiles);
    tile.addEventListener("blur", clearHoveredTiles);
    tile.addEventListener("click", () => {
      if (activeIndex >= 0) {
        closeMoment();
        return;
      }
      openMoment(index, tile);
    });

    fragment.appendChild(tile);
  });

  // attach indices to manifest entries for layout
  moments.forEach((m, i) => { m.index = i; });

  wall.appendChild(fragment);
  layoutWall();
}

function buildFloatingTiles() {
  const selected = moments.slice(0, 6);
  selected.forEach((moment, index) => {
    const tile = document.createElement("div");
    tile.className = "float-tile";
    tile.style.left = `${24 + index * 8}%`;
    tile.style.top = `${index % 2 === 0 ? 14 : 72}%`;
    tile.style.backgroundImage = `url("${moment.image}")`;
    tile.style.transitionDelay = `${index * 70}ms`;
    floatLayer.appendChild(tile);
  });
}

function setHoveredTile(index) {
  const origin = tilePositions.get(index);
  if (!origin) return;
  const reach = Math.max(origin.w, origin.h) * 1.6;

  document.querySelectorAll(".tile").forEach(tile => {
    const tileIndex = Number(tile.dataset.index);
    if (tileIndex === index) {
      tile.classList.add("is-hovered");
      tile.classList.remove("is-neighbor");
      tile.style.removeProperty("--push-x");
      tile.style.removeProperty("--push-y");
      return;
    }
    const point = tilePositions.get(tileIndex);
    if (!point) return;
    const dx = point.cx - origin.cx;
    const dy = point.cy - origin.cy;
    const distance = Math.hypot(dx, dy);
    const isNeighbor = distance <= reach;

    tile.classList.remove("is-hovered");
    tile.classList.toggle("is-neighbor", isNeighbor);

    if (isNeighbor && distance > 0) {
      const norm = 1 - Math.min(1, distance / reach);
      const strength = 14 + norm * 22;
      const ux = dx / distance;
      const uy = dy / distance;
      tile.style.setProperty("--push-x", `${ux * strength}px`);
      tile.style.setProperty("--push-y", `${uy * strength}px`);
    } else {
      tile.style.removeProperty("--push-x");
      tile.style.removeProperty("--push-y");
    }
  });
}

function clearHoveredTiles() {
  document.querySelectorAll(".tile").forEach(tile => {
    tile.classList.remove("is-hovered", "is-neighbor");
    tile.style.removeProperty("--push-x");
    tile.style.removeProperty("--push-y");
  });
}

function refreshLikeSaveButtons() {
  if (!leftActions || activeIndex < 0) return;
  const [likeBtn, saveBtn] = leftActions.querySelectorAll("button");
  if (likeBtn) likeBtn.classList.toggle("is-active", likedMoments.has(activeIndex));
  if (saveBtn) saveBtn.classList.toggle("is-active", savedMoments.has(activeIndex));
}

function openMoment(index, originTile) {
  activeIndex = (index + moments.length) % moments.length;
  const moment = moments[activeIndex];

  const tile = originTile || document.querySelector(`.tile[data-index="${activeIndex}"]`);
  if (tile) centerWallOnTile(tile);

  featureCard.classList.remove("is-hidden");
  sideActions.forEach(action => action.classList.remove("is-hidden"));
  featureCard.classList.add("is-switching");

  window.setTimeout(() => {
    titleEl.textContent = moment.title;
    kickerEl.textContent = moment.kicker;
    imageEl.src = moment.image;
    imageEl.alt = moment.alt;
    metaEl.innerHTML = `${moment.place} <span>${moment.year}</span>`;
    copyEl.textContent = `${moment.width}x${moment.height} - ${moment.source}`;

    stage.classList.toggle("light-mode", manualLight);

    document.querySelectorAll(".float-tile").forEach((tile, tileIndex) => {
      tile.classList.toggle("is-visible", (tileIndex + activeIndex) % 2 === 0);
    });

    progressFill.style.width = `${((activeIndex + 1) / moments.length) * 100}%`;
    featureCard.classList.remove("is-switching");
    refreshLikeSaveButtons();
  }, 150);
}

function closeMoment() {
  if (activeIndex < 0 && featureCard.classList.contains("is-hidden")) return;
  activeIndex = -1;
  featureCard.classList.add("is-hidden");
  sideActions.forEach(action => action.classList.add("is-hidden"));
  document.querySelectorAll(".float-tile").forEach(tile => tile.classList.remove("is-visible"));
  progressFill.style.width = "0%";
}

function moveActiveMoment(step) {
  if (activeIndex < 0) return;
  openMoment(activeIndex + step);
}

function handlePointerMove(event) {
  const rect = stage.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width - 0.5;
  const y = (event.clientY - rect.top) / rect.height - 0.5;
  stage.style.setProperty("--cursor-x", `${x * 11}rem`);
  stage.style.setProperty("--cursor-y", `${y * 7}rem`);
}

function downloadCurrentImage() {
  if (activeIndex < 0) return;
  const moment = moments[activeIndex];
  const link = document.createElement("a");
  link.href = moment.image;
  link.download = moment.source || `moment-${activeIndex + 1}.jpg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function wireSideActions() {
  if (leftActions) {
    const [likeBtn, saveBtn] = leftActions.querySelectorAll("button");
    likeBtn?.addEventListener("click", e => {
      e.stopPropagation();
      if (activeIndex < 0) return;
      if (likedMoments.has(activeIndex)) likedMoments.delete(activeIndex);
      else likedMoments.add(activeIndex);
      refreshLikeSaveButtons();
    });
    saveBtn?.addEventListener("click", e => {
      e.stopPropagation();
      if (activeIndex < 0) return;
      if (savedMoments.has(activeIndex)) savedMoments.delete(activeIndex);
      else savedMoments.add(activeIndex);
      refreshLikeSaveButtons();
    });
  }
  if (rightActions) {
    const buttons = rightActions.querySelectorAll("button");
    const [uploadBtn, downloadBtn, closeBtn] = buttons;
    uploadBtn?.addEventListener("click", e => {
      e.stopPropagation();
      uploadBtn.classList.add("is-pulse");
      window.setTimeout(() => uploadBtn.classList.remove("is-pulse"), 400);
    });
    downloadBtn?.addEventListener("click", e => {
      e.stopPropagation();
      downloadCurrentImage();
    });
    closeBtn?.addEventListener("click", e => {
      e.stopPropagation();
      closeMoment();
    });
  }
}

function wireCardActions() {
  const cardButtons = featureCard.querySelectorAll(".card-actions button");
  cardButtons.forEach(button => {
    button.addEventListener("click", e => {
      e.stopPropagation();
      button.classList.add("is-pulse");
      window.setTimeout(() => button.classList.remove("is-pulse"), 400);
    });
  });
  featureCard.addEventListener("click", e => e.stopPropagation());
}

function handleStageClick(event) {
  if (activeIndex < 0) return;
  const target = event.target;
  if (target.closest(".tile")) return;
  if (target.closest(".feature-card")) return;
  if (target.closest(".side-actions")) return;
  if (target.closest(".top-nav")) return;
  if (target.closest(".theme-button")) return;
  closeMoment();
}

function handleKeydown(event) {
  if (activeIndex < 0) return;
  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      moveActiveMoment(-1);
      break;
    case "ArrowRight":
      event.preventDefault();
      moveActiveMoment(1);
      break;
    case "Escape":
      event.preventDefault();
      closeMoment();
      break;
  }
}

previousButton.addEventListener("click", e => { e.stopPropagation(); moveActiveMoment(-1); });
nextButton.addEventListener("click", e => { e.stopPropagation(); moveActiveMoment(1); });

themeButton.addEventListener("click", e => {
  e.stopPropagation();
  manualLight = !manualLight;
  stage.classList.toggle("light-mode", manualLight);
});

stage.addEventListener("pointermove", handlePointerMove);
stage.addEventListener("click", handleStageClick);
document.addEventListener("keydown", handleKeydown);

buildWall();
buildFloatingTiles();
wireSideActions();
wireCardActions();
progressFill.style.width = "0%";

function applyInitialCenter() {
  wall.style.transition = "none";
  centerWallInitial();
  requestAnimationFrame(() => {
    wall.style.transition = "";
  });
}

if (document.readyState === "complete") {
  applyInitialCenter();
} else {
  window.addEventListener("load", applyInitialCenter);
}

window.addEventListener("resize", () => {
  layoutWall();
  if (activeIndex < 0) {
    centerWallInitial();
  } else {
    const tile = document.querySelector(`.tile[data-index="${activeIndex}"]`);
    if (tile) centerWallOnTile(tile);
  }
});
