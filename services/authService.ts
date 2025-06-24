// services/authService.ts - Updated with New Tab Login Support
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
  private authCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";
    console.log("🔗 AuthService connecting to:", this.apiBaseUrl);

    // Load auth state on initialization
    this.loadAuthState();

    // Set up message listener for login updates
    this.setupMessageListener();

    // Start auth state polling
    this.startAuthStatePolling();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Setup message listener for login page communication
   */
  private setupMessageListener(): void {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("AuthService received message:", message);

        if (message.type === "LOGIN_SUCCESS") {
          this.handleLoginSuccess(message.data);
          sendResponse({ success: true });
        }

        if (message.type === "LOGIN_PAGE_CLOSING") {
          // Check auth state when login page closes
          setTimeout(() => this.loadAuthState(), 500);
          sendResponse({ success: true });
        }

        if (message.type === "CHECK_AUTH_STATUS") {
          sendResponse({
            isAuthenticated: this.isAuthenticated(),
            user: this.getCurrentUser(),
          });
        }

        return true; // Keep message channel open
      });
    }
  }

  /**
   * Start polling for auth state changes
   */
  private startAuthStatePolling(): void {
    // Poll every 2 seconds for auth state changes
    this.authCheckInterval = setInterval(() => {
      this.loadAuthState();
    }, 2000);
  }

  /**
   * Stop auth state polling
   */
  private stopAuthStatePolling(): void {
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
      this.authCheckInterval = null;
    }
  }

  /**
   * Handle login success from login page
   */
  private handleLoginSuccess(authData: any): void {
    if (authData && authData.authToken && authData.currentUser) {
      this.authToken = authData.authToken;
      this.currentUser = authData.currentUser;
      this.isLoggedIn = authData.isLoggedIn;

      console.log(
        "✅ Login success received from login page:",
        this.currentUser?.username
      );

      // Notify any listeners (like React components)
      this.notifyAuthStateChange();
    }
  }

  /**
   * Notify auth state change (for React components)
   */
  private notifyAuthStateChange(): void {
    // Dispatch custom event for React components to listen to
    window.dispatchEvent(
      new CustomEvent("authStateChanged", {
        detail: {
          isAuthenticated: this.isAuthenticated(),
          user: this.getCurrentUser(),
        },
      })
    );
  }

  /**
   * Open login in new tab instead of handling directly
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      console.log("🔐 Opening login page in new tab...");

      // Test connection first
      const connectionTest = await this.testConnection();
      if (!connectionTest.connected) {
        return {
          success: false,
          error: `Backend not available: ${connectionTest.error}`,
          code: "CONNECTION_ERROR",
        };
      }

      // Open login page in new tab
      const loginUrl = `${this.apiBaseUrl.replace(
        "/api",
        ""
      )}/login?source=extension`;

      if (typeof chrome !== "undefined" && chrome.tabs) {
        chrome.tabs.create({ url: loginUrl });
      } else {
        // Fallback for development
        window.open(loginUrl, "_blank");
      }

      return {
        success: true,
        code: "LOGIN_PAGE_OPENED",
      };
    } catch (error) {
      console.error("💥 Login error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to open login page",
        code: "EXCEPTION_ERROR",
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
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.authToken}`,
            "Content-Type": "application/json",
          },
        });
      }
    } catch (error) {
      console.warn("⚠️ Logout API call failed:", error);
      // Continue with local logout even if API call fails
    } finally {
      // Clear local state
      this.currentUser = null;
      this.authToken = null;
      this.isLoggedIn = false;

      // Clear from storage
      await this.clearAuthState();

      // Notify state change
      this.notifyAuthStateChange();

      console.log("🔓 User logged out successfully");
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
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          "Content-Type": "application/json",
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
      console.error("❌ Failed to get current user:", error);
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
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          "Content-Type": "application/json",
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
        console.log("🔄 Token refreshed successfully");
        return true;
      }

      return false;
    } catch (error) {
      console.error("❌ Token refresh failed:", error);
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return (
      this.isLoggedIn && this.authToken !== null && this.currentUser !== null
    );
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
        error: "No authentication token available",
        code: "NOT_AUTHENTICATED",
      };
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${this.authToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      // Handle 401 - token expired
      if (response.status === 401) {
        console.warn("🔄 Token expired, attempting refresh...");
        const refreshed = await this.refreshToken();

        if (refreshed) {
          // Retry request with new token
          return this.authenticatedRequest(endpoint, options);
        } else {
          await this.clearAuthState();
          return {
            success: false,
            error: "Authentication expired",
            code: "TOKEN_EXPIRED",
          };
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error:
            errorData.error || errorData.message || `HTTP ${response.status}`,
          code: errorData.code || "API_ERROR",
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error("❌ Authenticated request failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
        code: "NETWORK_ERROR",
      };
    }
  }

  /**
   * Check API connectivity
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const healthData = await response.json();
        console.log("✅ Backend connected:", healthData);
        return { connected: true };
      } else {
        return {
          connected: false,
          error: `Backend health check failed: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        connected: false,
        error: `Backend not reachable: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
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

      console.log("💾 Auth state saved");
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
          const wasAuthenticated = this.isAuthenticated();

          this.currentUser = authData.currentUser;
          this.authToken = authData.authToken;
          this.isLoggedIn = authData.isLoggedIn;

          // Only verify token if we weren't authenticated before
          if (!wasAuthenticated) {
            // Verify token is still valid by getting user info
            const user = await this.getCurrentUserFromAPI();
            if (!user) {
              // Token invalid, clear state
              await this.clearAuthState();
            } else {
              console.log("🔄 Auth state restored for user:", user.username);
              this.notifyAuthStateChange();
            }
          }
        } else {
          // Clear expired session
          await this.clearAuthState();
          console.log("⏰ Expired auth session cleared");
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

      // Notify state change
      this.notifyAuthStateChange();

      console.log("🧹 Auth state cleared");
    } catch (error) {
      console.error("Failed to clear auth state:", error);
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.stopAuthStatePolling();
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
