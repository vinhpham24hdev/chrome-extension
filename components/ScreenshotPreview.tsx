// components/ScreenshotPreview.tsx - Enhanced with better full page handling and description/sourceUrl
import React, { useState, useEffect, useRef } from "react";
import { isEmpty } from "lodash";
import { s3Service, UploadProgress, UploadResult } from "../services/s3Service";
import { caseService, CaseItem } from "../services/caseService";

export interface ScreenshotData {
  dataUrl: string;
  filename: string;
  timestamp: string;
  type: string;
  caseId: string;
  blob?: Blob;
  sourceUrl?: string;
  region?: string;
  captureInfo?: string;
  metadata?: {
    captureType?: string;
    pageTitle?: string;
    viewportSize?: { width: number; height: number };
  };
}

interface ScreenshotPreviewProps {
  screenshot: ScreenshotData;
  onSave: () => void;
  onDownload: () => void;
  onRetake: () => void;
  onClose: () => void;
  isUploading?: boolean;
}

export default function ScreenshotPreview({
  screenshot,
  onSave,
  onDownload,
  onRetake,
  onClose,
  isUploading = false,
}: ScreenshotPreviewProps) {
  const [formData, setFormData] = useState({
    name: screenshot.filename.replace(/\.[^/.]+$/, ""),
    description: "", 
    url: screenshot.sourceUrl || "",
    selectedCase: screenshot.caseId,
  });

  const [uploadState, setUploadState] = useState<{
    isUploading: boolean;
    progress: UploadProgress | null;
    result: UploadResult | null;
    error: string | null;
  }>({
    isUploading: false,
    progress: null,
    result: null,
    error: null,
  });

  // Real cases from backend
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loadingCases, setLoadingCases] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);

  // Image state and refs
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [isFullPage, setIsFullPage] = useState(false);
  const [viewMode, setViewMode] = useState<"fit" | "actual" | "scroll">("fit");
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCasesFromBackend();
  }, []);

  const loadCasesFromBackend = async () => {
    try {
      setLoadingCases(true);
      setCasesError(null);
      console.log("📁 Loading cases from backend for screenshot preview...");

      const fetchedCases = await caseService.getCases({
        limit: 100,
        page: 1,
      });

      setCases(fetchedCases);
      console.log(
        "✅ Cases loaded for screenshot preview:",
        fetchedCases.length
      );

      if (
        fetchedCases.length > 0 &&
        !fetchedCases.find((c) => c.id === formData.selectedCase)
      ) {
        setFormData((prev) => ({ ...prev, selectedCase: fetchedCases[0].id }));
      }
    } catch (error) {
      console.error("❌ Failed to load cases for screenshot preview:", error);
      setCasesError("Failed to load cases from backend");

      // Fallback to mock cases if backend fails
      const mockCases = [
        {
          id: "Case-120320240830",
          title: "Website Bug Investigation",
          status: "active" as const,
        },
        {
          id: "Case-120320240829",
          title: "Performance Issue Analysis",
          status: "pending" as const,
        },
        {
          id: "Case-120320240828",
          title: "User Experience Review",
          status: "active" as const,
        },
      ];
      setCases(mockCases as CaseItem[]);
    } finally {
      setLoadingCases(false);
    }
  };

  // ✅ ENHANCED: URL detection with better fallbacks and page title
  useEffect(() => {
    const detectCurrentPageInfo = async () => {
      try {
        let detectedUrl = screenshot.sourceUrl;
        let pageTitle = screenshot.metadata?.pageTitle;

        // If no sourceUrl from screenshot, try to detect from various sources
        if (!detectedUrl) {
          // Try Chrome tabs API
          if (typeof chrome !== "undefined" && chrome.tabs) {
            try {
              const tabs = await chrome.tabs.query({
                active: true,
                currentWindow: true,
              });
              if (tabs[0]?.url && !isRestrictedUrl(tabs[0].url)) {
                detectedUrl = tabs[0].url;
                pageTitle = tabs[0].title || pageTitle;
              }
            } catch (error) {
              console.warn("Could not get tab URL:", error);
            }
          }

          // Fallback to window location
          if (
            !detectedUrl &&
            typeof window !== "undefined" &&
            window.location
          ) {
            try {
              const windowUrl = window.location.href;
              if (!isRestrictedUrl(windowUrl)) {
                detectedUrl = windowUrl;
                pageTitle = document.title || pageTitle;
              }
            } catch (error) {
              console.warn("Could not get window location:", error);
            }
          }

          // Try opener window
          if (!detectedUrl) {
            try {
              if (window.opener && !window.opener.closed) {
                const openerUrl = window.opener.location.href;
                if (!isRestrictedUrl(openerUrl)) {
                  detectedUrl = openerUrl;
                  pageTitle = window.opener.document.title || pageTitle;
                }
              }
            } catch (error) {
              console.debug("Cross-origin opener access blocked (expected)");
            }
          }

          // Use referrer as last resort
          if (
            !detectedUrl &&
            document.referrer &&
            !isRestrictedUrl(document.referrer)
          ) {
            detectedUrl = document.referrer;
          }
        }

        // Update form data
        setFormData((prev) => ({
          ...prev,
          url: detectedUrl || "https://cellebrite.com",
          name: pageTitle
            ? `${pageTitle.substring(0, 30)}${
                pageTitle.length > 30 ? "..." : ""
              } - ${prev.name}`
            : prev.name,
        }));

        if (detectedUrl) {
          loadUrlSuggestions(detectedUrl);
        }
      } catch (error) {
        console.error("Error detecting page info:", error);
        setFormData((prev) => ({
          ...prev,
          url: "https://example.com",
        }));
      }
    };

    detectCurrentPageInfo();
  }, [screenshot]);

  const loadUrlSuggestions = async (currentUrl: string) => {
    try {
      const domain = new URL(currentUrl).hostname;
      const { s3Service } = await import("../services/s3Service");

      const searchResults = await s3Service.searchFiles(domain, {
        limit: 5,
      });

      const suggestions = searchResults.results
        .map((file) => file.sourceUrl)
        .filter((url: string) => url && url !== currentUrl)
        .slice(0, 3);

    } catch (error) {
      console.warn("Failed to load URL suggestions:", error);
    }
  };

  const loadDescriptionSuggestions = async (query: string) => {
    if (query.length < 3) return;

    try {
      const { s3Service } = await import("../services/s3Service");

      const searchResults = await s3Service.searchFiles(query, {
        captureType: "screenshot",
        limit: 5,
      });

      const suggestions = searchResults.results
        .map((file) => file.description)
        .filter(
          (desc: string) =>
            desc && desc.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 3);
    } catch (error) {
      console.warn("Failed to load description suggestions:", error);
    }
  };

  // Detect image dimensions and type
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const dimensions = { width: img.width, height: img.height };
      setImageDimensions(dimensions);
      setImageLoaded(true);

      // Detect if this is a full page screenshot (very tall image)
      const aspectRatio = dimensions.height / dimensions.width;
      const isVeryTall = aspectRatio > 3; // More than 3:1 ratio suggests full page
      const isFullPageType =
        screenshot.type?.includes("full") ||
        screenshot.filename?.includes("fullpage") ||
        screenshot.metadata?.captureType === "full-page";

      setIsFullPage(isVeryTall || isFullPageType);

      // Set default view mode based on image type
      if (isVeryTall || isFullPageType) {
        setViewMode("scroll"); // Default to scroll mode for very tall images
      } else {
        setViewMode("fit"); // Default to fit mode for normal images
      }
    };
    img.src = screenshot.dataUrl;
  }, [screenshot]);

  const isRestrictedUrl = (url: string): boolean => {
    const restrictedPatterns = [
      /^chrome:\/\//,
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^about:/,
      /^edge:\/\//,
      /^file:\/\//,
      /^data:/,
      /^javascript:/,
      /^chrome-search:\/\//,
      /^chrome-devtools:\/\//,
    ];

    return restrictedPatterns.some((pattern) => pattern.test(url));
  };

  // Generate unique snapshot ID
  const snapshotId = `Snapshot ${Math.floor(Math.random() * 100000000)}`;

  const handleCloseClick = () => {
    onClose();
  };

  const handleCancelClick = () => {
    onClose();
  };

  const handleAddToCaseClick = async () => {
    if (!formData.name.trim()) {
      alert("Please enter a name for the screenshot");
      return;
    }

    if (!formData.selectedCase) {
      alert("Please select a case");
      return;
    }

    if (uploadState.isUploading) return;

    setUploadState({
      isUploading: true,
      progress: null,
      result: null,
      error: null,
    });

    try {
      let blob = screenshot.blob;
      if ((!blob || isEmpty(blob)) && screenshot.dataUrl) {
        const response = await fetch(screenshot.dataUrl);
        blob = await response.blob();
      }
      if (!blob) {
        return alert("Failed to get screenshot blob");
      }

      console.log("📸 Preparing to upload screenshot...", blob, screenshot);
      const isCustomerTestMode =
        import.meta.env.VITE_CUSTOMER_TEST_MODE === "true";
      const customerBucket = import.meta.env.VITE_CUSTOMER_S3_BUCKET || "";

      if (isCustomerTestMode) {
        console.log("🧪 Using customer bucket for upload...", {
          bucket: customerBucket,
          filename: screenshot.filename,
          caseId: formData.selectedCase,
          size: blob.size,
        });

        const { customerS3Service } = await import(
          "../services/customerS3Service"
        );

        const result = await customerS3Service.uploadFile(
          blob,
          screenshot.filename,
          formData.selectedCase,
          "screenshot",
          {
            onProgress: (progress) => {
              console.log(
                `📤 Customer upload progress: ${progress.percentage}%`
              );
              setUploadState((prev) => ({ ...prev, progress }));
            },
            onSuccess: (result) => {
              console.log("✅ Customer upload successful:", result);
              setUploadState((prev) => ({
                ...prev,
                isUploading: false,
                result,
              }));
            },
            onError: (error) => {
              console.error("❌ Customer upload failed:", error);
              setUploadState((prev) => ({
                ...prev,
                isUploading: false,
                error,
              }));
            },
            metadata: {
              capturedAt: screenshot.timestamp,
              originalFilename: screenshot.filename,
              description: formData.description,
              sourceUrl: formData.url,
              captureType: screenshot.type,
              caseName: formData.name,
              imageDimensions: imageDimensions,
              isFullPage: isFullPage,
              testMode: "customer-bucket",
              pageTitle: screenshot.metadata?.pageTitle,
              viewportSize: screenshot.metadata?.viewportSize,
            },
            // ✅ NEW: Pass description and sourceUrl to upload
            description: formData.description.trim() || undefined,
            sourceUrl: formData.url.trim() || undefined,
          }
        );

        if (result.success) {
          console.log(
            "🎉 Screenshot uploaded to customer bucket successfully!"
          );
          alert(
            `✅ Customer Bucket Test Successful!\n\n` +
              `File: ${result.fileName}\n` +
              `Bucket: ${customerBucket}\n` +
              `Key: ${result.fileKey}\n` +
              `Size: ${(result.fileSize! / 1024).toFixed(1)} KB\n` +
              `URL: ${result.fileUrl}`
          );
          onSave();
        } else {
          throw new Error(result.error || "Customer bucket upload failed");
        }
      } else {
        console.log("🚀 Using backend S3 service...", {
          filename: screenshot.filename,
          caseId: formData.selectedCase,
          size: blob.size,
          screenshotType: screenshot.type,
        });

        // ✅ UPDATED: Backend S3 upload with description and sourceUrl
        const result = await s3Service.uploadFile(
          blob,
          screenshot.filename,
          formData.selectedCase,
          "screenshot",
          {
            onProgress: (progress) => {
              console.log(
                `📤 Backend upload progress: ${progress.percentage}%`
              );
              setUploadState((prev) => ({ ...prev, progress }));
            },
            onSuccess: (result) => {
              console.log("✅ Backend upload successful:", result);
              setUploadState((prev) => ({
                ...prev,
                isUploading: false,
                result,
              }));
            },
            onError: (error) => {
              console.error("❌ Backend upload failed:", error);
              setUploadState((prev) => ({
                ...prev,
                isUploading: false,
                error,
              }));
            },
            tags: ["screenshot", "capture", formData.name],
            metadata: {
              capturedAt: screenshot.timestamp,
              originalFilename: screenshot.filename,
              description: formData.description,
              sourceUrl: formData.url,
              captureType: screenshot.type,
              caseName: formData.name,
              imageDimensions: imageDimensions,
              isFullPage: isFullPage,
              pageTitle: screenshot.metadata?.pageTitle,
              viewportSize: screenshot.metadata?.viewportSize,
            },
            description: formData.description.trim() || undefined,
            sourceUrl: formData.url.trim() || undefined,
          }
        );

        if (result.success) {
          console.log("🎉 Screenshot uploaded to backend S3 successfully!");

          // Update case metadata via real backend API
          try {
            const caseData = await caseService.getCaseById(
              formData.selectedCase
            );
            if (caseData && caseData.metadata) {
              await caseService.updateCaseMetadata(formData.selectedCase, {
                totalScreenshots: (caseData.metadata.totalScreenshots || 0) + 1,
                totalFileSize:
                  (caseData.metadata.totalFileSize || 0) + blob.size,
                lastActivity: new Date().toISOString(),
              });
              console.log("✅ Case metadata updated successfully");
            }
          } catch (metadataError) {
            console.error("❌ Failed to update case metadata:", metadataError);
          }

          // Show success message
          const selectedCaseName =
            cases.find((c) => c.id === formData.selectedCase)?.title ||
            formData.selectedCase;
          alert(
            `Screenshot "${formData.name}" added to case "${selectedCaseName}" successfully!`
          );

          onSave();
        } else {
          throw new Error(result.error || "Backend upload failed");
        }
      }
    } catch (error) {
      console.error("❌ Upload process failed:", error);
      setUploadState((prev) => ({
        ...prev,
        isUploading: false,
        error: error instanceof Error ? error.message : "Upload failed",
      }));
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, name: e.target.value }));
  };

  // ✅ NEW: Enhanced description change with suggestions
  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, description: value }));
  };

  // ✅ NEW: Enhanced URL change with suggestions
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, url: value }));
  };

  const handleCaseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData((prev) => ({ ...prev, selectedCase: e.target.value }));
  };

  const handleViewModeChange = (mode: "fit" | "actual" | "scroll") => {
    setViewMode(mode);
  };

  // Get image style based on view mode
  const getImageStyle = () => {
    if (!imageLoaded) return {};

    switch (viewMode) {
      case "fit":
        return {
          maxWidth: "100%",
          maxHeight: "70vh",
          objectFit: "contain" as const,
          width: "auto",
          height: "auto",
        };
      case "actual":
        return {
          width: "auto",
          height: "auto",
          maxWidth: "none",
          maxHeight: "none",
        };
      case "scroll":
        return {
          width: "100%",
          height: "auto",
          maxWidth: "100%",
        };
      default:
        return {};
    }
  };

  // Get container style based on view mode
  const getContainerStyle = () => {
    switch (viewMode) {
      case "scroll":
        return {
          maxHeight: "calc(90vh - 200px)",
          overflowY: "auto" as const,
          overflowX: "hidden" as const,
        };
      case "actual":
        return {
          maxHeight: "calc(90vh - 200px)",
          overflow: "auto" as const,
        };
      default:
        return {};
    }
  };

  // Helper to get case status color
  const getCaseStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "closed":
        return "bg-gray-100 text-gray-800";
      case "archived":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-7xl w-full max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-medium text-gray-900">{snapshotId}</h2>

            {/* Image Type Badge */}
            {isFullPage && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                📄 Full Page
              </span>
            )}

            {/* Image Dimensions */}
            {imageLoaded && (
              <span className="text-sm text-gray-500">
                {imageDimensions.width} × {imageDimensions.height}px
              </span>
            )}

            {/* ✅ NEW: Page Title Badge */}
            {screenshot.metadata?.pageTitle && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                📰 {screenshot.metadata.pageTitle.substring(0, 20)}...
              </span>
            )}

            {/* Backend Connection Status */}
            {casesError && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                ⚠️ Backend Error
              </span>
            )}
          </div>

          <button
            onClick={handleCloseClick}
            disabled={uploadState.isUploading}
            className="flex items-center text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Upload Progress */}
        {uploadState.isUploading && uploadState.progress && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-blue-700 font-medium">
                Uploading to S3... {uploadState.progress.percentage}%
              </span>
              {uploadState.progress.speed && (
                <span className="text-blue-600">
                  {Math.round(uploadState.progress.speed / 1024)} KB/s
                </span>
              )}
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadState.progress.percentage}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {uploadState.result && (
          <div className="px-4 py-3 bg-green-50 border-b border-green-200">
            <div className="flex items-center text-sm text-green-700">
              <svg
                className="w-4 h-4 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium">Successfully uploaded to S3</span>
            </div>
          </div>
        )}

        {uploadState.error && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-200">
            <div className="flex items-center text-sm text-red-700">
              <svg
                className="w-4 h-4 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Upload failed: {uploadState.error}</span>
            </div>
          </div>
        )}

        {/* Backend Error Message */}
        {casesError && (
          <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
            <div className="flex items-center text-sm text-orange-700">
              <svg
                className="w-4 h-4 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Backend connection issue: {casesError}</span>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Side - Screenshot with Enhanced Preview */}
          <div className="flex-1 flex flex-col bg-gray-100">
            {/* Image Container */}
            <div
              className="flex-1 flex items-center justify-center p-4"
              style={getContainerStyle()}
            >
              <div
                ref={containerRef}
                className="max-w-full max-h-full flex items-start justify-center"
              >
                {!imageLoaded && (
                  <div className="flex items-center space-x-3 text-gray-500">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                    <span>Loading image...</span>
                  </div>
                )}

                <img
                  ref={imageRef}
                  src={screenshot.dataUrl}
                  alt="Screenshot preview"
                  className={`${
                    !imageLoaded ? "hidden" : ""
                  } border border-gray-300 bg-white shadow-sm ${
                    viewMode === "scroll" ? "rounded-none" : "rounded"
                  }`}
                  style={getImageStyle()}
                  onLoad={() => setImageLoaded(true)}
                />
              </div>
            </div>
          </div>

          {/* Right Side - Details Form */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
            {/* Details Header */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Details</h3>
              {isFullPage && (
                <p className="text-sm text-blue-600 mt-1">
                  📄 This appears to be a full page screenshot
                </p>
              )}
            </div>

            {/* Form */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {/* Name Field */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={handleNameChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter name"
                  disabled={uploadState.isUploading}
                />
              </div>

              {/* ✅ ENHANCED: Description Field with suggestions */}
              <div className="relative">
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={handleDescriptionChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={uploadState.isUploading}
                />
              </div>

              {/* ✅ ENHANCED: URL Field with auto-detection and suggestions */}
              <div className="relative">
                <label
                  htmlFor="url"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Source URL
                  {formData.url && !isRestrictedUrl(formData.url) && (
                    <span className="ml-2 text-xs text-green-600">
                      ✓ Auto-detected
                    </span>
                  )}
                  {formData.url && isRestrictedUrl(formData.url) && (
                    <span className="ml-2 text-xs text-orange-600">
                      ⚠ Restricted page
                    </span>
                  )}
                </label>
                <input
                  type="url"
                  id="url"
                  value={formData.url}
                  onChange={handleUrlChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://cellebrite.com"
                  disabled={uploadState.isUploading}
                />
                {formData.url && isRestrictedUrl(formData.url) && (
                  <p className="mt-1 text-xs text-orange-600">
                    Browser internal page - URL auto-detection limited
                  </p>
                )}
              </div>

              {/* Real Cases Dropdown */}
              <div>
                <label
                  htmlFor="case"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Case
                  {loadingCases && (
                    <span className="ml-2 text-xs text-blue-600">
                      Loading...
                    </span>
                  )}
                  {casesError && (
                    <span className="ml-2 text-xs text-red-600">
                      Error loading cases
                    </span>
                  )}
                </label>
                <select
                  id="case"
                  value={formData.selectedCase}
                  onChange={handleCaseChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  disabled={uploadState.isUploading || loadingCases}
                >
                  {loadingCases ? (
                    <option value="">Loading cases...</option>
                  ) : cases.length === 0 ? (
                    <option value="">No cases available</option>
                  ) : (
                    cases.map((case_) => (
                      <option key={case_.id} value={case_.id}>
                        {case_.id} - {case_.title}
                      </option>
                    ))
                  )}
                </select>

                {/* Show selected case info */}
                {formData.selectedCase && cases.length > 0 && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                    {(() => {
                      const selectedCase = cases.find(
                        (c) => c.id === formData.selectedCase
                      );
                      if (selectedCase) {
                        return (
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {selectedCase.title}
                            </span>
                            <span
                              className={`px-2 py-1 rounded text-xs ${getCaseStatusColor(
                                selectedCase.status
                              )}`}
                            >
                              {selectedCase.status}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>

              {/* ✅ ENHANCED: Image Info with metadata */}
              {imageLoaded && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Image Info
                  </h4>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div>
                      Size: {imageDimensions.width} × {imageDimensions.height}px
                    </div>
                    <div>Type: {screenshot.type}</div>
                    {screenshot.metadata?.captureType && (
                      <div>Capture: {screenshot.metadata.captureType}</div>
                    )}
                    {screenshot.metadata?.viewportSize && (
                      <div>
                        Viewport: {screenshot.metadata.viewportSize.width} ×{" "}
                        {screenshot.metadata.viewportSize.height}px
                      </div>
                    )}
                    {isFullPage && (
                      <div className="text-blue-600 font-medium">
                        📄 Full page capture detected
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-gray-200 flex space-x-3">
              <button
                onClick={handleCancelClick}
                disabled={uploadState.isUploading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-md text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleAddToCaseClick}
                disabled={!formData.name.trim() || uploadState.isUploading}
                className="flex-1 px-4 py-2 bg-blue-600 border-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {uploadState.isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Adding...
                  </>
                ) : uploadState.result ? (
                  <>
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Added
                  </>
                ) : (
                  "Add to case"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
