import React, { useState, useEffect, useMemo } from 'react';
import { CultivationRecord, AppSettings } from '../types';
import { getDailyQuote } from '../services/geminiService';
import { CULTIVATION_LANES, PASTEL_COLORS } from '../lib/constants';
import { toISODateString } from '../lib/utils';
import { LeafIcon, MoundIcon } from '../components/Icons';
import { ApiCallHandler } from '../App';

type DashboardProps = { 
  records: CultivationRecord[];
  onLaneClick: (recordData: Partial<CultivationRecord>) => void;
  settings: AppSettings;
  handleApiCall: ApiCallHandler;
};

const Dashboard: React.FC<DashboardProps> = ({ records, onLaneClick, settings, handleApiCall }) => {
  const [tip, setTip] = useState('今日の一言を読み込み中...');
  
  const today = new Date();
  const formattedDate = `${today.toLocaleDateString()} (${['日', '月', '火', '水', '木', '金', '土'][today.getDay()]})`;

  useEffect(() => {
    if (settings.enableAiFeatures) {
      setTip('AIが今日の一言を考えています...');
      const fetchQuote = async () => {
        try {
          const quote = await handleApiCall(() => getDailyQuote());
          if (quote) {
            setTip(quote);
          } else {
            setTip('一言の取得を中止しました。');
          }
        } catch (e: any) {
          console.error("Error fetching daily quote", e);
          setTip('今日の一言の取得に失敗しました。');
        }
      };
      fetchQuote();
    } else {
      setTip("AI機能は設定で無効になっています。");
    }
  }, [settings.enableAiFeatures, handleApiCall]);

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
        <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">今日の一言</h3>
        <p className="text-gray-600 dark:text-gray-400 italic text-lg whitespace-nowrap overflow-hidden text-ellipsis">{tip}</p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">栽培レーンの状況</h2>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{formattedDate}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {CULTIVATION_LANES.map((lane, index) => {
            const current = laneStatus[lane];
            const cardColor = PASTEL_COLORS[index % PASTEL_COLORS.length];
            const recordData = current ? current : { cultivationLane: lane, date: toISODateString(new Date()) };
            
            return (
              <button
                key={lane}
                onClick={() => onLaneClick(recordData)}
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
                
                <div className="w-1/2 flex items-center justify-center bg-black/5 dark:bg-black/20 rounded-r-xl py-2 px-1">
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
