/* eslint-env node */
/* global process */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  
    const { mensagem, contexto } = req.body;
  
    if (!mensagem) return res.status(400).json({ error: 'Mensagem em falta' });
  
    const apiKey = process.env.GEMINI_API_KEY;
  
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: contexto || 'És uma assistente virtual simpática que responde em português.' }]
            },
            contents: [
              { role: 'user', parts: [{ text: mensagem }] }
            ],
                      generationConfig: { maxOutputTokens: 500 }
                    })
                  }
                );
          
                const data = await response.json();
                return res.status(200).json(data);
              } catch {
                return res.status(500).json({ error: 'Erro ao processar a solicitação' });
              }
            }