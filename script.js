// Get canvas and context
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Projection parameters
let angle3D = { x: 0, y: 0, z: 0 };
let angle4D = { x: 0, y: 0, z: 0, w: 0 };
let distance = 5;
let autoRotate = true;

// Wind parameters
let wind = { x: 0, y: 0, z: 0, w: 0.5 };
let windIntensity = 0.5;

// Torus parameters
const numTesseracts = 32; // Number of tesseracts in the torus
const majorRadius = 2.5;  // Distance from center of torus to center of tube
const minorRadius = 0.8;  // Radius of the tube
let tesseractPositions = [];

// Generate tesseract positions along torus
function generateTorusPositions() {
    tesseractPositions = [];
    for (let i = 0; i < numTesseracts; i++) {
        const u = (i / numTesseracts) * Math.PI * 2; // Major circle parameter
        const v = (i / numTesseracts) * Math.PI * 2 * 3; // Minor circle parameter (spiral)
        
        // Torus parametric equations in 3D
        const x = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
        const y = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
        const z = minorRadius * Math.sin(v);
        const w = 0; // Start in 3D, but we can use w for additional movement
        
        tesseractPositions.push({
            offset: [x, y, z, w],
            rotation: [u, v * 2, u * 1.5, 0] // Individual rotation for each tesseract
        });
    }
}

generateTorusPositions();

// Mouse control
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

// Tesseract vertex coordinates (4D)
const tesseractVertices = [
    [-1, -1, -1, -1], [1, -1, -1, -1], [1, 1, -1, -1], [-1, 1, -1, -1],
    [-1, -1, 1, -1], [1, -1, 1, -1], [1, 1, 1, -1], [-1, 1, 1, -1],
    [-1, -1, -1, 1], [1, -1, -1, 1], [1, 1, -1, 1], [-1, 1, -1, 1],
    [-1, -1, 1, 1], [1, -1, 1, 1], [1, 1, 1, 1], [-1, 1, 1, 1]
];

// Edge connections in the tesseract
const tesseractEdges = [
    [0, 1], [1, 2], [2, 3], [3, 0],    // Face 1
    [4, 5], [5, 6], [6, 7], [7, 4],    // Face 2
    [0, 4], [1, 5], [2, 6], [3, 7],    // Connecting edges
    [8, 9], [9, 10], [10, 11], [11, 8], // Face 3
    [12, 13], [13, 14], [14, 15], [15, 12], // Face 4
    [8, 12], [9, 13], [10, 14], [11, 15], // Connecting edges (w dimension)
    [0, 8], [1, 9], [2, 10], [3, 11],   // 4D connections
    [4, 12], [5, 13], [6, 14], [7, 15]  // 4D connections
];

// Rotate 4D point
function rotate4D(point, angles) {
    let [x, y, z, w] = point;
    
    // XY rotation
    {
        const tempX = x * Math.cos(angles.x) - y * Math.sin(angles.x);
        const tempY = x * Math.sin(angles.x) + y * Math.cos(angles.x);
        x = tempX;
        y = tempY;
    }
    
    // XZ rotation
    {
        const tempX = x * Math.cos(angles.z) - z * Math.sin(angles.z);
        const tempZ = x * Math.sin(angles.z) + z * Math.cos(angles.z);
        x = tempX;
        z = tempZ;
    }
    
    // XW rotation
    {
        const tempX = x * Math.cos(angles.w) - w * Math.sin(angles.w);
        const tempW = x * Math.sin(angles.w) + w * Math.cos(angles.w);
        x = tempX;
        w = tempW;
    }
    
    // YZ rotation
    {
        const tempY = y * Math.cos(angles.y) - z * Math.sin(angles.y);
        const tempZ = y * Math.sin(angles.y) + z * Math.cos(angles.y);
        y = tempY;
        z = tempZ;
    }
    
    return [x, y, z, w];
}

// Project 4D to 3D
function project4DTo3D(point) {
    // Apply 4D perspective projection
    const [x, y, z, w] = point;
    const d = distance; // Camera distance
    const factor = d / (d - w);
    return [
        x * factor,
        y * factor,
        z * factor
    ];
}

// Project 3D to 2D
function project3DTo2D(point3D) {
    const [x, y, z] = point3D;
    const fov = 500;
    const scale = fov / (fov + z);
    return [
        x * scale,
        y * scale
    ];
}

// Transform point from world to screen space
function transform(point, offset = [0, 0, 0, 0]) {
    // Add offset (torus position)
    const positionedPoint = [
        point[0] + offset[0],
        point[1] + offset[1],
        point[2] + offset[2],
        point[3] + offset[3]
    ];
    
    // Apply wind deformation
    const windInfluence = windIntensity * 0.3;
    const windPoint = [
        positionedPoint[0] + wind.x * windInfluence,
        positionedPoint[1] + wind.y * windInfluence,
        positionedPoint[2] + wind.z * windInfluence,
        positionedPoint[3] + wind.w * windInfluence
    ];
    
    // Rotate in 4D space
    const rotated = rotate4D(windPoint, angle4D);
    
    // Project 4D to 3D
    const projected3D = project4DTo3D(rotated);
    
    // Apply 3D rotation
    let [x, y, z] = projected3D;
    const ax = angle3D.x, ay = angle3D.y, az = angle3D.z;
    
    // Rotate around X axis
    const y1 = y * Math.cos(ax) - z * Math.sin(ax);
    const z1 = y * Math.sin(ax) + z * Math.cos(ax);
    y = y1; z = z1;
    
    // Rotate around Y axis
    const x1 = x * Math.cos(ay) - z * Math.sin(ay);
    const z2 = x * Math.sin(ay) + z * Math.cos(ay);
    x = x1; z = z2;
    
    // Rotate around Z axis
    const x2 = x * Math.cos(az) - y * Math.sin(az);
    const y2 = x * Math.sin(az) + y * Math.cos(az);
    x = x2; y = y2;
    
    // Project 3D to 2D
    const screen = project3DTo2D([x, y, z]);
    
    return {
        x: canvas.width / 2 + screen[0] * 100,
        y: canvas.height / 2 + screen[1] * 100,
        z: z // Keep Z for depth sorting
    };
}

// Earth sphere parameters
const earthRadius = 0.6;
let earthVertices = [];
let earthRotation = { x: 0, y: 0, z: 0 };

// Generate sphere vertices
function generateSphere(resolution = 20) {
    earthVertices = [];
    for (let i = 0; i <= resolution; i++) {
        const theta = (i / resolution) * Math.PI;
        for (let j = 0; j <= resolution; j++) {
            const phi = (j / resolution) * 2 * Math.PI;
            const x = earthRadius * Math.sin(theta) * Math.cos(phi);
            const y = earthRadius * Math.sin(theta) * Math.sin(phi);
            const z = earthRadius * Math.cos(theta);
            earthVertices.push({ x, y, z, u: j / resolution, v: i / resolution });
        }
    }
}

generateSphere(25);

// Transform sphere point for rendering
function transformSpherePoint(point) {
    // Apply wind deformation
    const windInfluence = windIntensity * 0.1;
    const deformedPoint = [
        point.x + wind.x * windInfluence,
        point.y + wind.y * windInfluence,
        point.z + wind.z * windInfluence
    ];
    
    // Apply 3D rotation
    let [x, y, z] = deformedPoint;
    const ax = angle3D.x, ay = angle3D.y, az = angle3D.z;
    
    // Rotate around X axis
    const y1 = y * Math.cos(ax) - z * Math.sin(ax);
    const z1 = y * Math.sin(ax) + z * Math.cos(ax);
    y = y1; z = z1;
    
    // Rotate around Y axis
    const x1 = x * Math.cos(ay) - z * Math.sin(ay);
    const z2 = x * Math.sin(ay) + z * Math.cos(ay);
    x = x1; z = z2;
    
    // Rotate around Z axis
    const x2 = x * Math.cos(az) - y * Math.sin(az);
    const y2 = x * Math.sin(az) + y * Math.cos(az);
    x = x2; y = y2;
    
    // Project 3D to 2D
    const screen = project3DTo2D([x, y, z]);
    
    return {
        x: canvas.width / 2 + screen[0] * 100,
        y: canvas.height / 2 + screen[1] * 100,
        z: z
    };
}

// Draw Earth sphere
function drawEarth() {
    // Draw sphere using grid of points
    const resolution = 25;
    const points = [];
    
    for (let i = 0; i < earthVertices.length; i++) {
        const p = transformSpherePoint(earthVertices[i]);
        points.push(p);
    }
    
    // Sort faces by depth for proper rendering
    const faces = [];
    for (let i = 0; i < resolution; i++) {
        for (let j = 0; j < resolution; j++) {
            const idx = i * (resolution + 1) + j;
            const idx1 = (i + 1) * (resolution + 1) + j;
            const idx2 = i * (resolution + 1) + (j + 1);
            const idx3 = (i + 1) * (resolution + 1) + (j + 1);
            
            const p1 = points[idx];
            const p2 = points[idx1];
            const p3 = points[idx2];
            const p4 = points[idx3];
            
            if (!p1 || !p2 || !p3 || !p4) continue;
            
            // Average depth for z-sorting
            const avgDepth = (p1.z + p2.z + p3.z + p4.z) / 4;
            if (avgDepth < -1) continue;
            
            // Earth-like colors based on position
            const u = j / resolution;
            const v = i / resolution;
            
            faces.push({ p1, p2, p3, p4, depth: avgDepth, u, v });
        }
    }
    
    // Sort by depth (back to front)
    faces.sort((a, b) => b.depth - a.depth);
    
    // Draw sorted faces
    faces.forEach(face => {
        // Create Earth-like texture
        let r, g, b;
        if (face.v < 0.35 || face.v > 0.65) {
            // Polar regions - ice/snow
            r = 200; g = 230; b = 255;
        } else {
            // Equatorial regions - land/water
            const lat = Math.sin((face.v - 0.5) * Math.PI);
            const pattern = Math.sin(face.u * Math.PI * 4 + earthRotation.x * 2);
            
            if (pattern > 0.3) {
                // Water - blue
                r = Math.floor(20 + 60 * lat);
                g = Math.floor(100 + 80 * lat);
                b = Math.floor(180 + 60 * lat);
            } else if (pattern > -0.2) {
                // Land - green/brown
                r = Math.floor(50 + 100 * pattern);
                g = Math.floor(100 + 50 * pattern);
                b = Math.floor(40 + 30 * pattern);
            } else {
                // Darker terrain
                r = 70; g = 80; b = 60;
            }
        }
        
        const alpha = Math.max(0.4, Math.min(0.9, (face.depth + 2) / 2));
        
        // Draw quad
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(face.p1.x, face.p1.y);
        ctx.lineTo(face.p2.x, face.p2.y);
        ctx.lineTo(face.p4.x, face.p4.y);
        ctx.lineTo(face.p3.x, face.p3.y);
        ctx.closePath();
        ctx.fill();
        
        // Add subtle outline
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
    });
}

// Scale factor for each tesseract
const tesseractScale = 0.15;

// Draw a single tesseract at given position
function drawSingleTesseract(offset, index) {
    // Scale and position tesseract vertices
    const scaledVertices = tesseractVertices.map(v => [
        v[0] * tesseractScale,
        v[1] * tesseractScale,
        v[2] * tesseractScale,
        v[3] * tesseractScale
    ]);
    
    // Transform all vertices
    const transformedVertices = scaledVertices.map(v => transform(v, offset));
    
    // Calculate base color based on position in torus
    const hue = (index / numTesseracts) * 360;
    const t = (angle4D.w + angle4D.x) / 2;
    
    // Color variation based on torus position
    const colorPhase = (index / numTesseracts) * Math.PI * 2;
    const r = Math.floor(128 + 127 * Math.sin(t + colorPhase));
    const g = Math.floor(128 + 127 * Math.sin(t + colorPhase + 2.09));
    const b = Math.floor(128 + 127 * Math.sin(t + colorPhase + 4.18));
    
    // Draw edges
    for (const edge of tesseractEdges) {
        const v1 = transformedVertices[edge[0]];
        const v2 = transformedVertices[edge[1]];
        
        // Skip if too far back
        if (v1.z < -3 || v2.z < -3) continue;
        
        const depth = (v1.z + v2.z) / 2;
        const alpha = Math.max(0.2, Math.min(0.7, (depth + 3) / 3));
        
        ctx.beginPath();
        ctx.moveTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        
        const gradient = ctx.createLinearGradient(v1.x, v1.y, v2.x, v2.y);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`);
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    
    // Draw vertices
    transformedVertices.forEach(v => {
        if (v.z < -3) return;
        
        const size = 2 * (1 + v.z / 3);
        const alpha = Math.max(0.4, Math.min(0.9, (v.z + 3) / 3));
        
        ctx.beginPath();
        ctx.arc(v.x, v.y, size, 0, Math.PI * 2);
        
        const gradient = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, size);
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${alpha * 0.2})`);
        
        ctx.fillStyle = gradient;
        ctx.fill();
    });
}

// Draw all tesseracts forming the torus
function drawTesseract() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Earth first (behind the torus)
    drawEarth();
    
    // Draw each tesseract in the torus
    tesseractPositions.forEach((pos, index) => {
        drawSingleTesseract(pos.offset, index);
    });
}

// Animation loop
let animationTime = 0;
function animate() {
    if (autoRotate) {
        animationTime += 0.01;
        
        // Update torus positions (animated)
        for (let i = 0; i < numTesseracts; i++) {
            const u = (i / numTesseracts + animationTime * 0.1) * Math.PI * 2;
            const v = (i / numTesseracts + animationTime * 0.15) * Math.PI * 2 * 3;
            
            tesseractPositions[i].offset[0] = (majorRadius + minorRadius * Math.cos(v)) * Math.cos(u);
            tesseractPositions[i].offset[1] = (majorRadius + minorRadius * Math.cos(v)) * Math.sin(u);
            tesseractPositions[i].offset[2] = minorRadius * Math.sin(v);
        }
        
        // Rotate Earth
        earthRotation.x += 0.01;
        earthRotation.y += 0.007;
        
        angle4D.x += 0.005;
        angle4D.y += 0.007;
        angle4D.z += 0.006;
        angle4D.w += 0.004;
        
        angle3D.x += 0.003;
        angle3D.y += 0.005;
    }
    
    drawTesseract();
    requestAnimationFrame(animate);
}

// Control event listeners
document.getElementById('windX').addEventListener('input', (e) => {
    wind.x = parseFloat(e.target.value);
});

document.getElementById('windY').addEventListener('input', (e) => {
    wind.y = parseFloat(e.target.value);
});

document.getElementById('windZ').addEventListener('input', (e) => {
    wind.z = parseFloat(e.target.value);
});

document.getElementById('windW').addEventListener('input', (e) => {
    wind.w = parseFloat(e.target.value);
});

document.getElementById('intensity').addEventListener('input', (e) => {
    windIntensity = parseFloat(e.target.value);
});

// Mouse controls
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        
        angle3D.y += dx * 0.01;
        angle3D.x += dy * 0.01;
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
});

// Touch controls for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isDragging = true;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
});

canvas.addEventListener('touchmove', (e) => {
    if (isDragging) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastMouseX;
        const dy = e.touches[0].clientY - lastMouseY;
        
        angle3D.y += dx * 0.01;
        angle3D.x += dy * 0.01;
        
        lastMouseX = e.touches[0].clientX;
        lastMouseY = e.touches[0].clientY;
    }
});

canvas.addEventListener('touchend', () => {
    isDragging = false;
});

// Start animation
animate();

