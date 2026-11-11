-- =============================================================================
-- Cron PRÓPRIO do worker processar-whatsapp-cloud
--
-- ESTADO: PREPARADO, NÃO EXECUTADO. Só correr com autorização explícita e
-- DEPOIS de: migration aplicada, função publicada e segredos definidos.
--
-- Não altera o cron atual ("processar-fila-notificacoes" → super-action).
-- O job é criado e DESATIVADO na mesma transação: nunca chega a correr ativo.
-- =============================================================================

-- 0. (Uma vez) guardar o WA_CRON_SECRET no Vault, em vez de o escrever no comando
--    do cron (os comandos ficam legíveis em cron.job). Substituir o valor e correr
--    à parte, sem o guardar em nenhum ficheiro:
--
--    select vault.create_secret('<VALOR_DE_WA_CRON_SECRET>', 'wa_cron_secret',
--                               'Segredo do cron processar-whatsapp-cloud');

begin;

do $$
declare
  v_job bigint;
begin
  if exists (select 1 from cron.job where jobname = 'processar-whatsapp-cloud') then
    raise exception 'O job processar-whatsapp-cloud já existe — nada foi alterado.';
  end if;

  v_job := cron.schedule(
    'processar-whatsapp-cloud',
    '*/10 * * * *',
    $cmd$
      select net.http_post(
        url     := 'https://pxjckbpxyxkhytkigowa.supabase.co/functions/v1/processar-whatsapp-cloud',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'wa_cron_secret')
        ),
        body    := '{}'::jsonb,
        timeout_milliseconds := 55000
      );
    $cmd$
  );

  perform cron.alter_job(job_id := v_job, active := false);
end $$;

commit;

-- Verificar (deve mostrar active = false):
--   select jobid, jobname, schedule, active from cron.job where jobname = 'processar-whatsapp-cloud';
--
-- Ativar (SÓ com autorização):
--   select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'processar-whatsapp-cloud'), active := true);
--
-- Desativar:
--   select cron.alter_job(job_id := (select jobid from cron.job where jobname = 'processar-whatsapp-cloud'), active := false);
--
-- Remover:
--   select cron.unschedule('processar-whatsapp-cloud');
