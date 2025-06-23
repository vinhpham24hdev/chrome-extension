// services/authService.ts - Fixed TypeScript Compatibility
import { User, LoginCredentials } from "../types/auth";

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

export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private authToken: string | null = null;
  private isLoggedIn: boolean = false;
  private apiBaseUrl: string;

  private constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    console.log('🔗 AuthService connecting to:', this.apiBaseUrl);
    
    // Load auth state on initialization
    this.loadAuthState();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Real API login with backend
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      console.log('🔐 Attempting login for:', credentials.username);

      const response = await fetch(`${this.apiBaseUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const data: LoginResponse = await response.json();

      if (!response.ok) {
        console.error('❌ Login failed:', data.error || response.statusText);
        return {
          success: false,
          error: data.error || `Login failed: ${response.status}`,
          code: data.code || 'LOGIN_FAILED'
        };
      }

      if (data.success && data.token && data.user) {
        // Store authentication data
        this.authToken = data.token;
        this.currentUser = data.user;
        this.isLoggedIn = true;

        // Save to storage for persistence
        await this.saveAuthState();

        console.log('✅ Login successful for user:', data.user.username);
        return {
          success: true,
          token: data.token,
          user: data.user,
          expiresIn: data.expiresIn
        };
      }

      return {
        success: false,
        error: data.error || 'Invalid response from server',
        code: 'INVALID_RESPONSE'
      };

    } catch (error) {
      console.error('💥 Login network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Logout user and clear session
   */
  async logout(): Promise<void> {
    try {
      // Call logout endpoint if we have a token
      if (this.authToken) {
        await fetch(`${this.apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.warn('⚠️ Logout API call failed:', error);
      // Continue with local logout even if API call fails
    } finally {
      // Clear local state
      this.currentUser = null;
      this.authToken = null;
      this.isLoggedIn = false;

      // Clear from storage
      await this.clearAuthState();
      console.log('🔓 User logged out successfully');
    }
  }

  /**
   * Get current user info from API
   */
  async getCurrentUserFromAPI(): Promise<User | null> {
    if (!this.authToken) {
      return null;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/me`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          await this.clearAuthState();
          return null;
        }
        throw new Error(`Failed to get user info: ${response.status}`);
      }

      const userData: User = await response.json();
      this.currentUser = userData;
      return userData;

    } catch (error) {
      console.error('❌ Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<boolean> {
    if (!this.authToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        await this.clearAuthState();
        return false;
      }

      const data: LoginResponse = await response.json();

      if (data.success && data.token) {
        this.authToken = data.token;
        await this.saveAuthState();
        console.log('🔄 Token refreshed successfully');
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.isLoggedIn && this.authToken !== null && this.currentUser !== null;
  }

  /**
   * Get current user (from memory)
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get auth token
   */
  getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Validate credentials format
   */
  validateCredentials(credentials: LoginCredentials): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!credentials.username || credentials.username.trim().length === 0) {
      errors.push("Username is required");
    }

    if (credentials.username && credentials.username.trim().length < 3) {
      errors.push("Username must be at least 3 characters");
    }

    if (!credentials.password || credentials.password.length === 0) {
      errors.push("Password is required");
    }

    if (credentials.password && credentials.password.length < 3) {
      errors.push("Password must be at least 3 characters");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Make authenticated API request
   */
  async authenticatedRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    if (!this.authToken) {
      return {
        success: false,
        error: 'No authentication token available',
        code: 'NOT_AUTHENTICATED'
      };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Handle 401 - token expired
      if (response.status === 401) {
        console.warn('🔄 Token expired, attempting refresh...');
        const refreshed = await this.refreshToken();
        
        if (refreshed) {
          // Retry request with new token
          return this.authenticatedRequest(endpoint, options);
        } else {
          await this.clearAuthState();
          return {
            success: false,
            error: 'Authentication expired',
            code: 'TOKEN_EXPIRED'
          };
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.error || errorData.message || `HTTP ${response.status}`,
          code: errorData.code || 'API_ERROR'
        };
      }

      const data = await response.json();
      return {
        success: true,
        data
      };

    } catch (error) {
      console.error('❌ Authenticated request failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        code: 'NETWORK_ERROR'
      };
    }
  }

  /**
   * Check API connectivity
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const healthData = await response.json();
        console.log('✅ Backend connected:', healthData);
        return { connected: true };
      } else {
        return { 
          connected: false, 
          error: `Backend health check failed: ${response.status}` 
        };
      }
    } catch (error) {
      return { 
        connected: false, 
        error: `Backend not reachable: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Save auth state to Chrome storage
   */
  private async saveAuthState(): Promise<void> {
    try {
      const authData = {
        isLoggedIn: this.isLoggedIn,
        currentUser: this.currentUser,
        authToken: this.authToken,
        timestamp: Date.now(),
      };

      // Use Chrome extension storage API
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.set({ authState: authData });
      } else {
        // Fallback to localStorage in development
        localStorage.setItem("authState", JSON.stringify(authData));
      }

      console.log('💾 Auth state saved');
    } catch (error) {
      console.error("Failed to save auth state:", error);
    }
  }

  /**
   * Load auth state from Chrome storage
   */
  private async loadAuthState(): Promise<void> {
    try {
      let authData = null;

      if (typeof chrome !== "undefined" && chrome.storage) {
        const result = await chrome.storage.local.get(["authState"]);
        authData = result.authState;
      } else {
        // Fallback to localStorage in development
        const stored = localStorage.getItem("authState");
        if (stored) {
          authData = JSON.parse(stored);
        }
      }

      if (authData && authData.currentUser && authData.authToken) {
        // Check if session is still valid (24 hours)
        const isExpired = Date.now() - authData.timestamp > 24 * 60 * 60 * 1000;

        if (!isExpired) {
          this.currentUser = authData.currentUser;
          this.authToken = authData.authToken;
          this.isLoggedIn = authData.isLoggedIn;

          // Verify token is still valid by getting user info
          const user = await this.getCurrentUserFromAPI();
          if (!user) {
            // Token invalid, clear state
            await this.clearAuthState();
          } else {
            console.log('🔄 Auth state restored for user:', user.username);
          }
        } else {
          // Clear expired session
          await this.clearAuthState();
          console.log('⏰ Expired auth session cleared');
        }
      }
    } catch (error) {
      console.error("Failed to load auth state:", error);
      await this.clearAuthState();
    }
  }

  /**
   * Clear auth state from Chrome storage
   */
  private async clearAuthState(): Promise<void> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.remove(["authState"]);
      } else {
        localStorage.removeItem("authState");
      }
      
      // Clear memory state
      this.currentUser = null;
      this.authToken = null;
      this.isLoggedIn = false;

      console.log('🧹 Auth state cleared');
    } catch (error) {
      console.error("Failed to clear auth state:", error);
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();