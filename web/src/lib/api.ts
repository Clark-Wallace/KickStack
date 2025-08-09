import { AuthService } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3000';

export class ApiClient {
  private static getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = AuthService.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  static async get(path: string): Promise<any> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  static async post(path: string, body: any): Promise<any> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API request failed: ${error}`);
    }

    return response.json();
  }

  static async delete(path: string): Promise<void> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
  }

  static async patch(path: string, body: any): Promise<any> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }

    return response.json();
  }

  // Health check methods
  static async checkApiHealth(): Promise<boolean> {
    try {
      await fetch(`${API_BASE}/`, { method: 'GET' });
      return true;
    } catch {
      return false;
    }
  }

  static async checkAuthHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_BASE}/health`, { 
        method: 'GET' 
      });
      return response.ok;
    } catch {
      // Try alternate endpoint
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_BASE}/`, { 
          method: 'GET' 
        });
        return response.ok;
      } catch {
        return false;
      }
    }
  }
}