// Botão "Continuar com Google" via Google Identity Services (GIS), em vez do
// supabase.auth.signInWithOAuth com redirect — assim o ecrã de consentimento
// da Google mostra o nosso domínio/app (configurado na Google Cloud Console),
// em vez do domínio do Supabase.
//
// Precisa da variável VITE_GOOGLE_CLIENT_ID (ver .env.example).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { getErrorMessage } from '@/lib/utils';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdConfig {
  client_id: string;
  callback: (resposta: GoogleCredentialResponse) => void;
  nonce: string;
  use_fedcm_for_prompt?: boolean;
  ux_mode?: 'popup' | 'redirect';
}

interface GoogleButtonConfig {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  locale?: string;
  width?: number;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdConfig) => void;
          renderButton: (pai: HTMLElement, config: GoogleButtonConfig) => void;
        };
      };
    };
  }
}

function carregarScriptGoogle(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existente = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    if (existente) {
      existente.addEventListener('load', () => resolve(), { once: true });
      existente.addEventListener('error', () => reject(new Error('Falha ao carregar o script da Google.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar o script da Google.'));
    document.head.appendChild(script);
  });
}

function paraHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Nonce aleatório (enviado ao Supabase) + o seu hash SHA-256 (enviado à Google). */
async function gerarNonce(): Promise<{ rawNonce: string; hashedNonce: string }> {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const rawNonce = paraHex(bytes.buffer);
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
  return { rawNonce, hashedNonce: paraHex(hashBuffer) };
}

interface GoogleSignInButtonProps {
  /** Se não for passado, o próprio botão mostra uma mensagem de erro por baixo. */
  onError?: (mensagem: string) => void;
  /** Chamado depois de entrar com sucesso. Por omissão, navega para /dashboard. */
  onSuccess?: () => void;
}

export default function GoogleSignInButton({ onError, onSuccess }: GoogleSignInButtonProps) {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const [erroLocal, setErroLocal] = useState('');

  useEffect(() => {
    let cancelado = false;

    const reportarErro = (mensagem: string) => {
      if (cancelado) return;
      setErroLocal(mensagem);
      onError?.(mensagem);
    };

    async function configurar() {
      if (!GOOGLE_CLIENT_ID) {
        reportarErro('Login com Google ainda não está configurado (falta VITE_GOOGLE_CLIENT_ID).');
        return;
      }

      try {
        await carregarScriptGoogle();
        if (cancelado || !window.google) return;

        const { rawNonce, hashedNonce } = await gerarNonce();
        if (cancelado) return;

        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashedNonce,
          use_fedcm_for_prompt: true,
          ux_mode: 'popup',
          callback: async (resposta) => {
            if (!resposta.credential) {
              reportarErro('Não foi possível continuar com a Google. Tenta outra vez.');
              return;
            }
            try {
              const { error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: resposta.credential,
                nonce: rawNonce,
              });
              if (error) throw error;
              if (onSuccess) onSuccess();
              else navigate('/dashboard');
            } catch (err) {
              reportarErro('Não foi possível entrar com a Google: ' + getErrorMessage(err));
            }
          },
        });

        if (containerRef.current) {
          window.google.accounts.id.renderButton(containerRef.current, {
            type: 'standard',
            theme: 'filled_black',
            size: 'large',
            shape: 'rectangular',
            text: 'continue_with',
            logo_alignment: 'left',
            locale: 'pt_PT',
            width: containerRef.current.offsetWidth || undefined,
          });
        }
      } catch (err) {
        reportarErro(getErrorMessage(err) || 'Não foi possível carregar o login com a Google.');
      }
    }

    configurar();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={containerRef} className="flex w-full justify-center" />
      {!onError && erroLocal && <p className="mt-2 text-center text-[12px] text-danger">{erroLocal}</p>}
    </div>
  );
}
