/**
 * Region-overlay content-script
 * -----------------------------
 * ➊  Đặt tại:   content-scripts/region-overlay.tsx
 * ➋  WXT v0.20.x tự bundle thành JS (có hash) nhờ defineContentScript().
 * ➌  background/region.ts chỉ cần inject tên gốc
 *        'content-scripts/region-overlay.js'
 */

import { defineContentScript } from '#imports';           // ✔ API wxt 0.20.x
import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import useDragToRect from '../hooks/useDragToRect';
import SelectionRect from '../components/SelectionRect';
import Toolbar from '../components/Toolbar';
import cropImage from '../utils/cropImage';

const PORT = 'REGION_OVERLAY';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  registration: 'runtime',             

  main() {
    console.log('[OV] overlay script loaded');

    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== PORT) return;
      console.log('[OV] port connected');

      port.onMessage.addListener(({ png }) => {
        console.log('[OV] got PNG');

        /** mount React UI **/
        const host = document.createElement('div');
        document.body.appendChild(host);
        const root = createRoot(host);

        const Overlay = () => {
          const [rect, setRect] = useState<DOMRect | null>(null);
          const ref = useRef<HTMLDivElement>(null);
          useDragToRect<HTMLDivElement>(ref, setRect);

          const confirm = async () => {
            if (!rect) return;
            const dataUrl = await cropImage(png, rect);
            chrome.runtime.sendMessage({ type: 'REGION_DONE', dataUrl });
            root.unmount();
          };

          return (
            <div
              ref={ref}
              className="fixed inset-0 z-[2147483647] cursor-crosshair select-none"
            >
              <img
                src={png}
                className="w-full h-full object-cover pointer-events-none"
              />
              {rect && <SelectionRect rect={rect} />}
              <Toolbar onConfirm={confirm} onCancel={() => root.unmount()} />
            </div>
          );
        };

        root.render(<Overlay />);
      });
    });
  },
});
