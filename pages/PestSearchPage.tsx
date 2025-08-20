
import React, { useState, useCallback, useRef } from 'react';
import { PestInfo, AppSettings, CultivationRecord } from '../types';
import { searchPestInfo } from '../services/geminiService';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { fileToGenerativePart } from '../lib/utils';
import { FormattedContent } from '../components/common/FormattedContent';
import { ImageSourceModal } from '../components/modals';
import { CameraIcon, MicrophoneIcon, CloseIcon } from '../components/Icons';
import { ApiCallHandler } from '../types';

type PageProps = {
  handleApiCall: ApiCallHandler;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  records: CultivationRecord[];
  pageParams: any;
};

const PestSearchPage: React.FC<PageProps> = ({ handleApiCall }) => {
  const [query, setQuery] = useState('');
  const [image, setImage] = useState<{ file: File, preview: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PestInfo | null>(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  const { isListening, startListening } = useVoiceRecognition({ onResult: setQuery });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage({ file, preview: URL.createObjectURL(file) });
      setResult(null);
    }
    e.target.value = '';
  };
  
  const handleSourceSelect = (source: 'camera' | 'gallery') => {
      if (source === 'camera') {
        cameraInputRef.current?.click();
      } else {
        galleryInputRef.current?.click();
      }
      setIsSourceModalOpen(false);
  };

  const handleSearch = useCallback(async () => {
    if (!query.trim() && !image) return;
    setIsLoading(true);
    setResult(null);
    try {
      const imagePart = image ? await fileToGenerativePart(image.file) : undefined;
      const info = await handleApiCall(() => searchPestInfo(query, imagePart));
      if (info) setResult(info);
    } catch (e) {
      console.error(e);
      alert("情報の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [query, image, handleApiCall]);

  const SummaryCard: React.FC<{title: string; content: string}> = ({title, content}) => (
    <div className="bg-lime-50 dark:bg-lime-900/30 p-3 rounded-lg">
      <h4 className="font-bold text-lime-800 dark:text-lime-300 text-sm">{title}</h4>
      <p className="text-lime-900 dark:text-lime-200 text-sm mt-1">{content}</p>
    </div>
  );
  
  return (
    <>
      <ImageSourceModal
        isOpen={isSourceModalOpen}
        onClose={() => setIsSourceModalOpen(false)}
        onSelect={handleSourceSelect}
      />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageChange} className="hidden" />
      <input type="file" accept="image/*" ref={galleryInputRef} onChange={handleImageChange} className="hidden" />

      <div className="p-4 space-y-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md space-y-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">病害虫・症状検索</h3>
          <div className="relative">
            <textarea value={query} onChange={e => setQuery(e.target.value)} rows={2} placeholder="症状を入力 (例: 葉に白い斑点がある)" className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg pr-24" disabled={isLoading}></textarea>
             <div className="absolute right-2 top-2 flex items-center gap-1">
                <button onClick={() => setIsSourceModalOpen(true)} disabled={isLoading} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"><CameraIcon className="h-5 w-5" /></button>
                <button onClick={startListening} disabled={isLoading} className={`p-2 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}><MicrophoneIcon className="h-5 w-5" /></button>
            </div>
          </div>
          <button onClick={handleSearch} disabled={isLoading || (!query.trim() && !image)} className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400">検索</button>

          {image && (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border">
              <img src={image.preview} alt="upload preview" className="w-full h-full object-cover" />
              <button onClick={() => setImage(null)} className="absolute top-0.5 right-0.5 bg-black bg-opacity-50 text-white rounded-full p-0.5"><CloseIcon className="h-4 w-4" /></button>
            </div>
          )}
        </div>

        {isLoading && <div className="text-center p-4">AIが診断しています...</div>}

        {result && (
          <div className="space-y-4 fade-in">
            <h2 className="text-2xl font-bold text-center text-red-800 dark:text-red-300">{result.pestName}</h2>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md space-y-2">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">概要</h3>
              <SummaryCard title="特徴" content={result.summary.characteristics} />
              <SummaryCard title="原因" content={result.summary.causes} />
              <SummaryCard title="対策" content={result.summary.countermeasures} />
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md space-y-2">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-2">詳細情報</h3>
              <p><strong className="font-semibold">特徴:</strong> <FormattedContent content={result.details.characteristics} /></p>
              <p><strong className="font-semibold">原因:</strong> <FormattedContent content={result.details.causes} /></p>
              <p><strong className="font-semibold">対策:</strong> <FormattedContent content={result.details.countermeasures} /></p>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default PestSearchPage;
