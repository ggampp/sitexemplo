import * as THREE from 'three';
import Lenis      from 'lenis';

// gsap + ScrollTrigger loaded as globals via script tags
gsap.registerPlugin(ScrollTrigger);

// ──────────────────────────────────────────────────────────
// CHAPTER PALETTE
// ──────────────────────────────────────────────────────────
const CHAPTERS = [
  { a: new THREE.Color(0x060614), b: new THREE.Color(0x160830) }, // I  – deep midnight
  { a: new THREE.Color(0x190535), b: new THREE.Color(0x780f45) }, // II – purple → rose
  { a: new THREE.Color(0x020d18), b: new THREE.Color(0x07364e) }, // III– dark teal
  { a: new THREE.Color(0x1a0700), b: new THREE.Color(0x9c4000) }, // IV – ember
  { a: new THREE.Color(0x221410), b: new THREE.Color(0xc8986a) }, // V  – warm gold
];

// ──────────────────────────────────────────────────────────
// THREE.JS  –  fullscreen shader quad
// ──────────────────────────────────────────────────────────
const canvas   = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene  = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const uniforms = {
  uTime:   { value: 0.0 },
  uMouse:  { value: new THREE.Vector2(0.5, 0.5) },
  uColorA: { value: CHAPTERS[0].a.clone() },
  uColorB: { value: CHAPTERS[0].b.clone() },
  uAspect: { value: window.innerWidth / window.innerHeight },
};

// ── vertex shader ──────────────────────────────────────────
const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

// ── fragment shader  (domain-warped FBM + mouse ripple) ───
const FRAG = /* glsl */`
precision highp float;

uniform float uTime;
uniform vec2  uMouse;
uniform vec3  uColorA;
uniform vec3  uColorB;
uniform float uAspect;
varying vec2  vUv;

/* ---- gradient noise ---- */
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float gnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)),
        dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)),
        dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
}

/* ---- fractal brownian motion (6 octaves) ---- */
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 R = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 6; i++) {
    v += a * gnoise(p);
    p  = R * p * 2.1;
    a *= 0.48;
  }
  return v;
}

void main() {
  vec2 uv = vec2(vUv.x * uAspect, vUv.y);

  /* mouse influence – soft radial ripple */
  vec2 m  = vec2(uMouse.x * uAspect, uMouse.y);
  float d = length(uv - m);
  float ripple = smoothstep(0.65, 0.0, d) * 0.22;

  /* domain warping: two layers create the painted-canvas look */
  float t = uTime * 0.038;
  vec2 q = vec2(
    fbm(uv + t),
    fbm(uv + vec2(3.1, 7.4) + t)
  );
  vec2 r = vec2(
    fbm(uv + 4.0 * q + vec2(1.7, 9.2) + t * 0.55 + ripple),
    fbm(uv + 4.0 * q + vec2(8.3, 2.8) + t * 0.55 + ripple)
  );
  float f = fbm(uv + 4.0 * r + t * 0.28);

  /* blend between two chapter colours */
  float blend = clamp((f + 1.0) * 0.5, 0.0, 1.0);
  blend = smoothstep(0.22, 0.78, blend + ripple * 0.35);
  vec3 col = mix(uColorA, uColorB, blend);

  /* vignette */
  float vig = 1.0 - smoothstep(0.28, 1.25, length(vUv - 0.5) * 1.65);
  col *= vig;

  /* micro painted-texture detail */
  col += gnoise(uv * 14.0 + t) * 0.022;

  gl_FragColor = vec4(col, 1.0);
}`;

const quad = new THREE.Mesh(
  new THREE.PlaneGeometry(2, 2),
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms })
);
scene.add(quad);

// ──────────────────────────────────────────────────────────
// LENIS  –  buttery smooth scroll
// ──────────────────────────────────────────────────────────
const lenis = new Lenis({
  duration:      1.55,
  easing:        t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel:   true,
  wheelMultiplier: 0.78,
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(time => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// scroll progress bar
const progressFill = document.getElementById('progress-fill');
lenis.on('scroll', ({ progress }) => {
  progressFill.style.width = (progress * 100).toFixed(2) + '%';
});

// ──────────────────────────────────────────────────────────
// CHAPTER COLOUR TRANSITIONS
// ──────────────────────────────────────────────────────────
let activeChapter = 0;

function activateChapter(i) {
  if (i === activeChapter) return;
  activeChapter = i;

  document.querySelectorAll('.nav-dot').forEach((d, j) => {
    d.classList.toggle('active', j === i);
  });

  const { a, b } = CHAPTERS[i];
  gsap.to(uniforms.uColorA.value, {
    r: a.r, g: a.g, b: a.b,
    duration: 2.0, ease: 'power2.inOut',
  });
  gsap.to(uniforms.uColorB.value, {
    r: b.r, g: b.g, b: b.b,
    duration: 2.0, ease: 'power2.inOut',
  });
}

// ──────────────────────────────────────────────────────────
// GSAP SCROLLTRIGGER  –  cinematic entrance per chapter
// ──────────────────────────────────────────────────────────
document.querySelectorAll('.chapter').forEach((section, i) => {
  const eyebrow = section.querySelector('.chapter-eyebrow');
  const title   = section.querySelector('.chapter-title');
  const body    = section.querySelector('.chapter-body');
  const line    = section.querySelector('.ch-line');
  const ending  = section.querySelector('.story-end');

  // colour trigger (fires slightly before centre)
  ScrollTrigger.create({
    trigger:     section,
    start:       'top 58%',
    onEnter:     () => activateChapter(i),
    onEnterBack: () => activateChapter(i),
  });

  // chapter 0 is animated on load; skip scroll entrance for it
  if (i === 0) return;

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger:       section,
      start:         'top 68%',
      toggleActions: 'play none none reverse',
    },
  });

  tl.fromTo(eyebrow,
    { opacity: 0, y: 16 },
    { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out' }
  )
  .fromTo(title,
    { opacity: 0, y: 38, clipPath: 'inset(0 0 100% 0)' },
    { opacity: 1, y: 0,  clipPath: 'inset(0 0 0% 0)', duration: 1.05, ease: 'power3.out' },
    '-=0.38'
  )
  .fromTo(body,
    { opacity: 0, y: 24 },
    { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out' },
    '-=0.5'
  )
  .fromTo(line,
    { height: 0 },
    { height: 64, duration: 0.9, ease: 'power2.inOut' },
    '-=0.42'
  );

  if (ending) {
    tl.fromTo(ending,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' },
      '-=0.3'
    );
  }
});

// ──────────────────────────────────────────────────────────
// CHAPTER 0  –  on-load entrance animation
// ──────────────────────────────────────────────────────────
const c0 = document.getElementById('chapter-0');

gsap.fromTo(c0.querySelector('.chapter-eyebrow'),
  { opacity: 0, y: 16 },
  { opacity: 1, y: 0, duration: 0.85, delay: 0.5, ease: 'power3.out' }
);
gsap.fromTo(c0.querySelector('.chapter-title'),
  { opacity: 0, y: 38, clipPath: 'inset(0 0 100% 0)' },
  { opacity: 1, y: 0,  clipPath: 'inset(0 0 0% 0)', duration: 1.15, delay: 0.75, ease: 'power3.out' }
);
gsap.fromTo(c0.querySelector('.chapter-body'),
  { opacity: 0, y: 24 },
  { opacity: 1, y: 0, duration: 0.9, delay: 1.0, ease: 'power3.out' }
);
gsap.fromTo(c0.querySelector('.ch-line'),
  { height: 0 },
  { height: 64, duration: 1.0, delay: 1.25, ease: 'power2.inOut' }
);

// ──────────────────────────────────────────────────────────
// NAV DOT CLICKS
// ──────────────────────────────────────────────────────────
document.querySelectorAll('.nav-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    const i      = parseInt(dot.dataset.chapter, 10);
    const target = document.getElementById(`chapter-${i}`);
    lenis.scrollTo(target, {
      offset:   0,
      duration: 1.55,
      easing:   t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });
  });
});

// ──────────────────────────────────────────────────────────
// CURSOR  +  MOUSE → SHADER
// ──────────────────────────────────────────────────────────
const cursorDot  = document.getElementById('cursor-dot');
const cursorRing = document.getElementById('cursor-ring');

let cx = 0, cy = 0;   // raw cursor
let rx = 0, ry = 0;   // ring (lagged)

const mouseNorm = new THREE.Vector2(0.5, 0.5);   // target for shader
const mouseLerp = new THREE.Vector2(0.5, 0.5);   // smoothed for shader

window.addEventListener('mousemove', e => {
  cx = e.clientX;
  cy = e.clientY;
  mouseNorm.x = cx / window.innerWidth;
  mouseNorm.y = 1.0 - cy / window.innerHeight;
});

// ──────────────────────────────────────────────────────────
// INTRO VEIL FADE-OUT
// ──────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  gsap.to('#intro-veil', {
    opacity:    0,
    duration:   1.3,
    delay:      0.15,
    ease:       'power2.inOut',
    onComplete: () => {
      const veil = document.getElementById('intro-veil');
      if (veil) veil.style.display = 'none';
    },
  });
});

// ──────────────────────────────────────────────────────────
// RENDER LOOP
// ──────────────────────────────────────────────────────────
function tick(ts) {
  requestAnimationFrame(tick);

  uniforms.uTime.value = ts * 0.001;

  // smooth mouse for shader
  mouseLerp.x += (mouseNorm.x - mouseLerp.x) * 0.045;
  mouseLerp.y += (mouseNorm.y - mouseLerp.y) * 0.045;
  uniforms.uMouse.value.copy(mouseLerp);

  // cursor dot (instant)
  cursorDot.style.left = cx + 'px';
  cursorDot.style.top  = cy + 'px';

  // cursor ring (lagged)
  rx += (cx - rx) * 0.1;
  ry += (cy - ry) * 0.1;
  cursorRing.style.left = rx + 'px';
  cursorRing.style.top  = ry + 'px';

  renderer.render(scene, camera);
}

requestAnimationFrame(tick);

// ──────────────────────────────────────────────────────────
// RESIZE
// ──────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  uniforms.uAspect.value = window.innerWidth / window.innerHeight;
});
