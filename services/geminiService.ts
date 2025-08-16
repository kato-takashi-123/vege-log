

import { GoogleGenAI, Type, GenerateContentResponse, GenerateImagesResponse } from "@google/genai";
import { WeatherInfo, PestInfo, VegetableInfo, PlantDiagnosis } from './types';

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

// --- Provider Detection ---
const getProvider = (model: string): 'gemini' | 'openai' => {
  if (model.toLowerCase().includes('gemini')) {
    return 'gemini';
  }
  if (model.toLowerCase().includes('gpt')) {
    return 'openai';
  }
  return 'gemini'; // Default to Gemini
};


// #region --- Gemini Provider (Implementation) ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "NO_KEY" });

const geminiGetDailyQuote = async (model: string): Promise<string> => {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
      contents: "家庭菜園や野菜に関する、面白くて少し笑える川柳を五・七・五の形式で一句生成してください。",
      config: {
        systemInstruction: "あなたはユーモアのセンスがある川柳作家です。日常のささいな出来事を面白おかしく表現します。",
        temperature: 0.9,
        thinkingConfig: { thinkingBudget: 0 }
      }
    }));
    const tip = response.text.trim().split('\n')[0];
    return (tip && tip.length > 5) ? tip : "ミニトマト 赤くなるのを まだか待つ";
};

const geminiGetVegetableInfo = async (query: string, model: string): Promise<VegetableInfo> => {
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
                description: '「TOMATEC M-Plus 1」と「TOMATEC M-Plus 2」を使った施肥計画。',
                properties: {
                    baseFertilizer: { type: Type.STRING, description: '元肥に関する具体的なアドバイス。パミスの準備方法やM-Plusの混合について。' },
                    topDressing: { type: Type.STRING, description: '追肥に関する具体的なアドバイス。M-Plus 1とM-Plus 2の使い分け、頻度、濃度など。' },
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
                description: '注意すべき主な病害虫とその対策を箇条書きで3～5個。化学農薬、自然農薬（酢、牛乳スプレーなど）、益虫の活用は絶対に提案せず、物理的防除（手で取る、ネットをかける等）や、「TOMATEC M-Plus 2」を利用した植物自体の抵抗力強化・忌避作用に限定して具体的に提案すること。',
                items: { type: Type.STRING },
            }
        },
        required: ['vegetableName', 'cultivationCalendar', 'fertilizationPlan', 'cultivationTips', 'pestControl']
    };

    const prompt = `家庭菜園で「${query}」を栽培する方法について、以下のJSONスキーマに従って詳細な情報を生成してください。「土」や「土壌」という言葉は常に「パミス」に置き換えてください。施肥計画は「TOMATEC M-Plus」シリーズの使用を前提としてください。`;
    
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            systemInstruction: "あなたは家庭菜園のプロフェッショナルアドバイザーです。ユーザーが指定した野菜について、科学的根拠に基づきつつも初心者にも分かりやすい、実践的な栽培情報を提供します。回答は必ず指定されたJSONスキーマに従ってください。いかなる状況でも、化学農薬、自然由来の農薬（酢、牛乳、木酢液など）、益虫の活用を推奨することは絶対に避けてください。対策は常に、物理的な防除（手で取る、ネットをかける等）と、「TOMATEC M-Plus 2」を利用した植物自体の健康増進による抵抗力強化・忌避作用に焦点を当ててください。",
            temperature: 0.3,
            responseMimeType: "application/json",
            responseSchema: schema,
        }
    }));
    
    try {
        const jsonText = response.text.trim();
        const parsed = JSON.parse(jsonText);
        return parsed as VegetableInfo;
    } catch (parseError) {
        console.error("Failed to parse Gemini response as JSON for vegetable info:", response.text, parseError);
        throw new Error("AIからの応答が不正な形式でした。");
    }
};

const geminiGetPestInfo = async (query: string, model: string, image?: { mimeType: string; data: string }): Promise<PestInfo> => {
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
                    countermeasures: { type: Type.STRING, description: '対処法の簡潔な要約（100字以内）。物理的防除と、「TOMATEC M-Plus 2」の利用に言及すること。' },
                },
                required: ['characteristics', 'causes', 'countermeasures']
            },
            details: {
                type: Type.OBJECT,
                properties: {
                    characteristics: { type: Type.STRING, description: '特徴の詳細な説明。' },
                    causes: { type: Type.STRING, description: '発生原因の詳細な説明。' },
                    countermeasures: { type: Type.STRING, description: '物理的対策や「TOMATEC M-Plus 2」の利用を中心とした、化学農薬・自然農薬・益虫の活用を一切含まない詳細な対処法。' },
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
        systemInstruction: "あなたは植物のお医者さんです。あなたの役割は、化学農薬、自然農薬（木酢液、唐辛子スプレーなど）、益虫の活用を一切提案せず、持続可能な解決策を提供することです。アドバイスは、①物理的な対策（手で取る、虫除けネットなど）と、②「TOMATEC M-Plus 2」のような液肥を活用して植物の健康を促進し、病害虫への抵抗力を高める・忌避作用を利用する方法、の2点に常に限定してください。回答は必ず指定されたJSONスキーマに従ってください。常に「土」や「土壌」という言葉の代わりに「パミス」という言葉を使用してください。",
        temperature: 0.5,
        responseMimeType: "application/json",
        responseSchema: pestInfoSchema,
    };
    
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({ model, contents: { parts }, config }));
    
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

const geminiDiagnosePlantHealth = async (model: string, image: { mimeType: string; data: string }): Promise<PlantDiagnosis> => {
    const schema = {
        type: Type.OBJECT,
        properties: {
            overallHealth: { type: Type.STRING, description: '植物の全体的な健康状態を「健康的」「注意が必要」「病気の可能性」のいずれかで評価してください。' },
            pestAndDisease: {
                type: Type.OBJECT,
                properties: {
                    isDetected: { type: Type.BOOLEAN, description: '病害虫が検出されたかどうか。' },
                    details: { type: Type.STRING, description: '検出された病害虫や病気の兆候に関する詳細な説明。見つからなければ「特に問題は見られません。」と記述。' },
                    countermeasures: { type: Type.STRING, description: '農薬を一切使わない、物理的防除や「TOMATEC M-Plus 2」の活用を中心とした具体的な対策方法。' },
                },
                required: ['isDetected', 'details', 'countermeasures']
            },
            fertilizer: {
                type: Type.OBJECT,
                properties: {
                    recommendation: { type: Type.STRING, description: '「TOMATEC M-Plus 1」と「TOMATEC M-Plus 2」の濃度や頻度に関する具体的な調整アドバイス。' },
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
        required: ['overallHealth', 'pestAndDisease', 'fertilizer', 'watering', 'environment']
    };

    const prompt = "この野菜の画像から、健康状態を診断してください。以下のJSONスキーマに従って、農薬を使わない持続可能な方法でのアドバイスを生成してください。";
    const parts = [
        { inlineData: { mimeType: image.mimeType, data: image.data } },
        { text: prompt }
    ];

    const config = {
        systemInstruction: "あなたは経験豊富な植物病理学者であり、家庭菜園のアドバイザーです。提供された画像から植物の状態を詳細に分析し、ユーザーが直面している問題を特定します。あなたのアドバイスは常に科学的根拠に基づき、初心者にも理解しやすい言葉で説明されます。特に重要なのは、化学農薬や自然農薬（木酢液など）を一切推奨せず、物理的防除（手で取り除く、ネットをかける等）や、植物の自己免疫力を高めるための液肥（例：「TOMATEC M-Plus」シリーズ）の適切な使用、栽培環境の改善（日当たり、風通し、水やり）といった、総合的病害虫管理（IPM）の考え方に基づいた持続可能な解決策を提案することです。回答は必ず指定されたJSONスキーマに従ってください。",
        temperature: 0.4,
        responseMimeType: "application/json",
        responseSchema: schema,
    };

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({ model, contents: { parts }, config }));
    
    try {
        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as PlantDiagnosis;
    } catch (parseError) {
        console.error("Failed to parse Gemini response as JSON for plant diagnosis:", response.text, parseError);
        throw new Error("AIからの応答が不正な形式でした。");
    }
};

const geminiGenerateImage = async (prompt: string): Promise<string> => {
    const response = await withRetry<GenerateImagesResponse>(() => ai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: `a high quality, delicious looking, commercial food photography of ${prompt}`,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9',
        },
    }));
    const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
    return `data:image/jpeg;base64,${base64ImageBytes}`;
};

const geminiSearchRecipes = async (vegetableName: string, model: string): Promise<AiSearchResult> => {
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
                        ingredients: { type: Type.ARRAY, description: 'A list of key ingredients for the recipe.', items: { type: Type.STRING } },
                        imageQuery: { type: Type.STRING, description: 'A simple, descriptive English query for a stock photo image search, representing the final dish. e.g., "classic tomato spaghetti bowl with basil"' }
                    },
                    required: ['recipeName', 'description', 'ingredients', 'imageQuery']
                }
            }
        },
        required: ['recipes']
    };
    const prompt = `「${vegetableName}」を使った家庭で簡単に作れる人気レシピを5つ提案してください。それぞれのレシピについて、「レシピ名」、「簡単な説明」、「主な材料のリスト」、「料理を代表する英語の画像検索クエリ」をJSON形式で提供してください。`;
    const config: any = {
        systemInstruction: "あなたは料理研究家です。ユーザーが指定した食材を使った、家庭で作りやすいレシピを提案します。回答は必ず指定されたJSONスキーマに従ってください。",
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: schema,
    };

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({ model: model, contents: prompt, config }));
    return {
        text: response.text.trim(),
        groundingChunks: []
    };
};

const geminiExtractTextFromImage = async (mimeType: string, data: string, model: string): Promise<string> => {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
      contents: { parts: [ { text: "この画像から日本語のテキストを正確に抽出してください。テキストが存在しない場合は、空の文字列を返してください。" }, { inlineData: { mimeType, data } } ] },
    }));
    return response.text.trim();
};

const geminiAnalyzeSeedPackage = async (textFromImage: string, model: string): Promise<any> => {
    const schema = { type: Type.OBJECT, properties: { productName: { type: Type.STRING }, family: { type: Type.STRING }, features: { type: Type.STRING }, seedlingPeriod: { type: Type.STRING }, plantingPeriod: { type: Type.STRING }, harvestTime: { type: Type.STRING }, daysToGermination: { type: Type.STRING }, germinationTemp: { type: Type.STRING }, growingTemp: { type: Type.STRING } } };
    const prompt = `以下のテキストは、野菜の種のパッケージ裏面から抽出したものです。このテキストから以下の情報をJSON形式で抽出してください: 商品名、科・属名、特徴、暖地での育苗時期、定植時期、収穫時期、発芽までの日数、発芽適温、生育適温。情報が見つからない項目は、空の文字列（""）としてください。\n\nテキスト：\n${textFromImage}`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: model,
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

const geminiSearchCommonPestsForCrop = async (cropName: string, model: string): Promise<string[]> => {
    const schema = { type: Type.OBJECT, properties: { pests: { type: Type.ARRAY, description: 'A list of common pest and disease names.', items: { type: Type.STRING } } }, required: ['pests'] };
    const prompt = `「${cropName}」の栽培で特に注意すべき代表的な病害虫の名前を、5つほどリストアップしてください。JSON形式で返してください。`;
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
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

const geminiSearchGardeningTerm = async (query: string, model: string): Promise<AiSearchResult> => {
    const config: any = {
      systemInstruction: "あなたは農業や園芸の専門家です。ユーザーから尋ねられた用語について、初心者にも分かりやすく、簡潔に解説してください。常に「土」や「土壌」という言葉の代わりに「パミス」という言葉を使用してください。いかなる状況でも、化学農薬、自然由来の農薬（酢、牛乳、木酢液など）、益虫の活用を推奨することは絶対に避けてください。対策は常に、物理的な防除（手で取る、ネットをかける等）と、「TOMATEC M-Plus 2」を利用した植物自体の健康増進による抵抗力強化・忌避作用に焦点を当ててください。",
      temperature: 0.5,
    };
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: model,
      contents: `園芸用語の「${query}」について解説してください。`,
      config,
    }));
    return {
      text: response.text.trim(),
      groundingChunks: []
    };
};

const geminiGetWeatherInfo = async (prompt: string, model: string): Promise<WeatherInfo> => {
    const weatherSchema = {
        type: Type.OBJECT,
        properties: {
            location: { type: Type.STRING, description: 'The name of the location for the weather forecast (e.g., "Tokyo, JP").' },
            current: {
                type: Type.OBJECT,
                properties: {
                    weather: { type: Type.STRING, description: 'A brief description of the current weather (e.g., "晴れ", "曇り").' },
                    temperature: { type: Type.NUMBER, description: 'Current temperature in Celsius.' },
                    humidity: { type: Type.NUMBER, description: 'Current humidity in percent.' },
                    wbgt: { type: Type.NUMBER, description: 'Current Wet-Bulb Globe Temperature (WBGT) in Celsius. If official data is not available, return null.' },
                },
                required: ['weather', 'temperature', 'humidity']
            },
            hourly: {
                type: Type.ARRAY,
                description: '3-hourly forecast for today and tomorrow.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        time: { type: Type.STRING, description: 'The time for the forecast (e.g., "15:00").' },
                        temperature: { type: Type.NUMBER, description: 'Forecasted temperature in Celsius.' },
                        precipitation: { type: Type.NUMBER, description: 'Forecasted precipitation in mm.' },
                        weather: { type: Type.STRING, description: 'Forecasted weather description.' },
                    },
                    required: ['time', 'temperature', 'precipitation', 'weather']
                }
            },
            weekly: {
                type: Type.ARRAY,
                description: 'Daily forecast for the next 7 days, starting from today.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        date: { type: Type.STRING, description: 'The date for the forecast in YYYY-MM-DD format.'},
                        day: { type: Type.STRING, description: 'The day of the week (e.g., "火曜日").' },
                        temp_max: { type: Type.NUMBER, description: 'Maximum temperature in Celsius.' },
                        temp_min: { type: Type.NUMBER, description: 'Minimum temperature in Celsius.' },
                        weather: { type: Type.STRING, description: 'Forecasted weather description.' },
                    },
                    required: ['date', 'day', 'temp_max', 'temp_min', 'weather']
                }
            }
        },
        required: ['location', 'current', 'hourly', 'weekly']
    };

    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: weatherSchema,
        },
    }));
    try {
        const jsonText = response.text.trim();
        return JSON.parse(jsonText);
    } catch(parseError) {
        console.error("Failed to parse Gemini response as JSON for weather:", response.text, parseError);
        throw new Error("AIからの天候応答が不正な形式でした。");
    }
};

// #endregion

// #region --- ChatGPT (Mock) Provider ---
const mockApiCall = async (delay: number) => new Promise(res => setTimeout(res, delay));

const chatGptGetDailyQuote = async (): Promise<string> => {
    await mockApiCall(500);
    const quotes = [
      "アブラムシ 見つけて叫ぶ 妻の声",
      "ミニトマト 赤くなるのを まだか待つ",
      "ベランダが ジャングルになる 夏の夢",
      "きゅうり採れ 食べきれなくて おすそ分け"
    ];
    return quotes[Math.floor(Math.random() * quotes.length)];
};

const chatGptGetVegetableInfo = async (query: string): Promise<VegetableInfo> => {
    await mockApiCall(1500);
    return {
        vegetableName: query,
        cultivationCalendar: {
            seeding: "春 (3-4月)",
            planting: "春 (5月)",
            harvest: "夏 (7-8月)",
        },
        fertilizationPlan: {
            baseFertilizer: "植え付けの1週間前に、パミスによく混ぜ込みます。",
            topDressing: "成長期にはM-Plus 1を、実がつき始めたらM-Plus 2を週に1回、500倍に薄めて与えます。",
        },
        cultivationTips: ["日当たりの良い場所を好みます。", "水のやりすぎに注意しましょう。", "支柱を立てて誘引すると良いです。"],
        pestControl: ["アブラムシが発生しやすいので、見つけ次第手で取り除きます。", "風通しを良くして、うどんこ病を予防します。", "M-Plus 2を定期的に散布することで、植物自体の抵抗力を高めることができます。"],
    };
};

const chatGptGetWeatherInfo = async (): Promise<WeatherInfo> => {
    await mockApiCall(1000);
    // Helper to format date as YYYY-MM-DD
    const toISODateString = (date: Date): string => {
        return date.toISOString().split('T')[0];
    };

    const now = new Date();
    // Create 16 data points (for today and tomorrow, 3-hourly)
    const hourlyData = Array(16).fill(0).map((_, i) => {
        const forecastDate = new Date(now.getTime() + i * 3 * 60 * 60 * 1000);
        return {
            time: `${String(forecastDate.getHours()).padStart(2, '0')}:00`,
            temperature: 25 - i + Math.round(Math.sin(i/2) * 3),
            precipitation: Math.max(0, Math.round(Math.random() * 8 - 4)),
            weather: ["晴れ", "曇り", "小雨", "晴れ"][i % 4],
        };
    });

    return {
        location: "Tokyo, JP (Mock)",
        current: {
            weather: "晴れ",
            temperature: 28,
            humidity: 65,
            wbgt: 26.5,
        },
        hourly: hourlyData,
        weekly: Array(7).fill(0).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() + i);
            return {
                date: toISODateString(d),
                day: ['日', '月', '火', '水', '木', '金', '土'][d.getDay()] + '曜日',
                temp_max: 32 - i,
                temp_min: 24 - Math.floor(i/2),
                weather: "晴時々曇",
            };
        }),
    };
};


const chatGptGetPestInfo = async (query: string): Promise<PestInfo> => {
    await mockApiCall(1500);
    const pestName = query || "アブラムシ";
    return {
        pestName: pestName,
        imageQueries: [
            `${pestName} on a rose stem`,
            `curled leaves on a plant due to ${pestName} damage`,
            `ladybug eating ${pestName}`
        ],
        summary: {
            characteristics: "小さくて緑色または黒色の虫で、植物の汁を吸います。",
            causes: "暖かく乾燥した環境を好み、風に乗って飛来します。",
            countermeasures: "M-Plus 2で植物を健康に保ち、抵抗力を高めます。数が少ないうちは手で取り除きます。"
        },
        details: {
            characteristics: `${pestName}は体長1〜4mm程度の小さな昆虫です。群れで発生し、新芽や葉の裏に集まります。甘い排泄物（甘露）を出し、これがすす病の原因になることもあります。`,
            causes: "窒素過多の肥料を与えると発生しやすくなります。また、風通しが悪い場所も好みます。",
            countermeasures: "「TOMATEC M-Plus 2」を適切に使用し、植物自体の抵抗力を高めることが基本です。発生初期には、粘着テープで取り除いたり、水流で洗い流したりするのが効果的です。防虫ネットなどを利用して、物理的に侵入を防ぐことも重要です。"
        }
    };
};

const chatGptGenerateImage = async (): Promise<string> => {
    await mockApiCall(800);
    return `https://via.placeholder.com/320x180.png?text=Generated+Image`;
};

const chatGptExtractTextFromImage = async (): Promise<string> => {
    await mockApiCall(1200);
    return "画像から抽出されたテキストサンプルです。";
};

const chatGptAnalyzePackage = async (): Promise<any> => {
    await mockApiCall(2000);
    return {
      productName: 'サンプルミニトマト',
      family: 'ナス科ナス属',
      features: '甘くて育てやすいミニトマトです。',
      seedlingPeriod: '3月～4月',
      plantingPeriod: '5月～6月',
      harvestTime: '7月～9月',
      daysToGermination: '5～10日',
      germinationTemp: '20～25℃',
      growingTemp: '15～28℃',
    };
};

const chatGptSearchPests = async (): Promise<string[]> => {
    await mockApiCall(1000);
    return ['アブラムシ', 'ハダニ', 'うどんこ病'];
};

const chatGptSearchGardeningTerm = async (query: string): Promise<AiSearchResult> => {
    await mockApiCall(1200);
    const definitions: Record<string, string> = {
        '摘心': '摘心（てきしん）とは、植物の主茎や側枝の先端にある成長点を摘み取る作業のことです。これにより、脇芽の成長を促進し、株を横にこんもりと茂らせたり、花や実の数を増やしたりする効果が期待できます。',
        '連作障害': '連作障害（れんさくしょうがい）とは、同じ科の植物を同じ場所で連続して栽培することで、土壌の栄養バランスが崩れたり、特定の病原菌や害虫が増えたりして、生育が悪くなる現象を指します。パミス栽培では土壌病害のリスクは低いですが、栄養の偏りを防ぐために液肥の適切な使用が重要です。',
        'コンパニオンプランツ': 'コンパニオンプランツとは、一緒に植えることで互いに良い影響を与え合う植物の組み合わせのことです。害虫を遠ざけたり、成長を助けたりする効果が期待されます。例えば、トマトの近くにバジルを植えると、風味を良くし、害虫を遠ざけると言われています。'
    };
    const text = definitions[query] || `「${query}」についての解説です。これは、植物の健全な成長を促すための重要な園芸技術の一つです。適切な時期に実施することで、収穫量を増やし、品質を向上させることができます。`;
    return { text };
};

// #endregion

// #region --- Public Service Functions (Dispatchers with Fallback) ---
export const getDailyQuote = async (model: string): Promise<string> => {
  const cacheKey = 'dailyQuoteCache';
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  try {
    const cachedData = localStorage.getItem(cacheKey);
    if (cachedData) {
      const { quote, date } = JSON.parse(cachedData);
      if (date === today && quote) {
        return quote;
      }
    }
  } catch (error) {
    console.error("Failed to read daily quote from cache", error);
    localStorage.removeItem(cacheKey);
  }

  // No valid cache, so fetch a new quote
  let newQuote: string;
  if (getProvider(model) === 'openai') {
    newQuote = await chatGptGetDailyQuote();
  } else {
    newQuote = await geminiGetDailyQuote(model);
  }

  // Cache the newly fetched quote (or fallback)
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ quote: newQuote, date: today }));
  } catch (error) {
    console.error("Failed to write daily quote to cache", error);
  }

  return newQuote;
};

export const getVegetableInfo = async (query: string, model: string): Promise<VegetableInfo> => {
  if (!query.trim()) throw new Error("野菜の名前を入力してください。");
  if (getProvider(model) === 'openai') {
    return chatGptGetVegetableInfo(query);
  }
  return await geminiGetVegetableInfo(query, model);
};

export const searchPestInfo = async (query: string, model: string, image?: { mimeType: string; data: string }): Promise<PestInfo> => {
  if (!query.trim() && !image) throw new Error("質問を入力するか、画像をアップロードしてください。");
  if (getProvider(model) === 'openai') {
    return chatGptGetPestInfo(query);
  }
  return await geminiGetPestInfo(query, model, image);
};

export const diagnosePlantHealth = async (model: string, image: { mimeType: string; data: string }): Promise<PlantDiagnosis> => {
  if (getProvider(model) === 'openai') {
    await mockApiCall(2500);
    return {
      overallHealth: "注意が必要 (Mock)",
      pestAndDisease: {
        isDetected: true,
        details: "葉にアブラムシの初期発生が見られます。",
        countermeasures: "M-Plus 2を散布して植物の抵抗力を高め、数が少ないうちに手で取り除いてください。"
      },
      fertilizer: {
        recommendation: "M-Plus 1の頻度を週に1回に保ちつつ、M-Plus 2の散布を週に2回に増やして様子を見てください。"
      },
      watering: {
        status: 'Adequate',
        recommendation: "現在の水やりは適切です。パミスの表面が乾いたら与えるようにしてください。"
      },
      environment: {
        recommendation: "日当たりは良好ですが、午後の西日が強すぎる場合は、寒冷紗で30%程度の遮光を検討してください。"
      }
    };
  }
  return await geminiDiagnosePlantHealth(model, image);
};

export const generateRecipeImage = async (prompt: string, model: string): Promise<string> => {
  if (!prompt) return "https://via.placeholder.com/320x180.png?text=No+Prompt";
  if (getProvider(model) === 'openai') {
    return chatGptGenerateImage();
  }
  return await geminiGenerateImage(prompt);
};

export const searchRecipes = async (vegetableName: string, model: string): Promise<AiSearchResult> => {
    if (!vegetableName.trim()) return { text: "" };
    
    if (getProvider(model) === 'openai') {
        await mockApiCall(1500);
        const mockResponse = {
            recipes: [
                { recipeName: `${vegetableName}のサラダ`, description: `新鮮な${vegetableName}を使ったシンプルなサラダです。`, ingredients: [vegetableName, "レタス", "きゅうり", "お好みのドレッシング"], imageQuery: `${vegetableName} salad` },
                { recipeName: `${vegetableName}の炒め物`, description: `ご飯が進む、${vegetableName}の定番炒め料理です。`, ingredients: [vegetableName, "豚バラ肉", "醤油", "みりん"], imageQuery: `stir-fried ${vegetableName}` },
                { recipeName: `${vegetableName}のスープ`, description: `栄養満点！${vegetableName}のポタージュスープです。`, ingredients: [vegetableName, "玉ねぎ", "コンソメ", "牛乳"], imageQuery: `${vegetableName} soup` },
                { recipeName: `${vegetableName}のグラタン`, description: `チーズとろーり、${vegetableName}の熱々グラタン。`, ingredients: [vegetableName, "鶏肉", "ホワイトソース", "チーズ"], imageQuery: `${vegetableName} gratin` },
                { recipeName: `${vegetableName}のピクルス`, description: `さっぱり美味しい、${vegetableName}の簡単ピクルス。`, ingredients: [vegetableName, "酢", "砂糖", "塩"], imageQuery: `${vegetableName} pickles` }
            ]
        };
        return { text: JSON.stringify(mockResponse) };
    }

    return await geminiSearchRecipes(vegetableName, model);
};

export const extractTextFromImage = async (mimeType: string, data: string, model: string): Promise<string> => {
    if (!data) return "";
    if (getProvider(model) === 'openai') {
        return chatGptExtractTextFromImage();
    }
    return await geminiExtractTextFromImage(mimeType, data, model);
};

export const analyzeSeedPackage = async (textFromImage: string, model: string): Promise<any> => {
    if (!textFromImage.trim()) return Promise.resolve(null);
    if (getProvider(model) === 'openai') {
        return chatGptAnalyzePackage();
    }
    return await geminiAnalyzeSeedPackage(textFromImage, model);
};

export const searchCommonPestsForCrop = async (cropName: string, model: string): Promise<string[]> => {
    if (!cropName.trim()) return [];
    if (getProvider(model) === 'openai') {
        return chatGptSearchPests();
    }
    return await geminiSearchCommonPestsForCrop(cropName, model);
};

export const searchGardeningTerm = async (query: string, model: string): Promise<AiSearchResult> => {
  if (!query.trim()) return { text: "質問を入力してください。" };
  if (getProvider(model) === 'openai') {
    return chatGptSearchGardeningTerm(query);
  }
  return await geminiSearchGardeningTerm(query, model);
};

export const getWeatherInfo = async (location: { latitude: number; longitude: number } | { name: string }, model: string): Promise<WeatherInfo> => {
    const cacheKey = 'weatherInfoCache';
    const cacheDuration = 15 * 60 * 1000; // 15 minutes

    // 1. Try to get from cache
    try {
        const cachedData = localStorage.getItem(cacheKey);
        if (cachedData) {
            const { data, timestamp, loc } = JSON.parse(cachedData);
            const isCacheValid = (Date.now() - timestamp) < cacheDuration;

            let isLocationSame = false;
            if ('latitude' in location && loc && 'latitude' in loc) {
                isLocationSame = Math.abs(loc.latitude - location.latitude) < 0.1 && Math.abs(loc.longitude - location.longitude) < 0.1;
            } else if ('name' in location && loc && 'name' in loc) {
                isLocationSame = loc.name === location.name;
            }
            
            if (isCacheValid && isLocationSame) {
                return data;
            }
        }
    } catch (error) {
        console.error("Failed to read weather info from cache", error);
        localStorage.removeItem(cacheKey);
    }

    // 2. If not in cache, fetch from API
    let newWeatherInfo: WeatherInfo;
    if (getProvider(model) === 'openai') {
        newWeatherInfo = await chatGptGetWeatherInfo();
    } else {
        const prompt = 'latitude' in location
            ? `緯度${location.latitude}、経度${location.longitude}について、以下の情報をJSONで返してください。1. 現在の天気、気温（摂氏）、湿度（％）。2. 暑さ指数（WBGT、摂氏）。環境省などの公式な予報データが見つかる場合のみ数値で返し、見つからない場合はnullを返してください。3. 今日と明日の3時間ごとの天気予報（時刻、気温、降水量mm、天気概要）。4. 今日から7日間の日ごとの天気予報（日付 YYYY-MM-DD形式、曜日、最高・最低気温、天気概要）。`
            : `「${location.name}」の主要都市について、以下の情報をJSONで返してください。1. 現在の天気、気温（摂氏）、湿度（％）。2. 暑さ指数（WBGT、摂氏）。環境省などの公式な予報データが見つかる場合のみ数値で返し、見つからない場合はnullを返してください。3. 今日と明日の3時間ごとの天気予報（時刻、気温、降水量mm、天気概要）。4. 今日から7日間の日ごとの天気予報（日付 YYYY-MM-DD形式、曜日、最高・最低気温、天気概要）。`;
        newWeatherInfo = await geminiGetWeatherInfo(prompt, model);
    }

    // 3. Store the new data in cache
    try {
        const cacheEntry = {
            data: newWeatherInfo,
            timestamp: Date.now(),
            loc: location,
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
    } catch (error) {
        console.error("Failed to write weather info to cache", error);
    }

    return newWeatherInfo;
};
// #endregion