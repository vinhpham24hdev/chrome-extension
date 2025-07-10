// services/authService.ts - Real Authentication Service
import { User, LoginRequest, LoginResponse, LogoutResponse } from '../types/auth';

interface AuthState {
  isLoggedIn: boolean;
  currentUser: User | null;
  token: string | null;
  timestamp: number;
}

interface ConnectionTestResult {
  connected: boolean;
  message?: string;
  status?: number;
}

class AuthService {
  private apiBaseUrl: string;
  private currentToken: string | null = null;
  private currentUser: User | null = null;

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
    this.loadFromStorage();
  }

  // Load auth state from storage
  private async loadFromStorage(): Promise<void> {
    try {
      // Try Chrome storage first
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['authState']);
        if (result.authState) {
          const authState: AuthState = result.authState;
          if (authState.isLoggedIn && authState.token && authState.currentUser) {
            this.currentToken = authState.token;
            this.currentUser = authState.currentUser;
            console.log('✅ Auth state loaded from Chrome storage');
            return;
          }
        }
      }

      // Fallback to localStorage
      const storedState = localStorage.getItem('authState');
      if (storedState) {
        const authState: AuthState = JSON.parse(storedState);
        if (authState.isLoggedIn && authState.token && authState.currentUser) {
          this.currentToken = authState.token;
          this.currentUser = authState.currentUser;
          console.log('✅ Auth state loaded from localStorage');
        }
      }
    } catch (error) {
      console.warn('⚠️ Failed to load auth state:', error);
    }
  }

  // Save auth state to storage
  private async saveToStorage(authState: AuthState): Promise<void> {
    try {
      // Save to Chrome storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.set({ authState });
        console.log('✅ Auth state saved to Chrome storage');
      }

      // Also save to localStorage as backup
      localStorage.setItem('authState', JSON.stringify(authState));
      console.log('✅ Auth state saved to localStorage');
    } catch (error) {
      console.warn('⚠️ Failed to save auth state:', error);
    }
  }

  // Clear auth state from storage
  private async clearStorage(): Promise<void> {
    try {
      // Clear Chrome storage
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.local.remove(['authState']);
        console.log('✅ Auth state cleared from Chrome storage');
      }

      // Clear localStorage
      localStorage.removeItem('authState');
      console.log('✅ Auth state cleared from localStorage');
    } catch (error) {
      console.warn('⚠️ Failed to clear auth state:', error);
    }
  }

  // API request helper
  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.apiBaseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.currentToken) {
      headers['Authorization'] = `Bearer ${this.currentToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 unauthorized - clear auth state
    if (response.status === 401) {
      console.warn('🔓 Unauthorized - clearing auth state');
      await this.clearAuthState();
    }

    return response;
  }

  // Clear current auth state
  private async clearAuthState(): Promise<void> {
    this.currentToken = null;
    this.currentUser = null;
    await this.clearStorage();
  }

  // Login user
  public async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      console.log('🔐 Attempting login for:', credentials.username);

      const response = await this.apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        console.error('❌ Login failed:', error.error);
        return {
          success: false,
          error: error.error || 'Login failed',
        };
      }

      const result: LoginResponse = await response.json();
      
      if (result.success && result.token && result.user) {
        // Store auth state
        this.currentToken = result.token;
        this.currentUser = result.user;

        const authState: AuthState = {
          isLoggedIn: true,
          currentUser: result.user,
          token: result.token,
          timestamp: Date.now(),
        };

        await this.saveToStorage(authState);

        console.log('✅ Login successful:', {
          username: result.user.username,
          role: result.user.role,
          expiresIn: result.expiresIn
        });

        return result;
      } else {
        console.error('❌ Invalid login response:', result);
        return {
          success: false,
          error: result.error || 'Invalid login response',
        };
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error during login',
      };
    }
  }

  // Logout user
  public async logout(): Promise<LogoutResponse> {
    try {
      console.log('🔓 Logging out user');

      // Call backend logout endpoint
      try {
        const response = await this.apiRequest('/auth/logout', {
          method: 'POST',
        });

        if (!response.ok) {
          console.warn('⚠️ Backend logout failed, but continuing with local logout');
        } else {
          console.log('✅ Backend logout successful');
        }
      } catch (error) {
        console.warn('⚠️ Backend logout error, but continuing with local logout:', error);
      }

      // Clear local auth state
      await this.clearAuthState();

      console.log('✅ Local logout completed');

      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      console.error('❌ Logout error:', error);
      
      // Even if logout fails, clear local state
      await this.clearAuthState();
      
      return {
        success: true,
        message: 'Logged out locally',
      };
    }
  }

  // Get current user
  public getCurrentUser(): User | null {
    return this.currentUser;
  }

  // Get current token
  public getCurrentToken(): string | null {
    return this.currentToken;
  }

  // Check if user is authenticated
  public isAuthenticated(): boolean {
    return !!(this.currentToken && this.currentUser);
  }

  // Get current user from API (refresh user data)
  public async getCurrentUserFromAPI(): Promise<User | null> {
    try {
      if (!this.currentToken) {
        return null;
      }

      console.log('👤 Fetching current user from API');

      const response = await this.apiRequest('/auth/me');

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('🔓 Token expired or invalid');
          await this.clearAuthState();
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const user: User = await response.json();
      
      // Update current user
      this.currentUser = user;
      
      // Update storage
      const authState: AuthState = {
        isLoggedIn: true,
        currentUser: user,
        token: this.currentToken,
        timestamp: Date.now(),
      };
      await this.saveToStorage(authState);

      console.log('✅ User data refreshed:', user.username);
      return user;
    } catch (error) {
      console.error('❌ Failed to get current user:', error);
      return null;
    }
  }

  // Refresh token
  public async refreshToken(): Promise<boolean> {
    try {
      if (!this.currentToken) {
        return false;
      }

      console.log('🔄 Refreshing token');

      const response = await this.apiRequest('/auth/refresh', {
        method: 'POST',
      });

      if (!response.ok) {
        console.warn('🔓 Token refresh failed');
        await this.clearAuthState();
        return false;
      }

      const result = await response.json();
      
      if (result.success && result.token) {
        this.currentToken = result.token;
        
        // Update storage
        const authState: AuthState = {
          isLoggedIn: true,
          currentUser: this.currentUser!,
          token: result.token,
          timestamp: Date.now(),
        };
        await this.saveToStorage(authState);

        console.log('✅ Token refreshed successfully');
        return true;
      } else {
        console.warn('🔓 Invalid refresh response');
        await this.clearAuthState();
        return false;
      }
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      await this.clearAuthState();
      return false;
    }
  }

  // Test connection to backend
  public async testConnection(): Promise<ConnectionTestResult> {
    try {
      console.log('🔍 Testing backend connection');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      let response: Response;
      try {
        response = await fetch(`${this.apiBaseUrl}/health`, {
          method: 'GET',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        const health = await response.json();
        console.log('✅ Backend connection successful:', health.status);
        
        return {
          connected: true,
          message: `Backend is ${health.status}`,
          status: response.status,
        };
      } else {
        console.warn('⚠️ Backend responded with error:', response.status);
        
        return {
          connected: false,
          message: `Backend error: ${response.status} ${response.statusText}`,
          status: response.status,
        };
      }
    } catch (error) {
      console.error('❌ Backend connection failed:', error);
      
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  // Check if token is expired (basic check)
  public isTokenExpired(): boolean {
    if (!this.currentToken) {
      return true;
    }

    // Get auth state to check timestamp
    try {
      const storedState = localStorage.getItem('authState');
      if (storedState) {
        const authState: AuthState = JSON.parse(storedState);
        const tokenAge = Date.now() - authState.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        if (tokenAge > maxAge) {
          console.warn('🕐 Token appears to be expired based on age');
          return true;
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not check token expiration:', error);
    }

    return false;
  }

  // Get API base URL
  public getApiBaseUrl(): string {
    return this.apiBaseUrl;
  }

  // Set API base URL (for testing)
  public setApiBaseUrl(url: string): void {
    this.apiBaseUrl = url;
    console.log('🔧 API base URL set to:', url);
  }

  // Validate current session
  public async validateSession(): Promise<boolean> {
    if (!this.isAuthenticated()) {
      return false;
    }

    if (this.isTokenExpired()) {
      console.log('🕐 Token expired, trying to refresh');
      return await this.refreshToken();
    }

    // Test with a simple API call
    try {
      const user = await this.getCurrentUserFromAPI();
      return !!user;
    } catch (error) {
      console.warn('⚠️ Session validation failed:', error);
      return false;
    }
  }
}

// Create singleton instance
export const authService = new AuthService();

// Export helper functions
export function getAuthHeader(): Record<string, string> {
  const token = authService.getCurrentToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function isLoggedIn(): boolean {
  return authService.isAuthenticated();
}

export function getCurrentUser(): User | null {
  return authService.getCurrentUser();
}

export default authService;