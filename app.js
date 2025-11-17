import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

const canvas = document.getElementById('globe');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x01040a);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 3);

const ambient = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(-5, 3, 5);
scene.add(dirLight);

const earthGroup = new THREE.Group();
scene.add(earthGroup);

const earthMaterial = new THREE.MeshPhongMaterial({
  color: 0x0d1b2a,
  emissive: 0x020b16,
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

const timeSlider = document.getElementById('timeSlider');
const timeLabel = document.getElementById('timeLabel');
const modeToggle = document.getElementById('modeToggle');
const scenarioText = document.getElementById('scenarioText');

let currentTime = Number(timeSlider.value);
let currentMode = modeToggle.value;
let continentsReady = false;

const continentColors = {
  laurentia: 0x7cd8ff,
  baltica: 0xf1c0e8,
  gondwana: 0xffb347,
  siberia: 0x9ef29c,
};

const eulerParameters = {
  laurentia: { poleLat: 70, poleLon: -100, rate: -0.4, reference: 0 },
  baltica: { poleLat: 50, poleLon: 10, rate: 0.3, reference: 0 },
  gondwana: { poleLat: -30, poleLon: 30, rate: 0.2, reference: 0 },
  siberia: { poleLat: 80, poleLon: 120, rate: -0.25, reference: 0 },
};

const eulerPoleMarkers = Object.entries(eulerParameters).map(([key, params]) => ({
  name: `${capitalize(key)} Euler pole`,
  lat: params.poleLat,
  lon: params.poleLon,
  color: 0xff6b6b,
}));

eulerPoleMarkers.forEach((marker) => {
  const mesh = createPoleMarker(marker.name, marker.color);
  mesh.position.copy(latLonToVector3(marker.lat, marker.lon, 1.05));
  poleGroup.add(mesh);
});

const apwTrack = [
  { time: 0, lat: 80, lon: -30 },
  { time: 30, lat: 75, lon: -10 },
  { time: 60, lat: 70, lon: 20 },
  { time: 90, lat: 65, lon: 45 },
  { time: 120, lat: 60, lon: 70 },
];

const geomagneticPole = createPoleMarker('Geomagnetic pole', 0xffd166);
geomagneticPole.userData.type = 'apw';
apwGroup.add(geomagneticPole);

const continents = [];

fetch('data/continents.geojson')
  .then((res) => res.json())
  .then((data) => {
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

timeSlider.addEventListener('input', (event) => {
  currentTime = Number(event.target.value);
  timeLabel.textContent = `${currentTime} Ma`;
});

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

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  earthGroup.rotation.y += delta * 0.05;

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
  continents.forEach((mesh) => mesh.setRotationFromEuler(new THREE.Euler()));
  const interpolated = interpolateTrack(apwTrack, time);
  positionApwMarker(interpolated);
}

function positionApwMarker(point) {
  const radius = 1.1;
  const position = latLonToVector3(point.lat, point.lon, radius);
  geomagneticPole.position.copy(position);
  const label = geomagneticPole.children[1];
  label.material.map = buildTextTexture(
    `Geomagnetic pole\n${point.lat.toFixed(1)}°, ${point.lon.toFixed(1)}°`
  );
  label.material.needsUpdate = true;
}

function buildContinentMesh(feature, color) {
  const coordinates = feature.geometry.coordinates[0];
  const shape = polygonToShape(coordinates);
  const geometry = new THREE.ShapeGeometry(shape, 25);
  projectGeometryToSphere(geometry, 1.01);
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

function projectGeometryToSphere(geometry, radius) {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const lon = position.getX(i);
    const lat = position.getY(i);
    const vector = latLonToVector3(lat, lon, radius);
    position.setXYZ(i, vector.x, vector.y, vector.z);
  }
  geometry.computeVertexNormals();
}

function latLonToVector3(lat, lon, radius = 1) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function interpolateTrack(track, time) {
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
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(2,4,9,0.8)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
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
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#04101f';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
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

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
