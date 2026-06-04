// --- Audio Teachable Machine Global Variables ---
let recognizer;
let labelContainer;
let maxPredictions;

// --- Game Engine Global Variables ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let gameRunning = false;
let score = 0;
let frames = 0;
let obstacles = [];

let dino = {
    x: 50,
    y: 110,
    w: 20,
    h: 40,
    dy: 0,
    jumpPower: 11,
    gravity: 0.6,
    grounded: true
};

// ---------------------------------------------------------
// 1. SPEECH COMMAND / AUDIO MODEL PROCESSING LOGIC
// ---------------------------------------------------------
async function init() {
    const startBtn = document.getElementById('btn-start');
    const statusText = document.getElementById('audio-status');
    
    // MOVE THIS TO THE VERY TOP: Force the UI to update immediately when clicked!
    if (startBtn) {
        startBtn.innerText = "Connecting...";
        startBtn.style.backgroundColor = "#f0b232"; 
        startBtn.style.color = "#1e1f22";
    }
    if (statusText) {
        statusText.innerText = "Initializing audio framework...";
        statusText.style.color = "#f0b232";
    }

    try {
        // BYPASS TRICK: Dynamically pull the exact absolute URL directly from the browser window address bar
        const absoluteURL = window.location.href.split('?')[0].split('#')[0];
        
        const checkpointURL = absoluteURL + "model.json"; 
        const metadataURL = absoluteURL + "metadata.json"; 

        // Initialize speech commands interface
        recognizer = speechCommands.create(
            "BROWSER_FFT", 
            undefined, 
            checkpointURL,
            metadataURL
        );

        await recognizer.ensureModelLoaded();
        maxPredictions = recognizer.wordLabels().length;

    } catch (error) {
        // If it fails, throw a visible alert box so we see the exact error text
        alert("Launch Failed:\n" + error.message);
        resetButtons();
        return;
    }

    // Success styling updates matching active layout profile
    if (startBtn) {
        startBtn.innerText = "Model Active";
        startBtn.style.backgroundColor = "#23a55a"; 
        startBtn.style.color = "#ffffff";
    }
    
    const micIcon = document.getElementById('mic-icon');
    if (micIcon) micIcon.style.animation = "pulse 1.5s infinite";
    
    if (statusText) {
        statusText.innerText = "Streaming Audio... Listening";
        statusText.style.color = "#23a55a";
    }

    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    const classLabels = recognizer.wordLabels();

    for (let i = 0; i < maxPredictions; i++) {
        const rowDiv = document.createElement("div");
        rowDiv.className = "mb-3";
        rowDiv.innerHTML = `
            <div class="d-flex justify-content-between small fw-bold mb-1">
                <span style="color: #dbdee1;">${classLabels[i]}</span>
                <span class="class-percent" style="color: #949ba4;">0%</span>
            </div>
            <div class="progress" style="height: 10px;">
                <div class="progress-bar" style="width: 0%; background-color: #5865f2;"></div>
            </div>
        `;
        labelContainer.appendChild(rowDiv);
    }

// High-velocity audio monitoring stream
    recognizer.listen(result => {
        const scores = result.scores; 
        for (let i = 0; i < maxPredictions; i++) {
            const rowDiv = labelContainer.childNodes[i];
            const percentSpan = rowDiv.querySelector(".class-percent");
            const progressBar = rowDiv.querySelector(".progress-bar");
            
            const probability = scores[i];
            percentSpan.innerText = (probability * 100).toFixed(0) + "%";
            progressBar.style.width = (probability * 100) + "%";

            // PERFORMANCE TWEAK: Dropped confidence threshold to 60% for a hair-trigger jump
            if (i === 1 && probability > 0.60) {
                dinoJump();
            }
        }
    }, {
        includeSpectrogram: true, 
        probabilityThreshold: 0.60, // Lowered from 0.75 for instant activation
        invokeCallbackOnNoiseAndUnknown: true,
        overlapFactor: 0.70 // Increased from 0.50 to make the mic scan way faster
    });

    if (!gameRunning) {
        restartGame();
    }
}

function resetButtons() {
    const startBtn = document.getElementById('btn-start');
    if (startBtn) {
        startBtn.innerText = "Start Microphone & Game";
        startBtn.style.backgroundColor = "#5865f2"; 
        startBtn.style.color = "#ffffff";
    }
    const micIcon = document.getElementById('mic-icon');
    if (micIcon) micIcon.style.animation = "none";
    
    const statusText = document.getElementById('audio-status');
    if (statusText) {
        statusText.innerText = "Microphone Off";
        statusText.style.color = "#949ba4";
    }
}

async function stop() {
    if (recognizer && recognizer.isListening()) {
        await recognizer.stopListening();
    }
    resetButtons();
    gameRunning = false; 
}

// ---------------------------------------------------------
// 2. DINOSAUR GAME PHYSICS FRAMEWORK
// ---------------------------------------------------------
function gameLoop() {
    if (!gameRunning) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    dino.dy += dino.gravity;
    dino.y += dino.dy;

    if (dino.y + dino.h >= canvas.height - 10) {
        dino.y = canvas.height - dino.h - 10;
        dino.dy = 0;
        dino.grounded = true;
    }

    // Render Player Block
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dino.x, dino.y, dino.w, dino.h);

    frames++;
    if (frames % 90 === 0) {
        obstacles.push({ x: canvas.width, y: canvas.height - 35, w: 15, h: 25, speed: 5 });
    }

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= obs.speed;
        
        ctx.fillStyle = '#da373c';  
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

        if (dino.x < obs.x + obs.w && dino.x + dino.w > obs.x && dino.y < obs.y + obs.h && dino.y + dino.h > obs.y) {
            gameRunning = false;
            document.getElementById('gameOverScreen').classList.remove('d-none');
            document.getElementById('finalScore').innerText = Math.floor(score / 10);
        }
    }

    obstacles = obstacles.filter(obs => obs.x + obs.w > 0);
    score++;
    
    ctx.fillStyle = '#dbdee1';
    ctx.font = 'bold 14px Segoe UI, Arial';
    ctx.fillText('Score: ' + Math.floor(score / 10), canvas.width - 90, 25);

    ctx.strokeStyle = '#4e5058';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - 10);
    ctx.lineTo(canvas.width, canvas.height - 10);
    ctx.stroke();

    requestAnimationFrame(gameLoop);
}

function dinoJump() {
    if (dino.grounded && gameRunning) {
        dino.dy = -dino.jumpPower;
        dino.grounded = false;
    }
}

function restartGame() {
    dino.y = 110;
    dino.dy = 0;
    obstacles = [];
    score = 0;
    frames = 0;
    document.getElementById('gameOverScreen').classList.add('d-none');
    gameRunning = true;
    gameLoop();
}

// Direct element link mappings
document.getElementById('btn-start').onclick = init;
document.getElementById('btn-stop').onclick = stop;
document.getElementById('btn-restart').onclick = restartGame;
