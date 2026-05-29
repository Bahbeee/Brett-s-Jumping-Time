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
    jumpPower: 10,
    gravity: 0.6,
    grounded: true
};

// ---------------------------------------------------------
// 1. SPEECH COMMAND / AUDIO MODEL PROCESSING LOGIC
// ---------------------------------------------------------
async function init() {
    document.getElementById("label-container").innerHTML = "<div class='text-secondary small fw-bold'>Loading audio model files...</div>";

    try {
        // MATCHING YOUR FILE ARCHITECTURE EXACTLY
        const modelURL = "./model.json";
        const metadataURL = "./metadata.json";

        recognizer = speechCommands.create(
            "BROWSER_FFT", 
            undefined, 
            modelURL, 
            metadataURL
        );

        // Network proxy redirector to handle capitalized weights.BIN file on GitHub
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const requestedUrl = args[0];
            if (typeof requestedUrl === 'string' && requestedUrl.includes('weights.bin')) {
                return originalFetch('./weights.BIN');
            }
            return originalFetch(...args);
        };

        await recognizer.ensureModelLoaded();
        maxPredictions = recognizer.wordLabels().length;

        // Restore default browser networking
        window.fetch = originalFetch;

    } catch (error) {
        console.error("Model initialization failure analysis:", error);
        alert("Failed to load the model. Check your browser's inspect element console logs.");
        return;
    }

    // Update Status Indicators
    document.getElementById('mic-icon').style.animation = "pulse 1.5s infinite";
    document.getElementById('audio-status').innerText = "Listening...";
    document.getElementById('audio-status').className = "small text-danger fw-bold mt-2";

    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    const classNames = recognizer.wordLabels();

    for (let i = 0; i < maxPredictions; i++) {
        const rowDiv = document.createElement("div");
        rowDiv.className = "mb-3";

        const labelHeader = document.createElement("div");
        labelHeader.className = "d-flex justify-content-between mb-1 small fw-bold text-secondary";
        
        const nameSpan = document.createElement("span");
        nameSpan.innerText = classNames[i];
        
        const percentSpan = document.createElement("span");
        percentSpan.className = "class-percent";
        percentSpan.innerText = "0%";

        labelHeader.appendChild(nameSpan);
        labelHeader.appendChild(percentSpan);

        const progressContainer = document.createElement("div");
        progressContainer.className = "progress";
        progressContainer.style.height = "14px";

        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar";
        progressBar.style.backgroundColor = "#bf1e2e"; 
        progressBar.style.width = "0%";

        progressContainer.appendChild(progressBar);
        rowDiv.appendChild(labelHeader);
        rowDiv.appendChild(progressContainer);
        
        labelContainer.appendChild(rowDiv);
    }

    recognizer.listen(result => {
        const scores = result.scores; 
        
        for (let i = 0; i < maxPredictions; i++) {
            const rowDiv = labelContainer.childNodes[i];
            const percentSpan = rowDiv.querySelector(".class-percent");
            const progressBar = rowDiv.querySelector(".progress-bar");
            
            const probability = scores[i];
            percentSpan.innerText = (probability * 100).toFixed(0) + "%";
            progressBar.style.width = (probability * 100) + "%";

            // If Index 1 ("Class 2") crosses 50% match probability, jump!
            if (i === 1 && probability > 0.50) {
                dinoJump();
            }
        }
    }, {
        includeSpectrogram: true,
        probabilityThreshold: 0.70,
        invokeCallbackOnNoiseAndUnknown: true,
        overlapFactor: 0.50
    });

    if (!gameRunning) {
        restartGame();
    }
}

async function stop() {
    if (recognizer && recognizer.isListening()) {
        await recognizer.stopListening();
    }
    document.getElementById('mic-icon').style.animation = "none";
    document.getElementById('audio-status').innerText = "Microphone Off";
    document.getElementById('audio-status').className = "small text-muted mt-2";
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

    ctx.fillStyle = '#bf1e2e';
    ctx.fillRect(dino.x, dino.y, dino.w, dino.h);

    frames++;
    
    if (frames % Math.floor(Math.random() * 50 + 70) === 0) {
        obstacles.push({
            x: canvas.width,
            y: canvas.height - 40,
            w: 20,
            h: 30,
            speed: 6
        });
    }

    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= obs.speed;
        
        ctx.fillStyle = '#1a1a1a'; 
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

        if (
            dino.x < obs.x + obs.w &&
            dino.x + dino.w > obs.x &&
            dino.y < obs.y + obs.h &&
            dino.y + dino.h > obs.y
        ) {
            gameOver();
        }
    }

    obstacles = obstacles.filter(obs => obs.x + obs.w > 0);

    score++;
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Score: ' + Math.floor(score / 10), canvas.width - 100, 30);

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

function gameOver() {
    gameRunning = false;
    document.getElementById('gameOverScreen').classList.remove('d-none');
    document.getElementById('finalScore').innerText = Math.floor(score / 10);
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

document.getElementById('btn-start').addEventListener('click', init);
document.getElementById('btn-stop').addEventListener('click', stop);
document.getElementById('btn-restart').addEventListener('click', restartGame);
