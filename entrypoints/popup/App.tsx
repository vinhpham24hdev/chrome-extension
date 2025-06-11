import { AuthProvider } from "./contexts/AuthContext";
import LoginComponent from "./components/LoginComponent";

function App() {
  return (
    <AuthProvider>
      <div className="min-w-[320px] max-w-[380px] bg-gray-100 p-4">
        <LoginComponent />
      </div>
    </AuthProvider>
  );
}

export default App;
