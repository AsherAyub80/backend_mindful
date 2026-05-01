// src/config/groq.js
// Groq is FREE: 14,400 requests/day, 500k tokens/day
// Models: llama-3.3-70b-versatile (smart), llama-3.1-8b-instant (fast)
const Groq = require('groq-sdk');
const config = require('./index');

const groq = new Groq({ apiKey: config.groq.apiKey });

/**
 * Chat completion with Groq (Llama 3.3 70B)
 * Drop-in replacement for OpenAI's chat.completions.create
 */
async function chat(messages, opts = {}) {
  const completion = await groq.chat.completions.create({
    model: opts.model || config.groq.model,
    messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens || 1024,
    response_format: opts.jsonMode ? { type: 'json_object' } : undefined,
  });
  return completion.choices[0].message.content;
}

/**
 * Fast chat — uses smaller/faster model for simple tasks
 */
async function chatFast(messages, opts = {}) {
  return chat(messages, { ...opts, model: config.groq.fastModel });
}

/**
 * JSON response — guarantees parseable JSON output
 */
async function chatJSON(messages, opts = {}) {
  const text = await chat(messages, { ...opts, jsonMode: true });
  try {
    return JSON.parse(text);
  } catch {
    // Fallback: extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Groq did not return valid JSON: ' + text.slice(0, 200));
  }
}

module.exports = { groq, chat, chatFast, chatJSON };
