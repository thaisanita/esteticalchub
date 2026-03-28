import { supabase } from '../supabase';

/**
 * Função para salvar ou atualizar um agendamento
 * Se o objeto tiver um 'id', ele atualiza. Se não, ele cria um novo.
 */
export const saveAppointment = async (appointmentData) => {
    try {
        // Mapeia os campos para o padrão do seu banco (snake_case)
        const payload = {
            data: appointmentData.data,
            hora: appointmentData.hora,
            cliente: appointmentData.cliente,
            procedimento: appointmentData.procedimento,
            valor: parseFloat(String(appointmentData.preco || appointmentData.valor || '0').replace(',', '.')),
            ponto_atendimento: appointmentData.pontoAtendimento || appointmentData.ponto_atendimento,
            custo_produtos: parseFloat(String(appointmentData.custo_produtos || '0').replace(',', '.'))
        };

        let result;

        if (appointmentData.id) {
            // EDITAR existente
            result = await supabase
                .from('agendamentos')
                .update(payload)
                .eq('id', appointmentData.id)
                .select();
        } else {
            // CRIAR novo
            result = await supabase
                .from('agendamentos')
                .insert([payload])
                .select();
        }

        if (result.error) throw result.error;
        return result.data[0];

    } catch (error) {
        console.error("Erro no Supabase (Salvar):", error.message);
        throw error;
    }
};

/**
 * Função para buscar agendamentos de uma data específica
 */
export const getAppointmentsByDate = async (date) => {
    try {
        const { data, error } = await supabase
            .from('agendamentos')
            .select('*')
            .eq('data', date)
            .order('hora', { ascending: true });

        if (error) throw error;
        return data || [];
        
    } catch (error) {
        console.error("Erro na busca do Supabase:", error.message);
        return []; 
    }
};

/**
 * Função para buscar um único agendamento pelo ID (útil para edição)
 */
export const getAppointmentById = async (id) => {
    const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) return null;
    return data;
};