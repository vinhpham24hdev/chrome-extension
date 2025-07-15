import { CaseItem } from '@/services/caseService';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

export default function CaseReportApp() {
  const [caseData, setCaseData] = useState<CaseItem>();

  useEffect(() => {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'LOAD_CASE_DATA') {
        setCaseData(message.payload);
      }
    });
  }, []);

  if (!caseData) return <div className="p-4">Loading...</div>;
  return (
    <div
      className="flex h-screen w-screen bg-white text-gray-900 overflow-hidden"
      style={{
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        height: '100vh',
      }}
    >
      <div
        style={{
          padding: '16px 32px',
        }}
      >
        <div
          style={{
            background: '#F8FAFB',
            padding: '12px 24px',
          }}
        >
          <h2
            style={{
              fontSize: '30px',
              fontWeight: 'bold',
              textAlign: 'center',
            }}
          >
            {caseData.title}
          </h2>
          <div
            style={{
              height: '3px',
              background: '#f87171',
            }}
          />

          <div
            style={{
              fontSize: '16px',
              color: '#121E28',
              fontWeight: 500,
            }}
          >
            <p
              style={{
                fontSize: '16px',
                fontWeight: 500,
                lineHeight: '1.5',
              }}
            >
              HOMICIDE INVESTIGATION SUMMARY REPORT <br />
              Detective in Charge: D. Valer (#3472) <br />
              Case ID: H-2025-0411 <br />
              Lisa M. Holloway, Female, 38 <br />
              Date of Incident: April 6, 2025 <br />
              Location: 317 Pinecrest Drive, Crestwood, NY <br />
              Date of Report: April 12, 2025
            </p>
          </div>

          <h3
            style={{
              fontSize: '24px',
              fontWeight: 600,
              marginBottom: 0,
            }}
          >
            Executive Summary
          </h3>
          <p
            style={{
              fontSize: '16px',
              lineHeight: '1.5',
              margin: '8px 0',
              padding: 0,
            }}
          >
            On April 6, 2025, at approximately 22:41 hours, officers responded
            to a 911 call reporting a disturbance at 317 Pinecrest Drive. Upon
            arrival, they discovered the body of Lisa Holloway lying face down
            in the kitchen with a single stab wound to the left side of the
            neck. The residence showed no signs of forced entry. The victim's
            estranged husband, Brandon Holloway, was later arrested based on
            collected evidence and inconsistencies in his alibi. This report
            outlines the sequence of events, supporting forensic findings,
            witness statements, and investigative conclusions.
          </p>
        </div>
      </div>

      <aside
        style={{
          overflow: 'auto',
          maxHeight: '100vh',
          background: '#5E6974',
          padding: '24px',
          color: 'white',
        }}
      >
        <div className="text-sm font-medium mb-2">
          Captured by: <span className="font-light">All</span>
        </div>
        <div
          style={{
            fontSize: '20px',
            fontWeight: '700',
          }}
        >
          Snapshots and highlights
        </div>

        <div
          style={{
            margin: '12px 0',
          }}
        >
          {caseData?.metadata &&
            caseData?.metadata.files.map((f, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '8px',
                }}
              >
                <img
                  src={f.url}
                  alt={f.fileName}
                  style={{
                    width: '100%',
                    objectFit: 'cover',
                    borderRadius: '4px',
                  }}
                />
                <div
                  style={{
                    padding: '4px',
                    fontSize: '14px',
                  }}
                >
                  {f.fileName} <br />
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
