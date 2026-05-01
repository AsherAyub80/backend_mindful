
const config = require('./src/config');
console.log('GROQ_API_KEY from config:', config.groq.apiKey);
console.log('GROQ_API_KEY from process.env:', process.env.GROQ_API_KEY);
