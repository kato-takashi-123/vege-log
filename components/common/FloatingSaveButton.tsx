import React from 'react';
import { SaveIcon } from '../Icons';

export const FloatingSaveButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="fixed bottom-20 right-4 z-30 bg-pink-400 text-white p-3 rounded-full shadow-lg hover:bg-pink-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-400 transform transition-transform hover:scale-110 fade-in"
    aria-label="保存"
    title="保存"
  >
    <SaveIcon className="h-6 w-6" />
  </button>
);
