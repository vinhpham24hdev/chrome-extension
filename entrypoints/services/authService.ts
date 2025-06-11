import { User, LoginCredentials } from "../components/types/auth";

// services/authService.ts
export class AuthService {
  private static instance: AuthService;
  private currentUser: User | null = null;
  private isLoggedIn: boolean = false;

  // Mock users database
  private mockUsers: Array<{ username: string; password: string; user: User }> =
    [
      {
        username: "demo",
        password: "password",
        user: {
          id: "1",
          username: "demo",
          email: "demo@example.com",
          role: "user",
        },
      },
      {
        username: "admin",
        password: "admin123",
        user: {
          id: "2",
          username: "admin",
          email: "admin@example.com",
          role: "admin",
        },
      },
    ];

  private constructor() {
    // Check if user was previously logged in (from chrome storage)
    this.loadAuthState();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Mock login - simulates API call with delay
   */
  async login(
    credentials: LoginCredentials
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Find user in mock database
      const mockUser = this.mockUsers.find(
        (u) =>
          u.username === credentials.username &&
          u.password === credentials.password
      );

      if (!mockUser) {
        return {
          success: false,
          error: "Invalid username or password",
        };
      }

      // Set authenticated state
      this.currentUser = mockUser.user;
      this.isLoggedIn = true;

      // Save to chrome storage for persistence
      await this.saveAuthState();

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: "Login failed. Please try again.",
      };
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    this.currentUser = null;
    this.isLoggedIn = false;

    // Clear from chrome storage
    await this.clearAuthState();
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.isLoggedIn && this.currentUser !== null;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
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
   * Save auth state to Chrome storage
   */
  private async saveAuthState(): Promise<void> {
    try {
      const authData = {
        isLoggedIn: this.isLoggedIn,
        currentUser: this.currentUser,
        timestamp: Date.now(),
      };

      // Use Chrome extension storage API
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.set({ authState: authData });
      } else {
        // Fallback to localStorage in development
        localStorage.setItem("authState", JSON.stringify(authData));
      }
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

      if (authData && authData.currentUser) {
        // Check if session is still valid (24 hours)
        const isExpired = Date.now() - authData.timestamp > 24 * 60 * 60 * 1000;

        if (!isExpired) {
          this.currentUser = authData.currentUser;
          this.isLoggedIn = authData.isLoggedIn;
        } else {
          // Clear expired session
          await this.clearAuthState();
        }
      }
    } catch (error) {
      console.error("Failed to load auth state:", error);
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
    } catch (error) {
      console.error("Failed to clear auth state:", error);
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
