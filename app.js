// ============================================
// 🎭 Meme Mood Matcher - Tamil Edition (PHOTO MODE ONLY)
// Click SNAP → GPT analyzes → "expression Tamil" → Tenor GIF
// ============================================

// Get config from config.js
const getConfig = () => window.APP_CONFIG || {};

// ============================================
// 🔐 Encryption Utilities (AES-like XOR for client-side)
// ============================================
const ENCRYPTION_KEY = 'memoji_secure_2026'; // Simple obfuscation key
const STORAGE_EXPIRY_DAYS = 7;
const MAX_HISTORY_ITEMS = 10;

function encryptData(data) {
    const jsonStr = JSON.stringify(data);
    let encrypted = '';
    for (let i = 0; i < jsonStr.length; i++) {
        encrypted += String.fromCharCode(
            jsonStr.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
        );
    }
    return btoa(encrypted); // Base64 encode
}

function decryptData(encryptedStr) {
    try {
        const decoded = atob(encryptedStr);
        let decrypted = '';
        for (let i = 0; i < decoded.length; i++) {
            decrypted += String.fromCharCode(
                decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
            );
        }
        return JSON.parse(decrypted);
    } catch (e) {
        console.warn('Failed to decrypt data, returning empty');
        return [];
    }
}

function isExpired(timestamp) {
    const expiryDate = new Date(timestamp);
    expiryDate.setDate(expiryDate.getDate() + STORAGE_EXPIRY_DAYS);
    return new Date() > expiryDate;
}

// Emoji mapping for sidebar display
const EMOJI_MAP = {
    neutral: '😐',
    happy: '😄',
    sad: '😢',
    angry: '😠',
    fearful: '😨',
    disgusted: '🤢',
    surprised: '😲'
};

// State - Photo Mode Only
const state = {
    isModelLoaded: false,
    isAnalyzing: false,
    isDetecting: false,
    currentEmotion: 'neutral',
    lastCaption: '',
    lastMemeQuery: '',
    lastMemeUrl: '',
    faceDetectionInterval: null,
    analysisCount: 0,
    capturedImage: null,
    hasConsent: localStorage.getItem('memoji_consent') === 'accepted'
};

// DOM Elements
let elements = {};

// ============================================
// Consent Management
// ============================================

function checkConsent() {
    return localStorage.getItem('memoji_consent') === 'accepted';
}

function showConsentBanner() {
    if (elements.consentBanner) {
        elements.consentBanner.classList.remove('hidden');
    }
}

function hideConsentBanner() {
    if (elements.consentBanner) {
        elements.consentBanner.classList.add('hidden');
    }
}

function acceptConsent() {
    localStorage.setItem('memoji_consent', 'accepted');
    state.hasConsent = true;
    hideConsentBanner();
    startAppAfterConsent();
}

function declineConsent() {
    hideConsentBanner();
    // Show declined message
    if (elements.app) {
        elements.app.innerHTML = `
            <div class="declined-state">
                <h2>😔 Consent Required</h2>
                <p>Memoji requires camera access and AI processing to work. Without consent, we cannot provide the service.</p>
                <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
                <p style="margin-top: 1rem;"><a href="#" onclick="openPrivacy(); return false;">Read our Privacy Policy</a></p>
            </div>
        `;
    }
}

// ============================================
// Initialization
// ============================================

async function init() {
    elements = {
        loadingScreen: document.getElementById('loading-screen'),
        progressFill: document.getElementById('progress-fill'),
        loadingStatus: document.getElementById('loading-status'),
        app: document.getElementById('app'),
        video: document.getElementById('video'),
        overlayCanvas: document.getElementById('overlay-canvas'),
        currentEmoji: document.getElementById('current-emoji'),
        currentEmotion: document.getElementById('current-emotion'),
        memePanel: document.getElementById('meme-panel'),
        memeImage: document.getElementById('meme-image'),
        memePlaceholder: document.getElementById('meme-placeholder'),
        aiLoader: document.getElementById('ai-loader'),
        aiCaption: document.getElementById('ai-caption'),
        captionText: document.getElementById('caption-text'),
        captureBtn: document.getElementById('capture-btn'),
        snapBtn: document.getElementById('snap-btn'),
        uploadBtn: document.getElementById('upload-btn'),
        uploadInput: document.getElementById('upload-input'),
        captureModal: document.getElementById('capture-modal'),
        captureCanvas: document.getElementById('capture-canvas'),
        downloadBtn: document.getElementById('download-btn'),
        shareBtn: document.getElementById('share-btn'),
        copyBtn: document.getElementById('copy-btn'),
        closeModalBtn: document.getElementById('close-modal-btn'),
        // Gallery Elements
        galleryModal: document.getElementById('gallery-modal'),
        galleryGrid: document.getElementById('gallery-grid'),
        closeGalleryBtn: document.getElementById('close-gallery-btn'),
        clearAllBtn: document.getElementById('clear-all-btn'),
        storageInfo: document.getElementById('storage-info'),
        galleryLink: document.getElementById('nav-gallery'),
        createLink: document.getElementById('nav-create'),
        // About Elements
        aboutModal: document.getElementById('about-modal'),
        closeAboutBtn: document.getElementById('close-about-btn'),
        aboutLink: document.getElementById('nav-about'),
        // Privacy Elements
        privacyModal: document.getElementById('privacy-modal'),
        closePrivacyBtn: document.getElementById('close-privacy-btn'),
        privacyLink: document.getElementById('nav-privacy'),
        // Consent Elements
        consentBanner: document.getElementById('consent-banner'),
        consentAccept: document.getElementById('consent-accept'),
        consentDecline: document.getElementById('consent-decline'),
        consentPrivacyLink: document.getElementById('consent-privacy-link')
    };

    const CONFIG = getConfig();
    
    // Setup consent listeners first
    setupConsentListeners();
    
    // Check if user has already given consent
    if (!checkConsent()) {
        // Load models in background but don't start camera
        updateLoadingStatus('Loading face detection...', 10);
        await loadModels();
        updateLoadingStatus('Awaiting consent...', 100);
        
        setTimeout(() => {
            elements.loadingScreen.classList.add('hidden');
            elements.app.classList.remove('hidden');
            showConsentBanner();
        }, 500);
        
        setupEventListeners();
        return;
    }
    
    try {
        if (!CONFIG.AZURE_OPENAI_ENDPOINT || CONFIG.AZURE_OPENAI_ENDPOINT === "YOUR_ENDPOINT_HERE") {
            console.warn('⚠️ Azure OpenAI not configured!');
            CONFIG.ENABLE_VLM = false;
        }

        updateLoadingStatus('Loading face detection...', 10);
        await loadModels();
        
        updateLoadingStatus('Starting camera...', 50);
        
        // Try to start camera, but don't fail if it doesn't work
        let cameraStarted = false;
        try {
            await startCamera();
            cameraStarted = true;
            updateLoadingStatus('Ready! Click SNAP! 📸', 100);
        } catch (camError) {
            console.warn('Camera failed to start:', camError);
            updateLoadingStatus('Camera unavailable - check permissions', 100);
            // handleCameraError is already called inside startCamera
        }
        
        setTimeout(() => {
            elements.loadingScreen.classList.add('hidden');
            elements.app.classList.remove('hidden');
            if (cameraStarted) {
                startApp();
            }
        }, 500);
        
        setupEventListeners();
        cleanupExpiredHistory();
        
    } catch (error) {
        console.error('Init error:', error);
        updateLoadingStatus(`Error: ${error.message}`, 0);
        
        // Still show the app so user can see error message
        setTimeout(() => {
            elements.loadingScreen.classList.add('hidden');
            elements.app.classList.remove('hidden');
            showError('⚠️ Initialization Error', `<p>${error.message}</p><p>Please refresh the page to try again.</p>`, true);
        }, 1000);
    }
}

async function startAppAfterConsent() {
    const CONFIG = getConfig();
    
    try {
        if (!CONFIG.AZURE_OPENAI_ENDPOINT || CONFIG.AZURE_OPENAI_ENDPOINT === "YOUR_ENDPOINT_HERE") {
            CONFIG.ENABLE_VLM = false;
        }
        
        await startCamera();
        startApp();
        cleanupExpiredHistory();
    } catch (error) {
        console.error('Start error:', error);
        // Error UI is already shown by handleCameraError
        // Don't use alert, the error display is already visible
    }
}

function setupConsentListeners() {
    if (elements.consentAccept) {
        elements.consentAccept.addEventListener('click', acceptConsent);
    }
    if (elements.consentDecline) {
        elements.consentDecline.addEventListener('click', declineConsent);
    }
    if (elements.consentPrivacyLink) {
        elements.consentPrivacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            openPrivacy();
        });
    }
}

function updateLoadingStatus(message, progress) {
    elements.loadingStatus.textContent = message;
    elements.progressFill.style.width = `${progress}%`;
}

function startApp() {
    console.log('\n🚀 ====== MEMOJI STARTED ======');
    console.log('📸 Photo Mode Active');
    console.log('==============================\n');
    
    // Start face detection for emoji display in sidebar
    startFaceDetection();
    
    // Show SNAP button
    if (elements.snapBtn) {
        elements.snapBtn.classList.remove('hidden');
        elements.snapBtn.classList.add('pulse');
    }
    
    // Initial caption hint
    if (elements.captionText) {
        elements.captionText.textContent = 'waiting for input...';
        elements.captionText.classList.remove('typewriter'); // Remove initially so we can re-add
        void elements.captionText.offsetWidth; // Trigger reflow
        elements.captionText.classList.add('typewriter');
    }
}

// ============================================
// Model Loading
// ============================================

async function loadModels() {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';
    
    await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
    ]);
    
    state.isModelLoaded = true;
    console.log('✅ Models loaded');
}

// ============================================
// Camera Setup
// ============================================

async function startCamera() {
    try {
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera not supported on this browser');
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
        });
        
        elements.video.srcObject = stream;
        
        await new Promise(resolve => {
            elements.video.onloadedmetadata = () => {
                elements.video.play();
                resolve();
            };
        });
        
        elements.overlayCanvas.width = elements.video.videoWidth;
        elements.overlayCanvas.height = elements.video.videoHeight;
        
        console.log('✅ Camera started');
        hideError(); // Clear any previous errors
        
    } catch (error) {
        console.error('Camera error:', error);
        handleCameraError(error);
        throw error; // Re-throw to be caught by caller
    }
}

function handleCameraError(error) {
    let title = '📷 Camera Access Required';
    let message = '';
    let canRetry = true;
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        message = `
            <p>Camera permission was denied. To use Memoji, please:</p>
            <ol>
                <li>Click the camera/lock icon in your browser's address bar</li>
                <li>Allow camera access for this site</li>
                <li>Refresh the page</li>
            </ol>
            <p class="error-hint">On mobile: Check your browser settings → Site Settings → Camera</p>
        `;
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        title = '📷 No Camera Found';
        message = '<p>No camera was detected on your device. Please connect a webcam and try again.</p>';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        title = '📷 Camera In Use';
        message = '<p>Your camera is being used by another application. Please close other apps using the camera and try again.</p>';
    } else if (error.name === 'OverconstrainedError') {
        message = '<p>Camera requirements could not be met. Trying with default settings...</p>';
        // Try again with simpler constraints
        trySimpleCamera();
        return;
    } else if (error.message === 'Camera not supported on this browser') {
        title = '🌐 Browser Not Supported';
        message = '<p>Your browser does not support camera access. Please try using Chrome, Firefox, Safari, or Edge.</p>';
        canRetry = false;
    } else {
        message = `<p>Failed to access camera: ${error.message || 'Unknown error'}</p>`;
    }
    
    showError(title, message, canRetry);
}

async function trySimpleCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        elements.video.srcObject = stream;
        await new Promise(resolve => {
            elements.video.onloadedmetadata = () => {
                elements.video.play();
                resolve();
            };
        });
        elements.overlayCanvas.width = elements.video.videoWidth;
        elements.overlayCanvas.height = elements.video.videoHeight;
        console.log('✅ Camera started (simple mode)');
        hideError();
    } catch (e) {
        handleCameraError(e);
    }
}

// ============================================
// Error UI Management
// ============================================

function showError(title, message, canRetry = true) {
    // Create or update error display in meme panel area
    let errorDiv = document.getElementById('error-display');
    
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-display';
        errorDiv.className = 'error-display';
        
        // Insert after video wrapper or in a visible area
        const workspace = document.querySelector('.workspace');
        if (workspace) {
            workspace.insertAdjacentElement('afterbegin', errorDiv);
        } else {
            document.body.appendChild(errorDiv);
        }
    }
    
    errorDiv.innerHTML = `
        <div class="error-content">
            <h3>${title}</h3>
            ${message}
            <div class="error-actions">
                ${canRetry ? '<button class="btn btn-primary" onclick="retryCamera()">🔄 Try Again</button>' : ''}
                <button class="btn btn-outline" onclick="openPrivacy()">Privacy Policy</button>
            </div>
        </div>
    `;
    errorDiv.classList.remove('hidden');
    
    // Also show toast notification
    showToast(title.replace(/[📷🌐]/g, '').trim(), 'error');
}

function hideError() {
    const errorDiv = document.getElementById('error-display');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
    }
}

function retryCamera() {
    hideError();
    startCamera().catch(() => {}); // Error will be handled inside
}

// Toast notifications for user feedback
function showToast(message, type = 'info') {
    // Remove existing toast
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 4 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================
// 😀 Face Detection Loop (for sidebar emoji)
// ============================================

function startFaceDetection() {
    if (state.faceDetectionInterval) clearInterval(state.faceDetectionInterval);
    state.faceDetectionInterval = setInterval(detectFace, 150);
}

async function detectFace() {
    if (!state.isModelLoaded || state.isDetecting) return;
    state.isDetecting = true;
    
    try {
        const detections = await faceapi
            .detectAllFaces(elements.video, new faceapi.TinyFaceDetectorOptions())
            .withFaceExpressions();
        
        if (detections.length > 0) {
            const detection = detections[0];
            const expressions = detection.expressions;
            
            // Find dominant emotion
            let maxConf = 0;
            let dominant = 'neutral';
            for (const [emotion, conf] of Object.entries(expressions)) {
                if (conf > maxConf && conf > 0.5) {
                    maxConf = conf;
                    dominant = emotion;
                }
            }
            
            state.currentEmotion = dominant;
            
            // Update emoji display in sidebar
            if (elements.currentEmoji) {
                elements.currentEmoji.textContent = EMOJI_MAP[dominant] || '😐';
            }
            if (elements.currentEmotion) {
                elements.currentEmotion.textContent = dominant;
            }
        }
    } catch (e) {
        // Ignore detection errors
    }
    
    state.isDetecting = false;
}

// ============================================
// 📸 SNAP! - Click to Analyze (Photo Mode)
// ============================================

async function snapPhoto() {
    const CONFIG = getConfig();
    
    if (state.isAnalyzing) {
        console.log('⏳ Already analyzing, please wait...');
        return;
    }
    
    console.log('\n📸 ====== SNAP! Photo Mode Triggered ======');
    
    // Visual feedback - disable button
    if (elements.snapBtn) {
        elements.snapBtn.textContent = '⏳ Analyzing...';
        elements.snapBtn.disabled = true;
        elements.snapBtn.classList.remove('pulse');
    }
    
    // Flash effect
    elements.video.style.filter = 'brightness(2)';
    setTimeout(() => {
        elements.video.style.filter = 'brightness(1)';
    }, 100);
    
    // Run VLM analysis
    if (CONFIG.ENABLE_VLM) {
        await analyzeWithVLM();
    } else {
        // Fallback if VLM not configured
        await searchTenor(`${state.currentEmotion} Tamil`, state.analysisCount);
    }
    
    // Reset button
    if (elements.snapBtn) {
        elements.snapBtn.textContent = '📸 SNAP!';
        elements.snapBtn.disabled = false;
        elements.snapBtn.classList.add('pulse');
    }
}

// ============================================
// 📁 Handle Image Upload
// ============================================

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('\n📁 ====== IMAGE UPLOAD ======');
    console.log(`   📄 File: ${file.name}`);
    console.log(`   📦 Size: ${Math.round(file.size / 1024)}KB`);
    
    // Visual feedback
    if (elements.uploadBtn) {
        elements.uploadBtn.textContent = '⏳ Analyzing...';
        elements.uploadBtn.disabled = true;
    }
    
    try {
        // Read file as base64
        const base64Image = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // Store for saving result
                state.capturedImage = new Image();
                state.capturedImage.src = reader.result;
                resolve(reader.result.split(',')[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        
        console.log(`   ✅ Image loaded`);
        
        // Analyze with VLM
        await analyzeUploadedImage(base64Image);
        
    } catch (error) {
        console.error('❌ Upload error:', error);
    }
    
    // Reset button and input
    if (elements.uploadBtn) {
        elements.uploadBtn.textContent = '📁 Upload Image';
        elements.uploadBtn.disabled = false;
    }
    elements.uploadInput.value = ''; // Reset file input
}

async function analyzeUploadedImage(base64Image) {
    state.analysisCount++;
    const analysisId = state.analysisCount;
    const CONFIG = getConfig();
    
    console.log(`\n📸 ====== ANALYSIS #${analysisId} (UPLOADED) ======`);
    console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
    
    if (elements.aiCaption) {
        elements.aiCaption.classList.add('loading');
        elements.captionText.textContent = '"Analyzing uploaded image..."';
        // Show loader in meme box
        if (elements.aiLoader) {
            elements.aiLoader.classList.remove('hidden');
            elements.memePlaceholder.classList.add('hidden');
            elements.memeImage.classList.remove('visible');
        }
    }
    
    try {
        if (CONFIG.ENABLE_VLM) {
            console.log(`\n🤖 Sending to GPT-4o...`);
            const gptResponse = await callAzureOpenAI(base64Image, analysisId);
            
            if (gptResponse && gptResponse.search) {
                console.log(`\n🎯 GPT Response:`);
                console.log(`   � Expression: "${gptResponse.expression || 'N/A'}"`);
                console.log(`   🔥 Roast: "${gptResponse.caption || 'N/A'}"`);
                console.log(`   🔍 Search (by topic): "${gptResponse.search}"`);
                
                if (gptResponse.caption) {
                    updateCaption(gptResponse.caption);
                }
                
                await searchTenor(gptResponse.search, analysisId);
            } else {
                await searchTenor('Tamil meme funny', analysisId);
            }
        } else {
            await searchTenor('Tamil meme reaction', analysisId);
        }
    } catch (error) {
        console.error(`❌ Analysis failed:`, error.message);
        await searchTenor('Tamil comedy meme', analysisId);
    }
    
    if (elements.aiCaption) {
        elements.aiCaption.classList.remove('loading');
        if (elements.aiLoader) elements.aiLoader.classList.add('hidden');
    }
    
    console.log(`\n✅ ====== ANALYSIS #${analysisId} DONE ======\n`);
}

// ============================================
// 🤖 GPT Vision Analysis (with Full Debug Logging)
// ============================================

async function analyzeWithVLM() {
    if (state.isAnalyzing) return;
    state.isAnalyzing = true;
    state.analysisCount++;
    
    const analysisId = state.analysisCount;
    const CONFIG = getConfig();
    
    console.log(`\n📸 ====== ANALYSIS #${analysisId} ======`);
    console.log(`⏰ Time: ${new Date().toLocaleTimeString()}`);
    
    if (elements.aiCaption) {
        elements.aiCaption.classList.add('loading');
        elements.captionText.textContent = '"Analyzing your face..."';
        // Show loader
        if (elements.aiLoader) {
            elements.aiLoader.classList.remove('hidden');
            elements.memePlaceholder.classList.add('hidden');
            elements.memeImage.classList.remove('visible');
        }
    }
    
    try {
        // STEP 1: Capture frame
        console.log(`\n🖼️ [STEP 1] Capturing webcam frame...`);
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = elements.video.videoWidth;
        frameCanvas.height = elements.video.videoHeight;
        const ctx = frameCanvas.getContext('2d');
        
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(elements.video, -frameCanvas.width, 0);
        ctx.restore();
        
        const imageDataUrl = frameCanvas.toDataURL('image/jpeg', 0.7);
        const base64Image = imageDataUrl.split(',')[1];
        
        // Store for saving result
        state.capturedImage = new Image();
        state.capturedImage.src = imageDataUrl;
        
        console.log(`   ✅ Captured: ${frameCanvas.width}x${frameCanvas.height}`);
        console.log(`   📦 Size: ${Math.round(base64Image.length / 1024)}KB`);
        
        // STEP 2: Send to GPT
        console.log(`\n🤖 [STEP 2] Sending to GPT-4o...`);
        const gptResponse = await callAzureOpenAI(base64Image, analysisId);
        
        if (gptResponse && gptResponse.search) {
            // STEP 3: Show GPT response
            console.log(`\n🎯 [STEP 3] GPT Response:`);
            console.log(`   � Expression: "${gptResponse.expression || 'N/A'}"`);
            console.log(`   🔥 Roast: "${gptResponse.caption || 'N/A'}"`);
            console.log(`   🔍 Search (by topic): "${gptResponse.search}"`);
            
            // Update caption
            if (gptResponse.caption) {
                updateCaption(gptResponse.caption);
            }
            
            // STEP 4: Search Tenor
            console.log(`\n🎬 [STEP 4] Searching Tenor...`);
            await searchTenor(gptResponse.search, analysisId);
            
        } else {
            console.log(`   ⚠️ Invalid GPT response, using fallback`);
            await searchTenor('Tamil meme funny', analysisId);
        }
        
    } catch (error) {
        console.error(`\n❌ Analysis #${analysisId} failed:`, error.message);
        await searchTenor('Tamil comedy meme', analysisId);
    }
    
    if (elements.aiCaption) {
        elements.aiCaption.classList.remove('loading');
        if (elements.aiLoader) elements.aiLoader.classList.add('hidden');
    }
    
    console.log(`\n✅ ====== ANALYSIS #${analysisId} DONE ======\n`);
    state.isAnalyzing = false;
}

async function callAzureOpenAI(base64Image, analysisId) {
    const CONFIG = getConfig();
    
    const endpoint = CONFIG.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '');
    const deployment = CONFIG.AZURE_OPENAI_DEPLOYMENT;
    const apiVersion = CONFIG.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';
    
    const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    
    const prompt = `You are a Tamil meme expert. Look CAREFULLY at this person's face and body language.

1. EXPRESSION: What do you see? Look for:
   - Facial expression (smiling, sad, angry, shocked, thinking, bored, confused)
   - Eye gestures (winking, one eye closed, rolling eyes, wide eyes, sleepy eyes)
   - Hand gestures (thumbs up, peace sign, hand on chin, facepalm, pointing)
   - Poses (leaning, slouching, arms crossed, shrugging)
   - Mouth (tongue out, lips pursed, mouth open, smirking)
   
   Be SPECIFIC! Don't just say "bored" - describe exactly what you see.

2. ROAST: Write a funny Tanglish caption (Tamil + English, max 12 words) that matches EXACTLY what they're doing. Be creative with college/daily life themes:
   - Winking → flirting, crush, secret
   - One eye closed → tired, sleepy, suspicious
   - Thumbs up → sarcastic okay, fake happy
   - Thinking pose → confused, overthinking
   - Tongue out → teasing, playful, silly

3. SEARCH: Based on your ROAST's theme, give a Tamil meme search query.
   Search for the TOPIC, not the expression!

RESPOND ONLY WITH JSON:
{"expression": "detailed description of pose/gesture", "caption": "Tanglish roast matching the pose", "search": "roast topic Tamil"}`;

    console.log(`   📤 Calling GPT-4o...`);
    const startTime = Date.now();
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'api-key': CONFIG.AZURE_OPENAI_API_KEY
        },
        body: JSON.stringify({
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: 'high' } }
                ]
            }],
            max_tokens: 150,
            temperature: 0.9
        })
    });
    
    const elapsed = Date.now() - startTime;
    console.log(`   ⏱️ Response time: ${elapsed}ms`);
    
    if (!response.ok) {
        const error = await response.text();
        console.error(`   ❌ GPT Error:`, error);
        throw new Error('GPT request failed');
    }
    
    const data = await response.json();
    const content = data.choices[0]?.message?.content || '';
    
    console.log(`   📥 Raw response: ${content}`);
    
    try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`   ✅ Parsed OK`);
            return parsed;
        }
    } catch (e) {
        console.error(`   ❌ JSON parse failed`);
    }
    
    return null;
}

// ============================================
// 🎬 Tenor GIF Search (with Hashtag Logging)
// ============================================

async function searchTenor(query, analysisId) {
    const CONFIG = getConfig();
    
    console.log(`   🔍 Query: "${query}"`);
    
    try {
        const apiKey = CONFIG.TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
        const searchQuery = encodeURIComponent(query);
        const tenorUrl = `https://tenor.googleapis.com/v2/search?q=${searchQuery}&key=${apiKey}&limit=10&media_filter=gif`;
        
        const response = await fetch(tenorUrl);
        if (!response.ok) throw new Error('Tenor API error');
        
        const data = await response.json();
        
        console.log(`\n📦 [STEP 5] Tenor Results:`);
        console.log(`   📊 Found: ${data.results?.length || 0} GIFs`);
        
        if (data.results && data.results.length > 0) {
            // Show top 5 options with HASHTAGS
            console.log(`   🖼️ Options (with hashtags):`);
            data.results.slice(0, 5).forEach((r, i) => {
                const tags = r.tags?.join(', ') || 'no tags';
                console.log(`      ${i+1}. [${tags}]`);
                console.log(`         Desc: "${r.content_description || 'N/A'}"`);
            });
            
            // Pick random from top 5
            const idx = Math.floor(Math.random() * Math.min(data.results.length, 5));
            const picked = data.results[idx];
            
            console.log(`\n🎯 [STEP 6] Selected:`);
            console.log(`   🎲 Picked: #${idx + 1}`);
            console.log(`   🏷️ Hashtags: [${picked.tags?.join(', ') || 'none'}]`);
            console.log(`   📝 Desc: "${picked.content_description || 'N/A'}"`);
            
            const gifUrl = picked.media_formats.gif?.url || picked.media_formats.tinygif?.url;
            console.log(`   🌐 URL: ${gifUrl}`);
            
            if (gifUrl) {
                state.lastMemeQuery = query;
                state.lastMemeUrl = gifUrl;
                
                // Set crossOrigin BEFORE setting src to enable CORS
                elements.memeImage.crossOrigin = 'anonymous';
                elements.memeImage.src = gifUrl;
                elements.memeImage.classList.add('visible');
                elements.memePlaceholder.classList.add('hidden');
                
                // Save automatically to history when successful
                saveToHistory(state.lastCaption, gifUrl);

                console.log(`\n✅ [STEP 7] GIF displayed!`);
            }
        } else {
            console.log(`   ⚠️ No results, trying fallback...`);
            if (!query.includes('meme')) {
                await searchTenor('Tamil meme reaction', analysisId);
            }
        }
    } catch (error) {
        console.error(`   ❌ Tenor error:`, error.message);
    }
}

// ============================================
// Caption Update
// ============================================

function updateCaption(caption) {
    if (!caption || caption === state.lastCaption) return;
    state.lastCaption = caption;
    
    if (elements.captionText) {
        // Reset typewriter animation
        elements.captionText.classList.remove('typewriter');
        void elements.captionText.offsetWidth; // Force reflow
        
        elements.captionText.textContent = `"${caption}"`;
        elements.captionText.classList.add('typewriter');
        
        // Parent card animation
        elements.aiCaption.classList.remove('new-caption');
        setTimeout(() => elements.aiCaption.classList.add('new-caption'), 10);
    }
}

// ============================================
// Capture & Share
// ============================================

function capturePhoto() {
    const captureCanvas = elements.captureCanvas;
    const ctx = captureCanvas.getContext('2d');
    
    // Determine source image (video or captured snapshot)
    const sourceImage = (state.capturedImage && state.capturedImage.complete && state.capturedImage.naturalWidth > 0) 
                        ? state.capturedImage 
                        : elements.video;
    
    const isVideo = (sourceImage === elements.video);
    const vw = isVideo ? elements.video.videoWidth : sourceImage.naturalWidth;
    const vh = isVideo ? elements.video.videoHeight : sourceImage.naturalHeight;
    
    // If we have a meme, create side-by-side
    if (elements.memeImage.src && elements.memeImage.complete) {
        captureCanvas.width = vw * 2;
        captureCanvas.height = vh;
        
        // Draw source image on left
        if (isVideo) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(elements.video, -vw, 0);
            ctx.restore();
        } else {
            // Captured image is already mirrored if from VLM, or normal if upload
            ctx.drawImage(sourceImage, 0, 0);
        }
        
        // Right side background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(vw, 0, vw, vh);
        
        // Caption header
        ctx.fillStyle = '#1e293b'; // Slate 800
        ctx.fillRect(vw, 0, vw, 80);
        
        ctx.fillStyle = '#f8fafc'; // Slate 50
        ctx.font = '600 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Wrap text if too long
        const text = `"${state.lastCaption || 'Memoji Roast'}"`;
        ctx.fillText(text, vw + vw/2, 40);
        
        // Draw meme
        const img = elements.memeImage;
        const aspect = img.naturalWidth / img.naturalHeight;
        let mw = vw * 0.9;
        let mh = mw / aspect;
        if (mh > vh - 100) { mh = vh - 100; mw = mh * aspect; }
        
        ctx.drawImage(img, vw + (vw - mw) / 2, 90 + (vh - 100 - mh) / 2, mw, mh);
    } else {
        // Just the source
        captureCanvas.width = vw;
        captureCanvas.height = vh;
        
        if (isVideo) {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(elements.video, -vw, 0);
            ctx.restore();
        } else {
            ctx.drawImage(sourceImage, 0, 0);
        }
    }
    
    // Branding watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '500 14px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Memoji • AI Meme Generator', captureCanvas.width - 20, captureCanvas.height - 20);
    
    elements.captureModal.classList.remove('hidden');
}

function downloadPhoto() {
    try {
        // Method 1: Try using Blob URL (most reliable)
        elements.captureCanvas.toBlob((blob) => {
            if (!blob) {
                fallbackDownload();
                return;
            }
            
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `memoji-roast-${Date.now()}.png`;
            link.href = url;
            link.style.display = 'none';
            document.body.appendChild(link);
            
            // Use click() with a small delay for Safari
            setTimeout(() => {
                link.click();
                // Cleanup
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
            }, 0);
            
            // Visual feedback
            showDownloadSuccess();
        }, 'image/png');
        
    } catch (e) {
        console.error('Download error:', e);
        fallbackDownload();
    }
}

function fallbackDownload() {
    try {
        // Method 2: Data URL approach
        const dataUrl = elements.captureCanvas.toDataURL('image/png');
        
        // For iOS/Safari, try opening in new tab
        if (/iPad|iPhone|iPod/.test(navigator.userAgent) || 
            (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome'))) {
            // Open image in new tab - user can long-press to save
            const newTab = window.open();
            if (newTab) {
                newTab.document.write(`
                    <html><head><title>Memoji - Save Image</title></head>
                    <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#111;">
                        <div style="text-align:center;color:white;font-family:sans-serif;">
                            <p>Long-press (mobile) or right-click (desktop) the image to save:</p>
                            <img src="${dataUrl}" style="max-width:100%;border-radius:8px;margin-top:1rem;" />
                        </div>
                    </body></html>
                `);
                newTab.document.close();
                showToast('Image opened in new tab - save from there', 'info');
                return;
            }
        }
        
        // Standard download
        const link = document.createElement('a');
        link.download = `memoji-roast-${Date.now()}.png`;
        link.href = dataUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showDownloadSuccess();
    } catch (e2) {
        console.error('Fallback download error:', e2);
        showToast('Download failed - try right-clicking the image', 'error');
    }
}

function showDownloadSuccess() {
    if (elements.downloadBtn) {
        const btn = elements.downloadBtn;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '✅ Saved!';
        setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
    }
    showToast('Image saved!', 'success');
}

async function sharePhoto() {
    try {
        // Generate blob from canvas
        const blob = await new Promise((resolve, reject) => {
            elements.captureCanvas.toBlob((b) => {
                if (b) resolve(b);
                else reject(new Error('Failed to create blob'));
            }, 'image/png');
        });
        
        const file = new File([blob], 'memoji-roast.png', { type: 'image/png' });
        
        // Check if Web Share API is available and supports files
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'My Memoji Roast!',
                text: state.lastCaption ? `"${state.lastCaption}" 🎭 Created with Memoji` : 'Check my meme match! 🎭 Created with Memoji'
            });
            return;
        }
        
        // Fallback: Try share without files (URL/text only)
        if (navigator.share) {
            await navigator.share({
                title: 'My Memoji Roast!',
                text: state.lastCaption ? `"${state.lastCaption}" 🎭 Check out Memoji - AI Meme Generator!` : 'Check out Memoji - AI Meme Generator!',
                url: window.location.href
            });
            // Also download so they can attach it
            downloadPhoto();
            return;
        }
        
        // Desktop fallback - show options
        showShareOptions();
        
    } catch (e) {
        if (e.name === 'AbortError') {
            // User cancelled share - this is fine
            return;
        }
        console.error('Share error:', e);
        showShareOptions();
    }
}

function showShareOptions() {
    const subject = encodeURIComponent("Check out my Memoji Roast! 🎭");
    const body = encodeURIComponent(`I just got roasted by Memoji AI!\n\n"${state.lastCaption || ''}"\n\nTry it yourself: ${window.location.href}`);
    
    const choice = confirm(
        "Share options:\n\n" +
        "• Click OK to download image + open email\n" +
        "• Click Cancel to just download image\n\n" +
        "(You can then share the downloaded image on WhatsApp, Instagram, etc.)"
    );
    
    downloadPhoto();
    
    if (choice) {
        window.open(`mailto:?subject=${subject}&body=${body}`);
    }
}

async function copyPhoto() {
    // Check if Clipboard API with images is supported
    const hasClipboardAPI = navigator.clipboard && typeof ClipboardItem !== 'undefined';
    
    if (hasClipboardAPI) {
        try {
            const blob = await new Promise((resolve, reject) => {
                elements.captureCanvas.toBlob((b) => {
                    if (b) resolve(b);
                    else reject(new Error('Failed to create blob'));
                }, 'image/png');
            });
            
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            
            // Visual feedback
            showCopySuccess();
            return;
            
        } catch (err) {
            console.warn('Clipboard API failed:', err);
            // Fall through to fallback
        }
    }
    
    // Fallback: Copy data URL as text (user can paste in some apps)
    try {
        const dataUrl = elements.captureCanvas.toDataURL('image/png');
        
        // Try copying text to clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(dataUrl);
            showToast('Image URL copied! Paste in compatible apps.', 'info');
            showCopySuccess();
            return;
        }
        
        // Legacy fallback using execCommand
        const textArea = document.createElement('textarea');
        textArea.value = dataUrl;
        textArea.style.cssText = 'position:fixed;left:-9999px;';
        document.body.appendChild(textArea);
        textArea.select();
        
        const success = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (success) {
            showToast('Image data copied!', 'info');
            showCopySuccess();
        } else {
            throw new Error('execCommand failed');
        }
        
    } catch (fallbackErr) {
        console.error('All copy methods failed:', fallbackErr);
        showCopyFailed();
    }
}

function showCopySuccess() {
    if (elements.copyBtn) {
        const btn = elements.copyBtn;
        const originalContent = btn.innerHTML;
        btn.innerHTML = 'Copied! ✅';
        btn.classList.add('btn-success');
        
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.classList.remove('btn-success');
        }, 2000);
    }
}

function showCopyFailed() {
    showToast('Copy not supported - use Download instead', 'error');
    
    // Highlight download button as alternative
    if (elements.downloadBtn) {
        elements.downloadBtn.classList.add('pulse');
        setTimeout(() => elements.downloadBtn.classList.remove('pulse'), 2000);
    }
}

function closeModal() {
    elements.captureModal.classList.add('hidden');
}

// ============================================
// 🖼️ Gallery Logic (Encrypted LocalStorage with Expiration)
// ============================================

function cleanupExpiredHistory() {
    let history = getHistory();
    const validHistory = history.filter(item => !isExpired(item.timestamp));
    
    if (validHistory.length !== history.length) {
        console.log(`🧹 Cleaned up ${history.length - validHistory.length} expired items`);
        saveHistory(validHistory);
    }
}

function getHistory() {
    const encrypted = localStorage.getItem('memoji_history_v2');
    if (!encrypted) {
        // Migrate from old unencrypted storage
        const oldHistory = localStorage.getItem('memoji_history');
        if (oldHistory) {
            try {
                const parsed = JSON.parse(oldHistory);
                saveHistory(parsed);
                localStorage.removeItem('memoji_history');
                return parsed;
            } catch (e) {
                return [];
            }
        }
        return [];
    }
    return decryptData(encrypted);
}

function saveHistory(history) {
    const encrypted = encryptData(history);
    try {
        localStorage.setItem('memoji_history_v2', encrypted);
    } catch (e) {
        console.warn('⚠️ Storage full, clearing older items');
        history = history.slice(0, Math.floor(history.length / 2));
        localStorage.setItem('memoji_history_v2', encryptData(history));
    }
}

function saveToHistory(caption, memeUrl) {
    if (!caption || !memeUrl) return;

    let userImage = null;
    // Save the captured image data URL if available (compressed)
    if (state.capturedImage && state.capturedImage.src) {
        // Compress image to reduce storage
        userImage = compressImage(state.capturedImage.src);
    }

    const historyItem = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        caption: caption,
        memeUrl: memeUrl,
        userImage: userImage
    };

    let history = getHistory();
    
    // Avoid duplicates (same caption within 5 seconds)
    const recentDuplicate = history.find(h => 
        h.caption === caption && 
        (Date.now() - new Date(h.timestamp).getTime()) < 5000
    );
    if (recentDuplicate) return;
    
    history.unshift(historyItem);
    
    // Limit to max items
    if (history.length > MAX_HISTORY_ITEMS) {
        history = history.slice(0, MAX_HISTORY_ITEMS);
    }
    
    saveHistory(history);
    console.log('💾 Saved to history (encrypted)');
    updateStorageInfo();
}

function compressImage(dataUrl) {
    // For now, just return as-is (could add canvas compression later)
    // This helps with very large images
    if (dataUrl && dataUrl.length > 500000) {
        // Skip storing very large images to save space
        return null;
    }
    return dataUrl;
}

function deleteHistoryItem(id) {
    let history = getHistory();
    history = history.filter(item => item.id !== id);
    saveHistory(history);
    loadGallery();
    console.log(`🗑️ Deleted item ${id}`);
}

function clearAllHistory() {
    if (confirm('Are you sure you want to delete all your roast history? This cannot be undone.')) {
        localStorage.removeItem('memoji_history_v2');
        localStorage.removeItem('memoji_history');
        loadGallery();
        console.log('🗑️ Cleared all history');
    }
}

function updateStorageInfo() {
    const history = getHistory();
    const oldestItem = history[history.length - 1];
    let expiryText = '';
    
    if (oldestItem) {
        const expiryDate = new Date(oldestItem.timestamp);
        expiryDate.setDate(expiryDate.getDate() + STORAGE_EXPIRY_DAYS);
        const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        expiryText = ` • Oldest expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`;
    }
    
    if (elements.storageInfo) {
        elements.storageInfo.textContent = `Storage: ${history.length}/${MAX_HISTORY_ITEMS} items${expiryText}`;
    }
}

function loadGallery() {
    cleanupExpiredHistory();
    const history = getHistory();
    const grid = elements.galleryGrid;
    
    if (!grid) return;
    grid.innerHTML = '';
    updateStorageInfo();

    if (history.length === 0) {
        grid.innerHTML = `
            <div class="empty-gallery">
                <p>No roasts yet! Go make some memes. 📸</p>
            </div>`;
        return;
    }

    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'gallery-item';
        
        // Format date
        const date = new Date(item.timestamp);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        // Build image HTML
        let imagesHtml = '';
        if (item.userImage) {
            imagesHtml += `<img src="${item.userImage}" class="gallery-thumb user-thumb" alt="You" loading="lazy">`;
        }
        imagesHtml += `<img src="${item.memeUrl}" class="gallery-thumb meme-thumb" alt="Meme" loading="lazy">`;
        
        div.innerHTML = `
            <div class="gallery-item-actions">
                <button class="gallery-action-btn" onclick="event.stopPropagation(); retryHistoryItem(${item.id})" title="Retry">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                </button>
                <button class="gallery-action-btn delete" onclick="event.stopPropagation(); deleteHistoryItem(${item.id})" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
            <div class="gallery-images-pair" onclick="showInMainView(${JSON.stringify(item).replace(/"/g, '&quot;')})">
                ${imagesHtml}
            </div>
            <div class="gallery-caption">"${item.caption}"</div>
            <div class="gallery-item-date">${dateStr}</div>
        `;
        grid.appendChild(div);
    });
}

function retryHistoryItem(id) {
    const history = getHistory();
    const item = history.find(h => h.id === id);
    if (item) {
        showInMainView(item);
        closeGallery();
        // Trigger a new snap after showing the item
        setTimeout(() => snapPhoto(), 500);
    }
}

function showInMainView(item) {
    // Handle both object and stringified object
    const data = typeof item === 'string' ? JSON.parse(item) : item;
    
    // Load a history item back into the main view
    updateCaption(data.caption);
    
    // Set crossOrigin BEFORE src to enable CORS for canvas export
    elements.memeImage.crossOrigin = 'anonymous';
    elements.memeImage.src = data.memeUrl;
    elements.memeImage.classList.add('visible');
    elements.memePlaceholder.classList.add('hidden');
    
    // Restore the captured user image state so "Save Result" works with this photo
    if (data.userImage) {
        state.capturedImage = new Image();
        state.capturedImage.src = data.userImage;
    }
    
    state.lastMemeUrl = data.memeUrl;

    elements.galleryModal.classList.add('hidden');
    
    // Switch nav active state
    if (elements.createLink) elements.createLink.classList.add('active');
    if (elements.galleryLink) elements.galleryLink.classList.remove('active');
}

function openGallery() {
    loadGallery();
    elements.galleryModal.classList.remove('hidden');
    if (elements.galleryLink) elements.galleryLink.classList.add('active');
    if (elements.createLink) elements.createLink.classList.remove('active');
}

function closeGallery() {
    elements.galleryModal.classList.add('hidden');
    if (elements.galleryLink) elements.galleryLink.classList.remove('active');
    if (elements.createLink) elements.createLink.classList.add('active');
}

// ============================================
// About Modal
// ============================================

function openAbout() {
    elements.aboutModal.classList.remove('hidden');
}

function closeAbout() {
    elements.aboutModal.classList.add('hidden');
}

// ============================================
// Privacy Modal
// ============================================

function openPrivacy() {
    if (elements.privacyModal) {
        elements.privacyModal.classList.remove('hidden');
    }
}

function closePrivacy() {
    if (elements.privacyModal) {
        elements.privacyModal.classList.add('hidden');
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // SNAP button - main action
    if (elements.snapBtn) {
        elements.snapBtn.addEventListener('click', snapPhoto);
    }
    
    // Upload button - for testing with images
    if (elements.uploadBtn) {
        elements.uploadBtn.addEventListener('click', () => elements.uploadInput.click());
    }
    if (elements.uploadInput) {
        elements.uploadInput.addEventListener('change', handleImageUpload);
    }
    
    // Capture button (for saving the result)
    if (elements.captureBtn) {
        elements.captureBtn.addEventListener('click', async () => {
            try {
                elements.captureBtn.disabled = true;
                elements.captureBtn.textContent = 'Preparing...';
                await capturePhoto();
            } catch (e) {
                console.error('Capture error:', e);
                showToast('Failed to prepare image for saving', 'error');
            } finally {
                elements.captureBtn.disabled = false;
                elements.captureBtn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Save Result
                `;
            }
        });
    }
    
    // Modal buttons
    if (elements.downloadBtn) elements.downloadBtn.addEventListener('click', downloadPhoto);
    if (elements.shareBtn) elements.shareBtn.addEventListener('click', sharePhoto);
    if (elements.copyBtn) elements.copyBtn.addEventListener('click', copyPhoto);
    if (elements.closeModalBtn) elements.closeModalBtn.addEventListener('click', closeModal);
    
    // Close modal on backdrop click
    if (elements.captureModal) {
        elements.captureModal.addEventListener('click', (e) => {
            if (e.target === elements.captureModal) closeModal();
        });
    }
    
    // Gallery modal events
    if (elements.galleryModal) {
        elements.galleryModal.addEventListener('click', (e) => {
            if (e.target === elements.galleryModal) closeGallery();
        });
    }
    if (elements.closeGalleryBtn) {
        elements.closeGalleryBtn.addEventListener('click', closeGallery);
    }
    if (elements.clearAllBtn) {
        elements.clearAllBtn.addEventListener('click', clearAllHistory);
    }
    
    // About modal events
    if (elements.aboutModal) {
        elements.aboutModal.addEventListener('click', (e) => {
            if (e.target === elements.aboutModal) closeAbout();
        });
    }
    if (elements.aboutLink) {
        elements.aboutLink.addEventListener('click', (e) => {
            e.preventDefault();
            openAbout();
        });
    }
    if (elements.closeAboutBtn) {
        elements.closeAboutBtn.addEventListener('click', closeAbout);
    }
    
    // Privacy modal events
    if (elements.privacyModal) {
        elements.privacyModal.addEventListener('click', (e) => {
            if (e.target === elements.privacyModal) closePrivacy();
        });
    }
    if (elements.privacyLink) {
        elements.privacyLink.addEventListener('click', (e) => {
            e.preventDefault();
            openPrivacy();
        });
    }
    if (elements.closePrivacyBtn) {
        elements.closePrivacyBtn.addEventListener('click', closePrivacy);
    }

    // Navigation
    if (elements.galleryLink) {
        elements.galleryLink.addEventListener('click', (e) => {
            e.preventDefault();
            openGallery();
        });
    }
    if (elements.createLink) {
        elements.createLink.addEventListener('click', (e) => {
            e.preventDefault();
            closeGallery();
            closeAbout();
            closePrivacy();
        });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when consent banner is visible
        if (!state.hasConsent && !checkConsent()) return;
        
        if (e.code === 'Space' && !e.target.matches('input, textarea, button')) { 
            e.preventDefault(); 
            snapPhoto(); // SNAP on spacebar
        }
        if (e.code === 'Escape') {
            closeModal();
            closeGallery();
            closeAbout();
            closePrivacy();
        }
        if (e.code === 'KeyS' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (state.lastCaption) {
                capturePhoto().catch(err => {
                    console.error('Capture failed:', err);
                    showToast('Failed to prepare image', 'error');
                });
            }
        }
    });
}

// ============================================
// Start!
// ============================================

document.addEventListener('DOMContentLoaded', init);
