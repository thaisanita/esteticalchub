/* eslint-env node */
/* global process */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  
    const { mensagem, contexto } = req.body || {};
    if (!mensagem) return res.status(400).json({ error: 'Mensagem em falta' });
  
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Chave GEMINI_API_KEY não configurada' });
  
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: contexto }]
              },
              {
                role: 'model',
                parts: [{ text: 'Entendido! Estou pronta para ajudar.' }]
              },
              {
                role: 'user',
                parts: [{ text: mensagem }]
              }
            ],
            generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
          })
        }
      );
  
      const data = await response.json();
  
      if (!response.ok) {
        return res.status(500).json({ error: data?.error?.message || 'Erro na API Gemini' });
      }
  
      const resposta = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!resposta) return res.status(500).json({ error: 'Gemini não retornou texto' });
  
      return res.status(200).json({ resposta });
  
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }