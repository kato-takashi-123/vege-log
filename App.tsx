

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CultivationRecord, AppSettings, ApiCallHandler } from './types';
import { ApiRateLimitError } from './services/geminiService';
import { SETTINGS_KEY } from './lib/constants';
import { idbGet, idbSet, idbClear } from './lib/indexedDB';
import { toISODateString, parseDateString, exportRecordsToCsv, importRecordsFromCsv } from './lib/utils';
import { useServiceWorker } from './hooks/useServiceWorker';

// Import pages
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import RecordPage, { RecordPageHandle } from './pages/RecordPage';
import CalendarHistoryPage from './pages/CalendarHistoryPage';
import ToolsPage from './pages/ToolsPage';
import CalculatorPage from './pages/CalculatorPage';
import RecipeSearchPage from './pages/RecipeSearchPage';
import VegetableSearchPage from './pages/VegetableSearchPage';
import PestSearchPage from './pages/PestSearchPage';
import TermSearchPage from './pages/TermSearchPage';
import WeatherPage from './pages/WeatherPage';
import PlantDiagnosisPage from './pages/PlantDiagnosisPage';
import PlantingRecommendationSearchPage from './pages/PlantingRecommendationSearchPage';
import SettingsPage from './pages/SettingsPage';

// Import components
import { PageHeader } from './components/PageHeader';
import { HamburgerMenu } from './components/HamburgerMenu';
import { Toast, UpdateAvailableToast } from './components/common/Toast';
import { ApiErrorModal, SaveConfirmationModal, ConfirmationModal, ConfirmationModalProps, ExportModal, CameraActionModal } from './components/modals';
import { PaperPlaneIcon, CalendarIcon, ToolsIcon, CameraIcon, HomeIcon, SaveIcon, ObservationIcon } from './components/Icons';
import { FloatingSaveButton } from './components/common/FloatingSaveButton';


export const App = () => {
  const [page, setPage] = useState<'LOGIN' | 'DASHBOARD' | 'RECORD' | 'HISTORY' | 'TOOLS' | 'CALCULATOR' | 'RECIPE_SEARCH' | 'VEGETABLE_SEARCH' | 'PEST_SEARCH' | 'TERM_SEARCH' | 'WEATHER' | 'PLANT_DIAGNOSIS' | 'PLANTING_RECOMMENDATION_SEARCH' | 'SETTINGS'>('LOGIN');
  const [pageParams, setPageParams] = useState<any>({});
  const [records, setRecords] = useState<CultivationRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    teamName: 'マイチーム',
    startOfWeek: 'monday',
    enableAiFeatures: true,
    enablePumiceWash: false,
    weatherLocation: 'nagoya,JP',
    darkModeContrast: 'normal',
    openWeatherApiKey: '',
    dailyQuoteTheme: '今日は何の日？'
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [formIsDirty, setFormIsDirty] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<Omit<ConfirmationModalProps, 'isOpen'> & { isOpen: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {}, confirmText: '' });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [exportModal, setExportModal] = useState<{isOpen: boolean, mode: 'email' | 'download'}>({isOpen: false, mode: 'download'});
  const [apiError, setApiError] = useState<any>(null);
  const [lastApiCall, setLastApiCall] = useState<(() => Promise<any>) | null>(null);
  const recordPageRef = useRef<RecordPageHandle>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const cameraSaveRef = useRef<HTMLInputElement>(null);
  const cameraDiagnoseRef = useRef<HTMLInputElement>(null);
  
  const goBackActionRef = useRef<(() => void) | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const debouncedSaveRef = useRef<number | null>(null);
  
  const { updateAvailable, applyUpdate, checkForUpdate } = useServiceWorker();

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
    } catch (error) {
      console.error("Failed to load settings from localStorage", error);
    }

    idbGet('allRecords').then(savedRecords => {
      if (savedRecords && Array.isArray(savedRecords)) {
        setRecords(savedRecords);
      }
    }).catch(e => {
        console.error("Error loading records from IndexedDB", e);
    }).finally(() => {
        setIsLoading(false);
    });
  }, []);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isLoading) {
        return;
    }
    if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
    }

    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    
    debouncedSaveRef.current = window.setTimeout(() => {
        idbSet('allRecords', records).catch(e => console.error("Failed to save records to IndexedDB", e));
    }, 500);

    return () => {
        if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    };
  }, [records, isLoading]);

  const handleSettingsChange = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
        console.error("Failed to save settings to localStorage", error);
    }
  }, []);
  
  useEffect(() => {
    const isHighContrast = settings.darkModeContrast === 'high';
    const root = document.documentElement;
    root.classList.toggle('dark-high-contrast', isHighContrast);
  }, [settings.darkModeContrast]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 1500);
  };

  const handleSaveRecord = (record: CultivationRecord) => {
    setRecords(prevRecords => {
      let records = [...prevRecords];
      const { id, cultivationLane, date } = record;

      // Find indices of records that match by ID or by lane+date
      const idxById = records.findIndex(r => r.id === id);
      const idxByLaneDate = records.findIndex(r => r.cultivationLane === cultivationLane && r.date === date);

      if (idxByLaneDate !== -1) {
        // A record for this lane & date exists. We will overwrite it.
        // To keep a stable ID for the lane+date pair, we'll use the existing record's ID.
        const finalRecord = { ...record, id: records[idxByLaneDate].id };
        records[idxByLaneDate] = finalRecord;

        // If we were editing a different record (IDs don't match), remove the original.
        if (idxById !== -1 && idxById !== idxByLaneDate) {
          records.splice(idxById, 1);
        }
      } else if (idxById !== -1) {
        // This is an existing record moved to a new, unoccupied lane+date. Update it.
        records[idxById] = record;
      } else {
        // This is a completely new record for an unoccupied lane+date. Add it.
        records.push(record);
      }
      
      return records;
    });
    setPage('DASHBOARD');
    showToast('記録を保存しました！');
  };

  const handleDeleteAllData = () => {
    setConfirmationModal({
        isOpen: true,
        title: '全データ削除',
        message: '本当にすべての栽培データを削除しますか？\nこの操作は元に戻せません。バックアップを取ることをお勧めします。',
        confirmText: 'はい、すべて削除する',
        onConfirm: async () => {
            try {
                await idbClear();
                setRecords([]);
                setConfirmationModal(s => ({...s, isOpen: false}));
                showToast('すべての栽培データを削除しました。');
            } catch (error) {
                console.error("Failed to clear all data from IndexedDB", error);
                alert("データの削除に失敗しました。");
                setConfirmationModal(s => ({...s, isOpen: false}));
            }
        },
        onCancel: () => setConfirmationModal(s => ({...s, isOpen: false})),
    });
  };
  
  const handleClearFutureRecords = (lane: string, date: string) => {
      const startDate = parseDateString(date);
      startDate.setHours(0, 0, 0, 0);

      setRecords(prev => prev.filter(r => {
          const rDate = parseDateString(r.date);
          return !(r.cultivationLane === lane && rDate >= startDate);
      }));
  };

  const handleApiCall: ApiCallHandler = useCallback(async (apiCall) => {
    if (!settings.enableAiFeatures) {
        console.log("AI features are disabled.");
        return undefined;
    }
    setLastApiCall(() => apiCall);
    try {
      setApiError(null);
      const result = await apiCall();
      return result;
    } catch (error: any) {
        console.error("API Call failed:", error);
        if (error instanceof ApiRateLimitError) {
          setApiError(error);
        } else {
          alert(`エラーが発生しました: ${error.message}`);
        }
        return undefined;
    }
  }, [settings.enableAiFeatures]);

  const retryApiCall = () => {
    if (lastApiCall) {
      handleApiCall(lastApiCall);
    }
  };

  const stopAiFeatures = () => {
    handleSettingsChange({ ...settings, enableAiFeatures: false });
    setApiError(null);
  };
  
  const handleDirtyStateBack = (action: () => void) => {
    if (page === 'RECORD' && formIsDirty) {
      goBackActionRef.current = action;
      setSaveModalOpen(true);
    } else {
      action();
    }
  };

  const changePage = (newPage: string, params?: any) => {
    const action = () => {
        window.scrollTo(0, 0);
        setPage(newPage as any);
        if (params) setPageParams(params);
        setActiveTab(newPage);
        setFormIsDirty(false);
    };
    handleDirtyStateBack(action);
  };

  const onBack = () => {
    let targetPage = 'DASHBOARD';
    if (['CALCULATOR', 'RECIPE_SEARCH', 'VEGETABLE_SEARCH', 'PEST_SEARCH', 'TERM_SEARCH', 'WEATHER', 'PLANT_DIAGNOSIS', 'PLANTING_RECOMMENDATION_SEARCH'].includes(page)) {
      targetPage = 'TOOLS';
    }
    changePage(targetPage);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    changePage('DASHBOARD');
  };
  
  const handleLogout = () => {
      setConfirmationModal({
          isOpen: true,
          title: 'ログアウト',
          message: '本当にログアウトしますか？',
          confirmText: 'ログアウト',
          onConfirm: () => {
              setIsLoggedIn(false);
              setPage('LOGIN');
              setRecords([]);
              setConfirmationModal(s => ({...s, isOpen: false}));
          },
          onCancel: () => setConfirmationModal(s => ({...s, isOpen: false})),
      });
  };
  
  const onSaveConfirm = () => {
    recordPageRef.current?.handleSubmit();
    setSaveModalOpen(false);
    if(goBackActionRef.current) {
        goBackActionRef.current();
        goBackActionRef.current = null;
    }
  };

  const onSaveDeny = () => {
    setSaveModalOpen(false);
    if(goBackActionRef.current) {
        goBackActionRef.current();
        goBackActionRef.current = null;
    }
    setFormIsDirty(false);
  };

  const handleExport = () => {
    if (records.length === 0) {
        alert("エクスポート対象の記録がありません。");
        return;
    }

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(exportRecordsToCsv(records));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    const fileName = `veggielog_export_${toISODateString(new Date())}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("すべての記録をCSVでエクスポートしました。");
  };

  const handleEmailExport = (range: string, startDateStr?: string, endDateStr?: string) => {
    if (records.length === 0) {
        alert("エクスポート対象の記録がありません。");
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let startDate: Date;
    let endDate: Date;
    let filteredRecords: CultivationRecord[];

    switch (range) {
        case 'today':
            startDate = today;
            endDate = today;
            break;
        case 'thisWeek': {
            const dayOfWeek = today.getDay(); // 0 = Sunday
            const weekStartsOn = settings.startOfWeek === 'sunday' ? 0 : 1;
            startDate = new Date(today);
            const diff = (dayOfWeek - weekStartsOn + 7) % 7;
            startDate.setDate(startDate.getDate() - diff);
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            break;
        }
        case 'thisMonth':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'lastMonth':
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0);
            break;
        case 'custom':
            if (!startDateStr || !endDateStr) {
                alert("期間を指定してください。");
                return;
            }
            startDate = parseDateString(startDateStr);
            endDate = parseDateString(endDateStr);
            break;
        case 'all':
        default:
            filteredRecords = records;
            break;
    }

    if (range !== 'all') {
         filteredRecords = records.filter(r => {
            const recordDate = parseDateString(r.date);
            return recordDate >= startDate && recordDate <= endDate;
        });
    }
    
    if (filteredRecords.length === 0) {
        alert("選択された期間にエクスポート対象の記録がありません。");
        return;
    }

    // 1. Generate CSV and trigger download
    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(exportRecordsToCsv(filteredRecords));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    const fileName = `veggielog_export_${toISODateString(new Date())}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 2. Prepare and open mailto link
    const teamName = settings.teamName || 'ベジログ';
    const subject = `${teamName} 栽培記録のエクスポート (${toISODateString(new Date())})`;
    const body = `こんにちは。\n\n${teamName}の栽培記録をお送りします。\n\n先ほどダウンロードされたCSVファイル（${fileName}）を、このメールに添付して送信してください。`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    // Give a slight delay for the download to start before opening the mail client.
    setTimeout(() => {
        try {
            window.location.href = mailtoLink;
        } catch (e) {
            console.error("Failed to open mail client", e);
            alert("メールクライアントの起動に失敗しました。");
        }
    }, 500);
    
    setExportModal({isOpen: false, mode: 'email'});
    showToast('ファイルをダウンロードし、メールアプリを起動します。');
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csvText = e.target?.result as string;
            const importedRecords: CultivationRecord[] = importRecordsFromCsv(csvText);
            
            if (!Array.isArray(importedRecords)) {
                throw new Error("Invalid file format");
            }
            if (importedRecords.length > 0 && (!importedRecords[0].id || !importedRecords[0].date)) {
                 throw new Error("Invalid CSV format");
            }

            setConfirmationModal({
                isOpen: true,
                title: '記録のインポート',
                message: `${importedRecords.length}件の記録をインポートしますか？\n現在の記録は上書きされます。`,
                confirmText: 'インポート',
                confirmColor: 'bg-blue-600 hover:bg-blue-700',
                onConfirm: () => {
                    setRecords(importedRecords);
                    showToast(`${importedRecords.length}件の記録をインポートしました。`);
                    setConfirmationModal(s => ({...s, isOpen: false}));
                },
                onCancel: () => setConfirmationModal(s => ({...s, isOpen: false})),
            });

        } catch (err: any) {
            alert(`ファイルの読み込みに失敗しました。CSV形式が正しくない可能性があります。\nエラー: ${err.message}`);
        }
    };
    reader.readAsText(file);
    event.target.value = '';
  };
  
  const handleDiagnoseFromCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preselectedImage = { file, preview: URL.createObjectURL(file) };
      changePage('PLANT_DIAGNOSIS', { preselectedImage });
    }
    if (e.target) e.target.value = '';
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const pages: { [key: string]: { comp: React.ReactNode, title: string, showBack: boolean } } = {
    DASHBOARD: {
      comp: <Dashboard 
        records={records} 
        onLaneClick={(recordData) => changePage('RECORD', recordData)} 
        settings={settings} 
        handleApiCall={handleApiCall} 
        />,
      title: settings.teamName,
      showBack: false,
    },
    RECORD: {
      comp: <RecordPage
        ref={recordPageRef}
        onSaveRecord={handleSaveRecord}
        onBack={() => handleDirtyStateBack(onBack)}
        initialData={pageParams}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onDirtyChange={setFormIsDirty}
        onConfirmationRequest={(config) => setConfirmationModal({ ...config, isOpen: true, onCancel: () => setConfirmationModal(s => ({ ...s, isOpen: false})) })}
        handleApiCall={handleApiCall}
        records={records}
        onClearFutureRecords={handleClearFutureRecords}
        onValidationError={showToast}
      />,
      title: pageParams?.id ? '記録の編集' : '新規記録',
      showBack: true
    },
    HISTORY: { comp: <CalendarHistoryPage records={records} startOfWeek={settings.startOfWeek} onRecordClick={(record) => changePage('RECORD', record)} />, title: '栽培カレンダー', showBack: false },
    TOOLS: { comp: <ToolsPage setPage={changePage} />, title: 'ツール', showBack: false },
    CALCULATOR: { comp: <CalculatorPage settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '液肥計算機', showBack: true },
    RECIPE_SEARCH: { comp: <RecipeSearchPage settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: 'レシピ検索', showBack: true },
    VEGETABLE_SEARCH: { comp: <VegetableSearchPage settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '育て方検索', showBack: true },
    PEST_SEARCH: { comp: <PestSearchPage settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '病害虫検索', showBack: true },
    TERM_SEARCH: { comp: <TermSearchPage settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '園芸用語辞典', showBack: true },
    WEATHER: { comp: <WeatherPage settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '天気予報', showBack: true },
    PLANT_DIAGNOSIS: { comp: <PlantDiagnosisPage setPage={changePage} settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: 'AI作物診断', showBack: true },
    PLANTING_RECOMMENDATION_SEARCH: { comp: <PlantingRecommendationSearchPage settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '作付けおすすめ検索', showBack: true },
    SETTINGS: { comp: <SettingsPage settings={settings} onSettingsChange={handleSettingsChange} onLogout={handleLogout} onExport={handleExport} onImport={handleImport} onDeleteAllData={handleDeleteAllData} />, title: '設定', showBack: false },
  };

  const currentPage = pages[page] || pages.DASHBOARD;
  
  const showFab = (page === 'RECORD' && !pageParams.id) || (page === 'RECORD' && pageParams.id && formIsDirty);

  return (
    <div className="bg-lime-50 dark:bg-gray-900 min-h-screen font-sans">
      <PageHeader
        title={currentPage.title}
        onBack={currentPage.showBack ? () => handleDirtyStateBack(onBack) : undefined}
        onMenuClick={() => setIsMenuOpen(true)}
      />
      <main className="pb-24">
        {isLoading ? <div className="text-center p-8">データを読み込み中...</div> : currentPage.comp}
      </main>

      <div className="fixed bottom-0 left-0 right-0 h-12 z-20">
        <nav className="w-full h-full bg-[#ffe8d1] dark:bg-gray-800 shadow-t-lg border-t dark:border-gray-700 flex justify-around items-center">
          <button onClick={() => setExportModal({isOpen: true, mode: 'email'})} className="flex flex-col items-center justify-center w-full h-full text-gray-500 dark:text-gray-400 transition-colors">
            <PaperPlaneIcon className="h-6 w-6" />
            <span className="text-xs">送信</span>
          </button>
          <button onClick={() => changePage('HISTORY')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'HISTORY' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <CalendarIcon className="h-6 w-6" />
            <span className="text-xs">カレンダー</span>
          </button>
          
          <div className="w-full h-full"></div>

          <button onClick={() => changePage('TOOLS')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${['TOOLS', 'CALCULATOR', 'RECIPE_SEARCH', 'VEGETABLE_SEARCH', 'PEST_SEARCH', 'TERM_SEARCH', 'WEATHER', 'PLANT_DIAGNOSIS', 'PLANTING_RECOMMENDATION_SEARCH'].includes(page) ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <ToolsIcon className="h-6 w-6" />
            <span className="text-xs">ツール</span>
          </button>
          <button onClick={() => setIsCameraModalOpen(true)} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${page === 'PLANT_DIAGNOSIS' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <CameraIcon className="h-6 w-6" />
            <span className="text-xs">カメラ</span>
          </button>
        </nav>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 flex justify-center items-end pointer-events-none" style={{ width: '20%'}}>
           <button
              onClick={() => changePage('DASHBOARD')}
              className={`w-16 h-16 bg-[#ffe8d1] dark:bg-gray-800 border-2 dark:border-gray-600 rounded-full shadow-lg flex items-center justify-center transition-transform pointer-events-auto ${activeTab === 'DASHBOARD' ? 'text-green-600 dark:text-green-400 border-green-500 dark:border-green-500' : 'text-gray-600 dark:text-gray-400 border-stone-200 dark:border-gray-700'}`}
              aria-label="ホーム"
          >
              <HomeIcon className="h-8 w-8" />
          </button>
        </div>
      </div>
      
      {showFab && (
        <FloatingSaveButton onClick={() => recordPageRef.current?.handleSubmit()} />
      )}
      
      {toastMessage && <Toast message={toastMessage} />}
      {updateAvailable && <UpdateAvailableToast onUpdate={applyUpdate} />}

      <HamburgerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        setPage={changePage}
        activePage={page}
        onLogout={handleLogout}
        updateAvailable={updateAvailable}
        onUpdate={applyUpdate}
        onCheckForUpdate={checkForUpdate}
        showToast={showToast}
      />

      <SaveConfirmationModal
        isOpen={saveModalOpen}
        onConfirm={onSaveConfirm}
        onDeny={onSaveDeny}
        onClose={() => setSaveModalOpen(false)}
      />

      <ConfirmationModal 
        isOpen={confirmationModal.isOpen}
        {...confirmationModal}
      />
      
      <ExportModal
        isOpen={exportModal.isOpen}
        mode={exportModal.mode}
        onClose={() => setExportModal(prev => ({...prev, isOpen: false}))}
        onExport={handleEmailExport}
      />
      
      <ApiErrorModal
        isOpen={!!apiError}
        error={apiError}
        onRetry={retryApiCall}
        onStopAi={stopAiFeatures}
      />

      <CameraActionModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSave={() => {
          cameraSaveRef.current?.click();
          setIsCameraModalOpen(false);
        }}
        onDiagnose={() => {
          cameraDiagnoseRef.current?.click();
          setIsCameraModalOpen(false);
        }}
      />
      <input type="file" accept="image/*" capture="environment" ref={cameraSaveRef} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraDiagnoseRef} onChange={handleDiagnoseFromCamera} className="hidden" />
    </div>
  );
};