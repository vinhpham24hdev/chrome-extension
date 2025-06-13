// services/caseService.ts
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

export class CaseService {
  private static instance: CaseService;
  private apiBaseUrl: string = "https://api.example.com/v1";
  private mockMode: boolean = true; // Set to false when real API is ready
  private mockCases: CaseItem[] = [
    {
      id: "CASE-001",
      title: "Website Bug Investigation",
      description:
        "Investigating critical layout issues on the homepage that affect user experience",
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
        totalFileSize: 15728640, // 15MB
      },
    },
    {
      id: "CASE-002",
      title: "Performance Issue Analysis",
      description:
        "Page loading times are significantly slower than expected, affecting conversion rates",
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
        totalFileSize: 28311552, // 27MB
      },
    },
    {
      id: "CASE-003",
      title: "User Experience Review",
      description:
        "Comprehensive review of user onboarding flow based on customer feedback",
      status: "active",
      priority: "medium",
      createdAt: "2024-06-08T11:20:00Z",
      updatedAt: "2024-06-10T09:15:00Z",
      assignedTo: "demo",
      tags: ["ux", "onboarding", "review", "feedback"],
      metadata: {
        totalScreenshots: 25,
        totalVideos: 5,
        lastActivity: "2024-06-10T09:15:00Z",
        totalFileSize: 52428800, // 50MB
      },
    },
    {
      id: "CASE-004",
      title: "Security Audit Report",
      description:
        "Annual security audit findings and recommendations implementation",
      status: "closed",
      priority: "critical",
      createdAt: "2024-06-07T08:00:00Z",
      updatedAt: "2024-06-08T17:00:00Z",
      assignedTo: "admin",
      tags: ["security", "audit", "compliance", "annual"],
      metadata: {
        totalScreenshots: 35,
        totalVideos: 8,
        lastActivity: "2024-06-08T17:00:00Z",
        totalFileSize: 104857600, // 100MB
      },
    },
    {
      id: "CASE-005",
      title: "Mobile Responsiveness Issues",
      description:
        "Various UI elements not displaying correctly on mobile devices across different screen sizes",
      status: "active",
      priority: "high",
      createdAt: "2024-06-11T13:45:00Z",
      assignedTo: "demo",
      tags: ["mobile", "responsive", "css", "urgent"],
      metadata: {
        totalScreenshots: 6,
        totalVideos: 0,
        lastActivity: "2024-06-11T13:45:00Z",
        totalFileSize: 8388608, // 8MB
      },
    },
    {
      id: "CASE-006",
      title: "Database Optimization",
      description: "Query performance optimization for large datasets",
      status: "pending",
      priority: "low",
      createdAt: "2024-06-06T14:20:00Z",
      assignedTo: "admin",
      tags: ["database", "performance", "backend"],
      metadata: {
        totalScreenshots: 4,
        totalVideos: 1,
        lastActivity: "2024-06-06T16:30:00Z",
        totalFileSize: 5242880, // 5MB
      },
    },
  ];

  private constructor() {}

  public static getInstance(): CaseService {
    if (!CaseService.instance) {
      CaseService.instance = new CaseService();
    }
    return CaseService.instance;
  }

  /**
   * Initialize service and load data
   */
  async initialize(): Promise<void> {
    if (this.mockMode) {
      await this.loadMockCases();
    }
    console.log("Case Service initialized");
  }

  /**
   * Get all cases with optional filtering
   */
  async getCases(filters?: CaseFilters): Promise<CaseItem[]> {
    if (this.mockMode) {
      return this.getMockCases(filters);
    }

    try {
      const queryParams = new URLSearchParams();

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
      if (filters?.dateRange) {
        queryParams.append("startDate", filters.dateRange.start);
        queryParams.append("endDate", filters.dateRange.end);
      }

      const response = await fetch(`${this.apiBaseUrl}/cases?${queryParams}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.cases || [];
    } catch (error) {
      console.error("Failed to fetch cases:", error);
      return this.getMockCases(filters);
    }
  }

  /**
   * Get a specific case by ID
   */
  async getCaseById(caseId: string): Promise<CaseItem | null> {
    if (this.mockMode) {
      return this.mockCases.find((c) => c.id === caseId) || null;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/cases/${caseId}`);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to fetch case:", error);
      return this.mockCases.find((c) => c.id === caseId) || null;
    }
  }

  /**
   * Create a new case
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
        assignedTo: "demo", // In real app, get from current user
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
      const response = await fetch(`${this.apiBaseUrl}/cases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify(caseData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to create case:", error);
      throw error;
    }
  }

  /**
   * Update an existing case
   */
  async updateCase(
    caseId: string,
    updates: UpdateCaseRequest
  ): Promise<CaseItem> {
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
      const response = await fetch(`${this.apiBaseUrl}/cases/${caseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("Failed to update case:", error);
      throw error;
    }
  }

  /**
   * Delete a case
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
      const response = await fetch(`${this.apiBaseUrl}/cases/${caseId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Failed to delete case:", error);
      return false;
    }
  }

  /**
   * Get cases assigned to current user
   */
  async getMyCases(): Promise<CaseItem[]> {
    const currentUser = this.getCurrentUser();
    return this.getCases({ assignedTo: currentUser });
  }

  /**
   * Update case metadata (screenshots/videos count)
   */
  async updateCaseMetadata(
    caseId: string,
    metadata: Partial<CaseItem["metadata"]>
  ): Promise<boolean> {
    try {
      const existingCase = await this.getCaseById(caseId);
      if (!existingCase) {
        return false;
      }

      const updatedMetadata = {
        ...existingCase.metadata,
        ...metadata,
        lastActivity: new Date().toISOString(),
      };

      if (this.mockMode) {
        const caseIndex = this.mockCases.findIndex((c) => c.id === caseId);
        if (caseIndex !== -1) {
          this.mockCases[caseIndex].metadata = updatedMetadata;
          this.mockCases[caseIndex].updatedAt = new Date().toISOString();
          await this.saveMockCases();
          return true;
        }
        return false;
      }

      // Real API call for metadata update
      const response = await fetch(
        `${this.apiBaseUrl}/cases/${caseId}/metadata`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.getAuthToken()}`,
          },
          body: JSON.stringify(updatedMetadata),
        }
      );

      return response.ok;
    } catch (error) {
      console.error("Failed to update case metadata:", error);
      return false;
    }
  }

  /**
   * Search cases by title or description
   */
  async searchCases(query: string): Promise<CaseItem[]> {
    return this.getCases({ search: query });
  }

  /**
   * Get case statistics
   */
  async getCaseStats(): Promise<CaseStats> {
    const cases = await this.getCases();

    const stats: CaseStats = {
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

    return stats;
  }

  /**
   * Get available tags across all cases
   */
  async getAvailableTags(): Promise<string[]> {
    const cases = await this.getCases();
    const tagSet = new Set<string>();

    cases.forEach((case_) => {
      case_.tags?.forEach((tag) => tagSet.add(tag));
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Bulk update cases
   */
  async bulkUpdateCases(
    caseIds: string[],
    updates: UpdateCaseRequest
  ): Promise<boolean> {
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
      const response = await fetch(`${this.apiBaseUrl}/cases/bulk-update`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({ caseIds, updates }),
      });

      return response.ok;
    } catch (error) {
      console.error("Failed to bulk update cases:", error);
      return false;
    }
  }

  /**
   * Export cases to CSV
   */
  async exportCases(filters?: CaseFilters): Promise<string> {
    const cases = await this.getCases(filters);

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

  private getCurrentUser(): string {
    // In real app, get from auth service
    return "demo";
  }

  private getAuthToken(): string {
    // In real app, get from auth service
    return "mock-token";
  }

  /**
   * Set mock mode
   */
  setMockMode(enabled: boolean): void {
    this.mockMode = enabled;
    console.log(`Case Service mock mode: ${enabled ? "enabled" : "disabled"}`);
  }
}

// Export singleton instance
export const caseService = CaseService.getInstance();
