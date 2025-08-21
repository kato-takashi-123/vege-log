

import { GoogleGenAI, Type, GenerateContentResponse, GenerateImagesResponse } from "@google/genai";
import { WeatherInfo, PestInfo, VegetableInfo, PlantDiagnosis, AppSettings } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini features will not work.");
}

export class ApiRateLimitError extends Error {
  constructor(message: string, public originalError: any) {
    super(message);
    this.name = 'ApiRateLimitError';
  }
}

// --- Retry Helper ---
const withRetry = async <T>(apiCall: () => Promise<T>, options: { retries?: number; delay?: number } = {}): Promise<T> => {
  const { retries = 3, delay = 2000 } = options;
  let lastError: any;

  for (let i = 0; i < retries; i++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;

      const isRateLimitError = (e: any): boolean => {
        const status = e?.error?.code || e?.status;
        const statusText = e?.error?.status || '';
        return status === 429 || statusText === 'RESOURCE_EXHAUSTED';
      };

      if (isRateLimitError(error)) {
        // For rate limit errors, fail immediately so the UI can handle it.
        throw new ApiRateLimitError("APIクォータの上限に達しました。プランと請求の詳細を確認してください。", error);
      }
      
      const isRetryableServerError = (e: any): boolean => {
        const status = e?.error?.code || e?.status;
        // Only retry on 5xx server errors which are often transient.
        return status >= 500 && status < 600;
      };

      if (isRetryableServerError(error) && i < retries - 1) {
        // Use exponential backoff for retries
        const backoffDelay = delay * Math.pow(2, i) + Math.random() * 1000;
        console.warn(`API call failed with a server error (attempt ${i + 1}/${retries}). Retrying in ${Math.round(backoffDelay / 1000)}s...`);
        await new Promise(res => setTimeout(res, backoffDelay));
      } else {
        // For non-retryable errors (like 400s) or if all retries are exhausted, throw the error.
        throw error;
      }
    }
  }
  // This line should be unreachable if the loop completes, but as a fallback:
  throw lastError;
};


// --- Common Interface ---
export interface AiSearchResult {
  text: string;
  groundingChunks?: any[];
}

// --- Gemini Provider ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "NO_KEY" });

// #region --- Public Service Functions ---

export const getDailyQuote = async (theme: string, forceRefresh = false): Promise<string> => {
  const cacheKey = 'dailyQuoteCache';
  const todayDate = new Date();
  const today = todayDate.toISOString().split('T')[0];
  const effectiveTheme = theme.trim() || '今日は何の日？';

  if (!forceRefresh) {
    try {
      const cachedData = localStorage.getItem(cacheKey);
      if (cachedData) {
        const cache = JSON.parse(cachedData);
        if (cache[effectiveTheme] && cache[effectiveTheme].date === today && cache[effectiveTheme].quote) {
          return cache[effectiveTheme].quote;
        }
      }
    } catch (error) {
      console.error("Failed to read daily quote from cache", error);
      localStorage.removeItem(cacheKey);
    }
  }

  let prompt: string;
  if (effectiveTheme === '今日は何の日？') {
    const month = todayDate.getMonth() + 1;
    const day = todayDate.getDate();
    prompt = `今日は${month}月${day}日です。この日にまつわる面白い記念日や、過去の出来事に関する簡潔な一言知識を、事実や史実に基づいて教えてください。`;
  } else {
    prompt = `「${effectiveTheme}」というテーマについて調べ、面白くて簡潔な一言知識を教えてください。`;
  }

  const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction: "あなたは知識豊富なアシスタントです。与えられたテーマについて、簡潔で興味深い事実を一つだけ、最大でも50文字程度で回答してください。事実に基づいた正確な情報を提供してください。",
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 0 }
    }
  }));
  const newQuote = response.text.trim().split('\n')[0];
  const finalQuote = (newQuote && newQuote.length > 5) ? newQuote : "新しい一日、新しい発見。最高の野菜を育てましょう！";
  
  try {
    const cachedData = localStorage.getItem(cacheKey);
    const cache = cachedData ? JSON.parse(cachedData) : {};
    cache[effectiveTheme] = { quote: finalQuote, date: today };
    localStorage.setItem(cacheKey, JSON.stringify(cache));
  } catch (error) {
    console.error("Failed to write daily quote to cache", error);
  }

  return finalQuote;
};

export const getVegetableInfo = async (query: string): Promise<VegetableInfo> => {
  if (!query.trim()) throw new Error("野菜の名前を入力してください。");

  const schema = {
    type: Type.OBJECT,
    properties: {
        vegetableName: { type: Type.STRING, description: '野菜の正式名称。' },
        cultivationCalendar: {
            type: Type.OBJECT,
            description: '栽培ごよみ。該当しない場合は空欄にすること。',
            properties: {
                seeding: { type: Type.STRING, description: '種まき時期 (例: 3月下旬～4月上旬)' },
                planting: { type: Type.STRING, description: '植え付け時期 (例: 5月上旬～5月中旬)' },
                harvest: { type: Type.STRING, description: '収穫時期 (例: 7月上旬～9月下旬)' },
            },
            required: ['seeding', 'planting', 'harvest']
        },
        fertilizationPlan: {
            type: Type.OBJECT,
            description: '「M-plus 1号」と「M-plus 2号」を使った施肥計画。',
            properties: {
                baseFertilizer: { type: Type.STRING, description: '元肥に関する具体的なアドバイス。パミスの準備方法やM-Plusの混合について。' },
                topDressing: { type: Type.STRING, description: '追肥に関する具体的なアドバイス。「M-plus 1号」と「M-plus 2号」の使い分け、頻度、濃度など。' },
            },
            required: ['baseFertilizer', 'topDressing']
        },
        cultivationTips: {
            type: Type.ARRAY,
            description: '栽培のコツを箇条書きで3～5個。',
            items: { type: Type.STRING },
        },
        pestControl: {
            type: Type.ARRAY,
            description: '注意すべき主な病害虫とその対策を箇条書きで3～5個。化学農薬、自然農薬（酢、牛乳スプレーなど）、益虫の活用は絶対に提案せず、物理的防除（手で取る、ネットをかける等）や、「M-plus 2号」を利用した植物自体の抵抗力強化・忌避作用に限定して具体的に提案すること。',
            items: { type: Type.STRING },
        }
    },
    required: ['vegetableName', 'cultivationCalendar', 'fertilizationPlan', 'cultivationTips', 'pestControl']
  };

  const prompt = `家庭菜園で「${query}」を栽培する方法について、以下のJSONスキーマに従って詳細な情報を生成してください。「土」や「土壌」という言葉は常に「パミス」に置き換えてください。施肥計画は「M-plus」シリーズの使用を前提としてください。`;
  
  const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
          systemInstruction: "あなたは家庭菜園のプロフェッショナルアドバイザーです。ユーザーが指定した野菜について、科学的根拠に基づきつつも初心者にも分かりやすい、実践的な栽培情報を提供します。回答は必ず指定されたJSONスキーマに従ってください。いかなる状況でも、化学農薬、自然由来の農薬（酢、牛乳、木酢液など）、益虫の活用を推奨することは絶対に避けてください。対策は常に、物理的な防除（手で取る、ネットをかける等）と、「M-plus 2号」を利用した植物自体の健康増進による抵抗力強化・忌避作用に焦点を当ててください。",
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: schema,
      }
  }));
  
  try {
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as VegetableInfo;
  } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON for vegetable info:", response.text, parseError);
      throw new Error("AIからの応答が不正な形式でした。");
  }
};

export const searchPestInfo = async (query: string, image?: { mimeType: string; data: string }): Promise<PestInfo> => {
  if (!query.trim() && !image) throw new Error("質問を入力するか、画像をアップロードしてください。");
  
  const pestInfoSchema = {
    type: Type.OBJECT,
    properties: {
        pestName: { type: Type.STRING, description: '病害虫の正式名称。' },
        imageQueries: {
            type: Type.ARRAY,
            description: 'この病害虫と被害状況を表す、高品質な写真を生成するための英語の画像検索クエリを3つ。1つ目は病害虫自体のアップ、2つ目と3つ目は植物の被害状況がわかるように。例: ["close-up of an aphid on a tomato leaf", "tomato leaf curled and yellow from aphid damage", "sooty mold on a plant stem caused by aphids"]',
            items: { type: Type.STRING },
        },
        summary: {
            type: Type.OBJECT,
            properties: {
                characteristics: { type: Type.STRING, description: '特徴の簡潔な要約（100字以内）。' },
                causes: { type: Type.STRING, description: '発生原因の簡潔な要約（100字以内）。' },
                countermeasures: { type: Type.STRING, description: '対処法の簡潔な要約（100字以内）。物理的防除と、「M-plus 2号」の利用に言及すること。' },
            },
            required: ['characteristics', 'causes', 'countermeasures']
        },
        details: {
            type: Type.OBJECT,
            properties: {
                characteristics: { type: Type.STRING, description: '特徴の詳細な説明。' },
                causes: { type: Type.STRING, description: '発生原因の詳細な説明。' },
                countermeasures: { type: Type.STRING, description: '物理的対策や「M-plus 2号」の利用を中心とした、化学農薬・自然農薬・益虫の活用を一切含まない詳細な対処法。' },
            },
            required: ['characteristics', 'causes', 'countermeasures']
        }
    },
    required: ['pestName', 'imageQueries', 'summary', 'details']
  };

  const parts: any[] = [];
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
  const baseQuery = image ? `この画像と、補足情報「${query || "なし"}」に基づいて、` : `「${query}」という症状について、`;
  const fullPrompt = `${baseQuery}この病害虫または病気の情報を、指定されたJSONスキーマに従って構造化してください。`;
  parts.push({ text: fullPrompt });

  const config: any = {
      systemInstruction: "あなたは植物のお医者さんです。あなたの役割は、化学農薬、自然農薬（木酢液、唐辛子スプレーなど）、益虫の活用を一切提案せず、持続可能な解決策を提供することです。アドバイスは、①物理的な対策（手で取る、虫除けネットなど）と、②「M-plus 2号」のような液肥を活用して植物の健康を促進し、病害虫への抵抗力を高める・忌避作用を利用する方法、の2点に常に限定してください。回答は必ず指定されたJSONスキーマに従ってください。常に「土」や「土壌」という言葉の代わりに「パミス」という言葉を使用してください。",
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: pestInfoSchema,
  };
  
  const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts }, config }));
  
  try {
      const jsonText = response.text.trim();
      const parsed = JSON.parse(jsonText);
      parsed.groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      return parsed as PestInfo;
  } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON for pest info:", response.text, parseError);
      throw new Error("AIからの応答が不正な形式でした。");
  }
};

export const diagnosePlantHealth = async (image: { mimeType: string; data: string }): Promise<PlantDiagnosis> => {
  const schema = {
    type: Type.OBJECT,
    properties: {
        plantName: { type: Type.STRING, description: '画像に写っている植物の一般的な名称（例：ミニトマト）。' },
        overallHealth: { type: Type.STRING, description: '植物の全体的な健康状態を「健康的」「注意が必要」「病気の可能性」のいずれかで評価してください。' },
        pestAndDisease: {
            type: Type.OBJECT,
            properties: {
                isDetected: { type: Type.BOOLEAN, description: '病害虫が検出されたかどうか。' },
                details: { type: Type.STRING, description: '検出された病害虫や病気の兆候に関する詳細な説明。見つからなければ「特に問題は見られません。」と記述。' },
                countermeasures: { type: Type.STRING, description: '農薬を一切使わない、物理的防除や「M-plus 2号」の活用を中心とした具体的な対策方法。' },
            },
            required: ['isDetected', 'details', 'countermeasures']
        },
        fertilizer: {
            type: Type.OBJECT,
            properties: {
                recommendation: { type: Type.STRING, description: '「M-plus 1号」と「M-plus 2号」の濃度や頻度に関する具体的な調整アドバイス。' },
            },
            required: ['recommendation']
        },
        watering: {
            type: Type.OBJECT,
            properties: {
                status: { type: Type.STRING, enum: ['適切', '過剰', '不足'], description: '潅水（水やり）の状態を「適切」「過剰」「不足」のいずれかで評価。' },
                recommendation: { type: Type.STRING, description: '潅水の過不足に関する具体的なアドバイス。' },
            },
            required: ['status', 'recommendation']
        },
        environment: {
            type: Type.OBJECT,
            properties: {
                recommendation: { type: Type.STRING, description: '日照障害の可能性や、それに対する寒冷紗の活用など、環境に関する具体的なアドバイス。' },
            },
            required: ['recommendation']
        }
    },
    required: ['plantName', 'overallHealth', 'pestAndDisease', 'fertilizer', 'watering', 'environment']
  };

  const prompt = "この野菜の画像から、健康状態を診断してください。以下のJSONスキーマに従って、農薬を使わない持続可能な方法でのアドバイスを生成してください。";
  const parts = [
      { inlineData: { mimeType: image.mimeType, data: image.data } },
      { text: prompt }
  ];

  const config = {
      systemInstruction: "あなたは経験豊富な植物病理学者であり、家庭菜園のアドバイザーです。提供された画像から植物の状態を詳細に分析し、ユーザーが直面している問題を特定します。あなたのアドバイスは常に科学的根拠に基づき、初心者にも理解しやすい言葉で説明されます。特に重要なのは、化学農薬や自然農薬（木酢液など）を一切推奨せず、物理的防除（手で取り除く、ネットをかける等）や、植物の自己免疫力を高めるための液肥（例：「M-plus」シリーズ）の適切な使用、栽培環境の改善（日当たり、風通し、水やり）といった、総合的病害虫管理（IPM）の考え方に基づいた持続可能な解決策を提案することです。回答は必ず指定されたJSONスキーマに従ってください。",
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: schema,
  };

  const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: { parts }, config }));
  
  try {
      const jsonText = response.text.trim();
      return JSON.parse(jsonText) as PlantDiagnosis;
  } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON for plant diagnosis:", response.text, parseError);
      throw new Error("AIからの応答が不正な形式でした。");
  }
};

export const generateRecipeImage = async (prompt: string): Promise<string> => {
  if (!prompt) return "https://via.placeholder.com/320x180.png?text=No+Prompt";

  const response = await withRetry<GenerateImagesResponse>(() => ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `a high quality, delicious looking, commercial food photography of ${prompt}`,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '16:9',
      },
  }));
  
  const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (base64ImageBytes) {
    return `data:image/jpeg;base64,${base64ImageBytes}`;
  }
  
  console.error('Image generation failed: no image bytes returned.');
  return "https://via.placeholder.com/320x180.png?text=Generation+Failed";
};

export const identifyVegetableFromImage = async (image: { mimeType: string; data: string }): Promise<string> => {
  const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        { text: "この画像に写っている主要な野菜の名前を一つだけ、簡潔に答えてください。野菜以外のものが写っている場合は、「野菜が見つかりません」とだけ答えてください。" },
        { inlineData: { mimeType: image.mimeType, data: image.data } }
      ]
    },
    config: {
      temperature: 0.1,
    }
  }));
  const vegetableName = response.text.trim();
  if (vegetableName.includes("野菜が見つかりません")) {
    return "";
  }
  return vegetableName;
};

export const searchRecipes = async (vegetableName: string): Promise<AiSearchResult> => {
    if (!vegetableName.trim()) return { text: "" };
    
    const schema = {
      type: Type.OBJECT,
      properties: {
          recipes: {
              type: Type.ARRAY,
              description: 'A list of 5 recipe suggestions.',
              items: {
                  type: Type.OBJECT,
                  properties: {
                      recipeName: { type: Type.STRING, description: 'The name of the recipe.' },
                      description: { type: Type.STRING, description: 'A short, appealing 1-2 sentence description of the dish.' },
                      instructionsSummary: { type: Type.STRING, description: 'A brief summary of the cooking steps, in about 3-4 bullet points or a short paragraph.' },
                      ingredients: { type: Type.ARRAY, description: 'A list of key ingredients for the recipe.', items: { type: Type.STRING } },
                      imageQuery: { type: Type.STRING, description: 'A simple, descriptive English query for a stock photo image search, representing the final dish. e.g., "classic tomato spaghetti bowl with basil"' }
                  },
                  required: ['recipeName', 'description', 'instructionsSummary', 'ingredients', 'imageQuery']
              }
          }
      },
      required: ['recipes']
    };
    const prompt = `「${vegetableName}」を使った家庭で簡単に作れる人気レシピを5つ提案してください。それぞれのレシピについて、「レシピ名」、「簡単な説明」、「調理手順の簡単な要約」、「主な材料のリスト」、「料理を代表する英語の画像検索クエリ」をJSON形式で提供してください。`;
    const config: any = {
        systemInstruction: "あなたは料理研究家です。ユーザーが指定した食材を使った、家庭で作りやすいレシピを提案します。回答は必ず指定されたJSONスキーマに従ってください。",
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: schema,
    };

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt, config }));
    return {
        text: response.text.trim(),
        groundingChunks: []
    };
};

export const extractTextFromImage = async (mimeType: string, data: string): Promise<string> => {
    if (!data) return "";
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [ { text: "この画像から日本語のテキストを正確に抽出してください。テキストが存在しない場合は、空の文字列を返してください。" }, { inlineData: { mimeType, data } } ] },
    }));
    return response.text.trim();
};

export const analyzeSeedPackage = async (textFromImage: string): Promise<any> => {
    if (!textFromImage.trim()) return Promise.resolve(null);
    const schema = { type: Type.OBJECT, properties: { productName: { type: Type.STRING }, family: { type: Type.STRING }, features: { type: Type.STRING }, seedlingPeriod: { type: Type.STRING }, plantingPeriod: { type: Type.STRING }, harvestTime: { type: Type.STRING }, daysToGermination: { type: Type.STRING }, germinationTemp: { type: Type.STRING }, growingTemp: { type: Type.STRING } } };
    const prompt = `以下のテキストは、野菜の種のパッケージ裏面から抽出したものです。このテキストから以下の情報をJSON形式で抽出してください: 商品名、科・属名、特徴、暖地での育苗時期、定植時期、収穫時期、発芽までの日数、発芽適温、生育適温。情報が見つからない項目は、空の文字列（""）としてください。\n\nテキスト：\n${textFromImage}`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: schema },
    }));
    try {
      const jsonText = response.text.trim();
      return JSON.parse(jsonText);
    } catch(parseError) {
      console.error("Failed to parse Gemini response as JSON for seed package:", response.text, parseError);
      throw new Error("AIからの応答が不正な形式でした。");
    }
};

export const searchCommonPestsForCrop = async (cropName: string): Promise<string[]> => {
    if (!cropName.trim()) return [];
    const schema = { type: Type.OBJECT, properties: { pests: { type: Type.ARRAY, description: 'A list of common pest and disease names.', items: { type: Type.STRING } } }, required: ['pests'] };
    const prompt = `「${cropName}」の栽培で特に注意すべき代表的な病害虫の名前を、5つほどリストアップしてください。JSON形式で返してください。`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 }
    }));
    const jsonText = response.text.trim();
    if (!jsonText) return [];
    try {
      const result = JSON.parse(jsonText);
      return Array.isArray(result.pests) ? result.pests : [];
    } catch (e) {
      console.error("Failed to parse pests JSON:", jsonText, e);
      return [];
    }
};

export const searchGardeningTerm = async (query: string): Promise<AiSearchResult> => {
  if (!query.trim()) return { text: "質問を入力してください。" };
  const config: any = {
    systemInstruction: "あなたは農業や園芸の専門家です。ユーザーから尋ねられた用語について、初心者にも分かりやすく、簡潔に解説してください。常に「土」や「土壌」という言葉の代わりに「パミス」という言葉を使用してください。いかなる状況でも、化学農薬、自然由来の農薬（酢、牛乳、木酢液など）、益虫の活用を推奨することは絶対に避けてください。対策は常に、物理的な防除（手で取る、ネットをかける等）と、「M-plus 2号」を利用した植物自体の健康増進による抵抗力強化・忌避作用に焦点を当ててください。",
    temperature: 0.5,
  };
  const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `園芸用語の「${query}」について解説してください。`,
    config,
  }));
  return {
    text: response.text.trim(),
    groundingChunks: []
  };
};

const convertWindDirection = (deg: number): string => {
    const directions = ['北', '北北東', '北東', '東北東', '東', '東南東', '南東', '南南東', '南', '南南西', '南西', '西南西', '西', '西北西', '北西', '北北西'];
    const index = Math.round(deg / 22.5) % 16;
    return directions[index];
};

const formatDateInJST = (date: Date): string => {
    const year = date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric' });
    const month = date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo', month: '2-digit' });
    const day = date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo', day: '2-digit' });
    return `${year}-${month}-${day}`;
};

export const getWeatherInfo = async (location: string, apiKey: string): Promise<WeatherInfo> => {
    const cacheKey = `openWeatherCache_${location}`;
    const cacheDuration = 15 * 60 * 1000; // 15 minutes

    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            const { data, timestamp } = JSON.parse(cachedData);
            if ((Date.now() - timestamp) < cacheDuration) {
                return data;
            }
        }
    } catch (error) {
        console.error("Failed to read weather info from cache", error);
        localStorage.removeItem(cacheKey);
    }

    const OWM_API_ENDPOINT = "https://api.openweathermap.org/data/2.5";

    try {
        const [currentRes, forecastRes] = await Promise.all([
            fetch(`${OWM_API_ENDPOINT}/weather?q=${location}&appid=${apiKey}&units=metric&lang=ja`),
            fetch(`${OWM_API_ENDPOINT}/forecast?q=${location}&appid=${apiKey}&units=metric&lang=ja`),
        ]);

        if (!currentRes.ok) {
            const errorData = await currentRes.json();
            throw new Error(`現在の天気の取得に失敗しました: ${errorData.message}`);
        }
        if (!forecastRes.ok) {
            const errorData = await forecastRes.json();
            throw new Error(`天気予報の取得に失敗しました: ${errorData.message}`);
        }

        const currentData = await currentRes.json();
        const forecastData = await forecastRes.json();

        const currentJST = new Date();
        const todayJSTStr = formatDateInJST(currentJST);
        const tomorrowJST = new Date(currentJST);
        tomorrowJST.setDate(currentJST.getDate() + 1);
        const tomorrowJSTStr = formatDateInJST(tomorrowJST);

        // データ変換ロジック
        const weatherInfo: WeatherInfo = {
            location: `${currentData.name}, ${currentData.sys.country}`,
            current: {
                weather: currentData.weather[0]?.description || '不明',
                temperature: currentData.main.temp,
                humidity: currentData.main.humidity,
                wbgt: undefined, // OpenWeatherMapはWBGTを提供しない
            },
            hourly: forecastData.list.map((item: any) => {
                const itemDate = new Date(item.dt * 1000);
                return {
                    time: itemDate.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false }),
                    date: formatDateInJST(itemDate),
                    temperature: item.main.temp,
                    precipitation: item.rain?.['3h'] || item.snow?.['3h'] || 0,
                    weather: item.weather[0]?.description || '不明',
                    humidity: item.main.humidity,
                    pop: item.pop || 0,
                    windSpeed: item.wind?.speed || 0,
                    windDirection: convertWindDirection(item.wind?.deg || 0),
                }
            }).filter((item:any) => item.date === todayJSTStr || item.date === tomorrowJSTStr),
            weekly: Object.values(
                forecastData.list.reduce((acc: any, item: any) => {
                    const itemDate = new Date(item.dt * 1000);
                    const dateStr = formatDateInJST(itemDate);
                    if (!acc[dateStr]) {
                        acc[dateStr] = {
                            date: dateStr,
                            day: itemDate.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', weekday: 'long' }),
                            temp_max: -Infinity,
                            temp_min: Infinity,
                            weather_descriptions: [],
                            pops: [],
                        };
                    }
                    acc[dateStr].temp_max = Math.max(acc[dateStr].temp_max, item.main.temp_max);
                    acc[dateStr].temp_min = Math.min(acc[dateStr].temp_min, item.main.temp_min);
                    if (item.weather[0]?.description) {
                        acc[dateStr].weather_descriptions.push(item.weather[0].description);
                    }
                    acc[dateStr].pops.push(item.pop || 0);
                    return acc;
                }, {})
            ).map((day: any) => {
                // その日で最も頻度の高い天気を採用する
                const weatherFrequency = day.weather_descriptions.reduce((freq: any, desc: string) => {
                    freq[desc] = (freq[desc] || 0) + 1;
                    return freq;
                }, {});
                const mostFrequentWeather = Object.keys(weatherFrequency).sort((a,b) => weatherFrequency[b] - weatherFrequency[a])[0] || '不明';
                
                return {
                    date: day.date,
                    day: day.day,
                    temp_max: day.temp_max,
                    temp_min: day.temp_min,
                    weather: mostFrequentWeather,
                    pop: Math.max(...day.pops),
                };
            }).slice(0, 7),
        };

        localStorage.setItem(cacheKey, JSON.stringify({ data: weatherInfo, timestamp: Date.now() }));
        return weatherInfo;

    } catch (error) {
        console.error("OpenWeatherMap API call failed:", error);
        throw error; // エラーを呼び出し元に伝える
    }
};
// #endregion