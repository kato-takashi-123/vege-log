import React, { useState, useMemo } from 'react';
import { CultivationRecord } from '../types';
import { toISODateString, getDayInfo, parseDateString } from '../lib/utils';
import { RecordCard } from '../components/common/RecordCard';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/Icons';

const CalendarHistoryPage: React.FC<{
  records: CultivationRecord[];
  startOfWeek: 'sunday' | 'monday';
  onRecordClick: (record: CultivationRecord) => void;
}> = ({ records, startOfWeek, onRecordClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterCrop, setFilterCrop] = useState('');

  const uniqueCrops = useMemo(() => [...new Set(records.map(r => r.cropName))], [records]);

  const recordsByDate = useMemo(() => {
    return records.reduce((acc, record) => {
      const dateKey = record.date;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(record);
      return acc;
    }, {} as Record<string, CultivationRecord[]>);
  }, [records]);

  const selectedRecords = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = toISODateString(selectedDate);
    const dayRecords = (recordsByDate[dateKey] || []).filter(r => !filterCrop || r.cropName === filterCrop);
    return dayRecords.sort((a, b) => a.cultivationLane.localeCompare(b.cultivationLane, undefined, { numeric: true }));
  }, [selectedDate, recordsByDate, filterCrop]);

  const filteredRecordsList = useMemo(() => {
    if (!filterCrop) return [];

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    threeMonthsAgo.setHours(0, 0, 0, 0);

    return records
        .filter(r => r.cropName === filterCrop && parseDateString(r.date) >= threeMonthsAgo)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  }, [records, filterCrop]);

  const changeMonth = (amount: number) => {
    setSelectedDate(null);
    setCurrentDate(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + amount, 1);
      return newDate;
    });
  };

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const numDays = endOfMonth.getDate();
  
  let firstDayOfMonth = startOfMonth.getDay();
  if (startOfWeek === 'monday') {
      firstDayOfMonth = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;
  }

  const weekHeaderLabels = startOfWeek === 'sunday' 
    ? ['日', '月', '火', '水', '木', '金', '土']
    : ['月', '火', '水', '木', '金', '土', '日'];
    
  const weekHeaderColors = startOfWeek === 'sunday'
    ? ['text-red-500', '', '', '', '', '', 'text-blue-500']
    : ['', '', '', '', '', 'text-blue-500', 'text-red-500'];

  const daysInGrid = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysInGrid.push(<div key={`blank-${i}`} className="border-r border-b dark:border-gray-700 h-12"></div>);
  }

  const recordsForCalendar = useMemo(() => {
      if (!filterCrop) return recordsByDate;
      return records.filter(r => r.cropName === filterCrop).reduce((acc, record) => {
          const dateKey = record.date;
          if (!acc[dateKey]) acc[dateKey] = [];
          acc[dateKey].push(record);
          return acc;
      }, {} as Record<string, CultivationRecord[]>);
  }, [records, filterCrop, recordsByDate]);

  for (let day = 1; day <= numDays; day++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateKey = toISODateString(date);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    const isSelected = selectedDate?.toDateString() === date.toDateString();
    const hasRecord = !!recordsForCalendar[dateKey];
    const { isHoliday, isSaturday, isSunday } = getDayInfo(date);

    let dayColor = '';
    if (isHoliday) dayColor = 'text-pink-600';
    else if (isSunday) dayColor = 'text-red-500';
    else if (isSaturday) dayColor = 'text-blue-500';

    daysInGrid.push(
      <div key={day} className="border-r border-b dark:border-gray-700 h-12">
        <button
          onClick={() => setSelectedDate(date)}
          className={`w-full h-full relative rounded-md text-sm transition-colors ${
            isSelected ? 'bg-green-600 text-white font-bold' : isToday ? 'ring-2 ring-green-500' : 'hover:bg-green-100 dark:hover:bg-green-800/50'
          }`}
        >
          <span className={`absolute top-1 left-1 ${isSelected ? 'text-white' : dayColor}`}>{day}</span>
          {hasRecord && <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-green-500'}`}></div>}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
        <label htmlFor="crop-filter" className="block text-sm font-medium text-gray-700 dark:text-gray-300">作物で絞り込み</label>
        <select
          id="crop-filter"
          value={filterCrop}
          onChange={e => { setFilterCrop(e.target.value); setSelectedDate(null); }}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:bg-gray-700 dark:border-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
        >
          <option value="">すべての作物</option>
          {uniqueCrops.map(crop => <option key={crop} value={crop}>{crop}</option>)}
        </select>
      </div>
      
      {filterCrop ? (
        <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 text-center">「{filterCrop}」の記録 (過去3ヶ月)</h3>
            {filteredRecordsList.length > 0 ? (
                filteredRecordsList.map(record => <RecordCard key={record.id} record={record} onClick={() => onRecordClick(record)} />)
            ) : (
                <div className="text-center py-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                    <p className="text-gray-500 dark:text-gray-400">この期間の記録はありません。</p>
                </div>
            )}
        </div>
      ) : (
      <>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeftIcon className="h-6 w-6" /></button>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h2>
            <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRightIcon className="h-6 w-6" /></button>
          </div>
          <div className="grid grid-cols-7 border-t border-l dark:border-gray-700">
            {weekHeaderLabels.map((day, index) => (
              <div key={day} className={`text-center font-semibold text-sm py-2 border-r border-b dark:border-gray-700 ${weekHeaderColors[index]}`}>
                {day}
              </div>
            ))}
            {daysInGrid}
          </div>
        </div>

        {selectedDate && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 text-center">{selectedDate.toLocaleDateString()}の記録</h3>
            {selectedRecords.length > 0 ? (
              selectedRecords.map(record => <RecordCard key={record.id} record={record} onClick={() => onRecordClick(record)} />)
            ) : (
              <div className="text-center py-6 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                <p className="text-gray-500 dark:text-gray-400">この日の記録はありません。</p>
              </div>
            )}
          </div>
        )}
      </>
      )}
    </div>
  );
};

export default CalendarHistoryPage;
