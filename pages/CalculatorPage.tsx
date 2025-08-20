
import React, { useState, useEffect } from 'react';
import { AppSettings, CultivationRecord } from '../types';
import { FERTILIZERS } from '../lib/constants';
import { ApiCallHandler } from '../types';

type PageProps = {
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  handleApiCall: ApiCallHandler;
  records: CultivationRecord[];
  pageParams: any;
};

const CalculatorPage: React.FC<PageProps> = () => {
  const [activeTab, setActiveTab] = useState<'dilution' | 'stock'>('dilution');
  
  const [fertilizer, setFertilizer] = useState<'M-Plus-1' | 'M-Plus-2'>('M-Plus-1');
  const [waterAmount, setWaterAmount] = useState('8');
  const [dilution, setDilution] = useState('400');
  const [selectedDilution, setSelectedDilution] = useState('400');
  const [dilutionResult, setDilutionResult] = useState(0);

  const [stockSolutionVolume, setStockSolutionVolume] = useState('2');
  const [stockSolutionResult, setStockSolutionResult] = useState({ mPlus1: 15000, mPlus2: 10000 });

  useEffect(() => {
    const water = parseFloat(waterAmount) || 0;
    const dil = parseInt(dilution, 10) || 0;
    if (water > 0 && dil > 0) {
      const neededMl = (water * 1000) / dil;
      setDilutionResult(neededMl);
    } else {
      setDilutionResult(0);
    }
  }, [waterAmount, dilution]);

  useEffect(() => {
    const volume = parseFloat(stockSolutionVolume) || 0;
    if (volume > 0) {
        const mPlus1 = (volume / 100) * 15 * 1000;
        const mPlus2 = (volume / 100) * 10 * 1000;
        setStockSolutionResult({ mPlus1, mPlus2 });
    } else {
        setStockSolutionResult({ mPlus1: 0, mPlus2: 0 });
    }
  }, [stockSolutionVolume]);

  const capsNeeded = dilutionResult > 0 ? (dilutionResult / 5).toFixed(1) : 0;
  
  const dilutionOptions = ['200', '400', '600', '800', '1000', 'custom'];

  const handleDilutionSelect = (option: string) => {
    setSelectedDilution(option);
    if (option !== 'custom') {
      setDilution(option);
    }
  };
  
  return (
    <div className="p-4 space-y-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
        <div className="flex rounded-lg shadow-sm mb-4">
          <button
            onClick={() => setActiveTab('dilution')}
            className={`flex-1 px-4 py-3 text-sm font-semibold rounded-l-lg transition-colors ${
              activeTab === 'dilution'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
          >
            希釈液
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex-1 px-4 py-3 text-sm font-semibold rounded-r-lg transition-colors ${
              activeTab === 'stock'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
            }`}
          >
            原液
          </button>
        </div>

        {activeTab === 'dilution' && (
          <div className="space-y-4 fade-in">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">希釈液肥の作り方</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">液肥の種類</label>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(FERTILIZERS).map(([key, { name }]) => (
                  <button
                    key={key}
                    onClick={() => setFertilizer(key as 'M-Plus-1' | 'M-Plus-2')}
                    className={`p-2 rounded-lg text-sm transition-colors ${fertilizer === key ? 'bg-green-600 text-white font-semibold' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 mt-2 bg-gray-50 dark:bg-gray-700 p-2 rounded-md">
                <p><strong>使用目的:</strong> {FERTILIZERS[fertilizer].usage}</p>
                <p className="mt-1"><strong>主な成分:</strong> {FERTILIZERS[fertilizer].component}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">水の量（リットル）</label>
              <input type="number" value={waterAmount} onChange={e => setWaterAmount(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg" placeholder="例: 8" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">希釈倍率（倍）</label>
              <div className="grid grid-cols-3 gap-2">
                {dilutionOptions.map(opt => (
                  <button
                    key={opt}
                    onClick={() => handleDilutionSelect(opt)}
                    className={`p-2 rounded-lg text-sm transition-colors ${selectedDilution === opt ? 'bg-green-600 text-white font-semibold' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
                  >
                    {opt === 'custom' ? 'カスタム' : `${opt}倍`}
                  </button>
                ))}
              </div>
              {selectedDilution === 'custom' && (
                <input
                  type="number"
                  value={dilution}
                  onChange={e => setDilution(e.target.value)}
                  className="mt-2 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg"
                  placeholder="倍率を入力"
                />
              )}
            </div>
             <div className="bg-green-100 dark:bg-green-800/50 p-4 rounded-xl shadow-md text-center">
                <p className="text-sm font-medium text-green-800 dark:text-green-300">必要な液肥の量</p>
                <p className="text-4xl font-bold text-green-700 dark:text-green-400 my-2">{dilutionResult.toFixed(2)}<span className="text-lg ml-1">ml</span></p>
                <p className="text-green-600 dark:text-green-300">ペットボトルのキャップ 約 <span className="font-bold">{capsNeeded}</span> 杯分</p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">（スクリュー線の上ラインで約5ml）</p>
            </div>
          </div>
        )}

        {activeTab === 'stock' && (
          <div className="space-y-4 fade-in">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">原液（水耕標準培養液）の作り方</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">基本比率: 原液100Lあたり M-plus 1号 15kg、M-plus 2号 10kg</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">作りたい原液の量（リットル）</label>
              <input 
                  type="number" 
                  value={stockSolutionVolume} 
                  onChange={e => setStockSolutionVolume(e.target.value)} 
                  className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg" 
                  placeholder="例: 2" 
              />
            </div>
            <div className="bg-blue-100 dark:bg-blue-800/50 p-4 rounded-xl shadow-md text-center">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">必要な肥料の量</p>
                <div className="mt-2 text-blue-700 dark:text-blue-400 space-y-1">
                    <p className="text-2xl font-bold">
                        M-plus 1号: {stockSolutionResult.mPlus1.toLocaleString()}
                        <span className="text-lg ml-1">g</span>
                    </p>
                    <p className="text-2xl font-bold">
                        M-plus 2号: {stockSolutionResult.mPlus2.toLocaleString()}
                        <span className="text-lg ml-1">g</span>
                    </p>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalculatorPage;
