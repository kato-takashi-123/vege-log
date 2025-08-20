
import React, { useState, useCallback, useMemo } from 'react';
import { CultivationRecord, VegetableInfo, AppSettings } from '../types';
import { getVegetableInfo } from '../services/geminiService';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { FormattedContent } from '../components/common/FormattedContent';
import { MicrophoneIcon } from '../components/Icons';
import { ApiCallHandler } from '../types';

type PageProps = {
  handleApiCall: ApiCallHandler;
  records: CultivationRecord[];
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  pageParams: any;
};

const VegetableSearchPage: React.FC<PageProps> = ({ handleApiCall, records }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VegetableInfo | null>(null);

  const { isListening, startListening } = useVoiceRecognition({ onResult: setQuery });

  const cultivatedCrops = useMemo(() => {
    const cropNames = records.map(r => r.cropName).filter(Boolean);
    return [...new Set(cropNames)];
  }, [records]);
  
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const info = await handleApiCall(() => getVegetableInfo(searchQuery));
      if (info) setResult(info);
    } catch (e) {
      console.error(e);
      alert("情報の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [handleApiCall]);
  
  const handleCropButtonClick = (cropName: string) => {
    setQuery(cropName);
    handleSearch(cropName);
  };
  
  const InfoSection: React.FC<{title: string; children: React.ReactNode;}> = ({title, children}) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
      <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-2">{title}</h3>
      <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">{children}</div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
         <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">野菜の育て方検索</h3>
        <div className="flex gap-2">
           <div className="relative flex-grow">
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch(query)} placeholder="野菜名を入力" className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg pr-10" disabled={isLoading} />
            <button onClick={startListening} disabled={isLoading} className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}><MicrophoneIcon className="h-5 w-5" /></button>
          </div>
          <button onClick={() => handleSearch(query)} disabled={isLoading || !query.trim()} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">検索</button>
        </div>
        {cultivatedCrops.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">現在栽培中の作物:</p>
            <div className="flex flex-wrap gap-2">
              {cultivatedCrops.map(crop => (
                <button
                  key={crop}
                  onClick={() => handleCropButtonClick(crop)}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors disabled:opacity-50"
                >
                  {crop}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {isLoading && <div className="text-center p-4">AIが育て方を調べています...</div>}
      
      {result && (
        <div className="space-y-4 fade-in">
          <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200">{result.vegetableName} の育て方</h2>
          <InfoSection title="栽培ごよみ">
            <p><strong>種まき:</strong> {result.cultivationCalendar.seeding}</p>
            <p><strong>植え付け:</strong> {result.cultivationCalendar.planting}</p>
            <p><strong>収穫:</strong> {result.cultivationCalendar.harvest}</p>
          </InfoSection>
          <InfoSection title="施肥計画 (M-plus)">
            <p><strong>元肥:</strong> <FormattedContent content={result.fertilizationPlan.baseFertilizer} /></p>
            <p className="mt-2"><strong>追肥:</strong> <FormattedContent content={result.fertilizationPlan.topDressing} /></p>
          </InfoSection>
          <InfoSection title="栽培のコツ">
            <FormattedContent content={result.cultivationTips} />
          </InfoSection>
           <InfoSection title="主な病害虫と対策">
            <FormattedContent content={result.pestControl} />
          </InfoSection>
        </div>
      )}
    </div>
  );
};

export default VegetableSearchPage;
