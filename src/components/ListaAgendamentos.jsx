import React, { useMemo } from 'react';
import PropTypes from 'prop-types';

const ListaAgendamentos = ({ appointments, loading }) => {
    
    // Lógica de Cálculo dos Totais (Suporta campos Supabase e Legados)
    const totals = useMemo(() => {
        if (!appointments || appointments.length === 0) {
            return { totalRendimento: 0, totalCusto: 0, totalLucro: 0 };
        }

        return appointments.reduce((acc, appt) => {
            const precoRaw = appt.valor || appt.price || 0;
            const percentRaw = appt.percent_produto || appt.productPercent || 0;

            const preco = typeof precoRaw === 'string' ? parseFloat(precoRaw.replace(',', '.')) : precoRaw;
            const percent = typeof percentRaw === 'string' ? parseFloat(percentRaw.replace(',', '.')) : percentRaw;

            const custoProduto = preco * (percent / 100);
            
            acc.totalRendimento += preco;
            acc.totalCusto += custoProduto;
            acc.totalLucro += (preco - custoProduto);
            
            return acc;
        }, { totalRendimento: 0, totalCusto: 0, totalLucro: 0 });
    }, [appointments]);

    if (loading) return <div style={styles.status}>Carregando atendimentos...</div>;

    if (!appointments || appointments.length === 0) {
        return <div style={styles.status}>Nenhum agendamento para este dia.</div>;
    }

    return (
        <div className="lista-agendamentos-container" style={{ marginTop: '20px' }}>
            
            {/* Resumo Financeiro Compacto */}
            <div style={styles.resumoGrid}>
                <div style={styles.cardResumo}>
                    <span style={styles.label}>BRUTO</span>
                    <strong style={{ color: '#1e293b' }}>€ {totals.totalRendimento.toFixed(2)}</strong>
                </div>
                <div style={styles.cardResumo}>
                    <span style={styles.label}>CUSTO</span>
                    <strong style={{ color: '#ef4444' }}>€ {totals.totalCusto.toFixed(2)}</strong>
                </div>
                <div style={{ ...styles.cardResumo, borderRight: 'none' }}>
                    <span style={styles.label}>LUCRO</span>
                    <strong style={{ color: '#22c55e' }}>€ {totals.totalLucro.toFixed(2)}</strong>
                </div>
            </div>

            {/* Lista de Atendimentos */}
            <div style={styles.lista}>
                {appointments.map((appt, index) => {
                    const valor = parseFloat(String(appt.valor || appt.price || 0).replace(',', '.'));
                    return (
                        <div key={appt.id || index} style={styles.item}>
                            <div style={styles.infoPrincipal}>
                                <span style={styles.hora}>{appt.hora || appt.time}</span>
                                <div style={styles.clienteContainer}>
                                    <strong style={styles.nome}>{appt.cliente || appt.clientName}</strong>
                                    <span style={styles.procedimento}>{appt.procedimento || appt.procedure}</span>
                                </div>
                            </div>
                            <div style={styles.valorContainer}>
                                <span style={styles.preco}>€ {valor.toFixed(2)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const styles = {
    status: { textAlign: 'center', padding: '40px', color: '#64748b', fontSize: '14px' },
    resumoGrid: {
        display: 'flex',
        backgroundColor: '#f8fafc',
        borderRadius: '12px',
        padding: '15px',
        marginBottom: '20px',
        border: '1px solid #e2e8f0'
    },
    cardResumo: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderRight: '1px solid #e2e8f0',
        gap: '4px'
    },
    label: { fontSize: '10px', fontWeight: '800', color: '#94a3b8' },
    lista: { display: 'flex', flexDirection: 'column', gap: '10px' },
    item: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: '#fff',
        borderRadius: '10px',
        border: '1px solid #f1f5f9'
    },
    infoPrincipal: { display: 'flex', alignItems: 'center', gap: '15px' },
    hora: { fontSize: '13px', fontWeight: 'bold', color: '#4f46e5', backgroundColor: '#eef2ff', padding: '4px 8px', borderRadius: '6px' },
    clienteContainer: { display: 'flex', flexDirection: 'column' },
    nome: { fontSize: '15px', color: '#1e293b' },
    procedimento: { fontSize: '12px', color: '#64748b' },
    preco: { fontSize: '15px', fontWeight: '800', color: '#1e293b' }
};

ListaAgendamentos.propTypes = {
    appointments: PropTypes.array,
    loading: PropTypes.bool.isRequired,
};

export default ListaAgendamentos;