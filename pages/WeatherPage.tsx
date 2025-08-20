

import React, { useState, useEffect, useMemo } from 'react';
import { WeatherInfo, AppSettings, CultivationRecord, ApiCallHandler } from '../types';
import { getWeatherInfo } from '../services/geminiService';
import { parseDateString, getDayInfo, toISODateString } from '../lib/utils';

type PageProps = {
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  handleApiCall: ApiCallHandler;
  records: CultivationRecord[];
  pageParams: any;
};

const WeatherPage: React.FC<PageProps> = ({ settings }) => {
    const [weather, setWeather] = useState<WeatherInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const fetchWeather = async (location: string, apiKey?: string) => {
            if (!apiKey) {
                setError("OpenWeatherMap APIキーが設定されていません。設定ページで入力してください。");
                setIsLoading(false);
                return;
            }
            if (!location) {
                setError("天気予報エリアが設定されていません。設定ページで入力してください。");
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            setWeather(null);
            try {
                const data = await getWeatherInfo(location, apiKey);
                if (data) {
                    setWeather(data);
                } else {
                    setError(`「${location}」の天気情報の取得に失敗しました。`);
                }
            } catch (e: any) {
                console.error(`Failed to fetch weather for ${location}`, e);
                setError(e.message || `「${location}」の天気情報の取得に失敗しました。`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWeather(settings.weatherLocation, settings.openWeatherApiKey);
    }, [settings.weatherLocation, settings.openWeatherApiKey]);
    
    const getDayStyling = (dateString: string): { color: string; label: string } => {
        const date = parseDateString(dateString);
        const dayOfWeek = date.getDay();
        const dayLabel = ['日', '月', '火', '水', '木', '金', '土'][dayOfWeek];
        const { isHoliday, isSunday, isSaturday } = getDayInfo(date);
        if (isHoliday) return { color: 'text-pink-600 font-bold', label: dayLabel };
        if (isSunday) return { color: 'text-red-500 font-bold', label: dayLabel };
        if (isSaturday) return { color: 'text-blue-500 font-bold', label: dayLabel };
        return { color: 'text-gray-700 dark:text-gray-300', label: dayLabel };
    };

    const getWeatherIllustration = (weather: string, className: string = "w-full h-full"): React.ReactElement => {
      const simplified = (() => {
          if (weather.includes("雪")) return "snow";
          if (weather.includes("雷")) return "thunder";
          if (weather.includes("雨")) return "rain";
          if (weather.includes("晴") && weather.includes("曇")) return "cloudy-sun";
          if (weather.includes("曇") || weather.includes("霧")) return "cloudy";
          if (weather.includes("晴")) return "sunny";
          return "cloudy";
      })();

      switch (simplified) {
          case "sunny": return (<svg viewBox="0 0 64 64" className={className}><path d="M41 32c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" fill="#facc15"/><path d="M32 15V9m0 46v-6m15-17h6m-46 0h6m10.61-10.61l4.24-4.24M17.15 46.85l4.24-4.24m25.46 0l-4.24-4.24m-25.46-25.46l4.24 4.24" fill="none" stroke="#facc15" strokeMiterlimit="10" strokeWidth="2" strokeLinecap="round"/></svg>);
          case "rain": return (<svg viewBox="0 0 64 64" className={className}><path d="M47 43c0 5.52-4.48 10-10 10h-2c-5.52 0-10-4.48-10-10 0-4.75 3.31-8.72 7.76-9.72.63-5.22 5.14-9.28 10.5-9.28 5.8 0 10.5 4.7 10.5 10.5v1.09c3.34.82 5.74 3.86 5.74 7.41z" fill="#9ca3af"/><path d="M30 46v6m6-7v6m-12 1v6m6-7v6" fill="none" stroke="#60a5fa" strokeMiterlimit="10" strokeWidth="2" strokeLinecap="round"/></svg>);
          case "cloudy-sun": return (<svg viewBox="0 0 64 64" className={className}><path d="M47 43c0 5.52-4.48 10-10 10h-2c-5.52 0-10-4.48-10-10 0-4.75 3.31-8.72 7.76-9.72.63-5.22 5.14-9.28 10.5-9.28 4.25 0 7.91 2.53 9.49 6.13" fill="#9ca3af"/><path d="M30.94 18.05a9 9 0 1112.98 10.02" fill="#facc15"/></svg>);
          case "snow": return (<svg viewBox="0 0 64 64" className={className}><path d="M47 43c0 5.52-4.48 10-10 10h-2c-5.52 0-10-4.48-10-10 0-4.75 3.31-8.72 7.76-9.72.63-5.22 5.14-9.28 10.5-9.28 5.8 0 10.5 4.7 10.5 10.5v1.09c3.34.82 5.74 3.86 5.74 7.41z" fill="#9ca3af"/><path d="M30 46v6m0-3h-3m3 0h3m-3-10v6m0-3h-3m3 0h3m6-6v6m0-3h-3m3 0h3m-3-10v6m0-3h-3m3 0h3" stroke="#e5e7eb" strokeMiterlimit="10" strokeWidth="2" strokeLinecap="round"/></svg>);
          default: return (<svg viewBox="0 0 64 64" className={className}><path d="M47 43c0 5.52-4.48 10-10 10h-2c-5.52 0-10-4.48-10-10 0-4.75 3.31-8.72 7.76-9.72.63-5.22 5.14-9.28 10.5-9.28 5.8 0 10.5 4.7 10.5 10.5v1.09c3.34.82 5.74 3.86 5.74 7.41z" fill="#9ca3af"/><path d="M29.5 31.5c-4.42 0-8-3.58-8-8s3.58-8 8-8a8.34 8.34 0 015.55 2.12" fill="#d1d5db"/></svg>);
      }};

    const loadingMessage = `「${settings.weatherLocation}」の天気を読み込み中...`;

    const hourlyData = weather?.hourly.slice(0, 16) || [];
    const numHours = hourlyData.length;
    const colWidth = 64; // in pixels
    const rowHeaderWidth = 68; // in pixels

    const { points, pathData } = useMemo(() => {
        if (hourlyData.length === 0) return { points: [], pathData: '' };
        const temps = hourlyData.map(h => h.temperature);
        const maxTemp = Math.ceil(Math.max(...temps));
        const minTemp = Math.floor(Math.min(...temps));
        const tempRange = maxTemp - minTemp || 1;
        const tempChartHeight = 40;

        const pointsArr = hourlyData.map((hour, i) => {
            const y = tempChartHeight - (((hour.temperature - minTemp) / tempRange) * tempChartHeight);
            return {x: i * colWidth + colWidth / 2, y };
        });
        
        const path = pointsArr.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x} ${p.y}`).join(' ');
        return { points: pointsArr, pathData: path };
    }, [hourlyData]);
    
    const maxPrecipitation = useMemo(() => Math.max(...hourlyData.map(h => h.precipitation), 0.1), [hourlyData]);

    const RowHeader: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className }) => (
        <div className={`sticky left-0 bg-white dark:bg-gray-800 z-20 h-full flex items-center justify-end pr-2 font-bold text-xs text-right text-gray-500 dark:text-gray-400 ${className}`}>
            {children}
        </div>
    );
    
    const dateStr = currentTime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'short', day: 'numeric' });
    const timeStr = currentTime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
    const dayStylingForCurrent = getDayStyling(toISODateString(currentTime));

    return (
        <div className="p-4 space-y-4">
            {isLoading && <div className="text-center p-8">{loadingMessage}</div>}
            {error && <div className="text-center p-8 text-red-600 dark:text-red-400">{error}</div>}

            {weather && (
              <div className="space-y-4 fade-in">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                    <div className="flex justify-between items-center mb-2">
                        <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{weather.location}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {dateStr}
                            <span className={`px-1 ${dayStylingForCurrent.color}`}>({dayStylingForCurrent.label})</span>
                            {timeStr}
                        </p>
                    </div>
                    <div className="flex items-center justify-around">
                        <div className="w-20 h-20">{getWeatherIllustration(weather.current.weather)}</div>
                        <p className="text-5xl font-bold text-gray-800 dark:text-gray-200">{Math.round(weather.current.temperature)}<span className="text-2xl align-top">°C</span></p>
                        <div className="text-sm text-left">
                            <p className="text-gray-600 dark:text-gray-300">{weather.current.weather}</p>
                            <p className="text-gray-500 dark:text-gray-400">湿度: {weather.current.humidity}%</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 py-4 rounded-xl shadow-md">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2 px-4">3時間ごとの予報</h3>
                    <div className="overflow-x-auto pb-2">
                        <div className="inline-grid gap-y-1" style={{ gridTemplateColumns: `${rowHeaderWidth}px repeat(${numHours}, ${colWidth}px)` }}>
                            {/* Date & AM/PM Row */}
                            <RowHeader className="border-b dark:border-gray-700">日付</RowHeader>
                            {hourlyData.map((hour, i) => {
                                const dayStyle = getDayStyling(hour.date);
                                const dateObj = parseDateString(hour.date);
                                const showDate = hour.time === '06:00' || hour.time === '18:00';
                                return (
                                  <div key={i} className="text-center text-xs h-10 border-b dark:border-gray-700 flex flex-row items-center justify-center gap-1">
                                    <span className="font-bold text-gray-500 dark:text-gray-400">
                                        {hour.time === '00:00' ? 'AM' : hour.time === '12:00' ? 'PM' : ''}
                                    </span>
                                    <span className={`font-bold ${dayStyle.color}`}>
                                        {showDate ? `${dateObj.getMonth() + 1}/${dateObj.getDate()}` : ''}
                                    </span>
                                  </div>
                                );
                            })}

                            {/* Time Row */}
                            <RowHeader>時刻</RowHeader>
                            {hourlyData.map((hour, i) => (
                                <div key={i} className="h-6 flex items-center justify-center font-semibold text-xs">{hour.time}</div>
                            ))}

                            {/* Weather Icon Row */}
                            <RowHeader>天気</RowHeader>
                            {hourlyData.map((hour, i) => (
                                <div key={i} className="h-10 flex items-center justify-center">
                                    <div className="w-10 h-10 mx-auto">{getWeatherIllustration(hour.weather)}</div>
                                </div>
                            ))}
                            <RowHeader>{null}</RowHeader>
                            {hourlyData.map((hour, i) => (
                                <div key={i} className="h-8 text-xs flex items-center justify-center text-center overflow-hidden text-ellipsis">{hour.weather}</div>
                            ))}

                             {/* Temperature Chart Row */}
                            <RowHeader>気温</RowHeader>
                            <div className="relative h-10 bg-white dark:bg-gray-800" style={{ gridColumn: `2 / span ${numHours}` }}>
                                <svg width={numHours * colWidth} height={40} className="absolute left-0 top-0 z-10 pointer-events-none">
                                    <path d={pathData} fill="none" stroke="#f97316" strokeWidth="2" />
                                    {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="#f97316" />)}
                                </svg>
                            </div>
                            <RowHeader>(°C)</RowHeader>
                            {hourlyData.map((hour, i) => (
                                <div key={i} className="h-6 flex items-center justify-center font-semibold text-base text-orange-600 dark:text-orange-400">{Math.round(hour.temperature)}°</div>
                            ))}

                            {/* POP Row */}
                            <RowHeader>降水確率</RowHeader>
                            {hourlyData.map((hour, i) => (
                                <div key={i} className="h-6 flex items-center justify-center text-cyan-600 dark:text-cyan-400 text-xs font-semibold">{Math.round(hour.pop * 100)}%</div>
                            ))}

                            {/* Precipitation Bar Row */}
                            <RowHeader>降水量</RowHeader>
                            {hourlyData.map((hour, i) => {
                                const precipBarHeight = (hour.precipitation / maxPrecipitation) * 20;
                                return (
                                    <div key={i} className="h-6 flex items-center justify-center">
                                         <div className="h-full flex flex-col items-center justify-end">
                                            <div style={{ height: `${precipBarHeight}px`, minHeight: '1px', width: '10px' }} className={`bg-blue-400 rounded-t-sm ${hour.precipitation > 0 ? 'visible' : 'invisible'}`}></div>
                                        </div>
                                    </div>
                                );
                            })}
                            <RowHeader>(mm)</RowHeader>
                            {hourlyData.map((hour, i) => (
                                <div key={i} className="h-6 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">{hour.precipitation > 0 ? `${hour.precipitation.toFixed(1)}` : '-'}</div>
                            ))}

                            {/* Humidity Row */}
                            <RowHeader>湿度 (%)</RowHeader>
                            {hourlyData.map((hour, i) => (
                                <div key={i} className="h-6 flex items-center justify-center text-blue-500 text-xs">{hour.humidity}%</div>
                            ))}
                            
                            {/* Wind Row */}
                            <RowHeader>風</RowHeader>
                             {hourlyData.map((hour, i) => (
                                <div key={i} className="h-8 flex flex-col items-center justify-center">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{hour.windDirection}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{hour.windSpeed.toFixed(1)}<span className="text-[10px]">m/s</span></p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">週間予報</h3>
                    <div className="space-y-1">
                        <div className="grid grid-cols-10 items-center text-xs font-bold text-gray-500 dark:text-gray-400 px-1 gap-2 border-b dark:border-gray-700">
                            <p className="col-span-3">日付</p>
                            <p className="col-span-4">天気</p>
                            <p className="text-center col-span-2">気温 (°C)</p>
                            <p className="text-right col-span-1">降水</p>
                        </div>
                        {weather.weekly.map((day, index) => {
                            const dayStyle = getDayStyling(day.date);
                            return (
                                <div key={index} className="grid grid-cols-10 items-center text-sm p-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 gap-2">
                                    <p className={`font-semibold col-span-3 text-xs ${dayStyle.color}`}>{`${day.date.substring(5).replace('-', '/')}(${dayStyle.label})`}</p>
                                    <div className="flex items-center justify-start col-span-4 gap-1">
                                      <div className="w-8 h-8 flex-shrink-0">{getWeatherIllustration(day.weather)}</div>
                                      <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{day.weather}</span>
                                    </div>
                                    <p className="text-center col-span-2 text-sm">
                                        <span className="font-bold text-red-500">{Math.round(day.temp_max)}</span>
                                        <span className="text-gray-400">/</span>
                                        <span className="font-bold text-blue-500">{Math.round(day.temp_min)}</span>
                                    </p>
                                    <p className="text-right col-span-1 font-semibold text-cyan-600 dark:text-cyan-400 text-xs">{Math.round(day.pop * 100)}%</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
              </div>
            )}
        </div>
    );
};

export default WeatherPage;