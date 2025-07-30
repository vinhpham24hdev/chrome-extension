// components/CaseReportApp.tsx - ENHANCED với private S3 image support
import { CaseItem, caseService } from '@/services/caseService';
import { useEffect, useRef, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import ReactQuill, { Quill } from 'react-quill-new';
import { Button } from '@mui/material';
import ImageResize from 'quill-image-resize-module-react';
import { produce } from 'immer';
import { Download, RefreshCw } from 'lucide-react';
import { ToastContainer } from './ToastContainer';
import { toast } from 'react-toastify';
import { CustomVideoBlot } from './CustomVideoBlot';
import { reportImageService } from '@/services/reportImageService';

Quill.register('modules/imageResize', ImageResize);
Quill.register('formats/video', CustomVideoBlot);

type CaseData = {
  caseInfo: CaseItem | null;
  caseFiles: any[];
};

export default function CaseReportApp() {
  const [caseData, setCaseData] = useState<CaseData>({
    caseInfo: null,
    caseFiles: [],
  });
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  const [imageUrls, setImageUrls] = useState<Map<string, string>>(new Map());
  const quillRef = useRef<ReactQuill>(null);
  const [dropHandlerBound, setDropHandlerBound] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const caseId = urlParams.get('case_id');
  const reportHtml = caseData?.caseInfo?.metadata?.reportHtml || '';

  // 🔥 NEW: Load case data và prepare images
  const loadCaseData = async (caseId: string) => {
    try {
      setIsLoadingImages(true);
      
      const [currentCase, files] = await Promise.all([
        caseService.getCaseById(caseId),
        caseService.getCaseFiles(caseId),
      ]);
      
      setCaseData({ caseInfo: currentCase, caseFiles: files || [] });

      // 🔥 NEW: Prepare image URLs for sidebar files
      if (files && files.length > 0) {
        const imageFileKeys = files
          .filter((f: any) => f.capture_type === 'screenshot' && f.file_key)
          .map((f: any) => f.file_key);

        if (imageFileKeys.length > 0) {
          console.log("🖼️ Loading display URLs for", imageFileKeys.length, "images");
          const urlMap = await reportImageService.batchLoadImages(imageFileKeys);
          setImageUrls(urlMap);
        }
      }

      // 🔥 NEW: Preload images từ report HTML
      if (currentCase?.metadata?.reportHtml) {
        await reportImageService.preloadReportImages(currentCase.metadata.reportHtml);
      }

    } catch (error) {
      console.error('❌ Failed to load cases:', error);
      toast.error('Failed to load case data');
    } finally {
      setIsLoadingImages(false);
    }
  };

  // 🔥 NEW: Refresh image URLs khi hết hạn
  const refreshImageUrls = useCallback(async () => {
    if (!caseData.caseFiles || caseData.caseFiles.length === 0) return;

    try {
      setIsLoadingImages(true);
      toast.info('Refreshing image URLs...');

      const imageFileKeys = caseData.caseFiles
        .filter((f: any) => f.capture_type === 'screenshot' && f.file_key)
        .map((f: any) => f.file_key);

      if (imageFileKeys.length > 0) {
        await reportImageService.refreshImageUrls(imageFileKeys);
        const urlMap = await reportImageService.batchLoadImages(imageFileKeys);
        setImageUrls(urlMap);
      }

      // Refresh images trong report HTML
      if (reportHtml) {
        await reportImageService.preloadReportImages(reportHtml);
      }

      toast.success('Image URLs refreshed!');
    } catch (error) {
      console.error('❌ Failed to refresh image URLs:', error);
      toast.error('Failed to refresh images');
    } finally {
      setIsLoadingImages(false);
    }
  }, [caseData.caseFiles, reportHtml]);

  // 🔥 NEW: Get display URL cho file
  const getFileDisplayUrl = useCallback(async (file: any): Promise<string> => {
    if (file.capture_type === 'video') {
      // Video files use direct URL (assume they work)
      return file.file_url;
    }

    // For images, check if we have a cached display URL
    const cachedUrl = imageUrls.get(file.file_key);
    if (cachedUrl) {
      // Check if URL is still valid
      const cached = reportImageService.getCachedImageData(file.file_key);
      if (cached && new Date(cached.expiresAt) > new Date()) {
        return cachedUrl;
      }
    }

    // Generate new display URL
    try {
      const displayUrl = await reportImageService.getImageDisplayUrl(file.file_key);
      
      // Update state với URL mới
      setImageUrls(prev => new Map(prev).set(file.file_key, displayUrl));
      
      return displayUrl;
    } catch (error) {
      console.error('❌ Failed to get display URL for:', file.file_key);
      // Fallback to proxy URL
      return reportImageService.getProxyImageUrl(file.file_key);
    }
  }, [imageUrls]);

  const handleSaveReport = async () => {
    if (!caseId || !caseData?.caseInfo) return;
    const newCaseMetaData = { ...(caseData.caseInfo.metadata || {}) };
    try {
      await caseService.updateCaseMetadata(caseId, newCaseMetaData);
      await loadCaseData(caseId);
      toast.success('Report saved!');
    } catch (error) {
      toast.error('Failed to save report');
    }
  };

  // 🔥 ENHANCED: Handle drag start với dynamic URL generation
  const handleImageDragStart = useCallback(async (e: React.DragEvent, file: any) => {
    try {
      const displayUrl = await getFileDisplayUrl(file);
      
      e.dataTransfer.setData('text/plain', displayUrl);
      e.dataTransfer.setData('fileName', file.file_name);
      e.dataTransfer.setData('captureType', file.capture_type);
      e.dataTransfer.setData('fileKey', file.file_key);
      
      console.log('🎯 Drag started with display URL:', displayUrl);
    } catch (error) {
      console.error('❌ Failed to prepare drag data:', error);
      // Fallback to original URL
      e.dataTransfer.setData('text/plain', file.file_url);
      e.dataTransfer.setData('fileName', file.file_name);
      e.dataTransfer.setData('captureType', file.capture_type);
    }
  }, [getFileDisplayUrl]);

  // 🔥 ENHANCED: Handle drop với URL validation
  const handleSelectionChange = () => {
    if (!dropHandlerBound && quillRef.current) {
      const editor = quillRef.current.getEditor();
      const editorRoot = quillRef?.current?.editor?.root;
      if (editor && editorRoot) {
        editorRoot.addEventListener('drop', async (e: DragEvent) => {
          e.preventDefault();
          
          const url = e.dataTransfer?.getData('text/plain');
          const fileType = e.dataTransfer?.getData('captureType');
          const fileKey = e.dataTransfer?.getData('fileKey');
          
          if (url) {
            console.log('🎯 Dropped URL:', url, 'Type:', fileType);
            
            // 🔥 NEW: Validate/refresh URL trước khi insert
            let finalUrl = url;
            if (fileKey && fileType === 'screenshot') {
              try {
                // Check if URL is still valid
                if (reportImageService.isImageUrlExpired(fileKey)) {
                  console.log('🔄 URL expired, generating new one...');
                  finalUrl = await reportImageService.getImageDisplayUrl(fileKey);
                  toast.info('Image URL refreshed');
                }
              } catch (error) {
                console.warn('⚠️ Failed to validate URL, using original');
              }
            }

            const isVideo = fileType?.includes('video');
            const embedType = isVideo ? 'video' : 'image';
            const range = editor.getSelection(true);
            
            editor.insertEmbed(range.index, embedType, finalUrl);
            editor.setSelection(range.index + 1);

            setTimeout(() => {
              if (embedType === 'image') {
                const img = document.querySelector(
                  `img[src="${finalUrl}"]`
                ) as HTMLImageElement;
                if (img) {
                  img.style.maxWidth = '800px';
                  img.style.width = '100%';
                  
                  // 🔥 NEW: Add error handler to refresh URL if image fails to load
                  img.onerror = async () => {
                    if (fileKey) {
                      try {
                        console.log('🔄 Image failed to load, refreshing URL...');
                        const newUrl = await reportImageService.getImageDisplayUrl(fileKey);
                        img.src = newUrl;
                        toast.info('Image URL refreshed automatically');
                      } catch (error) {
                        console.error('❌ Failed to refresh failed image URL:', error);
                        toast.error('Image failed to load');
                      }
                    }
                  };
                }
              } else if (embedType === 'video') {
                const iframe = document.querySelector(
                  `iframe[src="${finalUrl}"]`
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

  // 🔥 NEW: Auto-refresh URLs every 30 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🕐 Auto-refreshing image URLs...');
      refreshImageUrls();
    }, 30 * 60 * 1000); // 30 minutes

    return () => clearInterval(interval);
  }, [refreshImageUrls]);

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
          {/* 🔥 NEW: Refresh button cho images */}
          <Button
            sx={{ color: 'white', fontSize: '12px' }}
            size="small"
            variant="outlined"
            onClick={refreshImageUrls}
            disabled={isLoadingImages}
            startIcon={<RefreshCw className={isLoadingImages ? 'animate-spin' : ''} />}
          >
            {isLoadingImages ? 'Refreshing...' : 'Refresh Images'}
          </Button>
          
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
            {isLoadingImages && (
              <span className="ml-2 text-yellow-300">🔄 Loading images...</span>
            )}
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
                      onDragStart={(e) => handleImageDragStart(e, f)}
                    >
                      <source src={f.file_url} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                  </>
                ) : (
                  <img
                    draggable
                    onDragStart={(e) => handleImageDragStart(e, f)}
                    src={imageUrls.get(f.file_key) || reportImageService.getProxyImageUrl(f.file_key)}
                    alt={f.file_name}
                    style={{
                      width: '100%',
                      objectFit: 'cover',
                      borderRadius: '4px',
                    }}
                    onError={async (e) => {
                      // 🔥 NEW: Auto-retry với fresh URL khi ảnh fail
                      const img = e.target as HTMLImageElement;
                      if (f.file_key && !img.dataset.retried) {
                        img.dataset.retried = 'true';
                        try {
                          console.log('🔄 Image failed, getting fresh URL for:', f.file_key);
                          const freshUrl = await reportImageService.getImageDisplayUrl(f.file_key);
                          img.src = freshUrl;
                          setImageUrls(prev => new Map(prev).set(f.file_key, freshUrl));
                        } catch (error) {
                          console.error('❌ Failed to refresh image URL:', error);
                        }
                      }
                    }}
                    onLoad={() => {
                      // Remove retry flag on successful load
                      const img = document.querySelector(`img[src*="${f.file_key}"]`) as HTMLImageElement;
                      if (img) delete img.dataset.retried;
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
                  {/* 🔥 NEW: Show URL expiry status */}
                  {f.capture_type === 'screenshot' && f.file_key && (
                    <span style={{ fontSize: '10px', marginLeft: '4px' }}>
                      {reportImageService.isImageUrlExpired(f.file_key) ? '⚠️' : '✅'}
                    </span>
                  )}
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