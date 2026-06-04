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
async function createModel() {
    // Standard absolute local path loader pointing straight to your repository files
    const URL = "./"; 
    const checkpointURL = URL + "model.json"; 
    const metadataURL = URL + "metadata.json"; 

    const recognizer = speechCommands.create(
        "BROWSER_FFT", 
        undefined, 
        checkpointURL,
        metadataURL
    );

    await recognizer.ensureModelLoaded();
    return recognizer;
}

async function init() {
    // Dynamic theme state shift updates upon mouse click trigger
    const startBtn = document.getElementById('btn-start');
    const statusText = document.getElementById('audio-status');
    
    if (startBtn) {
        startBtn.innerText = "Connecting...";
        startBtn.style.backgroundColor = "#f0b232"; // Discord Warning Yellow
        startBtn.style.color = "#1e1f22";
    }
    if (statusText) {
        statusText.innerText = "Reading model structural files...";
        statusText.style.color = "#f0b232";
    }

    try {
        // Execute clean local module fetch parameters
        recognizer = await createModel();
        maxPredictions = recognizer.wordLabels().length;

    } catch (error) {
        alert("Launch Roadblock encountered:\n" + error.message + "\n\nDouble check that model.json, metadata.json, and weights.bin are all completely unzipped and present inside your main folder.");
        resetButtons();
        return;
    }

    // Success styling updates matching active layout profile
    if (startBtn) {
        startBtn.innerText = "Model Active";
        startBtn.style.backgroundColor = "#23a55a"; // Discord Success Green
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

    // Dynamically build accuracy panels styled around Discord dark palette properties
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

    // Connect to active audio hardware arrays natively
    recognizer.listen(result => {
        const scores = result.scores; 
        for (let i = 0; i < maxPredictions; i++) {
            const rowDiv = labelContainer.childNodes[i];
            const percentSpan = rowDiv.querySelector(".class-percent");
            const progressBar = rowDiv.querySelector(".progress-bar");
            
            const probability = scores[i];
            percentSpan.innerText = (probability * 100).toFixed(0) + "%";
            progressBar.style.width = (probability * 100) + "%";

            // If probability match passes 75% bar limits on Class 2 (Index 1), trigger game physical jump
            if (i === 1 && probability > 0.75) {
                dinoJump();
            }
        }
    }, {
        includeSpectrogram: true, 
        probabilityThreshold: 0.75,
        invokeCallbackOnNoiseAndUnknown: true,
        overlapFactor: 0.50 
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
    
    // Clear field canvas with dark panel background color definition
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Gravity calculation physics values
    dino.dy += dino.gravity;
    dino.y += dino.dy;

    if (dino.y + dino.h >= canvas.height - 10) {
        dino.y = canvas.height - dino.h - 10;
        dino.dy = 0;
        dino.grounded = true;
    }

    // Render Player Block using sharp contrast white accent
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(dino.x, dino.y, dino.w, dino.h);

    frames++;
    if (frames % 90 === 0) {
        // Red color blocks for obstacles tracking movement
        obstacles.push({ x: canvas.width, y: canvas.height - 35, w: 15, h: 25, speed: 5 });
    }

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= obs.speed;
        
        ctx.fillStyle = '#da373c';  /* Discord Alert Red obstacle fill color */
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

        // Crash intercept evaluation mechanics
        if (dino.x < obs.x + obs.w && dino.x + dino.w > obs.x && dino.y < obs.y + obs.h && dino.y + dino.h > obs.y) {
            gameRunning = false;
            document.getElementById('gameOverScreen').classList.remove('d-none');
            document.getElementById('finalScore').innerText = Math.floor(score / 10);
        }
    }

    obstacles = obstacles.filter(obs => obs.x + obs.w > 0);
    score++;
    
    // Render text metrics output onto the dark engine layer
    ctx.fillStyle = '#dbdee1';
    ctx.font = 'bold 14px Segoe UI, Arial';
    ctx.fillText('Score: ' + Math.floor(score / 10), canvas.width - 90, 25);

    // Draw bottom ground line separator boundary axis line
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

// Bind engine variables directly to click hooks natively
document.getElementById('btn-start').onclick = init;
document.getElementById('btn-stop').onclick = stop;
document.getElementById('btn-restart').onclick = restartGame;
