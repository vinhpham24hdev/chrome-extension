import { CaseItem, caseService } from '@/services/caseService';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactQuill, { Quill } from 'react-quill-new';
import { Button } from '@mui/material';
import ImageResize from 'quill-image-resize-module-react';
import { produce } from 'immer';
import { Download } from 'lucide-react';
import { ToastContainer } from './ToastContainer';
import { toast } from 'react-toastify';
import { CustomVideoBlot } from './CustomVideoBlot';

Quill.register('modules/imageResize', ImageResize);

Quill.register(CustomVideoBlot);

type CaseData = {
  caseInfo: CaseItem | null;
  caseFiles: any[];
};

export default function CaseReportApp() {
  const [caseData, setCaseData] = useState<CaseData>({
    caseInfo: null,
    caseFiles: [],
  });
  const quillRef = useRef<ReactQuill>(null);
  const [dropHandlerBound, setDropHandlerBound] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const caseId = urlParams.get('case_id');
  const reportHtml = caseData?.caseInfo?.metadata?.reportHtml || '';

  const loadCaseData = async (caseId: string) => {
    try {
      const [currentCase, files] = await Promise.all([
        caseService.getCaseById(caseId),
        caseService.getCaseFiles(caseId),
      ]);
      setCaseData({ caseInfo: currentCase, caseFiles: files || [] });
    } catch (error) {
      console.error('❌ Failed to load cases:', error);
    }
  };

  const handleSaveReport = async () => {
    if (!caseId || !caseData?.caseInfo) return;
    const newCaseMetaData = { ...(caseData.caseInfo.metadata || {}) };
    try {
      await caseService.updateCaseMetadata(caseId, newCaseMetaData);
      await loadCaseData(caseId);
      toast.success('Report saved !');
    } catch (error) {
      toast.error('Fail to save report');
    }
  };

  useEffect(() => {
    chrome.runtime.onMessage.addListener((message) => {
      console.log({ message });

      if (message.type === 'LOAD_CASE_DATA') {
        setCaseData((prev) =>
          produce(prev, (draft: any) => {
            if (draft?.caseInfo?.metadata?.reportHtml) {
              draft.caseInfo.metadata.reportHtml =
                message.payload.metadata.reportHtml;
            }
          })
        );
      }

      if (message.type === 'SAVE_SCREENSHOT' && caseId) {
        handleSaveReport();
      }
    });
  }, []);

  useEffect(() => {
    if (caseId) loadCaseData(caseId);
  }, [caseId]);

  const handleSelectionChange = () => {
    if (!dropHandlerBound && quillRef.current) {
      const editor = quillRef.current.getEditor();
      const editorRoot = quillRef?.current?.editor?.root;
      if (editor && editorRoot) {
        editorRoot.addEventListener('drop', (e: DragEvent) => {
          e.preventDefault();
          const url = e.dataTransfer?.getData('text/plain');
          const fileType = e.dataTransfer?.getData('captureType');
          if (url) {
            const isVideo = fileType?.includes('video');
            const embedType = isVideo ? 'video' : 'image';
            const range = editor.getSelection(true);
            editor.insertEmbed(range.index, embedType, url);
            editor.setSelection(range.index + 1);

            setTimeout(() => {
              if (embedType === 'image') {
                const img = document.querySelector(
                  `img[src="${url}"]`
                ) as HTMLImageElement;
                if (img) {
                  img.style.maxWidth = '800px';
                  img.style.width = '100%';
                }
              } else if (embedType === 'video') {
                const iframe = document.querySelector(
                  `iframe[src="${url}"]`
                ) as HTMLIFrameElement;
                if (iframe) {
                  iframe.style.maxWidth = '800px';
                  iframe.style.width = '100%';
                }
              }
            }, 100);
          }
        });
        setDropHandlerBound(true);
      }
    }
  };

  if (!caseData?.caseInfo) return <div className="p-4">Loading...</div>;
  return (
    <div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto auto auto',
          alignItems: 'center',
          padding: '0 24px',
          background: '#121E28E5',
          color: 'white',
        }}
      >
        <h3>{caseData.caseInfo.title}</h3>
        <p style={{ color: '#959494', textAlign: 'center' }}>
          Document saved: {caseData.caseInfo.updated_at}
        </p>
        <div
          style={{
            marginLeft: 'auto',
            display: 'flex',
            gap: '12px',
          }}
        >
          <Button
            sx={{ color: 'white', fontSize: '12px' }}
            size="small"
            variant="outlined"
            onClick={handleSaveReport}
          >
            Save
          </Button>
          <Button
            sx={{ color: 'white', fontSize: '12px' }}
            size="small"
            variant="outlined"
            startIcon={<Download />}
          >
            Download
          </Button>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - 45px)',
          overflow: 'auto',
        }}
      >
        <div style={{ flex: 1 }}>
          <ReactQuill
            theme="snow"
            ref={quillRef}
            modules={editorModule}
            formats={editorFormat}
            value={reportHtml}
            onChange={(value) => {
              setCaseData((prev) =>
                produce(prev, (draft: any) => {
                  draft.caseInfo.metadata.reportHtml = value;
                })
              );
            }}
            onChangeSelection={handleSelectionChange}
          />
        </div>

        <aside
          style={{
            overflow: 'auto',
            background: '#5E6974',
            padding: '24px',
            color: 'white',
            width: '400px',
            direction: 'rtl',
          }}
        >
          <div
            className="text-sm font-medium mb-2"
            style={{ direction: 'ltr' }}
          >
            Captured by: <span className="font-light">All</span>
          </div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: '700',
              marginTop: '24px',
              direction: 'ltr',
            }}
          >
            Snapshots and highlights
          </div>
          <div style={{ margin: '12px 0' }}>
            {caseData.caseFiles?.map((f, i) => (
              <div
                key={i}
                style={{
                  marginBottom: '16px',
                  position: 'relative',
                  direction: 'ltr',
                }}
              >
                {f.capture_type === 'video' ? (
                  <>
                    <video
                      width="345"
                      height="240"
                      controls
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', f.file_url);
                        e.dataTransfer.setData('captureType', f.capture_type);
                      }}
                    >
                      <source src={f.file_url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  </>
                ) : (
                  <img
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', f.file_url);
                      e.dataTransfer.setData('fileName', f.file_name);
                      e.dataTransfer.setData('captureType', f.capture_type);
                    }}
                    src={f.file_url}
                    alt={f.file_name}
                    style={{
                      width: '100%',
                      objectFit: 'cover',
                      borderRadius: '4px',
                    }}
                  />
                )}
                <div
                  style={{
                    padding: '4px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    position: 'absolute',
                    bottom: '3px',
                    background: '#00000088',
                    color: 'white',
                    fontWeight: 700,
                  }}
                >
                  {f.file_name}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

const editorModule = {
  toolbar: [
    [{ header: '1' }, { header: '2' }, { font: [] }],
    [{ size: [] }],
    ['bold', 'italic', 'underline', 'strike', 'blockquote'],
    [
      { list: 'ordered' },
      { list: 'bullet' },
      { indent: '-1' },
      { indent: '+1' },
    ],
    ['link', 'image', 'video'],
    ['clean'],
  ],
  clipboard: {
    matchVisual: false,
  },
  imageResize: {
    modules: ['Resize', 'DisplaySize'],
  },
};

const editorFormat = [
  'header',
  'font',
  'size',
  'bold',
  'italic',
  'underline',
  'strike',
  'blockquote',
  'list',
  'bullet',
  'indent',
  'link',
  'image',
  'video',
];

export function initializeCaseReportApp() {
  const init = () => {
    const rootElement = document.getElementById('root');
    if (rootElement) {
      const root = createRoot(rootElement);
      root.render(
        <>
          <ToastContainer />
          <CaseReportApp />
        </>
      );
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
