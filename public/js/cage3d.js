import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const CAGE_RADIUS = 5;
const BALL_RADIUS = 0.32;
const FILL_RADIUS = CAGE_RADIUS - BALL_RADIUS - 0.3;

let scene, camera, renderer, labelRenderer, controls, container;
let boundaryGroup = null;
let balls = new Map(); // number -> { mesh, label, basePos, jitter }
let mixing = false;
let animatingExtractions = []; // { mesh, label, elapsed, duration, from, to, number }
let clock = new THREE.Clock();
let currentStyle = 'sphere';

function colorForNumber(n) {
  // 9 grupos de color al estilo bingo clásico (por decenas)
  const palette = [
    0xf5f5f5, 0xffcf56, 0x35d0a0, 0xe94560, 0x5aa9ff,
    0xff8f40, 0xb968ff, 0x4fd1c5, 0xff6b81
  ];
  const groupIndex = Math.min(8, Math.floor((n - 1) / 10));
  return palette[groupIndex];
}

function randomPointInSphere(radius) {
  // Distribución uniforme en volumen (no solo en superficie)
  let x, y, z, lenSq;
  do {
    x = Math.random() * 2 - 1;
    y = Math.random() * 2 - 1;
    z = Math.random() * 2 - 1;
    lenSq = x * x + y * y + z * z;
  } while (lenSq > 1 || lenSq === 0);
  const scale = Math.cbrt(Math.random()) * radius;
  const invLen = scale / Math.sqrt(lenSq);
  return new THREE.Vector3(x * invLen, y * invLen, z * invLen);
}

function buildBoundary(style) {
  if (boundaryGroup) {
    scene.remove(boundaryGroup);
    boundaryGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  }
  boundaryGroup = new THREE.Group();

  if (style === 'cage') {
    // Jaula metálica: barras verticales + anillos horizontales
    const barMat = new THREE.MeshStandardMaterial({ color: 0xbfc7d5, metalness: 0.8, roughness: 0.3 });
    const bars = 14;
    for (let i = 0; i < bars; i++) {
      const angle = (i / bars) * Math.PI * 2;
      const geo = new THREE.CylinderGeometry(0.035, 0.035, CAGE_RADIUS * 2, 6);
      const bar = new THREE.Mesh(geo, barMat);
      bar.position.set(Math.cos(angle) * CAGE_RADIUS, 0, Math.sin(angle) * CAGE_RADIUS);
      boundaryGroup.add(bar);
    }
    const ringGeo = new THREE.TorusGeometry(CAGE_RADIUS, 0.05, 8, 40);
    for (const y of [-CAGE_RADIUS * 0.6, 0, CAGE_RADIUS * 0.6]) {
      const ring = new THREE.Mesh(ringGeo, barMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      boundaryGroup.add(ring);
    }
  } else {
    // Esfera semitransparente (cristal)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x88c8ff, transparent: true, opacity: 0.1,
      roughness: 0.15, metalness: 0, transmission: 0.4, side: THREE.DoubleSide
    });
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(CAGE_RADIUS, 32, 24), glassMat);
    boundaryGroup.add(sphere);

    const edges = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(CAGE_RADIUS, 1));
    const lineMat = new THREE.LineBasicMaterial({ color: 0xe94560, transparent: true, opacity: 0.35 });
    boundaryGroup.add(new THREE.LineSegments(edges, lineMat));
  }

  scene.add(boundaryGroup);
}

function buildBalls() {
  for (const { mesh, label } of balls.values()) {
    scene.remove(mesh);
    mesh.remove(label);
  }
  balls.clear();

  const geo = new THREE.SphereGeometry(BALL_RADIUS, 16, 12);
  for (let n = 1; n <= 90; n++) {
    const mat = new THREE.MeshStandardMaterial({ color: colorForNumber(n), roughness: 0.4, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    const basePos = randomPointInSphere(FILL_RADIUS);
    mesh.position.copy(basePos);

    const div = document.createElement('div');
    div.className = 'ball-label';
    div.textContent = n;
    div.style.cssText = 'font-size:9px;font-weight:700;color:#1a1a2e;text-shadow:0 0 2px #fff;pointer-events:none;';
    const label = new CSS2DObject(div);
    label.position.set(0, 0, 0);
    mesh.add(label);

    scene.add(mesh);
    balls.set(n, { mesh, label, basePos, jitter: new THREE.Vector3(), visible: true });
  }
}

export function initCage(containerEl, cageStyle = 'sphere') {
  container = containerEl;
  currentStyle = cageStyle;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a18);

  camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 1.5, 13);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  container.appendChild(labelRenderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const point = new THREE.PointLight(0xffffff, 1.1);
  point.position.set(6, 8, 8);
  scene.add(point);
  const point2 = new THREE.PointLight(0xe94560, 0.6);
  point2.position.set(-6, -4, 6);
  scene.add(point2);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 7;
  controls.maxDistance = 22;

  buildBoundary(currentStyle);
  buildBalls();

  window.addEventListener('resize', onResize);
  const ro = new ResizeObserver(onResize);
  ro.observe(container);

  clock.start();
  renderer.setAnimationLoop(tick);
}

function onResize() {
  if (!container || !camera || !renderer) return;
  const w = container.clientWidth, h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  labelRenderer.setSize(w, h);
}

export function setCageStyle(style) {
  currentStyle = style;
  buildBoundary(style);
}

export function setMixing(active) {
  mixing = active;
}

export function resetCage() {
  animatingExtractions = [];
  buildBalls();
}

/** Anima la extracción de una bola concreta: sale del bombo hacia la cámara y desaparece. */
export function extractBall(number) {
  const ball = balls.get(number);
  if (!ball || !ball.visible) return;
  ball.visible = false;

  const from = ball.mesh.position.clone();
  const to = new THREE.Vector3(0, -0.5, camera.position.z - 2);

  animatingExtractions.push({
    mesh: ball.mesh,
    elapsed: 0,
    duration: 1.1,
    from,
    to,
    number
  });
}

function updateMixing(dt) {
  for (const ball of balls.values()) {
    if (!ball.visible) continue;
    if (mixing) {
      ball.jitter.x += (Math.random() - 0.5) * 6 * dt;
      ball.jitter.y += (Math.random() - 0.5) * 6 * dt;
      ball.jitter.z += (Math.random() - 0.5) * 6 * dt;
      ball.jitter.multiplyScalar(0.9);
      const target = ball.basePos.clone().add(ball.jitter);
      if (target.length() > FILL_RADIUS) target.setLength(FILL_RADIUS);
      ball.mesh.position.lerp(target, 0.35);
      ball.mesh.rotation.x += dt * 4;
      ball.mesh.rotation.y += dt * 3;
    } else {
      ball.mesh.position.lerp(ball.basePos, 0.05);
    }
  }
}

function updateExtractions(dt) {
  for (let i = animatingExtractions.length - 1; i >= 0; i--) {
    const anim = animatingExtractions[i];
    anim.elapsed += dt;
    const t = Math.min(1, anim.elapsed / anim.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    anim.mesh.position.lerpVectors(anim.from, anim.to, eased);
    const scale = t < 0.7 ? 1 + t * 0.6 : 1.42 * (1 - (t - 0.7) / 0.3);
    anim.mesh.scale.setScalar(Math.max(0.001, scale));
    anim.mesh.rotation.y += dt * 6;

    if (t >= 1) {
      scene.remove(anim.mesh);
      animatingExtractions.splice(i, 1);
    }
  }
}

function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  updateMixing(dt);
  updateExtractions(dt);
  controls.update();
  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
