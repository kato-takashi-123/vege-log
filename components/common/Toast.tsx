import React from 'react';
import { RefreshIcon } from '../Icons';

export const Toast: React.FC<{ message: string }> = ({ message }) => (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-75 text-white text-lg font-semibold py-4 px-8 rounded-xl shadow-lg z-50 fade-in">
      {message}
    </div>
);

export const UpdateAvailableToast: React.FC<{ onUpdate: () => void }> = ({ onUpdate }) => (
  <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white py-3 px-5 rounded-xl shadow-lg z-50 fade-in flex items-center gap-4">
    <p className="font-semibold text-base">新しいバージョンがあります！</p>
    <button
      onClick={onUpdate}
      className="bg-white text-blue-700 font-bold py-1.5 px-4 rounded-lg text-sm hover:bg-blue-100 transition-colors flex items-center gap-2"
    >
      <RefreshIcon className="h-4 w-4" />
      <span>更新</span>
    </button>
  </div>
);