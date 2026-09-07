import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [mensagem, setMensagem] = useState('Conectando sua agenda...');
  const processadoRef = useRef(false);

  useEffect(() => {
    // Evita execução dupla em ambiente de desenvolvimento (React Strict Mode)
    if (processadoRef.current) return;
    processadoRef.current = true;

    async function processarCallback() {
      // O cliente Supabase já processa o token da URL sozinho (detectSessionInUrl: true).
      // Não guardamos nenhum token manualmente — apenas confirmamos que a
      // sessão ficou estabelecida em memória antes de avançar.
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
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
