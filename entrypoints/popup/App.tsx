import { useState } from "react";

import LoginComponent from "../../components/LoginComponent";
import "./App.css";

function App() {
  return (
    <div className="min-w-[320px] max-w-[380px] bg-gray-100 p-4">
      <LoginComponent />
    </div>
  );
}

export default App;
