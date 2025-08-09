const AUTH_BASE = process.env.NEXT_PUBLIC_AUTH_BASE || 'http://localhost:9999';
const TOKEN_KEY = 'kickstack_token';

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

export interface User {
  email: string;
  id?: string;
}

export class AuthService {
  static async login(email: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${AUTH_BASE}/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Login failed: ${error}`);
    }

    const data = await response.json();
    localStorage.setItem(TOKEN_KEY, data.access_token);
    return data;
  }

  static async signup(email: string, password: string): Promise<void> {
    const response = await fetch(`${AUTH_BASE}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Signup failed: ${error}`);
    }
  }

  static logout(): void {
    localStorage.removeItem(TOKEN_KEY);
  }

  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  static getCurrentUser(): User | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      // Decode JWT to get user info (basic implementation)
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = JSON.parse(atob(parts[1]));
      return {
        email: payload.email || payload.sub || 'Unknown',
        id: payload.sub,
      };
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }
}