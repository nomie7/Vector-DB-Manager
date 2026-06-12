import { query } from "./postgres";

export interface ActivityRow {
  pid: number;
  user: string | null;
  database: string | null;
  clientAddr: string | null;
  applicationName: string | null;
  state: string | null;
  waitEvent: string | null;
  backendStart: string | null;
  queryStart: string | null;
  stateChange: string | null;
  durationSeconds: number | null;
  query: string | null;
  isCurrent: boolean;
}

export async function listActivity(): Promise<ActivityRow[]> {
  const { rows } = await query<{
    pid: number;
    usename: string | null;
    datname: string | null;
    client_addr: string | null;
    application_name: string | null;
    state: string | null;
    wait_event: string | null;
    backend_start: string | null;
    query_start: string | null;
    state_change: string | null;
    duration: string | null;
    query: string | null;
    is_current: boolean;
  }>(
    `select pid,
            usename,
            datname,
            host(client_addr) as client_addr,
            application_name,
            state,
            wait_event,
            backend_start::text,
            query_start::text,
            state_change::text,
            extract(epoch from (now() - query_start))::text as duration,
            query,
            pid = pg_backend_pid() as is_current
     from pg_stat_activity
     where backend_type = 'client backend'
     order by query_start asc nulls last`
  );

  return rows.map((r) => ({
    pid: r.pid,
    user: r.usename,
    database: r.datname,
    clientAddr: r.client_addr,
    applicationName: r.application_name,
    state: r.state,
    waitEvent: r.wait_event,
    backendStart: r.backend_start,
    queryStart: r.query_start,
    stateChange: r.state_change,
    durationSeconds: r.duration ? parseFloat(r.duration) : null,
    query: r.query,
    isCurrent: r.is_current,
  }));
}

export async function cancelBackend(pid: number): Promise<boolean> {
  const { rows } = await query<{ ok: boolean }>(
    "select pg_cancel_backend($1) as ok",
    [pid]
  );
  return rows[0]?.ok ?? false;
}

export async function terminateBackend(pid: number): Promise<boolean> {
  const { rows } = await query<{ ok: boolean }>(
    "select pg_terminate_backend($1) as ok",
    [pid]
  );
  return rows[0]?.ok ?? false;
}
