import {
  WateringIcon, FertilizingIcon, PestControlIcon, RootTreatmentIcon, DiggingUpIcon, FaucetIcon,
  SeedingIcon, SeedlingCareIcon, GerminationIcon, TrueLeavesIcon, PlantingIcon, PinchingIcon,
  PollinationIcon, HarvestingIcon
} from '../components/Icons';
import { WorkType, CropStage, ObservationStatus } from '../types';

export const WORK_TYPE_DETAILS = {
  [WorkType.Watering]: { label: '水やり', Icon: WateringIcon, color: 'bg-cyan-500' },
  [WorkType.Fertilizing]: { label: '液肥', Icon: FertilizingIcon, color: 'bg-blue-500' },
  [WorkType.PestControl]: { label: '病害虫対策', Icon: PestControlIcon, color: 'bg-red-500' },
  [WorkType.RootTreatment]: { label: '根処理', Icon: RootTreatmentIcon, color: 'bg-yellow-600' },
  [WorkType.DiggingUp]: { label: '掘り返し', Icon: DiggingUpIcon, color: 'bg-stone-500' },
  [WorkType.PumiceWash]: { label: 'パミス洗い', Icon: FaucetIcon, color: 'bg-sky-500' },
};

export const CROP_STAGE_DETAILS = {
  [CropStage.Seeding]: { label: '播種', Icon: SeedingIcon, color: 'bg-yellow-500' },
  [CropStage.SeedlingCare]: { label: '育苗', Icon: SeedlingCareIcon, color: 'bg-lime-500' },
  [CropStage.Germination]: { label: '発芽', Icon: GerminationIcon, color: 'bg-green-300' },
  [CropStage.TrueLeaves]: { label: '本葉', Icon: TrueLeavesIcon, color: 'bg-green-400' },
  [CropStage.Planting]: { label: '定植', Icon: PlantingIcon, color: 'bg-green-500' },
  [CropStage.Pinching]: { label: '摘心', Icon: PinchingIcon, color: 'bg-teal-500' },
  [CropStage.Pollination]: { label: '受粉', Icon: PollinationIcon, color: 'bg-pink-400' },
  [CropStage.Harvesting]: { label: '収穫', Icon: HarvestingIcon, color: 'bg-orange-500' },
};

export const OBSERVATION_STATUS_DETAILS = {
  [ObservationStatus.Normal]: { label: '正常' },
  [ObservationStatus.Anomaly]: { label: '低成長' },
  [ObservationStatus.Pest]: { label: '病害虫' },
  [ObservationStatus.Deformation]: { label: '変色・変形' },
};

export const FERTILIZERS = {
  'M-Plus-1': { name: 'エムプラス1号', component: '窒素、リン酸、カリウム', usage: '成長促進、栄養補給' },
  'M-Plus-2': { name: 'エムプラス2号', component: 'カルシウム、微量要素', usage: '品質向上、病害耐性強化' },
};

export const CULTIVATION_LANES = [
  '①-1', '①-2', '②-1', '②-2', '③-1', '③-2',
  '④-1', '④-2', '⑤-1', '⑤-2', '⑥-1', '⑥-2'
];

export const PASTEL_COLORS = [
  'bg-red-200', 'bg-pink-200', 'bg-orange-200', 'bg-yellow-200', 'bg-lime-200',
  'bg-green-200', 'bg-teal-200', 'bg-cyan-200', 'bg-sky-200', 'bg-blue-200',
  'bg-indigo-200', 'bg-purple-200'
];

export const PET_BOTTLE_CAP_ML = 5;

export const SETTINGS_KEY = 'veggieLogSettings';
export const DB_NAME = 'VeggiLogDB';
export const DB_VERSION = 2;
export const RECORDS_OBJECT_STORE_NAME = 'cultivationRecords';
