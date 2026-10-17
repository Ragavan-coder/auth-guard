import crypto from 'crypto';
import * as jose from 'jose';
import { UserRepository } from '../repositories/user.repository.js';
import { InvalidTokenError, InvalidRequestError } from '../domain/authorization.errors.js';
import { logger } from '../utils/logger.js';

export interface LocalAuthClaims {
  sub: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  local: true;
}

export class LocalAuthService {
  private readonly jwtSecret: Uint8Array;

  constructor(
    private userRepo: UserRepository = new UserRepository(),
    secret?: string
  ) {
    const rawSecret = secret || process.env['LOCAL_JWT_SECRET'] || 'local-dev-secret-change-me-in-production';
    this.jwtSecret = new TextEncoder().encode(rawSecret);
  }

  public hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
  }

  public verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    try {
      const inputHash = crypto.scryptSync(password, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(inputHash, 'hex'));
    } catch {
      return false;
    }
  }

  public async signToken(claims: LocalAuthClaims): Promise<string> {
    return new jose.SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('8h')
      .sign(this.jwtSecret);
  }

  public async verifyToken(token: string): Promise<LocalAuthClaims> {
    try {
      const { payload } = await jose.jwtVerify(token, this.jwtSecret, {
        algorithms: ['HS256']
      });
      if (!payload['local'] || !payload['role']) {
        throw new InvalidTokenError('Not a local auth token.');
      }
      return payload as unknown as LocalAuthClaims;
    } catch (err) {
      if (err instanceof InvalidTokenError) throw err;
      throw new InvalidTokenError('Local session token is invalid or expired.');
    }
  }

  public async register(data: {
    username: string;
    email: string;
    password: string;
  }): Promise<{ token: string; user: { id: number; username: string; email: string; role: string } }> {
    if (!data.email || !data.password || !data.username) {
      throw new InvalidRequestError('Username, email, and password are required.');
    }
    if (data.password.length < 8) {
      throw new InvalidRequestError('Password must be at least 8 characters.');
    }
    if (this.userRepo.findByEmail(data.email)) {
      throw new InvalidRequestError('An account with this email already exists.');
    }
    if (this.userRepo.findByUsername(data.username)) {
      throw new InvalidRequestError('This username is already taken.');
    }

    const password_hash = this.hashPassword(data.password);
    const user = this.userRepo.create({ username: data.username, email: data.email, password_hash });

    // Seed default allowed permissions for new registered user
    try {
      const db = (this.userRepo as unknown as { db: import('better-sqlite3').Database }).db;
      if (db) {
        const stmt = db.prepare(
          'INSERT OR IGNORE INTO user_permissions (user_id, action, resource, effect) VALUES (?, ?, ?, ?)'
        );
        stmt.run(user.username, 'read', 'transactions', 'allow');
        stmt.run(user.email, 'read', 'transactions', 'allow');
        stmt.run(String(user.id), 'read', 'transactions', 'allow');
      }
    } catch {
      // non-blocking
    }

    const token = await this.signToken({
      sub: String(user.id),
      email: user.email,
      username: user.username,
      role: user.role,
      local: true
    });

    logger.info({ userId: user.id, email: user.email }, 'New local user registered.');
    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    };
  }

  public async login(data: {
    email: string;
    password: string;
  }): Promise<{ token: string; user: { id: number; username: string; email: string; role: string } }> {
    const user = this.userRepo.findByEmail(data.email);
    if (!user || !this.verifyPassword(data.password, user.password_hash)) {
      throw new InvalidRequestError('Invalid email or password.');
    }

    const token = await this.signToken({
      sub: String(user.id),
      email: user.email,
      username: user.username,
      role: user.role,
      local: true
    });

    logger.info({ userId: user.id, email: user.email }, 'Local user logged in.');
    return {
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    };
  }
}
