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

const tilePattern = [
  [2, 1], [1, 2], [2, 2], [3, 1], [1, 1], [2, 1], [1, 2], [3, 2],
  [2, 1], [1, 1], [2, 2], [1, 2], [3, 1], [2, 1], [1, 1], [2, 2]
];

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

function buildWall() {
  const fragment = document.createDocumentFragment();

  moments.forEach((moment, index) => {
    const tile = document.createElement("button");
    const [colSpan, rowSpan] = tilePattern[index % tilePattern.length];

    tile.type = "button";
    tile.className = "tile";
    tile.style.gridColumn = `span ${colSpan}`;
    tile.style.gridRow = `span ${rowSpan}`;
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

  wall.appendChild(fragment);
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

function getTilePosition(index) {
  const columns = window.matchMedia("(max-width: 980px)").matches ? 14 : 20;
  return {
    x: index % columns,
    y: Math.floor(index / columns)
  };
}

function setHoveredTile(index) {
  const origin = getTilePosition(index);

  document.querySelectorAll(".tile").forEach(tile => {
    const tileIndex = Number(tile.dataset.index);
    const point = getTilePosition(tileIndex);
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    const distance = Math.hypot(dx, dy);

    tile.classList.toggle("is-hovered", tileIndex === index);
    tile.classList.toggle("is-neighbor", tileIndex !== index && distance <= 2.35);

    if (tileIndex !== index && distance <= 2.35) {
      const angleX = dx === 0 ? 0 : Math.sign(dx);
      const angleY = dy === 0 ? 0 : Math.sign(dy);
      const strength = Math.max(8, 24 - distance * 5);
      tile.style.setProperty("--push-x", `${angleX * strength}px`);
      tile.style.setProperty("--push-y", `${angleY * strength}px`);
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
  if (activeIndex < 0) {
    centerWallInitial();
  } else {
    const tile = document.querySelector(`.tile[data-index="${activeIndex}"]`);
    if (tile) centerWallOnTile(tile);
  }
});
