-- Dedicated SOLO project only. No business records or pairing plaintext are stored here.
begin;
create schema solo_access;
revoke all on schema solo_access from public, anon, authenticated;
grant usage on schema solo_access to service_role;
create table solo_access.devices (
 channel uuid primary key,
 token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
 enabled boolean not null default true,
 expires_at timestamptz not null check (expires_at > created_at),
 created_at timestamptz not null default now(),
 last_poll timestamptz
);
create table solo_access.messages (
 id uuid primary key,
 channel uuid not null references solo_access.devices(channel),
 request jsonb not null check (jsonb_typeof(request)='object' and octet_length(request::text)<=1048576),
 response jsonb check (jsonb_typeof(response)='object' and octet_length(response::text)<=1048576),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 responded_at timestamptz,
 check (expires_at > created_at and expires_at <= created_at + interval '24 hours'),
 check ((response is null) = (responded_at is null))
);
create index solo_access_pending on solo_access.messages(channel,created_at,id) where response is null;
create index solo_access_expiry on solo_access.messages(expires_at);
alter table solo_access.devices enable row level security;
alter table solo_access.messages enable row level security;
revoke all on all tables in schema solo_access from public,anon,authenticated;
grant select,insert,update,delete on all tables in schema solo_access to service_role;
-- Invoker only: service_role is held exclusively inside the authenticated Edge Function.
create function public.solo_access_device(p_channel uuid,p_token_hash text,p_action text,p_id uuid default null,p_response jsonb default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare device solo_access.devices%rowtype; result jsonb; previous jsonb;
begin
 select * into device from solo_access.devices where channel=p_channel for update;
 if not found or not device.enabled or device.expires_at<=now() or device.token_hash is distinct from p_token_hash then
  raise exception using errcode='28000',message='Access denied';
 end if;
 if p_action='poll' then
  if device.last_poll > now()-interval '2 seconds' then
   raise exception using errcode='P0001',message='Rate limited';
  end if;
  update solo_access.devices set last_poll=now() where channel=p_channel;
  -- Expired ciphertext is removed on the next device poll; no business rows exist here.
  delete from solo_access.messages where channel=p_channel and expires_at<=now();
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'request',q.request) order by q.created_at,q.id),'[]'::jsonb) into result
  from (select id,request,created_at from solo_access.messages where channel=p_channel and response is null and expires_at>now() order by created_at,id limit 5) q;
  return jsonb_build_object('messages',result);
 elsif p_action='respond' then
  if p_response is null or jsonb_typeof(p_response)<>'object' or octet_length(p_response::text)>1048576 then
   raise exception 'Invalid response';
  end if;
  select response into previous from solo_access.messages where channel=p_channel and id=p_id and expires_at>now() for update;
  if not found then raise exception 'Request unavailable'; end if;
  if previous is not null then
   if previous is distinct from p_response then raise exception 'Response conflict'; end if;
   return jsonb_build_object('ok',true,'replayed',true);
  end if;
  update solo_access.messages set response=p_response,responded_at=now() where channel=p_channel and id=p_id;
  return jsonb_build_object('ok',true);
 elsif p_action='revoke' then
  update solo_access.devices set enabled=false where channel=p_channel;
  delete from solo_access.messages where channel=p_channel;
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unsupported action';
end;
$$;
revoke all on function public.solo_access_device(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.solo_access_device(uuid,text,text,uuid,jsonb) to service_role;
commit;
