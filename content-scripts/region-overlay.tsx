// content-scripts/region-overlay.tsx
import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import useDragToRect from '../hooks/useDragToRect';
import SelectionRect from '../components/SelectionRect';
import Toolbar from '../components/Toolbar';
import cropImage from '../utils/cropImage';

const PORT = 'REGION_OVERLAY';

const Overlay: React.FC<{ png: string }> = ({ png }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useDragToRect<HTMLDivElement>(ref, setRect);

  const confirm = async () => {
    if (!rect) return;
    const dataUrl = await cropImage(png, rect);
    chrome.runtime.sendMessage({ type: 'REGION_DONE', dataUrl });
    ref.current?.remove();
  };

  const cancel = () => ref.current?.remove();

  return (
    <div ref={ref} className="fixed inset-0 z-[2147483647] cursor-crosshair select-none">
      <img src={png} className="w-full h-full object-cover pointer-events-none" />
      {rect && <SelectionRect rect={rect} />}
      <Toolbar onConfirm={confirm} onCancel={cancel} />
    </div>
  );
};
console.log('[OV] overlay script loaded');

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PORT) return;
  port.onMessage.addListener(({ png }) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    createRoot(host).render(<Overlay png={png} />);
  });
});
