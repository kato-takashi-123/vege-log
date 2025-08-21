import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, PaperPlaneIcon, ExportIcon, CameraIcon, ImageIcon, SaveIcon, ObservationIcon } from '../Icons';
import { toISODateString, getDayInfo } from '../../lib/utils';
import { AppSettings } from '../../types';

export const ApiErrorModal: React.FC<{
  isOpen: boolean;
  error: any;
  onRetry: () => void;
  onStopAi: () => void;
}> = ({ isOpen, error, onRetry, onStopAi }) => {
  if (!isOpen) return null;
  
  const errorMessage = error?.originalError?.error?.message || error?.message || '不明なAPIエラーが発生しました。';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-red-600 dark:text-red-400">APIエラー</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">AIとの通信中にエラーが発生しました。</p>
        <div className="mt-4 text-xs text-left bg-gray-100 dark:bg-gray-700 p-2 rounded-md overflow-auto max-h-24">
            <code className="whitespace-pre-wrap break-words">{errorMessage}</code>
        </div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">どうしますか？</p>
        <div className="mt-6 flex flex-col gap-3">
          <button onClick={onRetry} className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700">
            再試行する
          </button>
          <button onClick={onStopAi} className="w-full bg-gray-500 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-gray-600">
            AIの利用を停止する
          </button>
        </div>
      </div>
    </div>
  );
};

export const SaveConfirmationModal: React.FC<{
  isOpen: boolean;
  onConfirm: () => void;
  onDeny: () => void;
  onClose: () => void;
}> = ({ isOpen, onConfirm, onDeny, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">変更の保存</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">編集中の内容が保存されていません。保存しますか？</p>
        <div className="mt-6 flex flex-col gap-3">
          <button onClick={onConfirm} className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700 transition-colors">
            はい、保存する
          </button>
          <button onClick={onDeny} className="w-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-bold py-2.5 px-4 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/70 transition-colors">
            いいえ、破棄する
          </button>
          <button onClick={onClose} className="w-full text-gray-600 dark:text-gray-300 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};

export type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText: string;
  cancelText?: string;
  confirmColor?: string;
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText = 'キャンセル',
  confirmColor = 'bg-red-600 hover:bg-red-700',
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{message}</p>
        <div className="mt-6 flex gap-4">
          <button onClick={onCancel} className="w-1/2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100 font-bold py-2.5 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`w-1/2 text-white font-bold py-2.5 px-4 rounded-lg transition-colors ${confirmColor}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export const CalendarModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  initialDate: Date;
  startOfWeek: 'sunday' | 'monday';
}> = ({ isOpen, onClose, onSelectDate, initialDate, startOfWeek }) => {
  if (!isOpen) return null;

  const [currentDisplayDate, setCurrentDisplayDate] = useState(initialDate);

  const changeMonth = (amount: number) => {
    setCurrentDisplayDate(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + amount, 1);
      return newDate;
    });
  };
  
  const startOfMonth = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), 1);
  const endOfMonth = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() + 1, 0);
  const numDays = endOfMonth.getDate();
  
  let firstDayOfMonth = startOfMonth.getDay(); // Sunday is 0
  if (startOfWeek === 'monday') {
      firstDayOfMonth = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1; // Monday is 0
  }

  const weekHeaderLabels = startOfWeek === 'sunday' 
    ? ['日', '月', '火', '水', '木', '金', '土']
    : ['月', '火', '水', '木', '金', '土', '日'];
    
  const weekHeaderColors = startOfWeek === 'sunday'
    ? ['text-red-500', '', '', '', '', '', 'text-blue-500']
    : ['', '', '', '', '', 'text-blue-500', 'text-red-500'];

  const daysInGrid: React.ReactNode[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysInGrid.push(<div key={`blank-${i}`} className="h-10"></div>);
  }

  for (let day = 1; day <= numDays; day++) {
    const date = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), day);
    const today = new Date();
    today.setHours(0,0,0,0);
    const isFuture = date > today;
    const isToday = date.toDateString() === new Date().toDateString();
    const isSelected = initialDate.toDateString() === date.toDateString();
    const { isHoliday, isSaturday, isSunday } = getDayInfo(date);

    let dayColor = '';
    if (isHoliday) dayColor = 'text-pink-600';
    else if (isSunday) dayColor = 'text-red-500';
    else if (isSaturday) dayColor = 'text-blue-500';

    daysInGrid.push(
      <div key={day} className="h-10 flex items-center justify-center">
        <button
          onClick={() => { if (!isFuture) onSelectDate(date); }}
          disabled={isFuture}
          className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
            isSelected ? 'bg-green-600 text-white font-bold' : 
            isToday ? 'ring-2 ring-green-500' : 
            isFuture ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' :
            'hover:bg-green-100 dark:hover:bg-green-800/50'
          }`}
        >
          <span className={`${isSelected ? 'text-white' : dayColor}`}>{day}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeftIcon className="h-6 w-6" /></button>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{currentDisplayDate.getFullYear()}年 {currentDisplayDate.getMonth() + 1}月</h2>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRightIcon className="h-6 w-6" /></button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {weekHeaderLabels.map((day, index) => (
            <div key={day} className={`font-semibold text-sm py-2 ${weekHeaderColors[index]}`}>
              {day}
            </div>
          ))}
          {daysInGrid}
        </div>
      </div>
    </div>
  );
};

export const ExportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onExport: (range: string, startDate?: string, endDate?: string) => void;
  mode: 'email' | 'download';
}> = ({ isOpen, onClose, onExport, mode }) => {
  const [range, setRange] = useState('thisMonth');
  const [startDate, setStartDate] = useState(toISODateString(new Date()));
  const [endDate, setEndDate] = useState(toISODateString(new Date()));

  useEffect(() => {
    if (isOpen) {
      const today = new Date();
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      if (mode === 'download') {
        setRange('all');
      } else { // email
        setRange('thisMonth');
        setStartDate(toISODateString(thisMonthStart));
        setEndDate(toISODateString(today));
      }
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const ranges = [
    { value: 'all', label: 'すべての記録' },
    { value: 'today', label: '本日' },
    { value: 'thisWeek', label: '今週' },
    { value: 'thisMonth', label: '今月' },
    { value: 'lastMonth', label: '先月' },
    { value: 'custom', label: '期間を指定' },
  ];
  
  const handleExportClick = () => {
    if (range === 'custom') {
      if (startDate > endDate) {
        alert("開始日は終了日より前に設定してください。");
        return;
      }
      onExport(range, startDate, endDate);
    } else {
      onExport(range);
    }
  };
  
  const modalTexts = {
      email: {
          title: 'メールで記録を送信',
          description: '送信する記録の期間を選択してください。記録がCSV形式でメール本文に挿入されます。',
          button: '送信準備',
      },
      download: {
          title: '記録をエクスポート',
          description: 'エクスポートする記録の期間を選択してください。CSVファイルがダウンロードされます。',
          button: 'エクスポート'
      }
  };
  const texts = modalTexts[mode];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center">{texts.title}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 text-center">{texts.description}</p>
        
        <div className="mt-6 text-left space-y-2 max-h-64 overflow-y-auto pr-2">
          {ranges.map(r => (
            <div key={r.value}>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                <input 
                  type="radio" 
                  name="export-range" 
                  value={r.value}
                  checked={range === r.value}
                  onChange={() => setRange(r.value)}
                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300"
                />
                <span className="text-base text-gray-700 dark:text-gray-200 font-medium">{r.label}</span>
              </label>
              {range === 'custom' && r.value === 'custom' && (
                <div className="pl-12 pr-4 pb-2 space-y-2 fade-in">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">開始日</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700" />
                    </div>
                     <span className="pt-5 text-gray-500 dark:text-gray-400">～</span>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">終了日</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button onClick={handleExportClick} className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center justify-center gap-2">
            {mode === 'email' ? <PaperPlaneIcon className="h-5 w-5" /> : <ExportIcon className="h-5 w-5" />}
            <span>{texts.button}</span>
          </button>
          <button onClick={onClose} className="w-full text-gray-600 dark:text-gray-300 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};

export const ImageSourceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (source: 'camera' | 'gallery') => void;
}> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-4">画像を選択</h3>
        <div className="flex justify-around gap-4">
          <button onClick={() => onSelect('camera')} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-1/2">
            <CameraIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">カメラ</span>
          </button>
          <button onClick={() => onSelect('gallery')} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-1/2">
            <ImageIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">ギャラリー</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const CameraActionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDiagnose: () => void;
}> = ({ isOpen, onClose, onSave, onDiagnose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-4">カメラを起動</h3>
        <div className="flex justify-around gap-4">
          <button onClick={onSave} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-1/2">
            <SaveIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">写真を保存</span>
          </button>
          <button onClick={onDiagnose} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-1/2">
            <ObservationIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">写真から診断</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const AiInfoModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <CloseIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
        <div className="overflow-y-auto pr-2">
          {children}
        </div>
      </div>
    </div>
  );
};
