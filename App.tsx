

import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { CultivationRecord, WorkType, ObservationStatus, PackageInfo, CropStage, WeatherInfo, PestInfo, VegetableInfo, PlantDiagnosis, FertilizerDetail, AppSettings } from './types';
import { getDailyQuote, getVegetableInfo, searchPestInfo, extractTextFromImage, analyzeSeedPackage, searchCommonPestsForCrop, searchRecipes, generateRecipeImage, AiSearchResult, searchGardeningTerm, getWeatherInfo, ApiRateLimitError, diagnosePlantHealth, identifyVegetableFromImage } from './services/geminiService';
import {
  SeedingIcon, PlantingIcon, FertilizingIcon, HarvestingIcon, PestControlIcon, WateringIcon, SeedlingCareIcon,
  CalculatorIcon, ExportIcon, CalendarIcon, CameraIcon, BackIcon, LeafIcon, FileImportIcon,
  HomeIcon, ToolsIcon, VegetableSearchIcon, PestSearchIcon, PinchingIcon, RecipeIcon, MicrophoneIcon, ImageIcon, ChevronLeftIcon, ChevronRightIcon,
  HamburgerIcon, CloseIcon, SettingsIcon, TrashIcon, RefreshIcon, RootTreatmentIcon, DiggingUpIcon, GerminationIcon, TrueLeavesIcon, PollinationIcon,
  DictionaryIcon, WeatherIcon, PaperPlaneIcon, SaveIcon, LogoutIcon, MoundIcon, VegetableBasketIcon,
  ObservationIcon, FaucetIcon, ExternalLinkIcon
} from './components/Icons';


// #region --- Constants & Types ---
const WORK_TYPE_DETAILS = {
  [WorkType.Watering]: { label: '水やり', Icon: WateringIcon, color: 'bg-cyan-500' },
  [WorkType.Fertilizing]: { label: '液肥', Icon: FertilizingIcon, color: 'bg-blue-500' },
  [WorkType.PestControl]: { label: '病害虫対策', Icon: PestControlIcon, color: 'bg-red-500' },
  [WorkType.RootTreatment]: { label: '根処理', Icon: RootTreatmentIcon, color: 'bg-yellow-600' },
  [WorkType.DiggingUp]: { label: '掘り返し', Icon: DiggingUpIcon, color: 'bg-stone-500' },
  [WorkType.PumiceWash]: { label: 'パミス洗い', Icon: FaucetIcon, color: 'bg-sky-500' },
};

const CROP_STAGE_DETAILS = {
  [CropStage.Seeding]: { label: '播種', Icon: SeedingIcon, color: 'bg-yellow-500' },
  [CropStage.SeedlingCare]: { label: '育苗', Icon: SeedlingCareIcon, color: 'bg-lime-500' },
  [CropStage.Germination]: { label: '発芽', Icon: GerminationIcon, color: 'bg-green-300' },
  [CropStage.TrueLeaves]: { label: '本葉', Icon: TrueLeavesIcon, color: 'bg-green-400' },
  [CropStage.Planting]: { label: '定植', Icon: PlantingIcon, color: 'bg-green-500' },
  [CropStage.Pinching]: { label: '摘心', Icon: PinchingIcon, color: 'bg-teal-500' },
  [CropStage.Pollination]: { label: '受粉', Icon: PollinationIcon, color: 'bg-pink-400' },
  [CropStage.Harvesting]: { label: '収穫', Icon: HarvestingIcon, color: 'bg-orange-500' },
};

const OBSERVATION_STATUS_DETAILS = {
  [ObservationStatus.Normal]: { label: '正常' },
  [ObservationStatus.Anomaly]: { label: '低成長' },
  [ObservationStatus.Pest]: { label: '病害虫' },
  [ObservationStatus.Deformation]: { label: '変色・変形' },
};

const FERTILIZERS = {
  'M-Plus-1': { name: 'エムプラス1号', component: '窒素、リン酸、カリウム', usage: '成長促進、栄養補給' },
  'M-Plus-2': { name: 'エムプラス2号', component: 'カルシウム、微量要素', usage: '品質向上、病害耐性強化' },
};

const CULTIVATION_LANES = [
  '①-1', '①-2', '②-1', '②-2', '③-1', '③-2',
  '④-1', '④-2', '⑤-1', '⑤-2', '⑥-1', '⑥-2'
];

const PASTEL_COLORS = [
  'bg-red-200', 'bg-pink-200', 'bg-orange-200', 'bg-yellow-200', 'bg-lime-200',
  'bg-green-200', 'bg-teal-200', 'bg-cyan-200', 'bg-sky-200', 'bg-blue-200',
  'bg-indigo-200', 'bg-purple-200'
];

const PET_BOTTLE_CAP_ML = 5;

const SETTINGS_KEY = 'veggieLogSettings';

type ApiCallHandler = <T>(apiCall: () => Promise<T>) => Promise<T | undefined>;

type RecordPageProps = {
  onSaveRecord: (record: CultivationRecord) => void;
  onBack: () => void;
  initialData?: Partial<CultivationRecord>;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  onDirtyChange: (isDirty: boolean) => void;
  onConfirmationRequest: (config: Omit<ConfirmationModalProps, 'isOpen' | 'onCancel'>) => void;
  handleApiCall: ApiCallHandler;
  records: CultivationRecord[];
  onClearFutureRecords: (lane: string, date: string) => void;
  onValidationError?: (message: string) => void;
};

type RecordPageHandle = {
  getRecordData: () => CultivationRecord;
  validate: () => string;
  handleSubmit: () => void;
};

// #endregion

// #region --- Helpers & Hooks ---

// --- Holiday Data (Simple) ---
const JP_HOLIDAYS: Record<string, string> = {
  // 2024
  "2024-01-01": "元日",
  "2024-01-08": "成人の日",
  "2024-02-11": "建国記念の日",
  "2024-02-12": "振替休日",
  "2024-02-23": "天皇誕生日",
  "2024-03-20": "春分の日",
  "2024-04-29": "昭和の日",
  "2024-05-03": "憲法記念日",
  "2024-05-04": "みどりの日",
  "2024-05-05": "こどもの日",
  "2024-05-06": "振替休日",
  "2024-07-15": "海の日",
  "2024-08-11": "山の日",
  "2024-08-12": "振替休日",
  "2024-09-16": "敬老の日",
  "2024-09-22": "秋分の日",
  "2024-09-23": "振替休日",
  "2024-10-14": "スポーツの日",
  "2024-11-03": "文化の日",
  "2024-11-04": "振替休日",
  "2024-11-23": "勤労感謝の日",
  // 2025
  "2025-01-01": "元日",
  "2025-01-13": "成人の日",
  "2025-02-11": "建国記念の日",
  "2025-02-23": "天皇誕生日",
  "2025-02-24": "振替休日",
  "2025-03-20": "春分の日",
  "2025-04-29": "昭和の日",
  "2025-05-03": "憲法記念日",
  "2025-05-04": "みどりの日",
  "2025-05-05": "こどもの日",
  "2025-05-06": "振替休日",
  "2025-07-21": "海の日",
  "2025-08-11": "山の日",
  "2025-09-15": "敬老の日",
  "2025-09-23": "秋分の日",
  "2025-10-13": "スポーツの日",
  "2025-11-03": "文化の日",
  "2025-11-24": "勤労感謝の日",
};

const getDayInfo = (date: Date): { isHoliday: boolean, isSaturday: boolean, isSunday: boolean } => {
    const dateString = toISODateString(date);
    const dayOfWeek = date.getDay();
    return {
        isHoliday: !!JP_HOLIDAYS[dateString],
        isSaturday: dayOfWeek === 6,
        isSunday: dayOfWeek === 0,
    };
};

const toISODateString = (date: Date): string => {
  const year = date.getFullYear();
  // getMonth() is 0-indexed, so we add 1.
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateString = (dateString: string): Date => {
  if (!dateString) return new Date();
  const parts = dateString.split('-').map(Number);
  // new Date(year, month-1, day) treats date string as local time, preventing timezone-related off-by-one errors.
  return new Date(parts[0], parts[1] - 1, parts[2]);
};

const fileToGenerativePart = async (file: File): Promise<{ mimeType: string, data: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = (reader.result as string).split(',')[1];
      resolve({ mimeType: file.type, data: base64Data });
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const useVoiceRecognition = ({ onResult }: { onResult: (text: string) => void }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported in this browser.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
    };
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error, event.message);
      let errorMessage = '音声認識中に不明なエラーが発生しました。';
      switch(event.error) {
          case 'network':
              errorMessage = '音声認識に失敗しました。ネットワーク接続を確認して、もう一度お試しください。';
              break;
          case 'no-speech':
              errorMessage = '音声が検出されませんでした。はっきりと話してみてください。';
              break;
          case 'audio-capture':
              errorMessage = 'マイクを認識できません。マイクのアクセス許可を確認してください。';
              break;
          case 'not-allowed':
              errorMessage = 'マイクの使用が許可されていません。ブラウザの設定でこのサイトのマイクアクセスを許可してください。';
              break;
      }
      alert(errorMessage);
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognitionRef.current = recognition;
  }, [onResult]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Could not start recognition", err);
      }
    }
  };

  return { isListening, startListening };
};

const exportRecordsToCsv = (records: CultivationRecord[]): string => {
    const headers = [
        'ID', '日付', '作物名', '栽培レーン', '作業種類', '作物の状況', 
        '観察記録', '病害虫詳細', 'メモ', 'M-plus 1号 倍率', 'M-plus 2号 倍率'
    ];

    const rows = records.map(r => {
        const details = Array.isArray(r.fertilizingDetails) 
            ? r.fertilizingDetails 
            : r.fertilizingDetails ? [r.fertilizingDetails] : [];
        
        const mPlus1 = details.find(d => d.fertilizerType === 'M-Plus-1');
        const mPlus2 = details.find(d => d.fertilizerType === 'M-Plus-2');

        const row = {
            id: r.id,
            date: r.date,
            cropName: r.cropName,
            cultivationLane: r.cultivationLane,
            workTypes: r.workTypes?.map(wt => WORK_TYPE_DETAILS[wt]?.label).join(', ') || '',
            cropStages: r.cropStages?.map(cs => CROP_STAGE_DETAILS[cs]?.label).join(', ') || '',
            observationStatus: r.observationStatus?.map(os => OBSERVATION_STATUS_DETAILS[os]?.label).join(', ') || '',
            pestDetails: r.pestDetails?.join(', ') || '',
            memo: r.memo.replace(/"/g, '""'),
            mPlus1Dilution: mPlus1?.dilution?.toString() || '',
            mPlus2Dilution: mPlus2?.dilution?.toString() || '',
        };
        return Object.values(row).map(val => `"${val}"`).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};

const getWeatherIllustration = (weather: string, className: string = "w-full h-full"): React.ReactElement => {
    const simplified = (() => {
        if (weather.includes("雪")) return "snow";
        if (weather.includes("雷")) return "thunder";
        if (weather.includes("雨")) return "rain";
        if (weather.includes("晴") && weather.includes("曇")) return "cloudy-sun";
        if (weather.includes("曇") || weather.includes("霧")) return "cloudy";
        if (weather.includes("晴")) return "sunny";
        return "cloudy"; // Default
    })();

    switch (simplified) {
        case "sunny":
            return (
                <svg viewBox="0 0 64 64" className={className}>
                    <path d="M41 32c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" fill="#facc15"/>
                    <path d="M32 15V9m0 46v-6m15-17h6m-46 0h6m10.61-10.61l4.24-4.24M17.15 46.85l4.24-4.24m25.46 0l-4.24-4.24m-25.46-25.46l4.24 4.24" fill="none" stroke="#facc15" strokeMiterlimit="10" strokeWidth="2" strokeLinecap="round"/>
                </svg>
            );
        case "rain":
            return (
                <svg viewBox="0 0 64 64" className={className}>
                    <path d="M47 43c0 5.52-4.48 10-10 10h-2c-5.52 0-10-4.48-10-10 0-4.75 3.31-8.72 7.76-9.72.63-5.22 5.14-9.28 10.5-9.28 5.8 0 10.5 4.7 10.5 10.5v1.09c3.34.82 5.74 3.86 5.74 7.41z" fill="#9ca3af"/>
                    <path d="M30 46v6m6-7v6m-12 1v6m6-7v6" fill="none" stroke="#60a5fa" strokeMiterlimit="10" strokeWidth="2" strokeLinecap="round"/>
                </svg>
            );
        case "cloudy-sun":
             return (
                <svg viewBox="0 0 64 64" className={className}>
                     <path d="M47 43c0 5.52-4.48 10-10 10h-2c-5.52 0-10-4.48-10-10 0-4.75 3.31-8.72 7.76-9.72.63-5.22 5.14-9.28 10.5-9.28 4.25 0 7.91 2.53 9.49 6.13" fill="#9ca3af"/>
                     <path d="M30.94 18.05a9 9 0 1112.98 10.02" fill="#facc15"/>
                </svg>
            );
        case "snow":
             return (
                <svg viewBox="0 0 64 64" className={className}>
                    <path d="M47 43c0 5.52-4.48 10-10 10h-2c-5.52 0-10-4.48-10-10 0-4.75 3.31-8.72 7.76-9.72.63-5.22 5.14-9.28 10.5-9.28 5.8 0 10.5 4.7 10.5 10.5v1.09c3.34.82 5.74 3.86 5.74 7.41z" fill="#9ca3af"/>
                    <path d="M30 46v6m0-3h-3m3 0h3m-3-10v6m0-3h-3m3 0h3m6-6v6m0-3h-3m3 0h3m-3-10v6m0-3h-3m3 0h3" stroke="#e5e7eb" strokeMiterlimit="10" strokeWidth="2" strokeLinecap="round"/>
                </svg>
             );
        default: // cloudy
             return (
                <svg viewBox="0 0 64 64" className={className}>
                    <path d="M47 43c0 5.52-4.48 10-10 10h-2c-5.52 0-10-4.48-10-10 0-4.75 3.31-8.72 7.76-9.72.63-5.22 5.14-9.28 10.5-9.28 5.8 0 10.5 4.7 10.5 10.5v1.09c3.34.82 5.74 3.86 5.74 7.41z" fill="#9ca3af"/>
                    <path d="M29.5 31.5c-4.42 0-8-3.58-8-8s3.58-8 8-8a8.34 8.34 0 015.55 2.12" fill="#d1d5db"/>
                </svg>
            );
    }
};

// #endregion

// #region --- UI Components ---

const ApiErrorModal: React.FC<{
  isOpen: boolean;
  error: any;
  onRetry: () => void;
  onStopAi: () => void;
}> = ({ isOpen, error, onRetry, onStopAi }) => {
  if (!isOpen) return null;
  
  const errorMessage = error?.originalError?.error?.message || error?.message || '不明なAPIエラーが発生しました。';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-red-600 dark:text-red-400">APIエラー</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">AIとの通信中にエラーが発生しました。</p>
        <div className="mt-4 text-xs text-left bg-gray-100 dark:bg-gray-700 p-2 rounded-md overflow-auto max-h-24">
            <code className="whitespace-pre-wrap break-words">{errorMessage}</code>
        </div>
        <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">どうしますか？</p>
        <div className="mt-6 flex flex-col gap-3">
          <button onClick={onRetry} className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700">
            再試行する
          </button>
          <button onClick={onStopAi} className="w-full bg-gray-500 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-gray-600">
            AIの利用を停止する
          </button>
        </div>
      </div>
    </div>
  );
};

const FloatingSaveButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="fixed bottom-20 right-4 z-30 bg-pink-400 text-white p-3 rounded-full shadow-lg hover:bg-pink-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-400 transform transition-transform hover:scale-110 fade-in"
    aria-label="保存"
    title="保存"
  >
    <SaveIcon className="h-6 w-6" />
  </button>
);

const FormattedContent: React.FC<{ content: string | string[] }> = ({ content }) => {
    const rawContent = Array.isArray(content) ? content.join('\n') : content;
    const lines = rawContent.split('\n').filter(line => line.trim() !== '');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const isListItem = line.startsWith('・') || line.startsWith('-') || line.startsWith('*');

        if (isListItem) {
            listItems.push(line.replace(/^[・*-]\s*/, ''));
        } else {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={`ul-${i}`} className="list-disc list-outside pl-5 space-y-1 my-2">
                        {listItems.map((item, index) => <li key={index}>{item}</li>)}
                    </ul>
                );
                listItems = [];
            }
            elements.push(<p key={`p-${i}`} className="my-1">{line}</p>);
        }
    }

    if (listItems.length > 0) {
        elements.push(
            <ul key="ul-last" className="list-disc list-outside pl-5 space-y-1 my-2">
                {listItems.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
        );
    }

    return <div className="text-gray-700 dark:text-gray-300 leading-relaxed">{elements.length > 0 ? elements : <p>{rawContent}</p>}</div>;
};

const Toast: React.FC<{ message: string }> = ({ message }) => (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-75 text-white text-lg font-semibold py-4 px-8 rounded-xl shadow-lg z-50 fade-in">
      {message}
    </div>
);

const SaveConfirmationModal: React.FC<{
  isOpen: boolean;
  onConfirm: () => void;
  onDeny: () => void;
  onClose: () => void;
}> = ({ isOpen, onConfirm, onDeny, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">変更の保存</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">編集中の内容が保存されていません。保存しますか？</p>
        <div className="mt-6 flex flex-col gap-3">
          <button onClick={onConfirm} className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700 transition-colors">
            はい、保存する
          </button>
          <button onClick={onDeny} className="w-full bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-bold py-2.5 px-4 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/70 transition-colors">
            いいえ、破棄する
          </button>
          <button onClick={onClose} className="w-full text-gray-600 dark:text-gray-300 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};

type ConfirmationModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText: string;
  cancelText?: string;
  confirmColor?: string;
};

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText = 'キャンセル',
  confirmColor = 'bg-red-600 hover:bg-red-700',
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{message}</p>
        <div className="mt-6 flex gap-4">
          <button onClick={onCancel} className="w-1/2 bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100 font-bold py-2.5 px-4 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`w-1/2 text-white font-bold py-2.5 px-4 rounded-lg transition-colors ${confirmColor}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const CalendarModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: Date) => void;
  initialDate: Date;
  startOfWeek: 'sunday' | 'monday';
}> = ({ isOpen, onClose, onSelectDate, initialDate, startOfWeek }) => {
  if (!isOpen) return null;

  const [currentDisplayDate, setCurrentDisplayDate] = useState(initialDate);

  const changeMonth = (amount: number) => {
    setCurrentDisplayDate(prev => {
      const newDate = new Date(prev.getFullYear(), prev.getMonth() + amount, 1);
      return newDate;
    });
  };
  
  const startOfMonth = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), 1);
  const endOfMonth = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth() + 1, 0);
  const numDays = endOfMonth.getDate();
  
  let firstDayOfMonth = startOfMonth.getDay(); // Sunday is 0
  if (startOfWeek === 'monday') {
      firstDayOfMonth = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1; // Monday is 0
  }

  const weekHeaderLabels = startOfWeek === 'sunday' 
    ? ['日', '月', '火', '水', '木', '金', '土']
    : ['月', '火', '水', '木', '金', '土', '日'];
    
  const weekHeaderColors = startOfWeek === 'sunday'
    ? ['text-red-500', '', '', '', '', '', 'text-blue-500']
    : ['', '', '', '', '', 'text-blue-500', 'text-red-500'];

  const daysInGrid: React.ReactNode[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysInGrid.push(<div key={`blank-${i}`} className="h-10"></div>);
  }

  for (let day = 1; day <= numDays; day++) {
    const date = new Date(currentDisplayDate.getFullYear(), currentDisplayDate.getMonth(), day);
    const today = new Date();
    today.setHours(0,0,0,0);
    const isFuture = date > today;
    const isToday = date.toDateString() === new Date().toDateString();
    const isSelected = initialDate.toDateString() === date.toDateString();
    const { isHoliday, isSaturday, isSunday } = getDayInfo(date);

    let dayColor = '';
    if (isHoliday) dayColor = 'text-pink-600';
    else if (isSunday) dayColor = 'text-red-500';
    else if (isSaturday) dayColor = 'text-blue-500';

    daysInGrid.push(
      <div key={day} className="h-10 flex items-center justify-center">
        <button
          onClick={() => { if (!isFuture) onSelectDate(date); }}
          disabled={isFuture}
          className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
            isSelected ? 'bg-green-600 text-white font-bold' : 
            isToday ? 'ring-2 ring-green-500' : 
            isFuture ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' :
            'hover:bg-green-100 dark:hover:bg-green-800/50'
          }`}
        >
          <span className={`${isSelected ? 'text-white' : dayColor}`}>{day}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeftIcon className="h-6 w-6" /></button>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200">{currentDisplayDate.getFullYear()}年 {currentDisplayDate.getMonth() + 1}月</h2>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRightIcon className="h-6 w-6" /></button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {weekHeaderLabels.map((day, index) => (
            <div key={day} className={`font-semibold text-sm py-2 ${weekHeaderColors[index]}`}>
              {day}
            </div>
          ))}
          {daysInGrid}
        </div>
      </div>
    </div>
  );
};

type PageProps = {
  setPage: (page: string, params?: any) => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  onBack?: () => void;
  handleApiCall: ApiCallHandler;
  records: CultivationRecord[];
  pageParams?: any;
};

const PageHeader: React.FC<{ title: string; onBack?: () => void; onMenuClick?: () => void; }> = ({ title, onBack, onMenuClick }) => (
    <header className="bg-cyan-100 dark:bg-gray-800 shadow-sm sticky top-0 z-20 p-4 flex items-center justify-between h-12">
        <div className="w-10">
            {onBack && (
                <button onClick={onBack} className="p-2 rounded-full hover:bg-cyan-200 dark:hover:bg-gray-700">
                    <BackIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                </button>
            )}
        </div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-200 text-center absolute left-1/2 -translate-x-1/2">{title}</h1>
        <div className="flex items-center gap-1">
            {onMenuClick && (
                <button onClick={onMenuClick} className="p-2 rounded-full hover:bg-cyan-200 dark:hover:bg-gray-700">
                    <HamburgerIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
                </button>
            )}
        </div>
    </header>
);

const HamburgerMenu: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  setPage: (page: string) => void;
  activePage: string;
  onLogout: () => void;
}> = ({ isOpen, onClose, setPage, activePage, onLogout }) => {
  const menuItems = [
    { name: 'DASHBOARD', label: 'ホーム', icon: HomeIcon },
    { name: 'HISTORY', label: 'カレンダー', icon: CalendarIcon },
    { name: 'TOOLS', label: 'ツール', icon: ToolsIcon },
    { name: 'SETTINGS', label: '設定', icon: SettingsIcon },
  ];

  const handleNavigation = (page: string) => {
    setPage(page);
    onClose();
  };
  
  const getActiveTab = (page: string) => {
    if (['CALCULATOR', 'RECIPE_SEARCH', 'VEGETABLE_SEARCH', 'PEST_SEARCH', 'TERM_SEARCH', 'WEATHER', 'PLANT_DIAGNOSIS'].includes(page)) return 'TOOLS';
    if (menuItems.some(item => item.name === page)) return page;
    return 'DASHBOARD'; // Fallback
  };
  
  const currentTab = getActiveTab(activePage);

  return (
    <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className={`absolute top-0 right-0 h-full w-72 bg-white dark:bg-gray-900 shadow-xl transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700">
          <h2 className="font-bold text-lg text-gray-800 dark:text-gray-200">メニュー</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <CloseIcon className="h-6 w-6 text-gray-700 dark:text-gray-300" />
          </button>
        </div>
        <div className="p-2 flex flex-col justify-between" style={{ height: 'calc(100% - 65px)' }}>
          <nav>
            <ul>
              {menuItems.map(item => {
                const isActive = currentTab === item.name;
                return (
                  <li key={item.name}>
                    <button
                      onClick={() => handleNavigation(item.name)}
                      className={`w-full flex items-center gap-4 p-4 rounded-lg text-left text-base transition-colors ${isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    >
                      <item.icon className={`h-6 w-6 ${isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="p-2 border-t dark:border-gray-700 mt-2">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-4 p-4 rounded-lg text-left text-base transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
            >
              <LogoutIcon className="h-6 w-6 text-red-500 dark:text-red-400" />
              <span>ログアウト</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExportModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onExport: (range: string, startDate?: string, endDate?: string) => void;
  mode: 'email' | 'download';
}> = ({ isOpen, onClose, onExport, mode }) => {
  const [range, setRange] = useState('thisMonth');
  const [startDate, setStartDate] = useState(toISODateString(new Date()));
  const [endDate, setEndDate] = useState(toISODateString(new Date()));

  useEffect(() => {
    if (isOpen) {
      // Set a sensible default based on the mode
      const today = new Date();
      const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      if (mode === 'download') {
        setRange('all');
      } else { // email
        setRange('thisMonth');
        setStartDate(toISODateString(thisMonthStart));
        setEndDate(toISODateString(today));
      }
    }
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const ranges = [
    { value: 'all', label: 'すべての記録' },
    { value: 'today', label: '本日' },
    { value: 'thisWeek', label: '今週' },
    { value: 'thisMonth', label: '今月' },
    { value: 'lastMonth', label: '先月' },
    { value: 'custom', label: '期間を指定' },
  ];
  
  const handleExportClick = () => {
    if (range === 'custom') {
      if (startDate > endDate) {
        alert("開始日は終了日より前に設定してください。");
        return;
      }
      onExport(range, startDate, endDate);
    } else {
      onExport(range);
    }
  };
  
  const modalTexts = {
      email: {
          title: 'メールで記録を送信',
          description: '送信する記録の期間を選択してください。CSVファイルがダウンロードされ、メールアプリが開きます。',
          button: '送信準備',
      },
      download: {
          title: '記録をエクスポート',
          description: 'エクスポートする記録の期間を選択してください。CSVファイルがダウンロードされます。',
          button: 'エクスポート'
      }
  };
  const texts = modalTexts[mode];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center">{texts.title}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 text-center">{texts.description}</p>
        
        <div className="mt-6 text-left space-y-2 max-h-64 overflow-y-auto pr-2">
          {ranges.map(r => (
            <div key={r.value}>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                <input 
                  type="radio" 
                  name="export-range" 
                  value={r.value}
                  checked={range === r.value}
                  onChange={() => setRange(r.value)}
                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300"
                />
                <span className="text-base text-gray-700 dark:text-gray-200 font-medium">{r.label}</span>
              </label>
              {range === 'custom' && r.value === 'custom' && (
                <div className="pl-12 pr-4 pb-2 space-y-2 fade-in">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">開始日</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700" />
                    </div>
                     <span className="pt-5 text-gray-500 dark:text-gray-400">～</span>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600 dark:text-gray-300">終了日</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button onClick={handleExportClick} className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center justify-center gap-2">
            {mode === 'email' ? <PaperPlaneIcon className="h-5 w-5" /> : <ExportIcon className="h-5 w-5" />}
            <span>{texts.button}</span>
          </button>
          <button onClick={onClose} className="w-full text-gray-600 dark:text-gray-300 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};


const LoginPage: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-lime-50 dark:bg-gray-900 p-4">
      <div className="text-center mb-8">
        <VegetableBasketIcon className="h-20 w-20 text-green-600 mx-auto" />
        <h1 className="text-4xl font-bold text-green-800 dark:text-green-300 mt-4">ベジログ</h1>
        <p className="text-green-700 dark:text-green-400 mt-2">栽培記録アプリ</p>
      </div>
      <div className="w-full max-w-sm bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
        <h2 className="text-xl font-semibold text-center text-gray-700 dark:text-gray-200">ようこそ！</h2>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mt-2">あなたの栽培活動を記録しましょう。</p>
        <div className="mt-8">
          <button
            onClick={onLogin}
            className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors duration-300 text-lg"
          >
            アプリをはじめる
          </button>
        </div>
      </div>
    </div>
  );
};


const Dashboard: React.FC<{ 
  records: CultivationRecord[];
  onLaneClick: (recordData: Partial<CultivationRecord>) => void;
  settings: AppSettings;
  handleApiCall: ApiCallHandler;
}> = ({ records, onLaneClick, settings, handleApiCall }) => {
  const [tip, setTip] = useState('今日の一言を読み込み中...');
  
  const today = new Date();
  const formattedDate = `${today.toLocaleDateString()} (${['日', '月', '火', '水', '木', '金', '土'][today.getDay()]})`;

  useEffect(() => {
    if (settings.enableAiFeatures) {
      setTip('AIが今日の一句を考えています...');
      const fetchQuote = async () => {
        try {
          const quote = await handleApiCall(() => getDailyQuote());
          if (quote) {
            setTip(quote);
          } else {
            setTip('一句の取得を中止しました。');
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
                {/* Left Part: Info */}
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
                
                {/* Right Part: Photo */}
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

const ImageSourceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelect: (source: 'camera' | 'gallery') => void;
}> = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-4">画像を選択</h3>
        <div className="flex justify-around gap-4">
          <button onClick={() => onSelect('camera')} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-1/2">
            <CameraIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">カメラ</span>
          </button>
          <button onClick={() => onSelect('gallery')} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-1/2">
            <ImageIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">ギャラリー</span>
          </button>
        </div>
      </div>
    </div>
  );
};


const RecordPage = forwardRef<RecordPageHandle, RecordPageProps>(({ onSaveRecord, onBack, initialData, settings, onSettingsChange, onDirtyChange, onConfirmationRequest, handleApiCall, records, onClearFutureRecords, onValidationError }, ref) => {
  const [recordId, setRecordId] = useState(initialData?.id || new Date().toISOString());
  
  const [cropName, setCropName] = useState(initialData?.cropName || '');
  const [cultivationLane, setCultivationLane] = useState(initialData?.cultivationLane || CULTIVATION_LANES[0]);
  const [workTypes, setWorkTypes] = useState<WorkType[]>(initialData?.workTypes || []);
  const [cropStages, setCropStages] = useState<CropStage[]>(initialData?.cropStages || []);
  const [observationStatus, setObservationStatus] = useState<ObservationStatus[]>(initialData?.observationStatus || []);
  const [pestDetails, setPestDetails] = useState<string[]>(initialData?.pestDetails || []);
  const [customPest, setCustomPest] = useState('');
  const [memo, setMemo] = useState(initialData?.memo || '');
  const [photo, setPhoto] = useState<string | null>(initialData?.photoBase64 || null);
  const [seedPackageFront, setSeedPackageFront] = useState<string | null>(initialData?.seedPackagePhotoFront || null);
  const [seedPackageBack, setSeedPackageBack] = useState<string | null>(initialData?.seedPackagePhotoBack || null);
  const [recordDate, setRecordDate] = useState(initialData?.date || toISODateString(new Date()));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState<string | null>(null);
  const [imageSourceModal, setImageSourceModal] = useState<{ open: boolean; side: 'front' | 'back' } | null>(null);

  const initialFertilizerDetails = initialData?.fertilizingDetails;
  const [fertilizingDetails, setFertilizingDetails] = useState<FertilizerDetail[]>(
      initialFertilizerDetails 
      ? (Array.isArray(initialFertilizerDetails) ? initialFertilizerDetails : [initialFertilizerDetails as any]) 
      : []
  );

  const [dilutionButtons, setDilutionButtons] = useState<Record<string, string>>(() => {
    const initialState: Record<string, string> = {};
    const details = initialFertilizerDetails ? (Array.isArray(initialFertilizerDetails) ? initialFertilizerDetails : [initialFertilizerDetails as any]) : [];
    details.forEach(detail => {
      const optionExists = ['200', '400', '600', '800', '1000'].includes(String(detail.dilution));
      initialState[detail.fertilizerType] = optionExists ? String(detail.dilution) : 'custom';
    });
    return initialState;
  });

  const dilutionOptions = ['200', '400', '600', '800', '1000'];

  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(initialData?.aiPackageAnalysis || null);
  const [pestInfo, setPestInfo] = useState<string[] | null>(initialData?.aiPestInfo || null);
  const [isAnalyzingPackage, setIsAnalyzingPackage] = useState(false);
  const [isSearchingPests, setIsSearchingPests] = useState(false);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const memoOcrCameraRef = useRef<HTMLInputElement>(null);
  const memoOcrGalleryRef = useRef<HTMLInputElement>(null);
  const stopAnalysisRef = useRef(false);

  const { isListening: isListeningCropName, startListening: startListeningCropName } = useVoiceRecognition({ onResult: setCropName });
  const { isListening: isListeningMemo, startListening: startListeningMemo } = useVoiceRecognition({ onResult: setMemo });
  const { isListening: isListeningPest, startListening: startListeningPest } = useVoiceRecognition({ onResult: setCustomPest });

  const recordDateObj = useMemo(() => parseDateString(recordDate), [recordDate]);

  const initialFormStateRef = useRef<any>(null);
  
  const showPestDetails = observationStatus.includes(ObservationStatus.Pest);

  useEffect(() => {
    const initialFertilizerDetailsValue = initialData?.fertilizingDetails;
    const initialFertilizerArray = initialFertilizerDetailsValue 
      ? (Array.isArray(initialFertilizerDetailsValue) ? initialFertilizerDetailsValue : [initialFertilizerDetailsValue as any]) 
      : [];

    const currentState = JSON.stringify({
      cropName: initialData?.cropName || '',
      cultivationLane: initialData?.cultivationLane || CULTIVATION_LANES[0],
      workTypes: initialData?.workTypes || [],
      cropStages: initialData?.cropStages || [],
      observationStatus: initialData?.observationStatus || [],
      pestDetails: initialData?.pestDetails || [],
      memo: initialData?.memo || '',
      photo: initialData?.photoBase64 || null,
      seedPackageFront: initialData?.seedPackagePhotoFront || null,
      seedPackageBack: initialData?.seedPackagePhotoBack || null,
      recordDate: initialData?.date || toISODateString(new Date()),
      packageInfo: initialData?.aiPackageAnalysis || null,
      pestInfo: initialData?.aiPestInfo || null,
      fertilizingDetails: initialFertilizerArray,
    });
    initialFormStateRef.current = currentState;
  }, [initialData]);

  const isDirty = useMemo(() => {
    if (!initialFormStateRef.current) return false;
    const currentState = JSON.stringify({ cropName, cultivationLane, workTypes, cropStages, observationStatus, pestDetails, memo, photo, seedPackageFront, seedPackageBack, recordDate, packageInfo, pestInfo, fertilizingDetails });
    return initialFormStateRef.current !== currentState;
  }, [cropName, cultivationLane, workTypes, cropStages, observationStatus, pestDetails, memo, photo, seedPackageFront, seedPackageBack, recordDate, packageInfo, pestInfo, fertilizingDetails]);

  useEffect(() => {
    onDirtyChange(isDirty);
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ''; // For legacy browsers
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, onDirtyChange]);


  const handleWorkTypeToggle = (type: WorkType) => {
    setWorkTypes(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
  };
  
  const handleCropStageToggle = (stage: CropStage) => {
    setCropStages(prev => prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]);
  };

  const handleObservationStatusToggle = (status: ObservationStatus) => {
    setObservationStatus(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };
  
  const handlePestDetailToggle = (pest: string) => {
    setPestDetails(prev => prev.includes(pest) ? prev.filter(p => p !== pest) : [...prev, pest]);
  };
  
  const handleAddCustomPest = () => {
      if (customPest && !pestDetails.includes(customPest)) {
          setPestDetails(prev => [...prev, customPest]);
          setCustomPest('');
      }
  };

  const handleFertilizerToggle = (type: 'M-Plus-1' | 'M-Plus-2') => {
    setFertilizingDetails(prev => {
      const existing = prev.find(d => d.fertilizerType === type);
      if (existing) {
        return prev.filter(d => d.fertilizerType !== type);
      } else {
        setDilutionButtons(b => ({ ...b, [type]: '400' }));
        return [...prev, { fertilizerType: type, dilution: 400 }];
      }
    });
  };

  const handleFertilizerDilutionChange = (type: 'M-Plus-1' | 'M-Plus-2', newDilution: number) => {
    setFertilizingDetails(prev =>
      prev.map(d => (d.fertilizerType === type ? { ...d, dilution: newDilution } : d))
    );
  };

  const handleStopAnalysis = () => {
    stopAnalysisRef.current = true;
    setIsAnalyzingPackage(false);
    setIsSearchingPests(false);
    console.log("Analysis stop requested by user.");
  };

  const runPackageAnalysis = useCallback(async (base64Image: string) => {
    stopAnalysisRef.current = false;
    setPackageInfo(null);
    setPestInfo(null);
    setIsAnalyzingPackage(true);
    setIsSearchingPests(false);

    const mimeType = base64Image.match(/data:(.*);/)?.[1] || 'image/jpeg';
    const data = base64Image.split(',')[1];

    try {
        const ocrText = await handleApiCall(() => extractTextFromImage(mimeType, data));
        if (stopAnalysisRef.current || !ocrText) return;

        if (ocrText && ocrText !== "テキストの抽出に失敗しました。") {
            const info = await handleApiCall(() => analyzeSeedPackage(ocrText));
            if (stopAnalysisRef.current || !info) return;
            
            setPackageInfo(info);
            
            const nameToSearch = cropName || info?.productName;
            if (nameToSearch) {
                setIsSearchingPests(true);
                const pests = await handleApiCall(() => searchCommonPestsForCrop(nameToSearch));
                if (stopAnalysisRef.current || !pests) return;
                setPestInfo(pests);
            }
        } else {
            alert("パッケージからテキストを読み取れませんでした。");
        }
    } catch (error) {
        console.error("Package analysis failed:", error);
        if (!stopAnalysisRef.current) {
            alert("パッケージ情報の解析中にエラーが発生しました。");
        }
    } finally {
        setIsAnalyzingPackage(false);
        setIsSearchingPests(false);
    }
  }, [cropName, handleApiCall]);

  
  const handleUpdateAnalysis = () => {
    if (seedPackageBack) {
      onConfirmationRequest({
        title: '確認',
        message: "AI解析を再実行しますか？\n現在の解析結果は上書きされます。",
        confirmText: 'はい、再実行する',
        onConfirm: () => runPackageAnalysis(seedPackageBack),
      });
    } else {
      alert("解析するには、まずパッケージ裏の写真をアップロードしてください。");
    }
  };

  const handleDeletePackageData = () => {
    onConfirmationRequest({
      title: '削除の確認',
      message: "写真（表・裏）とAI解析結果を本当に削除しますか？\n（作物の名前は保持されます）",
      confirmText: 'はい、削除する',
      onConfirm: () => {
        setSeedPackageFront(null);
        setSeedPackageBack(null);
        setPackageInfo(null);
        setPestInfo(null);
        // Reset file inputs to allow re-uploading the same file
        const frontCamera = document.getElementById('seed-front-camera') as HTMLInputElement;
        const frontGallery = document.getElementById('seed-front-gallery') as HTMLInputElement;
        const backCamera = document.getElementById('seed-back-camera') as HTMLInputElement;
        const backGallery = document.getElementById('seed-back-gallery') as HTMLInputElement;
        if (frontCamera) frontCamera.value = "";
        if (frontGallery) frontGallery.value = "";
        if (backCamera) backCamera.value = "";
        if (backGallery) backGallery.value = "";
      },
    });
  };

  const handleOcr = async (file: File | null, fieldSetter: React.Dispatch<React.SetStateAction<string>>, fieldName: string) => {
    if (!file) return;
    setIsOcrLoading(fieldName);
    try {
      const part = await fileToGenerativePart(file);
      const text = await handleApiCall(() => extractTextFromImage(part.mimeType, part.data));
      if (text && text !== "テキストの抽出に失敗しました。") {
        fieldSetter(current => current ? `${current} ${text}` : text);
      } else if(text) {
        alert(text);
      }
    } catch (e) {
      console.error(e);
      alert("画像処理中にエラーが発生しました。");
    } finally {
      setIsOcrLoading(null);
    }
  };

  const handlePhotoCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => setPhoto(reader.result as string);
      reader.readAsDataURL(event.target.files[0]);
    }
  };
  
  const handleSeedPhotoCapture = (event: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    if (event.target.files && event.target.files[0]) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (side === 'front') {
          setSeedPackageFront(result);
        } else {
          setSeedPackageBack(result);
          setPackageInfo(null);
          setPestInfo(null);
          stopAnalysisRef.current = false;
        }
      };
      reader.readAsDataURL(event.target.files[0]);
    }
    // Reset input value to allow re-uploading the same file
    event.target.value = '';
  };

  const handleImageSourceSelect = (source: 'camera' | 'gallery') => {
      if (!imageSourceModal) return;
      const { side } = imageSourceModal;
      const elementId = `seed-${side}-${source}`;
      document.getElementById(elementId)?.click();
      setImageSourceModal(null);
  };

  const handleSubmit = () => {
    const errorMessage = validateAndGetRecordData().error;
    if (errorMessage) {
      if (onValidationError) {
        onValidationError(errorMessage);
      }
      return;
    }
    onSaveRecord(getRecordData());
  };
  
  const validateAndGetRecordData = (): { record: CultivationRecord | null; error: string } => {
    if (!cropName.trim()) {
      return { record: null, error: '作物の名前を入力してください。' };
    }
    return { record: getRecordData(), error: '' };
  };

  const getRecordData = (): CultivationRecord => ({
    id: recordId,
    cropName,
    cultivationLane,
    workTypes,
    cropStages,
    observationStatus,
    memo,
    date: recordDate,
    photoBase64: photo || '',
    seedPackagePhotoFront: seedPackageFront || '',
    seedPackagePhotoBack: seedPackageBack || '',
    aiPackageAnalysis: packageInfo || undefined,
    aiPestInfo: pestInfo || undefined,
    pestDetails: showPestDetails && pestDetails.length > 0 ? pestDetails : undefined,
    fertilizingDetails: workTypes.includes(WorkType.Fertilizing) && fertilizingDetails.length > 0 ? fertilizingDetails : undefined,
  });

  useImperativeHandle(ref, () => ({
    validate: () => validateAndGetRecordData().error,
    getRecordData,
    handleSubmit: handleSubmit,
  }));

  const resetForm = useCallback(() => {
    setRecordId(new Date().toISOString());
    setCropName('');
    setWorkTypes([]);
    setCropStages([]);
    setObservationStatus([]);
    setPestDetails([]);
    setCustomPest('');
    setMemo('');
    setPhoto(null);
    setSeedPackageFront(null);
    setSeedPackageBack(null);
    setPackageInfo(null);
    setPestInfo(null);
    setFertilizingDetails([]);
    setDilutionButtons({});
    // cultivationLane and recordDate are intentionally not reset
  }, []);

  const handleClearClick = () => {
    const startDate = parseDateString(recordDate);
    startDate.setHours(0, 0, 0, 0);

    const recordsToDeleteCount = records.filter(r => {
        const rDate = parseDateString(r.date);
        return r.cultivationLane === cultivationLane && rDate >= startDate;
    }).length;
    
    onConfirmationRequest({
        title: '記録のクリア確認',
        message: `レーン「${cultivationLane}」に残っている、本日（${recordDate}）以降の記録（${recordsToDeleteCount}件）をすべて削除し、新しい作物の記録を開始します。\n\n過去の記録は削除されません。\nよろしいですか？`,
        confirmText: 'はい、クリアする',
        onConfirm: () => {
            onClearFutureRecords(cultivationLane, recordDate);
            resetForm();
        },
    });
  };

  return (
    <>
    {modalImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4"
          onClick={() => setModalImage(null)}
        >
          <img src={modalImage} alt="拡大表示" className="max-w-full max-h-full object-contain" />
           <button onClick={() => setModalImage(null)} className="absolute top-4 right-4 text-white bg-gray-800 p-2 rounded-full">
                <CloseIcon className="h-6 w-6" />
            </button>
        </div>
    )}
    <ImageSourceModal
        isOpen={!!imageSourceModal}
        onClose={() => setImageSourceModal(null)}
        onSelect={handleImageSourceSelect}
    />
    <CalendarModal
      isOpen={isCalendarOpen}
      onClose={() => setIsCalendarOpen(false)}
      onSelectDate={(date) => {
        setRecordDate(toISODateString(date));
        setIsCalendarOpen(false);
      }}
      initialDate={recordDateObj}
      startOfWeek={settings.startOfWeek}
    />
    <div className="p-4 space-y-6">
      <div className="bg-yellow-50 dark:bg-gray-800/50 p-6 rounded-xl shadow-md">
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-2/3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">作業日</label>
              <button 
                onClick={() => setIsCalendarOpen(true)} 
                className="mt-1 w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-left text-base"
              >
                {recordDate} ({['日', '月', '火', '水', '木', '金', '土'][recordDateObj.getDay()]})
              </button>
            </div>
            <div className="w-1/3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">栽培レーン</label>
              <select value={cultivationLane} onChange={e => setCultivationLane(e.target.value)} className="mt-1 w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                {CULTIVATION_LANES.map(lane => <option key={lane} value={lane}>{lane}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              <span className="text-red-500 mr-1">*</span>作物の名前（例：ミニトマト）
            </label>
            <div className="flex items-center gap-2 mt-1">
                <div className="relative flex-grow">
                    <input type="text" value={cropName} onChange={e => setCropName(e.target.value)} placeholder="何を育てていますか？" className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg pr-12 dark:bg-gray-700 dark:placeholder-gray-400" />
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                        <button onClick={startListeningCropName} disabled={!settings.enableAiFeatures} className={`p-2 rounded-full ${isListeningCropName ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}><MicrophoneIcon className="h-5 w-5" /></button>
                    </div>
                </div>
                <button 
                    onClick={handleClearClick}
                    className="p-3 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors shrink-0"
                    title="このレーンと日付以降の記録をクリア"
                >
                    <CloseIcon className="h-5 w-5" />
                </button>
            </div>
          </div>
          
          {settings.enableAiFeatures && (
          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">種のパッケージ写真とAI解析（任意）</label>
                 {(seedPackageFront || seedPackageBack) && (
                    <div className="flex items-center gap-2">
                        <button onClick={handleUpdateAnalysis} disabled={!seedPackageBack} title="AI解析を再実行" className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/50 dark:hover:text-blue-400 disabled:opacity-50 disabled:cursor-not-allowed">
                            <RefreshIcon className="h-5 w-5" />
                        </button>
                        <button onClick={handleDeletePackageData} title="データ削除" className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/50 dark:hover:text-red-400">
                            <TrashIcon className="h-5 w-5" />
                        </button>
                    </div>
                )}
            </div>
            <div className="flex gap-2">
              {/* Front Photo */}
              <div className="w-1/5">
                <input type="file" accept="image/*" capture="environment" onChange={(e) => handleSeedPhotoCapture(e, 'front')} className="hidden" id="seed-front-camera" />
                <input type="file" accept="image/*" onChange={(e) => handleSeedPhotoCapture(e, 'front')} className="hidden" id="seed-front-gallery" />
                <div className="w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center bg-white/50 dark:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-600 relative p-1 cursor-pointer" 
                  onClick={() => seedPackageFront ? setModalImage(seedPackageFront) : setImageSourceModal({ open: true, side: 'front' })}
                >
                   <div className="absolute top-1 left-1 bg-black/40 text-white text-xs font-semibold px-2 py-0.5 rounded-full z-10">表</div>
                  {seedPackageFront ? (
                    <img src={seedPackageFront} alt="パッケージ表" className="h-full w-full object-contain rounded-md" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
              </div>

              {/* Back Photo */}
              <div className="w-1/5">
                <input type="file" accept="image/*" capture="environment" onChange={(e) => handleSeedPhotoCapture(e, 'back')} className="hidden" id="seed-back-camera" />
                <input type="file" accept="image/*" onChange={(e) => handleSeedPhotoCapture(e, 'back')} className="hidden" id="seed-back-gallery" />
                <div className="w-full h-40 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center bg-white/50 dark:bg-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-600 relative p-1 cursor-pointer"
                  onClick={() => seedPackageBack ? setModalImage(seedPackageBack) : setImageSourceModal({ open: true, side: 'back' })}
                >
                  <div className="absolute top-1 left-1 bg-black/40 text-white text-xs font-semibold px-2 py-0.5 rounded-full z-10">裏</div>
                  {seedPackageBack ? (
                    <img src={seedPackageBack} alt="パッケージ裏" className="h-full w-full object-contain rounded-md" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
              </div>

              {/* AI Analysis Column */}
              <div className="w-3/5 bg-lime-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-200 dark:border-gray-600 space-y-2 overflow-y-auto flex flex-col text-sm h-40">
                {(isAnalyzingPackage || packageInfo) ? (
                  <div className="space-y-2">
                     <div className="flex justify-between items-center">
                        <h4 className="font-bold text-green-800 dark:text-green-300">AIパッケージ解析結果</h4>
                        {isAnalyzingPackage && (
                            <button onClick={handleStopAnalysis} className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-md hover:bg-red-200 transition-colors">
                              停止
                            </button>
                        )}
                      </div>
                    {isAnalyzingPackage ? (
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500"></div>
                          <span>解析中...</span>
                      </div>
                    ) : packageInfo ? (
                      <div className="space-y-4 text-xs text-gray-700 dark:text-gray-300">
                          {packageInfo.productName && <p><strong className="font-semibold text-gray-900 dark:text-gray-100">商品名:</strong> 【{packageInfo.productName}】</p>}
                          {packageInfo.family && <p><strong className="font-semibold text-gray-900 dark:text-gray-100">科・属名:</strong> {packageInfo.family}</p>}
                          {packageInfo.features && <p><strong className="font-semibold text-gray-900 dark:text-gray-100">特徴:</strong> {packageInfo.features}</p>}
                          
                           <div className="space-y-2 pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                                <div className="grid grid-cols-1 gap-y-2">
                                  <div>
                                    <h5 className="font-bold text-gray-800 dark:text-gray-200 text-xs mb-1">栽培時期</h5>
                                    <table className="w-full text-xs">
                                        <tbody>
                                            {packageInfo.seedlingPeriod && <tr><td className="pr-2 font-medium text-gray-600 dark:text-gray-400">育苗</td><td className="text-gray-900 dark:text-gray-100 text-right">{packageInfo.seedlingPeriod}</td></tr>}
                                            {packageInfo.plantingPeriod && <tr><td className="pr-2 font-medium text-gray-600 dark:text-gray-400">定植</td><td className="text-gray-900 dark:text-gray-100 text-right">{packageInfo.plantingPeriod}</td></tr>}
                                            {packageInfo.harvestTime && <tr><td className="pr-2 font-medium text-gray-600 dark:text-gray-400">収穫</td><td className="text-gray-900 dark:text-gray-100 text-right">{packageInfo.harvestTime}</td></tr>}
                                        </tbody>
                                    </table>
                                  </div>
                                  <div>
                                      <h5 className="font-bold text-gray-800 dark:text-gray-200 text-xs mb-1">栽培条件</h5>
                                      <table className="w-full text-xs">
                                          <tbody>
                                              {packageInfo.daysToGermination && <tr><td className="pr-2 font-medium text-gray-600 dark:text-gray-400">発芽日数</td><td className="text-gray-900 dark:text-gray-100 text-right">{packageInfo.daysToGermination}</td></tr>}
                                              {packageInfo.germinationTemp && <tr><td className="pr-2 font-medium text-gray-600 dark:text-gray-400">発芽適温</td><td className="text-gray-900 dark:text-gray-100 text-right">{packageInfo.germinationTemp}</td></tr>}
                                              {packageInfo.growingTemp && <tr><td className="pr-2 font-medium text-gray-600 dark:text-gray-400">生育適温</td><td className="text-gray-900 dark:text-gray-100 text-right">{packageInfo.growingTemp}</td></tr>}
                                          </tbody>
                                      </table>
                                  </div>
                                </div>
                            </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {(isSearchingPests || (pestInfo && pestInfo.length > 0)) ? (
                  <div className="space-y-2 pt-2 mt-2 border-t border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-red-800 dark:text-red-300">注意すべき病害虫</h4>
                        {isSearchingPests && (
                            <button onClick={handleStopAnalysis} className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-md hover:bg-red-200 transition-colors">
                              停止
                            </button>
                        )}
                    </div>
                      {isSearchingPests ? (
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                              <span>検索中...</span>
                          </div>
                      ) : pestInfo ? (
                          <ul className="list-disc list-inside text-xs text-gray-700 dark:text-gray-300 space-y-1">
                              {pestInfo.map((pest, index) => <li key={index}>{pest}</li>)}
                          </ul>
                      ) : null}
                  </div>
                ) : null}

                {!isAnalyzingPackage && !packageInfo && !isSearchingPests && !pestInfo && (
                    <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400 text-xs p-2">
                        {seedPackageBack ? (
                          <>
                            <p className="mb-3">準備ができました。</p>
                            <button
                              onClick={() => runPackageAnalysis(seedPackageBack)}
                              className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors text-base flex items-center gap-2"
                            >
                              AI解析を開始
                            </button>
                          </>
                        ) : (
                          <p>パッケージ裏の写真をアップロードするとAIが内容を解析します。</p>
                        )}
                    </div>
                )}
              </div>
            </div>
          </div>
          )}
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">作業の種類（複数選択可）</label>
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
              {Object.entries(WORK_TYPE_DETAILS)
                .filter(([type]) => settings.enablePumiceWash || type !== WorkType.PumiceWash)
                .map(([type, { label, Icon }]) => {
                  const isSelected = workTypes.includes(type as WorkType);
                  return (
                    <button key={type} onClick={() => handleWorkTypeToggle(type as WorkType)} className={`p-2 rounded-lg flex flex-col items-center justify-center text-xs transition-all h-20 ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 bg-blue-100 dark:bg-blue-900/50' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}>
                      <Icon className={`h-7 w-7 mb-1 ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`} />
                      <span className={`${isSelected ? 'text-blue-800 dark:text-blue-300' : ''}`}>{label}</span>
                    </button>
                  );
              })}
            </div>
          </div>

          {workTypes.includes(WorkType.Fertilizing) && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-4 fade-in border border-blue-200 dark:border-blue-800">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">液肥の詳細</label>
                {Object.entries(FERTILIZERS).map(([key, { name }]) => {
                  const type = key as 'M-Plus-1' | 'M-Plus-2';
                  const detail = fertilizingDetails.find(d => d.fertilizerType === type);
                  const isSelected = !!detail;
                  
                  return (
                    <div key={type} className="bg-white dark:bg-gray-800 p-3 rounded-lg border dark:border-gray-700">
                      <button
                        onClick={() => handleFertilizerToggle(type)}
                        className={`w-full flex justify-between items-center p-2 rounded-md text-sm font-semibold transition-colors ${isSelected ? 'bg-green-100 text-green-800 dark:bg-green-800/50 dark:text-green-300' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
                      >
                        <span>{name}</span>
                        <div className={`w-5 h-5 rounded-full border-2 ${isSelected ? 'bg-green-500 border-green-600' : 'border-gray-400'}`}></div>
                      </button>
                      
                      {isSelected && detail && (
                        <div className="mt-3 space-y-2 fade-in">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300">希釈倍率（倍）</label>
                          <div className="grid grid-cols-3 gap-2">
                            {dilutionOptions.map(opt => (
                              <button
                                key={opt}
                                onClick={() => {
                                  setDilutionButtons(b => ({ ...b, [type]: opt }));
                                  handleFertilizerDilutionChange(type, parseInt(opt, 10));
                                }}
                                className={`p-2 rounded-lg text-xs transition-colors ${dilutionButtons[type] === opt ? 'bg-green-600 text-white font-semibold' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
                              >
                                {`${opt}倍`}
                              </button>
                            ))}
                            <button
                              onClick={() => setDilutionButtons(b => ({ ...b, [type]: 'custom' }))}
                              className={`p-2 rounded-lg text-xs transition-colors ${dilutionButtons[type] === 'custom' ? 'bg-green-600 text-white font-semibold' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
                            >
                              カスタム
                            </button>
                          </div>
                          {dilutionButtons[type] === 'custom' && (
                            <input
                              type="number"
                              value={detail.dilution}
                              onChange={e => handleFertilizerDilutionChange(type, parseInt(e.target.value, 10) || 0)}
                              className="mt-2 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm dark:bg-gray-700"
                              placeholder="倍率を入力"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">作物の状況（複数選択可）</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(CROP_STAGE_DETAILS).map(([stage, { label, Icon }]) => {
                const isSelected = cropStages.includes(stage as CropStage);
                return (
                  <button key={stage} onClick={() => handleCropStageToggle(stage as CropStage)} className={`p-2 rounded-lg flex flex-col items-center justify-center text-xs transition-all h-20 ${isSelected ? 'ring-2 ring-offset-2 ring-green-500 bg-green-100 dark:bg-green-900/50' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}>
                    <Icon className={`h-7 w-7 mb-1 ${isSelected ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`} />
                    <span className={`${isSelected ? 'text-green-800 dark:text-green-300' : ''}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">観察記録（複数選択可）</label>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
               {Object.entries(OBSERVATION_STATUS_DETAILS).map(([status, { label }]) => {
                const isSelected = observationStatus.includes(status as ObservationStatus);
                return (
                  <button key={status} onClick={() => handleObservationStatusToggle(status as ObservationStatus)} className={`p-2 rounded-lg text-sm transition-all ${isSelected ? 'ring-2 ring-offset-1 ring-purple-500 bg-purple-100 dark:bg-purple-900/50' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}>
                    <span className={`${isSelected ? 'text-purple-800 dark:text-purple-300' : ''}`}>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          
          {showPestDetails && (
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg space-y-3 fade-in border border-purple-200 dark:border-purple-800">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">病害虫の詳細（複数選択可）</label>
              {pestInfo && pestInfo.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">AIによる予測リスト：</p>
                  <div className="flex flex-wrap gap-2">
                    {pestInfo.map(pest => {
                      const isSelected = pestDetails.includes(pest);
                      return (
                        <button key={pest} onClick={() => handlePestDetailToggle(pest)} className={`px-3 py-1 text-sm rounded-full transition-colors ${isSelected ? 'bg-red-500 text-white shadow' : 'bg-white border hover:bg-red-50 dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-red-900/50'}`}>
                          {pest}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">カスタム入力：</p>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-grow">
                      <input 
                          type="text" 
                          value={customPest}
                          onChange={e => setCustomPest(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddCustomPest()}
                          placeholder="病害虫名を入力"
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg pr-10 dark:bg-gray-700"
                      />
                      <button onClick={startListeningPest} disabled={!settings.enableAiFeatures} className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full ${isListeningPest ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}><MicrophoneIcon className="h-5 w-5" /></button>
                    </div>
                    <button onClick={handleAddCustomPest} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm">追加</button>
                  </div>
              </div>
              {pestDetails.length > 0 && (
                <div className="pt-3 border-t dark:border-gray-600">
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">選択中の病害虫：</p>
                  <div className="flex flex-wrap gap-2">
                    {pestDetails.map(pest => (
                      <div key={pest} className="flex items-center gap-1.5 bg-purple-200 text-purple-800 dark:bg-purple-800/50 dark:text-purple-300 text-sm pl-2.5 pr-1 py-0.5 rounded-full">
                        <span>{pest}</span>
                        <button onClick={() => handlePestDetailToggle(pest)} className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-200 rounded-full hover:bg-purple-300 dark:hover:bg-purple-700 p-0.5"><CloseIcon className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">成長記録の写真（任意）</label>
            <div className="mt-1">
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" id="photo-upload" />
              <label htmlFor="photo-upload" className="w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                {photo ? <img src={photo} alt="プレビュー" className="h-full w-full object-cover rounded-lg" /> : (<><CameraIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" /><span className="mt-2 text-sm text-gray-600 dark:text-gray-400">写真を撮る</span></>)}
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">メモ（任意）</label>
             <div className="relative mt-1">
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} placeholder="何か覚えておくことはありますか？" className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg pr-32 dark:bg-gray-700"></textarea>
              <div className="absolute right-2 top-2 flex items-center gap-1">
                <button onClick={startListeningMemo} disabled={!settings.enableAiFeatures} className={`p-2 rounded-full ${isListeningMemo ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200 dark:hover:bg-gray-600'} disabled:opacity-50 disabled:cursor-not-allowed`}><MicrophoneIcon className="h-5 w-5" /></button>
                <button onClick={() => memoOcrCameraRef.current?.click()} disabled={!settings.enableAiFeatures} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"><CameraIcon className="h-5 w-5" /></button>
                <button onClick={() => memoOcrGalleryRef.current?.click()} disabled={!settings.enableAiFeatures} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"><ImageIcon className="h-5 w-5" /></button>
                {isOcrLoading === 'memo' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>}
                <input type="file" accept="image/*" capture="environment" ref={memoOcrCameraRef} onChange={(e) => handleOcr(e.target.files?.[0] || null, setMemo, 'memo')} className="hidden" />
                <input type="file" accept="image/*" ref={memoOcrGalleryRef} onChange={(e) => handleOcr(e.target.files?.[0] || null, setMemo, 'memo')} className="hidden" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
});

const RecordCard: React.FC<{ record: CultivationRecord; onClick: () => void }> = ({ record, onClick }) => {
  const workTypesToDisplay = record.workTypes || [];
  const cropStagesToDisplay = record.cropStages || [];
  
  const dateObj = parseDateString(record.date);
  const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];
  const formattedDate = `${dateObj.toLocaleDateString()} (${dayOfWeek})`;

  return (
    <button onClick={onClick} className="w-full bg-yellow-50 dark:bg-gray-800 rounded-xl shadow-md overflow-hidden fade-in flex text-left hover:shadow-lg transition-shadow">
        <div className="w-2/3 p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">{record.cultivationLane} 【{record.cropName}】</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{formattedDate}</p>
          
            <div className="space-y-2 mt-3 text-xs">
              {workTypesToDisplay.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 dark:text-gray-300 w-12 shrink-0">作業:</span>
                    <div className="flex flex-wrap gap-1">
                      {workTypesToDisplay.map(type => {
                        const details = WORK_TYPE_DETAILS[type as WorkType];
                        let label = details?.label || type;

                        if (type === WorkType.Fertilizing) {
                            const detailsArray = record.fertilizingDetails 
                              ? (Array.isArray(record.fertilizingDetails) ? record.fertilizingDetails : [record.fertilizingDetails])
                              : [];
                            
                            if (detailsArray.length > 0) {
                              const detailsText = detailsArray.map(d => 
                                `${FERTILIZERS[d.fertilizerType].name.replace('エムプラス', '')}:${d.dilution}倍`
                              ).join(', ');
                              label = `${label} (${detailsText})`;
                            }
                        }
                        return <span key={type} className="bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-0.5 rounded-full">{label}</span>;
                      })}
                    </div>
                  </div>
              )}
              {cropStagesToDisplay.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 dark:text-gray-300 w-12 shrink-0">状況:</span>
                    <div className="flex flex-wrap gap-1">
                      {cropStagesToDisplay.map(stage => {
                        const details = CROP_STAGE_DETAILS[stage as CropStage];
                        return <span key={stage} className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 px-2 py-0.5 rounded-full">{details?.label || stage}</span>;
                      })}
                    </div>
                  </div>
              )}
              {record.observationStatus && record.observationStatus.length > 0 && (
                  <div className="flex items-start gap-2">
                     <span className="font-semibold text-gray-600 dark:text-gray-300 w-12 shrink-0">観察:</span>
                    <div className="flex flex-wrap gap-1">
                        {record.observationStatus.map(status => (
                            <span key={status} className="bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 px-2 py-0.5 rounded-full">
                                {OBSERVATION_STATUS_DETAILS[status as ObservationStatus]?.label || status}
                            </span>
                        ))}
                    </div>
                  </div>
              )}
              {record.pestDetails && record.pestDetails.length > 0 && (
                  <div className="flex items-start gap-2">
                     <span className="font-semibold text-gray-600 dark:text-gray-300 w-12 shrink-0">病害虫:</span>
                    <div className="flex flex-wrap gap-1">
                        {record.pestDetails.map(pest => (
                            <span key={pest} className="bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 rounded-full">
                                {pest}
                            </span>
                        ))}
                    </div>
                  </div>
              )}
            </div>
          </div>
          
          {record.memo && <p className="mt-3 text-gray-700 dark:text-gray-300 text-xs bg-gray-50 dark:bg-gray-700 p-2 rounded-md whitespace-pre-wrap break-words">{record.memo}</p>}
        </div>
        <div className="w-1/3 bg-gray-200 dark:bg-gray-700">
          {record.photoBase64 ? (
            <img src={record.photoBase64} alt={record.cropName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <LeafIcon className="h-12 w-12 text-gray-400 dark:text-gray-500" />
            </div>
          )}
        </div>
    </button>
  );
};

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
      const dateKey = record.date; // Use the YYYY-MM-DD string directly as the key
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
    // Filter by crop if one is selected, otherwise use all records for that date
    const dayRecords = (recordsByDate[dateKey] || []).filter(r => !filterCrop || r.cropName === filterCrop);
    // Sort by cultivation lane
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
  
  let firstDayOfMonth = startOfMonth.getDay(); // Sunday is 0
  if (startOfWeek === 'monday') {
      firstDayOfMonth = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1; // Monday is 0
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
      // When a filter is active, we need to re-calculate the dots on the calendar
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


const ToolsPage: React.FC<{ setPage: (page: string) => void }> = ({ setPage }) => {
  const tools = [
    { name: 'AI作物診断', icon: ObservationIcon, page: 'PLANT_DIAGNOSIS' },
    { name: '液肥計算機', icon: CalculatorIcon, page: 'CALCULATOR' },
    { name: '野菜の育て方検索', icon: VegetableSearchIcon, page: 'VEGETABLE_SEARCH' },
    { name: '病害虫・症状検索', icon: PestSearchIcon, page: 'PEST_SEARCH' },
    { name: '園芸用語辞典', icon: DictionaryIcon, page: 'TERM_SEARCH' },
    { name: '天気予報', icon: WeatherIcon, page: 'WEATHER' },
    { name: 'レシピ検索', icon: RecipeIcon, page: 'RECIPE_SEARCH' },
  ];

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-4">
        {tools.map(tool => (
          <button
            key={tool.page}
            onClick={() => setPage(tool.page)}
            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col items-center justify-center h-32"
          >
            <tool.icon className="h-10 w-10 text-green-600 dark:text-green-400 mb-2" />
            <span className="font-semibold text-gray-700 dark:text-gray-300 text-center text-sm">{tool.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const CalculatorPage: React.FC<PageProps> = ({ setPage, records }) => {
  const [activeTab, setActiveTab] = useState<'dilution' | 'stock'>('dilution');
  
  // State for Dilution Calculator
  const [fertilizer, setFertilizer] = useState<'M-Plus-1' | 'M-Plus-2'>('M-Plus-1');
  const [waterAmount, setWaterAmount] = useState('8');
  const [dilution, setDilution] = useState('400');
  const [selectedDilution, setSelectedDilution] = useState('400');
  const [dilutionResult, setDilutionResult] = useState(0);

  // State for Stock Solution Calculator
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

  const capsNeeded = dilutionResult > 0 ? (dilutionResult / PET_BOTTLE_CAP_ML).toFixed(1) : 0;
  
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


const RecipeSearchPage: React.FC<PageProps> = ({ settings, onSettingsChange, handleApiCall, records }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [image, setImage] = useState<{ file: File, preview: string } | null>(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const { isListening, startListening } = useVoiceRecognition({ onResult: setQuery });

  const cultivatedCrops = useMemo(() => {
    const cropNames = records.map(r => r.cropName).filter(Boolean);
    return [...new Set(cropNames)];
  }, [records]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage({ file, preview: URL.createObjectURL(file) });
      setQuery(''); // 画像を選択したらテキストをクリア
      setRecipes([]);
      setImageUrls({});
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
  
  const handleSearch = useCallback(async (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (!finalQuery.trim() && !image) return;

    setIsLoading(true);
    setRecipes([]);
    setImageUrls({});
    
    try {
      let vegetableToSearch = finalQuery.trim();

      if (image && !vegetableToSearch) {
        const imagePart = await fileToGenerativePart(image.file);
        const identifiedVegetable = await handleApiCall(() => identifyVegetableFromImage(imagePart));
        if (identifiedVegetable) {
          setQuery(identifiedVegetable);
          vegetableToSearch = identifiedVegetable;
        } else {
          alert("画像から野菜を特定できませんでした。");
          setIsLoading(false);
          return;
        }
      }

      if (!vegetableToSearch) {
        setIsLoading(false);
        return;
      }

      const result = await handleApiCall(() => searchRecipes(vegetableToSearch));
      if (result) {
          const parsed = JSON.parse(result.text);
          setRecipes(parsed.recipes || []);
      }
    } catch (e) {
      console.error("Failed to search recipes", e);
      alert("レシピの検索に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [query, image, handleApiCall]);
  
  useEffect(() => {
    if (recipes.length > 0) {
        recipes.forEach(async (recipe, index) => {
            if (recipe.imageQuery) {
                try {
                    const imageUrl = await handleApiCall(() => generateRecipeImage(recipe.imageQuery));
                    if (imageUrl) {
                        setImageUrls(prev => ({ ...prev, [index]: imageUrl }));
                    }
                } catch (e) {
                    console.error(`Failed to generate image for "${recipe.recipeName}"`, e);
                }
            }
        });
    }
  }, [recipes, handleApiCall]);

  const handleCropButtonClick = (cropName: string) => {
    setQuery(cropName);
    setImage(null);
    handleSearch(cropName);
  };

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
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">レシピ検索</h3>
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <input 
                type="text" 
                value={query}
                onChange={e => { setQuery(e.target.value); if (image) setImage(null); }}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="野菜名を入力または画像で検索"
                className="w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg pr-20"
                disabled={isLoading}
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                 <button onClick={() => setIsSourceModalOpen(true)} disabled={isLoading} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><CameraIcon className="h-5 w-5"/></button>
                 <button onClick={startListening} disabled={isLoading} className={`p-1 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}><MicrophoneIcon className="h-5 w-5" /></button>
              </div>
            </div>
            <button onClick={() => handleSearch()} disabled={isLoading || (!query.trim() && !image)} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
              検索
            </button>
          </div>

          {image && (
            <div className="mt-3 relative w-24 h-24 rounded-lg overflow-hidden border">
              <img src={image.preview} alt="upload preview" className="w-full h-full object-cover" />
              <button onClick={() => setImage(null)} className="absolute top-0.5 right-0.5 bg-black bg-opacity-50 text-white rounded-full p-0.5"><CloseIcon className="h-4 w-4" /></button>
            </div>
          )}

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

        {isLoading && <div className="text-center p-4">レシピを検索中...</div>}

        <div className="space-y-4">
          {recipes.map((recipe, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
              <div className="h-40 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                {imageUrls[index] ? (
                  <img src={imageUrls[index]} alt={recipe.recipeName} className="w-full h-full object-cover" />
                ) : (
                  <div className="animate-pulse w-full h-full bg-gray-300 dark:bg-gray-600"></div>
                )}
              </div>
              <div className="p-4">
                  <h4 className="font-bold text-lg text-gray-800 dark:text-gray-200">{recipe.recipeName}</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{recipe.description}</p>
                  
                  <div className="flex mt-3">
                      <div className="w-2/5 pr-2">
                          <h5 className="font-semibold text-sm text-gray-700 dark:text-gray-300">主な材料</h5>
                          <ul className="list-disc list-outside pl-4 text-sm text-gray-600 dark:text-gray-300 mt-1 space-y-0.5">
                              {recipe.ingredients.map((ing: string, i: number) => <li key={i}>{ing}</li>)}
                          </ul>
                      </div>
                      <div className="w-3/5 pl-2 border-l border-gray-200 dark:border-gray-600">
                           <h5 className="font-semibold text-sm text-gray-700 dark:text-gray-300">作り方の要約</h5>
                          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                             <FormattedContent content={recipe.instructionsSummary || ''} />
                          </div>
                      </div>
                  </div>

                  <div className="mt-4">
                      <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(recipe.recipeName + " レシピ")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 w-full bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                      >
                          <ExternalLinkIcon className="h-5 w-5" />
                          <span>Webで詳細を見る</span>
                      </a>
                  </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};


const VegetableSearchPage: React.FC<PageProps> = ({ settings, onSettingsChange, handleApiCall, records }) => {
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

const PestSearchPage: React.FC<PageProps> = ({ settings, onSettingsChange, handleApiCall, records }) => {
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

const TermSearchPage: React.FC<PageProps> = ({ settings, onSettingsChange, handleApiCall, records }) => {
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

const WeatherPage: React.FC<PageProps> = ({ settings, onSettingsChange, handleApiCall, records }) => {
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

        if (JP_HOLIDAYS[dateString]) return { color: 'text-pink-600 font-bold', label: dayLabel };
        if (dayOfWeek === 0) return { color: 'text-red-500', label: dayLabel };
        if (dayOfWeek === 6) return { color: 'text-blue-500', label: dayLabel };
        return { color: 'text-gray-700 dark:text-gray-300', label: dayLabel };
    };

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

const PlantDiagnosisPage: React.FC<PageProps> = ({ settings, onSettingsChange, handleApiCall, records, pageParams }) => {
  const [image, setImage] = useState<{ file: File, preview: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PlantDiagnosis | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (pageParams?.preselectedImage) {
      setImage(pageParams.preselectedImage);
    }
  }, [pageParams?.preselectedImage]);


  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage({ file, preview: URL.createObjectURL(file) });
      setResult(null); // Clear previous result
    }
    // Reset input value
    e.target.value = '';
  };

  const handleDiagnose = useCallback(async () => {
    if (!image) return;
    setIsLoading(true);
    setResult(null);
    try {
      const imagePart = await fileToGenerativePart(image.file);
      const diagnosis = await handleApiCall(() => diagnosePlantHealth(imagePart));
      if (diagnosis) {
        setResult(diagnosis);
      }
    } catch (e) {
      console.error(e);
      alert("AI診断中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  }, [image, handleApiCall]);
  
  const DiagnosisCard: React.FC<{ title: string; children: React.ReactNode; icon: React.FC<{className?: string}> }> = ({ title, children, icon: Icon }) => (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <Icon className="h-6 w-6 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-bold text-green-800 dark:text-green-300">{title}</h3>
        </div>
        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 pl-9">{children}</div>
      </div>
  );

  return (
    <>
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageChange} className="hidden" />
      <input type="file" accept="image/*" ref={galleryInputRef} onChange={handleImageChange} className="hidden" />
      
      <div className="p-4 space-y-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md space-y-3">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">AI作物診断</h3>
          
          <div className="w-full h-48 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex flex-col items-center justify-center p-2">
            {image ? (
              <img src={image.preview} alt="診断対象" className="h-full w-full object-contain rounded-md" />
            ) : (
              <div className="flex items-center justify-around w-full h-full">
                <button onClick={() => cameraInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-1/2 h-full">
                  <CameraIcon className="h-10 w-10 text-gray-700 dark:text-gray-300" />
                  <span className="font-semibold text-gray-700 dark:text-gray-300">カメラ</span>
                </button>
                <div className="h-full w-px bg-gray-200 dark:bg-gray-700"></div>
                <button onClick={() => galleryInputRef.current?.click()} className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-1/2 h-full">
                  <ImageIcon className="h-10 w-10 text-gray-700 dark:text-gray-300" />
                  <span className="font-semibold text-gray-700 dark:text-gray-300">ギャラリー</span>
                </button>
              </div>
            )}
          </div>
          
          {image && (
            <div className="flex justify-center gap-4">
              <button onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 font-semibold py-2 px-4 rounded-lg text-sm">
                <CameraIcon className="h-5 w-5"/>
                <span>撮り直す</span>
              </button>
              <button onClick={() => galleryInputRef.current?.click()} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 font-semibold py-2 px-4 rounded-lg text-sm">
                <ImageIcon className="h-5 w-5"/>
                <span>別の写真を選択</span>
              </button>
            </div>
          )}

          <button 
            onClick={handleDiagnose} 
            disabled={isLoading || !image} 
            className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>診断中...</span>
              </>
            ) : (
              <>
                <ObservationIcon className="h-5 w-5" />
                <span>この作物を診断する</span>
              </>
            )}
          </button>
        </div>
        
        {result && (
          <div className="space-y-4 fade-in">
            <DiagnosisCard title="総合評価" icon={LeafIcon}>
                <p className="font-semibold text-base">{result.overallHealth}</p>
            </DiagnosisCard>
            
            <DiagnosisCard title="病害虫の診断" icon={PestControlIcon}>
                <p><strong>状況:</strong> {result.pestAndDisease.details}</p>
                <p><strong>対策:</strong> <FormattedContent content={result.pestAndDisease.countermeasures} /></p>
            </DiagnosisCard>
            
            <DiagnosisCard title="液肥のアドバイス" icon={FertilizingIcon}>
                <FormattedContent content={result.fertilizer.recommendation} />
            </DiagnosisCard>
            
            <DiagnosisCard title="水やりのアドバイス" icon={WateringIcon}>
                <p><strong>状況:</strong> {result.watering.status}</p>
                <p><strong>アドバイス:</strong> <FormattedContent content={result.watering.recommendation} /></p>
            </DiagnosisCard>
            
            <DiagnosisCard title="環境のアドバイス" icon={WeatherIcon}>
                <FormattedContent content={result.environment.recommendation} />
            </DiagnosisCard>
          </div>
        )}
      </div>
    </>
  );
};


const SettingsPage: React.FC<{
  settings: AppSettings,
  onSettingsChange: (settings: AppSettings) => void;
  onLogout: () => void;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ settings, onSettingsChange, onLogout, onExport, onImport }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const importInputRef = useRef<HTMLInputElement>(null);
  
  const handleSettingsChange = (newSettings: Partial<AppSettings>) => {
    setLocalSettings(prev => ({ ...prev, ...newSettings }));
  };
  
  useEffect(() => {
    onSettingsChange(localSettings);
  }, [localSettings, onSettingsChange]);
  
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">基本設定</h3>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">チーム名</label>
            <input type="text" value={localSettings.teamName} onChange={e => handleSettingsChange({ teamName: e.target.value })} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">週の始まり</label>
            <select value={localSettings.startOfWeek} onChange={e => handleSettingsChange({ startOfWeek: e.target.value as any })} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg bg-white">
              <option value="sunday">日曜日</option>
              <option value="monday">月曜日</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">天気予報エリア (例: Tokyo,JP)</label>
            <input type="text" value={localSettings.weatherLocation} onChange={e => handleSettingsChange({ weatherLocation: e.target.value })} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">OpenWeatherMap APIキー</label>
            <input type="password" value={localSettings.openWeatherApiKey} onChange={e => handleSettingsChange({ openWeatherApiKey: e.target.value })} className="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg" placeholder="APIキーを入力" />
            <p className="text-xs text-gray-500 mt-1">OpenWeatherMapから無料でAPIキーを取得できます。</p>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">AI機能設定</h3>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="enable-ai" className="text-sm font-medium text-gray-700 dark:text-gray-300">AIアシスタント機能</label>
            <input type="checkbox" id="enable-ai" checked={localSettings.enableAiFeatures} onChange={e => handleSettingsChange({ enableAiFeatures: e.target.checked })} className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all checked:bg-green-600 checked:after:translate-x-full focus:ring-0" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">表示設定</h3>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="enable-pumice-wash" className="text-sm font-medium text-gray-700 dark:text-gray-300">「パミス洗い」作業を表示</label>
            <input type="checkbox" id="enable-pumice-wash" checked={localSettings.enablePumiceWash} onChange={e => handleSettingsChange({ enablePumiceWash: e.target.checked })} className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all checked:bg-green-600 checked:after:translate-x-full focus:ring-0" />
          </div>
           <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">ダークモードのコントラスト</label>
            <div className="mt-2 flex rounded-lg shadow-sm">
              <button
                onClick={() => handleSettingsChange({ darkModeContrast: 'normal' })}
                className={`flex-1 px-4 py-2 text-sm rounded-l-lg ${localSettings.darkModeContrast === 'normal' ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
              >
                通常
              </button>
              <button
                onClick={() => handleSettingsChange({ darkModeContrast: 'high' })}
                className={`flex-1 px-4 py-2 text-sm rounded-r-lg ${localSettings.darkModeContrast === 'high' ? 'bg-green-600 text-white' : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600'}`}
              >
                ハイコントラスト
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">データ管理</h3>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-3">
          <input type="file" accept=".json" ref={importInputRef} onChange={onImport} className="hidden" />
          <button onClick={() => importInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold py-2.5 px-4 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors">
            <FileImportIcon className="h-5 w-5"/>
            <span>記録をインポート</span>
          </button>
          <button onClick={onExport} className="w-full flex items-center justify-center gap-2 bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold py-2.5 px-4 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors">
            <ExportIcon className="h-5 w-5"/>
            <span>すべての記録をエクスポート</span>
          </button>
        </div>
      </div>
      
      <div className="pt-4">
         <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 font-bold py-2.5 px-4 rounded-lg hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors">
            <LogoutIcon className="h-5 w-5"/>
            <span>ログアウト</span>
          </button>
      </div>
    </div>
  );
};

const CameraActionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDiagnose: () => void;
}> = ({ isOpen, onClose, onSave, onDiagnose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-4">カメラを起動</h3>
        <div className="flex justify-around gap-4">
          <button onClick={onSave} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-1/2">
            <SaveIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">写真を保存</span>
          </button>
          <button onClick={onDiagnose} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors w-1/2">
            <ObservationIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
            <span className="font-semibold text-gray-700 dark:text-gray-300">写真から診断</span>
          </button>
        </div>
      </div>
    </div>
  );
};


// #endregion

// #region --- Main App Component ---

export const App = () => {
  const [page, setPage] = useState<'LOGIN' | 'DASHBOARD' | 'RECORD' | 'HISTORY' | 'TOOLS' | 'CALCULATOR' | 'RECIPE_SEARCH' | 'VEGETABLE_SEARCH' | 'PEST_SEARCH' | 'TERM_SEARCH' | 'WEATHER' | 'PLANT_DIAGNOSIS' | 'SETTINGS'>('LOGIN');
  const [pageParams, setPageParams] = useState<any>({});
  const [records, setRecords] = useState<CultivationRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>({
    teamName: 'マイチーム',
    startOfWeek: 'monday',
    enableAiFeatures: true,
    enablePumiceWash: false,
    weatherLocation: 'nagoya,JP',
    darkModeContrast: 'normal',
    openWeatherApiKey: ''
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  const [formIsDirty, setFormIsDirty] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<Omit<ConfirmationModalProps, 'isOpen'> & { isOpen: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => {}, onCancel: () => {}, confirmText: '' });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [exportModal, setExportModal] = useState<{isOpen: boolean, mode: 'email' | 'download'}>({isOpen: false, mode: 'download'});
  const [apiError, setApiError] = useState<any>(null);
  const [lastApiCall, setLastApiCall] = useState<(() => Promise<any>) | null>(null);
  const recordPageRef = useRef<RecordPageHandle>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const cameraSaveRef = useRef<HTMLInputElement>(null);
  const cameraDiagnoseRef = useRef<HTMLInputElement>(null);
  
  const goBackActionRef = useRef<(() => void) | null>(null);

  // Load data from localStorage on initial render
  useEffect(() => {
    try {
      const savedRecords = localStorage.getItem('cultivationRecords');
      if (savedRecords) setRecords(JSON.parse(savedRecords));

      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) setSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    }
  }, []);

  // Save records to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('cultivationRecords', JSON.stringify(records));
    } catch (error) {
      console.error("Failed to save records to localStorage", error);
      alert("記録の保存に失敗しました。ストレージの空き容量が不足している可能性があります。");
    }
  }, [records]);

  // Save settings to localStorage whenever they change
  const handleSettingsChange = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
        console.error("Failed to save settings to localStorage", error);
    }
  }, []);
  
  useEffect(() => {
    const isHighContrast = settings.darkModeContrast === 'high';
    const root = document.documentElement;
    root.classList.toggle('dark-high-contrast', isHighContrast);
  }, [settings.darkModeContrast]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 1500);
  };

  const handleSaveRecord = (record: CultivationRecord) => {
    setRecords(prev => {
      const existingIndex = prev.findIndex(r => r.id === record.id);
      if (existingIndex > -1) {
        const newRecords = [...prev];
        newRecords[existingIndex] = record;
        return newRecords;
      }
      return [...prev, record];
    });
    setPage('DASHBOARD');
    showToast('記録を保存しました！');
  };

  const handleDeleteRecord = (recordId: string) => {
    setConfirmationModal({
        isOpen: true,
        title: '記録の削除',
        message: 'この記録を本当に削除しますか？\nこの操作は元に戻せません。',
        confirmText: 'はい、削除する',
        onConfirm: () => {
            setRecords(prev => prev.filter(r => r.id !== recordId));
            setConfirmationModal(s => ({...s, isOpen: false}));
            setPage('DASHBOARD');
            showToast('記録を削除しました');
        },
        onCancel: () => setConfirmationModal(s => ({...s, isOpen: false})),
    });
  };
  
  const handleClearFutureRecords = (lane: string, date: string) => {
      const startDate = parseDateString(date);
      startDate.setHours(0, 0, 0, 0);

      setRecords(prev => prev.filter(r => {
          const rDate = parseDateString(r.date);
          return !(r.cultivationLane === lane && rDate >= startDate);
      }));
  };

  const handleApiCall: ApiCallHandler = useCallback(async (apiCall) => {
    if (!settings.enableAiFeatures) {
        console.log("AI features are disabled.");
        return undefined;
    }
    setLastApiCall(() => apiCall);
    try {
      setApiError(null);
      const result = await apiCall();
      return result;
    } catch (error: any) {
        console.error("API Call failed:", error);
        if (error instanceof ApiRateLimitError) {
          setApiError(error);
        } else {
          // General errors can be handled here, e.g., show a toast
          alert(`エラーが発生しました: ${error.message}`);
        }
        return undefined;
    }
  }, [settings.enableAiFeatures]);

  const retryApiCall = () => {
    if (lastApiCall) {
      handleApiCall(lastApiCall);
    }
  };

  const stopAiFeatures = () => {
    handleSettingsChange({ ...settings, enableAiFeatures: false });
    setApiError(null);
  };
  
  const handleDirtyStateBack = (action: () => void) => {
    if (page === 'RECORD' && formIsDirty) {
      goBackActionRef.current = action;
      setSaveModalOpen(true);
    } else {
      action();
    }
  };

  const changePage = (newPage: string, params?: any) => {
    const action = () => {
        setPage(newPage as any);
        if (params) setPageParams(params);
        setActiveTab(newPage);
        setFormIsDirty(false);
    };
    handleDirtyStateBack(action);
  };

  const onBack = () => {
    let targetPage = 'DASHBOARD';
    if (['CALCULATOR', 'RECIPE_SEARCH', 'VEGETABLE_SEARCH', 'PEST_SEARCH', 'TERM_SEARCH', 'WEATHER', 'PLANT_DIAGNOSIS'].includes(page)) {
      targetPage = 'TOOLS';
    }
    changePage(targetPage);
  };

  const handleLogin = () => {
    setIsLoggedIn(true);
    changePage('DASHBOARD');
  };
  
  const handleLogout = () => {
      setConfirmationModal({
          isOpen: true,
          title: 'ログアウト',
          message: '本当にログアウトしますか？',
          confirmText: 'ログアウト',
          onConfirm: () => {
              setIsLoggedIn(false);
              setPage('LOGIN');
              setConfirmationModal(s => ({...s, isOpen: false}));
          },
          onCancel: () => setConfirmationModal(s => ({...s, isOpen: false})),
      });
  };
  
  const onSaveConfirm = () => {
    recordPageRef.current?.handleSubmit();
    setSaveModalOpen(false);
    if(goBackActionRef.current) {
        goBackActionRef.current();
        goBackActionRef.current = null;
    }
  };

  const onSaveDeny = () => {
    setSaveModalOpen(false);
    if(goBackActionRef.current) {
        goBackActionRef.current();
        goBackActionRef.current = null;
    }
    setFormIsDirty(false);
  };

  const handleExport = (range: string, customStart?: string, customEnd?: string) => {
    let recordsToExport = records;
    const today = new Date();
    today.setHours(0,0,0,0);

    switch(range) {
        case 'today':
            recordsToExport = records.filter(r => r.date === toISODateString(today));
            break;
        case 'thisWeek': {
            const weekStart = new Date(today);
            const dayOfWeek = weekStart.getDay();
            const diff = settings.startOfWeek === 'monday' 
                ? (dayOfWeek === 0 ? -6 : 1 - dayOfWeek)
                : -dayOfWeek;
            weekStart.setDate(weekStart.getDate() + diff);
            recordsToExport = records.filter(r => parseDateString(r.date) >= weekStart);
            break;
        }
        case 'thisMonth': {
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            recordsToExport = records.filter(r => parseDateString(r.date) >= monthStart);
            break;
        }
        case 'lastMonth': {
            const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
            const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
            recordsToExport = records.filter(r => {
                const d = parseDateString(r.date);
                return d >= lastMonthStart && d <= lastMonthEnd;
            });
            break;
        }
        case 'custom': {
             if(customStart && customEnd) {
                const start = parseDateString(customStart);
                const end = parseDateString(customEnd);
                recordsToExport = records.filter(r => {
                    const d = parseDateString(r.date);
                    return d >= start && d <= end;
                });
            }
            break;
        }
        case 'all':
        default:
             // Use all records
            break;
    }
    
    if (recordsToExport.length === 0) {
        alert("エクスポート対象の記録がありません。");
        return;
    }

    const sortedRecords = [...recordsToExport].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(exportRecordsToCsv(sortedRecords));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    const fileName = `veggielog_export_${toISODateString(new Date())}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    if (exportModal.mode === 'email') {
        const subject = encodeURIComponent(`${settings.teamName} 栽培記録 (${range})`);
        const body = encodeURIComponent(`
${settings.teamName}の栽培記録を添付します。

期間: ${range} ${customStart ? `${customStart} ~ ${customEnd}`: ''}
ファイル名: ${fileName}

ご確認よろしくお願いいたします。
        `);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
    
    setExportModal({isOpen: false, mode: 'download'});
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedRecords: CultivationRecord[] = JSON.parse(e.target?.result as string);
            // Basic validation
            if (!Array.isArray(importedRecords) || (importedRecords.length > 0 && !importedRecords[0].id)) {
                throw new Error("Invalid file format");
            }

            setConfirmationModal({
                isOpen: true,
                title: '記録のインポート',
                message: `${importedRecords.length}件の記録をインポートしますか？\n既存の記録とIDが重複する場合、上書きされます。`,
                confirmText: 'インポート',
                confirmColor: 'bg-blue-600 hover:bg-blue-700',
                onConfirm: () => {
                    setRecords(prev => {
                        const recordsMap = new Map(prev.map(r => [r.id, r]));
                        importedRecords.forEach(r => recordsMap.set(r.id, r));
                        return Array.from(recordsMap.values());
                    });
                    showToast(`${importedRecords.length}件の記録をインポートしました。`);
                    setConfirmationModal(s => ({...s, isOpen: false}));
                },
                onCancel: () => setConfirmationModal(s => ({...s, isOpen: false})),
            });

        } catch (err) {
            alert("ファイルの読み込みに失敗しました。JSON形式が正しくない可能性があります。");
        }
    };
    reader.readAsText(file);
    // Reset file input
    event.target.value = '';
  };
  
  const handleDiagnoseFromCamera = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preselectedImage = { file, preview: URL.createObjectURL(file) };
      changePage('PLANT_DIAGNOSIS', { preselectedImage });
    }
    if (e.target) e.target.value = '';
  };

  // --- Render logic ---

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const pages: { [key: string]: { comp: React.ReactNode, title: string, showBack: boolean } } = {
    DASHBOARD: {
      comp: <Dashboard records={records} onLaneClick={(recordData) => changePage('RECORD', recordData)} settings={settings} handleApiCall={handleApiCall} />,
      title: settings.teamName,
      showBack: false,
    },
    RECORD: {
      comp: <RecordPage
        ref={recordPageRef}
        onSaveRecord={handleSaveRecord}
        onBack={() => handleDirtyStateBack(onBack)}
        initialData={pageParams}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        onDirtyChange={setFormIsDirty}
        onConfirmationRequest={(config) => setConfirmationModal({ ...config, isOpen: true, onCancel: () => setConfirmationModal(s => ({ ...s, isOpen: false})) })}
        handleApiCall={handleApiCall}
        records={records}
        onClearFutureRecords={handleClearFutureRecords}
        onValidationError={showToast}
      />,
      title: pageParams?.id ? '記録の編集' : '新規記録',
      showBack: true
    },
    HISTORY: { comp: <CalendarHistoryPage records={records} startOfWeek={settings.startOfWeek} onRecordClick={(record) => changePage('RECORD', record)} />, title: '栽培カレンダー', showBack: false },
    TOOLS: { comp: <ToolsPage setPage={changePage} />, title: 'ツール', showBack: false },
    CALCULATOR: { comp: <CalculatorPage setPage={changePage} onBack={onBack} settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '液肥計算機', showBack: true },
    RECIPE_SEARCH: { comp: <RecipeSearchPage setPage={changePage} onBack={onBack} settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: 'レシピ検索', showBack: true },
    VEGETABLE_SEARCH: { comp: <VegetableSearchPage setPage={changePage} onBack={onBack} settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '育て方検索', showBack: true },
    PEST_SEARCH: { comp: <PestSearchPage setPage={changePage} onBack={onBack} settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '病害虫検索', showBack: true },
    TERM_SEARCH: { comp: <TermSearchPage setPage={changePage} onBack={onBack} settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '園芸用語辞典', showBack: true },
    WEATHER: { comp: <WeatherPage setPage={changePage} onBack={onBack} settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: '天気予報', showBack: true },
    PLANT_DIAGNOSIS: { comp: <PlantDiagnosisPage setPage={changePage} onBack={onBack} settings={settings} onSettingsChange={handleSettingsChange} handleApiCall={handleApiCall} records={records} pageParams={pageParams} />, title: 'AI作物診断', showBack: true },
    SETTINGS: { comp: <SettingsPage settings={settings} onSettingsChange={handleSettingsChange} onLogout={handleLogout} onExport={() => setExportModal({isOpen: true, mode: 'download'})} onImport={handleImport}/>, title: '設定', showBack: false },
  };

  const currentPage = pages[page] || pages.DASHBOARD;
  
  const showFab = (page === 'RECORD' && !pageParams.id) || (page === 'RECORD' && pageParams.id && formIsDirty);

  return (
    <div className="bg-lime-50 dark:bg-gray-900 min-h-screen font-sans">
      <PageHeader
        title={currentPage.title}
        onBack={currentPage.showBack ? () => handleDirtyStateBack(onBack) : undefined}
        onMenuClick={() => setIsMenuOpen(true)}
      />
      <main className="pb-24">
        {currentPage.comp}
      </main>

      <div className="fixed bottom-0 left-0 right-0 h-12 z-20">
        <nav className="w-full h-full bg-stone-100 dark:bg-gray-800 shadow-t-lg border-t dark:border-gray-700 flex justify-around items-center">
          <button onClick={() => setExportModal({isOpen: true, mode: 'email'})} className="flex flex-col items-center justify-center w-full h-full text-gray-500 dark:text-gray-400 transition-colors">
            <PaperPlaneIcon className="h-6 w-6" />
            <span className="text-xs">送信</span>
          </button>
          <button onClick={() => changePage('HISTORY')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'HISTORY' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <CalendarIcon className="h-6 w-6" />
            <span className="text-xs">カレンダー</span>
          </button>
          
          <div className="w-full h-full"></div>

          <button onClick={() => changePage('TOOLS')} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${['TOOLS', 'CALCULATOR', 'RECIPE_SEARCH', 'VEGETABLE_SEARCH', 'PEST_SEARCH', 'TERM_SEARCH', 'WEATHER'].includes(page) ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <ToolsIcon className="h-6 w-6" />
            <span className="text-xs">ツール</span>
          </button>
          <button onClick={() => setIsCameraModalOpen(true)} className={`flex flex-col items-center justify-center w-full h-full transition-colors ${page === 'PLANT_DIAGNOSIS' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
            <CameraIcon className="h-6 w-6" />
            <span className="text-xs">カメラ</span>
          </button>
        </nav>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-30 flex justify-center items-end pointer-events-none" style={{ width: '20%'}}>
           <button
              onClick={() => changePage('DASHBOARD')}
              className={`w-16 h-16 bg-stone-100 dark:bg-gray-800 border-2 dark:border-gray-600 rounded-full shadow-lg flex items-center justify-center transition-transform pointer-events-auto ${activeTab === 'DASHBOARD' ? 'text-green-600 dark:text-green-400 border-green-500 dark:border-green-500' : 'text-gray-600 dark:text-gray-400 border-stone-200 dark:border-gray-700'}`}
              aria-label="ホーム"
          >
              <HomeIcon className="h-8 w-8" />
          </button>
        </div>
      </div>
      
      {showFab && (
        <FloatingSaveButton onClick={() => recordPageRef.current?.handleSubmit()} />
      )}
      
      {toastMessage && <Toast message={toastMessage} />}

      <HamburgerMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} setPage={changePage} activePage={page} onLogout={handleLogout}/>

      <SaveConfirmationModal
        isOpen={saveModalOpen}
        onConfirm={onSaveConfirm}
        onDeny={onSaveDeny}
        onClose={() => setSaveModalOpen(false)}
      />

      <ConfirmationModal 
        isOpen={confirmationModal.isOpen}
        {...confirmationModal}
      />
      
      <ExportModal
        isOpen={exportModal.isOpen}
        mode={exportModal.mode}
        onClose={() => setExportModal(prev => ({...prev, isOpen: false}))}
        onExport={handleExport}
      />
      
      <ApiErrorModal
        isOpen={!!apiError}
        error={apiError}
        onRetry={retryApiCall}
        onStopAi={stopAiFeatures}
      />

      <CameraActionModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSave={() => {
          cameraSaveRef.current?.click();
          setIsCameraModalOpen(false);
        }}
        onDiagnose={() => {
          cameraDiagnoseRef.current?.click();
          setIsCameraModalOpen(false);
        }}
      />
      <input type="file" accept="image/*" capture="environment" ref={cameraSaveRef} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraDiagnoseRef} onChange={handleDiagnoseFromCamera} className="hidden" />
    </div>
  );
};
// This is a placeholder, will be removed if googleDriveService.ts is empty
const useGoogleDriveSync = (
    records: CultivationRecord[],
    setRecords: React.Dispatch<React.SetStateAction<CultivationRecord[]>>,
    settings: AppSettings,
    onSettingsChange: (newSettings: AppSettings) => void
) => {
    // Placeholder logic
    const sync = () => console.log("Syncing...");
    const login = () => console.log("Logging in...");
    const logout = () => console.log("Logging out...");
    const isReady = false;
    const isLoggedIn = false;

    return { isReady, isLoggedIn, sync, login, logout };
};