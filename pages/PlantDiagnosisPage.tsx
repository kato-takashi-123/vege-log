import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PlantDiagnosis, AppSettings, CultivationRecord } from '../types';
import { diagnosePlantHealth } from '../services/geminiService';
import { fileToGenerativePart } from '../lib/utils';
import { FormattedContent } from '../components/common/FormattedContent';
import { CameraIcon, ImageIcon, ObservationIcon, LeafIcon, PestControlIcon, FertilizingIcon, WateringIcon, WeatherIcon, VegetableSearchIcon, CopyIcon, CheckIcon } from '../components/Icons';
import { ApiCallHandler } from '../types';

type PageProps = {
  handleApiCall: ApiCallHandler;
  pageParams?: any;
  setPage: (page: string, params?: any) => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  records: CultivationRecord[];
};

const PlantDiagnosisPage: React.FC<PageProps> = ({ handleApiCall, pageParams, setPage }) => {
  const [image, setImage] = useState<{ file: File, preview: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PlantDiagnosis | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  const shouldAutoDiagnose = useRef(false);

  useEffect(() => {
    if (pageParams?.preselectedImage) {
      setImage(pageParams.preselectedImage);
      shouldAutoDiagnose.current = true;
    }
  }, [pageParams?.preselectedImage]);

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

  useEffect(() => {
    if (image && shouldAutoDiagnose.current) {
      handleDiagnose();
      shouldAutoDiagnose.current = false; // Reset the flag to prevent re-runs
    }
  }, [image, handleDiagnose]);

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage({ file, preview: URL.createObjectURL(file) });
      setResult(null);
      shouldAutoDiagnose.current = true;
    }
    if (e.target) e.target.value = '';
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage({ file, preview: URL.createObjectURL(file) });
      setResult(null);
    }
    if (e.target) e.target.value = '';
  };

  const handleCopy = () => {
    if (!result) return;
    
    const textToCopy = `診断対象の作物: ${result.plantName}\n\n`
      + `総合評価: ${result.overallHealth}\n\n`
      + `病害虫の診断\n状況: ${result.pestAndDisease.details}\n対策: ${result.pestAndDisease.countermeasures}\n\n`
      + `液肥のアドバイス\n${result.fertilizer.recommendation}\n\n`
      + `水やりのアドバイス\n状況: ${result.watering.status}\nアドバイス: ${result.watering.recommendation}\n\n`
      + `環境のアドバイス\n${result.environment.recommendation}`;
      
    navigator.clipboard.writeText(textToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

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
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleCameraCapture} className="hidden" />
      <input type="file" accept="image/*" ref={galleryInputRef} onChange={handleGallerySelect} className="hidden" />
      
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
          <div className="space-y-4 fade-in relative">
             <button onClick={handleCopy} className="absolute top-0 right-0 z-10 p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="結果をコピー">
                {isCopied ? <CheckIcon className="h-5 w-5 text-green-600" /> : <CopyIcon className="h-5 w-5 text-gray-600 dark:text-gray-300" />}
            </button>
            <DiagnosisCard title="診断対象の作物" icon={VegetableSearchIcon}>
              <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{result.plantName}</p>
            </DiagnosisCard>
            
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

export default PlantDiagnosisPage;