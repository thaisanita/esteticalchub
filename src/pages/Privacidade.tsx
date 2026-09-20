import { Link } from 'react-router-dom';
import PaginaLegal, { type SecaoLegal } from '@/components/PaginaLegal';
import { EMPRESA, identificacaoPrestador } from '@/lib/empresa';

const Lista = ({ itens }: { itens: string[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {itens.map((i) => (
      <li key={i}>{i}</li>
    ))}
  </ul>
);

const SUBCONTRATANTES = [
  { nome: 'Supabase', funcao: 'Base de dados, autenticação, armazenamento de ficheiros e funções', local: 'União Europeia (Frankfurt)' },
  { nome: 'Vercel', funcao: 'Alojamento da aplicação web', local: 'Global / Estados Unidos' },
  { nome: 'Railway', funcao: 'Serviço de ligação ao WhatsApp (lembretes)', local: 'Estados Unidos' },
  { nome: 'Resend', funcao: 'Envio de emails de lembrete', local: 'Estados Unidos' },
  { nome: 'Google', funcao: 'Início de sessão com Google (opcional)', local: 'Global' },
  { nome: 'WhatsApp / Meta', funcao: 'Entrega das mensagens de WhatsApp enviadas pelo utilizador', local: 'Global' },
];

const secoes: SecaoLegal[] = [
  {
    titulo: 'Quem é o responsável',
    conteudo: (
      <>
        <p>
          O {EMPRESA.nomeComercial} desempenha dois papéis, consoante os dados:
        </p>
        <Lista
          itens={[
            'Dados da conta do utilizador (email, nome, definições): somos o responsável pelo tratamento.',
            'Dados das clientes do utilizador (contactos, agendamentos, prontuário): o utilizador é o responsável pelo tratamento e nós somos o subcontratante (ver Anexo I dos Termos de Uso).',
          ]}
        />
        {identificacaoPrestador() && <p>Prestador: {identificacaoPrestador()}.</p>}
        <p>
          Contacto para questões de privacidade:{' '}
          <a className="text-primary underline" href={`mailto:${EMPRESA.email}`}>
            {EMPRESA.email}
          </a>
          .
        </p>
      </>
    ),
  },
  {
    titulo: 'Que dados tratamos e porquê',
    conteudo: (
      <>
        <Lista
          itens={[
            'Conta: email, nome e foto (se entrar com Google), idioma. Fundamento: execução do contrato (art. 6.º, n.º 1, al. b) RGPD).',
            'Dados de negócio inseridos pelo utilizador: clientes, agendamentos, custos, pagamentos, produtos, tarefas. Tratados em nome do utilizador, para o fim de gerir a sua atividade.',
            'Prontuário/anamnese: podem conter dados de saúde (categoria especial, art. 9.º). São tratados apenas em nome do utilizador, que é responsável por obter o consentimento explícito da cliente. Os ficheiros ficam em armazenamento privado.',
            'Leads da página pública: nome, telefone e interesse que a visitante preenche; ficam no quadro "Leads" do utilizador. A visitante confirma que aceita ser contactada.',
            'Dados técnicos e de segurança: registos de acesso e endereço IP, para segurança e prevenção de abuso (interesse legítimo).',
            'Faturação, se vier a existir: obrigação legal de conservação (10 anos).',
          ]}
        />
        <p>Não vendemos dados nem os usamos para publicidade de terceiros.</p>
      </>
    ),
  },
  {
    titulo: 'Com quem partilhamos (subcontratantes)',
    conteudo: (
      <>
        <p>Recorremos aos seguintes prestadores para fornecer o serviço:</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-foreground">
                <th className="py-1.5 pr-3 font-semibold">Fornecedor</th>
                <th className="py-1.5 pr-3 font-semibold">Para quê</th>
                <th className="py-1.5 font-semibold">Localização</th>
              </tr>
            </thead>
            <tbody>
              {SUBCONTRATANTES.map((s) => (
                <tr key={s.nome} className="border-b border-border/50">
                  <td className="py-1.5 pr-3 font-medium text-foreground">{s.nome}</td>
                  <td className="py-1.5 pr-3">{s.funcao}</td>
                  <td className="py-1.5">{s.local}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Quando o utilizador ativa o Pixel da Meta na sua página pública, a Meta passa a receber dados de
          navegação dos visitantes dessa página, com o consentimento deles e sob responsabilidade do utilizador.
        </p>
      </>
    ),
  },
  {
    titulo: 'Transferências para fora da União Europeia',
    conteudo: (
      <p>
        Alguns fornecedores estão nos Estados Unidos. Nesses casos, as transferências assentam em garantias
        adequadas previstas no capítulo V do RGPD, como as cláusulas contratuais-tipo da Comissão Europeia ou a
        certificação do fornecedor no Quadro de Privacidade UE-EUA.
      </p>
    ),
  },
  {
    titulo: 'Durante quanto tempo guardamos os dados',
    conteudo: (
      <p>
        Enquanto a conta estiver ativa. Quando pedir a eliminação da conta (por email), apagamos os dados da
        conta e do negócio, incluindo ficheiros e a sessão de WhatsApp, exceto o que a lei nos obrigue a conservar.
        Cópias de segurança do fornecedor de base de dados são substituídas no seu ciclo normal.
      </p>
    ),
  },
  {
    titulo: 'Os seus direitos',
    conteudo: (
      <>
        <p>
          Tem direito de acesso, retificação, apagamento, limitação, portabilidade e oposição, e pode retirar a
          qualquer momento um consentimento dado. Em Configurações pode <strong>exportar os seus dados</strong>. Para eliminar a conta ou fazer outros
          pedidos, escreva para {EMPRESA.email}.
        </p>
        <p>
          Se as clientes do utilizador quiserem exercer direitos sobre os seus dados, devem dirigir-se ao
          profissional (responsável); nós ajudaremos o profissional a responder.
        </p>
        <p>
          Pode apresentar reclamação à autoridade de controlo: Comissão Nacional de Proteção de Dados (CNPD),{' '}
          <a className="text-primary underline" href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer">
            www.cnpd.pt
          </a>
          .
        </p>
      </>
    ),
  },
  {
    titulo: 'Comunicações e opção de recusar',
    conteudo: (
      <p>
        Os emails de lembrete incluem uma ligação para a cliente deixar de os receber, e as mensagens de WhatsApp
        incluem essa ligação também. Não enviamos comunicações de marketing sem consentimento prévio.
      </p>
    ),
  },
  {
    titulo: 'Cookies e armazenamento local',
    conteudo: (
      <>
        <p>
          O {EMPRESA.nomeComercial} usa apenas armazenamento <strong>estritamente necessário</strong> no seu
          dispositivo: manter a sessão iniciada, guardar preferências (idioma, menu, avisos já fechados) e permitir a
          instalação como aplicação. Não usamos cookies de publicidade nem de análise.
        </p>
        <p>
          Se um utilizador ativar o Pixel da Meta na sua página pública, essa página só o carrega depois de o visitante
          aceitar, e pode recusar sem perder acesso ao conteúdo.
        </p>
      </>
    ),
  },
  {
    titulo: 'Segurança e violações de dados',
    conteudo: (
      <p>
        Cada conta só acede aos seus próprios dados (regras de acesso ao nível da base de dados), a ligação é
        encriptada (HTTPS) e os ficheiros de prontuário ficam em armazenamento privado. Nenhum sistema é
        infalível: em caso de violação de dados pessoais, notificamos os utilizadores afetados sem demora
        injustificada, para que possam cumprir o prazo legal de 72 horas de notificação à CNPD, quando aplicável.
      </p>
    ),
  },
  {
    titulo: 'Menores e alterações',
    conteudo: (
      <p>
        O serviço destina-se a profissionais maiores de 18 anos. Podemos atualizar esta política; a versão em vigor
        está sempre nesta página e alterações relevantes são comunicadas. Ver também os{' '}
        <Link to="/termos-de-uso" className="text-primary underline">
          Termos de Uso
        </Link>
        .
      </p>
    ),
  },
];

export default function Privacidade() {
  return <PaginaLegal titulo="Política de Privacidade" secoes={secoes} />;
}
