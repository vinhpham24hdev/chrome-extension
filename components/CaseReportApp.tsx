import { CaseItem, caseService } from '@/services/caseService';
import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactQuill, { Quill } from 'react-quill-new';
import { Button } from '@mui/material';
import ImageResize from 'quill-image-resize-module-react';
import { produce } from 'immer';

Quill.register('modules/imageResize', ImageResize);

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
      alert('Saved !');
    } catch (error) {
      alert('Error');
    }
  };

  useEffect(() => {
    chrome.runtime.onMessage.addListener((message) => {
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
          const url = e.dataTransfer?.getData('text/uri-list');
          if (url) {
            const range = editor.getSelection(true);
            editor.insertEmbed(range.index, 'image', url);
            editor.setSelection(range.index + 1);
            setTimeout(() => {
              const img = document.querySelector(
                `img[src="${url}"]`
              ) as HTMLImageElement;
              if (img) {
                img.style.maxWidth = '400px';
                img.style.width = '100%';
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
        }}
      >
        <h1>{caseData.caseInfo.title}</h1>
        <p style={{ color: '#959494' }}>
          Document saved: {caseData.caseInfo.updated_at}
        </p>
        <Button
          sx={{ marginLeft: 'auto' }}
          size="small"
          variant="contained"
          onClick={handleSaveReport}
        >
          Save
        </Button>
      </div>

      <div style={{ display: 'flex' }}>
        <div style={{ padding: '0 12px', flex: 1 }}>
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
            height: 'calc(100vh - 110px)',
            background: '#5E6974',
            padding: '24px',
            color: 'white',
            width: '45%',
          }}
        >
          <div className="text-sm font-medium mb-2">
            Captured by: <span className="font-light">All</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '700' }}>
            Snapshots and highlights
          </div>
          <div style={{ margin: '12px 0' }}>
            {caseData.caseFiles?.map((f, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <img
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', f.file_url);
                    e.dataTransfer.setData('fileName', f.file_name);
                  }}
                  src={f.file_url}
                  alt={f.file_name}
                  style={{
                    width: '100%',
                    objectFit: 'cover',
                    borderRadius: '4px',
                  }}
                />
                <div style={{ padding: '4px', fontSize: '14px' }}>
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
      root.render(<CaseReportApp />);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
