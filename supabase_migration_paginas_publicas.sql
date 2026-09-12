-- Migration: paginas_publicas
-- Página pública por profissional (sem login) para receber tráfego de
-- anúncios: mostra o negócio, e deixa a visitante escolher entre falar no
-- WhatsApp ou deixar os dados num formulário. Os dados do formulário viram
-- um cartão no quadro Kanban "Leads" da profissional, automaticamente.

create table if not exists public.paginas_publicas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  nome_negocio text not null,
  descricao text,
  telefone_whatsapp text,
  fotos text[] not null default '{}',
  meta_pixel_id text,
  criado_em timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.paginas_publicas is
  'Página pública de captação (link para anúncios), uma por profissional. Leitura pública só através de obter_pagina_publica() — nunca a tabela diretamente.';
comment on column public.paginas_publicas.slug is
  'Parte final do link público: agendaestetica.app/p/<slug>. Só letras minúsculas, números e hífen.';

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_paginas_publicas_updated_at on public.paginas_publicas;
create trigger trg_paginas_publicas_updated_at
  before update on public.paginas_publicas
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: só a própria profissional lê/edita a sua página. Ninguém de fora tem
-- acesso direto à tabela — o público passa pela função obter_pagina_publica().
-- ---------------------------------------------------------------------------
alter table public.paginas_publicas enable row level security;

drop policy if exists "paginas_publicas_select_own" on public.paginas_publicas;
create policy "paginas_publicas_select_own"
  on public.paginas_publicas for select
  using (usuario_id = auth.uid());

drop policy if exists "paginas_publicas_insert_own" on public.paginas_publicas;
create policy "paginas_publicas_insert_own"
  on public.paginas_publicas for insert
  with check (usuario_id = auth.uid());

drop policy if exists "paginas_publicas_update_own" on public.paginas_publicas;
create policy "paginas_publicas_update_own"
  on public.paginas_publicas for update
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

drop policy if exists "paginas_publicas_delete_own" on public.paginas_publicas;
create policy "paginas_publicas_delete_own"
  on public.paginas_publicas for delete
  using (usuario_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Função pública: ler os dados da página pelo slug (sem expor usuario_id
-- nem nenhuma outra coluna interna).
-- ---------------------------------------------------------------------------
create or replace function public.obter_pagina_publica(p_slug text)
returns table (
  nome_negocio text,
  descricao text,
  telefone_whatsapp text,
  fotos text[],
  meta_pixel_id text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select pp.nome_negocio, pp.descricao, pp.telefone_whatsapp, pp.fotos, pp.meta_pixel_id
    from public.paginas_publicas pp
    where pp.slug = p_slug
    limit 1;
end;
$$;

revoke all on function public.obter_pagina_publica(text) from public;
grant execute on function public.obter_pagina_publica(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Função pública: criar um lead a partir do formulário da página. Garante
-- que existe um quadro Kanban "Leads" com uma lista "Nova Lead" (cria-os na
-- primeira vez que a profissional recebe um lead), e insere o cartão lá.
-- ---------------------------------------------------------------------------
create or replace function public.criar_lead_publica(
  p_slug text,
  p_nome text,
  p_telefone text,
  p_interesse text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_quadro_id uuid;
  v_lista_id uuid;
  v_ordem int;
begin
  if p_nome is null or btrim(p_nome) = '' then
    raise exception 'Nome é obrigatório';
  end if;
  if p_telefone is null or btrim(p_telefone) = '' then
    raise exception 'Telefone é obrigatório';
  end if;

  select usuario_id into v_usuario_id
  from public.paginas_publicas
  where slug = p_slug;

  if v_usuario_id is null then
    return false;
  end if;

  -- Garante o quadro "Leads" desta profissional
  select id into v_quadro_id
  from public.quadros_kanban
  where usuario_id = v_usuario_id and nome = 'Leads'
  limit 1;

  if v_quadro_id is null then
    insert into public.quadros_kanban (usuario_id, nome, cor)
    values (v_usuario_id, 'Leads', '#10b981')
    returning id into v_quadro_id;
  end if;

  -- Garante a lista "Nova Lead" dentro desse quadro
  select id into v_lista_id
  from public.listas_kanban
  where quadro_id = v_quadro_id and nome = 'Nova Lead'
  limit 1;

  if v_lista_id is null then
    insert into public.listas_kanban (usuario_id, quadro_id, nome, ordem)
    values (v_usuario_id, v_quadro_id, 'Nova Lead', 0)
    returning id into v_lista_id;
  end if;

  select coalesce(max(ordem), -1) + 1 into v_ordem
  from public.cartoes_kanban
  where lista_id = v_lista_id;

  insert into public.cartoes_kanban (usuario_id, lista_id, titulo, descricao, ordem)
  values (
    v_usuario_id,
    v_lista_id,
    left(btrim(p_nome), 200),
    'Telefone: ' || left(btrim(p_telefone), 50)
      || case when p_interesse is not null and btrim(p_interesse) <> ''
              then E'\nInteresse: ' || left(btrim(p_interesse), 500)
              else '' end,
    v_ordem
  );

  return true;
end;
$$;

revoke all on function public.criar_lead_publica(text, text, text, text) from public;
grant execute on function public.criar_lead_publica(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: fotos do negócio, num bucket PÚBLICO (para a página de anúncios
-- carregar sem precisar de link assinado). Só a própria profissional pode
-- enviar/apagar ficheiros na sua própria pasta (<usuario_id>/...).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('paginas-publicas', 'paginas-publicas', true)
on conflict (id) do update set public = true;

drop policy if exists "paginas_publicas_storage_insert_own" on storage.objects;
create policy "paginas_publicas_storage_insert_own"
  on storage.objects for insert
  with check (bucket_id = 'paginas-publicas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "paginas_publicas_storage_update_own" on storage.objects;
create policy "paginas_publicas_storage_update_own"
  on storage.objects for update
  using (bucket_id = 'paginas-publicas' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "paginas_publicas_storage_delete_own" on storage.objects;
create policy "paginas_publicas_storage_delete_own"
  on storage.objects for delete
  using (bucket_id = 'paginas-publicas' and (storage.foldername(name))[1] = auth.uid()::text);
