-- Migration: cron_secret_cofre  (passo a da troca do CRON_SECRET)
--
-- 1. Gera um segredo NOVO dentro da base de dados (32 bytes aleatórios, em
--    hexadecimal) e guarda-o, encriptado, no cofre (Vault) com o nome
--    'cron_secret'. O valor nunca é devolvido por esta migration: a função
--    vault.create_secret só devolve o id.
-- 2. Cria public.validar_segredo_cron(texto) -> true/false, para a função
--    super-action confirmar o cabeçalho x-cron-secret SEM nunca ler o valor.
--    Só o servidor (service_role) a pode chamar; anon e authenticated não.
--
-- Não altera nem apaga dados de nenhuma utilizadora. Não mexe no cron nem na
-- função super-action (isso são os passos b e c, à parte).
-- Pode correr duas vezes: se o segredo já existir, não cria outro.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'cron_secret',
      'Segredo que o pg_cron envia à função super-action (cabeçalho x-cron-secret).'
    );
  end if;
end $$;

create or replace function public.validar_segredo_cron(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_segredo, '') <> ''
     and exists (
       select 1
         from vault.decrypted_secrets
        where name = 'cron_secret'
          and decrypted_secret = p_segredo
     );
$$;

comment on function public.validar_segredo_cron(text) is
  'Diz só se o texto é igual ao segredo do cron guardado no cofre. Nunca devolve o segredo. Só para service_role.';

revoke all on function public.validar_segredo_cron(text) from public, anon, authenticated;
grant execute on function public.validar_segredo_cron(text) to service_role;
