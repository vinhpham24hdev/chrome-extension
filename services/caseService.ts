// services/caseService.ts - Real Case Management Service
export interface CaseItem {
  id: string;
  title: string;
  description?: string;
  status: 'active' | 'pending' | 'closed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: string;
  updatedAt?: string;
  assignedTo?: string;
  tags?: string[];
  metadata?: {
    totalScreenshots?: number;
    totalVideos?: number;
    lastActivity?: string;
    totalFileSize?: number;
  };
}

export interface CreateCaseRequest {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  tags?: string[];
}

export interface CaseFilters {
  status?: string[];
  priority?: string[];
  search?: string;
  assignedTo?: string;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface CaseStats {
  total: number;
  active: number;
  pending: number;
  closed: number;
  archived: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  totalFiles: number;
  totalFileSize: number;
  recentActivity: Array<{
    id: string;
    title: string;
    status: string;
    lastActivity: string;
  }>;
}

export interface CasePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CaseListResponse {
  cases: CaseItem[];
  pagination: CasePagination;
  filters: CaseFilters;
}

class CaseService {
  private apiBaseUrl: string;
  private authToken: string | null = null;

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    this.loadAuthToken();
  }

  // Load auth token from storage
  private loadAuthToken(): void {
    try {
      // Try Chrome storage first
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['authState'], (result) => {
          if (result.authState?.token) {
            this.authToken = result.authState.token;
          }
        });
      } else {
        // Fallback to localStorage
        const authState = localStorage.getItem('authState');
        if (authState) {
          const parsed = JSON.parse(authState);
          this.authToken = parsed.token;
        }
      }
    } catch (error) {
      console.warn('Failed to load auth token:', error);
    }
  }

  // Set auth token
  public setAuthToken(token: string): void {
    this.authToken = token;
  }

  // API request helper with auth
  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }

  // Get all cases with filtering and pagination
  public async getCases(filters: CaseFilters = {}): Promise<CaseItem[]> {
    try {
      console.log('📁 Getting cases with filters:', filters);

      const params = new URLSearchParams();
      
      // Add filters to params
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, value.toString());
          }
        }
      });

      const response = await this.apiRequest(`/cases?${params}`);
      const result: CaseListResponse = await response.json();

      console.log('✅ Cases retrieved:', {
        total: result.pagination.total,
        page: result.pagination.page,
        cases: result.cases.length
      });

      return result.cases;
    } catch (error) {
      console.error('❌ Failed to get cases:', error);
      throw error;
    }
  }

  // Get single case by ID
  public async getCaseById(id: string): Promise<CaseItem | null> {
    try {
      console.log('📋 Getting case by ID:', id);

      const response = await this.apiRequest(`/cases/${id}`);
      const case_: CaseItem = await response.json();

      console.log('✅ Case retrieved:', case_.title);
      return case_;
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        console.warn('⚠️ Case not found:', id);
        return null;
      }
      console.error('❌ Failed to get case:', error);
      throw error;
    }
  }

  // Create new case
  public async createCase(caseData: CreateCaseRequest): Promise<CaseItem> {
    try {
      console.log('➕ Creating new case:', caseData.title);

      const response = await this.apiRequest('/cases', {
        method: 'POST',
        body: JSON.stringify(caseData),
      });

      const result = await response.json();
      const newCase: CaseItem = result.case;

      console.log('✅ Case created:', {
        id: newCase.id,
        title: newCase.title,
        status: newCase.status
      });

      return newCase;
    } catch (error) {
      console.error('❌ Failed to create case:', error);
      throw error;
    }
  }

  // Update existing case
  public async updateCase(id: string, updates: Partial<CaseItem>): Promise<CaseItem> {
    try {
      console.log('✏️ Updating case:', id, updates);

      const response = await this.apiRequest(`/cases/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });

      const result = await response.json();
      const updatedCase: CaseItem = result.case;

      console.log('✅ Case updated:', {
        id: updatedCase.id,
        title: updatedCase.title,
        status: updatedCase.status
      });

      return updatedCase;
    } catch (error) {
      console.error('❌ Failed to update case:', error);
      throw error;
    }
  }

  // Delete case (admin only)
  public async deleteCase(id: string): Promise<boolean> {
    try {
      console.log('🗑️ Deleting case:', id);

      await this.apiRequest(`/cases/${id}`, {
        method: 'DELETE',
      });

      console.log('✅ Case deleted successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to delete case:', error);
      return false;
    }
  }

  // Update case metadata
  public async updateCaseMetadata(id: string, metadata: Record<string, any>): Promise<CaseItem> {
    try {
      console.log('📊 Updating case metadata:', id);

      const response = await this.apiRequest(`/cases/${id}/metadata`, {
        method: 'PATCH',
        body: JSON.stringify({ metadata }),
      });

      const result = await response.json();
      console.log('✅ Case metadata updated');
      
      // Return the updated case (you might need to fetch it again)
      return await this.getCaseById(id) || {} as CaseItem;
    } catch (error) {
      console.error('❌ Failed to update case metadata:', error);
      throw error;
    }
  }

  // Get case statistics
  public async getCaseStats(): Promise<CaseStats> {
    try {
      console.log('📊 Getting case statistics');

      const response = await this.apiRequest('/cases/stats');
      const stats: CaseStats = await response.json();

      console.log('✅ Case stats retrieved:', {
        total: stats.total,
        active: stats.active,
        totalFiles: stats.totalFiles
      });

      return stats;
    } catch (error) {
      console.error('❌ Failed to get case stats:', error);
      throw error;
    }
  }

  // Get available tags
  public async getAvailableTags(): Promise<string[]> {
    try {
      console.log('🏷️ Getting available tags');

      const response = await this.apiRequest('/cases/tags');
      const result = await response.json();

      console.log('✅ Tags retrieved:', result.tags.length);
      return result.tags;
    } catch (error) {
      console.error('❌ Failed to get tags:', error);
      return [];
    }
  }

  // Bulk update cases
  public async bulkUpdateCases(caseIds: string[], updates: Partial<CaseItem>): Promise<boolean> {
    try {
      console.log('📦 Bulk updating cases:', caseIds.length);

      const response = await this.apiRequest('/cases/bulk-update', {
        method: 'PATCH',
        body: JSON.stringify({
          caseIds,
          updates,
        }),
      });

      const result = await response.json();
      
      console.log('✅ Bulk update completed:', {
        updated: result.updated,
        total: result.total,
        errors: result.errors?.length || 0
      });

      return result.success;
    } catch (error) {
      console.error('❌ Failed to bulk update cases:', error);
      return false;
    }
  }

  // Export cases to CSV
  public async exportCases(filters: CaseFilters = {}): Promise<string> {
    try {
      console.log('📤 Exporting cases to CSV');

      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            params.append(key, value.join(','));
          } else {
            params.append(key, value.toString());
          }
        }
      });

      const response = await this.apiRequest(`/cases/export?${params}`);
      const csvData = await response.text();

      console.log('✅ Cases exported to CSV');
      return csvData;
    } catch (error) {
      console.error('❌ Failed to export cases:', error);
      throw error;
    }
  }

  // Check connection to backend
  public async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`);
      return response.ok;
    } catch (error) {
      console.error('❌ Backend connection check failed:', error);
      return false;
    }
  }

  // Get case files
  public async getCaseFiles(caseId: string, options: {
    captureType?: 'screenshot' | 'video';
    page?: number;
    limit?: number;
  } = {}): Promise<any[]> {
    try {
      console.log('📁 Getting files for case:', caseId);

      const params = new URLSearchParams();
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await this.apiRequest(`/upload/cases/${caseId}/files?${params}`);
      const result = await response.json();

      console.log('✅ Case files retrieved:', result.files.length);
      return result.files;
    } catch (error) {
      console.error('❌ Failed to get case files:', error);
      return [];
    }
  }

  // Search cases
  public async searchCases(query: string, filters: CaseFilters = {}): Promise<CaseItem[]> {
    return this.getCases({
      ...filters,
      search: query,
    });
  }

  // Get recent cases
  public async getRecentCases(limit: number = 10): Promise<CaseItem[]> {
    return this.getCases({
      limit,
      page: 1,
    });
  }

  // Get cases by status
  public async getCasesByStatus(status: CaseItem['status']): Promise<CaseItem[]> {
    return this.getCases({
      status: [status],
    });
  }

  // Get cases by priority
  public async getCasesByPriority(priority: CaseItem['priority']): Promise<CaseItem[]> {
    return this.getCases({
      priority: [priority],
    });
  }

  // Get user's assigned cases
  public async getAssignedCases(username: string): Promise<CaseItem[]> {
    return this.getCases({
      assignedTo: username,
    });
  }
}

// Create singleton instance
export const caseService = new CaseService();

// Helper functions
export function getCasePriorityIcon(priority: CaseItem['priority']): string {
  switch (priority) {
    case 'critical': return '🔴';
    case 'high': return '🟠';
    case 'medium': return '🟡';
    case 'low': return '🟢';
    default: return '⚪';
  }
}

export function formatCaseDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getCaseStatusColor(status: CaseItem['status']): string {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 border-green-200';
    case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'closed': return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'archived': return 'bg-purple-100 text-purple-800 border-purple-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export function getCasePriorityColor(priority: CaseItem['priority']): string {
  switch (priority) {
    case 'critical': return 'text-red-600';
    case 'high': return 'text-orange-600';
    case 'medium': return 'text-blue-600';
    case 'low': return 'text-gray-600';
    default: return 'text-gray-600';
  }
}