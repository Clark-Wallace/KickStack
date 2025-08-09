import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export interface AuthRequest extends Request {
  user?: any;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false,
      error: 'No authorization header provided' 
    });
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    
    // Check if user is authenticated (not anonymous)
    if (decoded.role === 'anon') {
      return res.status(403).json({ 
        success: false,
        error: 'Anonymous users cannot perform this action' 
      });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false,
      error: 'Invalid or expired token' 
    });
  }
}

export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    // No auth header is ok for optional auth
    return next();
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    // Invalid token is ok for optional auth, just don't set user
  }
  
  next();
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      success: false,
      error: 'No authorization header provided' 
    });
  }

  const token = authHeader.replace('Bearer ', '');
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    
    // Check if user is admin
    if (decoded.role !== 'admin' && decoded.role !== 'service_role') {
      return res.status(403).json({ 
        success: false,
        error: 'Admin access required' 
      });
    }
    
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false,
      error: 'Invalid or expired token' 
    });
  }
}