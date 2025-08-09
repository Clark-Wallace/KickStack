import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import TemplateBrowser from '../TemplateBrowser';
import { TemplateService } from '@/lib/templates';

// Mock the TemplateService
jest.mock('@/lib/templates');

const mockTemplates = [
  {
    name: 'blog-basic',
    display_name: 'Basic Blog',
    description: 'A basic blog template',
    category: 'application',
    tags: ['blog', 'public_read'],
    url: 'https://example.com/blog.tar.gz',
    verified: true,
    contents: {
      tables: ['posts', 'comments'],
      policies: ['public_read', 'owner'],
      functions: ['notify_comment']
    }
  },
  {
    name: 'ecommerce-basic',
    display_name: 'E-commerce Basic',
    description: 'Basic e-commerce template',
    category: 'application',
    tags: ['shop', 'ecommerce'],
    url: 'https://example.com/shop.tar.gz',
    verified: false,
    contents: {
      tables: ['products', 'orders'],
      policies: ['public_read', 'owner'],
      functions: ['payment_webhook']
    }
  }
];

describe('TemplateBrowser', () => {
  let mockService: jest.Mocked<TemplateService>;

  beforeEach(() => {
    mockService = new TemplateService() as jest.Mocked<TemplateService>;
    mockService.getTemplateIndex = jest.fn().mockResolvedValue(mockTemplates);
    mockService.searchTemplates = jest.fn().mockResolvedValue(mockTemplates);
    mockService.getInstalledTemplates = jest.fn().mockResolvedValue([]);
    mockService.refreshIndex = jest.fn().mockResolvedValue({ 
      success: true, 
      count: 2, 
      message: 'Index refreshed' 
    });
  });

  it('renders the template browser', async () => {
    render(<TemplateBrowser />);
    
    expect(screen.getByText('Template Marketplace')).toBeInTheDocument();
    expect(screen.getByText('Discover, preview, and install prebuilt KickStack templates')).toBeInTheDocument();
  });

  it('displays templates after loading', async () => {
    render(<TemplateBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Basic Blog')).toBeInTheDocument();
      expect(screen.getByText('E-commerce Basic')).toBeInTheDocument();
    });
  });

  it('filters templates by search query', async () => {
    render(<TemplateBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Basic Blog')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'blog' } });

    await waitFor(() => {
      expect(screen.getByText('Basic Blog')).toBeInTheDocument();
      expect(screen.queryByText('E-commerce Basic')).not.toBeInTheDocument();
    });
  });

  it('filters templates by category', async () => {
    render(<TemplateBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Basic Blog')).toBeInTheDocument();
    });

    const categorySelect = screen.getByLabelText('Category');
    fireEvent.change(categorySelect, { target: { value: 'application' } });

    await waitFor(() => {
      expect(screen.getByText('Showing 2 of 2 templates')).toBeInTheDocument();
    });
  });

  it('filters verified templates only', async () => {
    render(<TemplateBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Basic Blog')).toBeInTheDocument();
      expect(screen.getByText('E-commerce Basic')).toBeInTheDocument();
    });

    const verifiedCheckbox = screen.getByLabelText('Verified Only');
    fireEvent.click(verifiedCheckbox);

    await waitFor(() => {
      expect(screen.getByText('Basic Blog')).toBeInTheDocument();
      expect(screen.queryByText('E-commerce Basic')).not.toBeInTheDocument();
    });
  });

  it('switches between browse and installed tabs', async () => {
    render(<TemplateBrowser />);
    
    // Initially on browse tab
    expect(screen.getByText('Browse Templates')).toHaveClass('text-blue-600');
    
    // Switch to installed tab
    const installedTab = screen.getByText('Installed');
    fireEvent.click(installedTab);
    
    await waitFor(() => {
      expect(installedTab).toHaveClass('text-blue-600');
    });
  });

  it('refreshes template index', async () => {
    render(<TemplateBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Basic Blog')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh Index');
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockService.refreshIndex).toHaveBeenCalled();
    });
  });

  it('clears all filters', async () => {
    render(<TemplateBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Basic Blog')).toBeInTheDocument();
    });

    // Set some filters
    const searchInput = screen.getByPlaceholderText('Search templates...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    const verifiedCheckbox = screen.getByLabelText('Verified Only');
    fireEvent.click(verifiedCheckbox);

    // Clear filters
    const clearButton = screen.getByText('Clear Filters');
    fireEvent.click(clearButton);

    expect(searchInput).toHaveValue('');
    expect(verifiedCheckbox).not.toBeChecked();
  });

  it('handles loading state', () => {
    mockService.getTemplateIndex = jest.fn(() => new Promise(() => {})); // Never resolves
    
    render(<TemplateBrowser />);
    
    expect(screen.getByText('Loading templates...')).toBeInTheDocument();
  });

  it('handles error state', async () => {
    mockService.getTemplateIndex = jest.fn().mockRejectedValue(new Error('Network error'));
    
    render(<TemplateBrowser />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load templates. Please try again later.')).toBeInTheDocument();
    });
  });
});