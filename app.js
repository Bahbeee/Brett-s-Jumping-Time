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
    document.getElementById("label-container").innerHTML = "<div class='text-secondary small fw-bold'>Loading audio model files...</div>";

    try {
        // MATCHING YOUR EXACT ROOT FILES:
        // Points directly to the root files using your capitalized extensions
        const modelURL = "./model.JSON";
        const metadataURL = "./metadata.JSON";

        // Create the Google Speech Recognizer
        recognizer = speechCommands.create(
            "BROWSER_FFT", 
            undefined, 
            modelURL, 
            metadataURL
        );

        // Intercept fetch requests because the library will automatically try to find 
        // a lowercase "weights.bin", but your file is named "weights.BIN"
        const originalFetch = window.fetch;
        window.fetch = async function(...args) {
            const requestedUrl = args[0];
            if (typeof requestedUrl === 'string' && requestedUrl.includes('weights.bin')) {
                return originalFetch('./weights.BIN');
            }
            return originalFetch(...args);
        };

        // Load the assets into browser memory
        await recognizer.ensureModelLoaded();
        maxPredictions = recognizer.wordLabels().length;

        // Restore the standard fetch function
        window.fetch = originalFetch;

    } catch (error) {
        console.error("Model loading details:", error);
        alert("Failed to load the model. Make sure model.JSON, metadata.JSON, and weights.BIN are uploaded.");
        return;
    }

    // Update Status Indicators
    document.getElementById('mic-icon').classList.add('audio-active-pulse');
    document.getElementById('audio-status').innerText = "Listening...";
    document.getElementById('audio-status').classList.remove('text-muted');
    document.getElementById('audio-status').classList.add('text-danger', 'fw-bold');

    // Build the Accuracy Bars layout based on your class labels
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

    // Start listening to the microphone stream
    recognizer.listen(result => {
        const scores = result.scores; // Match levels between 0.0 and 1.0
        
        for (let i = 0; i < maxPredictions; i++) {
            const rowDiv = labelContainer.childNodes[i];
            const percentSpan = rowDiv.querySelector(".class-percent");
            const progressBar = rowDiv.querySelector(".class-bar-fill");
            
            const probability = scores[i];
            percentSpan.innerText = (probability * 100).toFixed(0) + "%";
            progressBar.style.width = (probability * 100) + "%";

            // --- AUDIO GAME JUMP TRIGGER ---
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

    // Start the game loop
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
            dino.y < obs.y
