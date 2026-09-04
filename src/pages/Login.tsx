import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import Footer from './Footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {

Sparkles,

ShieldCheck,

Eye,

EyeOff,

AlertCircle,

CheckCircle2,

Calendar,

FileText,

Wallet,

} from 'lucide-react';



interface LoginProps {

onLogin: (status: boolean) => void;

}



const Login = ({ onLogin }: LoginProps) => {

const [searchParams] = useSearchParams();

const navigate = useNavigate();


const [isRegistro, setIsRegistro] = useState(false);

const [isForgotPassword, setIsForgotPassword] = useState(false);

const [email, setEmail] = useState('');

const [senha, setSenha] = useState('');

const [erro, setErro] = useState('');

const [mensagem, setMensagem] = useState('');

const [carregando, setCarregando] = useState(false);

const [registrou, setRegistrou] = useState(false);

const [mostrarSenha, setMostrarSenha] = useState(false);



useEffect(() => {

const modo = searchParams.get('modo');

if (modo === 'registro') {

setIsRegistro(true);

} else {

setIsRegistro(false);

}



const checkUser = async () => {

const { data: { session } } = await supabase.auth.getSession();

// Só redireciona se tiver sessão e não estiver tentando se cadastrar explicitamente

if (session && modo !== 'registro') {

onLogin(true);

}

};

checkUser();



const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {

if (event === 'SIGNED_IN' && session) onLogin(true);

});



return () => subscription.unsubscribe();

}, [onLogin, searchParams]);



const handleAuth = async (e: React.FormEvent) => {

e.preventDefault();

setErro('');

setMensagem('');

setCarregando(true);

setRegistrou(false);



try {

if (isRegistro) {

const { error } = await supabase.auth.signUp({ email, password: senha });

if (error) throw error;



setMensagem(

`Conta criada com sucesso!\n\nEnviamos um email de confirmação para ${email}.\nSe não encontrar, verifique spam ou promoções.\n\nPode levar até 2 minutos.`

);

setRegistrou(true);

setEmail('');

setSenha('');

} else {

const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

if (error) throw new Error('E-mail ou senha incorretos.');

onLogin(true);

}

} catch (err: any) {

setErro(err.message);

} finally {

setCarregando(false);

}

};



const handleForgotPassword = async (e: React.FormEvent) => {

e.preventDefault();

setErro('');

setMensagem('');

setCarregando(true);



try {

const { error } = await supabase.auth.resetPasswordForEmail(email, {

redirectTo: 'https://esteticalchub.vercel.app/reset-password',

});

if (error) throw error;

setMensagem(`Email de redefinição enviado para ${email}.\nVerifique sua caixa de entrada e spam.`);

} catch (err: any) {

setErro('Erro ao enviar email: ' + err.message);

} finally {

setCarregando(false);

}

};



const loginGoogle = async () => {

const { error } = await supabase.auth.signInWithOAuth({

provider: 'google',

options: { redirectTo: window.location.origin },

});

if (error) setErro('Erro ao conectar com Google: ' + error.message);

};



const reenviarEmailConfirmacao = async () => {

setErro('');

setMensagem('');

setCarregando(true);

try {

const { error } = await (supabase.auth as any).resend({ type: 'signup', email });

if (error) throw error;

setMensagem('Email de confirmação reenviado! Verifique seu spam ou promoções.');

} catch (err: any) {

setErro('Erro ao reenviar o email: ' + err.message);

} finally {

setCarregando(false);

}

};



const resetState = () => {

setErro('');

setMensagem('');

setRegistrou(false);

setMostrarSenha(false);

};



const FEATURE_ITEMS = [

{ icon: Calendar, texto: 'Agenda Online 24h', from: '#7C3AED', to: '#EC4899' },

{ icon: FileText, texto: 'Fichas de Anamnese Digitais', from: '#0EA5E9', to: '#7C3AED' },

{ icon: Wallet, texto: 'Controle de Faturamento', from: '#F59E0B', to: '#EC4899' },

];



return (

<div className="relative min-h-screen overflow-hidden bg-background font-sans text-foreground">

<style>{`

@keyframes ech-drift {

0%, 100% { transform: translate(0, 0) scale(1); }

50% { transform: translate(24px, -18px) scale(1.06); }

}

@keyframes ech-drift-2 {

0%, 100% { transform: translate(0, 0) scale(1); }

50% { transform: translate(-20px, 20px) scale(1.08); }

}

@keyframes ech-rise {

from { opacity: 0; transform: translateY(14px); }

to { opacity: 1; transform: translateY(0); }

}

.ech-orb-a { animation: ech-drift 10s ease-in-out infinite; }

.ech-orb-b { animation: ech-drift-2 12s ease-in-out infinite; }

.ech-rise { animation: ech-rise 0.6s ease-out both; }

`}</style>



{/* Background glow orbs */}

<div

className="ech-orb-a pointer-events-none absolute left-[-140px] top-[60px] h-[380px] w-[380px] rounded-full opacity-30 blur-[110px]"

style={{ background: '#7C3AED' }}

/>

<div

className="ech-orb-b pointer-events-none absolute left-[420px] top-[280px] h-[300px] w-[300px] rounded-full opacity-20 blur-[100px]"

style={{ background: '#EC4899' }}

/>



{/* Navbar */}

<nav className="sticky top-0 z-[100] flex items-center justify-between border-b border-border bg-background/80 px-[8%] py-4 backdrop-blur-md">

<div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>

<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-hover">

<Sparkles size={16} className="text-primary-foreground" />

</div>

<span className="font-display text-xl font-bold text-foreground">

Esteti<span className="text-primary">Calc</span>Hub

</span>

</div>

<div className="flex items-center gap-1.5">

<ShieldCheck size={14} className="text-primary" />

<span className="text-[11px] font-bold uppercase tracking-wider text-primary">

Segurança Certificada

</span>

</div>

</nav>



{/* Main */}

<div className="relative flex min-h-[calc(100vh-140px)] flex-wrap items-center justify-center gap-16 px-[8%] py-16">

{/* Hero Left */}

<section className="ech-rise hidden max-w-[480px] flex-1 md:block" style={{ minWidth: 300 }}>

<span className="mb-3 block text-xs font-bold uppercase tracking-[0.2em] text-primary">

Plataforma Profissional

</span>

<h1 className="font-display mb-4 text-[40px] leading-[1.15] text-foreground">

Gestão inteligente para sua{' '}

<em className="bg-gradient-to-r from-[#A855F7] via-[#EC4899] to-[#F59E0B] bg-clip-text italic text-transparent">

Clínica de Estética.

</em>

</h1>

<p className="text-base leading-relaxed text-muted-foreground">

Organize agendamentos, clientes e finanças em um só lugar. Acesse de onde estiver com

total segurança.

</p>



<div className="mt-9 flex flex-col gap-2">

{FEATURE_ITEMS.map((item, i) => (

<div

key={i}

className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-2.5 text-[15px] font-medium text-foreground transition-colors hover:border-border hover:bg-card/60"

>

<div

className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-md transition-transform duration-300 group-hover:scale-110"

style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}

>

<item.icon size={15} className="text-white" />

</div>

{item.texto}

</div>

))}

</div>



<div className="relative mt-10 overflow-hidden rounded-2xl border border-primary/15 bg-primary/5 p-5">

<div

className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl"

style={{ background: 'linear-gradient(135deg, #7C3AED, #EC4899)' }}

/>

<div className="relative mb-1 text-[13px] font-bold text-primary">Gestão sem Complicação</div>

<div className="relative text-[13px] text-muted-foreground">

Tudo o que sua clínica precisa para crescer, centralizado em uma única tela.

</div>

</div>

</section>



{/* Card Right */}

<section className="ech-rise w-full max-w-[410px] rounded-3xl border border-border bg-card p-11 shadow-2xl shadow-[#7C3AED]/20" style={{ animationDelay: '0.1s' }}>

{isForgotPassword ? (

<>

<span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">

Recuperar Acesso

</span>

<h2 className="font-display text-2xl text-foreground">Esqueceu a senha?</h2>

<p className="mb-6 mt-2.5 text-sm leading-relaxed text-muted-foreground">

Digite seu e-mail e enviaremos um link para você criar uma nova senha.

</p>

<form onSubmit={handleForgotPassword} className="flex flex-col gap-3.5">

<Input

type="email"

placeholder="Seu e-mail cadastrado"

value={email}

onChange={(e) => {

setEmail(e.target.value);

setErro('');

}}

autoComplete="email"

required

/>



{erro && (

<div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">

<AlertCircle size={15} className="mt-0.5 shrink-0" />

{erro}

</div>

)}

{mensagem && (

<div className="flex items-start gap-2 whitespace-pre-line rounded-lg border border-success/30 bg-success/10 p-3 text-[13px] leading-relaxed text-success">

<CheckCircle2 size={15} className="mt-0.5 shrink-0" />

{mensagem}

</div>

)}



<Button

type="submit"

disabled={carregando}

className="mt-1 w-full bg-gradient-to-br from-primary to-primary-hover font-semibold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90"

>

{carregando ? 'Enviando...' : 'Enviar link de redefinição'}

</Button>

</form>

<span

onClick={() => {

setIsForgotPassword(false);

resetState();

}}

className="mt-5 block cursor-pointer text-center text-[13px] text-muted-foreground transition-colors hover:text-primary"

>

← Voltar para o login

</span>

</>

) : (

<>

<span className="mb-4 inline-block rounded-full bg-primary/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">

{isRegistro ? 'Novo Cadastro' : 'Área Restrita'}

</span>

<h2 className="font-display text-2xl text-foreground">

{isRegistro ? 'Criar Conta' : 'Bem-vindo de volta'}

</h2>



<form onSubmit={handleAuth} className="mt-6 flex flex-col gap-3.5">

<div className="flex flex-col gap-1.5">

<Label htmlFor="email">E-mail profissional</Label>

<Input

id="email"

type="email"

name="email"

placeholder="seu@email.com"

value={email}

onChange={(e) => {

setEmail(e.target.value);

setErro('');

}}

autoComplete="email"

required

/>

</div>



<div className="flex flex-col gap-1.5">

<Label htmlFor="password">Senha</Label>

<div className="relative">

<Input

id="password"

type={mostrarSenha ? 'text' : 'password'}

name="password"

placeholder="Sua senha"

value={senha}

onChange={(e) => {

setSenha(e.target.value);

setErro('');

}}

autoComplete={isRegistro ? 'new-password' : 'current-password'}

required

className="pr-11"

/>

<button

type="button"

onClick={() => setMostrarSenha(!mostrarSenha)}

tabIndex={-1}

title={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}

className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary cursor-pointer"

>

{mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}

</button>

</div>

</div>



{!isRegistro && (

<span

onClick={() => {

setIsForgotPassword(true);

resetState();

}}

className="-mt-1 cursor-pointer self-end text-[13px] font-medium text-primary transition-opacity hover:opacity-75"

>

Esqueci minha senha

</span>

)}



{erro && (

<div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">

<AlertCircle size={15} className="mt-0.5 shrink-0" />

{erro}

</div>

)}

{mensagem && (

<div className="flex items-start gap-2 whitespace-pre-line rounded-lg border border-success/30 bg-success/10 p-3 text-[13px] leading-relaxed text-success">

<CheckCircle2 size={15} className="mt-0.5 shrink-0" />

{mensagem}

</div>

)}



<Button

type="submit"

disabled={carregando}

className="mt-1 w-full bg-gradient-to-br from-primary to-primary-hover font-semibold text-primary-foreground shadow-lg shadow-primary/30 hover:opacity-90 cursor-pointer"

>

{carregando ? 'Processando...' : isRegistro ? 'Criar minha conta' : 'Entrar na plataforma'}

</Button>

</form>



{isRegistro && registrou && (

<Button

onClick={reenviarEmailConfirmacao}

disabled={carregando || !email}

variant="secondary"

className="mt-2.5 w-full cursor-pointer"

>

Reenviar email de confirmação

</Button>

)}



<div className="my-5 flex items-center gap-2.5 text-[13px] text-muted-foreground">

<hr className="flex-1 border-border" />

<span>ou continue com</span>

<hr className="flex-1 border-border" />

</div>



<Button

onClick={loginGoogle}

variant="outline"

className="w-full cursor-pointer"

>

<img

src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"

alt="Google"

className="mr-2.5 w-[18px]"

/>

Continuar com Google

</Button>



<p

onClick={() => {

setIsRegistro(!isRegistro);

resetState();

}}

className="mt-6 cursor-pointer text-center text-sm font-semibold text-primary transition-opacity hover:opacity-75"

>

{isRegistro ? 'Já tem uma conta? Entre' : 'Não tem conta? Registre-se gratuitamente'}

</p>

</>

)}

</section>

</div>



<Footer />

</div>

);

};



export default Login; 

