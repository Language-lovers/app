// --- Game State Tracking Variables ---
let allPhrases = []; 
let currentDeck = [];
let currentPhrase = null;
let currentStepIndex = 0;
let assembledSentence = [];

// Language-specific voice mapping configurations
const languageVoices = {
    polish: { code: 'pl-PL', defaultRate: 0.85 },
    spanish: { code: 'es-ES', defaultRate: 0.88 },
    french: { code: 'fr-FR', defaultRate: 0.85 },
    italian: { code: 'it-IT', defaultRate: 0.88 },
    german: { code: 'de-DE', defaultRate: 0.85 }
};

// --- Initialization & Event Binding Core Setup ---
document.addEventListener("DOMContentLoaded", () => {
    if (typeof allPhrasesData !== 'undefined') {
        allPhrases = allPhrasesData;
    } else {
        console.error("Critical: Could not read allPhrasesData from phrases.js!");
    }
    // --- Handle the 100% Anonymous Suggestion Popup Box ---
    document.getElementById("improve-link").addEventListener("click", (e) => {
        e.preventDefault();
        
        // Automatically inject current card context into hidden fields before showing the box
        document.getElementById("form-lang").value = document.getElementById("lang-select").value;
        document.getElementById("form-phrase-id").value = currentPhrase.id;
        document.getElementById("form-phrase-text").value = currentPhrase.english.join(" ");
        
        // Pop open the clean form overlay
        document.getElementById("improve-modal").style.display = "flex";
    });

    // Smoothly close the window and give confirmation when they hit submit
    document.getElementById("improve-form").addEventListener("submit", () => {
        setTimeout(() => {
            document.getElementById("improve-modal").style.display = "none";
            alert("Thank you! Your correction has been submitted anonymously.");
            document.getElementById("improve-form").reset();
        }, 300);
    });

    // Dropdown observers to dynamically update active layouts
    document.getElementById("lang-select").addEventListener("change", () => refreshCurrentQuestion());
    document.getElementById("speaker-gender").addEventListener("change", () => refreshCurrentQuestion());
    document.getElementById("listener-gender").addEventListener("change", () => refreshCurrentQuestion());
    document.getElementById("category-filter").addEventListener("change", () => loadNewDeck());
    
    // Connect interface control buttons
    document.getElementById("skip-btn").addEventListener("click", () => initQuestion());
    document.getElementById("next-btn").addEventListener("click", () => initQuestion());
    
    const targetElement = document.getElementById("target-display");
    if (targetElement) {
        targetElement.addEventListener("click", () => playAudio(false));
    } else {
        console.warn("Warning: target-display element was not ready during initial setup.");
    }

    document.getElementById("btn-normal").addEventListener("click", () => playAudio(false));
    document.getElementById("btn-slow").addEventListener("click", () => playAudio(true));

    // Handle initial legal check verification checks
    checkAgeGateStatus();
    loadNewDeck();
});

function loadNewDeck() {
    const selectedCategory = document.getElementById("category-filter").value;
    
    if (selectedCategory === "all") {
        currentDeck = [...allPhrases];
    } else {
        currentDeck = allPhrases.filter(phrase => phrase.category === selectedCategory);
    }
    
    initQuestion();
}

function initQuestion() {
    if (currentDeck.length === 0) {
        alert("Completed the selected pool! Shuffling phrases. Go again, or try a different level.");
        loadNewDeck();
        return;
    }

    const selectedLang = document.getElementById("lang-select").value;
    const speaker = document.getElementById("speaker-gender").value;
    const listener = document.getElementById("listener-gender").value;
    const selectedGender = `${speaker}_to_${listener}`;

    // Pick a card completely at random from the active deck
    let randomIndex = Math.floor(Math.random() * currentDeck.length);
    let pickedPhrase = currentDeck[randomIndex];
    let translationObj = pickedPhrase.translations[selectedLang];
    
    // Safety routing: Skip if this specific sentence doesn't support the selected settings
    if (!translationObj || (!translationObj["any"] && !translationObj[selectedGender])) {
        currentDeck.splice(randomIndex, 1); 
        initQuestion(); 
        return;
    }

    // Assign validated phrase variables
    currentPhrase = pickedPhrase;
    currentDeck.splice(randomIndex, 1);
    
    updateUIProgress(); 

    currentStepIndex = 0;
    assembledSentence = [];

    let sourceWords = translationObj[selectedGender] || translationObj["any"];
    currentPhrase.runtimeSteps = sourceWords;

    // Apply color badge categories
    const badge = document.getElementById("category-badge");
    badge.innerText = currentPhrase.category;
    badge.className = `category-badge category-${currentPhrase.category}`;

    document.getElementById("target-display").innerText = currentPhrase.english.join(" ");
    document.getElementById("next-btn").style.display = "none";
    document.getElementById("skip-btn").style.display = "block"; 
    document.getElementById("options-grid").style.display = "grid";

    renderStep();
}

function refreshCurrentQuestion() {
    if (!currentPhrase) return;

    const selectedLang = document.getElementById("lang-select").value;
    const speaker = document.getElementById("speaker-gender").value;
    const listener = document.getElementById("listener-gender").value;
    const selectedGender = `${speaker}_to_${listener}`;

    let translationObj = currentPhrase.translations[selectedLang];
    
    if (!translationObj || (!translationObj["any"] && !translationObj[selectedGender])) {
        initQuestion(); 
        return;
    }

    currentStepIndex = 0;
    assembledSentence = [];

    let sourceWords = translationObj[selectedGender] || translationObj["any"];
    currentPhrase.runtimeSteps = sourceWords;

    document.getElementById("next-btn").style.display = "none";
    document.getElementById("skip-btn").style.display = "block"; 
    document.getElementById("options-grid").style.display = "grid";

    window.speechSynthesis.cancel();
    renderStep();
}

function renderStep() {
    const totalSteps = currentPhrase.runtimeSteps.length;
    document.getElementById("step-indicator").innerText = `Part ${currentStepIndex + 1} of ${totalSteps}`;
    document.getElementById("answer-preview").innerText = assembledSentence.join(" ") + (assembledSentence.length > 0 ? "..." : "");

    const correctWord = currentPhrase.runtimeSteps[currentStepIndex];

    const targetDisplayElement = document.getElementById("target-display");
    targetDisplayElement.innerHTML = ""; 

    currentPhrase.english.forEach((word, idx) => {
        const wordSpan = document.createElement("span");
        wordSpan.innerText = word + " ";
        
        if (idx === currentStepIndex) {
            wordSpan.className = "current-target-segment";
        }
        
        targetDisplayElement.appendChild(wordSpan);
    });

    let distractors = generateDistractors(correctWord);
    let optionsPool = [correctWord, ...distractors].sort(() => Math.random() - 0.5);

    const grid = document.getElementById("options-grid");
    grid.innerHTML = "";

    optionsPool.forEach(word => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerText = word.toLowerCase();
        btn.onclick = () => handleChoice(word, btn);
        grid.appendChild(btn);
    });
}

function handleChoice(selectedWord, buttonElement) {
    const correctWord = currentPhrase.runtimeSteps[currentStepIndex];

    if (selectedWord === correctWord) {
        assembledSentence.push(selectedWord);
        currentStepIndex++;

        if (currentStepIndex < currentPhrase.runtimeSteps.length) {
            renderStep();
        } else {
            document.getElementById("step-indicator").innerText = "Completed!";
            document.getElementById("options-grid").style.display = "none";
            document.getElementById("skip-btn").style.display = "none"; 
            document.getElementById("next-btn").style.display = "block";
            
            document.getElementById("answer-preview").innerText = assembledSentence.join(" ");
            
            setTimeout(() => playAudio(false, true), 150); 
        }
    } else {
        buttonElement.classList.add("error");
        setTimeout(() => buttonElement.classList.remove("error"), 400);
    }
}

function generateDistractors(correct) {
    const selectedLang = document.getElementById("lang-select").value;
    const speaker = document.getElementById("speaker-gender").value;
    const listener = document.getElementById("listener-gender").value;
    const selectedGender = `${speaker}_to_${listener}`;
    let wordPool = [];

    allPhrases.forEach(p => {
        let transObj = p.translations[selectedLang];
        if (!transObj) return;
        
        let words = transObj[selectedGender] || transObj["any"];
        if (!words) return;

        words.forEach(w => { 
            if(w !== correct) wordPool.push(w); 
        });
    });

    let uniquePool = [...new Set(wordPool)];
    return uniquePool.sort(() => Math.random() - 0.5).slice(0, 3);
}

function playAudio(isSlow = false, readTargetLanguage = true) {
    window.speechSynthesis.cancel();
    
    const selectedLang = document.getElementById("lang-select").value;
    const config = languageVoices[selectedLang];
    
    let textToSpeak = currentPhrase.runtimeSteps.join(" ");
    let langCode = config.code;
    let rate = isSlow ? 0.5 : config.defaultRate;

    if (readTargetLanguage === false) {
        textToSpeak = currentPhrase.english.join(" ");
        langCode = 'en-GB';
        rate = isSlow ? 0.5 : 0.9;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = langCode;
    utterance.rate = rate;
    window.speechSynthesis.speak(utterance);
}

function updateUIProgress() {
    const selectedCategory = document.getElementById("category-filter").value;
    let totalInPool = allPhrases.length;
    
    if (selectedCategory !== "all") {
        totalInPool = allPhrases.filter(phrase => phrase.category === selectedCategory).length;
    }

    const activeProgress = totalInPool - currentDeck.length;
    document.getElementById("game-progress").innerText = `Phrase ${activeProgress} of ${totalInPool}`;
}

// --- Age Gate Navigation Functions ---
function checkAgeGateStatus() {
    const ageVerified = localStorage.getItem('ageGateVerified');
    const gateElement = document.getElementById("age-gate");
    
    if (ageVerified !== 'true') {
        if (gateElement) {
            gateElement.style.display = "flex";
            gateElement.style.opacity = "1";
        }
    } else {
        if (gateElement) gateElement.style.display = "none";
    }
}

function acceptAgeGate() {
    localStorage.setItem('ageGateVerified', 'true');
    const gateElement = document.getElementById("age-gate");
    
    if (gateElement) {
        gateElement.style.opacity = "0";
        setTimeout(() => {
            gateElement.style.display = "none";
        }, 400);
    }
}

// --- NEW: Activate the Progressive Web App Offline Service Worker ---
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(err => console.log("PWA service worker registration skipped locally."));
}
