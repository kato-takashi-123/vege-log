
import React, { useState, useCallback } from 'react';
import { AiSearchResult, searchGardeningTerm } from '../services/geminiService';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { FormattedContent } from '../components/common/FormattedContent';
import { MicrophoneIcon } from '../components/Icons';
import { ApiCallHandler } from '../types';
import { AppSettings, CultivationRecord } from '../types';

type PageProps = {
  handleApiCall: ApiCallHandler;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  records: CultivationRecord[];
  pageParams: any;
};

const TermSearchPage: React.FC<PageProps> = ({ handleApiCall }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AiSearchResult | null>(null);

  const { isListening, startListening } = useVoiceRecognition({ onResult: setQuery });
  
  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsLoading(true);
    setResult(null);
    try {
      const res = await handleApiCall(() => searchGardeningTerm(query));
      if (res) setResult(res);
    } catch (e) {
      console.error(e);
      alert("用語の解説の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [query, handleApiCall]);
  
  return (
    <div className="p-4 space-y-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">園芸用語辞典</h3>
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="例: 摘心" className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg pr-10" disabled={isLoading} />
            <button onClick={startListening} disabled={isLoading} className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}><MicrophoneIcon className="h-5 w-5" /></button>
          </div>
          <button onClick={handleSearch} disabled={isLoading || !query.trim()} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">検索</button>
        </div>
      </div>
      
      {isLoading && <div className="text-center p-4">AIが解説を生成しています...</div>}
      
      {result && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md fade-in">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">「{query}」の解説</h2>
          <FormattedContent content={result.text} />
        </div>
      )}
    </div>
  );
};

export default TermSearchPage;
