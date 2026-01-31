const fs = require('fs');

const config = {
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    AZURE_OPENAI_API_VERSION: '2025-01-01-preview',
    TENOR_API_KEY: process.env.TENOR_API_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ',
    ENABLE_VLM: true,
    ENABLE_MEME_SEARCH: true
};

const content = `window.APP_CONFIG = ${JSON.stringify(config)};`;
fs.writeFileSync('config.js', content);
console.log('✅ config.js generated via generate_config.js');
