// components/RegionSelector.tsx
import React, { useState, useRef, useCallback } from 'react';

export interface RegionSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RegionSelectorProps {
  imageUrl: string;
  onRegionSelect: (region: RegionSelection) => void;
  onCancel: () => void;
}

export default function RegionSelector({ imageUrl, onRegionSelect, onCancel }: RegionSelectorProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRegion, setCurrentRegion] = useState<RegionSelection | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPoint({ x, y });
    setIsSelecting(true);
    setCurrentRegion({ x, y, width: 0, height: 0 });
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !startPoint || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const width = Math.abs(currentX - startPoint.x);
    const height = Math.abs(currentY - startPoint.y);
    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);

    setCurrentRegion({ x, y, width, height });
  }, [isSelecting, startPoint]);

  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !currentRegion || !imageRef.current) return;

    setIsSelecting(false);
    
    // Only proceed if region has meaningful size
    if (currentRegion.width > 10 && currentRegion.height > 10) {
      // Convert screen coordinates to image coordinates
      const rect = imageRef.current.getBoundingClientRect();
      const scaleX = imageRef.current.naturalWidth / rect.width;
      const scaleY = imageRef.current.naturalHeight / rect.height;

      const scaledRegion: RegionSelection = {
        x: Math.round(currentRegion.x * scaleX),
        y: Math.round(currentRegion.y * scaleY),
        width: Math.round(currentRegion.width * scaleX),
        height: Math.round(currentRegion.height * scaleY)
      };

      onRegionSelect(scaledRegion);
    }
  }, [isSelecting, currentRegion, onRegionSelect]);

  const handleConfirmSelection = () => {
    if (currentRegion && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const scaleX = imageRef.current.naturalWidth / rect.width;
      const scaleY = imageRef.current.naturalHeight / rect.height;

      const scaledRegion: RegionSelection = {
        x: Math.round(currentRegion.x * scaleX),
        y: Math.round(currentRegion.y * scaleY),
        width: Math.round(currentRegion.width * scaleX),
        height: Math.round(currentRegion.height * scaleY)
      };

      onRegionSelect(scaledRegion);
    }
  };

  const handleReset = () => {
    setCurrentRegion(null);
    setStartPoint(null);
    setIsSelecting(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Select Region to Capture</h2>
            <p className="text-sm text-gray-600">Click and drag to select the area you want to capture</p>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Image Container */}
        <div className="flex-1 overflow-auto p-4">
          <div className="relative inline-block">
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Screenshot to crop"
              className="max-w-full h-auto cursor-crosshair select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              draggable={false}
            />
            
            {/* Selection Overlay */}
            {currentRegion && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none"
                style={{
                  left: currentRegion.x,
                  top: currentRegion.y,
                  width: currentRegion.width,
                  height: currentRegion.height,
                }}
              >
                {/* Selection Info */}
                <div className="absolute -top-8 left-0 bg-blue-500 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
                  {Math.round(currentRegion.width)} × {Math.round(currentRegion.height)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            {currentRegion ? (
              <span>
                Selected: {Math.round(currentRegion.width)} × {Math.round(currentRegion.height)} pixels
              </span>
            ) : (
              <span>Click and drag to select an area</span>
            )}
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleReset}
              disabled={!currentRegion}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Reset
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmSelection}
              disabled={!currentRegion || currentRegion.width < 10 || currentRegion.height < 10}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}