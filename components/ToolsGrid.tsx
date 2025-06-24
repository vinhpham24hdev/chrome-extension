import React from "react";
import { BsWindow } from "react-icons/bs";
import { BsThreeDotsVertical } from "react-icons/bs";

const ToolsGrid = () => {
  return (
    <div className="w-full">
      <div className="flex align-center justify-around mt-4">
        <div className="flex flex-col cursor-pointer items-center">
          <BsWindow className="w-10 h-6 flex text-gray-800" />
          <span className="text-xs text-gray-800">Screen</span>
        </div>

        <div className="flex flex-col cursor-pointer items-center">
          <BsWindow className="w-10 h-6 flex text-gray-800" />
          <span className="text-xs text-gray-800">Full</span>
        </div>

        <div className="flex flex-col cursor-pointer items-center">
          <BsWindow className="w-10 h-6 flex text-gray-800" />
          <span className="text-xs text-gray-800">Region</span>
        </div>

        {/* Divider */}
        <div className="flex items-center justify-center">
          <div className="w-px h-8 bg-gray-300"></div>
        </div>

        <div className="flex flex-col cursor-pointer items-center">
          <BsWindow className="w-10 h-6 flex text-gray-800" />
          <span className="text-xs text-gray-800">Video</span>
        </div>

        <div className="flex flex-col cursor-pointer items-center">
          <BsWindow className="w-10 h-6 flex text-gray-800" />
          <span className="text-xs text-gray-800">R.Video</span>
        </div>
        <div className="flex flex-col cursor-pointer items-center">
          <BsThreeDotsVertical className="w-4 h-6 flex text-gray-800" />
        </div>
      </div>
    </div>
  );
};

export default ToolsGrid;
