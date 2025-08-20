import React from 'react';

export const Toast: React.FC<{ message: string }> = ({ message }) => (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-75 text-white text-lg font-semibold py-4 px-8 rounded-xl shadow-lg z-50 fade-in">
      {message}
    </div>
);
