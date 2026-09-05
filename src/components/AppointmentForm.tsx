import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { saveAppointment, getAppointmentById } from '../services/api.js';
import { supabase } from '../supabase.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sparkles, Bell } from 'lucide-react';
import { getErrorMessage } from '@/lib/utils';

interface Procedure {
  id: string | number;
  name: string;
  price: number;
}

interface FormData {
  id: string | number | null;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  procedure: string;
  price: number;
  pontoAtendimento: string;
  tempoLembrete: string;
  dataHoraLembretePersonalizado: string;
  loading: boolean;
}

interface AppointmentFormProps {
  initialDate?: string;
}

const AppointmentForm = ({ initialDate }: AppointmentFormProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Captura o objeto vindo de navigate('/novo-agendamento', { state: { agendamentoParaEditar } })
  const agendamentoParaEditar = location.state?.agendamentoParaEditar;
  const editId = searchParams.get('edit');

  const [procedures, setProcedures] = useState<Procedure[]>([]);

  const [formData, setFormData] = useState<FormData>({
    id: null,
    date: initialDate || '',
    time: '09:00',
    clientName: '',
    clientPhone: '',
    procedure: '',
    price: 0,
    pontoAtendimento: 'Studio Central',
    tempoLembrete: '1_dia',
    dataHoraLembretePersonalizado: '',
    loading: false,
  });

  // Carrega procedimentos
  useEffect(() => {
    const carregarProcedimentos = async () => {
      try {
        const { data, error } = await supabase
          .from('procedimentos')
          .select('id, name, price')
          .order('name', { ascending: true });

        if (error) throw error;
        setProcedures(data || []);
      } catch (error) {
        console.error('Erro ao carregar lista de procedimentos:', getErrorMessage(error));
      }
    };

    carregarProcedimentos();
  }, []);

  // Preenche formulário caso venha de `location.state` (Edição direta da Agenda)
  useEffect(() => {
    if (agendamentoParaEditar) {
      setFormData({
        id: agendamentoParaEditar.id || null,
        date: agendamentoParaEditar.data || '',
        time: agendamentoParaEditar.hora || '09:00',
        clientName: agendamentoParaEditar.cliente || agendamentoParaEditar.clientName || '',
        clientPhone: agendamentoParaEditar.telefone || '',
        procedure: agendamentoParaEditar.procedimento || agendamentoParaEditar.procedure || '',
        price: Number(agendamentoParaEditar.preco || agendamentoParaEditar.valor || 0),
        pontoAtendimento: agendamentoParaEditar.ponto_atendimento || agendamentoParaEditar.pontoAtendimento || 'Studio Central',
        tempoLembrete: agendamentoParaEditar.tempo_lembrete || '1_dia',
        dataHoraLembretePersonalizado: agendamentoParaEditar.data_hora_lembrete || '',
        loading: false,
      });
    } else if (editId) {
      // Caso a edição venha por Query Param (?edit=ID)
      const carregarDados = async () => {
        const dados = await getAppointmentById(editId);
        if (dados) {
          setFormData({
            id: dados.id,
            date: dados.data,
            time: dados.hora,
            clientName: dados.cliente,
            clientPhone: dados.telefone || '',
            procedure: dados.procedimento,
            price: dados.valor || dados.preco,
            pontoAtendimento: dados.ponto_atendimento || 'Studio Central',
            tempoLembrete: dados.tempo_lembrete || '1_dia',
            dataHoraLembretePersonalizado: dados.data_hora_lembrete || '',
            loading: false,
          });
        }
      };
      carregarDados();
    }
  }, [agendamentoParaEditar, editId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'price' ? parseFloat(value) || 0 : value,
    }));
  };

  const handleProcedureChange = (value: string) => {
    setFormData((prev) => {
      const novoEstado = { ...prev, procedure: value };
      const procedimentoSelecionado = procedures.find((p) => p.name === value);
      if (procedimentoSelecionado) {
        novoEstado.price = procedimentoSelecionado.price;
      }
      return novoEstado;
    });
  };

  const handleLocalChange = (value: string) => {
    setFormData((prev) => ({ ...prev, pontoAtendimento: value }));
  };

  const handleLembreteChange = (value: string) => {
    setFormData((prev) => ({ ...prev, tempoLembrete: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormData((prev) => ({ ...prev, loading: true }));

    // Calcula quando o lembrete deve ser enviado para teste ou agendamento
    let dataEnvioLembrete: string | null = null;

    if (formData.tempoLembrete === 'agora') {
      dataEnvioLembrete = new Date().toISOString(); // Envio imediato para teste
    } else if (formData.tempoLembrete === 'personalizado') {
      dataEnvioLembrete = formData.dataHoraLembretePersonalizado
        ? new Date(formData.dataHoraLembretePersonalizado).toISOString()
        : null;
    }

    const dataToSave = {
      id: formData.id,
      data: formData.date,
      hora: formData.time,
      cliente: formData.clientName,
      telefone: formData.clientPhone,
      procedimento: formData.procedure,
      preco: formData.price,
      pontoAtendimento: formData.pontoAtendimento,
      tempoLembrete: formData.tempoLembrete,
      dataEnvioLembrete,
    };

    try {
      await saveAppointment(dataToSave);
      navigate('/agenda');
    } catch (error) {
      alert(`Erro ao salvar: ${getErrorMessage(error)}`);
      setFormData((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-border bg-card p-8 shadow-lg shadow-black/20">
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-hover">
          <Sparkles size={16} className="text-primary-foreground" />
        </div>
        <h2 className="font-display text-2xl font-semibold text-foreground">
          {formData.id ? 'Editar Agendamento' : 'Novo Agendamento'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="time">Hora</Label>
            <Input
              id="time"
              type="time"
              name="time"
              value={formData.time}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientName">Cliente</Label>
            <Input
              id="clientName"
              type="text"
              name="clientName"
              placeholder="Nome da cliente"
              value={formData.clientName}
              onChange={handleInputChange}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clientPhone">WhatsApp / Telefone</Label>
            <Input
              id="clientPhone"
              type="tel"
              name="clientPhone"
              placeholder="+351 912345678"
              value={formData.clientPhone}
              onChange={handleInputChange}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="procedure">Procedimento</Label>
          <Select value={formData.procedure} onValueChange={handleProcedureChange} required>
            <SelectTrigger id="procedure">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {procedures.map((proc) => (
                <SelectItem key={proc.id} value={proc.name}>
                  {proc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="price">Preço (€)</Label>
          <Input
            id="price"
            type="number"
            name="price"
            step="0.01"
            value={formData.price}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="local">Local</Label>
          <Select value={formData.pontoAtendimento} onValueChange={handleLocalChange}>
            <SelectTrigger id="local">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Studio Central">Studio Central</SelectItem>
              <SelectItem value="Home Care">Home Care</SelectItem>
              <SelectItem value="Parceria">Parceria</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Seção de Lembrete Automatizado */}
        <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-primary" />
            <Label htmlFor="tempoLembrete" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
              Enviar Lembrete do WhatsApp
            </Label>
          </div>

          <Select value={formData.tempoLembrete} onValueChange={handleLembreteChange}>
            <SelectTrigger id="tempoLembrete" className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agora">🚀 Enviar Agora (Ideal para Teste)</SelectItem>
              <SelectItem value="1_hora">1 hora antes do atendimento</SelectItem>
              <SelectItem value="1_dia">1 dia antes do atendimento</SelectItem>
              <SelectItem value="personalizado">📅 Escolher Data/Hora Específica</SelectItem>
              <SelectItem value="desativado">Não enviar lembrete</SelectItem>
            </SelectContent>
          </Select>

          {/* Campo condicional para escolher a data/hora exata do teste */}
          {formData.tempoLembrete === 'personalizado' && (
            <div className="flex flex-col gap-1.5 mt-1">
              <Label htmlFor="dataHoraLembretePersonalizado" className="text-xs text-muted-foreground">
                Data e Horário exatos do disparo:
              </Label>
              <Input
                id="dataHoraLembretePersonalizado"
                type="datetime-local"
                name="dataHoraLembretePersonalizado"
                value={formData.dataHoraLembretePersonalizado}
                onChange={handleInputChange}
                className="bg-background"
              />
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-3">
          <Button
            type="submit"
            disabled={formData.loading}
            className="flex-1 bg-gradient-to-br from-primary to-primary-hover font-semibold text-primary-foreground hover:opacity-90"
          >
            {formData.loading ? 'Salvar...' : formData.id ? 'Atualizar Agendamento' : 'Confirmar'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(-1)}
            className="flex-1"
          >
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AppointmentForm;