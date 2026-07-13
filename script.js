const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const winScreen = document.getElementById('win-screen');

let particles = [];
let confetti = [];
let isMouseDown = false;
let mouseX = 400;
let mouseY = 50;
let gameWon = false;
const TARGET_WATER = 150;

// Load charity: water branding
const logoImg = new Image();
logoImg.src = 'input_file_0.png';

// Collision bounds based on mapped funnels and standard image overlay
const segments = [
    // Left angled obstacle
    {x1: 150, y1: 120, x2: 360, y2: 240},
    // Right angled obstacle
    {x1: 650, y1: 150, x2: 440, y2: 250},

    // JERRYCAN GEOMETRY (invisible bounds placed exactly behind the charity water graphic)
    // Left inner wall
    {x1: 325, y1: 320, x2: 325, y2: 520},
    // Bottom wall
    {x1: 325, y1: 520, x2: 475, y2: 520},
    // Right inner wall
    {x1: 475, y1: 520, x2: 475, y2: 320}
];

// The bounding box checking inside our new mapped jerrycan walls
const targetBox = { x: 325, y: 320, w: 150, h: 200 };

function closestPointOnSegment(p, a, b) {
    let ab = { x: b.x - a.x, y: b.y - a.y };
    let ap = { x: p.x - a.x, y: p.y - a.y };
    let t = (ap.x * ab.x + ap.y * ab.y) / (ab.x * ab.x + ab.y * ab.y);
    t = Math.max(0, Math.min(1, t)); 
    return { x: a.x + t * ab.x, y: a.y + t * ab.y };
}

function spawnConfetti() {
    for (let i = 0; i < 150; i++) {
        confetti.push({
            x: canvas.width / 2,
            y: canvas.height / 2,
            vx: (Math.random() - 0.5) * 25,
            vy: (Math.random() - 1) * 20 - 5,
            size: Math.random() * 8 + 6,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            rot: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.5
        });
    }
}

function updatePhysics() {
    // Only permit water drops if game isn't won yet
    if (isMouseDown && !gameWon && particles.length < 600) { 
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

                p1.x -= nx * overlap;
                p1.y -= ny * overlap;
                p2.x += nx * overlap;
                p2.y += ny * overlap;

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

                p1.x += nx * overlap;
                p1.y += ny * overlap;

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

    particles = particles.filter(p => p.y < canvas.height + 50);

    scoreElement.innerText = collectedCount;
    if (collectedCount >= TARGET_WATER && !gameWon) {
        gameWon = true;
        winScreen.style.display = 'flex';
        spawnConfetti();
    }
}

function updateConfetti() {
    for (let c of confetti) {
        c.x += c.vx;
        c.y += c.vy;
        c.vy += 0.4;
        c.rot += c.rotSpeed;
    }
}

function drawConfetti() {
    for (let c of confetti) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size/2, -c.size/2, c.size, c.size);
        ctx.restore();
    }
}

// Helper to draw safely-rounded rectangles across all browsers
function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawFallbackBranding(x, y, w, h) {
    // 1. Jerrycan coded clone
    ctx.fillStyle = "#F2C744"; // charity: water yellow
    drawRoundRect(ctx, x, y + 20, w, h - 20, 15);
    ctx.fill();

    // Spout (left)
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 25); ctx.lineTo(x + 8, y + 5);
    ctx.lineTo(x + 38, y - 2);  ctx.lineTo(x + 45, y + 25);
    ctx.fill();

    // Handle (top right)
    drawRoundRect(ctx, x + 55, y, 70, 30, 8);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    drawRoundRect(ctx, x + 70, y + 8, 40, 12, 5);
    ctx.fill();

    // X Indentation shape
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(x + 25, y + 60);  ctx.lineTo(x + 55, y + 105); ctx.lineTo(x + 25, y + 160);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 125, y + 60); ctx.lineTo(x + 95, y + 105); ctx.lineTo(x + 125, y + 160);
    ctx.stroke();

    drawRoundRect(ctx, x + 55, y + 95, 40, 20, 4);
    ctx.stroke();

    // 2. Text coded clone
    ctx.fillStyle = "#222222";
    ctx.font = "bold 46px 'Georgia', serif";
    ctx.textAlign = "center";
    ctx.letterSpacing = "4px"; // Emulate spacing if supported
    ctx.fillText("charity: water", 400, 580);
}


function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw line obstacles (We only draw the first two lines, not the jerrycan boundaries)
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
        let seg = segments[i];
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();

    // Draw water particles - Drawn behind the branding
    ctx.fillStyle = "rgba(0, 191, 255, 0.75)";
    for (let p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Attempt to draw image, OR fallback to our code-drawn clone if broken/unavailable!
    if (logoImg.complete && logoImg.naturalWidth > 0) {
        ctx.drawImage(logoImg, 290, 0, 150, 200, 325, 320, 150, 200);
        ctx.drawImage(logoImg, 0, 260, 732, 98, 217, 540, 366, 49);
    } else {
        // Renders a perfect clone using code so the game never crashes
        drawFallbackBranding(325, 320, 150, 200); 
    }

    // Draw indicator
    if (isMouseDown && !gameWon) {
        ctx.fillStyle = "#aaddff";
        ctx.beginPath();
        ctx.arc(mouseX, mouseY, 15, 0, Math.PI * 2);
        ctx.fill();
    }
}

function gameLoop() {
    updatePhysics(); 
    if (gameWon) updateConfetti();
    
    draw();
    
    if (gameWon) drawConfetti(); 
    
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
    if(e.cancelable) e.preventDefault();
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
    confetti = [];
    gameWon = false;
    winScreen.style.display = 'none';
    scoreElement.innerText = "0";
}

// Start the game loop
gameLoop();