

import React, { useState, useCallback } from 'react';
import { PlantingRecommendation, ApiCallHandler, AppSettings, CultivationRecord } from '../types';
import { getPlantingRecommendations } from '../services/geminiService';

type PageProps = {
  handleApiCall: ApiCallHandler;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  records: CultivationRecord[];
  pageParams: any;
};

interface PlantableVegetable {
  name: string;
  family: string;
  difficulty: 'A' | 'B' | 'C';
  period: string;
}

const plantableVegetables: PlantableVegetable[] = [
  { name: '小松菜', family: 'アブラナ科', difficulty: 'A', period: '1〜12月' },
  { name: '水菜', family: 'アブラナ科', difficulty: 'A', period: '1〜12月' },
  { name: 'チンゲン菜', family: 'アブラナ科', difficulty: 'A', period: '1〜12月' },
  { name: 'ルッコラ', family: 'アブラナ科', difficulty: 'A', period: '1〜12月' },
  { name: '空心菜（エンサイ）', family: 'ヒルガオ科', difficulty: 'A', period: '3〜12月' },
  { name: '白菜（春夏）', family: 'アブラナ科', difficulty: 'B', period: '2〜5月' },
  { name: '白菜（秋冬）', family: 'アブラナ科', difficulty: 'B', period: '9〜12月' },
  { name: 'キャベツ（春）', family: 'アブラナ科', difficulty: 'B', period: '2〜5月' },
  { name: 'キャベツ（冬）', family: 'アブラナ科', difficulty: 'B', period: '9〜12月' },
  { name: '葉ネギ', family: 'ヒガンバナ科', difficulty: 'A', period: '1〜12月' },
  { name: 'ワケネギ', family: 'ヒガンバナ科', difficulty: 'A', period: '1〜12月' },
  { name: '玉ネギ', family: 'ヒガンバナ科', difficulty: 'A', period: '9〜6月' },
  { name: 'ミニ玉ネギ', family: 'ヒガンバナ科', difficulty: 'A', period: '1〜12月' },
  { name: 'ニラ', family: 'ヒガンバナ科', difficulty: 'A', period: '1〜12月' },
  { name: '玉レタス', family: 'キク科', difficulty: 'A', period: '10〜5月' },
  { name: 'サニーレタス', family: 'キク科', difficulty: 'A', period: '10〜5月' },
  { name: 'リーフレタス', family: 'キク科', difficulty: 'A', period: '10〜5月' },
  { name: 'エンダイブ', family: 'キク科', difficulty: 'A', period: '10〜5月' },
  { name: 'サラダ菜 他', family: 'キク科', difficulty: 'A', period: '10〜5月' },
  { name: '春菊', family: 'キク科', difficulty: 'A', period: '1〜12月' },
  { name: 'エシャレット', family: 'ヒガンバナ科', difficulty: 'A', period: '8〜4月' },
  { name: '枝豆', family: 'マメ科', difficulty: 'A', period: '3〜10月' },
  { name: 'インゲン(つる無し)', family: 'マメ科', difficulty: 'A', period: '1〜10月' },
  { name: 'そら豆', family: 'マメ科', difficulty: 'B', period: '10〜5月' },
  { name: 'サヤエンドウ(つる無し)', family: 'マメ科', difficulty: 'A', period: '10〜4月' },
  { name: 'ブロッコリー（茎）', family: 'アブラナ科', difficulty: 'A', period: '9〜12月' },
  { name: 'ブロッコリー', family: 'アブラナ科', difficulty: 'A', period: '9〜1月' },
  { name: 'カリフラワー', family: 'アブラナ科', difficulty: 'A', period: '9〜12月' },
  { name: 'ベビーリーフ', family: 'アブラナ科', difficulty: 'A', period: '1〜12月' },
  { name: 'のらぼう菜', family: 'アブラナ科', difficulty: 'A', period: '10〜4月' },
  { name: 'コールラビ', family: 'アブラナ科', difficulty: 'A', period: '9〜12月' },
  { name: 'スイスチャード', family: 'ヒユ科', difficulty: 'A', period: '4〜12月' },
  { name: 'ホウレンソウ', family: 'ヒユ科', difficulty: 'A', period: '9〜5月' },
  { name: 'シソ', family: 'シソ科', difficulty: 'A', period: '4〜9月' },
  { name: 'ハーブ類', family: 'シソ科', difficulty: 'A', period: '4〜9月' },
  { name: 'パクチー', family: 'セリ科', difficulty: 'A', period: '3〜12月' },
  { name: 'ミツバ', family: 'セリ科', difficulty: 'A', period: '4〜7月' },
  { name: 'クレソン', family: 'セリ科', difficulty: 'A', period: '4〜7月' },
  { name: 'セロリ', family: 'セリ科', difficulty: 'A', period: '3〜8月' },
  { name: 'パセリ', family: 'セリ科', difficulty: 'A', period: '1〜12月' },
  { name: 'ツルムラサキ', family: 'ツルムラサキ科', difficulty: 'A', period: '4〜9月' },
  { name: 'みょうが', family: 'ショウガ科', difficulty: 'A', period: '3〜10月' },
  { name: 'じゃがいも', family: 'ナス科', difficulty: 'C', period: '3〜7月' },
  { name: '落花生', family: 'マメ科', difficulty: 'C', period: '5〜10月' },
  { name: 'ニンジン(短根)', family: 'セリ科', difficulty: 'B', period: '1〜12月' },
  { name: 'ミニニンジン', family: 'セリ科', difficulty: 'B', period: '8〜5月' },
  { name: 'さつま菜', family: 'アブラナ科', difficulty: 'C', period: '4〜10月' },
  { name: 'コカブ', family: 'アブラナ科', difficulty: 'A', period: '9〜6月' },
  { name: 'ラディッシュ', family: 'アブラナ科', difficulty: 'A', period: '9〜6月' },
  { name: 'ミニ大根', family: 'アブラナ科', difficulty: 'A', period: '9〜6月' },
  { name: 'きゅうり', family: 'ウリ科', difficulty: 'C', period: '4〜9月' },
  { name: 'メロン', family: 'ウリ科', difficulty: 'C', period: '4〜9月' },
  { name: 'かぼちゃ(小玉)', family: 'ウリ科', difficulty: 'B', period: '4〜9月' },
  { name: 'スイカ(小玉)', family: 'ウリ科', difficulty: 'C', period: '4〜9月' },
  { name: 'ズッキーニ', family: 'ウリ科', difficulty: 'A', period: '4〜9月' },
  { name: 'オクラ', family: 'アオイ科', difficulty: 'B', period: '3〜11月' },
  { name: '大玉トマト', family: 'ナス科', difficulty: 'C', period: '4〜9月' },
  { name: '中玉トマト', family: 'ナス科', difficulty: 'B', period: '4〜9月' },
  { name: 'ミニトマト', family: 'ナス科', difficulty: 'B', period: '4〜9月' },
  { name: '長ナス・ナス', family: 'ナス科', difficulty: 'B', period: '4〜9月' },
  { name: 'トウガラシ', family: 'ナス科', difficulty: 'B', period: '4〜10月' },
  { name: 'シシトウガラシ', family: 'ナス科', difficulty: 'A', period: '4〜10月' },
  { name: 'パプリカ', family: 'ナス科', difficulty: 'B', period: '4〜10月' },
  { name: 'ピーマン', family: 'ナス科', difficulty: 'B', period: '4〜10月' },
];

const PlantingRecommendationSearchPage: React.FC<PageProps> = ({ handleApiCall }) => {
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [difficulty, setDifficulty] = useState<'low' | 'medium' | 'high'>('low');
  const [results, setResults] = useState<PlantingRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const difficulties = [
    { value: 'low', label: 'やさしい (A)' },
    { value: 'medium', label: 'ふつう (B)' },
    { value: 'high', label: 'むずかしい (C)' },
  ] as const;

  const handleMonthToggle = (month: number) => {
    setSelectedMonths(prev =>
      prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month].sort((a,b) => a-b)
    );
  };

  const handleSearch = useCallback(async () => {
    if (selectedMonths.length === 0) {
      alert("月を1つ以上選択してください。");
      return;
    }
    
    setIsLoading(true);
    setResults([]);
    
    const vegetableNames = plantableVegetables.map(v => v.name);

    try {
      const recommendations = await handleApiCall(() => getPlantingRecommendations(selectedMonths, difficulty, vegetableNames));
      if (recommendations) {
        setResults(recommendations);
      }
    } catch (error) {
      console.error("Failed to get planting recommendations:", error);
      alert("おすすめの取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonths, difficulty, handleApiCall]);

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">作付け時期（複数選択可）</label>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {months.map(month => {
              const isSelected = selectedMonths.includes(month);
              return (
                <button
                  key={month}
                  onClick={() => handleMonthToggle(month)}
                  className={`p-2 rounded-lg text-sm font-semibold transition-colors ${
                    isSelected ? 'bg-green-600 text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'
                  }`}
                >
                  {month}月
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">栽培の難易度</label>
          <div className="flex rounded-lg shadow-sm">
            {difficulties.map((d, index) => (
              <button
                key={d.value}
                onClick={() => setDifficulty(d.value)}
                className={`flex-1 px-4 py-2 text-sm transition-colors ${
                  difficulty === d.value ? 'bg-green-600 text-white font-semibold' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'
                } ${index === 0 ? 'rounded-l-lg' : ''} ${index === difficulties.length - 1 ? 'rounded-r-lg' : ''}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={selectedMonths.length === 0 || isLoading}
          className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>AIが検索中...</span>
            </>
          ) : (
            'この条件で検索する'
          )}
        </button>
      </div>

      {(isLoading || results.length > 0) && (
        <div className="space-y-3">
           <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">AIのおすすめ</h3>
          {isLoading && <div className="text-center p-4">AIが最適な作物を考えています...</div>}
          {results.map((veg, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md fade-in">
              <h4 className="font-bold text-lg text-green-800 dark:text-green-300">{veg.vegetableName}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">作付け時期: {veg.plantingMonths}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-2">{veg.reason}</p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">作付け可能リスト</h3>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400 sticky top-0">
              <tr>
                <th scope="col" className="py-3 px-4">品目名</th>
                <th scope="col" className="py-3 px-4">科</th>
                <th scope="col" className="py-3 px-4">難易度</th>
                <th scope="col" className="py-3 px-4">適用期間</th>
              </tr>
            </thead>
            <tbody>
              {plantableVegetables.map((veg, index) => (
                <tr key={index} className="bg-white border-b dark:bg-gray-800 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <th scope="row" className="py-2 px-4 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                    {veg.name}
                  </th>
                  <td className="py-2 px-4">{veg.family}</td>
                  <td className="py-2 px-4">{veg.difficulty}</td>
                  <td className="py-2 px-4">{veg.period}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PlantingRecommendationSearchPage;