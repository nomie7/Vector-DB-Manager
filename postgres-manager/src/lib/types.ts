export interface DatabaseInfo {
  name: string;
  owner: string;
  encoding: string;
  collate: string | null;
  ctype: string | null;
  size: string;
  sizeBytes: number;
  connections: number;
  isTemplate: boolean;
  allowConnections: boolean;
}

export interface RoleInfo {
  name: string;
  superuser: boolean;
  createDb: boolean;
  createRole: boolean;
  canLogin: boolean;
  replication: boolean;
  inherit: boolean;
  connectionLimit: number;
  validUntil: string | null;
  memberOf: string[];
}

export interface StatusInfo {
  connected: boolean;
  error?: string;
  version?: string;
  serverVersion?: string;
  currentUser?: string;
  isSuperuser?: boolean;
  startTime?: string;
  uptime?: string;
  connections?: { total: number; active: number; max: number };
  databaseCount?: number;
  roleCount?: number;
}

export interface DatabasePrivilegeRow {
  role: string;
  connect: boolean;
  create: boolean;
  temporary: boolean;
}

export type Notify = (
  message: string,
  type?: "success" | "error" | "info"
) => void;
