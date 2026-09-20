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

const secoes: SecaoLegal[] = [
  {
    titulo: 'Quem somos e a quem se destina',
    conteudo: (
      <>
        <p>
          O <strong>{EMPRESA.nomeComercial}</strong> é um software online (SaaS) de gestão para profissionais
          independentes e clínicas de estética: agenda, clientes, custos, comissões, prontuário, lembretes
          automáticos e página pública de contacto.
        </p>
        {identificacaoPrestador() && <p>Prestador do serviço: {identificacaoPrestador()}.</p>}
        <p>
          Contacto: <a className="text-primary underline" href={`mailto:${EMPRESA.email}`}>{EMPRESA.email}</a>.
        </p>
        <p>
          O serviço destina-se a <strong>uso profissional</strong> (profissionais e empresas), e não a consumidores
          finais. Ao criar uma conta, declara ter mais de 18 anos e poderes para vincular a atividade que gere.
        </p>
      </>
    ),
  },
  {
    titulo: 'Conta e acesso',
    conteudo: (
      <>
        <p>
          O utilizador é responsável pela veracidade dos dados de registo, por manter as credenciais em segredo e
          por toda a atividade realizada na sua conta. Deve avisar-nos de imediato em caso de uso não autorizado.
        </p>
        <p>Cada conta destina-se a uma profissional ou clínica. É proibido partilhar ou revender o acesso.</p>
      </>
    ),
  },
  {
    titulo: 'Serviço e disponibilidade',
    conteudo: (
      <>
        <p>
          Trabalhamos para manter o serviço disponível, mas <strong>não garantimos funcionamento ininterrupto</strong>{' '}
          nem ausência de erros. Podem existir manutenções, falhas de fornecedores externos ou funcionalidades em
          fase de testes (beta), que podem mudar ou ser retiradas.
        </p>
        <p>
          Recomendamos que o utilizador exporte regularmente os seus dados (Configurações → Exportar os meus dados).
        </p>
      </>
    ),
  },
  {
    titulo: 'Preços e pagamento',
    conteudo: (
      <p>
        Atualmente o acesso é <strong>gratuito</strong>. Se passarmos a cobrar por alguma funcionalidade ou plano,
        informaremos os preços (com IVA, quando aplicável) e as condições com antecedência mínima de 30 dias, e o
        utilizador poderá cancelar a conta antes de qualquer cobrança.
      </p>
    ),
  },
  {
    titulo: 'Responsabilidades do utilizador',
    conteudo: (
      <>
        <p>O utilizador é o responsável pelos dados das suas clientes que introduz na plataforma e compromete-se a:</p>
        <Lista
          itens={[
            'ter fundamento legal para tratar esses dados e informar as clientes, nos termos do RGPD;',
            'obter o consentimento explícito das clientes para o registo de dados de saúde (anamnese/prontuário);',
            'enviar mensagens apenas a clientes com quem tem relação e respeitar pedidos para não receber mais comunicações (Lei n.º 41/2004);',
            'não usar a plataforma para spam, conteúdos ilegais, fraude ou para sobrecarregar a infraestrutura;',
            'cumprir as suas obrigações fiscais, profissionais e de licenciamento — a plataforma é apenas uma ferramenta de apoio.',
          ]}
        />
      </>
    ),
  },
  {
    titulo: 'Lembretes por email e WhatsApp',
    conteudo: (
      <>
        <p>
          Os lembretes por <strong>email</strong> são enviados através de um fornecedor de envio de emails e incluem
          uma ligação para a cliente deixar de os receber.
        </p>
        <p>
          O envio por <strong>WhatsApp</strong> funciona ligando o próprio número do utilizador através do
          WhatsApp Web. Esta ligação <strong>não é a API oficial da Meta</strong>: a Meta pode restringir ou bloquear
          números que usem automação. O utilizador usa esta funcionalidade por sua conta e risco, deve enviar
          apenas mensagens personalizadas de lembrete às suas clientes e não garantimos a entrega nem a continuidade
          do número.
        </p>
      </>
    ),
  },
  {
    titulo: 'Proteção de dados',
    conteudo: (
      <p>
        Em relação aos dados das clientes do utilizador, o utilizador é o <strong>responsável pelo tratamento</strong>{' '}
        e o {EMPRESA.nomeComercial} atua como <strong>subcontratante</strong>, de acordo com o Acordo de Tratamento
        de Dados (Anexo I) e com a{' '}
        <Link to="/privacidade" className="text-primary underline">
          Política de Privacidade
        </Link>
        , que fazem parte destes Termos.
      </p>
    ),
  },
  {
    titulo: 'Limitação de responsabilidade e isenção fiscal',
    conteudo: (
      <>
        <p>
          A plataforma é uma ferramenta de apoio à gestão e apresenta valores estimados (lucro, comissões, ponto de
          equilíbrio). <strong>Não substitui um contabilista certificado</strong>; declarações e obrigações fiscais
          (IVA, IRS/IRC, Segurança Social, faturação certificada) são da exclusiva responsabilidade do utilizador.
        </p>
        <p>
          Na medida permitida pela lei, não respondemos por lucros cessantes, perda de clientes, decisões tomadas com
          base nos valores apresentados, ou falhas de serviços de terceiros. Nada nestes termos exclui
          responsabilidade que a lei não permita excluir.
        </p>
      </>
    ),
  },
  {
    titulo: 'Propriedade intelectual e uso proibido',
    conteudo: (
      <p>
        O código, o design, as marcas e as funcionalidades do {EMPRESA.nomeComercial} pertencem ao prestador. Os
        dados inseridos pelo utilizador continuam a ser do utilizador. É proibido copiar, modificar, sublicenciar,
        fazer engenharia reversa, ou usar robôs/scripts que sobrecarreguem ou ataquem o serviço.
      </p>
    ),
  },
  {
    titulo: 'Suspensão, cancelamento e exportação de dados',
    conteudo: (
      <>
        <p>
          O utilizador pode <strong>exportar os seus dados</strong> e <strong>eliminar a conta</strong> a qualquer
          momento em Configurações. Ao eliminar a conta, os dados associados são apagados, salvo o que tivermos de
          conservar por obrigação legal.
        </p>
        <p>
          Podemos suspender ou encerrar contas que violem estes termos ou a lei, com aviso prévio sempre que
          possível.
        </p>
      </>
    ),
  },
  {
    titulo: 'Alterações a estes termos',
    conteudo: (
      <p>
        Podemos atualizar estes termos. Alterações relevantes serão comunicadas por email ou na plataforma com pelo
        menos 15 dias de antecedência. Continuar a usar o serviço depois dessa data significa aceitar a nova versão.
      </p>
    ),
  },
  {
    titulo: 'Lei aplicável e litígios',
    conteudo: (
      <p>
        Aplica-se a lei portuguesa. Para litígios, são competentes{' '}
        {EMPRESA.foro ? `os tribunais da comarca de ${EMPRESA.foro}` : 'os tribunais portugueses competentes'}, sem
        prejuízo de direitos que a lei imperativa reconheça ao utilizador.
      </p>
    ),
  },
];

const anexo = (
  <section className="mb-4 rounded-2xl border border-primary/30 bg-card p-6">
    <h2 className="font-display mb-2.5 text-base font-bold text-foreground">
      Anexo I — Acordo de Tratamento de Dados (art. 28.º do RGPD)
    </h2>
    <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
      <p>
        Este anexo aplica-se ao tratamento de dados pessoais das clientes do utilizador (o{' '}
        <strong>responsável pelo tratamento</strong>) realizado pelo {EMPRESA.nomeComercial} (o{' '}
        <strong>subcontratante</strong>) ao prestar o serviço.
      </p>
      <p>
        <strong>Objeto e duração:</strong> prestação do serviço enquanto a conta estiver ativa.{' '}
        <strong>Natureza e finalidade:</strong> alojar, organizar, mostrar e enviar lembretes sobre agendamentos,
        contactos, histórico de atendimentos e prontuários, exclusivamente para o utilizador gerir a sua atividade.
      </p>
      <p>
        <strong>Tipos de dados:</strong> nome, telefone, email, histórico e valores de atendimentos, notas, fotografia
        e ficha de anamnese (dados de saúde, categoria especial). <strong>Titulares:</strong> clientes e potenciais
        clientes (leads) do utilizador.
      </p>
      <p>O subcontratante obriga-se a:</p>
      <Lista
        itens={[
          'tratar os dados apenas mediante instruções documentadas do responsável (estes termos e o uso normal da plataforma);',
          'garantir que as pessoas autorizadas a tratar os dados estão sujeitas a confidencialidade;',
          'aplicar medidas técnicas e organizativas adequadas (art. 32.º): isolamento dos dados por conta, controlo de acessos, encriptação em trânsito e armazenamento privado de ficheiros;',
          'recorrer a outros subcontratantes (lista na Política de Privacidade) com garantias equivalentes, informando o responsável de alterações relevantes;',
          'auxiliar o responsável a responder a pedidos de titulares (acesso, retificação, apagamento, portabilidade);',
          'notificar o responsável, sem demora injustificada, após tomar conhecimento de uma violação de dados pessoais;',
          'apagar ou devolver os dados no fim do serviço (exportação e eliminação de conta em Configurações);',
          'disponibilizar as informações necessárias para demonstrar o cumprimento e permitir auditorias razoáveis.',
        ]}
      />
      <p>
        O responsável mantém-se obrigado a cumprir o RGPD quanto às suas clientes (informação, fundamento legal,
        consentimento para dados de saúde e comunicações).
      </p>
    </div>
  </section>
);

export default function Termos() {
  return <PaginaLegal titulo="Termos de Uso e Serviço" secoes={secoes} extra={anexo} />;
}
