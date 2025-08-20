
import React, { useState, useEffect } from 'react';
import { WeatherInfo, AppSettings, CultivationRecord, ApiCallHandler } from '../types';
import { getWeatherInfo } from '../services/geminiService';
import { parseDateString, getDayInfo } from '../lib/utils';

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
        const JP_HOLIDAYS: Record<string, string> = { "2024-01-01": "元日", "2025-01-01": "元日" }; // Simplified
        if (JP_HOLIDAYS[dateString]) return { color: 'text-pink-600 font-bold', label: dayLabel };
        if (dayOfWeek === 0) return { color: 'text-red-500', label: dayLabel };
        if (dayOfWeek === 6) return { color: 'text-blue-500', label: dayLabel };
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

    return (
        <div className="p-4 space-y-4">
            {isLoading && <div className="text-center p-8">{loadingMessage}</div>}
            {error && <div className="text-center p-8 text-red-600 dark:text-red-400">{error}</div>}

            {weather && (
              <div className="space-y-4 fade-in">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                    <p className="font-bold text-lg text-gray-800 dark:text-gray-200 text-center">{weather.location}</p>
                    <div className="flex items-center justify-around my-2">
                        <div className="w-20 h-20">{getWeatherIllustration(weather.current.weather)}</div>
                        <p className="text-5xl font-bold text-gray-800 dark:text-gray-200">{Math.round(weather.current.temperature)}<span className="text-2xl align-top">°C</span></p>
                        <div className="text-sm text-left">
                            <p className="text-gray-600 dark:text-gray-300">{weather.current.weather}</p>
                            <p className="text-gray-500 dark:text-gray-400">湿度: {weather.current.humidity}%</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-center">今日・明日の天気</h3>
                    <div className="grid grid-cols-2 divide-x dark:divide-gray-700">
                        {weather.weekly.slice(0, 2).map((day, index) => {
                             const dayStyle = getDayStyling(day.date);
                             return (
                                 <div key={index} className="px-2 text-center space-y-1">
                                    <p className="font-semibold text-gray-700 dark:text-gray-300">
                                        {index === 0 ? '今日' : '明日'}
                                        <span className={`ml-2 ${dayStyle.color}`}>
                                            {day.date.substring(5).replace('-', '/')} ({dayStyle.label})
                                        </span>
                                    </p>
                                    <div className="w-16 h-16 mx-auto">{getWeatherIllustration(day.weather)}</div>
                                    <p className="text-lg">
                                        <span className="font-bold text-red-500">{Math.round(day.temp_max)}°</span> / <span className="font-bold text-blue-500">{Math.round(day.temp_min)}°</span>
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">3時間ごとの予報</h3>
                    <div className="overflow-x-auto -mx-4 px-4 pb-2">
                        {(() => {
                            const hourlyData = weather.hourly.slice(0, 16);
                            if (hourlyData.length === 0) return null;
                            const temps = hourlyData.map(h => h.temperature);
                            const maxTemp = Math.ceil(Math.max(...temps));
                            const minTemp = Math.floor(Math.min(...temps));
                            const tempRange = maxTemp - minTemp || 1;
                            const chartHeight = 50;
                            const blockWidth = 64;
                            const chartWidth = hourlyData.length * blockWidth;

                            const points = hourlyData.map((hour, i) => {
                                const y = 5 + chartHeight - (((hour.temperature - minTemp) / tempRange) * chartHeight);
                                const x = i * blockWidth + blockWidth / 2;
                                return {x, y, temp: Math.round(hour.temperature)};
                            });
                            
                            const pathData = points.map((p, i) => (i === 0 ? 'M' : 'L') + `${p.x} ${p.y}`).join(' ');

                            return (
                                <div>
                                    <div className="relative" style={{ width: chartWidth, height: chartHeight + 25 }}>
                                        <svg width={chartWidth} height={chartHeight + 25} className="absolute top-0 left-0">
                                            <path d={pathData} fill="none" stroke="#f97316" strokeWidth="2" />
                                            {points.map((p, i) => (
                                                <g key={i}>
                                                    <circle cx={p.x} cy={p.y} r="3" fill="#f97316" />
                                                    <text x={p.x} y={p.y - 8} textAnchor="middle" fill="currentColor" className="text-xs font-semibold text-gray-700 dark:text-gray-300">{p.temp}°</text>
                                                </g>
                                            ))}
                                        </svg>
                                    </div>
                                    <div className="flex" style={{ width: chartWidth }}>
                                       {(() => {
                                            let lastDate: string | null = null;
                                            return hourlyData.map((hour, i) => {
                                                const showDate = hour.date !== lastDate;
                                                lastDate = hour.date;
                                                const dateObj = parseDateString(hour.date);
                                                const dayStyle = getDayStyling(hour.date);
                                                
                                                return (
                                                    <div key={i} className="flex-shrink-0 w-16 text-center space-y-1 relative pt-6">
                                                        {showDate && (
                                                            <div className="absolute -top-1 left-0 w-full text-center">
                                                                <p className={`text-xs font-bold ${dayStyle.color}`}>{`${dateObj.getMonth()+1}/${dateObj.getDate()}`}</p>
                                                            </div>
                                                        )}
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 h-4"></p>
                                                        <p className="font-semibold text-sm">{hour.time}</p>
                                                        <div className="w-10 h-10 mx-auto">{getWeatherIllustration(hour.weather)}</div>
                                                        <p className="text-xs h-4 overflow-hidden text-ellipsis">{hour.weather}</p>
                                                        <p className="text-xs text-blue-500">{hour.humidity}%</p>
                                                    </div>
                                                );
                                            });
                                       })()}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                    <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-2">週間予報</h3>
                    <div className="space-y-1">
                        {weather.weekly.slice(0, 5).map((day, index) => {
                            const dayStyle = getDayStyling(day.date);
                            return (
                                <div key={index} className="grid grid-cols-6 items-center text-sm p-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 gap-2">
                                    <p className={`font-semibold col-span-2 ${dayStyle.color}`}>{`${day.date.substring(5).replace('-', '/')}(${dayStyle.label})`}</p>
                                    <div className="flex items-center justify-center">
                                      <div className="w-8 h-8">{getWeatherIllustration(day.weather)}</div>
                                    </div>
                                    <p className="text-xs text-center text-gray-600 dark:text-gray-300">{day.weather}</p>
                                    <p className="text-right text-sm">
                                        <span className="font-bold text-red-500">{Math.round(day.temp_max)}°</span> / <span className="font-bold text-blue-500">{Math.round(day.temp_min)}°</span>
                                    </p>
                                    <p className="text-right font-semibold text-cyan-600 dark:text-cyan-400">{Math.round(day.pop * 100)}%</p>
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
