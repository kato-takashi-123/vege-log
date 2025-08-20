import React, { useState, useEffect, useRef } from 'react';
import { AppSettings } from '../types';
import { FileImportIcon, ExportIcon, TrashIcon, LogoutIcon } from '../components/Icons';

type SettingsPageProps = {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onLogout: () => void;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteAllData: () => void;
};

const SettingsPage: React.FC<SettingsPageProps> = ({ settings, onSettingsChange, onLogout, onExport, onImport, onDeleteAllData }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const importInputRef = useRef<HTMLInputElement>(null);
  
  const handleSettingsChange = (newSettings: Partial<AppSettings>) => {
    setLocalSettings(prev => ({ ...prev, ...newSettings }));
  };
  
  useEffect(() => {
    onSettingsChange(localSettings);
  }, [localSettings, onSettingsChange]);
  
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">基本設定</h3>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">チーム名</label>
            <input type="text" value={localSettings.teamName} onChange={e => handleSettingsChange({ teamName: e.target.value })} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">週の始まり</label>
            <select value={localSettings.startOfWeek} onChange={e => handleSettingsChange({ startOfWeek: e.target.value as any })} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg bg-white">
              <option value="sunday">日曜日</option>
              <option value="monday">月曜日</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">天気予報エリア (例: Tokyo,JP)</label>
            <input type="text" value={localSettings.weatherLocation} onChange={e => handleSettingsChange({ weatherLocation: e.target.value })} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">OpenWeatherMap APIキー</label>
            <input type="password" value={localSettings.openWeatherApiKey} onChange={e => handleSettingsChange({ openWeatherApiKey: e.target.value })} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg" placeholder="APIキーを入力" />
            <p className="text-xs text-gray-500 mt-1">OpenWeatherMapから無料でAPIキーを取得できます。</p>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">AI機能設定</h3>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="enable-ai" className="text-sm font-medium text-gray-700 dark:text-gray-300">AIアシスタント機能</label>
            <input type="checkbox" id="enable-ai" checked={localSettings.enableAiFeatures} onChange={e => handleSettingsChange({ enableAiFeatures: e.target.checked })} className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all checked:bg-green-600 checked:after:translate-x-full focus:ring-0" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">表示設定</h3>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="enable-pumice-wash" className="text-sm font-medium text-gray-700 dark:text-gray-300">「パミス洗い」作業を表示</label>
            <input type="checkbox" id="enable-pumice-wash" checked={localSettings.enablePumiceWash} onChange={e => handleSettingsChange({ enablePumiceWash: e.target.checked })} className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all checked:bg-green-600 checked:after:translate-x-full focus:ring-0" />
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">ダークモードのコントラスト</label>
            <div className="mt-2 flex rounded-lg shadow-sm">
              <button
                onClick={() => handleSettingsChange({ darkModeContrast: 'normal' })}
                className={`flex-1 px-4 py-2 text-sm rounded-l-lg ${localSettings.darkModeContrast === 'normal' ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
              >
                通常
              </button>
              <button
                onClick={() => handleSettingsChange({ darkModeContrast: 'high' })}
                className={`flex-1 px-4 py-2 text-sm rounded-r-lg ${localSettings.darkModeContrast === 'high' ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
              >
                ハイコントラスト
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">データ管理</h3>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
            <p className="text-xs text-gray-500">記録データはブラウザ内に自動で保存されます。以下の機能で、手動でのバックアップ（エクスポート）と復元（インポート）が可能です。</p>
            <div className="space-y-3">
              <input type="file" accept=".json" ref={importInputRef} onChange={onImport} className="hidden" />
              <button onClick={() => importInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold py-2.5 px-4 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors">
                <FileImportIcon className="h-5 w-5"/>
                <span>記録をインポート (JSON)</span>
              </button>
              <button onClick={onExport} className="w-full flex items-center justify-center gap-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold py-2.5 px-4 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors">
                <ExportIcon className="h-5 w-5"/>
                <span>すべての記録をエクスポート (JSON)</span>
              </button>
              <button onClick={onDeleteAllData} className="w-full flex items-center justify-center gap-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-bold py-2.5 px-4 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors">
                <TrashIcon className="h-5 w-5"/>
                <span>すべての栽培データを削除</span>
              </button>
            </div>
        </div>
      </div>
      
      <div className="pt-4">
         <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-bold py-2.5 px-4 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors">
            <LogoutIcon className="h-5 w-5"/>
            <span>ログアウト</span>
          </button>
      </div>
    </div>
  );
};

export default SettingsPage;
