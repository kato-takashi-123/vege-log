

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
  SeedlingStart = 'SEEDLING_START', // 育苗開始
  Germination = 'GERMINATION',       // 発芽
  TrueLeaves = 'TRUE_LEAVES',       // 本葉が出る
  Planting = 'PLANTING',           // 定植開始
  Pollination = 'POLLINATION',       // 受粉
  Harvesting = 'HARVESTING',         // 収穫
}

export enum ObservationStatus {
  Normal = 'NORMAL',
  Anomaly = 'ANOMALY',
  Pest = 'PEST',
  Deformation = 'DEFORMATION'
}

export interface CultivationRecord {
  id: string;
  cropName: string;
  cultivationArea: string;
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
}

export interface WeatherInfo {
  location: string;
  current: {
    weather: string;
    temperature: number;
    humidity: number;
    wbgt: number;
  };
  hourly: {
    time: string;
    temperature: number;
    weather: string;
  }[];
  weekly: {
    day: string;
    temp_max: number;
    temp_min: number;
    weather: string;
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