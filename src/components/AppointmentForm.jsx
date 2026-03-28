import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PropTypes from 'prop-types';
import { saveAppointment, getAppointmentById } from '../services/api.js';

// Lista de procedimentos (Pode vir do Banco futuramente)
const procedures = [
    { id: 1, name: 'Corte', price: 25.00 },
    { id: 2, name: 'Coloração', price: 60.00 },
    { id: 3, name: 'Manicure', price: 15.00 },
];

const AppointmentForm = ({ initialDate }) => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editId = searchParams.get('edit'); // Verifica se estamos editando
    
    const [formData, setFormData] = useState({
        id: null,
        date: initialDate || '',
        time: '09:00', 
        clientName: '',
        procedure: '',
        price: 0,
        pontoAtendimento: 'Studio Central', // Valor padrão
        loading: false,
    });

    // Efeito para carregar dados caso seja EDIÇÃO
    useEffect(() => {
        if (editId) {
            const carregarDados = async () => {
                const dados = await getAppointmentById(editId);
                if (dados) {
                    setFormData({
                        id: dados.id,
                        date: dados.data,
                        time: dados.hora,
                        clientName: dados.cliente,
                        procedure: dados.procedimento,
                        price: dados.valor || dados.preco,
                        pontoAtendimento: dados.ponto_atendimento || 'Studio Central',
                        loading: false
                    });
                }
            };
            carregarDados();
        }
    }, [editId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'price' ? parseFloat(value) || 0 : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormData(prev => ({ ...prev, loading: true }));

        // Ajuste para o padrão do seu serviço API (Supabase)
        const dataToSave = {
            id: formData.id,
            data: formData.date,
            hora: formData.time,
            cliente: formData.clientName,
            procedimento: formData.procedure,
            preco: formData.price,
            pontoAtendimento: formData.pontoAtendimento
        };

        try {
            await saveAppointment(dataToSave);
            alert("✨ Agendamento salvo com sucesso!");
            navigate('/agenda'); 
        } catch (error) {
            alert(`❌ Erro ao salvar: ${error.message}`);
            setFormData(prev => ({ ...prev, loading: false }));
        }
    };

    return (
        <div className="novo-agendamento-container">
            <h2 style={{ textAlign: 'center', color: '#4f46e5' }}>
                {formData.id ? '📝 Editar Agendamento' : '✨ Novo Agendamento'}
            </h2>
            
            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.inputGroup}>
                    <label>Data:</label>
                    <input type="date" name="date" value={formData.date} onChange={handleChange} required />
                </div>

                <div style={styles.inputGroup}>
                    <label>Hora:</label>
                    <input type="time" name="time" value={formData.time} onChange={handleChange} required />
                </div>

                <div style={styles.inputGroup}>
                    <label>Cliente:</label>
                    <input type="text" name="clientName" placeholder="Nome da cliente" value={formData.clientName} onChange={handleChange} required />
                </div>

                <div style={styles.inputGroup}>
                    <label>Procedimento:</label>
                    <select name="procedure" value={formData.procedure} onChange={handleChange} required>
                        <option value="">Selecione...</option>
                        {procedures.map(proc => (
                            <option key={proc.id} value={proc.name}>{proc.name}</option>
                        ))}
                    </select>
                </div>

                <div style={styles.inputGroup}>
                    <label>Preço (€):</label>
                    <input type="number" name="price" step="0.01" value={formData.price} onChange={handleChange} required />
                </div>

                <div style={styles.inputGroup}>
                    <label>Local:</label>
                    <select name="pontoAtendimento" value={formData.pontoAtendimento} onChange={handleChange}>
                        <option value="Studio Central">Studio Central</option>
                        <option value="Home Care">Home Care</option>
                        <option value="Parceria">Parceria</option>
                    </select>
                </div>

                <div className="form-actions" style={styles.actions}>
                    <button type="submit" disabled={formData.loading} style={styles.btnSalvar}>
                        {formData.loading ? 'Processando...' : 'Confirmar'}
                    </button>
                    <button type="button" onClick={() => navigate(-1)} style={styles.btnCancelar}>
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    );
};

const styles = {
    form: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px' },
    inputGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    actions: { display: 'flex', gap: '10px', marginTop: '10px' },
    btnSalvar: { flex: 1, padding: '12px', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' },
    btnCancelar: { flex: 1, padding: '12px', backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', cursor: 'pointer' }
};

AppointmentForm.propTypes = { initialDate: PropTypes.string };

export default AppointmentForm;