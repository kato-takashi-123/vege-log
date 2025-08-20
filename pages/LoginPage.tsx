import React from 'react';
import { VegetableBasketIcon } from '../components/Icons';

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

export default LoginPage;
