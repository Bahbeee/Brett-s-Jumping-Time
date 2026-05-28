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

// Dino Character Physics Mapping
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
    const fileInput = document.getElementById('zip-selector');
    const zipFile = fileInput.files[0];

    if (!zipFile) {
        alert("Please upload a valid model .zip file first.");
        return;
    }

    try {
        // Load the zip file using JSZip
        const zip = await JSZip.loadAsync(zipFile);
        let modelJsonEntry, metadataJsonEntry, weightsBinEntry;

        // Locate files inside the zip package
        zip.forEach((relativePath, fileEntry) => {
            if (relativePath.endsWith("model.json")) modelJsonEntry = fileEntry;
            if (relativePath.endsWith("metadata.json")) metadataJsonEntry = fileEntry;
            if (relativePath.endsWith("weights.bin")) weightsBinEntry = fileEntry;
        });

        if (!modelJsonEntry || !metadataJsonEntry) {
            alert("Error: Missing required files (model.json or metadata.json) inside the zip.");
            return;
        }

        // Read files out of the zip archive with their correct data formats
        const modelJsonText = await modelJsonEntry.async("string");
        const metadataJsonText = await metadataJsonEntry.async("string");
        
        let weightsBlobURL = null;
        if (weightsBinEntry) {
            const weightsBinBlob = await weightsBinEntry.async("blob");
            weightsBlobURL = URL.createObjectURL(weightsBinBlob);
        }

        // Parse JSON files to interact with data structure
        const modelTopology = JSON.parse(modelJsonText);
        const metadataJson = JSON.parse(metadataJsonText);

        const modelBlob = new Blob([modelJsonText], { type: "application/json" });
        const metadataBlob = new Blob([metadataJsonText], { type: "application/json" });

        const modelURL = URL.createObjectURL(modelBlob);
        const metadataURL = URL.createObjectURL(metadataBlob);

        // Standard speechCommands setup overrides to process raw local data URLs
        recognizer = speechCommands.create(
            "BROWSER_FFT", 
            undefined, 
            modelURL, 
            metadataURL
        );

        // Intercept network requests if speech-commands forces binary path searching
        if (weightsBlobURL) {
            const originalFetch = window.fetch;
            window.fetch = async function(...args) {
                const url = args[0];
                if (typeof url === 'string' && url.includes('weights.bin')) {
                    return originalFetch(weightsBlobURL);
                }
                return originalFetch(...args);
            };
        }

        await recognizer.ensureModelLoaded();
        maxPredictions = recognizer.wordLabels().length;

    } catch (error) {
        console.error(error);
        alert("Failed to read audio files from archive. Make sure it's an uncorrupted Teachable Machine ZIP.");
        return;
    }

    // Update Status Indicators
    document.getElementById('mic-icon').classList.add('audio-active-pulse');
    document.getElementById('audio-status').innerText = "Listening...";
    document.getElementById('audio-status').classList.remove('text-muted');
    document.getElementById('audio-status').classList.add('text-danger', 'fw-bold');

    // Build the Accuracy Layout Dynamically based on unzipped names
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = "";
    const classNames = recognizer.wordLabels();

    for (let i = 0; i < maxPredictions; i++) {
        const rowDiv = document.createElement("div");
        rowDiv.className = "mb-3";

        const labelHeader = document.createElement("div");
        labelHeader.className = "d-flex justify-content-between mb-1 small fw-bold text-secondary";
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "class-name";
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
        progressBar.className = "progress-bar class-bar-fill";
        progressBar.style.backgroundColor = "#bf1e2e"; // Westminster Red Bars
        progressBar.style.width = "0%";
        progressBar.style.transition = "width 0.05s ease-out"; 

        progressContainer.appendChild(progressBar);
        rowDiv.appendChild(labelHeader);
        rowDiv.appendChild(progressContainer);
        
        labelContainer.appendChild(rowDiv);
    }

    // Run Real-Time Stream Capture Processing via mic graph
    recognizer.listen(result => {
        const scores = result.scores; // Returns array of match values
        
        for (let i = 0; i < maxPredictions; i++) {
            const rowDiv = labelContainer.childNodes[i];
            const percentSpan = rowDiv.querySelector(".class-percent");
            const progressBar = rowDiv.querySelector(".class-bar-fill");
            
            const probability = scores[i];
            percentSpan.innerText = (probability * 100).toFixed(0) + "%";
            progressBar.style.width = (probability * 100) + "%";

            // --- JUMP TRIGGER: Check Index 1 ("Class 2") ---
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

    // Fire Up Game Engine Components
    if (!gameRunning) {
        restartGame();
    }
}

async function stop() {
    if (recognizer && recognizer.isListening()) {
        await recognizer.stopListening();
    }
    
    // Reset indicators
    document.getElementById('mic-icon').classList.remove('audio-active-pulse');
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

    // Apply basic downward gravity
    dino.dy += dino.gravity;
    dino.y += dino.dy;

    // Floor contact threshold limits
    if (dino.y + dino.h >= canvas.height - 10) {
        dino.y = canvas.height - dino.h - 10;
        dino.dy = 0;
        dino.grounded = true;
    }

    // Paint Dino (School Red Block)
    ctx.fillStyle = '#bf1e2e';
    ctx.fillRect(dino.x, dino.y, dino.w, dino.h);

    frames++;
    
    // Spawn Obstacles on randomized timing limits
    if (frames % Math.floor(Math.random() * 50 + 70) === 0) {
        obstacles.push({
            x: canvas.width,
            y: canvas.height - 40,
            w: 20,
            h: 30,
            speed: 6
        });
    }

    // Draw and animate obstacles
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        obs.x -= obs.speed;
        
        ctx.fillStyle = '#1a1a1a'; // Dark Gray Obstacles
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);

        // Standard bounding box collision verification rule (AABB)
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

    // Baseline floor track line
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

// ---------------------------------------------------------
// 3. SECURE DOM EVENT BINDINGS
// ---------------------------------------------------------
document.getElementById('btn-start').addEventListener('click', init);
document.getElementById('btn-stop').addEventListener('click', stop);
document.getElementById('btn-restart').addEventListener('click', restartGame);
