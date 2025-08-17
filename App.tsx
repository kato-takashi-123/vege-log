

import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { CultivationRecord, WorkType, ObservationStatus, PackageInfo, CropStage, WeatherInfo, PestInfo, VegetableInfo, PlantDiagnosis } from './types';
import { getDailyQuote, getVegetableInfo, searchPestInfo, extractTextFromImage, analyzeSeedPackage, searchCommonPestsForCrop, searchRecipes, generateRecipeImage, AiSearchResult, searchGardeningTerm, getWeatherInfo, ApiRateLimitError, diagnosePlantHealth } from './services/geminiService';
import * as GoogleDriveService from './services/googleDriveService';
import {
  SeedingIcon, PlantingIcon, FertilizingIcon, HarvestingIcon, PestControlIcon, WateringIcon, SeedlingCareIcon,
  CalculatorIcon, ExportIcon, NewRecordIcon, CalendarIcon, CameraIcon, BackIcon, LeafIcon,
  HomeIcon, ToolsIcon, VegetableSearchIcon, PestSearchIcon, RecipeIcon, MailIcon, MicrophoneIcon, ImageIcon, ChevronLeftIcon, ChevronRightIcon,
  HamburgerIcon, CloseIcon, SettingsIcon, TrashIcon, OpenAiIcon, RefreshIcon, RootTreatmentIcon, DiggingUpIcon, GerminationIcon, TrueLeavesIcon, PollinationIcon,
  DictionaryIcon, WeatherIcon, PaperPlaneIcon, SaveIcon, LogoutIcon, MoundIcon, VegetableBasketIcon, GoogleDriveIcon, CloudUploadIcon, CloudDownloadIcon, SyncIcon, FileImportIcon,
  CloudIcon, ObservationIcon, FaucetIcon
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
  [CropStage.SeedlingStart]: { label: '育苗開始', Icon: SeedlingCareIcon, color: 'bg-lime-500' },
  [CropStage.Germination]: { label: '発芽', Icon: GerminationIcon, color: 'bg-green-300' },
  [CropStage.TrueLeaves]: { label: '本葉が出る', Icon: TrueLeavesIcon, color: 'bg-green-400' },
  [CropStage.Planting]: { label: '定植開始', Icon: PlantingIcon, color: 'bg-green-500' },
  [CropStage.Pollination]: { label: '受粉', Icon: PollinationIcon, color: 'bg-pink-400' },
  [CropStage.Harvesting]: { label: '収穫', Icon: HarvestingIcon, color: 'bg-orange-500' },
};

const OBSERVATION_STATUS_DETAILS = {
  [ObservationStatus.Normal]: { label: '正常' },
  [ObservationStatus.Anomaly]: { label: '異常あり' },
  [ObservationStatus.Pest]: { label: '病害虫' },
  [ObservationStatus.Deformation]: { label: '変色・変形' },
};

const FERTILIZERS = {
  'M-Plus-1': { name: 'TOMATEC M-Plus 1', component: '窒素、リン酸、カリウム', usage: '成長促進、栄養補給' },
  'M-Plus-2': { name: 'TOMATEC M-Plus 2', component: 'カルシウム、微量要素', usage: '品質向上、病害耐性強化' },
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

const PREFECTURES = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

const PET_BOTTLE_CAP_ML = 5;

type AppSettings = {
  teamName: string;
  startOfWeek: 'sunday' | 'monday';
  enableAiFeatures: boolean;
  enableGoogleSearch: boolean;
  selectedModel: string;
  enablePumiceWash: boolean;
  enableCloudSync?: boolean;
  lastSyncDate?: string;
  cloudProvider?: 'google' | 'icloud';
  syncMode: 'auto' | 'manual';
  weatherPrefecture: string;
};

const SETTINGS_KEY = 'veggieLogSettings';
const VALID_MODELS = ['gemini-2.5-flash', 'gpt-4o'];

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
        '観察記録', '病害虫詳細', 'メモ',
    ];

    const workTypeLabels = Object.values(WorkType).map(t => WORK_TYPE_DETAILS[t].label);
    const cropStageLabels = Object.values(CropStage).map(s => CROP_STAGE_DETAILS[s].label);
    const observationStatusLabels = Object.values(ObservationStatus).map(o => OBSERVATION_STATUS_DETAILS[o].label);

    const rows = records.map(r => {
        const row = {
            id: r.id,
            date: r.date,
            cropName: r.cropName,
            cultivationLane: r.cultivationLane,
            workTypes: r.workTypes?.map(wt => WORK_TYPE_DETAILS[wt]?.label).join(', ') || '',
            cropStages: r.cropStages?.map(cs => CROP_STAGE_DETAILS[cs]?.label).join(', ') || '',
            observationStatus: r.observationStatus?.map(os => OBSERVATION_STATUS_DETAILS[os]?.label).join(', ') || '',
            pestDetails: r.pestDetails?.join(', ') || '',
            memo: r.memo.replace(/"/g, '""'), // Escape double quotes
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
  currentModel: string;
  onRetry: () => void;
  onSwitchAi: () => void;
  onStopAi: () => void;
}> = ({ isOpen, error, currentModel, onRetry, onSwitchAi, onStopAi }) => {
  if (!isOpen) return null;
  
  const errorMessage = error?.originalError?.error?.message || error?.message || '不明なAPIエラーが発生しました。';
  const nextModel = currentModel.includes('gemini') ? 'GPT-4o' : 'Gemini 2.5';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-red-600">APIエラー</h3>
        <p className="mt-2 text-sm text-gray-600">AIとの通信中にエラーが発生しました。</p>
        <div className="mt-4 text-xs text-left bg-gray-100 p-2 rounded-md overflow-auto max-h-24">
            <code className="whitespace-pre-wrap break-words">{errorMessage}</code>
        </div>
        <p className="mt-4 text-sm text-gray-600">どうしますか？</p>
        <div className="mt-6 flex flex-col gap-3">
          <button onClick={onRetry} className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700">
            再試行する
          </button>
          <button onClick={onSwitchAi} className="w-full bg-blue-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-blue-700">
            {nextModel}に切り替えて再試行
          </button>
          <button onClick={onStopAi} className="w-full bg-gray-500 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-gray-600">
            AIの利用を停止する
          </button>
        </div>
      </div>
    </div>
  );
};

const AiModelSelector: React.FC<{
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  disabled?: boolean;
}> = ({ settings, onSettingsChange, disabled }) => (
    <div className="flex items-center gap-1 text-xs">
        <span className={disabled ? "text-gray-400" : "text-gray-500"}>AI:</span>
        <select
            value={settings.selectedModel}
            onChange={e => onSettingsChange({ ...settings, selectedModel: e.target.value })}
            disabled={disabled}
            className="text-xs p-1 border-0 rounded bg-gray-100 hover:bg-gray-200 focus:ring-1 focus:ring-green-500 disabled:bg-gray-200 disabled:cursor-not-allowed"
        >
            <optgroup label="Google">
                <option value="gemini-2.5-flash">Gemini 2.5</option>
            </optgroup>
            <optgroup label="OpenAI">
                <option value="gpt-4o">GPT-4o</option>
            </optgroup>
        </select>
    </div>
);

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

    return <div className="text-gray-700 leading-relaxed">{elements.length > 0 ? elements : <p>{rawContent}</p>}</div>;
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs text-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900">変更の保存</h3>
        <p className="mt-2 text-sm text-gray-600">編集中の内容が保存されていません。保存しますか？</p>
        <div className="mt-6 flex flex-col gap-3">
          <button onClick={onConfirm} className="w-full bg-green-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-green-700 transition-colors">
            はい、保存する
          </button>
          <button onClick={onDeny} className="w-full bg-red-100 text-red-700 font-bold py-2.5 px-4 rounded-lg hover:bg-red-200 transition-colors">
            いいえ、破棄する
          </button>
          <button onClick={onClose} className="w-full text-gray-600 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-100 transition-colors text-sm">
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{message}</p>
        <div className="mt-6 flex gap-4">
          <button onClick={onCancel} className="w-1/2 bg-gray-200 text-gray-800 font-bold py-2.5 px-4 rounded-lg hover:bg-gray-300 transition-colors">
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
    const isToday = date.toDateString() === today.toDateString();
    const isSelected = initialDate.toDateString() === date.toDateString();
    const { isHoliday, isSaturday, isSunday } = getDayInfo(date);

    let dayColor = '';
    if (isHoliday) dayColor = 'text-pink-600';
    else if (isSunday) dayColor = 'text-red-500';
    else if (isSaturday) dayColor = 'text-blue-500';

    daysInGrid.push(
      <div key={day} className="h-10 flex items-center justify-center">
        <button
          onClick={() => onSelectDate(date)}
          className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
            isSelected ? 'bg-green-600 text-white font-bold' : isToday ? 'ring-2 ring-green-500' : 'hover:bg-green-100'
          }`}
        >
          <span className={`${isSelected ? 'text-white' : dayColor}`}>{day}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeftIcon className="h-6 w-6" /></button>
          <h2 className="text-lg font-bold text-gray-800">{currentDisplayDate.getFullYear()}年 {currentDisplayDate.getMonth() + 1}月</h2>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-100"><ChevronRightIcon className="h-6 w-6" /></button>
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

const CameraOptionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onAiDiagnose: () => void;
}> = ({ isOpen, onClose, onTakePhoto, onAiDiagnose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-4">カメラ</h3>
        <div className="flex justify-around gap-4">
          <button onClick={onTakePhoto} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 transition-colors w-1/2">
            <CameraIcon className="h-8 w-8 text-gray-700" />
            <span className="font-semibold text-gray-700">写真を撮る</span>
          </button>
          <button onClick={onAiDiagnose} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 transition-colors w-1/2">
            <ObservationIcon className="h-8 w-8 text-gray-700" />
            <span className="font-semibold text-gray-700">AI診断</span>
          </button>
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
};

const PageHeader: React.FC<{ title: string; onBack?: () => void; onMenuClick?: () => void; }> = ({ title, onBack, onMenuClick }) => (
    <header className="bg-cyan-100 shadow-sm sticky top-0 z-20 p-4 flex items-center justify-between h-12">
        <div className="w-10">
            {onBack && (
                <button onClick={onBack} className="p-2 rounded-full hover:bg-cyan-200">
                    <BackIcon className="h-6 w-6 text-gray-700" />
                </button>
            )}
        </div>
        <h1 className="text-xl font-bold text-gray-800 text-center absolute left-1/2 -translate-x-1/2">{title}</h1>
        <div className="flex items-center gap-1">
            {onMenuClick && (
                <button onClick={onMenuClick} className="p-2 rounded-full hover:bg-cyan-200">
                    <HamburgerIcon className="h-6 w-6 text-gray-700" />
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
      <div className={`absolute top-0 right-0 h-full w-72 bg-white shadow-xl transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="font-bold text-lg text-gray-800">メニュー</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <CloseIcon className="h-6 w-6 text-gray-700" />
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
                      className={`w-full flex items-center gap-4 p-4 rounded-lg text-left text-base transition-colors ${isActive ? 'bg-green-100 text-green-700 font-semibold' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      <item.icon className={`h-6 w-6 ${isActive ? 'text-green-600' : 'text-gray-500'}`} />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="p-2 border-t mt-2">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-4 p-4 rounded-lg text-left text-base transition-colors text-red-600 hover:bg-red-50"
            >
              <LogoutIcon className="h-6 w-6 text-red-500" />
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 text-center">{texts.title}</h3>
        <p className="mt-2 text-sm text-gray-600 text-center">{texts.description}</p>
        
        <div className="mt-6 text-left space-y-2 max-h-64 overflow-y-auto pr-2">
          {ranges.map(r => (
            <div key={r.value}>
              <label className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input 
                  type="radio" 
                  name="export-range" 
                  value={r.value}
                  checked={range === r.value}
                  onChange={() => setRange(r.value)}
                  className="h-5 w-5 text-green-600 focus:ring-green-500 border-gray-300"
                />
                <span className="text-base text-gray-700 font-medium">{r.label}</span>
              </label>
              {range === 'custom' && r.value === 'custom' && (
                <div className="pl-12 pr-4 pb-2 space-y-2 fade-in">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600">開始日</label>
                      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                     <span className="pt-5 text-gray-500">～</span>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-gray-600">終了日</label>
                      <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 rounded-lg text-sm" />
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
          <button onClick={onClose} className="w-full text-gray-600 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-100 transition-colors text-sm">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
};


const LoginPage: React.FC<{ onLogin: () => void }> = ({ onLogin }) => {
  const [username, setUsername] = useState('demo_user');
  const [password, setPassword] = useState('password');
  const { isListening: isListeningUser, startListening: startListeningUser } = useVoiceRecognition({ onResult: setUsername });
  const { isListening: isListeningPass, startListening: startListeningPass } = useVoiceRecognition({ onResult: setPassword });

  const GoogleIcon = () => (
    <svg className="h-5 w-5 mr-3" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"/>
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.223 0-9.657-3.356-11.303-8H6.306C9.656 39.663 16.318 44 24 44z"/>
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.426 44 30.039 44 24c0-1.341-.138-2.65-.389-3.917z"/>
    </svg>
  );

  const AppleIcon = () => (
    <svg className="h-6 w-6 mr-2" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.226 2.288a4.91 4.91 0 00-2.284 1.158 4.743 4.743 0 00-1.804 3.435c0 1.543.62 3.033 1.63 4.227.994 1.18 1.57 2.113 1.57 3.264 0 1.15-.55 2.113-1.57 3.238-1.022 1.2-1.63 2.69-1.63 4.215 0 .22.012.43.034.632a4.637 4.637 0 002.13 3.21a4.833 4.833 0 005.152-1.25c.982-1.127 1.547-2.03 1.547-3.132 0-1.15-.548-2.112-1.547-3.237-1.01-1.15-1.57-2.113-1.57-3.263 0-1.15.548-2.08 1.57-3.238a4.833 4.833 0 001.62-3.662c0-1.66-1.01-3.696-3.008-4.52zM12.75 6.012c.012-.22.034-.43.034-.633a3.12 3.12 0 00-1.01-2.298c-.4-.442-.8-.663-1.187-.663-.733 0-1.62.63-2.666 1.886a8.84 8.84 0 00-1.85 4.215c0 .41.06.81.18 1.198.4-.087.8-.13 1.21-.13.8 0 1.568.163 2.302.488a4.34 4.34 0 011.62-3.228.06.06 0 01-.01-.033z"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-lime-50 p-4">
      <div className="text-center mb-8">
        <VegetableBasketIcon className="h-20 w-20 text-green-600 mx-auto" />
        <h1 className="text-4xl font-bold text-green-800 mt-4">ベジログ</h1>
        <p className="text-green-700 mt-2">栽培記録アプリ</p>
      </div>
      <div className="w-full max-w-sm bg-white p-8 rounded-2xl shadow-lg">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-600">ユーザー名</label>
            <div className="relative mt-1">
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-12" />
              <button onClick={startListeningUser} className={`absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-full ${isListeningUser ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200'}`}><MicrophoneIcon className="h-5 w-5" /></button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-600">パスワード</label>
            <div className="relative mt-1">
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 pr-12" />
              <button onClick={startListeningPass} className={`absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-full ${isListeningPass ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200'}`}><MicrophoneIcon className="h-5 w-5" /></button>
            </div>
          </div>
          <button
            onClick={onLogin}
            className="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 transition-colors duration-300 text-lg"
          >
            ログイン
          </button>
        </div>

        <div className="my-6 flex items-center">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="flex-shrink mx-4 text-gray-500 text-sm">または</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>
        
        <div className="space-y-3">
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center bg-white text-gray-700 font-medium py-2.5 px-4 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-300"
          >
            <GoogleIcon />
            Googleでログイン
          </button>
          <button
            onClick={onLogin}
            className="w-full flex items-center justify-center bg-black text-white font-medium py-2.5 px-4 rounded-lg hover:bg-gray-800 transition-colors duration-300"
          >
            <AppleIcon />
            Appleでサインイン
          </button>
        </div>

        <p className="text-xs text-center text-gray-500 mt-8">これはデモです。任意のログイン方法で動作します。</p>
      </div>
    </div>
  );
};


const Dashboard: React.FC<{ 
  records: CultivationRecord[];
  onLaneClick: (lane: string) => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  handleApiCall: ApiCallHandler;
}> = ({ records, onLaneClick, settings, onSettingsChange, handleApiCall }) => {
  const [tip, setTip] = useState('今日の一言を読み込み中...');
  
  const today = new Date();
  const formattedDate = `${today.toLocaleDateString()} (${['日', '月', '火', '水', '木', '金', '土'][today.getDay()]})`;

  useEffect(() => {
    if (settings.enableAiFeatures) {
      setTip('AIが今日の一句を考えています...');
      const fetchQuote = async () => {
        try {
          const quote = await handleApiCall(() => getDailyQuote(settings.selectedModel));
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
  }, [settings.enableAiFeatures, settings.selectedModel, handleApiCall]);


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
      <div className="bg-white p-3 rounded-xl shadow-md border border-green-200">
        <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-green-800">今日の一言</h3>
            {settings.enableAiFeatures && <AiModelSelector settings={settings} onSettingsChange={onSettingsChange} />}
        </div>
        <p className="text-gray-600 italic text-lg whitespace-nowrap overflow-hidden text-ellipsis">{tip}</p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">栽培レーンの状況</h2>
          <span className="text-sm font-medium text-gray-500">{formattedDate}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {CULTIVATION_LANES.map((lane, index) => {
            const current = laneStatus[lane];
            const cardColor = PASTEL_COLORS[index % PASTEL_COLORS.length];
            
            return (
              <button
                key={lane}
                onClick={() => onLaneClick(lane)}
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
                <div className="w-1/2 flex items-center justify-center bg-black/5 rounded-r-xl py-2 px-1">
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
                          <MoundIcon className="h-10 w-10 text-gray-400 opacity-60"/>
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
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-xs" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 text-center mb-4">画像を選択</h3>
        <div className="flex justify-around gap-4">
          <button onClick={() => onSelect('camera')} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 transition-colors w-1/2">
            <CameraIcon className="h-8 w-8 text-gray-700" />
            <span className="font-semibold text-gray-700">カメラ</span>
          </button>
          <button onClick={() => onSelect('gallery')} className="flex flex-col items-center gap-2 p-4 rounded-lg hover:bg-gray-100 transition-colors w-1/2">
            <ImageIcon className="h-8 w-8 text-gray-700" />
            <span className="font-semibold text-gray-700">ギャラリー</span>
          </button>
        </div>
      </div>
    </div>
  );
};


const RecordPage = forwardRef<RecordPageHandle, RecordPageProps>(({ onSaveRecord, onBack, initialData, settings, onSettingsChange, onDirtyChange, onConfirmationRequest, handleApiCall }, ref) => {
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
  const [error, setError] = useState('');
  const [recordDate, setRecordDate] = useState(initialData?.date || toISODateString(new Date()));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState<string | null>(null);
  const [imageSourceModal, setImageSourceModal] = useState<{ open: boolean; side: 'front' | 'back' } | null>(null);


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
    });
    initialFormStateRef.current = currentState;
  }, [initialData]);

  const isDirty = useMemo(() => {
    if (!initialFormStateRef.current) return false;
    const currentState = JSON.stringify({ cropName, cultivationLane, workTypes, cropStages, observationStatus, pestDetails, memo, photo, seedPackageFront, seedPackageBack, recordDate, packageInfo, pestInfo });
    return initialFormStateRef.current !== currentState;
  }, [cropName, cultivationLane, workTypes, cropStages, observationStatus, pestDetails, memo, photo, seedPackageFront, seedPackageBack, recordDate, packageInfo, pestInfo]);

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
        const ocrText = await handleApiCall(() => extractTextFromImage(mimeType, data, settings.selectedModel));
        if (stopAnalysisRef.current || !ocrText) return;

        if (ocrText && ocrText !== "テキストの抽出に失敗しました。") {
            const info = await handleApiCall(() => analyzeSeedPackage(ocrText, settings.selectedModel));
            if (stopAnalysisRef.current || !info) return;
            
            setPackageInfo(info);
            
            const nameToSearch = cropName || info?.productName;
            if (nameToSearch) {
                setIsSearchingPests(true);
                const pests = await handleApiCall(() => searchCommonPestsForCrop(nameToSearch, settings.selectedModel));
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
  }, [cropName, settings.selectedModel, handleApiCall]);

  
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
      const text = await handleApiCall(() => extractTextFromImage(part.mimeType, part.data, settings.selectedModel));
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
      setError(errorMessage);
      return;
    }
    setError('');
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
  });

  useImperativeHandle(ref, () => ({
    validate: () => validateAndGetRecordData().error,
    getRecordData,
    handleSubmit: handleSubmit,
  }));


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
      <div className="bg-yellow-50 p-6 rounded-xl shadow-md">
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-1/2">
              <label className="text-sm font-medium text-gray-700">作業日</label>
              <button 
                onClick={() => setIsCalendarOpen(true)} 
                className="mt-1 w-full p-3 border border-gray-300 rounded-lg bg-white text-left text-base"
              >
                {recordDate} ({['日', '月', '火', '水', '木', '金', '土'][recordDateObj.getDay()]})
              </button>
            </div>
            <div className="w-1/2">
              <label className="text-sm font-medium text-gray-700">栽培レーン</label>
              <select value={cultivationLane} onChange={e => setCultivationLane(e.target.value)} className="mt-1 w-full p-3 border border-gray-300 rounded-lg bg-white">
                {CULTIVATION_LANES.map(lane => <option key={lane} value={lane}>{lane}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">作物の名前（例：ミニトマト）</label>
            <div className="relative mt-1">
              <input type="text" value={cropName} onChange={e => setCropName(e.target.value)} placeholder="何を育てていますか？" className="w-full p-3 border border-gray-300 rounded-lg pr-12" />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                 <button onClick={startListeningCropName} disabled={!settings.enableAiFeatures} className={`p-2 rounded-full ${isListeningCropName ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200'} disabled:opacity-50 disabled:cursor-not-allowed`}><MicrophoneIcon className="h-5 w-5" /></button>
              </div>
            </div>
          </div>
          
          {settings.enableAiFeatures && (
          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="text-sm font-medium text-gray-700">種のパッケージ写真とAI解析（任意）</label>
                 {(seedPackageFront || seedPackageBack) && (
                    <div className="flex items-center gap-2">
                         <div className="flex items-center gap-1 text-xs">
                          <AiModelSelector settings={settings} onSettingsChange={onSettingsChange} />
                        </div>
                        <button onClick={handleUpdateAnalysis} disabled={!seedPackageBack} title="AI解析を再実行" className="p-1 rounded-full text-gray-500 hover:bg-blue-100 hover:text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed">
                            <RefreshIcon className="h-5 w-5" />
                        </button>
                        <button onClick={handleDeletePackageData} title="データ削除" className="p-1 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600">
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
                <div className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-white/50 hover:bg-gray-50 relative p-1 cursor-pointer" 
                  onClick={() => seedPackageFront ? setModalImage(seedPackageFront) : setImageSourceModal({ open: true, side: 'front' })}
                >
                   <div className="absolute top-1 left-1 bg-black/40 text-white text-xs font-semibold px-2 py-0.5 rounded-full z-10">表</div>
                  {seedPackageFront ? (
                    <img src={seedPackageFront} alt="パッケージ表" className="h-full w-full object-contain rounded-md" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Back Photo */}
              <div className="w-1/5">
                <input type="file" accept="image/*" capture="environment" onChange={(e) => handleSeedPhotoCapture(e, 'back')} className="hidden" id="seed-back-camera" />
                <input type="file" accept="image/*" onChange={(e) => handleSeedPhotoCapture(e, 'back')} className="hidden" id="seed-back-gallery" />
                <div className="w-full h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-white/50 hover:bg-gray-50 relative p-1 cursor-pointer"
                  onClick={() => seedPackageBack ? setModalImage(seedPackageBack) : setImageSourceModal({ open: true, side: 'back' })}
                >
                  <div className="absolute top-1 left-1 bg-black/40 text-white text-xs font-semibold px-2 py-0.5 rounded-full z-10">裏</div>
                  {seedPackageBack ? (
                    <img src={seedPackageBack} alt="パッケージ裏" className="h-full w-full object-contain rounded-md" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-gray-400" />
                  )}
                </div>
              </div>

              {/* AI Analysis Column */}
              <div className="w-3/5 bg-lime-50 p-3 rounded-lg border border-gray-200 space-y-2 overflow-y-auto flex flex-col text-sm h-40">
                {(isAnalyzingPackage || packageInfo) ? (
                  <div className="space-y-2">
                     <div className="flex justify-between items-center">
                        <h4 className="font-bold text-green-800">AIパッケージ解析結果</h4>
                        {isAnalyzingPackage && (
                            <button onClick={handleStopAnalysis} className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-md hover:bg-red-200 transition-colors">
                              停止
                            </button>
                        )}
                      </div>
                    {isAnalyzingPackage ? (
                      <div className="flex items-center gap-2 text-gray-600">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-500"></div>
                          <span>解析中...</span>
                      </div>
                    ) : packageInfo ? (
                      <div className="space-y-4 text-xs text-gray-700">
                          {packageInfo.productName && <p><strong className="font-semibold text-gray-900">商品名:</strong> 【{packageInfo.productName}】</p>}
                          {packageInfo.family && <p><strong className="font-semibold text-gray-900">科・属名:</strong> {packageInfo.family}</p>}
                          {packageInfo.features && <p><strong className="font-semibold text-gray-900">特徴:</strong> {packageInfo.features}</p>}
                          
                           <div className="space-y-2 pt-2 mt-2 border-t border-gray-200">
                                <div className="grid grid-cols-1 gap-y-2">
                                  <div>
                                    <h5 className="font-bold text-gray-800 text-xs mb-1">栽培時期</h5>
                                    <table className="w-full text-xs">
                                        <tbody>
                                            {packageInfo.seedlingPeriod && <tr><td className="pr-2 font-medium text-gray-600">育苗</td><td className="text-gray-900 text-right">{packageInfo.seedlingPeriod}</td></tr>}
                                            {packageInfo.plantingPeriod && <tr><td className="pr-2 font-medium text-gray-600">定植</td><td className="text-gray-900 text-right">{packageInfo.plantingPeriod}</td></tr>}
                                            {packageInfo.harvestTime && <tr><td className="pr-2 font-medium text-gray-600">収穫</td><td className="text-gray-900 text-right">{packageInfo.harvestTime}</td></tr>}
                                        </tbody>
                                    </table>
                                  </div>
                                  <div>
                                      <h5 className="font-bold text-gray-800 text-xs mb-1">栽培条件</h5>
                                      <table className="w-full text-xs">
                                          <tbody>
                                              {packageInfo.daysToGermination && <tr><td className="pr-2 font-medium text-gray-600">発芽日数</td><td className="text-gray-900 text-right">{packageInfo.daysToGermination}</td></tr>}
                                              {packageInfo.germinationTemp && <tr><td className="pr-2 font-medium text-gray-600">発芽適温</td><td className="text-gray-900 text-right">{packageInfo.germinationTemp}</td></tr>}
                                              {packageInfo.growingTemp && <tr><td className="pr-2 font-medium text-gray-600">生育適温</td><td className="text-gray-900 text-right">{packageInfo.growingTemp}</td></tr>}
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
                  <div className="space-y-2 pt-2 mt-2 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                        <h4 className="font-bold text-red-800">注意すべき病害虫</h4>
                        {isSearchingPests && (
                            <button onClick={handleStopAnalysis} className="text-xs bg-red-100 text-red-700 font-semibold px-2 py-1 rounded-md hover:bg-red-200 transition-colors">
                              停止
                            </button>
                        )}
                    </div>
                      {isSearchingPests ? (
                          <div className="flex items-center gap-2 text-gray-600">
                              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-red-500"></div>
                              <span>検索中...</span>
                          </div>
                      ) : pestInfo ? (
                          <ul className="list-disc list-inside text-xs text-gray-700 space-y-1">
                              {pestInfo.map((pest, index) => <li key={index}>{pest}</li>)}
                          </ul>
                      ) : null}
                  </div>
                ) : null}

                {!isAnalyzingPackage && !packageInfo && !isSearchingPests && !pestInfo && (
                    <div className="flex-grow flex flex-col items-center justify-center text-center text-gray-500 text-xs p-2">
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
            <label className="text-sm font-medium text-gray-700">作業の種類（複数選択可）</label>
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-2">
              {Object.entries(WORK_TYPE_DETAILS)
                .filter(([type]) => settings.enablePumiceWash || type !== WorkType.PumiceWash)
                .map(([type, { label, Icon }]) => {
                  const isSelected = workTypes.includes(type as WorkType);
                  return (
                    <button key={type} onClick={() => handleWorkTypeToggle(type as WorkType)} className={`p-2 rounded-lg flex flex-col items-center justify-center text-xs transition-all h-20 ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 bg-blue-100' : 'bg-gray-100 hover:bg-gray-200'}`}>
                      <Icon className={`h-7 w-7 mb-1 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                      {label}
                    </button>
                  );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">作物の状況（複数選択可）</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(CROP_STAGE_DETAILS).map(([stage, { label, Icon }]) => {
                const isSelected = cropStages.includes(stage as CropStage);
                return (
                  <button key={stage} onClick={() => handleCropStageToggle(stage as CropStage)} className={`p-2 rounded-lg flex flex-col items-center justify-center text-xs transition-all h-20 ${isSelected ? 'ring-2 ring-offset-2 ring-green-500 bg-green-100' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    <Icon className={`h-7 w-7 mb-1 ${isSelected ? 'text-green-600' : 'text-gray-600'}`} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-gray-700">観察記録（複数選択可）</label>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
               {Object.entries(OBSERVATION_STATUS_DETAILS).map(([status, { label }]) => {
                const isSelected = observationStatus.includes(status as ObservationStatus);
                return (
                  <button key={status} onClick={() => handleObservationStatusToggle(status as ObservationStatus)} className={`p-2 rounded-lg text-sm transition-all ${isSelected ? 'ring-2 ring-offset-1 ring-purple-500 bg-purple-100' : 'bg-gray-100 hover:bg-gray-200'}`}>
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          
          {showPestDetails && (
            <div className="bg-purple-50 p-4 rounded-lg space-y-3 fade-in border border-purple-200">
              <label className="text-sm font-medium text-gray-700">病害虫の詳細（複数選択可）</label>
              {pestInfo && pestInfo.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600 mb-2">AIによる予測リスト：</p>
                  <div className="flex flex-wrap gap-2">
                    {pestInfo.map(pest => {
                      const isSelected = pestDetails.includes(pest);
                      return (
                        <button key={pest} onClick={() => handlePestDetailToggle(pest)} className={`px-3 py-1 text-sm rounded-full transition-colors ${isSelected ? 'bg-red-500 text-white shadow' : 'bg-white border hover:bg-red-50'}`}>
                          {pest}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div>
                  <p className="text-xs text-gray-600 mb-2">カスタム入力：</p>
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-grow">
                      <input 
                          type="text" 
                          value={customPest}
                          onChange={e => setCustomPest(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleAddCustomPest()}
                          placeholder="病害虫名を入力"
                          className="w-full p-2 border border-gray-300 rounded-lg pr-10"
                      />
                      <button onClick={startListeningPest} disabled={!settings.enableAiFeatures} className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full ${isListeningPest ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200'} disabled:opacity-50 disabled:cursor-not-allowed`}><MicrophoneIcon className="h-5 w-5" /></button>
                    </div>
                    <button onClick={handleAddCustomPest} className="bg-purple-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm">追加</button>
                  </div>
              </div>
              {pestDetails.length > 0 && (
                <div className="pt-3 border-t">
                  <p className="text-xs text-gray-600 mb-2">選択中の病害虫：</p>
                  <div className="flex flex-wrap gap-2">
                    {pestDetails.map(pest => (
                      <div key={pest} className="flex items-center gap-1.5 bg-purple-200 text-purple-800 text-sm pl-2.5 pr-1 py-0.5 rounded-full">
                        <span>{pest}</span>
                        <button onClick={() => handlePestDetailToggle(pest)} className="text-purple-600 hover:text-purple-900 rounded-full hover:bg-purple-300 p-0.5"><CloseIcon className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-gray-700">成長記録の写真（任意）</label>
            <div className="mt-1">
              <input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="hidden" id="photo-upload" />
              <label htmlFor="photo-upload" className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50">
                {photo ? <img src={photo} alt="プレビュー" className="h-full w-full object-cover rounded-lg" /> : (<><CameraIcon className="h-12 w-12 text-gray-400" /><span className="mt-2 text-sm text-gray-600">写真を撮る</span></>)}
              </label>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">メモ（任意）</label>
             <div className="relative mt-1">
              <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3} placeholder="何か覚えておくことはありますか？" className="w-full p-3 border border-gray-300 rounded-lg pr-32"></textarea>
              <div className="absolute right-2 top-2 flex items-center gap-1">
                <button onClick={startListeningMemo} disabled={!settings.enableAiFeatures} className={`p-2 rounded-full ${isListeningMemo ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200'} disabled:opacity-50 disabled:cursor-not-allowed`}><MicrophoneIcon className="h-5 w-5" /></button>
                <button onClick={() => memoOcrCameraRef.current?.click()} disabled={!settings.enableAiFeatures} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><CameraIcon className="h-5 w-5" /></button>
                <button onClick={() => memoOcrGalleryRef.current?.click()} disabled={!settings.enableAiFeatures} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><ImageIcon className="h-5 w-5" /></button>
                {isOcrLoading === 'memo' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>}
                <input type="file" accept="image/*" capture="environment" ref={memoOcrCameraRef} onChange={(e) => handleOcr(e.target.files?.[0] || null, setMemo, 'memo')} className="hidden" />
                <input type="file" accept="image/*" ref={memoOcrGalleryRef} onChange={(e) => handleOcr(e.target.files?.[0] || null, setMemo, 'memo')} className="hidden" />
              </div>
            </div>
          </div>
          
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
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
    <button onClick={onClick} className="w-full bg-yellow-50 rounded-xl shadow-md overflow-hidden fade-in flex text-left hover:shadow-lg transition-shadow">
        <div className="w-2/3 p-4 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{record.cultivationLane} 【{record.cropName}】</h3>
            <p className="text-sm text-gray-500 mt-1">{formattedDate}</p>
          
            <div className="space-y-2 mt-3 text-xs">
              {workTypesToDisplay.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 w-12 shrink-0">作業:</span>
                    <div className="flex flex-wrap gap-1">
                      {workTypesToDisplay.map(type => {
                        const details = WORK_TYPE_DETAILS[type as WorkType];
                        return <span key={type} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{details?.label || type}</span>;
                      })}
                    </div>
                  </div>
              )}
              {cropStagesToDisplay.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-gray-600 w-12 shrink-0">状況:</span>
                    <div className="flex flex-wrap gap-1">
                      {cropStagesToDisplay.map(stage => {
                        const details = CROP_STAGE_DETAILS[stage as CropStage];
                        return <span key={stage} className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{details?.label || stage}</span>;
                      })}
                    </div>
                  </div>
              )}
              {record.observationStatus && record.observationStatus.length > 0 && (
                  <div className="flex items-start gap-2">
                     <span className="font-semibold text-gray-600 w-12 shrink-0">観察:</span>
                    <div className="flex flex-wrap gap-1">
                        {record.observationStatus.map(status => (
                            <span key={status} className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                {OBSERVATION_STATUS_DETAILS[status as ObservationStatus]?.label || status}
                            </span>
                        ))}
                    </div>
                  </div>
              )}
              {record.pestDetails && record.pestDetails.length > 0 && (
                  <div className="flex items-start gap-2">
                     <span className="font-semibold text-gray-600 w-12 shrink-0">病害虫:</span>
                    <div className="flex flex-wrap gap-1">
                        {record.pestDetails.map(pest => (
                            <span key={pest} className="bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                                {pest}
                            </span>
                        ))}
                    </div>
                  </div>
              )}
            </div>
          </div>
          
          {record.memo && <p className="mt-3 text-gray-700 text-xs bg-gray-50 p-2 rounded-md whitespace-pre-wrap break-words">{record.memo}</p>}
        </div>
        <div className="w-1/3 bg-gray-200">
          {record.photoBase64 ? (
            <img src={record.photoBase64} alt={record.cropName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <LeafIcon className="h-12 w-12 text-gray-400" />
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
    daysInGrid.push(<div key={`blank-${i}`} className="border-r border-b h-12"></div>);
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
      <div key={day} className="border-r border-b h-12">
        <button
          onClick={() => setSelectedDate(date)}
          className={`w-full h-full relative rounded-md text-sm transition-colors ${
            isSelected ? 'bg-green-600 text-white font-bold' : isToday ? 'ring-2 ring-green-500' : 'hover:bg-green-100'
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
      <div className="bg-white p-4 rounded-xl shadow-md">
        <label htmlFor="crop-filter" className="block text-sm font-medium text-gray-700">作物で絞り込み</label>
        <select
          id="crop-filter"
          value={filterCrop}
          onChange={e => { setFilterCrop(e.target.value); setSelectedDate(null); }}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm rounded-md"
        >
          <option value="">すべての作物</option>
          {uniqueCrops.map(crop => <option key={crop} value={crop}>{crop}</option>)}
        </select>
      </div>
      
      {filterCrop ? (
        <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 text-center">「{filterCrop}」の記録 (過去3ヶ月)</h3>
            {filteredRecordsList.length > 0 ? (
                filteredRecordsList.map(record => <RecordCard key={record.id} record={record} onClick={() => onRecordClick(record)} />)
            ) : (
                <div className="text-center py-6 bg-white rounded-xl shadow-md">
                    <p className="text-gray-500">この期間の記録はありません。</p>
                </div>
            )}
        </div>
      ) : (
      <>
        <div className="bg-white p-4 rounded-xl shadow-md">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100"><ChevronLeftIcon className="h-6 w-6" /></button>
            <h2 className="text-lg font-bold text-gray-800">{currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月</h2>
            <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-100"><ChevronRightIcon className="h-6 w-6" /></button>
          </div>
          <div className="grid grid-cols-7 border-t border-l">
            {weekHeaderLabels.map((day, index) => (
              <div key={day} className={`text-center font-semibold text-sm py-2 border-r border-b ${weekHeaderColors[index]}`}>
                {day}
              </div>
            ))}
            {daysInGrid}
          </div>
        </div>

        {selectedDate && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 text-center">{selectedDate.toLocaleDateString()}の記録</h3>
            {selectedRecords.length > 0 ? (
              selectedRecords.map(record => <RecordCard key={record.id} record={record} onClick={() => onRecordClick(record)} />)
            ) : (
              <div className="text-center py-6 bg-white rounded-xl shadow-md">
                <p className="text-gray-500">この日の記録はありません。</p>
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
    { name: '天気・暑さ指数', icon: WeatherIcon, page: 'WEATHER' },
    { name: 'レシピ検索', icon: RecipeIcon, page: 'RECIPE_SEARCH' },
  ];

  return (
    <div className="p-4">
      <div className="grid grid-cols-2 gap-4">
        {tools.map(tool => (
          <button
            key={tool.page}
            onClick={() => setPage(tool.page)}
            className="bg-white p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow flex flex-col items-center justify-center h-32"
          >
            <tool.icon className="h-10 w-10 text-green-600 mb-2" />
            <span className="font-semibold text-gray-700 text-center text-sm">{tool.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const CalculatorPage: React.FC<PageProps> = ({ setPage, records }) => {
  const [fertilizer, setFertilizer] = useState<'M-Plus-1' | 'M-Plus-2'>('M-Plus-1');
  const [waterAmount, setWaterAmount] = useState('2');
  const [dilution, setDilution] = useState('500');
  const [result, setResult] = useState(0);

  useEffect(() => {
    const water = parseFloat(waterAmount) || 0;
    const dil = parseInt(dilution, 10) || 0;
    if (water > 0 && dil > 0) {
      const neededMl = (water * 1000) / dil;
      setResult(neededMl);
    } else {
      setResult(0);
    }
  }, [waterAmount, dilution]);

  const capsNeeded = result > 0 ? (result / PET_BOTTLE_CAP_ML).toFixed(1) : 0;
  
  return (
    <div className="p-4 space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-md space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">液肥の種類</label>
          <select value={fertilizer} onChange={e => setFertilizer(e.target.value as any)} className="mt-1 w-full p-2 border border-gray-300 rounded-lg bg-white">
            <option value="M-Plus-1">{FERTILIZERS['M-Plus-1'].name}</option>
            <option value="M-Plus-2">{FERTILIZERS['M-Plus-2'].name}</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">{FERTILIZERS[fertilizer].usage}</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">水の量（リットル）</label>
          <input type="number" value={waterAmount} onChange={e => setWaterAmount(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 rounded-lg" placeholder="例: 2" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">希釈倍率（倍）</label>
          <input type="number" value={dilution} onChange={e => setDilution(e.target.value)} className="mt-1 w-full p-2 border border-gray-300 rounded-lg" placeholder="例: 500" />
        </div>
      </div>
      <div className="bg-green-100 p-4 rounded-xl shadow-md text-center">
        <p className="text-sm font-medium text-green-800">必要な液肥の量</p>
        <p className="text-4xl font-bold text-green-700 my-2">{result.toFixed(2)}<span className="text-lg ml-1">ml</span></p>
        <p className="text-green-600">ペットボトルのキャップ 約 <span className="font-bold">{capsNeeded}</span> 杯分</p>
      </div>
    </div>
  );
};


const RecipeSearchPage: React.FC<PageProps> = ({ settings, onSettingsChange, handleApiCall, records }) => {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [recipes, setRecipes] = useState<any[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});

  const { isListening, startListening } = useVoiceRecognition({ onResult: setQuery });

  const cultivatedCrops = useMemo(() => {
    const cropNames = records.map(r => r.cropName).filter(Boolean);
    return [...new Set(cropNames)];
  }, [records]);
  
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setRecipes([]);
    setImageUrls({});
    
    try {
      const result = await handleApiCall(() => searchRecipes(searchQuery, settings.selectedModel));
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
  }, [settings.selectedModel, handleApiCall]);
  
  useEffect(() => {
    if (recipes.length > 0) {
        recipes.forEach(async (recipe, index) => {
            if (recipe.imageQuery) {
                try {
                    const imageUrl = await handleApiCall(() => generateRecipeImage(recipe.imageQuery, settings.selectedModel));
                    if (imageUrl) {
                        setImageUrls(prev => ({ ...prev, [index]: imageUrl }));
                    }
                } catch (e) {
                    console.error(`Failed to generate image for "${recipe.recipeName}"`, e);
                }
            }
        });
    }
  }, [recipes, settings.selectedModel, handleApiCall]);

  const handleCropButtonClick = (cropName: string) => {
    setQuery(cropName);
    handleSearch(cropName);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-800">レシピ検索</h3>
            <AiModelSelector settings={settings} onSettingsChange={onSettingsChange} disabled={isLoading} />
        </div>
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <input 
              type="text" 
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch(query)}
              placeholder="野菜名を入力 (例: トマト)"
              className="w-full p-2 border border-gray-300 rounded-lg pr-10"
              disabled={isLoading}
            />
            <button onClick={startListening} disabled={isLoading} className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200'}`}><MicrophoneIcon className="h-5 w-5" /></button>
          </div>
          <button onClick={() => handleSearch(query)} disabled={isLoading || !query.trim()} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">
            検索
          </button>
        </div>
        {cultivatedCrops.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">現在栽培中の作物:</p>
            <div className="flex flex-wrap gap-2">
              {cultivatedCrops.map(crop => (
                <button
                  key={crop}
                  onClick={() => handleCropButtonClick(crop)}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full hover:bg-green-200 transition-colors disabled:opacity-50"
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
          <div key={index} className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="h-40 bg-gray-200 flex items-center justify-center">
              {imageUrls[index] ? (
                <img src={imageUrls[index]} alt={recipe.recipeName} className="w-full h-full object-cover" />
              ) : (
                <div className="animate-pulse w-full h-full bg-gray-300"></div>
              )}
            </div>
            <div className="p-4">
              <h4 className="font-bold text-lg text-gray-800">{recipe.recipeName}</h4>
              <p className="text-sm text-gray-600 mt-1">{recipe.description}</p>
              <div className="mt-3">
                <h5 className="font-semibold text-sm text-gray-700">主な材料</h5>
                <ul className="list-disc list-inside text-sm text-gray-600 mt-1">
                  {recipe.ingredients.map((ing: string, i: number) => <li key={i}>{ing}</li>)}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
      const info = await handleApiCall(() => getVegetableInfo(searchQuery, settings.selectedModel));
      if (info) setResult(info);
    } catch (e) {
      console.error(e);
      alert("情報の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [settings.selectedModel, handleApiCall]);
  
  const handleCropButtonClick = (cropName: string) => {
    setQuery(cropName);
    handleSearch(cropName);
  };
  
  const InfoSection: React.FC<{title: string; children: React.ReactNode;}> = ({title, children}) => (
    <div className="bg-white p-4 rounded-xl shadow-md">
      <h3 className="text-lg font-bold text-green-800 mb-2">{title}</h3>
      <div className="space-y-2 text-sm text-gray-700">{children}</div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-md">
         <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-800">野菜の育て方検索</h3>
            <AiModelSelector settings={settings} onSettingsChange={onSettingsChange} disabled={isLoading}/>
        </div>
        <div className="flex gap-2">
           <div className="relative flex-grow">
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch(query)} placeholder="野菜名を入力" className="w-full p-2 border border-gray-300 rounded-lg pr-10" disabled={isLoading} />
            <button onClick={startListening} disabled={isLoading} className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200'}`}><MicrophoneIcon className="h-5 w-5" /></button>
          </div>
          <button onClick={() => handleSearch(query)} disabled={isLoading || !query.trim()} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">検索</button>
        </div>
        {cultivatedCrops.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-500 mb-1">現在栽培中の作物:</p>
            <div className="flex flex-wrap gap-2">
              {cultivatedCrops.map(crop => (
                <button
                  key={crop}
                  onClick={() => handleCropButtonClick(crop)}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-green-100 text-green-800 rounded-full hover:bg-green-200 transition-colors disabled:opacity-50"
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
          <h2 className="text-2xl font-bold text-center text-gray-800">{result.vegetableName} の育て方</h2>
          <InfoSection title="栽培ごよみ">
            <p><strong>種まき:</strong> {result.cultivationCalendar.seeding}</p>
            <p><strong>植え付け:</strong> {result.cultivationCalendar.planting}</p>
            <p><strong>収穫:</strong> {result.cultivationCalendar.harvest}</p>
          </InfoSection>
          <InfoSection title="施肥計画 (TOMATEC M-Plus)">
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
      const info = await handleApiCall(() => searchPestInfo(query, settings.selectedModel, imagePart));
      if (info) setResult(info);
    } catch (e) {
      console.error(e);
      alert("情報の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [query, image, settings.selectedModel, handleApiCall]);

  const SummaryCard: React.FC<{title: string; content: string}> = ({title, content}) => (
    <div className="bg-lime-50 p-3 rounded-lg">
      <h4 className="font-bold text-lime-800 text-sm">{title}</h4>
      <p className="text-lime-900 text-sm mt-1">{content}</p>
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
        <div className="bg-white p-4 rounded-xl shadow-md space-y-3">
          <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">病害虫・症状検索</h3>
              <AiModelSelector settings={settings} onSettingsChange={onSettingsChange} disabled={isLoading}/>
          </div>
          <div className="relative">
            <textarea value={query} onChange={e => setQuery(e.target.value)} rows={2} placeholder="症状を入力 (例: 葉に白い斑点がある)" className="w-full p-2 border border-gray-300 rounded-lg pr-24" disabled={isLoading}></textarea>
             <div className="absolute right-2 top-2 flex items-center gap-1">
                <button onClick={() => setIsSourceModalOpen(true)} disabled={isLoading} className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"><CameraIcon className="h-5 w-5" /></button>
                <button onClick={startListening} disabled={isLoading} className={`p-2 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200'} disabled:opacity-50 disabled:cursor-not-allowed`}><MicrophoneIcon className="h-5 w-5" /></button>
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
            <h2 className="text-2xl font-bold text-center text-red-800">{result.pestName}</h2>
            <div className="bg-white p-4 rounded-xl shadow-md space-y-2">
              <h3 className="text-lg font-bold text-gray-800 mb-2">概要</h3>
              <SummaryCard title="特徴" content={result.summary.characteristics} />
              <SummaryCard title="原因" content={result.summary.causes} />
              <SummaryCard title="対策" content={result.summary.countermeasures} />
            </div>
            <div className="bg-white p-4 rounded-xl shadow-md space-y-2">
              <h3 className="text-lg font-bold text-gray-800 mb-2">詳細情報</h3>
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
      const res = await handleApiCall(() => searchGardeningTerm(query, settings.selectedModel));
      if (res) setResult(res);
    } catch (e) {
      console.error(e);
      alert("用語の解説の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  }, [query, settings.selectedModel, handleApiCall]);
  
  return (
    <div className="p-4 space-y-4">
      <div className="bg-white p-4 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-800">園芸用語辞典</h3>
            <AiModelSelector settings={settings} onSettingsChange={onSettingsChange} disabled={isLoading}/>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-grow">
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} placeholder="例: 摘心" className="w-full p-2 border border-gray-300 rounded-lg pr-10" disabled={isLoading} />
            <button onClick={startListening} disabled={isLoading} className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200'}`}><MicrophoneIcon className="h-5 w-5" /></button>
          </div>
          <button onClick={handleSearch} disabled={isLoading || !query.trim()} className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400">検索</button>
        </div>
      </div>
      
      {isLoading && <div className="text-center p-4">AIが解説を生成しています...</div>}
      
      {result && (
        <div className="bg-white p-4 rounded-xl shadow-md fade-in">
          <h2 className="text-xl font-bold text-gray-800 mb-2">「{query}」の解説</h2>
          <FormattedContent content={result.text} />
        </div>
      )}
    </div>
  );
};

const WeatherChart: React.FC<{ hourlyData: WeatherInfo['hourly']; startDate: string }> = ({ hourlyData, startDate }) => {
    const CHART_HEIGHT = 240;
    const ITEM_WIDTH = 65;
    const TEMP_AREA_HEIGHT = 80;
    const ICON_AREA_HEIGHT = 50;
    const PRECIP_AREA_HEIGHT = 40;
    const PADDING_TOP = 20;
    const PADDING_BOTTOM = 50;

    if (!hourlyData || hourlyData.length === 0) return null;

    const svgWidth = hourlyData.length * ITEM_WIDTH;

    const temps = hourlyData.map(h => h.temperature);
    const precips = hourlyData.map(h => h.precipitation);
    const minTemp = Math.min(...temps) - 2;
    const maxTemp = Math.max(...temps) + 2;
    const maxPrecip = Math.max(...precips, 1);

    const tempToY = (temp: number) => PADDING_TOP + TEMP_AREA_HEIGHT - ((temp - minTemp) / (maxTemp - minTemp)) * TEMP_AREA_HEIGHT;
    const precipToHeight = (precip: number) => (precip / maxPrecip) * PRECIP_AREA_HEIGHT;
    
    const dates = useMemo(() => {
        const startingDate = parseDateString(startDate);
        let lastHour = -1;
        let dayOffset = 0;

        return hourlyData.map(h => {
            const currentHour = parseInt(h.time.split(':')[0], 10);
            if (currentHour < lastHour) {
                dayOffset++;
            }
            lastHour = currentHour;
            
            const currentDate = new Date(startingDate);
            currentDate.setDate(startingDate.getDate() + dayOffset);
            
            return `${currentDate.getMonth() + 1}/${currentDate.getDate()}`;
        });
    }, [hourlyData, startDate]);
    
    const linePath = hourlyData.map((h, i) => {
        const x = i * ITEM_WIDTH + ITEM_WIDTH / 2;
        const y = tempToY(h.temperature);
        return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
    }).join(' ');

    const PRECIP_Y_BASE = PADDING_TOP + TEMP_AREA_HEIGHT + ICON_AREA_HEIGHT + PRECIP_AREA_HEIGHT;

    return (
        <div className="overflow-x-auto bg-gray-50 p-2 rounded-lg -mx-2">
            <svg width={svgWidth} height={CHART_HEIGHT} className="select-none">
                {/* Precipitation Bars and Labels */}
                {hourlyData.map((h, i) => {
                    const barHeight = precipToHeight(h.precipitation);
                    const x = i * ITEM_WIDTH + (ITEM_WIDTH - 20) / 2;
                    const y = PRECIP_Y_BASE - barHeight;
                    return (
                        <g key={`precip-${i}`}>
                            <rect x={x} y={y} width={20} height={barHeight} fill="#60a5fa" rx="4" ry="4"/>
                            {h.precipitation > 0.1 && (
                                <text x={x + 10} y={y - 4} textAnchor="middle" fontSize="10" fill="#4b5563">
                                    {h.precipitation}mm
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Weather Icons */}
                {hourlyData.map((h, i) => {
                     const x = i * ITEM_WIDTH + (ITEM_WIDTH - 40) / 2;
                     const y = PADDING_TOP + TEMP_AREA_HEIGHT;
                     return (
                         <foreignObject key={`icon-${i}`} x={x} y={y} width="40" height="40">
                             {getWeatherIllustration(h.weather, "w-10 h-10")}
                         </foreignObject>
                     );
                })}

                {/* Temperature Line */}
                <path d={linePath} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

                {/* Temperature Points & Labels */}
                {hourlyData.map((h, i) => {
                    const x = i * ITEM_WIDTH + ITEM_WIDTH / 2;
                    const y = tempToY(h.temperature);
                    return (
                        <g key={`point-${i}`}>
                            <circle cx={x} cy={y} r="4" fill="#f97316" stroke="white" strokeWidth="2"/>
                            <text x={x} y={y - 10} textAnchor="middle" fontWeight="bold" fontSize="14" fill="#4b5563">
                                {Math.round(h.temperature)}°
                            </text>
                        </g>
                    );
                })}

                {/* Date & Time Labels at bottom */}
                {hourlyData.map((h, i) => {
                    const x = i * ITEM_WIDTH + ITEM_WIDTH / 2;
                    return (
                        <g key={`time-${i}`}>
                             <text x={x} y={CHART_HEIGHT - 25} textAnchor="middle" fontSize="12" fill="#4b5563">
                                {dates[i]}
                            </text>
                            <text x={x} y={CHART_HEIGHT - 8} textAnchor="middle" fontWeight="bold" fontSize="14" fill="#1f2937">
                                {h.time}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const WeatherPage: React.FC<PageProps> = ({ settings, onSettingsChange, handleApiCall, records }) => {
    const [weather, setWeather] = useState<WeatherInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchWeatherByName = async (name: string) => {
            if (!name) {
                setError("都道府県が設定されていません。設定ページで確認してください。");
                setIsLoading(false);
                return;
            }
            setIsLoading(true);
            setError(null);
            setWeather(null);
            try {
                const data = await handleApiCall(() => getWeatherInfo({ name }, settings.selectedModel));
                if (data) {
                    setWeather(data);
                } else {
                    setError(`「${name}」の天気情報の取得を中止しました。`);
                }
            } catch (e) {
                console.error(`Failed to fetch weather for ${name}`, e);
                setError(`「${name}」の天気情報の取得に失敗しました。`);
            } finally {
                setIsLoading(false);
            }
        };

        fetchWeatherByName(settings.weatherPrefecture);
    }, [settings.weatherPrefecture, settings.selectedModel, handleApiCall]);
    
    const getWbgtColor = (wbgt: number) => {
      if (wbgt >= 31) return { bg: 'bg-red-600', text: 'text-white', label: '危険' };
      if (wbgt >= 28) return { bg: 'bg-orange-500', text: 'text-white', label: '厳重警戒' };
      if (wbgt >= 25) return { bg: 'bg-yellow-400', text: 'text-gray-800', label: '警戒' };
      if (wbgt >= 21) return { bg: 'bg-green-500', text: 'text-white', label: '注意' };
      return { bg: 'bg-blue-500', text: 'text-white', label: 'ほぼ安全' };
    };
    
    const loadingMessage = `「${settings.weatherPrefecture}」の天気を読み込み中...`;

    return (
        <div className="p-4 space-y-4">
            {isLoading && <div className="text-center p-8">{loadingMessage}</div>}
            {error && <div className="text-center p-8 text-red-600">{error}</div>}

            {weather && (
              <div className="space-y-4 fade-in">
                <div className="bg-white p-4 rounded-xl shadow-md">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-lg font-bold text-gray-800">{weather.location}</p>
                            <p className="text-gray-600">{weather.current.weather}</p>
                        </div>
                        <AiModelSelector settings={settings} onSettingsChange={onSettingsChange}/>
                    </div>
                    <div className="flex items-center justify-center gap-4 my-4">
                        <div className="w-20 h-20">
                           {getWeatherIllustration(weather.current.weather, "w-full h-full")}
                        </div>
                        <div className="text-center">
                            <p className="text-6xl font-bold text-gray-800">{Math.round(weather.current.temperature)}°C</p>
                            <p className="text-gray-600">湿度: {weather.current.humidity}%</p>
                        </div>
                    </div>
                    
                    {weather.current.wbgt != null && (() => {
                        const wbgtStyle = getWbgtColor(weather.current.wbgt!);
                        return (
                            <div className={`${wbgtStyle.bg} ${wbgtStyle.text} p-3 rounded-lg text-center`}>
                                <p className="font-bold">暑さ指数 (WBGT): {weather.current.wbgt!.toFixed(1)}°C</p>
                                <p className="text-sm font-semibold">{wbgtStyle.label}</p>
                            </div>
                        );
                    })()}
                </div>

                <div className="bg-white p-4 rounded-xl shadow-md">
                    <h3 className="font-bold text-gray-800 mb-2">3時間ごとの予報</h3>
                    <WeatherChart hourlyData={weather.hourly} startDate={weather.weekly[0].date} />
                </div>

                <div className="bg-white p-4 rounded-xl shadow-md">
                    <h3 className="font-bold text-gray-800 mb-2">週間予報</h3>
                    <div className="space-y-1">
                        {weather.weekly.map((day, index) => (
                            <div key={index} className="grid grid-cols-4 items-center text-sm p-1 rounded-md hover:bg-gray-50 gap-2">
                                <p className="font-semibold">{`${day.date.substring(5).replace('-', '/')}(${day.day.charAt(0)})`}</p>
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7">{getWeatherIllustration(day.weather, "w-full h-full")}</div>
                                </div>
                                <p className="text-center text-gray-600">{day.weather}</p>
                                <p className="text-right">
                                    <span className="font-bold text-red-500">{Math.round(day.temp_max)}°</span> / <span className="text-blue-500">{Math.round(day.temp_min)}°</span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
              </div>
            )}
        </div>
    );
};

const PlantDiagnosisPage: React.FC<PageProps> = ({ settings, onSettingsChange, handleApiCall, records }) => {
  const [image, setImage] = useState<{ file: File, preview: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PlantDiagnosis | null>(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

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
      const diagnosis = await handleApiCall(() => diagnosePlantHealth(settings.selectedModel, imagePart));
      if (diagnosis) {
        setResult(diagnosis);
      }
    } catch (e) {
      console.error(e);
      alert("AI診断中にエラーが発生しました。");
    } finally {
      setIsLoading(false);
    }
  }, [image, settings.selectedModel, handleApiCall]);

  const handleSourceSelect = (source: 'camera' | 'gallery') => {
      if (source === 'camera') {
        cameraInputRef.current?.click();
      } else {
        galleryInputRef.current?.click();
      }
      setIsSourceModalOpen(false);
  };
  
  const DiagnosisCard: React.FC<{ title: string; children: React.ReactNode; icon: React.FC<{className?: string}> }> = ({ title, children, icon: Icon }) => (
      <div className="bg-white p-4 rounded-xl shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <Icon className="h-6 w-6 text-green-600" />
          <h3 className="text-lg font-bold text-green-800">{title}</h3>
        </div>
        <div className="space-y-2 text-sm text-gray-700 pl-9">{children}</div>
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
        <div className="bg-white p-4 rounded-xl shadow-md space-y-3">
          <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">AI作物診断</h3>
              <AiModelSelector settings={settings} onSettingsChange={onSettingsChange} disabled={isLoading}/>
          </div>
          
          <div 
            onClick={() => !image && setIsSourceModalOpen(true)}
            className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
          >
            {image ? (
              <img src={image.preview} alt="診断対象" className="h-full w-full object-contain rounded-lg p-1" />
            ) : (
               <div className="flex flex-col items-center justify-center text-center h-full">
                <div className="flex items-center gap-8">
                    <div className="flex flex-col items-center gap-2 text-gray-600 font-medium">
                        <CameraIcon className="h-10 w-10"/>
                        <span>カメラ</span>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-gray-600 font-medium">
                        <ImageIcon className="h-10 w-10"/>
                        <span>ギャラリー</span>
                    </div>
                </div>
                <span className="mt-4 text-sm text-gray-500">タップして写真を選択</span>
              </div>
            )}
          </div>

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
  onConfirmationRequest: (config: Omit<ConfirmationModalProps, 'isOpen' | 'onCancel'>) => void;
  records: CultivationRecord[];
}> = ({ settings, onSettingsChange, onLogout, onExport, onConfirmationRequest, records }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSyncing, setIsSyncing] = useState(false);
  const [googleUser, setGoogleUser] = useState<{name: string, email: string} | null>(null);

  useEffect(() => {
    const checkStatus = async () => {
      const { isSignedIn, user } = await GoogleDriveService.checkSignInStatus();
      if(isSignedIn && user) {
        setGoogleUser(user);
      }
    };
    checkStatus();
  }, []);
  
  const handleSettingsChange = (newSettings: Partial<AppSettings>) => {
    setLocalSettings(prev => ({ ...prev, ...newSettings }));
  };
  
  const handleGoogleSignIn = async () => {
    try {
      const user = await GoogleDriveService.signIn();
      setGoogleUser(user);
    } catch(e: any) {
      alert(`Googleサインインに失敗しました: ${e.message}`);
    }
  };

  const handleGoogleSignOut = async () => {
    await GoogleDriveService.signOut();
    setGoogleUser(null);
  };
  
  const handleSync = async (direction: 'upload' | 'download') => {
    if (localSettings.cloudProvider === 'icloud') {
      alert('iCloud同期は現在開発中です。');
      return;
    }
    
    if (!googleUser) {
      alert('Googleにサインインしてください。');
      return;
    }
    
    if (direction === 'upload') {
        onConfirmationRequest({
          title: "アップロードの確認",
          message: "現在の全てのローカルデータをGoogle Driveにアップロードします。Drive上の既存データは上書きされますが、よろしいですか？",
          confirmText: "はい、アップロードします",
          confirmColor: "bg-blue-600 hover:bg-blue-700",
          onConfirm: async () => {
            setIsSyncing(true);
            try {
              const dataToUpload = { settings: localSettings, records };
              await GoogleDriveService.uploadData(dataToUpload);
              handleSettingsChange({ lastSyncDate: new Date().toISOString() });
              alert('アップロードが完了しました。');
            } catch (e: any) {
              alert(`アップロードに失敗しました: ${e.message}`);
            } finally {
              setIsSyncing(false);
            }
          }
        });
    } else { // download
        onConfirmationRequest({
            title: "ダウンロードの確認",
            message: "Google Driveからデータをダウンロードします。現在の全てのローカルデータは上書きされますが、よろしいですか？",
            confirmText: "はい、ダウンロードします",
            onConfirm: async () => {
              setIsSyncing(true);
              try {
                const data = await GoogleDriveService.downloadData();
                if (data && typeof data === 'object' && 'settings' in data && 'records' in data) {
                  // A full app state reload is better here, but for now we update state.
                  // This is a bit of a hack. In a real app with Redux/Context, you'd dispatch an action.
                  alert('データの復元が完了しました。アプリをリロードしてください。');
                  localStorage.setItem('veggieLogRecords', JSON.stringify((data as any).records));
                  localStorage.setItem(SETTINGS_KEY, JSON.stringify((data as any).settings));
                  handleSettingsChange({ ...((data as any).settings), lastSyncDate: new Date().toISOString() });
                } else if (data === null) {
                  alert('Google Driveにバックアップファイルが見つかりませんでした。');
                } else {
                   alert('ダウンロードしたデータの形式が正しくありません。');
                }
              } catch (e: any) {
                alert(`ダウンロードに失敗しました: ${e.message}`);
              } finally {
                setIsSyncing(false);
              }
            },
        });
    }
  };
  
  useEffect(() => {
    // This effect syncs local state changes back up to the main App state.
    onSettingsChange(localSettings);
  }, [localSettings, onSettingsChange]);
  
  return (
    <div className="p-4 space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800">基本設定</h3>
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">チーム名</label>
            <input type="text" value={localSettings.teamName} onChange={e => handleSettingsChange({ teamName: e.target.value })} className="mt-1 w-full p-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">週の始まり</label>
            <select value={localSettings.startOfWeek} onChange={e => handleSettingsChange({ startOfWeek: e.target.value as any })} className="mt-1 w-full p-2 border border-gray-300 rounded-lg bg-white">
              <option value="sunday">日曜日</option>
              <option value="monday">月曜日</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">天気予報エリア</label>
            <select value={localSettings.weatherPrefecture} onChange={e => handleSettingsChange({ weatherPrefecture: e.target.value })} className="mt-1 w-full p-2 border border-gray-300 rounded-lg bg-white">
              {PREFECTURES.map(pref => <option key={pref} value={pref}>{pref}</option>)}
            </select>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800">AI機能設定</h3>
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="enable-ai" className="text-sm font-medium text-gray-700">AIアシスタント機能</label>
            <input type="checkbox" id="enable-ai" checked={localSettings.enableAiFeatures} onChange={e => handleSettingsChange({ enableAiFeatures: e.target.checked })} className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all checked:bg-green-600 checked:after:translate-x-full focus:ring-0" />
          </div>
          <div className={`space-y-4 ${!localSettings.enableAiFeatures && 'opacity-50'}`}>
             <div>
                <label className="block text-sm font-medium text-gray-700">使用するAIモデル</label>
                <select value={localSettings.selectedModel} onChange={e => handleSettingsChange({ selectedModel: e.target.value })} disabled={!localSettings.enableAiFeatures} className="mt-1 w-full p-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100">
                  {VALID_MODELS.map(model => <option key={model} value={model}>{model}</option>)}
                </select>
             </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800">表示設定</h3>
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <div className="flex items-center justify-between">
            <label htmlFor="enable-pumice-wash" className="text-sm font-medium text-gray-700">「パミス洗い」作業を表示</label>
            <input type="checkbox" id="enable-pumice-wash" checked={localSettings.enablePumiceWash} onChange={e => handleSettingsChange({ enablePumiceWash: e.target.checked })} className="h-6 w-11 rounded-full bg-gray-200 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-all checked:bg-green-600 checked:after:translate-x-full focus:ring-0" />
          </div>
        </div>
      </div>

       <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800">クラウド同期</h3>
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
           <div className="space-y-3">
              <p className="text-sm text-gray-600">記録データをクラウドにバックアップします。</p>
              <div>
                  <label className="block text-sm font-medium text-gray-700">同期モード</label>
                  <div className="mt-2 flex rounded-md shadow-sm">
                      <button
                          onClick={() => handleSettingsChange({ syncMode: 'manual' })}
                          className={`px-4 py-2 text-sm font-medium border rounded-l-md transition-colors w-1/2 ${localSettings.syncMode === 'manual' ? 'bg-green-600 text-white border-green-600 z-10' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                      >
                          手動
                      </button>
                      <button
                          onClick={() => handleSettingsChange({ syncMode: 'auto' })}
                          className={`-ml-px px-4 py-2 text-sm font-medium border rounded-r-md transition-colors w-1/2 ${localSettings.syncMode === 'auto' ? 'bg-green-600 text-white border-green-600 z-10' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                      >
                          自動
                      </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{localSettings.syncMode === 'auto' ? '記録の変更時に自動で同期します。（開発中）' : '手動でアップロード・ダウンロードを実行します。'}</p>
              </div>
              <div className="flex gap-4">
                  <button
                      onClick={() => handleSettingsChange({ cloudProvider: 'google', enableCloudSync: true })}
                      className={`flex-1 p-4 border-2 rounded-lg flex items-center gap-3 transition-all ${localSettings.cloudProvider === 'google' ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}
                  >
                      <GoogleDriveIcon className="h-8 w-8 text-[#0f9d58]" />
                      <div>
                          <p className="font-semibold text-gray-800 text-left">Google Drive</p>
                          <p className="text-xs text-gray-500 text-left">Googleアカウントで同期</p>
                      </div>
                  </button>
                  <button
                      onClick={() => handleSettingsChange({ cloudProvider: 'icloud', enableCloudSync: true })}
                      className={`flex-1 p-4 border-2 rounded-lg flex items-center gap-3 transition-all relative ${localSettings.cloudProvider === 'icloud' ? 'border-sky-500 bg-sky-50' : 'border-gray-300 bg-white hover:border-gray-400'}`}
                  >
                      <CloudIcon className="h-8 w-8 text-sky-500" />
                      <div>
                          <p className="font-semibold text-gray-800 text-left">iCloud</p>
                          <p className="text-xs text-gray-500 text-left">Apple IDで同期</p>
                      </div>
                      <span className="absolute top-1 right-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full">開発中</span>
                  </button>
              </div>
          </div>
          {localSettings.cloudProvider === 'google' && (
            <div className="border-t pt-4 mt-4 space-y-3">
                {googleUser ? (
                    <div className="flex items-center justify-between text-sm">
                        <div>
                            <p className="font-semibold">{googleUser.name}</p>
                            <p className="text-gray-500 text-xs">{googleUser.email}</p>
                        </div>
                        <button onClick={handleGoogleSignOut} className="bg-gray-200 text-gray-700 font-semibold py-1 px-3 rounded-md text-xs hover:bg-gray-300">サインアウト</button>
                    </div>
                ) : (
                    <button onClick={handleGoogleSignIn} className="w-full bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">Googleにサインイン</button>
                )}
                 {localSettings.lastSyncDate && <p className="text-xs text-gray-500 text-center">最終同期: {new Date(localSettings.lastSyncDate).toLocaleString()}</p>}
                <div className="flex gap-4">
                  <button onClick={() => handleSync('upload')} disabled={isSyncing || !googleUser} className="w-1/2 flex items-center justify-center gap-2 bg-blue-100 text-blue-800 font-semibold py-3 px-4 rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-wait">
                      <CloudUploadIcon className="h-5 w-5"/>
                      <span>アップロード</span>
                  </button>
                  <button onClick={() => handleSync('download')} disabled={isSyncing || !googleUser} className="w-1/2 flex items-center justify-center gap-2 bg-green-100 text-green-800 font-semibold py-3 px-4 rounded-lg hover:bg-green-200 disabled:opacity-50 disabled:cursor-wait">
                      <CloudDownloadIcon className="h-5 w-5"/>
                      <span>ダウンロード</span>
                  </button>
                </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800">ローカルデータ管理</h3>
        <div className="bg-white p-4 rounded-lg shadow space-y-4">
          <p className="text-sm text-gray-600">デバイスに保存されている栽培記録をCSVファイルとして書き出したり、読み込んだりします。</p>
          <div className="flex gap-4">
            <button onClick={onExport} className="flex-1 inline-flex items-center justify-center gap-2 bg-green-100 text-green-800 font-semibold py-3 px-4 rounded-lg hover:bg-green-200 transition-colors">
              <ExportIcon className="h-5 w-5"/>
              <span>エクスポート (CSV)</span>
            </button>
            <button disabled className="flex-1 inline-flex items-center justify-center gap-2 bg-gray-100 text-gray-500 font-semibold py-3 px-4 rounded-lg cursor-not-allowed">
              <FileImportIcon className="h-5 w-5"/>
              <span>インポート (CSV)</span>
            </button>
          </div>
        </div>
      </div>

       <div className="space-y-2">
          <div className="bg-white p-4 rounded-lg shadow space-y-4">
              <button onClick={onLogout} className="w-full bg-red-100 text-red-700 font-bold py-3 px-4 rounded-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2">
                  <LogoutIcon className="h-5 w-5"/>
                  <span>ログアウト</span>
              </button>
          </div>
       </div>

    </div>
  );
};

// #endregion

// #region --- Main App Component ---

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [page, setPage] = useState('DASHBOARD');
  const [pageParams, setPageParams] = useState<any>(null);
  const [records, setRecords] = useState<CultivationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [confirmationModal, setConfirmationModal] = useState<Omit<ConfirmationModalProps, 'isOpen' | 'onCancel'>>({ title: '', message: '', confirmText: '', onConfirm: () => {} });
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [apiError, setApiError] = useState<any>(null);
  const [isApiErrorModalOpen, setIsApiErrorModalOpen] = useState(false);
  const lastApiCallRef = useRef<(() => Promise<any>) | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalMode, setExportModalMode] = useState<'email' | 'download'>('download');
  const [isCameraOptionModalOpen, setIsCameraOptionModalOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<AppSettings>({
    teamName: 'ベジログチーム',
    startOfWeek: 'monday',
    enableAiFeatures: true,
    enableGoogleSearch: false,
    selectedModel: 'gemini-2.5-flash',
    enablePumiceWash: true,
    enableCloudSync: false,
    cloudProvider: 'google',
    syncMode: 'manual',
    weatherPrefecture: '愛知県',
  });

  const recordPageRef = useRef<RecordPageHandle>(null);
  const navigationTargetRef = useRef<{ page: string; params: any } | null>(null);
  
  // Load data from localStorage on initial mount
  useEffect(() => {
    try {
      const storedRecords = localStorage.getItem('veggieLogRecords');
      if (storedRecords) {
        setRecords(JSON.parse(storedRecords));
      }
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        setSettings(prev => ({ ...prev, ...JSON.parse(storedSettings) }));
      }
    } catch (error) {
      console.error("Failed to load data from localStorage", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem('veggieLogRecords', JSON.stringify(records));
      } catch (error) {
        console.error("Failed to save records to localStorage", error);
      }
    }
  }, [records, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error("Failed to save settings to localStorage", error);
      }
    }
  }, [settings, isLoading]);

  const handleApiCall = useCallback(async <T,>(apiCall: () => Promise<T>): Promise<T | undefined> => {
    lastApiCallRef.current = apiCall as () => Promise<any>;
    try {
      if (!settings.enableAiFeatures) {
        console.log("AI features disabled. API call skipped.");
        return undefined;
      }
      const result = await apiCall();
      return result;
    } catch (error: any) {
      console.error("API Error caught by handler:", error);
      if (error instanceof ApiRateLimitError) {
          alert(error.message); // Show quota message immediately
          return undefined; // Stop execution
      }
      setApiError(error);
      setIsApiErrorModalOpen(true);
      throw error; // Re-throw to be caught by specific callers if needed
    }
  }, [settings.enableAiFeatures]);


  const handleSaveRecord = (record: CultivationRecord) => {
    const index = records.findIndex(r => r.id === record.id);
    if (index > -1) {
      const newRecords = [...records];
      newRecords[index] = record;
      setRecords(newRecords);
    } else {
      setRecords([...records, record]);
    }
    setPage('DASHBOARD');
    setPageParams(null);
    setIsDirty(false);
  };
  
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);
  
  const handleNavigate = (newPage: string, params?: any) => {
    if (isDirty) {
      navigationTargetRef.current = { page: newPage, params };
      setShowSaveConfirm(true);
    } else {
      setPage(newPage);
      setPageParams(params);
      window.scrollTo(0, 0);
    }
  };

  const handleSaveConfirm = () => {
    if (recordPageRef.current) {
        const error = recordPageRef.current.validate();
        if (error) {
            alert(error); // Keep the modal open
            return;
        }
        recordPageRef.current.handleSubmit();
    }
    setShowSaveConfirm(false);
    if (navigationTargetRef.current) {
      setPage(navigationTargetRef.current.page);
      setPageParams(navigationTargetRef.current.params);
      window.scrollTo(0, 0);
      navigationTargetRef.current = null;
    }
  };

  const handleSaveDeny = () => {
    setShowSaveConfirm(false);
    setIsDirty(false);
    if (navigationTargetRef.current) {
      setPage(navigationTargetRef.current.page);
      setPageParams(navigationTargetRef.current.params);
      window.scrollTo(0, 0);
      navigationTargetRef.current = null;
    }
  };

  const handleConfirmationRequest = (config: Omit<ConfirmationModalProps, 'isOpen' | 'onCancel'>) => {
    setConfirmationModal(config);
    setIsConfirmationOpen(true);
  };
  
  const handleApiErrorRetry = async () => {
    setIsApiErrorModalOpen(false);
    if (lastApiCallRef.current) {
      try {
        await lastApiCallRef.current(); // The handler will re-throw on new failure
      } catch (e) {
        // Error is already handled by handleApiCall, which will re-open the modal
      }
    }
  };
  
  const handleApiErrorSwitch = () => {
    const newModel = settings.selectedModel.includes('gemini') ? 'gpt-4o' : 'gemini-2.5-flash';
    setSettings(s => ({ ...s, selectedModel: newModel }));
    // Wait for state to update, then retry
    setTimeout(handleApiErrorRetry, 100);
  };
  
  const handleApiErrorStop = () => {
    setIsApiErrorModalOpen(false);
    setSettings(s => ({ ...s, enableAiFeatures: false }));
    lastApiCallRef.current = null;
  };
  
  const handleEmailClick = () => {
    setExportModalMode('email');
    setIsExportModalOpen(true);
  };

  const handleExportRecords = (range: string, startDateStr?: string, endDateStr?: string) => {
      let filteredRecords = records;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      switch(range) {
          case 'today':
              filteredRecords = records.filter(r => r.date === toISODateString(today));
              break;
          case 'thisWeek': {
              const weekStart = new Date(today);
              const dayOfWeek = weekStart.getDay(); // 0 = Sunday
              const diff = weekStart.getDate() - dayOfWeek + (settings.startOfWeek === 'monday' ? (dayOfWeek === 0 ? -6 : 1) : 0);
              weekStart.setDate(diff);
              filteredRecords = records.filter(r => parseDateString(r.date) >= weekStart);
              break;
          }
          case 'thisMonth': {
              const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
              filteredRecords = records.filter(r => parseDateString(r.date) >= monthStart);
              break;
          }
          case 'lastMonth': {
              const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
              const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
              filteredRecords = records.filter(r => {
                  const d = parseDateString(r.date);
                  return d >= lastMonthStart && d <= lastMonthEnd;
              });
              break;
          }
          case 'custom': {
              if (startDateStr && endDateStr) {
                  const startDate = parseDateString(startDateStr);
                  const endDate = parseDateString(endDateStr);
                  endDate.setHours(23, 59, 59, 999);
                  filteredRecords = records.filter(r => {
                      const d = parseDateString(r.date);
                      return d >= startDate && d <= endDate;
                  });
              }
              break;
          }
          case 'all':
          default:
              filteredRecords = records;
              break;
      }
      
      if (filteredRecords.length === 0) {
        alert("選択された期間にエクスポート対象の記録がありません。");
        return;
      }

      const csvData = exportRecordsToCsv(filteredRecords);
      const blob = new Blob([`\uFEFF${csvData}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, '');
      link.setAttribute('download', `veggielog_${timestamp}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setIsExportModalOpen(false);

      if (exportModalMode === 'email') {
          setTimeout(() => {
              const subject = `【ベジログ】栽培記録のエクスポート (${new Date().toLocaleDateString()})`;
              const body = `チームの皆様\n\nベジログからの栽培記録を添付します。\nダウンロードしたCSVファイルをご確認ください。\n\n---\n${settings.teamName}\nベジログ・栽培記録アプリ`;
              window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
          }, 500);
      }
  };

  const handleOpenExportModal = () => {
    setExportModalMode('download');
    setIsExportModalOpen(true);
  };
  
  const handleLaneSelection = (lane: string) => {
    const latestRecordForLane = records
      .filter(r => r.cultivationLane === lane)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

    if (latestRecordForLane) {
      handleNavigate('EDIT_RECORD', { recordId: latestRecordForLane.id });
    } else {
      handleNavigate('NEW_RECORD', { lane });
    }
  };
  
  const handleTakePhoto = () => {
    cameraInputRef.current?.click();
    setIsCameraOptionModalOpen(false);
  };

  const handleAiDiagnose = () => {
    handleNavigate('PLANT_DIAGNOSIS');
    setIsCameraOptionModalOpen(false);
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    setPage('DASHBOARD');
  };

  const handleLogout = () => {
    handleConfirmationRequest({
      title: 'ログアウト',
      message: '本当にログアウトしますか？',
      confirmText: 'ログアウト',
      onConfirm: () => {
        setIsAuthenticated(false);
      }
    });
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderPage = () => {
    const commonProps = { setPage: handleNavigate, settings, onSettingsChange: setSettings, handleApiCall, records };
    const pageHeaderProps = { onMenuClick: () => setIsMenuOpen(true) };
    switch (page) {
      case 'DASHBOARD': return (
        <>
          <PageHeader title={settings.teamName} {...pageHeaderProps} />
          <Dashboard records={records} onLaneClick={handleLaneSelection} {...commonProps} />
        </>
      );
      case 'NEW_RECORD': return (
        <>
          <PageHeader title="新規記録" onBack={() => handleNavigate('DASHBOARD')} onMenuClick={() => setIsMenuOpen(true)} />
          <RecordPage
            ref={recordPageRef}
            onSaveRecord={handleSaveRecord}
            onBack={() => handleNavigate('DASHBOARD')}
            initialData={{ cultivationLane: pageParams?.lane }}
            onDirtyChange={handleDirtyChange}
            onConfirmationRequest={handleConfirmationRequest}
            {...commonProps}
          />
        </>
      );
       case 'EDIT_RECORD': return (
        <>
          <PageHeader title="記録の編集" onBack={() => handleNavigate('DASHBOARD')} onMenuClick={() => setIsMenuOpen(true)}/>
          <RecordPage
            ref={recordPageRef}
            onSaveRecord={handleSaveRecord}
            onBack={() => handleNavigate('DASHBOARD')}
            initialData={records.find(r => r.id === pageParams.recordId)}
            onDirtyChange={handleDirtyChange}
            onConfirmationRequest={handleConfirmationRequest}
            {...commonProps}
          />
        </>
      );
      case 'HISTORY': return (
        <>
          <PageHeader title="カレンダー" {...pageHeaderProps} />
          <CalendarHistoryPage records={records} startOfWeek={settings.startOfWeek} onRecordClick={(record) => handleNavigate('EDIT_RECORD', { recordId: record.id })} />
        </>
      );
      case 'TOOLS': return (
        <>
          <PageHeader title="ツール" {...pageHeaderProps} />
          <ToolsPage setPage={(p) => handleNavigate(p)} />
        </>
      );
      case 'CALCULATOR': return <><PageHeader title="液肥計算機" onBack={() => handleNavigate('TOOLS')} {...pageHeaderProps} /><CalculatorPage {...commonProps} /></>;
      case 'RECIPE_SEARCH': return <><PageHeader title="レシピ検索" onBack={() => handleNavigate('TOOLS')} {...pageHeaderProps} /><RecipeSearchPage {...commonProps} /></>;
      case 'VEGETABLE_SEARCH': return <><PageHeader title="野菜の育て方" onBack={() => handleNavigate('TOOLS')} {...pageHeaderProps} /><VegetableSearchPage {...commonProps} /></>;
      case 'PEST_SEARCH': return <><PageHeader title="病害虫・症状検索" onBack={() => handleNavigate('TOOLS')} {...pageHeaderProps} /><PestSearchPage {...commonProps} /></>;
      case 'TERM_SEARCH': return <><PageHeader title="園芸用語辞典" onBack={() => handleNavigate('TOOLS')} {...pageHeaderProps} /><TermSearchPage {...commonProps} /></>;
      case 'WEATHER': return <><PageHeader title="天気予報" onBack={() => handleNavigate('TOOLS')} {...pageHeaderProps} /><WeatherPage {...commonProps} /></>;
      case 'PLANT_DIAGNOSIS': return <><PageHeader title="AI作物診断" onBack={() => handleNavigate('TOOLS')} {...pageHeaderProps} /><PlantDiagnosisPage {...commonProps} /></>;
      case 'SETTINGS': return (
        <>
          <PageHeader title="設定" {...pageHeaderProps} />
          <SettingsPage 
            settings={settings} 
            onSettingsChange={setSettings} 
            onLogout={handleLogout} 
            onExport={handleOpenExportModal} 
            onConfirmationRequest={handleConfirmationRequest}
            records={records}
          />
        </>
      );
      default: return (
        <>
          <PageHeader title="ダッシュボード" {...pageHeaderProps} />
          <Dashboard records={records} onLaneClick={handleLaneSelection} {...commonProps} />
        </>
      );
    }
  };

  return (
    <div className="bg-lime-50 min-h-screen">
      <SaveConfirmationModal isOpen={showSaveConfirm} onConfirm={handleSaveConfirm} onDeny={handleSaveDeny} onClose={() => setShowSaveConfirm(false)} />
      <ConfirmationModal
        isOpen={isConfirmationOpen}
        {...confirmationModal}
        onCancel={() => setIsConfirmationOpen(false)}
      />
      <ApiErrorModal
        isOpen={isApiErrorModalOpen}
        error={apiError}
        currentModel={settings.selectedModel}
        onRetry={handleApiErrorRetry}
        onSwitchAi={handleApiErrorSwitch}
        onStopAi={handleApiErrorStop}
      />
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onExport={handleExportRecords}
        mode={exportModalMode}
      />
       <CameraOptionModal
        isOpen={isCameraOptionModalOpen}
        onClose={() => setIsCameraOptionModalOpen(false)}
        onTakePhoto={handleTakePhoto}
        onAiDiagnose={handleAiDiagnose}
      />
       <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
              const file = e.target.files[0];
              // This is a bit of a hack. Ideally, we'd pass this info to RecordPage.
              // For now, let's assume we are adding a photo to a new record.
              const newRecord = {
                  id: new Date().toISOString(),
                  date: toISODateString(new Date()),
                  cropName: '',
                  cultivationLane: CULTIVATION_LANES[0],
                  workTypes: [],
                  memo: 'AI診断からの写真',
                  photoBase64: '', // will be filled by reader
              };
              const reader = new FileReader();
              reader.onloadend = () => {
                  newRecord.photoBase64 = reader.result as string;
                  handleNavigate('NEW_RECORD', { initialData: newRecord });
              };
              reader.readAsDataURL(file);
          }
          e.target.value = ''; // Reset input
      }} className="hidden" />

      <HamburgerMenu
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        setPage={handleNavigate}
        activePage={page}
        onLogout={handleLogout}
      />
      
      <main className="pb-24">
        {renderPage()}
      </main>
      
      <footer className="fixed bottom-0 left-0 right-0 bg-[#fbf2e9] shadow-top z-20 flex justify-around items-center h-12">
        <button onClick={handleEmailClick} className="flex flex-col items-center justify-center text-stone-700 hover:text-amber-900 w-1/5 h-full"><PaperPlaneIcon className="h-6 w-6 mb-1"/> <span className="text-xs">メール</span></button>
        <button onClick={() => handleNavigate('HISTORY')} className="flex flex-col items-center justify-center text-stone-700 hover:text-amber-900 w-1/5 h-full"><CalendarIcon className="h-6 w-6 mb-1"/> <span className="text-xs">カレンダー</span></button>
        
        {/* Prominent Home Button */}
        <div className="w-1/5 h-full flex justify-center items-center">
          <button 
            onClick={() => handleNavigate('DASHBOARD')} 
            className="flex flex-col items-center justify-center text-green-800 font-bold bg-[#f2e6d9] hover:bg-[#e9d9c8] h-16 w-16 rounded-full transform -translate-y-4 shadow-lg border-4 border-lime-50 transition-all duration-200"
            aria-label="ホーム"
          >
            <HomeIcon className="h-7 w-7 mb-0.5"/> 
            <span className="text-xs leading-none">ホーム</span>
          </button>
        </div>

        <button onClick={() => handleNavigate('TOOLS')} className="flex flex-col items-center justify-center text-stone-700 hover:text-amber-900 w-1/5 h-full"><ToolsIcon className="h-6 w-6 mb-1"/> <span className="text-xs">ツール</span></button>
        <button onClick={() => setIsCameraOptionModalOpen(true)} className="flex flex-col items-center justify-center text-stone-700 hover:text-amber-900 w-1/5 h-full"><CameraIcon className="h-6 w-6 mb-1"/> <span className="text-xs">カメラ</span></button>
      </footer>
      
      {isDirty && (page === 'NEW_RECORD' || page === 'EDIT_RECORD') && <FloatingSaveButton onClick={() => recordPageRef.current?.handleSubmit()} />}
    </div>
  );
};

export default App;
// #endregion