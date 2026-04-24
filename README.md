# 🎭 Meme Mood Matcher

**Your face → Instant meme reaction!**

An interactive AI-powered demo that detects your facial expressions in real-time and matches them to memes/emojis. Perfect for tech club booths, recruitment events, and showcasing computer vision capabilities!

## 🚀 Quick Start (Local Testing)

### Option 1: VS Code Live Server
1. Install "Live Server" extension in VS Code
2. Right-click `index.html` → "Open with Live Server"
3. Allow camera access when prompted

### Option 2: Python Server
```bash
cd "path/to/Memoji"
python -m http.server 8000
# Open http://localhost:8000
```

### Option 3: Node.js Server
```bash
npx serve .
# Open the URL shown
```

## 🌐 Deploy to Vercel (Recommended - FREE!)

### One-Click Deploy:
1. Go to [vercel.com](https://vercel.com) and sign up/login
2. Click "Add New Project"
3. Import from Git or upload folder
4. Done! Get your URL like `meme-mood-matcher.vercel.app`

### CLI Deploy:
```bash
npm i -g vercel
cd "path/to/Memoji"
vercel
# Follow prompts, get live URL in 30 seconds!
```

### Required Environment Variables (Vercel Project Settings)
Set these in Vercel: Project -> Settings -> Environment Variables.

- AZURE_OPENAI_ENDPOINT
- AZURE_OPENAI_API_KEY
- AZURE_OPENAI_DEPLOYMENT (optional, default gpt-4o)
- AZURE_OPENAI_API_VERSION (optional, default 2025-01-01-preview)
- TENOR_API_KEY (optional)

## 📱 Features

- ✅ **Real-time face detection** using face-api.js
- ✅ **7 emotions detected**: Happy, Sad, Angry, Surprised, Fearful, Disgusted, Neutral
- ✅ **Emoji overlay mode**: Giant emoji replaces your face
- ✅ **Meme match mode**: Finds matching GIFs from Tenor
- ✅ **Capture & Share**: Download or share photos directly
- ✅ **Mobile-friendly**: Works on phones too!
- ✅ **Secure API architecture**: Secrets stay server-side via Vercel API routes

## 🎮 How to Use

1. **Allow camera access** when prompted
2. **Make faces!** - smile, look surprised, act angry
3. **Watch the magic** - emoji/meme updates in real-time
4. **Toggle modes** - switch between emoji overlay and meme matching
5. **Capture** - take a photo to save/share

## 🔧 Customization

### Change Tenor API Key (Optional)
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create a new API key
3. Set TENOR_API_KEY in Vercel Environment Variables

### Add Custom Meme Searches
Edit `CONFIG.EMOTION_QUERIES` in `app.js`:
```javascript
EMOTION_QUERIES: {
    happy: 'your custom happy search',
    // ... etc
}
```

### Change Emojis
Edit `CONFIG.EMOTION_EMOJI` in `app.js`:
```javascript
EMOTION_EMOJI: {
    happy: '🥳', // Change default emojis
    // ... etc
}
```

## 🎪 Event Setup Tips

1. **Lighting**: Good front lighting = better face detection
2. **Camera height**: Eye level works best
3. **Background**: Solid colors help detection accuracy
4. **Signage**: "Make a face, get a meme!" attracts visitors
5. **QR Code**: Print QR to your deployed URL so students can try on phones

## 🛠 Tech Stack

- **Face Detection**: face-api.js (TinyFaceDetector + Expression Net)
- **Meme API**: Tenor GIF API (free tier)
- **Frontend**: Vanilla JS, HTML5 Canvas, CSS3
- **Hosting**: Vercel (recommended) / Any static host

## 📄 License

MIT - Use freely for your events!

---

**Made with 💻 for CSE Tech Club recruitment**
