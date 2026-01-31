// ============================================
// 🎭 Meme Mood Matcher - Tamil Edition (PHOTO MODE ONLY)
// Click SNAP → GPT analyzes → "expression Tamil" → Tenor GIF
// ============================================

// Get config from config.js
const getConfig = () => window.APP_CONFIG || {};

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
    faceDetectionInterval: null,
    analysisCount: 0,
    capturedImage: null
};

// DOM Elements
let elements = {};

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
        galleryLink: document.getElementById('nav-gallery'),
        createLink: document.getElementById('nav-create'),
        // About Elements
        aboutModal: document.getElementById('about-modal'),
        closeAboutBtn: document.getElementById('close-about-btn'),
        aboutLink: document.getElementById('nav-about')
    };

    const CONFIG = getConfig();
    
    try {
        if (!CONFIG.AZURE_OPENAI_ENDPOINT || CONFIG.AZURE_OPENAI_ENDPOINT === "YOUR_ENDPOINT_HERE") {
            console.warn('⚠️ Azure OpenAI not configured!');
            CONFIG.ENABLE_VLM = false;
        }

        updateLoadingStatus('Loading face detection...', 10);
        await loadModels();
        
        updateLoadingStatus('Starting camera...', 50);
        await startCamera();
        
        updateLoadingStatus('Ready! Click SNAP! 📸', 100);
        
        setTimeout(() => {
            elements.loadingScreen.classList.add('hidden');
            elements.app.classList.remove('hidden');
            startApp();
        }, 500);
        
        setupEventListeners();
        
    } catch (error) {
        console.error('Init error:', error);
        updateLoadingStatus(`Error: ${error.message}`, 0);
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
    const link = document.createElement('a');
    link.download = `meme-mood-${Date.now()}.png`;
    link.href = elements.captureCanvas.toDataURL('image/png');
    link.click();
}

async function sharePhoto() {
    try {
        const blob = await new Promise(r => elements.captureCanvas.toBlob(r, 'image/png'));
        const file = new File([blob], 'meme-mood.png', { type: 'image/png' });
        
        // Native Share API (Mobile: WhatsApp, Mail, etc. depending on installed apps)
        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'My Meme Mood Match!',
                text: state.lastCaption ? `"${state.lastCaption}" 🎭 Created with Memoji` : 'Check my meme match! 🎭 Created with Memoji'
            });
        } else {
            // Fallback for Desktop (Manual Options)
            // Create mailto link
            const subject = encodeURIComponent("Check out my Memoji Roast! 🎭");
            const body = encodeURIComponent(`I just got roasted by Memoji AI!\n\n"${state.lastCaption || ''}"\n\n(Attach the downloaded image to share)`);
            
            // Allow user to choose
            const choice = confirm("Native sharing not available on this device.\n\nType OK to Open Email Draft.\nCancel to Download Image (for WhatsApp Web/Drive).");
            
            if (choice) {
                 window.open(`mailto:?subject=${subject}&body=${body}`);
                 downloadPhoto(); // Auto download so they can attach it
            } else {
                 downloadPhoto();
            }
        }
    } catch (e) {
        console.error('Share error:', e);
        downloadPhoto();
    }
}

async function copyPhoto() {
    try {
        const blob = await new Promise(r => elements.captureCanvas.toBlob(r, 'image/png'));
        
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);
        
        // Visual feedback
        const btn = elements.copyBtn;
        const originalContent = btn.innerHTML;
        btn.innerHTML = 'Copied! ✅';
        btn.classList.add('btn-success');
        
        setTimeout(() => {
            btn.innerHTML = originalContent;
            btn.classList.remove('btn-success');
        }, 2000);
        
    } catch (err) {
        console.error('Failed to copy:', err);
        alert('Copy not supported on this browser. Try Download instead.');
    }
}

function closeModal() {
    elements.captureModal.classList.add('hidden');
}

// ============================================
// 🖼️ Gallery Logic (LocalStorage)
// ============================================

function saveToHistory(caption, memeUrl) {
    if (!caption || !memeUrl) return;

    let userImage = null;
    // Save the captured image data URL if available
    if (state.capturedImage && state.capturedImage.src) {
        userImage = state.capturedImage.src;
    }

    const historyItem = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        caption: caption,
        memeUrl: memeUrl,
        userImage: userImage
    };

    let history = JSON.parse(localStorage.getItem('memoji_history') || '[]');
    history.unshift(historyItem); // Add to top
    
    // Limit to last 10 items to prevent LocalStorage quota issues (photos are large)
    if (history.length > 10) history = history.slice(0, 10);
    
    try {
        localStorage.setItem('memoji_history', JSON.stringify(history));
        console.log('💾 Saved to history');
    } catch (e) {
        console.warn('⚠️ Storage full, clearing old history');
        history = history.slice(0, 5); // Fallback: clear half
        try {
            localStorage.setItem('memoji_history', JSON.stringify(history));
        } catch (retryError) {
            console.error('❌ Could not save to history even after clearing');
        }
    }
}

function loadGallery() {
    const history = JSON.parse(localStorage.getItem('memoji_history') || '[]');
    const grid = elements.galleryGrid;
    
    if (!grid) return;
    grid.innerHTML = '';

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
        div.onclick = () => showInMainView(item);
        
        // Build image HTML
        let imagesHtml = '';
        if (item.userImage) {
            imagesHtml += `<img src="${item.userImage}" class="gallery-thumb user-thumb" alt="You" loading="lazy">`;
        }
        imagesHtml += `<img src="${item.memeUrl}" class="gallery-thumb meme-thumb" alt="Meme" loading="lazy">`;
        
        div.innerHTML = `
            <div class="gallery-images-pair">
                ${imagesHtml}
            </div>
            <div class="gallery-caption">"${item.caption}"</div>
        `;
        grid.appendChild(div);
    });
}

function showInMainView(item) {
    // Load a history item back into the main view
    updateCaption(item.caption);
    elements.memeImage.src = item.memeUrl;
    elements.memeImage.classList.add('visible');
    elements.memePlaceholder.classList.add('hidden');
    
    // Restore the captured user image state so "Save Result" works with this photo
    if (item.userImage) {
        state.capturedImage = new Image();
        state.capturedImage.src = item.userImage;
    }

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
    elements.captureBtn.addEventListener('click', capturePhoto);
    
    // Modal buttons
    elements.downloadBtn.addEventListener('click', downloadPhoto);
    elements.shareBtn.addEventListener('click', sharePhoto);
    if (elements.copyBtn) elements.copyBtn.addEventListener('click', copyPhoto);
    elements.closeModalBtn.addEventListener('click', closeModal);
    
    // Close modal on backdrop click
    elements.captureModal.addEventListener('click', (e) => {
        if (e.target === elements.captureModal) closeModal();
    });
    // Close gallery on backdrop click
    if (elements.galleryModal) {
        elements.galleryModal.addEventListener('click', (e) => {
            if (e.target === elements.galleryModal) closeGallery();
        });
    }
    // Close about modal on backdrop click
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
        });
    }
    if (elements.closeGalleryBtn) {
        elements.closeGalleryBtn.addEventListener('click', closeGallery);
    }
    if (elements.closeAboutBtn) {
        elements.closeAboutBtn.addEventListener('click', closeAbout);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') { 
            e.preventDefault(); 
            snapPhoto(); // SNAP on spacebar
        }
        if (e.code === 'Escape') closeModal();
        if (e.code === 'KeyS' && state.lastCaption) {
            capturePhoto(); // Save with 'S' key
        }
    });
}

// ============================================
// Start!
// ============================================

document.addEventListener('DOMContentLoaded', init);
