import React from 'react';
import { HomeIcon, CalendarIcon, ToolsIcon, SettingsIcon, CloseIcon, LogoutIcon } from './Icons';

export const HamburgerMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  setPage: (page: string) => void;
  activePage: string;
  onLogout: () => void;
}> = ({ isOpen, onClose, setPage, activePage, onLogout }) => {
  const menuItems = [
    { name: 'DASHBOARD', label: 'ホーム', icon: HomeIcon },
    { name: 'HISTORY', label: 'カレンダー', icon: CalendarIcon },
    { name: 'TOOLS', label: 'ツール', icon: ToolsIcon },
    { name: 'SETTINGS', label: '設定', icon: SettingsIcon },
  ];

  const handleNavigation = (page: string) => {
    setPage(page);
    onClose();
  };
  
  const getActiveTab = (page: string) => {
    if (['CALCULATOR', 'RECIPE_SEARCH', 'VEGETABLE_SEARCH', 'PEST_SEARCH', 'TERM_SEARCH', 'WEATHER', 'PLANT_DIAGNOSIS'].includes(page)) return 'TOOLS';
    if (menuItems.some(item => item.name === page)) return page;
    return 'DASHBOARD'; // Fallback
  };
  
  const currentTab = getActiveTab(activePage);

  return (
    <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className={`absolute top-0 right-0 h-full w-72 bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="font-bold text-lg text-gray-800 dark:text-gray-200">メニュー</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <CloseIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
        <div className="p-2 flex flex-col justify-between" style={{ height: 'calc(100% - 65px)' }}>
          <nav>
            <ul>
              {menuItems.map(item => {
                const isActive = currentTab === item.name;
                return (
                  <li key={item.name}>
                    <button
                      onClick={() => handleNavigation(item.name)}
                      className={`w-full flex items-center gap-4 p-4 rounded-lg text-left text-base transition-colors ${isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                      <item.icon className={`h-6 w-6 ${isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="p-2 border-t dark:border-gray-700 mt-2">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-4 p-4 rounded-lg text-left text-base transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <LogoutIcon className="h-6 w-6 text-red-500 dark:text-red-400" />
              <span>ログアウト</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
