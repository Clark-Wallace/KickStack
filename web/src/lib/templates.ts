export interface Template {
  name: string;
  display_name: string;
  description: string;
  category: string;
  tags: string[];
  url: string;
  verified: boolean;
  version?: string;
  size?: number;
  checksum?: string;
  readme?: string;
  contents?: {
    tables?: string[];
    policies?: string[];
    functions?: string[];
  };
  author?: string;
  license?: string;
  kickstack_min_version?: string;
}

export interface InstalledTemplate {
  name: string;
  version: string;
  installed_at: string;
  path: string;
}

export interface InstallOptions {
  mode: 'stage' | 'apply';
  force?: boolean;
}

export interface InstallResult {
  success: boolean;
  name: string;
  mode: string;
  result: {
    migrations: string[];
    functions: string[];
    assets: string[];
  };
  message: string;
}

export interface SearchOptions {
  category?: string;
  tag?: string;
  verifiedOnly?: boolean;
}

export class TemplateService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_DASHBOARD_API || 'http://localhost:8787';
  }

  async getTemplateIndex(): Promise<Template[]> {
    const response = await fetch(`${this.baseUrl}/api/templates/index`);
    if (!response.ok) {
      throw new Error('Failed to fetch template index');
    }
    return response.json();
  }

  async searchTemplates(query?: string, options?: SearchOptions): Promise<Template[]> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (options?.category) params.append('category', options.category);
    if (options?.tag) params.append('tag', options.tag);
    if (options?.verifiedOnly) params.append('verifiedOnly', 'true');

    const response = await fetch(`${this.baseUrl}/api/templates/search?${params}`);
    if (!response.ok) {
      throw new Error('Failed to search templates');
    }
    return response.json();
  }

  async getTemplateDetails(name: string): Promise<Template> {
    const response = await fetch(`${this.baseUrl}/api/templates/${name}`);
    if (!response.ok) {
      throw new Error(`Template ${name} not found`);
    }
    return response.json();
  }

  async installTemplate(
    name: string, 
    options: InstallOptions,
    token: string
  ): Promise<InstallResult> {
    const response = await fetch(`${this.baseUrl}/api/templates/install`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name,
        ...options
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to install template');
    }

    return response.json();
  }

  async getInstalledTemplates(): Promise<InstalledTemplate[]> {
    const response = await fetch(`${this.baseUrl}/api/templates/installed`);
    if (!response.ok) {
      throw new Error('Failed to fetch installed templates');
    }
    return response.json();
  }

  async refreshIndex(): Promise<{ success: boolean; count: number; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/templates/refresh-index`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh template index');
    }
    
    return response.json();
  }

  // Helper methods for UI
  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      application: '🎯',
      utility: '🛠️',
      demo: '📚',
      component: '🧩'
    };
    return icons[category] || '📦';
  }

  getVerifiedBadge(verified: boolean): string {
    return verified ? '✅' : '';
  }

  formatSize(bytes?: number): string {
    if (!bytes) return '';
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  }

  getTagColor(tag: string): string {
    // Return Tailwind color classes based on tag
    const colors: Record<string, string> = {
      'public_read': 'bg-green-100 text-green-800',
      'owner': 'bg-blue-100 text-blue-800',
      'blog': 'bg-purple-100 text-purple-800',
      'ecommerce': 'bg-yellow-100 text-yellow-800',
      'demo': 'bg-gray-100 text-gray-800',
      'social': 'bg-pink-100 text-pink-800',
      'auth': 'bg-red-100 text-red-800'
    };
    return colors[tag] || 'bg-gray-100 text-gray-800';
  }
}