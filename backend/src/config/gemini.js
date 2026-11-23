
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    retryOptions: {
      attempts: 3,
      initialDelay: 2,
      maxDelay: 8,
      expBase: 2,
      jitter: 1,
      httpStatusCodes: [408, 500, 502, 503, 504],
    },
  },
});

module.exports = ai;
