export interface User {
  id: string;
  username: string;
  email?: string;
  role?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// Case management types (moved from types/auth.ts for better organization)
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

export interface CaptureItem {
  id: string;
  caseId: string;
  type: "screenshot" | "video";
  filename: string;
  url?: string;
  timestamp: string;
  fileSize?: number;
}