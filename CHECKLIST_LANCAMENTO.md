# Checklist de lançamento (Portugal)

Estado em setembro de 2026. Isto é uma análise técnica e de boas práticas, **não é aconselhamento jurídico**:
confirma os pontos marcados com ⚖️ com um contabilista certificado (OCC) e/ou advogado antes de divulgar.

## 🔴 Bloqueadores — fazer ANTES de divulgar

### Negócio e fiscalidade (só tu consegues fazer)
- [ ] **Abrir atividade** como ENI ou Unipessoal Lda. (CAE principal sugerido: 62010 – programação informática; ⚖️ confirmar com contabilista). [gov.pt](https://www2.gov.pt/en/guias/trabalhar-por-conta-propria-guia-para-trabalhadores-independentes/abrir-atividade-e-prestacao-de-servicos)
- [ ] **Faturação**: emitir faturas por programa certificado pela AT ou pelo Portal das Finanças, com ATCUD; obrigatório software certificado acima de 50 000 € de volume de negócios. [Portal das Finanças](https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Cidadaos/Atividade_profissional/Fatura_e_recibo/Paginas/default.aspx)
- [ ] **IVA**: isenção do art. 53.º do CIVA até 15 000 € de volume de negócios (Decreto-Lei 35/2025). ⚖️ [Portal das Finanças](https://info.portaldasfinancas.gov.pt/pt/informacao_fiscal/codigos_tributarios/civa_rep/Pages/artigo-53-o-do-civa.aspx)
- [ ] **Preencher `src/lib/empresa.ts`** (nome do titular, NIF, morada, foro). A lei obriga a mostrar de forma permanente no site o nome, morada, email e NIF do prestador (Decreto-Lei 7/2004, art. 10.º). [texto da lei](https://www.pgdlisboa.pt/leis/lei_mostra_articulado.php?nid=1399&tabela=leis)
- [ ] **Livro de Reclamações Eletrónico** (livroreclamacoes.pt): obrigatório para quem vende serviços a consumidores; o teu cliente é profissional (B2B), por isso é provável que não seja obrigatório, mas é gratuito e dá confiança. ⚖️ Depois de registares, pôr o link em `EMPRESA.livroReclamacoesUrl`. [ASAE](https://www.asae.gov.pt/reclamacoes-e-denuncias/livro-de-reclamacoes.aspx)
- [ ] **Marca**: verificar no INPI se "EstetiCalcHub" está livre antes de investir em anúncios.

### Infraestrutura (planos pagos necessários)
- [ ] **Vercel: passar do plano Hobby para Pro.** O Hobby é só para uso pessoal/não comercial, e divulgar/anunciar um serviço conta como comercial. [Vercel Hobby](https://vercel.com/docs/plans/hobby)
- [ ] **Supabase: passar para Pro.** No plano Free o projeto é pausado após 7 dias sem atividade e **não há backups**. [Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing)
- [ ] **Railway**: o crédito do plano de teste acaba; ativar o plano pago. E **mudar a região para a Europa** (Settings → Scale) — hoje está em "US West", e as mensagens/telefones das clientes passam pelos EUA.
- [ ] **Domínio próprio + email profissional.** Sem domínio verificado na Resend, os lembretes por email só chegam ao teu próprio email (não às clientes). Depois do domínio: atualizar `FROM_EMAIL` na função `processar-fila`, `index.html`, `robots.txt`, `sitemap.xml` e os URLs autorizados no Supabase Auth.
- [ ] **Contratos de tratamento de dados (DPA)** com os fornecedores: Supabase, Vercel, Railway, Resend — todos oferecem o DPA online nas páginas legais deles. Guarda cópia. [Art. 28.º RGPD](https://www.privacy-regulation.eu/pt/28.htm)
- [ ] **Correr as migrações novas** (`supabase_migration_conformidade.sql`) e **publicar a função `excluir-conta`** (ver abaixo).

### Segurança da base de dados
- [ ] Correr a verificação de RLS (abaixo) e confirmar que **todas** as tabelas têm RLS ligado e nenhuma política com `using (true)` aberta a utilizadores.
- [ ] Supabase → Authentication: mínimo de senha 8+, confirmação de email ligada, ativar *leaked password protection* (Pro) e CAPTCHA no registo.

## 🟡 Recomendado (primeiros meses)
- [ ] **AIPD (avaliação de impacto)**: tratas dados de saúde (anamnese) de muitas pessoas; a CNPD tem lista de tratamentos que exigem AIPD (Regulamento 1/2018). Faz uma versão simples. ⚖️ [CNPD](https://www.cnpd.pt/umbraco/surface/cnpdDecision/download/121818)
- [ ] **Registo das atividades de tratamento** (art. 30.º RGPD) — um documento simples com o que tratas, para quê e onde fica.
- [ ] **WhatsApp**: a ligação atual (Baileys) é **não oficial** e viola os termos do WhatsApp; há risco de bloqueio do número. Não prometas "envio garantido" nos anúncios. A via oficial (Meta Cloud API) exige empresa registada.
- [ ] **Monitorização**: um serviço gratuito de uptime (UptimeRobot) + alertas de erro (Sentry).
- [ ] **Backups**: mesmo no Pro, exporta periodicamente (`supabase db dump`).
- [ ] Email profissional de suporte (hoje é um Gmail).
- [ ] Idiomas: o seletor oferece EN/ES mas a maior parte do site só existe em português — esconder ou completar.
- [ ] Os ficheiros `public/unnamed.jpg` e `public/unnamed (1).jpg` não são usados (logos de origem desconhecida): apagar.

## ✅ Já feito no código
- Páginas de **Termos de Uso** e **Política de Privacidade** completas (subcontratante vs responsável, subcontratantes, transferências, direitos, CNPD, dados de saúde) + **Anexo DPA** (art. 28.º). *As rotas estavam quebradas (redirecionavam para a página inicial) — corrigido.*
- **Recuperar palavra-passe** (`/reset-password`) não tinha rota — corrigido; senha mínima de 8; o link já usa o domínio atual.
- **Consentimento no registo** (checkbox obrigatória com prova guardada) e aviso no login com Google.
- **Banner de cookies** substituído por aviso informativo (o site só usa armazenamento estritamente necessário). O **Pixel da Meta** na página pública só carrega **depois de o visitante aceitar** (botões com o mesmo destaque, como pede a CNPD). [Lei 41/2004 art. 5.º](https://www.anacom.pt/render.jsp?contentId=944401&languageId=0)
- **Formulário de leads**: checkbox de consentimento + ligação à política + anti-spam (campo escondido e limite de pedidos).
- **Opt-out dos lembretes** (`/opt-out`): a ligação nos emails apontava para uma página que não existia. As mensagens de WhatsApp também passam a incluí-la. [Lei 41/2004](https://www.anacom.pt/render.jsp?contentId=944401&languageId=0)
- **Exportar os meus dados** e **Eliminar conta** em Configurações (a Política já prometia isto, mas não existia).
- Removidos os **tokens do Google** guardados na tabela `profiles`.
- **Afirmações do site** corrigidas: "+100% precisão", "0 min", "100% seguro" eram promessas que não dá para provar.
- Identificação do prestador no rodapé, cabeçalhos de segurança (`vercel.json`), `lang="pt-PT"`, meta tags de partilha, imagem Open Graph, `robots.txt` e `sitemap.xml`.

## SQL para verificar o RLS (Supabase → SQL Editor)

```sql
-- Tabelas SEM RLS (deve vir vazio)
select tablename from pg_tables where schemaname = 'public' and rowsecurity = false;

-- Políticas abertas a todos (só devem aparecer as que forem de propósito)
select tablename, policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public' and (qual = 'true' or qual is null or 'anon' = any(roles) or 'public' = any(roles));
```

## Publicar a função `excluir-conta`
Supabase → Edge Functions → *Deploy a new function* → nome `excluir-conta` → colar o conteúdo de
`supabase/functions/excluir-conta/index.ts` → Deploy. (Foi publicada como `rapid-worker`; a função valida o utilizador no código, por isso o "Verify JWT" pode ficar desligado.)
