
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { CultivationRecord, AppSettings } from '../types';
import { searchRecipes, generateRecipeImage, identifyVegetableFromImage } from '../services/geminiService';
import { useVoiceRecognition } from '../hooks/useVoiceRecognition';
import { fileToGenerativePart } from '../lib/utils';
import { FormattedContent } from '../components/common/FormattedContent';
import { ImageSourceModal } from '../components/modals';
import { CameraIcon, MicrophoneIcon, CloseIcon, ExternalLinkIcon } from '../components/Icons';
import { ApiCallHandler } from '../types';

type PageProps = {
  handleApiCall: ApiCallHandler;
  records: CultivationRecord[];
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  pageParams: any;
};

const RecipeSearchPage: React.FC<PageProps> = ({ handleApiCall, records }) => {
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
      setQuery('');
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

export default RecipeSearchPage;
