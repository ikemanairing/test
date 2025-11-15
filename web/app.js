const TWO_PI = Math.PI * 2;

function degToRad(value) {
  return (value * Math.PI) / 180;
}

function radToDeg(value) {
  return (value * 180) / Math.PI;
}

function sphericalToCartesian(latDeg, lonDeg) {
  const lat = degToRad(latDeg);
  const lon = degToRad(lonDeg);
  const cosLat = Math.cos(lat);
  return [
    cosLat * Math.cos(lon),
    cosLat * Math.sin(lon),
    Math.sin(lat),
  ];
}

function normalize(vector) {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  return vector.map((component) => component / length);
}

function rotationMatrix(axis, angleRad) {
  const [x, y, z] = normalize(axis);
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const C = 1 - c;
  return [
    [c + x * x * C, x * y * C - z * s, x * z * C + y * s],
    [y * x * C + z * s, c + y * y * C, y * z * C - x * s],
    [z * x * C - y * s, z * y * C + x * s, c + z * z * C],
  ];
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) =>
    row[0] * vector[0] + row[1] * vector[1] + row[2] * vector[2]
  );
}

function transposeMatrix(matrix) {
  return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
}

function cartesianToSpherical(vector) {
  const [x, y, z] = vector;
  const lat = radToDeg(Math.asin(Math.min(Math.max(z, -1), 1)));
  const lon = radToDeg(Math.atan2(y, x));
  return [lat, lon];
}

function linspace(start, end, steps) {
  if (steps === 1) return [start];
  const values = new Array(steps);
  const stepSize = (end - start) / (steps - 1);
  for (let i = 0; i < steps; i += 1) {
    values[i] = start + i * stepSize;
  }
  return values;
}

function simulatePlateMotion(params) {
  const time = linspace(0, params.totalTime, params.timeSteps);
  const axis = sphericalToCartesian(params.axisLat, params.axisLon);
  const poleVector = [0, 0, 1];
  const continentVector = sphericalToCartesian(
    params.continentLat,
    params.continentLon
  );

  const continentTrack = [];
  const apparentTrack = [];

  for (const t of time) {
    const angle = degToRad(params.angularVelocity * t);
    const rotation = rotationMatrix(axis, angle);
    const pastContinent = multiplyMatrixVector(rotation, continentVector);
    const apparentPole = multiplyMatrixVector(
      transposeMatrix(rotation),
      poleVector
    );
    continentTrack.push(cartesianToSpherical(pastContinent));
    apparentTrack.push(cartesianToSpherical(apparentPole));
  }

  return { time, continentTrack, apparentTrack };
}

function drawBackground(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  for (let lon = -120; lon <= 180; lon += 60) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
  ctx.strokeRect(0, 0, width, height);

  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.font = "12px 'Segoe UI', sans-serif";
  ctx.fillText("Longitude (°)", width / 2 - 40, height - 8);
  ctx.save();
  ctx.translate(12, height / 2 + 40);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Latitude (°)", 0, 0);
  ctx.restore();
}

function plotTrack(ctx, track, options) {
  const { width, height } = ctx.canvas;
  const toCanvas = ([lat, lon]) => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  ctx.strokeStyle = options.lineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  track.forEach((point, index) => {
    const [x, y] = toCanvas(point);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  const start = toCanvas(track[0]);
  const end = toCanvas(track[track.length - 1]);

  ctx.fillStyle = options.startColor;
  ctx.beginPath();
  ctx.arc(start[0], start[1], 6, 0, TWO_PI);
  ctx.fill();

  ctx.fillStyle = options.endColor;
  ctx.beginPath();
  ctx.arc(end[0], end[1], 6, 0, TWO_PI);
  ctx.fill();
}

function formatNumber(value) {
  return Number.parseFloat(value).toFixed(2);
}

function updateSummaryTable(tableBody, simulation) {
  tableBody.innerHTML = "";
  const stride = Math.max(1, Math.floor(simulation.time.length / 10));
  simulation.time.forEach((timeValue, index) => {
    if (index % stride !== 0 && index !== simulation.time.length - 1) {
      return;
    }

    const continent = simulation.continentTrack[index];
    const apparent = simulation.apparentTrack[index];
    const row = document.createElement("tr");
    const cells = [
      formatNumber(timeValue),
      formatNumber(continent[0]),
      formatNumber(continent[1]),
      formatNumber(apparent[0]),
      formatNumber(apparent[1]),
    ];
    for (const value of cells) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    }
    tableBody.appendChild(row);
  });
}

function runSimulation(form) {
  const formData = new FormData(form);
  const params = {
    angularVelocity: Number(formData.get("angularVelocity")),
    axisLat: Number(formData.get("axisLat")),
    axisLon: Number(formData.get("axisLon")),
    totalTime: Number(formData.get("totalTime")),
    timeSteps: Number(formData.get("timeSteps")),
    continentLat: Number(formData.get("continentLat")),
    continentLon: Number(formData.get("continentLon")),
  };

  const simulation = simulatePlateMotion(params);

  const continentCanvas = document.getElementById("continental-canvas");
  const apwCanvas = document.getElementById("apw-canvas");
  const continentCtx = continentCanvas.getContext("2d");
  const apwCtx = apwCanvas.getContext("2d");

  drawBackground(continentCtx, continentCanvas.width, continentCanvas.height);
  drawBackground(apwCtx, apwCanvas.width, apwCanvas.height);

  plotTrack(continentCtx, simulation.continentTrack, {
    lineColor: "#1b5fd9",
    startColor: "#1b5fd9",
    endColor: "#f28f16",
  });

  plotTrack(apwCtx, simulation.apparentTrack, {
    lineColor: "#d92e4b",
    startColor: "#d92e4b",
    endColor: "#28a745",
  });

  const tableBody = document.querySelector("#summary-table tbody");
  updateSummaryTable(tableBody, simulation);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("controls-form");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    runSimulation(form);
  });

  // Run once on load with default values.
  runSimulation(form);
});
