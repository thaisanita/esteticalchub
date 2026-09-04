import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [mensagem, setMensagem] = useState('Conectando sua agenda...');
  const processadoRef = useRef(false);

  useEffect(() => {
    // Evita execução dupla em ambiente de desenvolvimento (React Strict Mode)
    if (processadoRef.current) return;
    processadoRef.current = true;

    async function processarCallback() {
      // 1. Pega os parâmetros tanto da query (?code=...) quanto do hash (#access_token=...)
      const urlParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const code = urlParams.get('code');

      if (accessToken) {
        // Salva o token de acesso e refresh token (se existir)
        localStorage.setItem('google_access_token', accessToken);
        if (refreshToken) {
          localStorage.setItem('google_refresh_token', refreshToken);
        }

        setMensagem('Agenda conectada com sucesso! Redirecionando...');
        setTimeout(() => navigate('/dashboard?status=agenda-conectada', { replace: true }), 1500);
      } else if (code) {
        // Armazena o código temporário para troca no backend/Supabase Edge Function
        localStorage.setItem('google_auth_code', code);
        setMensagem('Agenda conectada com sucesso! Redirecionando...');
        setTimeout(() => navigate('/dashboard?status=agenda-conectada', { replace: true }), 1500);
      } else {
        setMensagem('Falha ao conectar agenda. Tente novamente.');
        setTimeout(() => navigate('/configuracoes', { replace: true }), 2500);
      }
    }

    processarCallback();
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="p-6 bg-card border border-border rounded-xl shadow-md text-center max-w-sm w-full mx-4">
        <div className="mb-4 mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <h2 className="text-xl font-bold mb-2 text-foreground">{mensagem}</h2>
        <p className="text-xs text-muted-foreground">Aguarde um instante enquanto sincronizamos...</p>
      </div>
    </div>
  );
}