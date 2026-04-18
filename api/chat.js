/* eslint-env node */
/* global process */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  
    // eslint-disable-next-line no-undef
    const apiKey = process.env.GEMINI_API_KEY;
  
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
  
    const data = await response.json();
    return res.status(200).json(data);
  }