import { CaseItem } from '@/services/caseService';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

export default function CaseReportApp() {
  const [caseData, setCaseData] = useState<CaseItem>();

  useEffect(() => {
    injectTailwindCSS();
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'LOAD_CASE_DATA') {
        setCaseData(message.payload);
      }
    });
  }, []);

  if (!caseData) return <div className="p-4">Loading...</div>;
  return (
    <div className="flex h-screen w-screen bg-white text-gray-900 overflow-hidden">
      <div className="flex-1 p-6 overflow-y-auto">
        <h2 className="font-bold text-3xl mb-2 text-center">
          {caseData.title}
        </h2>
        <hr className="border-t-2 bg-red-400 mb-4 w-48" />

        <div className="text-md text-brand-dark">
          <p>HOMICIDE INVESTIGATION SUMMARY REPORT</p>
          <p>Detective in Charge: D. Valer (#3472)</p>
          <p>Case ID: H-2025-0411</p>
          <p>Lisa M. Holloway, Female, 38</p>
          <p>Date of Incident: April 6, 2025</p>
          <p>Location: 317 Pinecrest Drive, Crestwood, NY</p>
          <p>Date of Report: April 12, 2025</p>
        </div>

        <h3 className="mt-6 text-xl font-semibold">Executive Summary</h3>
        <p className="text-md mt-1">
          On April 6, 2025, at approximately 22:41 hours, officers responded to
          a 911 call reporting a disturbance at 317 Pinecrest Drive. Upon
          arrival, they discovered the body of Lisa Holloway lying face down in
          the kitchen with a single stab wound to the left side of the neck. The
          residence showed no signs of forced entry. The victim's estranged
          husband, Brandon Holloway, was later arrested based on collected
          evidence and inconsistencies in his alibi. This report outlines the
          sequence of events, supporting forensic findings, witness statements,
          and investigative conclusions.
        </p>
      </div>

      <aside className="w-80 bg-gray-800 text-white p-4 overflow-y-auto">
        <div className="text-sm font-medium mb-2">
          Captured by: <span className="font-light">All</span>
        </div>
        <div className="text-sm font-semibold mb-3">
          Snapshots and highlights
        </div>

        <div className="space-y-3">
          {caseData?.metadata &&
            caseData?.metadata.files.map((f, i) => (
              <div key={i} className="bg-gray-900 rounded-lg overflow-hidden">
                <img
                  src={f.url}
                  alt={f.fileName}
                  className="w-full object-cover"
                />
                <div className="px-2 py-1 text-sm text-gray-900">
                  {f.fileName} <br />
                  {f.uploadedAt} <br />
                  <span>File size: {f.fileSize}</span>
                </div>
              </div>
            ))}
        </div>
      </aside>
    </div>
  );
}

// Initialize the app function
export function initializeCaseReportApp() {
  const init = () => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const root = createRoot(rootElement);
      root.render(<CaseReportApp />);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

const injectTailwindCSS = () => {
  // Create and inject Tailwind CSS
  const css = `
      /* Tailwind CSS Base */
      .fixed { position: fixed !important; }
      .inset-0 { top: 0 !important; right: 0 !important; bottom: 0 !important; left: 0 !important; }
      .flex { display: flex !important; }
      .flex-1 { flex: 1 1 0% !important; }
      .flex-col { flex-direction: column !important; }
      .items-center { align-items: center !important; }
      .items-start { align-items: flex-start !important; }
      .justify-center { justify-content: center !important; }
      .justify-between { justify-content: space-between !important; }
      .space-x-3 > * + * { margin-left: 0.75rem !important; }
      .space-y-4 > * + * { margin-top: 1rem !important; }
      
      /* Colors */
      .bg-black { background-color: #000 !important; }
      .bg-white { background-color: #fff !important; }
      .bg-gray-50 { background-color: #f9fafb !important; }
      .bg-gray-100 { background-color: #f3f4f6 !important; }
      .bg-gray-200 { background-color: #e5e7eb !important; }
      .bg-blue-50 { background-color: #eff6ff !important; }
      .bg-blue-600 { background-color: #2563eb !important; }
      .bg-blue-700 { background-color: #1d4ed8 !important; }
      .bg-red-50 { background-color: #fef2f2 !important; }
      .bg-green-50 { background-color: #f0fdf4 !important; }
      .bg-opacity-90 { background-color: rgba(0, 0, 0, 0.9) !important; }
      .bg-opacity-50 { background-color: rgba(0, 0, 0, 0.5) !important; }
      
      /* Text */
      .text-white { color: #fff !important; }
      .text-gray-300 { color: #d1d5db !important; }
      .text-gray-700 { color: #374151 !important; }
      .text-gray-900 { color: #111827 !important; }
      .text-blue-700 { color: #1d4ed8 !important; }
      .text-red-400 { color: #f87171 !important; }
      .text-red-700 { color: #b91c1c !important; }
      .text-green-700 { color: #15803d !important; }
      .text-sm { font-size: 0.875rem !important; }
      .text-md { font-size: 1rem !important; }
      .text-lg { font-size: 1.125rem !important; }
      .text-6xl { font-size: 3.75rem !important; }
      .text-center { text-align: center !important; }
      .font-medium { font-weight: 500 !important; }
      .text-brand-dark { color: #121E28 !important; }
      
      /* Spacing */
      .p-1 { padding: 0.25rem !important; }
      .p-2 { padding: 0.5rem !important; }
      .p-4 { padding: 1rem !important; }
      .px-3 { padding-left: 0.75rem !important; padding-right: 0.75rem !important; }
      .px-4 { padding-left: 1rem !important; padding-right: 1rem !important; }
      .px-6 { padding-left: 1.5rem !important; padding-right: 1.5rem !important; }
      .py-2 { padding-top: 0.5rem !important; padding-bottom: 0.5rem !important; }
      .py-3 { padding-top: 0.75rem !important; padding-bottom: 0.75rem !important; }
      .mb-1 { margin-bottom: 0.25rem !important; }
      .mb-2 { margin-bottom: 0.5rem !important; }
      .mb-4 { margin-bottom: 1rem !important; }
      .mb-6 { margin-bottom: 1.5rem !important; }
      .mr-2 { margin-right: 0.5rem !important; }
      .mt-2 { margin-top: 0.5rem !important; }
      
      /* Sizing */
      .w-4 { width: 1rem !important; }
      .w-6 { width: 1.5rem !important; }
      .w-12 { width: 3rem !important; }
      .w-80 { width: 20rem !important; }
      .w-full { width: 100% !important; }
      .h-2 { height: 0.5rem !important; }
      .h-4 { height: 1rem !important; }
      .h-6 { height: 1.5rem !important; }
      .h-12 { height: 3rem !important; }
      .max-w-md { max-width: 28rem !important; }
      .max-w-6xl { max-width: 72rem !important; }
      .max-h-full { max-height: 100% !important; }
      .max-w-full { max-width: 100% !important; }
      
      /* Borders */
      .border { border-width: 1px !important; }
      .border-blue-600 { border-color: #2563eb !important; }
      .border-gray-200 { border-color: #e5e7eb !important; }
      .border-gray-300 { border-color: #d1d5db !important; }
      .border-blue-200 { border-color: #bfdbfe !important; }
      .border-red-200 { border-color: #fecaca !important; }
      .border-green-200 { border-color: #bbf7d0 !important; }
      .border-l { border-left-width: 1px !important; }
      .border-b { border-bottom-width: 1px !important; }
      .border-t { border-top-width: 1px !important; }
      .rounded { border-radius: 0.25rem !important; }
      .rounded-lg { border-radius: 0.5rem !important; }
      .rounded-md { border-radius: 0.375rem !important; }
      .rounded-full { border-radius: 9999px !important; }
      
      /* Effects */
      .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05) !important; }
      .shadow-2xl { box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important; }
      .overflow-hidden { overflow: hidden !important; }
      
      /* Interactions */
      .transition-colors { transition-property: color, background-color, border-color !important; transition-duration: 0.15s !important; }
      .cursor-not-allowed { cursor: not-allowed !important; }
      .hover\\:bg-gray-50:hover { background-color: #f9fafb !important; }
      .hover\\:bg-gray-100:hover { background-color: #f3f4f6 !important; }
      .hover\\:bg-blue-700:hover { background-color: #1d4ed8 !important; }
      .hover\\:text-gray-600:hover { color: #4b5563 !important; }
      .focus\\:outline-none:focus { outline: none !important; }
      .focus\\:ring-1:focus { box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.5) !important; }
      .focus\\:ring-2:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important; }
      .focus\\:ring-blue-500:focus { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important; }
      .focus\\:border-blue-500:focus { border-color: #3b82f6 !important; }
      .disabled\\:opacity-50:disabled { opacity: 0.5 !important; }
      .disabled\\:cursor-not-allowed:disabled { cursor: not-allowed !important; }
      
      /* Animations */
      .animate-spin { animation: spin 1s linear infinite !important; }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      /* Custom animations */
      .fade-in { animation: fadeIn 0.3s ease-in-out !important; }
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .error-shake { animation: shake 0.5s ease-in-out !important; }
      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
      }
      
      .btn-hover-scale:hover { transform: scale(1.02) !important; }
      
      .progress-bar-fill { transition: width 0.3s ease-in-out !important; }
      
      /* Object fit */
      .object-contain { object-fit: contain !important; }
      
      /* Z-index */
      .z-50 { z-index: 50 !important; }
      
      /* Specific styles for screenshot preview */
      .preview-image {
        max-height: calc(90vh - 200px) !important;
      }
      
      /* Form elements */
      input, textarea, select {
        border: 1px solid #d1d5db !important;
        border-radius: 0.375rem !important;
        padding: 0.5rem 0.75rem !important;
        font-size: 0.875rem !important;
        width: 100% !important;
      }
      
      input:focus, textarea:focus, select:focus {
        outline: none !important;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5) !important;
        border-color: #3b82f6 !important;
      }
      
      input:disabled, textarea:disabled, select:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }
      
      /* Button styles */
      button {
        transition: all 0.2s !important;
        font-weight: 500 !important;
      }
      
      button:disabled {
        opacity: 0.5 !important;
        cursor: not-allowed !important;
      }
    `;

  const styleElement = document.createElement('style');
  styleElement.textContent = css;
  document.head.appendChild(styleElement);

  console.log('Tailwind CSS injected into preview window');
};
