import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CultivationRecord, AppSettings, ApiCallHandler } from '../types';
import { getDailyQuote } from '../services/geminiService';
import { CULTIVATION_LANES, PASTEL_COLORS } from '../lib/constants';
import { toISODateString } from '../lib/utils';
import { LeafIcon, MoundIcon, RefreshIcon } from '../components/Icons';

type DashboardProps = { 
  records: CultivationRecord[];
  onLaneClick: (recordData: Partial<CultivationRecord>) => void;
  settings: AppSettings;
  handleApiCall: ApiCallHandler;
};

const Dashboard: React.FC<DashboardProps> = ({ records, onLaneClick, settings, handleApiCall }) => {
  const [tip, setTip] = useState('今日の一言を読み込み中...');
  const [isRefreshingTip, setIsRefreshingTip] = useState(false);
  
  const today = new Date();
  const formattedDate = `${today.toLocaleDateString()} (${['日', '月', '火', '水', '木', '金', '土'][today.getDay()]})`;
  const todayISO = toISODateString(today);

  const fetchQuote = useCallback(async (forceRefresh = false) => {
    if (!settings.enableAiFeatures) {
      setTip("AI機能は設定で無効になっています。");
      return;
    }
    
    if (forceRefresh) {
        setIsRefreshingTip(true);
    } else {
        setTip('AIが今日の一言を考えています...');
    }

    try {
      const quote = await handleApiCall(() => getDailyQuote(settings.dailyQuoteTheme, forceRefresh));
      if (quote) {
        setTip(quote);
      } else if (!forceRefresh) {
        setTip('一言の取得を中止しました。');
      }
    } catch (e: any) {
      console.error("Error fetching daily quote", e);
      if (!forceRefresh) {
        setTip('今日の一言の取得に失敗しました。');
      }
    } finally {
        if (forceRefresh) {
            setIsRefreshingTip(false);
        }
    }
  }, [settings.enableAiFeatures, settings.dailyQuoteTheme, handleApiCall]);

  useEffect(() => {
    fetchQuote(false);
  }, [fetchQuote]);

  const laneStatus = useMemo(() => {
    const status: { [key: string]: CultivationRecord } = {};
    const sorted = [...records].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    for (const record of sorted) {
      if (record.cultivationLane && !status[record.cultivationLane]) {
        status[record.cultivationLane] = record;
      }
    }
    return status;
  }, [records]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 p-3 rounded-xl shadow-md border border-green-200 dark:border-green-800">
        <div className="flex justify-between items-start">
            <div className="flex-grow pr-2">
                <h3 className="font-semibold text-green-800 dark:text-green-300 mb-1">{settings.dailyQuoteTheme.trim() || '今日は何の日？'}</h3>
                <p className="text-gray-600 dark:text-gray-400 italic text-base leading-tight h-10 overflow-hidden">
                    {tip}
                </p>
            </div>
            <button
                onClick={() => fetchQuote(true)}
                disabled={isRefreshingTip || !settings.enableAiFeatures}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 flex-shrink-0"
                aria-label="新しい一言を生成"
            >
                <RefreshIcon className={`h-5 w-5 ${isRefreshingTip ? 'animate-spin' : ''}`} />
            </button>
        </div>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">栽培レーンの状況</h2>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{formattedDate}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {CULTIVATION_LANES.map((lane, index) => {
            const current = laneStatus[lane];
            const todaysRecord = records.find(r => r.cultivationLane === lane && r.date === todayISO);

            const cardColor = PASTEL_COLORS[index % PASTEL_COLORS.length];
            const recordDataForClick: Partial<CultivationRecord> = todaysRecord || {
                cultivationLane: lane,
                cropName: current?.cropName || '',
                date: todayISO,
                seedPackagePhotoFront: current?.seedPackagePhotoFront,
                seedPackagePhotoBack: current?.seedPackagePhotoBack,
                aiPackageAnalysis: current?.aiPackageAnalysis,
                aiPestInfo: current?.aiPestInfo,
            };
            
            return (
              <button
                key={lane}
                onClick={() => onLaneClick(recordDataForClick)}
                className={`${cardColor} rounded-xl shadow-md h-auto min-h-[7rem] w-full hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transform transition-transform duration-200 overflow-hidden flex items-stretch`}
              >
                <div className="w-1/2 relative p-2 flex flex-col justify-center">
                    <p className="absolute top-2 left-2 font-semibold text-sm text-gray-700">{lane}</p>
                    <div className="text-center px-1">
                        {current ? (
                            <p className="font-bold text-base leading-tight text-green-800 whitespace-normal break-words">{current.cropName}</p>
                        ) : (
                            <p className="text-gray-600 font-medium">根処理中</p>
                        )}
                    </div>
                </div>
                
                <div className="w-1/2 flex items-center justify-center rounded-r-xl py-2 px-1">
                  {current ? (
                      (current.photoBase64 || current.seedPackagePhotoFront) ? (
                          <img src={current.photoBase64 || current.seedPackagePhotoFront} alt={current.cropName} className="max-w-full max-h-full object-contain" />
                      ) : (
                          <div className="w-full h-full flex items-center justify-center">
                              <LeafIcon className="h-8 w-8 text-gray-400 opacity-50"/>
                          </div>
                      )
                  ) : (
                      <div className="w-full h-full flex items-center justify-center">
                          <MoundIcon className="h-10 w-10 text-gray-400 dark:text-gray-500 opacity-60"/>
                      </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;