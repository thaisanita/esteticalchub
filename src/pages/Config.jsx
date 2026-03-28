import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const textosPorIdioma = {
  'Português (PT)': {
    titulo: 'Configurações',
    perfilStatus: 'Conectado',
    idiomaLabel: 'Idioma',
    idiomaSub: 'Selecione sua região',
    compartilhar: 'Compartilhar Link',
    compartilharSub: 'Copiar URL do aplicativo',
    btnSalvar: '💾 Salvar Alterações',
    btnVoltar: 'Voltar para Agenda',
    alerta: 'Configurações salvas com sucesso! ✅'
  },
  'English (US)': {
    titulo: 'Settings',
    perfilStatus: 'Connected',
    idiomaLabel: 'Language',
    idiomaSub: 'Select your region',
    compartilhar: 'Share Link',
    compartilharSub: 'Copy app URL',
    btnSalvar: '💾 Save Changes',
    btnVoltar: 'Back to Schedule',
    alerta: 'Settings saved successfully! ✅'
  },
  'Español (ES)': {
    titulo: 'Configuraciones',
    perfilStatus: 'Conectado',
    idiomaLabel: 'Idioma',
    idiomaSub: 'Seleccione sua región',
    compartilhar: 'Compartir Enlace',
    compartilharSub: 'Copiar URL de la aplicación',
    btnSalvar: '💾 Guardar Cambios',
    btnVoltar: 'Volver a la Agenda',
    alerta: '¡Configuraciones guardadas con éxito! ✅'
  }
};

export default function Config() {
  const navigate = useNavigate();
  const [usuario, setUsuario] = useState(null);
  const [idioma, setIdioma] = useState(localStorage.getItem('config_idioma') || 'Português (PT)');

  useEffect(() => {
    const obterUsuario = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsuario({
          email: user.email,
          displayName: user.user_metadata?.full_name || 'Usuário',
          photoURL: user.user_metadata?.avatar_url
        });
      }
    };
    obterUsuario();
  }, []);

  const t = textosPorIdioma[idioma] || textosPorIdioma['Português (PT)'];

  const copiarLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    alert("Link do app copiado!");
  };

  const salvarConfiguracoes = () => {
    localStorage.setItem('config_idioma', idioma);
    alert(t.alerta);
    window.location.href = '/';
  };

  return (
    <div style={s.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .cfg-card { transition: box-shadow 0.2s, transform 0.2s; }
        .cfg-card:hover { box-shadow: 0 6px 24px rgba(79,70,229,0.1) !important; transform: translateY(-1px); }
        .cfg-share:hover { background: #eef2ff !important; }
        .cfg-btn-save:hover { opacity: 0.88; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,70,229,0.35) !important; }
        .cfg-btn-back:hover { border-color: #4f46e5 !important; color: #4f46e5 !important; }
        select { font-family: 'DM Sans', sans-serif; }
      `}</style>

      <div style={s.wrapper}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerIcon}>⚙️</div>
          <div>
            <h1 style={s.headerTitle}>{t.titulo}</h1>
            <p style={s.headerSub}>Personalize a sua experiência</p>
          </div>
        </div>

        {/* Perfil */}
        {usuario && (
          <div className="cfg-card" style={s.card}>
            <div style={s.cardLeft}>
              <img
                src={usuario.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(usuario.displayName) + '&background=4f46e5&color=fff&size=80'}
                alt="Perfil"
                style={s.avatar}
              />
              <div>
                <div style={s.userName}>{usuario.displayName}</div>
                <div style={s.userEmail}>{usuario.email}</div>
              </div>
            </div>
            <span style={s.statusBadge}>● {t.perfilStatus}</span>
          </div>
        )}

        {/* Idioma */}
        <div className="cfg-card" style={s.card}>
          <div style={s.cardLeft}>
            <div style={s.cardIcon}>🌐</div>
            <div>
              <div style={s.cardLabel}>{t.idiomaLabel}</div>
              <div style={s.cardSub}>{t.idiomaSub}</div>
            </div>
          </div>
          <select
            value={idioma}
            onChange={(e) => setIdioma(e.target.value)}
            style={s.select}
          >
            <option value="Português (PT)">Português (PT)</option>
            <option value="English (US)">English (US)</option>
            <option value="Español (ES)">Español (ES)</option>
          </select>
        </div>

        {/* Compartilhar */}
        <div
          className="cfg-card cfg-share"
          style={{ ...s.card, cursor: 'pointer', border: '1px solid #c7d2fe' }}
          onClick={copiarLink}
        >
          <div style={s.cardLeft}>
            <div style={{ ...s.cardIcon, background: '#eef2ff', color: '#4f46e5' }}>🔗</div>
            <div>
              <div style={{ ...s.cardLabel, color: '#4f46e5' }}>{t.compartilhar}</div>
              <div style={s.cardSub}>{t.compartilharSub}</div>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
        </div>

        {/* Ações */}
        <div style={s.actions}>
          <button className="cfg-btn-save" onClick={salvarConfiguracoes} style={s.btnSave}>
            {t.btnSalvar}
          </button>
          <button className="cfg-btn-back" onClick={() => navigate('/')} style={s.btnBack}>
            {t.btnVoltar}
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh', backgroundColor: '#f8f7ff',
    fontFamily: "'DM Sans', sans-serif",
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '40px 20px 60px'
  },
  wrapper: { width: '100%', maxWidth: '560px' },
  header: {
    display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '30px'
  },
  headerIcon: {
    width: '52px', height: '52px', background: '#ede9fe', borderRadius: '14px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px'
  },
  headerTitle: {
    fontFamily: "'Sora', sans-serif", fontSize: '24px', fontWeight: '800', color: '#1e1b4b'
  },
  headerSub: { fontSize: '13px', color: '#94a3b8', marginTop: '2px' },
  card: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#fff', borderRadius: '14px', padding: '18px 20px',
    marginBottom: '12px', border: '1px solid #ede9fe',
    boxShadow: '0 2px 8px rgba(79,70,229,0.04)'
  },
  cardLeft: { display: 'flex', alignItems: 'center', gap: '14px' },
  cardIcon: {
    width: '40px', height: '40px', background: '#f8f7ff', borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0
  },
  cardLabel: { fontSize: '14px', fontWeight: '700', color: '#1e1b4b' },
  cardSub: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },
  avatar: {
    width: '48px', height: '48px', borderRadius: '50%',
    border: '2px solid #ede9fe', objectFit: 'cover'
  },
  userName: { fontSize: '15px', fontWeight: '700', color: '#1e1b4b' },
  userEmail: { fontSize: '12px', color: '#94a3b8', marginTop: '2px' },
  statusBadge: {
    background: '#f0fdf4', color: '#166534', fontSize: '11px',
    fontWeight: '700', padding: '5px 12px', borderRadius: '20px', border: '1px solid #bbf7d0'
  },
  select: {
    padding: '9px 14px', borderRadius: '10px', border: '1px solid #e0e7ff',
    fontSize: '13px', fontWeight: '600', color: '#1e1b4b', cursor: 'pointer',
    background: '#f8f7ff', outline: 'none'
  },
  actions: { marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' },
  btnSave: {
    width: '100%', padding: '15px', background: 'linear-gradient(135deg,#4f46e5,#6366f1)',
    color: '#fff', border: 'none', borderRadius: '12px', cursor: 'pointer',
    fontWeight: '700', fontSize: '15px', fontFamily: "'DM Sans', sans-serif",
    transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(79,70,229,0.3)'
  },
  btnBack: {
    width: '100%', padding: '13px', background: 'transparent',
    color: '#64748b', border: '1.5px solid #e0e7ff', borderRadius: '12px',
    cursor: 'pointer', fontWeight: '600', fontSize: '14px',
    fontFamily: "'DM Sans', sans-serif", transition: 'all 0.2s'
  }
};