import React from 'react';
import { BackIcon, HamburgerIcon } from './Icons';

export const PageHeader: React.FC<{ title: string; onBack?: () => void; onMenuClick?: () => void; }> = ({ title, onBack, onMenuClick }) => (
    <header className="bg-cyan-100 dark:bg-gray-800 shadow-sm sticky top-0 z-20 p-4 flex items-center justify-between h-12">
        <div className="w-10">
            {onBack && (
                <button onClick={onBack} className="p-2 rounded-full hover:bg-cyan-200 dark:hover:bg-gray-700">
                    <BackIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                </button>
            )}
        </div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200 text-center absolute left-1/2 -translate-x-1/2">{title}</h1>
        <div className="flex items-center gap-1">
            {onMenuClick && (
                <button onClick={onMenuClick} className="p-2 rounded-full hover:bg-cyan-200 dark:hover:bg-gray-700">
                    <HamburgerIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                </button>
            )}
        </div>
    </header>
);
