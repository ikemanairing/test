// Three.js 핵심 모듈을 CDN에서 불러온다.
import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('globe');
// 전역으로 사용하는 렌더러를 준비한다.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0xffffff, 1);

// 장면(Scene)과 배경색을 지정한다.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf6f7fb);

// 지구본을 보기 위한 원근 카메라를 구성한다.
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 3);

// 사용자의 드래그, 확대/축소 상태를 추적하는 객체
const interactionState = {
  isDragging: false,
  pointerId: null,
  previous: new THREE.Vector2(),
  dragSpeed: 0.005,
  userRotX: 0,
  userRotY: 0,
  autoRot: 0,
};

// 부드러운 광원 구성을 통해 지구본을 입체감 있게 만든다.
const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(-5, 3, 5);
scene.add(dirLight);

// 지구, 대륙, 극 위치를 묶는 최상위 그룹
const earthGroup = new THREE.Group();
scene.add(earthGroup);

const earthMaterial = new THREE.MeshPhongMaterial({
  color: 0x1a4c82,
  emissive: 0x041429,
  map: createGridTexture(),
  shininess: 8,
});
const earthMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 64), earthMaterial);
earthGroup.add(earthMesh);

const continentsGroup = new THREE.Group();
const poleGroup = new THREE.Group();
const apwGroup = new THREE.Group();
earthGroup.add(continentsGroup);
earthGroup.add(poleGroup);
earthGroup.add(apwGroup);

// UI 요소 핸들러들을 미리 찾아둔다.
const timeSlider = document.getElementById('timeSlider');
const timeLabel = document.getElementById('timeLabel');
const modeToggle = document.getElementById('modeToggle');
const scenarioText = document.getElementById('scenarioText');

const minTime = Number(timeSlider.min);
const maxTime = Number(timeSlider.max);
const playbackSpeed = 6; // Ma per second
let currentTime = Number(timeSlider.value);
let currentMode = modeToggle.value;
let continentsReady = false;
let isScrubbing = false;

updateTimeLabel();

// 단일 대륙에 사용할 색상 팔레트
const continentColors = {
  paleocontinent: 0xf6a766,
};

// 대륙 회전을 제어할 오일러 극 파라미터
const eulerParameters = {
  paleocontinent: { poleLat: 55, poleLon: -110, rate: 0.35, reference: 0 },
};

const eulerPoleMarker = createPoleMarker('Euler pole', 0xff6b6b);
eulerPoleMarker.position.copy(
  latLonToVector3(eulerParameters.paleocontinent.poleLat, eulerParameters.paleocontinent.poleLon, 1.05)
);
poleGroup.add(eulerPoleMarker);

// 지자기 북극 경로(APW track)
const apwTrack = [
  { time: 0, lat: 78, lon: -40 },
  { time: 40, lat: 74, lon: -5 },
  { time: 80, lat: 68, lon: 25 },
  { time: 120, lat: 62, lon: 55 },
];

const geomagneticPole = createPoleMarker('Geomagnetic pole', 0xffd166);
geomagneticPole.userData.type = 'apw';
apwGroup.add(geomagneticPole);

// 로딩된 대륙 메시를 담아 둘 배열
const continents = [];

fetch('data/continents.geojson')
  .then((res) => res.json())
  .then((data) => {
    // GeoJSON에 포함된 모든 폴리곤을 3D 메시로 변환한다.
    data.features.forEach((feature) => {
      const key = feature.properties.key;
      const color = continentColors[key] ?? 0xffffff;
      const mesh = buildContinentMesh(feature, color);
      mesh.userData.euler = eulerParameters[key];
      mesh.userData.name = feature.properties.name;
      continentsGroup.add(mesh);
      continents.push(mesh);
    });
    continentsReady = true;
  })
  .catch((err) => console.error('Failed to load continents', err));

// 슬라이더를 드래그하는 동안 자동 재생을 잠깐 멈춘다.
['pointerdown', 'touchstart'].forEach((evt) => {
  timeSlider.addEventListener(evt, () => {
    isScrubbing = true;
  });
});

['pointerup', 'touchend', 'touchcancel', 'pointercancel'].forEach((evt) => {
  window.addEventListener(evt, () => {
    isScrubbing = false;
  });
});

// 슬라이더 입력을 수신하여 현재 시간을 즉시 반영한다.
timeSlider.addEventListener('input', (event) => {
  currentTime = Number(event.target.value);
  updateTimeLabel();
});

// 모드 토글을 통해 Plate/APW 시나리오를 전환한다.
modeToggle.addEventListener('change', (event) => {
  currentMode = event.target.value;
  scenarioText.textContent = `Scenario: ${
    currentMode === 'plate' ? 'Plate Motion' : 'APW-only'
  }`;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 카메라 줌 한계를 정의해 과도한 확대/축소를 막는다.
const zoomLimits = { min: 1.6, max: 5.5 };

renderer.domElement.addEventListener('pointerdown', (event) => {
  // 드래그 시작 시 포인터를 추적한다.
  interactionState.isDragging = true;
  interactionState.pointerId = event.pointerId;
  renderer.domElement.setPointerCapture(event.pointerId);
  interactionState.previous.set(event.clientX, event.clientY);
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (!interactionState.isDragging || event.pointerId !== interactionState.pointerId) {
    return;
  }
  // 포인터 이동량을 통해 위도/경도 회전을 계산한다.
  const deltaX = event.clientX - interactionState.previous.x;
  const deltaY = event.clientY - interactionState.previous.y;
  interactionState.userRotY += deltaX * interactionState.dragSpeed;
  interactionState.userRotX += deltaY * interactionState.dragSpeed;
  interactionState.userRotX = THREE.MathUtils.clamp(
    interactionState.userRotX,
    -Math.PI / 2 + 0.2,
    Math.PI / 2 - 0.2
  );
  interactionState.previous.set(event.clientX, event.clientY);
});

const releasePointer = (event) => {
  // 포인터 해제 시 드래그 상태를 리셋한다.
  if (interactionState.pointerId !== null && event.pointerId === interactionState.pointerId) {
    renderer.domElement.releasePointerCapture(interactionState.pointerId);
  }
  interactionState.isDragging = false;
  interactionState.pointerId = null;
};

renderer.domElement.addEventListener('pointerup', releasePointer);
renderer.domElement.addEventListener('pointerleave', releasePointer);

renderer.domElement.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    // 스크롤 휠 값으로 카메라 거리를 조정한다.
    const zoomDelta = event.deltaY * 0.002;
    camera.position.z = THREE.MathUtils.clamp(
      camera.position.z + zoomDelta,
      zoomLimits.min,
      zoomLimits.max
    );
  },
  { passive: false }
);

// 애니메이션용 시계를 생성한다.
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (!interactionState.isDragging) {
    interactionState.autoRot += delta * 0.05;
  }
  // 사용자 입력과 자동 회전을 혼합하여 지구본 방향을 결정한다.
  earthGroup.rotation.set(
    interactionState.userRotX,
    interactionState.userRotY + interactionState.autoRot,
    0
  );

  if (!isScrubbing) {
    // 타임라인 자동 재생 로직
    currentTime += delta * playbackSpeed;
    if (currentTime > maxTime) {
      currentTime = minTime;
    }
    if (currentTime < minTime) {
      currentTime = maxTime;
    }
    timeSlider.value = String(Math.round(currentTime));
    updateTimeLabel();
  }

  if (continentsReady) {
    if (currentMode === 'plate') {
      updatePlateMotion(currentTime);
    } else {
      updateApwMotion(currentTime);
    }
  }

  renderer.render(scene, camera);
}

animate();

function updatePlateMotion(time) {
  // Plate 모드에서는 대륙 메시를 오일러 극 기준으로 회전시킨다.
  continents.forEach((mesh) => {
    const euler = mesh.userData.euler;
    if (!euler) {
      mesh.setRotationFromEuler(new THREE.Euler());
      return;
    }
    const axis = latLonToVector3(euler.poleLat, euler.poleLon, 1).normalize();
    const angle = THREE.MathUtils.degToRad(euler.rate * (time - euler.reference));
    const quaternion = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    mesh.setRotationFromQuaternion(quaternion);
  });
  positionApwMarker(apwTrack[0]);
}

function updateApwMotion(time) {
  // APW 모드에서는 대륙을 정지시키고 극 트랙만 움직인다.
  continents.forEach((mesh) => mesh.setRotationFromEuler(new THREE.Euler()));
  const interpolated = interpolateTrack(apwTrack, time);
  positionApwMarker(interpolated);
}

function positionApwMarker(point) {
  // 지자기 북극 메시를 특정 위도/경도로 이동시킨다.
  const radius = 1.1;
  const position = latLonToVector3(point.lat, point.lon, radius);
  geomagneticPole.position.copy(position);
  const label = geomagneticPole.children[1];
  label.material.map = buildTextTexture(
    `Geomagnetic pole\n${point.lat.toFixed(1)}°, ${point.lon.toFixed(1)}°`
  );
  label.material.needsUpdate = true;
}

function updateTimeLabel() {
  // UI 텍스트에 현재 시간(백만 년 전)을 표시한다.
  timeLabel.textContent = `${Math.round(currentTime)} Ma`;
}

function buildContinentMesh(feature, color) {
  // GeoJSON 폴리곤을 ShapeGeometry로 만든 뒤 구 위로 투영한다.
  const coordinates = feature.geometry.coordinates[0];
  const shape = polygonToShape(densifyCoordinates(coordinates));
  const geometry = new THREE.ShapeGeometry(shape, 25);
  projectGeometryToSphere(geometry, 1.01);
  applySphericalNormals(geometry);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.6,
    metalness: 0.05,
    transparent: true,
    opacity: 0.9,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function polygonToShape(coords) {
  const shape = new THREE.Shape();
  coords.forEach(([lon, lat], index) => {
    const x = lon;
    const y = lat;
    if (index === 0) {
      shape.moveTo(x, y);
    } else {
      shape.lineTo(x, y);
    }
  });
  return shape;
}

function densifyCoordinates(coords, maxStep = 3) {
  // 경계선의 큰 간격을 일정 각도 이하로 잘게 분할한다.
  if (!coords.length) {
    return coords;
  }
  const result = [];
  for (let i = 0; i < coords.length - 1; i++) {
    const current = coords[i];
    const next = coords[i + 1];
    appendSegmentPoints(result, current, next, maxStep);
  }
  // 폴리곤이 닫혀 있지 않다면 마지막 점과 첫 점을 다시 분할한다.
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    appendSegmentPoints(result, last, first, maxStep);
  }
  // 마지막으로 첫 좌표를 명시적으로 추가해 Shape가 정확히 닫히도록 한다.
  result.push([result[0][0], result[0][1]]);
  return result;
}

function appendSegmentPoints(target, start, end, maxStep) {
  target.push(start);
  const lonDiff = Math.abs(end[0] - start[0]);
  const latDiff = Math.abs(end[1] - start[1]);
  const steps = Math.max(1, Math.ceil(Math.max(lonDiff, latDiff) / maxStep));
  for (let step = 1; step < steps; step++) {
    const t = step / steps;
    target.push([
      THREE.MathUtils.lerp(start[0], end[0], t),
      THREE.MathUtils.lerp(start[1], end[1], t),
    ]);
  }
}

function projectGeometryToSphere(geometry, radius) {
  // 평면 좌표(위도/경도)를 실제 구면 좌표로 변환한다.
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const lon = position.getX(i);
    const lat = position.getY(i);
    const vector = latLonToVector3(lat, lon, radius);
    position.setXYZ(i, vector.x, vector.y, vector.z);
  }
}

function applySphericalNormals(geometry) {
  // 각 정점의 위치 벡터를 그대로 노멀로 사용해 조명을 구면과 일치시킨다.
  const position = geometry.attributes.position;
  const normals = new Float32Array(position.count * 3);
  const normal = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    normal.set(position.getX(i), position.getY(i), position.getZ(i)).normalize();
    normals[i * 3] = normal.x;
    normals[i * 3 + 1] = normal.y;
    normals[i * 3 + 2] = normal.z;
  }
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
}

function latLonToVector3(lat, lon, radius = 1) {
  // 위도/경도를 Three.js 좌표계로 변환한다.
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function interpolateTrack(track, time) {
  // 주어진 시간에 맞는 APW 위치를 보간한다.
  if (time <= track[0].time) {
    return track[0];
  }
  if (time >= track[track.length - 1].time) {
    return track[track.length - 1];
  }
  for (let i = 0; i < track.length - 1; i++) {
    const current = track[i];
    const next = track[i + 1];
    if (time >= current.time && time <= next.time) {
      const t = (time - current.time) / (next.time - current.time);
      const lat = THREE.MathUtils.lerp(current.lat, next.lat, t);
      const lon = THREE.MathUtils.lerp(current.lon, next.lon, t);
      return { time, lat, lon };
    }
  }
  return track[track.length - 1];
}

function createPoleMarker(text, color) {
  // 극 위치를 나타내는 작은 구 + 텍스트 스프라이트를 생성한다.
  const group = new THREE.Group();
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 16, 16),
    new THREE.MeshBasicMaterial({ color })
  );
  group.add(sphere);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: buildTextTexture(text) })
  );
  sprite.position.set(0, 0.04, 0);
  sprite.scale.set(0.25, 0.12, 1);
  group.add(sprite);
  return group;
}

function buildTextTexture(text) {
  // HTML 캔버스에 텍스트를 그려 스프라이트 텍스처로 사용한다.
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(15,23,42,0.15)';
  ctx.strokeRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0f172a';
  ctx.font = '28px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    ctx.fillText(line, canvas.width / 2, canvas.height / 2 + index * 28 - (lines.length - 1) * 14);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createGridTexture() {
  // 지구 표면에 표시할 경위선 격자 텍스처를 만든다.
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#052043';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 18; i++) {
    const y = (i / 18) * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (let j = 0; j <= 36; j++) {
    const x = (j / 36) * size;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

