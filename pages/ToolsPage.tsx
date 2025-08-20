import React from 'react';
import {
  ObservationIcon, CalculatorIcon, VegetableSearchIcon, PestSearchIcon,
  DictionaryIcon, WeatherIcon, RecipeIcon
} from '../components/Icons';

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

export default ToolsPage;
