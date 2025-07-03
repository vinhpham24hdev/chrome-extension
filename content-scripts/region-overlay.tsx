import React, { useEffect, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import useDragToRect from '../hooks/useDragToRect';
import SelectionRect from '../components/SelectionRect';
import Toolbar from '../components/Toolbar';
import cropImage from '../utils/cropImage';

const Overlay = ({ png }: { png: string }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useDragToRect(overlayRef, setRect);

  const confirm = async () => {
    if (!rect) return;
    const dataUrl = await cropImage(png, rect);
    chrome.runtime.sendMessage({ type: 'REGION_DONE', dataUrl });
    cleanup();
  };

  const cleanup = () => {
    overlayRef.current?.remove();
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[2147483647] cursor-crosshair select-none"
      style={{ lineHeight: 0 }}
    >
      <img src={png} className="w-full h-full object-cover pointer-events-none" />
      {rect && <SelectionRect rect={rect} />}
      <Toolbar onConfirm={confirm} onCancel={cleanup} />
    </div>
  );
};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'REGION_OVERLAY') return;
  port.onMessage.addListener(({ png }) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    createRoot(host).render(<Overlay png={png} />);
  });
});
