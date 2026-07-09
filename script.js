const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const winScreen = document.getElementById('win-screen');

let particles = [];
let isMouseDown = false;
let mouseX = 400;
let mouseY = 50;
let gameWon = false;
const TARGET_WATER = 150;

// Collision bounds based on the reference drawing
const segments = [
    // Left angled obstacle
    {x1: 150, y1: 120, x2: 280, y2: 240},
    // Right angled obstacle
    {x1: 650, y1: 150, x2: 480, y2: 250},

    // JERRYCAN GEOMETRY
    // Left inner wall
    {x1: 370, y1: 410, x2: 360, y2: 550},
    // Bottom wall
    {x1: 360, y1: 550, x2: 470, y2: 560},
    // Right inner wall
    {x1: 470, y1: 560, x2: 490, y2: 410},

    // Decorative jerrycan features (Spout on left)
    {x1: 370, y1: 410, x2: 330, y2: 420}, 
    {x1: 330, y1: 420, x2: 310, y2: 450}, 
    {x1: 310, y1: 450, x2: 365, y2: 460}, 
    
    // Decorative jerrycan features (Handle on right)
    {x1: 490, y1: 410, x2: 430, y2: 400}, 
    {x1: 430, y1: 400, x2: 435, y2: 440}, 
    {x1: 435, y1: 440, x2: 475, y2: 445}  
];

// The bounding box inside the jerrycan to check for "scored" water
const targetBox = { x: 365, y: 440, w: 100, h: 110 };

// Math helper for line collisions
function closestPointOnSegment(p, a, b) {
    let ab = { x: b.x - a.x, y: b.y - a.y };
    let ap = { x: p.x - a.x, y: p.y - a.y };
    let t = (ap.x * ab.x + ap.y * ab.y) / (ab.x * ab.x + ab.y * ab.y);
    t = Math.max(0, Math.min(1, t)); // clamp to segment
    return { x: a.x + t * ab.x, y: a.y + t * ab.y };
}

function updatePhysics() {
    if (gameWon) return;

    // Spawn water when mouse is pressed
    if (isMouseDown && particles.length < 600) { // Limit max particles to maintain 60FPS
        for (let i = 0; i < 3; i++) {
            particles.push({
                x: mouseX + (Math.random() - 0.5) * 15,
                y: mouseY + (Math.random() - 0.5) * 15,
                vx: (Math.random() - 0.5) * 2,
                vy: Math.random() * 2,
                radius: 6 + Math.random() * 2
            });
        }
    }

    let collectedCount = 0;

    for (let i = 0; i < particles.length; i++) {
        let p1 = particles[i];

        // 1. Apply Gravity
        p1.vy += 0.25;

        // 2. Terminal velocity
        let speed = Math.sqrt(p1.vx * p1.vx + p1.vy * p1.vy);
        if (speed > 12) {
            p1.vx = (p1.vx / speed) * 12;
            p1.vy = (p1.vy / speed) * 12;
        }

        p1.x += p1.vx;
        p1.y += p1.vy;

        // 3. Fake Fluid Simulation (Particle-Particle Collisions)
        for (let j = i + 1; j < particles.length; j++) {
            let p2 = particles[j];
            let dx = p2.x - p1.x;
            let dy = p2.y - p1.y;
            let distSq = dx * dx + dy * dy;
            let minDist = p1.radius + p2.radius;
            
            if (distSq < minDist * minDist) {
                let dist = Math.sqrt(distSq);
                if (dist === 0) continue;
                let overlap = (minDist - dist) * 0.5;
                let nx = dx / dist;
                let ny = dy / dist;

                // Push particles apart
                p1.x -= nx * overlap;
                p1.y -= ny * overlap;
                p2.x += nx * overlap;
                p2.y += ny * overlap;

                // Simulate viscosity by sharing a bit of velocity
                let dvx = p2.vx - p1.vx;
                let dvy = p2.vy - p1.vy;
                p1.vx += dvx * 0.05;
                p1.vy += dvy * 0.05;
                p2.vx -= dvx * 0.05;
                p2.vy -= dvy * 0.05;
            }
        }

        // 4. Boundary / Obstacle Collisions
        for (let seg of segments) {
            let closest = closestPointOnSegment(p1, {x: seg.x1, y: seg.y1}, {x: seg.x2, y: seg.y2});
            let dx = p1.x - closest.x;
            let dy = p1.y - closest.y;
            let distSq = dx * dx + dy * dy;
            
            if (distSq < p1.radius * p1.radius) {
                let dist = Math.sqrt(distSq);
                if (dist === 0) continue;
                let overlap = p1.radius - dist;
                let nx = dx / dist;
                let ny = dy / dist;

                // Eject particle from line
                p1.x += nx * overlap;
                p1.y += ny * overlap;

                // Reflect velocity with bounce (restitution) and friction
                let dot = p1.vx * nx + p1.vy * ny;
                p1.vx = (p1.vx - 1.4 * dot * nx) * 0.85;
                p1.vy = (p1.vy - 1.4 * dot * ny) * 0.85;
            }
        }

        // 5. Check if in target zone
        if (p1.x > targetBox.x && p1.x < targetBox.x + targetBox.w &&
            p1.y > targetBox.y && p1.y < targetBox.y + targetBox.h) {
            collectedCount++;
        }
    }

    // Remove particles that fell off the screen
    particles = particles.filter(p => p.y < canvas.height + 50);

    // Update UI Score
    scoreElement.innerText = collectedCount;
    if (collectedCount >= TARGET_WATER) {
        gameWon = true;
        winScreen.style.display = 'flex';
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw line obstacles
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.beginPath();
    for (let seg of segments) {
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();

    // Draw water particles
    ctx.fillStyle = "rgba(0, 191, 255, 0.75)"; // Light vibrant blue
    for (let p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw water source indicator when pouring
    if (isMouseDown && !gameWon) {
        ctx.fillStyle = "#aaddff";
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 15, 0, Math.PI * 2);
        ctx.fill();
    }
}

function gameLoop() {
    updatePhysics();
    draw();
    requestAnimationFrame(gameLoop);
}

// Controls
function updateMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
}

function updateTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.touches[0].clientX - rect.left;
    mouseY = e.touches[0].clientY - rect.top;
    e.preventDefault();
}

// Mouse listeners
canvas.addEventListener('mousedown', (e) => { isMouseDown = true; updateMousePos(e); });
window.addEventListener('mouseup', () => isMouseDown = false);
canvas.addEventListener('mousemove', updateMousePos);

// Touch listeners
canvas.addEventListener('touchstart', (e) => { isMouseDown = true; updateTouchPos(e); }, {passive: false});
window.addEventListener('touchend', () => isMouseDown = false);
canvas.addEventListener('touchmove', updateTouchPos, {passive: false});

// Make reset Game function global so the HTML button can trigger it
window.resetGame = function() {
    particles = [];
    gameWon = false;
    winScreen.style.display = 'none';
    scoreElement.innerText = "0";
}

// Start the game loop
gameLoop();