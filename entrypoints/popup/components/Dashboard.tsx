import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface CaseItem {
  id: string;
  title: string;
  status: "active" | "pending" | "closed";
  createdAt: string;
}

// Mock case data
const mockCases: CaseItem[] = [
  {
    id: "CASE-001",
    title: "Website Bug Investigation",
    status: "active",
    createdAt: "2024-06-10",
  },
  {
    id: "CASE-002",
    title: "Performance Issue Analysis",
    status: "pending",
    createdAt: "2024-06-09",
  },
  {
    id: "CASE-003",
    title: "User Experience Review",
    status: "active",
    createdAt: "2024-06-08",
  },
  {
    id: "CASE-004",
    title: "Security Audit Report",
    status: "closed",
    createdAt: "2024-06-07",
  },
];

export default function Dashboard() {
  const { state, logout } = useAuth();
  const [selectedCase, setSelectedCase] = useState<string>("");
  const [captureMode, setCaptureMode] = useState<"screenshot" | "video" | null>(
    null
  );

  const handleLogout = async () => {
    await logout();
  };

  const handleCaseSelect = (caseId: string) => {
    setSelectedCase(caseId);
  };

  const handleScreenshot = () => {
    setCaptureMode("screenshot");
    // TODO: Implement screenshot capture
    console.log("Screenshot capture initiated for case:", selectedCase);
  };

  const handleVideoCapture = () => {
    setCaptureMode("video");
    // TODO: Implement video capture
    console.log("Video capture initiated for case:", selectedCase);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">📸</div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Screen Capture Tool
                </h1>
                <p className="text-sm text-gray-500">
                  Welcome back, {state.user?.username}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Case Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Select Case
              </h2>

              {/* Case Dropdown */}
              <div className="mb-4">
                <label
                  htmlFor="case-select"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Choose a case to work on:
                </label>
                <select
                  id="case-select"
                  value={selectedCase}
                  onChange={(e) => handleCaseSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select a case...</option>
                  {mockCases.map((case_) => (
                    <option key={case_.id} value={case_.id}>
                      {case_.id} - {case_.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Case List */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">
                  Available Cases:
                </h3>
                {mockCases.map((case_) => (
                  <div
                    key={case_.id}
                    onClick={() => handleCaseSelect(case_.id)}
                    className={`p-3 border rounded-md cursor-pointer transition-colors duration-200 ${
                      selectedCase === case_.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{case_.id}</span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          case_.status
                        )}`}
                      >
                        {case_.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{case_.title}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Created: {case_.createdAt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Capture Tools */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Capture Tools
              </h2>

              {!selectedCase ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎯</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Select a Case First
                  </h3>
                  <p className="text-gray-500">
                    Choose a case from the left panel to enable capture tools.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Selected Case Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <h3 className="font-medium text-blue-900">
                      Working on: {selectedCase}
                    </h3>
                    <p className="text-sm text-blue-700 mt-1">
                      {mockCases.find((c) => c.id === selectedCase)?.title}
                    </p>
                  </div>

                  {/* Capture Options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Screenshot */}
                    <div className="border border-gray-200 rounded-lg p-6 text-center">
                      <div className="text-4xl mb-4">📷</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Screenshot
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Capture full screen or selected region
                      </p>
                      <button
                        onClick={handleScreenshot}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-md transition-colors duration-200"
                      >
                        Take Screenshot
                      </button>
                    </div>

                    {/* Video Recording */}
                    <div className="border border-gray-200 rounded-lg p-6 text-center">
                      <div className="text-4xl mb-4">🎥</div>
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        Video Recording
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Record browser tab or screen activity
                      </p>
                      <button
                        onClick={handleVideoCapture}
                        className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-md transition-colors duration-200"
                      >
                        Start Recording
                      </button>
                    </div>
                  </div>

                  {/* Capture Status */}
                  {captureMode && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                      <div className="flex items-center">
                        <div className="text-yellow-600 mr-3">
                          {captureMode === "screenshot" ? "📷" : "🎥"}
                        </div>
                        <div>
                          <h4 className="font-medium text-yellow-900">
                            {captureMode === "screenshot"
                              ? "Screenshot"
                              : "Video"}{" "}
                            capture initiated
                          </h4>
                          <p className="text-sm text-yellow-700">
                            This will be saved to case: {selectedCase}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Future Features Preview */}
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      Coming Soon:
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-500">
                      <div className="flex items-center">
                        <span className="mr-2">☁️</span>
                        Auto-upload to S3
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">🔍</span>
                        Search captured files
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">📊</span>
                        Generate reports
                      </div>
                      <div className="flex items-center">
                        <span className="mr-2">🏷️</span>
                        Tag and organize
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
