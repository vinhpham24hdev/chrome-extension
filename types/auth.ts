// types/auth.ts - Complete TypeScript Definitions
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
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshToken: () => Promise<boolean>;
  checkConnection: () => Promise<boolean>;
  getAuthToken: () => string | null;
  makeAuthenticatedRequest: <T>(
    endpoint: string,
    options?: RequestInit
  ) => Promise<ApiResponse<T>>;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  expiresIn?: string;
  error?: string;
  code?: string;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
}

export interface ConnectionTestResult {
  connected: boolean;
  error?: string;
}

// Case management types
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

export interface CaptureItem {
  id: string;
  caseId: string;
  type: "screenshot" | "video";
  filename: string;
  url?: string;
  timestamp: string;
  fileSize?: number;
}

// Service error types
export interface ServiceError {
  code: string;
  message: string;
  statusCode?: number;
  retryable?: boolean;
}

// Auth validation result
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Token payload (for JWT decoding if needed)
export interface TokenPayload {
  id: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}

// Storage data structure
export interface StoredAuthData {
  isLoggedIn: boolean;
  currentUser: User | null;
  authToken: string | null;
  timestamp: number;
}

// Service initialization result
export interface ServiceInitResult {
  success: boolean;
  error?: string;
}

// Export all types for convenience
export type AuthError =
  | "NETWORK_ERROR"
  | "VALIDATION_ERROR"
  | "LOGIN_FAILED"
  | "TOKEN_EXPIRED"
  | "NOT_AUTHENTICATED"
  | "CONNECTION_ERROR"
  | "INVALID_RESPONSE"
  | "EXCEPTION_ERROR";
