import jwt from 'jsonwebtoken';

export interface JWTPayload {
  sub: string;
  role: string;
  [key: string]: any;
}

export function decodeJwt(token: string, secret: string): { sub: string; role: string } | null {
  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    
    if (!decoded.sub || !decoded.role) {
      return null;
    }
    
    return {
      sub: decoded.sub,
      role: decoded.role
    };
  } catch (error) {
    console.error('JWT decode error:', error);
    return null;
  }
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}