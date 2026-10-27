import { query } from '../db/postgres';

export type UserRole = 'ADMIN' | 'RECRUITER' | 'CANDIDATE';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

export class UserService {
  public static async findByEmail(email: string): Promise<User | null> {
    const res = await query<User>(
      'SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    return res.rows[0] || null;
  }

  public static async findById(id: string): Promise<User | null> {
    const res = await query<User>(
      'SELECT id, email, password_hash, role, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  public static async create(
    email: string,
    passwordHash: string,
    role: UserRole = 'CANDIDATE'
  ): Promise<User> {
    const res = await query<User>(
      `INSERT INTO users (email, password_hash, role)
       VALUES (LOWER($1), $2, $3)
       RETURNING id, email, password_hash, role, created_at, updated_at`,
      [email, passwordHash, role]
    );
    return res.rows[0];
  }

  public static async updatePassword(id: string, newPasswordHash: string): Promise<void> {
    await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newPasswordHash, id]
    );
  }

  public static async listUsers(): Promise<Omit<User, 'password_hash'>[]> {
    const res = await query<Omit<User, 'password_hash'>>(
      'SELECT id, email, role, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    return res.rows;
  }
}
