// types/auth.ts
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

// Additional types for future features
export interface CaseItem {
  id: string;
  title: string;
  description?: string;
  status: "active" | "pending" | "closed";
  createdAt: string;
  updatedAt?: string;
  assignedTo?: string;
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

export interface AuthContextType {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}
