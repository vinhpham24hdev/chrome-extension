// App.tsx
import React from 'react';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import LoginComponent from '../../components/LoginComponent';
import Dashboard from '../../components/Dashboard';

// Main app content component
function AppContent() {
  const { state } = useAuth();

  // Show loading state while checking authentication
  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show dashboard if authenticated, otherwise show login
  return state.isAuthenticated ? <Dashboard /> : <LoginComponent />;
}

// Main App component
function App() {
  return (
    <AuthProvider>
      <div className="min-w-[320px] max-w-full">
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;