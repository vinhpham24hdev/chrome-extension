// services/caseService.ts - Real API with Authentication
import { authService } from './authService';

export interface CaseItem {
  id: string;
  title: string;
  description?: string;
  status: "active" | "pending" | "closed" | "archived";
  priority: "low" | "medium" | "high" | "critical";
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
  priority?: "low" | "medium" | "high" | "critical";
  tags?: string[];
}

export interface UpdateCaseRequest {
  title?: string;
  description?: string;
  status?: "active" | "pending" | "closed" | "archived";
  priority?: "low" | "medium" | "high" | "critical";
  tags?: string[];
}

export interface CaseFilters {
  status?: string[];
  priority?: string[];
  tags?: string[];
  search?: string;
  assignedTo?: string;
  page?: number;
  limit?: number;
  dateRange?: {
    start: string;
    end: string;
  };
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
  recentActivity: CaseItem[];
  totalFiles: number;
  totalFileSize: number;
}

export interface CaseResponse {
  cases?: CaseItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class CaseService {
  private static instance: CaseService;
  private apiBaseUrl: string;
  private mockMode: boolean = false;
  private mockCases: CaseItem[] = [
    {
      id: "CASE-001",
      title: "Website Bug Investigation",
      description: "Investigating critical layout issues on the homepage that affect user experience",
      status: "active",
      priority: "high",
      createdAt: "2024-06-10T09:00:00Z",
      updatedAt: "2024-06-11T14:30:00Z",
      assignedTo: "demo",
      tags: ["bug", "frontend", "ui", "critical"],
      metadata: {
        totalScreenshots: 8,
        totalVideos: 2,
        lastActivity: "2024-06-11T14:30:00Z",
        totalFileSize: 15728640,
      },
    },
    {
      id: "CASE-002",
      title: "Performance Issue Analysis",
      description: "Page loading times are significantly slower than expected, affecting conversion rates",
      status: "pending",
      priority: "medium",
      createdAt: "2024-06-09T10:15:00Z",
      updatedAt: "2024-06-09T16:45:00Z",
      assignedTo: "demo",
      tags: ["performance", "optimization", "backend"],
      metadata: {
        totalScreenshots: 12,
        totalVideos: 1,
        lastActivity: "2024-06-09T16:45:00Z",
        totalFileSize: 28311552,
      },
    },
    // ... other mock cases
  ];

  private constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
  }

  public static getInstance(): CaseService {
    if (!CaseService.instance) {
      CaseService.instance = new CaseService();
    }
    return CaseService.instance;
  }

  /**
   * Initialize service
   */
  async initialize(): Promise<void> {
    if (this.mockMode) {
      await this.loadMockCases();
      console.log('📋 Case Service initialized (Mock Mode)');
    } else {
      console.log('📋 Case Service initialized (Real API Mode)');
    }
  }

  /**
   * Get all cases with optional filtering (Real API)
   */
  async getCases(filters?: CaseFilters): Promise<CaseItem[]> {
    if (this.mockMode) {
      return this.getMockCases(filters);
    }

    try {
      const queryParams = new URLSearchParams();

      // Add filters to query params
      if (filters?.status?.length) {
        queryParams.append("status", filters.status.join(","));
      }
      if (filters?.priority?.length) {
        queryParams.append("priority", filters.priority.join(","));
      }
      if (filters?.search) {
        queryParams.append("search", filters.search);
      }
      if (filters?.assignedTo) {
        queryParams.append("assignedTo", filters.assignedTo);
      }
      if (filters?.tags?.length) {
        queryParams.append("tags", filters.tags.join(","));
      }
      if (filters?.page) {
        queryParams.append("page", filters.page.toString());
      }
      if (filters?.limit) {
        queryParams.append("limit", filters.limit.toString());
      }
      if (filters?.dateRange) {
        queryParams.append("startDate", filters.dateRange.start);
        queryParams.append("endDate", filters.dateRange.end);
      }

      const queryString = queryParams.toString();
      const endpoint = `/cases${queryString ? `?${queryString}` : ''}`;

      const response = await authService.authenticatedRequest<CaseResponse>(endpoint);

      if (!response.success) {
        console.error('❌ Failed to fetch cases:', response.error);
        // Fallback to mock data on API failure
        return this.getMockCases(filters);
      }

      return response.data?.cases || [];

    } catch (error) {
      console.error('💥 Exception fetching cases:', error);
      // Fallback to mock data on exception
      return this.getMockCases(filters);
    }
  }

  /**
   * Get a specific case by ID (Real API)
   */
  async getCaseById(caseId: string): Promise<CaseItem | null> {
    if (this.mockMode) {
      return this.mockCases.find((c) => c.id === caseId) || null;
    }

    try {
      const response = await authService.authenticatedRequest<CaseItem>(`/cases/${caseId}`);

      if (!response.success) {
        console.error('❌ Failed to fetch case:', response.error);
        return this.mockCases.find((c) => c.id === caseId) || null;
      }

      return response.data || null;

    } catch (error) {
      console.error('💥 Exception fetching case:', error);
      return this.mockCases.find((c) => c.id === caseId) || null;
    }
  }

  /**
   * Create a new case (Real API)
   */
  async createCase(caseData: CreateCaseRequest): Promise<CaseItem> {
    if (this.mockMode) {
      const newCase: CaseItem = {
        id: `CASE-${String(this.mockCases.length + 1).padStart(3, "0")}`,
        title: caseData.title,
        description: caseData.description,
        status: "active",
        priority: caseData.priority || "medium",
        createdAt: new Date().toISOString(),
        assignedTo: authService.getCurrentUser()?.username || "demo",
        tags: caseData.tags || [],
        metadata: {
          totalScreenshots: 0,
          totalVideos: 0,
          lastActivity: new Date().toISOString(),
          totalFileSize: 0,
        },
      };

      this.mockCases.unshift(newCase);
      await this.saveMockCases();
      return newCase;
    }

    try {
      const response = await authService.authenticatedRequest<{ case: CaseItem }>(
        '/cases',
        {
          method: 'POST',
          body: JSON.stringify(caseData),
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to create case');
      }

      if (!response.data?.case) {
        throw new Error('Invalid response format');
      }

      console.log('✅ Case created successfully:', response.data.case.id);
      return response.data.case;

    } catch (error) {
      console.error('❌ Failed to create case:', error);
      throw error;
    }
  }

  /**
   * Update an existing case (Real API)
   */
  async updateCase(caseId: string, updates: UpdateCaseRequest): Promise<CaseItem> {
    if (this.mockMode) {
      const caseIndex = this.mockCases.findIndex((c) => c.id === caseId);
      if (caseIndex === -1) {
        throw new Error("Case not found");
      }

      this.mockCases[caseIndex] = {
        ...this.mockCases[caseIndex],
        ...updates,
        updatedAt: new Date().toISOString(),
        metadata: {
          ...this.mockCases[caseIndex].metadata,
          lastActivity: new Date().toISOString(),
        },
      };

      await this.saveMockCases();
      return this.mockCases[caseIndex];
    }

    try {
      const response = await authService.authenticatedRequest<{ case: CaseItem }>(
        `/cases/${caseId}`,
        {
          method: 'PATCH',
          body: JSON.stringify(updates),
        }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to update case');
      }

      if (!response.data?.case) {
        throw new Error('Invalid response format');
      }

      console.log('✅ Case updated successfully:', caseId);
      return response.data.case;

    } catch (error) {
      console.error('❌ Failed to update case:', error);
      throw error;
    }
  }

  /**
   * Delete a case (Real API)
   */
  async deleteCase(caseId: string): Promise<boolean> {
    if (this.mockMode) {
      const initialLength = this.mockCases.length;
      this.mockCases = this.mockCases.filter((c) => c.id !== caseId);
      const deleted = this.mockCases.length < initialLength;

      if (deleted) {
        await this.saveMockCases();
      }

      return deleted;
    }

    try {
      const response = await authService.authenticatedRequest(
        `/cases/${caseId}`,
        { method: 'DELETE' }
      );

      if (response.success) {
        console.log('✅ Case deleted successfully:', caseId);
        return true;
      } else {
        console.error('❌ Failed to delete case:', response.error);
        return false;
      }

    } catch (error) {
      console.error('💥 Exception deleting case:', error);
      return false;
    }
  }

  /**
   * Update case metadata (Real API)
   */
  async updateCaseMetadata(
    caseId: string,
    metadata: Partial<CaseItem["metadata"]>
  ): Promise<boolean> {
    if (this.mockMode) {
      const caseIndex = this.mockCases.findIndex((c) => c.id === caseId);
      if (caseIndex !== -1) {
        this.mockCases[caseIndex].metadata = {
          ...this.mockCases[caseIndex].metadata,
          ...metadata,
          lastActivity: new Date().toISOString(),
        };
        this.mockCases[caseIndex].updatedAt = new Date().toISOString();
        await this.saveMockCases();
        return true;
      }
      return false;
    }

    try {
      const response = await authService.authenticatedRequest(
        `/cases/${caseId}/metadata`,
        {
          method: 'PATCH',
          body: JSON.stringify({ metadata }),
        }
      );

      if (response.success) {
        console.log('✅ Case metadata updated:', caseId);
        return true;
      } else {
        console.error('❌ Failed to update case metadata:', response.error);
        return false;
      }

    } catch (error) {
      console.error('💥 Exception updating case metadata:', error);
      return false;
    }
  }

  /**
   * Get case statistics (Real API)
   */
  async getCaseStats(): Promise<CaseStats> {
    if (this.mockMode) {
      const cases = this.mockCases;
      return this.calculateStatsFromCases(cases);
    }

    try {
      const response = await authService.authenticatedRequest<CaseStats>('/cases/stats');

      if (response.success && response.data) {
        return response.data;
      } else {
        console.warn('⚠️ Failed to get stats from API, calculating from mock data');
        return this.calculateStatsFromCases(this.mockCases);
      }

    } catch (error) {
      console.error('💥 Exception getting case stats:', error);
      return this.calculateStatsFromCases(this.mockCases);
    }
  }

  /**
   * Get available tags (Real API)
   */
  async getAvailableTags(): Promise<string[]> {
    if (this.mockMode) {
      const tagSet = new Set<string>();
      this.mockCases.forEach((case_) => {
        case_.tags?.forEach((tag) => tagSet.add(tag));
      });
      return Array.from(tagSet).sort();
    }

    try {
      const response = await authService.authenticatedRequest<{ tags: string[] }>('/cases/tags');

      if (response.success && response.data?.tags) {
        return response.data.tags;
      } else {
        console.warn('⚠️ Failed to get tags from API, using mock data');
        const tagSet = new Set<string>();
        this.mockCases.forEach((case_) => {
          case_.tags?.forEach((tag) => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
      }

    } catch (error) {
      console.error('💥 Exception getting available tags:', error);
      return [];
    }
  }

  /**
   * Bulk update cases (Real API)
   */
  async bulkUpdateCases(caseIds: string[], updates: UpdateCaseRequest): Promise<boolean> {
    if (this.mockMode) {
      let updated = 0;
      for (const caseId of caseIds) {
        try {
          await this.updateCase(caseId, updates);
          updated++;
        } catch (error) {
          console.error(`Failed to update case ${caseId}:`, error);
        }
      }
      return updated === caseIds.length;
    }

    try {
      const response = await authService.authenticatedRequest(
        '/cases/bulk-update',
        {
          method: 'PATCH',
          body: JSON.stringify({ caseIds, updates }),
        }
      );

      if (response.success) {
        console.log('✅ Bulk update successful');
        return true;
      } else {
        console.error('❌ Bulk update failed:', response.error);
        return false;
      }

    } catch (error) {
      console.error('💥 Exception during bulk update:', error);
      return false;
    }
  }

  /**
   * Export cases to CSV (Real API)
   */
  async exportCases(filters?: CaseFilters): Promise<string> {
    if (this.mockMode) {
      const cases = this.getMockCases(filters);
      return this.generateCSV(cases);
    }

    try {
      const queryParams = new URLSearchParams();
      
      // Add filters for export
      if (filters?.status?.length) {
        queryParams.append("status", filters.status.join(","));
      }
      if (filters?.priority?.length) {
        queryParams.append("priority", filters.priority.join(","));
      }
      if (filters?.search) {
        queryParams.append("search", filters.search);
      }
      if (filters?.assignedTo) {
        queryParams.append("assignedTo", filters.assignedTo);
      }
      if (filters?.tags?.length) {
        queryParams.append("tags", filters.tags.join(","));
      }

      const queryString = queryParams.toString();
      const endpoint = `/cases/export${queryString ? `?${queryString}` : ''}`;

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authService.getAuthToken()}`,
          'Accept': 'text/csv',
        },
      });

      if (response.ok) {
        return await response.text();
      } else {
        console.warn('⚠️ Export API failed, generating CSV from current data');
        const cases = await this.getCases(filters);
        return this.generateCSV(cases);
      }

    } catch (error) {
      console.error('💥 Exception during export:', error);
      const cases = await this.getCases(filters);
      return this.generateCSV(cases);
    }
  }

  /**
   * Private helper methods
   */
  private getMockCases(filters?: CaseFilters): CaseItem[] {
    let filteredCases = [...this.mockCases];

    if (filters?.status?.length) {
      filteredCases = filteredCases.filter((c) =>
        filters.status!.includes(c.status)
      );
    }

    if (filters?.priority?.length) {
      filteredCases = filteredCases.filter((c) =>
        filters.priority!.includes(c.priority)
      );
    }

    if (filters?.assignedTo) {
      filteredCases = filteredCases.filter(
        (c) => c.assignedTo === filters.assignedTo
      );
    }

    if (filters?.search) {
      const query = filters.search.toLowerCase();
      filteredCases = filteredCases.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.description?.toLowerCase().includes(query) ||
          c.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
          c.id.toLowerCase().includes(query)
      );
    }

    if (filters?.tags?.length) {
      filteredCases = filteredCases.filter((c) =>
        c.tags?.some((tag) => filters.tags!.includes(tag))
      );
    }

    if (filters?.dateRange) {
      const startDate = new Date(filters.dateRange.start);
      const endDate = new Date(filters.dateRange.end);
      filteredCases = filteredCases.filter((c) => {
        const caseDate = new Date(c.createdAt);
        return caseDate >= startDate && caseDate <= endDate;
      });
    }

    return filteredCases.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  private calculateStatsFromCases(cases: CaseItem[]): CaseStats {
    return {
      total: cases.length,
      active: cases.filter((c) => c.status === "active").length,
      pending: cases.filter((c) => c.status === "pending").length,
      closed: cases.filter((c) => c.status === "closed").length,
      archived: cases.filter((c) => c.status === "archived").length,
      byPriority: {
        low: cases.filter((c) => c.priority === "low").length,
        medium: cases.filter((c) => c.priority === "medium").length,
        high: cases.filter((c) => c.priority === "high").length,
        critical: cases.filter((c) => c.priority === "critical").length,
      },
      recentActivity: cases
        .filter((c) => c.metadata?.lastActivity)
        .sort(
          (a, b) =>
            new Date(b.metadata!.lastActivity!).getTime() -
            new Date(a.metadata!.lastActivity!).getTime()
        )
        .slice(0, 5),
      totalFiles: cases.reduce(
        (sum, c) =>
          sum +
          (c.metadata?.totalScreenshots || 0) +
          (c.metadata?.totalVideos || 0),
        0
      ),
      totalFileSize: cases.reduce(
        (sum, c) => sum + (c.metadata?.totalFileSize || 0),
        0
      ),
    };
  }

  private generateCSV(cases: CaseItem[]): string {
    const headers = [
      "ID",
      "Title",
      "Status",
      "Priority",
      "Created",
      "Assigned To",
      "Screenshots",
      "Videos",
    ];
    const csvRows = [headers.join(",")];

    cases.forEach((case_) => {
      const row = [
        case_.id,
        `"${case_.title.replace(/"/g, '""')}"`,
        case_.status,
        case_.priority,
        case_.createdAt.split("T")[0],
        case_.assignedTo || "",
        case_.metadata?.totalScreenshots || 0,
        case_.metadata?.totalVideos || 0,
      ];
      csvRows.push(row.join(","));
    });

    return csvRows.join("\n");
  }

  private async saveMockCases(): Promise<void> {
    try {
      const casesData = {
        cases: this.mockCases,
        lastUpdated: new Date().toISOString(),
      };

      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        await chrome.storage.local.set({ mockCases: casesData });
      } else {
        localStorage.setItem("mockCases", JSON.stringify(casesData));
      }
    } catch (error) {
      console.error("Failed to save mock cases:", error);
    }
  }

  private async loadMockCases(): Promise<void> {
    try {
      let casesData = null;

      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        const result = await chrome.storage.local.get(["mockCases"]);
        casesData = result.mockCases;
      } else {
        const stored = localStorage.getItem("mockCases");
        if (stored) {
          casesData = JSON.parse(stored);
        }
      }

      if (casesData && casesData.cases && Array.isArray(casesData.cases)) {
        this.mockCases = casesData.cases;
      }
    } catch (error) {
      console.error("Failed to load mock cases:", error);
    }
  }

  /**
   * Set mock mode
   */
  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
    console.log(`📋 Case Service mock mode: ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Check if running in mock mode
   */
  isMockMode(): boolean {
    return this.mockMode;
  }
}

// Export singleton instance
export const caseService = CaseService.getInstance();