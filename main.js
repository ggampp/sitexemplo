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

const moments = Array.isArray(window.MOMENT_IMAGES) ? window.MOMENT_IMAGES : [];

const tilePattern = [
  [2, 1], [1, 2], [2, 2], [3, 1], [1, 1], [2, 1], [1, 2], [3, 2],
  [2, 1], [1, 1], [2, 2], [1, 2], [3, 1], [2, 1], [1, 1], [2, 2]
];

let activeIndex = -1;
let manualLight = false;

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

    if (index % 11 === 0 || index % 17 === 0) tile.classList.add("is-lifted");
    if (index % 7 === 0) tile.classList.add("is-muted");

    tile.addEventListener("pointerenter", () => setHoveredTile(index));
    tile.addEventListener("focus", () => setHoveredTile(index));
    tile.addEventListener("pointerleave", clearHoveredTiles);
    tile.addEventListener("blur", clearHoveredTiles);
    tile.addEventListener("click", () => openMoment(index));

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

function openMoment(index) {
  activeIndex = (index + moments.length) % moments.length;
  const moment = moments[activeIndex];

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

    const x = ((activeIndex % 9) - 4) * -1.15;
    const y = ((activeIndex % 7) - 3) * -0.9;
    stage.style.setProperty("--wall-x", `${x}%`);
    stage.style.setProperty("--wall-y", `${y}%`);
    stage.style.setProperty("--wall-scale", "1.08");
    stage.classList.toggle("light-mode", manualLight);

    document.querySelectorAll(".float-tile").forEach((tile, tileIndex) => {
      tile.classList.toggle("is-visible", (tileIndex + activeIndex) % 2 === 0);
    });

    progressFill.style.width = `${((activeIndex + 1) / moments.length) * 100}%`;
    featureCard.classList.remove("is-switching");
  }, 150);
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
  wall.style.translate = `${x * -22}px ${y * -16}px`;
}

previousButton.addEventListener("click", () => moveActiveMoment(-1));
nextButton.addEventListener("click", () => moveActiveMoment(1));

themeButton.addEventListener("click", () => {
  manualLight = !manualLight;
  stage.classList.toggle("light-mode", manualLight);
});

stage.addEventListener("pointermove", handlePointerMove);

buildWall();
buildFloatingTiles();
progressFill.style.width = "0%";
