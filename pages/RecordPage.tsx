import React, { useState, useEffect, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { CultivationRecord, WorkType, ObservationStatus, PackageInfo, CropStage, FertilizerDetail, AppSettings, ApiCallHandler } from '../types';
import { extractTextFromImage, analyzeSeedPackage, searchCommonPestsForCrop } from '../services/geminiService';
import {
  WORK_TYPE_DETAILS, CROP_STAGE_DETAILS, OBSERVATION_STATUS_DETAILS, FERTILIZERS, CULTIVATION_LANES
} from '../lib/constants';
import { toISODateString, parseDateString, resizeImage, fileToGenerativePart } from '../lib/utils';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import {
  CloseIcon, MicrophoneIcon, CameraIcon, ImageIcon, RefreshIcon, TrashIcon
} from '../components/Icons';
import { CalendarModal, ImageSourceModal } from '../components/modals';
import { ConfirmationModalProps } from '../components/modals';

export type RecordPageHandle = {
  getRecordData: () => CultivationRecord;
  validate: () => string;
  handleSubmit: () => void;
};

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
        e.returnValue = '';
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

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      try {
        const resized = await resizeImage(event.target.files[0], 2_000_000);
        setPhoto(resized);
      } catch (error) {
        console.error("Photo resize failed", error);
        alert("写真の処理に失敗しました。");
      }
    }
  };
  
  const handleSeedPhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      try {
        const result = await resizeImage(file, 2_000_000);
        if (side === 'front') {
          setSeedPackageFront(result);
        } else {
          setSeedPackageBack(result);
          setPackageInfo(null);
          setPestInfo(null);
          stopAnalysisRef.current = false;
        }
      } catch (error) {
        console.error("Seed photo resize failed", error);
        alert("写真の処理に失敗しました。");
      }
    }
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
    
    const todayString = toISODateString(new Date());

    const proceedWithSave = () => {
        onSaveRecord(getRecordData());
    };

    if (recordDate !== todayString) {
        onConfirmationRequest({
            title: '日付の確認',
            message: '過去の作業の修正ですか？',
            confirmText: 'はい、修正する',
            onConfirm: proceedWithSave,
        });
    } else {
        proceedWithSave();
    }
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

export default RecordPage;