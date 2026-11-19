import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from './db.ts';

export type UserRole = 'admin' | 'accountant' | 'supervisor' | 'storekeeper' | 'driver';

export interface AuthUser {
  id: number;
  name: string;
  username: string;
  role: UserRole;
  status: string;
}

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(48).toString('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hash, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function createSessionToken(user: AuthUser): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      username: user.username,
      role: user.role,
      iat: Date.now(),
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { id: number; username: string; role: UserRole } | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
    if (sig !== expected) return null;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed;
  } catch {
    return null;
  }
}

export type PermissionAction =
  | 'dashboard:view'
  | 'clients:read' | 'clients:write' | 'clients:delete'
  | 'projects:read' | 'projects:write' | 'projects:delete' | 'projects:approve'
  | 'invoices:read' | 'invoices:write' | 'invoices:delete' | 'invoices:approve'
  | 'attendance:read' | 'attendance:write' | 'attendance:approve'
  | 'payroll:read' | 'payroll:write' | 'payroll:approve'
  | 'materials:read' | 'materials:write' | 'materials:adjust'
  | 'suppliers:read' | 'suppliers:write' | 'suppliers:pay'
  | 'vehicles:read' | 'vehicles:write' | 'fuel:write' | 'repairs:write'
  | 'treasury:read' | 'treasury:write'
  | 'expenses:read' | 'expenses:write' | 'expenses:delete'
  | 'taxes:read' | 'taxes:write'
  | 'documents:read' | 'documents:write' | 'documents:delete'
  | 'reports:read' | 'reports:export'
  | 'settings:read' | 'settings:write'
  | 'backup:manage'
  | 'audit:read';

const ROLE_PERMISSIONS: Record<UserRole, Set<string>> = {
  admin: new Set(['*']),
  accountant: new Set([
    'dashboard:view',
    'clients:read', 'clients:write',
    'projects:read',
    'invoices:read', 'invoices:write', 'invoices:approve',
    'attendance:read',
    'payroll:read', 'payroll:write',
    'materials:read',
    'suppliers:read', 'suppliers:write', 'suppliers:pay',
    'vehicles:read',
    'treasury:read', 'treasury:write',
    'expenses:read', 'expenses:write',
    'taxes:read', 'taxes:write',
    'documents:read', 'documents:write',
    'reports:read', 'reports:export',
  ]),
  supervisor: new Set([
    'dashboard:view',
    'clients:read',
    'projects:read', 'projects:write',
    'attendance:read', 'attendance:write',
    'materials:read', 'materials:write',
    'vehicles:read', 'fuel:write', 'repairs:write',
    'documents:read', 'documents:write',
    'reports:read',
  ]),
  storekeeper: new Set([
    'dashboard:view',
    'projects:read',
    'materials:read', 'materials:write', 'materials:adjust',
    'suppliers:read', 'suppliers:write',
    'vehicles:read',
    'documents:read', 'documents:write',
  ]),
  driver: new Set([
    'dashboard:view',
    'projects:read',
    'vehicles:read', 'fuel:write', 'repairs:write',
    'documents:read',
  ]),
};

export function hasPermission(role: UserRole, permission: PermissionAction): boolean {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  return perms.has('*') || perms.has(permission);
}

export function getPermissionsForRole(role: UserRole): string[] {
  return Array.from(ROLE_PERMISSIONS[role] || []);
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (typeof req.query.token === 'string') {
    token = req.query.token;
  }
  if (!token) {
    res.status(401).json({ error: 'Authentification requise. Veuillez vous connecter.' });
    return;
  }
  const decoded = verifySessionToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Session expirée ou invalide. Veuillez vous reconnecter.' });
    return;
  }
  const db = getDb();
  const user = db
    .prepare('SELECT id, name, username, role, status FROM users WHERE id = ?')
    .get(decoded.id) as AuthUser | undefined;
  if (!user || user.status !== 'active') {
    res.status(401).json({ error: 'Compte utilisateur désactivé ou introuvable.' });
    return;
  }
  req.user = user;
  next();
}

export function requirePermission(permission: PermissionAction) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentification requise.' });
      return;
    }
    if (!hasPermission(req.user.role, permission)) {
      res.status(403).json({
        error: `Accès refusé : votre rôle (${req.user.role}) ne dispose pas de l'autorisation « ${permission} ».`,
      });
      return;
    }
    next();
  };
}

export function logAudit(
  user: AuthUser | { id: number | null; name: string },
  action: string,
  entity: string,
  entityId: string | number | bigint = '',
  oldValue: unknown = '',
  newValue: unknown = ''
) {
  const db = getDb();
  db.prepare(
    `INSERT INTO audit_logs (user_id, user_name, action, entity, entity_id, old_value, new_value)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    user.id,
    user.name,
    action,
    entity,
    String(entityId),
    typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue ?? ''),
    typeof newValue === 'string' ? newValue : JSON.stringify(newValue ?? '')
  );
}
