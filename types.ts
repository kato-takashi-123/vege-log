

export interface PackageInfo {
  productName?: string;
  family?: string;
  features?: string;
  seedlingPeriod?: string;
  plantingPeriod?: string;
  harvestTime?: string;
  daysToGermination?: string;
  germinationTemp?: string;
  growingTemp?: string;
}

// UPDATED: 作業の種類
export enum WorkType {
  Watering = 'WATERING',       // 水やり
  Fertilizing = 'FERTILIZING',   // 液肥（追肥）
  PestControl = 'PEST_CONTROL',   // 病害虫対策
  RootTreatment = 'ROOT_TREATMENT', // 根処理
  DiggingUp = 'DIGGING_UP',       // 掘り返し
  PumiceWash = 'PUMICE_WASH',     // パミス洗い
}

// NEW: 作物の状況
export enum CropStage {
  Seeding = 'SEEDING',           // 播種
  SeedlingCare = 'SEEDLING_CARE', // 育苗
  Germination = 'GERMINATION',       // 発芽
  TrueLeaves = 'TRUE_LEAVES',       // 本葉
  Planting = 'PLANTING',           // 定植
  Pinching = 'PINCHING',           // 摘心
  Pollination = 'POLLINATION',       // 受粉
  Harvesting = 'HARVESTING',         // 収穫
}

export enum ObservationStatus {
  Normal = 'NORMAL',
  Anomaly = 'ANOMALY',
  Pest = 'PEST',
  Deformation = 'DEFORMATION'
}

// RENAMED: Details for fertilizing work type
export interface FertilizerDetail {
  fertilizerType: 'M-Plus-1' | 'M-Plus-2';
  dilution: number;
}

export interface CultivationRecord {
  id: string;
  cropName: string;
  cultivationLane: string;
  workTypes: WorkType[];
  cropStages?: CropStage[];
  observationStatus?: ObservationStatus[];
  pestDetails?: string[];
  date: string;
  quantity?: number;
  quantityUnit?: 'items' | 'grams';
  memo: string;
  photoBase64: string;
  seedPackagePhotoFront?: string;
  seedPackagePhotoBack?: string;
  aiPackageAnalysis?: PackageInfo;
  aiPestInfo?: string[];
  fertilizingDetails?: FertilizerDetail[];
}

export interface WeatherInfo {
  location: string;
  current: {
    weather: string;
    temperature: number;
    humidity: number;
    wbgt?: number;
  };
  hourly: {
    time: string;
    date: string;
    temperature: number;
    precipitation: number;
    weather: string;
    humidity: number;
  }[];
  weekly: {
    date: string;
    day: string;
    temp_max: number;
    temp_min: number;
    weather: string;
    pop: number;
  }[];
}

export interface PestInfo {
  pestName: string;
  imageQueries: string[];
  summary: {
    characteristics: string;
    causes: string;
    countermeasures: string;
  };
  details: {
    characteristics: string;
    causes: string;
    countermeasures: string;
  };
  groundingChunks?: any[];
}

export interface VegetableInfo {
  vegetableName: string;
  cultivationCalendar: {
    seeding: string;
    planting: string;
    harvest: string;
  };
  fertilizationPlan: {
    baseFertilizer: string;
    topDressing: string;
  };
  cultivationTips: string[];
  pestControl: string[];
  groundingChunks?: any[];
}

export interface PlantDiagnosis {
  plantName: string;
  overallHealth: string;
  pestAndDisease: {
    isDetected: boolean;
    details: string;
    countermeasures: string;
  };
  fertilizer: {
    recommendation: string;
  };
  watering: {
    status: 'Adequate' | 'Overwatered' | 'Underwatered' | '適切' | '過剰' | '不足';
    recommendation: string;
  };
  environment: {
    recommendation: string;
  };
}

export type AppSettings = {
  teamName: string;
  startOfWeek: 'sunday' | 'monday';
  enableAiFeatures: boolean;
  enablePumiceWash: boolean;
  weatherLocation: string;
  darkModeContrast: 'normal' | 'high';
  openWeatherApiKey?: string;
};

export type ApiCallHandler = <T>(apiCall: () => Promise<T>) => Promise<T | undefined>;
