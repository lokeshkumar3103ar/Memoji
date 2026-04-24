const fs = require('fs');

const config = {
    ENABLE_VLM: true,
    ENABLE_MEME_SEARCH: true
};

const content = `window.APP_CONFIG = ${JSON.stringify(config)};`;
fs.writeFileSync('config.js', content);
console.log('✅ config.js generated (public-only client config)');
