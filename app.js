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
    // FIXED: Plugs in your exact live repository path to satisfy the strict HTTPS rule!
    const URL = "https://bahbeee.github.io/Brett-s-Jumping-Time/"; 
    
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

    recognizer.listen(result => {
        const scores = result.scores; 
        for (let i = 0; i < maxPredictions; i++) {
            const rowDiv = labelContainer.childNodes[i];
            const percentSpan = rowDiv.querySelector(".class-percent");
            const progressBar = rowDiv.querySelector(".progress-bar");
            
            const probability = scores[i];
            percentSpan.innerText = (probability * 100).toFixed(0) + "%";
            progressBar.style.width = (probability * 100) + "%";

            // Trigger physical jump when custom sound (Index 1) passes 75% accuracy
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
