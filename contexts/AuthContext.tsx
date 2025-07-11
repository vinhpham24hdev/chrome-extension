// contexts/AuthContext.tsx - Simple Auth Context
import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';
import { authService } from '../services/authService';
import { User } from '../types/auth';
import { logoutFromOkta } from '@/config/okta';
import { useOktaTokenExpiration } from '@/hooks/useOktaTokenExpiration';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: string | null;
  lastLoginTime: number | null;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; timestamp?: number } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: User };

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  error: null,
  lastLoginTime: null,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'LOGIN_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        isLoading: false,
        user: action.payload.user,
        error: null,
        lastLoginTime: action.payload.timestamp || Date.now(),
      };

    case 'LOGIN_FAILURE':
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: action.payload,
        lastLoginTime: null,
      };

    case 'LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        isLoading: false,
        user: null,
        error: null,
        lastLoginTime: null,
      };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    case 'UPDATE_USER':
      return { ...state, user: action.payload };

    default:
      return state;
  }
}

interface AuthContextType {
  state: AuthState;
  login: (credentials: { username: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkConnection: () => Promise<boolean>;
  refreshUser: () => Promise<void>;
  handleSuccessLoginOkta: (user: any) => void;
  handleLogoutOkta: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check auth state function
  const checkAuthState = useCallback(async () => {
    try {
      // Check Chrome storage first
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.local.get(['authState']);
        const authState = result.authState;

        if (authState?.isLoggedIn && authState.currentUser) {
          console.log(
            '✅ Auth found in Chrome storage:',
            authState.currentUser.username
          );
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: {
              user: authState.currentUser,
              timestamp: authState.timestamp,
            },
          });
          return true;
        }
      }

      // Fallback to localStorage
      const stored = localStorage.getItem('authState');
      if (stored) {
        const authState = JSON.parse(stored);
        if (authState?.isLoggedIn && authState.currentUser) {
          console.log(
            '✅ Auth found in localStorage:',
            authState.currentUser.username
          );
          dispatch({
            type: 'LOGIN_SUCCESS',
            payload: {
              user: authState.currentUser,
              timestamp: authState.timestamp,
            },
          });
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      return false;
    }
  }, []);

  // Initialize authentication state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      console.log('🚀 Initializing auth state...');
      dispatch({ type: 'SET_LOADING', payload: true });

      const isAuthenticated = await checkAuthState();

      if (!isAuthenticated) {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initializeAuth();
  }, [checkAuthState]);

  const login = async (credentials: { username: string; password: string }) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'CLEAR_ERROR' });

    try {
      console.log('🔐 Attempting login...');

      const response = await authService.login(credentials);

      if (response.success && response.user && response.token) {
        console.log('✅ Login successful:', response.user.username);

        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: response.user,
            timestamp: Date.now(),
          },
        });
      } else {
        throw new Error(response.error || 'Login failed');
      }
    } catch (error) {
      console.error('❌ Login failed:', error);
      dispatch({
        type: 'LOGIN_FAILURE',
        payload: error instanceof Error ? error.message : 'Login failed',
      });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      dispatch({ type: 'LOGOUT' });
      console.log('🔓 User logged out successfully');
    } catch (error) {
      console.error('Logout failed:', error);
      // Force logout even if API call fails
      dispatch({ type: 'LOGOUT' });
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const checkConnection = async (): Promise<boolean> => {
    try {
      const result = await authService.testConnection();
      return result.connected;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  };

  const refreshUser = async () => {
    try {
      if (!authService.isAuthenticated()) {
        return;
      }

      const user = await authService.getCurrentUserFromAPI();
      if (user) {
        dispatch({ type: 'UPDATE_USER', payload: user });
      } else {
        // If user fetch fails, assume token is invalid
        dispatch({ type: 'LOGOUT' });
      }
    } catch (error) {
      console.error('User refresh failed:', error);
      // Don't logout on refresh failure unless it's an auth error
      if (error instanceof Error && error.message.includes('401')) {
        dispatch({ type: 'LOGOUT' });
      }
    }
  };

  const handleSuccessLoginOkta = (user: User) => {
    dispatch({
      type: 'LOGIN_SUCCESS',
      payload: {
        user,
        timestamp: Date.now(),
      },
    });
  };

  const handleLogoutOkta = async () => {
    try {
      await logoutFromOkta();
      dispatch({ type: 'LOGOUT' });
      console.log('🔓 User logged out successfully');
    } catch (error) {
      console.error(error);
    }
  };

  useOktaTokenExpiration(handleLogoutOkta, Boolean(state.user?.isOktaAuth));

  return (
    <AuthContext.Provider
      value={{
        state,
        login,
        logout,
        clearError,
        checkConnection,
        refreshUser,
        handleSuccessLoginOkta,
        handleLogoutOkta,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
