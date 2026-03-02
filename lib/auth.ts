// lib/auth.ts
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

function getSecret() {
  return new TextEncoder().encode(process.env.JWT_SECRET!);
}

export interface AdminPayload extends JWTPayload {
  role: 'admin';
}

export async function signToken(): Promise<string> {
  return new SignJWT({ role: 'admin' } as AdminPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<AdminPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ['HS256'],
  });
  return payload as AdminPayload;
}

export function validateApiKey(authHeader: string | null): boolean {
  if (!authHeader) return false;
  const key = authHeader.replace('Bearer ', '');
  return key === process.env.API_KEY;
}

export function validatePassword(password: string): boolean {
  return password === process.env.ADMIN_PASSWORD;
}
