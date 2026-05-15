import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { LayoutDashboard, MessageSquare, TrendingUp, ShoppingBag, Menu, Send, User, Sparkles, AlertCircle, Loader2, RefreshCw, ClipboardList, CloudSun, Wallet, Save, X, Plus, Trash2, Box, Database, Check, AlertTriangle, Utensils, Link as LinkIcon, DollarSign, Edit3, ShoppingCart, Tag } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, onSnapshot, query, orderBy, updateDoc, addDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

// --- GAS API Setup ---
// GitHub公開用マスキング: 機密情報保護のためURLをプレースホルダー化しています。環境変数または実際のURLを設定してください。
const GAS_API_URL = import.meta.env?.VITE_GAS_API_URL || "https://script.google.com/macros/s/YOUR_GAS_DEPLOYMENT_ID/exec";

// --- Google Form Setup ---
// GitHub公開用マスキング: 実際のGoogleフォームURLを設定してください。
const SURVEY_URL = import.meta.env?.VITE_SURVEY_URL || "https://docs.google.com/forms/d/e/YOUR_GOOGLE_FORM_ID/viewform";
const SURVEY_TEXT = `\n\n📝 アンケートのお願い\n今後のサービス向上のため、簡単なアンケートにご協力をお願いします！\n\n回答はこちらから👇\n${SURVEY_URL}`;

// --- Firebase Setup ---
// GitHub公開用マスキング: リポジトリ公開のため、Firebase認証情報は環境変数からの取得を推奨する形式にしています。
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_FIREBASE_AUTH_DOMAIN",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "YOUR_FIREBASE_PROJECT_ID",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_FIREBASE_MESSAGING_SENDER_ID",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "YOUR_FIREBASE_APP_ID",
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || "YOUR_FIREBASE_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 【変更点】セッションごとに変わる __app_id を使わず、固定のIDを使用
const appId = 'wagtail-shop-master';

// --- Gemini API Setup ---
// GitHub公開用マスキング: APIキー等の機密情報はパブリックリポジトリに含めず、環境変数等で安全に管理してください。
const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || ""; //特定のモデルを指定することで、環境固有の認証スコープを利用するため、apikeyは未定義
const GEMINI_MODEL = import.meta.env?.VITE_GEMINI_MODEL || "CONST_MODEL_ID"; // ※特定の環境でのみ動作する最適化を施しています

const callGemini = async (prompt) => {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    const result = await response.json();
    return result.candidates?.[0]?.content?.parts?.[0]?.text || "AIからの応答がありませんでした。";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "エラーが発生しました。通信状況を確認してください。";
  }
};

// --- 初期データ定義 ---
const INITIAL_INGREDIENTS = [
  { name: 'コーヒー豆', quantity: 2000, unit: 'g', threshold: 500, costPerUnit: 2.5 },
  { name: '牛乳', quantity: 10, unit: '本', threshold: 2, costPerUnit: 180 },
  { name: '食パン', quantity: 10, unit: '斤', threshold: 3, costPerUnit: 250 },
  { name: 'ハム', quantity: 40, unit: '枚', threshold: 10, costPerUnit: 20 },
  { name: 'チーズ', quantity: 50, unit: '枚', threshold: 10, costPerUnit: 30 },
];

const INITIAL_MENU = [];

// --- Helper Components ---
const TabButton = ({ id, icon: Icon, label, activeTab, setActiveTab }) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition-colors w-full ${activeTab === id
      ? 'bg-amber-100 text-amber-900 font-bold'
      : 'text-gray-600 hover:bg-gray-100'
      }`}
  >
    <Icon size={20} />
    <span>{label}</span>
  </button>
);

const NotificationBanner = ({ notification, onClose }) => {
  if (!notification) return null;
  return (
    <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3 text-white transition-all transform animate-in slide-in-from-top-2 ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-600'}`}>
      {notification.type === 'error' ? <AlertTriangle size={20} /> : <Check size={20} />}
      <span className="font-medium text-sm">{notification.message}</span>
      <button onClick={onClose}><X size={16} className="opacity-80 hover:opacity-100" /></button>
    </div>
  );
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function WagtailAppV2() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data States
  const [salesData, setSalesData] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);

  // Analysis & Prediction States
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatedLineMsg, setGeneratedLineMsg] = useState('');

  // Loading States
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSendingLoading, setIsSendingLoading] = useState(false);

  const [demandForecast, setDemandForecast] = useState({});
  const [isForecasting, setIsForecasting] = useState(false);

  // UI States
  const [isAddingIngredient, setIsAddingIngredient] = useState(false);
  const [newIngredient, setNewIngredient] = useState({ name: '', quantity: '', unit: '', threshold: '', costPerUnit: '' });

  const [isAddingMenu, setIsAddingMenu] = useState(false);
  // 【変更】メニュー追加時に割引価格も持てるように修正
  const [newMenu, setNewMenu] = useState({ name: '', price: '', discountPrice: '' });

  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [tempRecipe, setTempRecipe] = useState([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [recipeAmount, setRecipeAmount] = useState('');

  const [editingInfoId, setEditingInfoId] = useState(null);
  // 【変更】メニュー編集時にも割引価格を扱えるように修正
  const [editInfoForm, setEditInfoForm] = useState({ name: '', price: '', discountPrice: '' });

  const [isEditingStock, setIsEditingStock] = useState(false);
  const [editedStock, setEditedStock] = useState({});
  const [isInitializing, setIsInitializing] = useState(false);

  const [deletingId, setDeletingId] = useState(null);
  const [deletingMenuId, setDeletingMenuId] = useState(null);
  const [deletingFeedbackId, setDeletingFeedbackId] = useState(null);
  const [notification, setNotification] = useState(null);

  const [currentAttribute, setCurrentAttribute] = useState({ gender: null, age: null });
  const [selectedMenuForInput, setSelectedMenuForInput] = useState(null);
  // 【追加】売上入力画面での「割引モード」状態
  const [isDiscountMode, setIsDiscountMode] = useState(false);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    setCurrentAttribute({ gender: null, age: null });
    setSelectedMenuForInput(null);
    setIsDiscountMode(false); // タブ切り替え時に割引モードもリセット
  }, [activeTab]);

  // --- Auth & Data Sync ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error) {
        console.error("Anonymous auth failed:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // 1. Sales Data
    const salesQuery = query(collection(db, 'artifacts', appId, 'public', 'data', 'sales'), orderBy('date', 'asc'));
    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSalesData(sales);
    });

    // 2. Ingredients Data
    const ingRef = collection(db, 'artifacts', appId, 'public', 'data', 'ingredients');
    const unsubIng = onSnapshot(ingRef, async (snapshot) => {
      if (snapshot.empty) {
        const batch = writeBatch(db);
        INITIAL_INGREDIENTS.forEach(item => {
          const docRef = doc(ingRef);
          batch.set(docRef, item);
        });
        await batch.commit();
      } else {
        const ing = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setIngredients(ing);
      }
    });

    // 3. Menu Data
    const menuRef = collection(db, 'artifacts', appId, 'public', 'data', 'menu');
    const unsubMenu = onSnapshot(menuRef, async (snapshot) => {
      const menu = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenuItems(menu);
    });

    // 4. Feedback Data
    const feedRef = collection(db, 'feedback');
    const unsubFeed = onSnapshot(feedRef, (snapshot) => {
      const feeds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFeedbacks(feeds);
    });

    return () => {
      unsubSales();
      unsubIng();
      unsubMenu();
      unsubFeed();
    };
  }, [user]);

  // --- Helpers ---
  const calculateCost = (recipe) => {
    if (!recipe || recipe.length === 0) return 0;
    return recipe.reduce((total, item) => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      if (ing && ing.costPerUnit) {
        return total + (ing.costPerUnit * item.amount);
      }
      return total;
    }, 0);
  };

  const checkStockAvailability = (recipe) => {
    if (!recipe || recipe.length === 0) return true;
    return recipe.every(item => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      return ing && ing.quantity >= item.amount;
    });
  };

  // --- Handlers ---

  const handleSendLineMessage = async () => {
    if (!generatedLineMsg) return;

    if (!GAS_API_URL) {
      alert("GASのWebアプリURLが設定されていません。");
      return;
    }

    const messageToSend = generatedLineMsg;
    setGeneratedLineMsg("");
    setIsSendingLoading(true);

    try {
      await fetch(GAS_API_URL, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({ text: messageToSend }),
      });

      setNotification({ type: 'success', message: "LINE送信リクエストを送りました！" });

    } catch (error) {
      console.error("GAS送信エラー:", error);
      setNotification({ type: 'error', message: "送信に失敗しました" });
      setGeneratedLineMsg(messageToSend);
    } finally {
      setIsSendingLoading(false);
    }
  };

  const handleInsertSurvey = () => {
    setGeneratedLineMsg(prev => prev + SURVEY_TEXT);
    setNotification({ type: 'success', message: "アンケートリンクを挿入しました" });
  };

  // 【変更】売上確定時の価格ロジック修正
  const handleConfirmSale = async () => {
    if (!selectedMenuForInput) return;
    const item = selectedMenuForInput;

    // 割引モードかつ割引価格が設定されている場合は、割引価格を売上として採用
    const finalPrice = (isDiscountMode && item.discountPrice) ? Number(item.discountPrice) : Number(item.price);

    if (!currentAttribute.gender || !currentAttribute.age) {
      setNotification({ type: 'error', message: "性別と年代を選択してください" });
      return;
    }

    if (!checkStockAvailability(item.recipe)) {
      setNotification({ type: 'error', message: "原材料が不足しています" });
      return;
    }

    try {
      const batch = writeBatch(db);

      if (item.recipe && item.recipe.length > 0) {
        item.recipe.forEach(recipeItem => {
          const ing = ingredients.find(i => i.id === recipeItem.ingredientId);
          if (ing) {
            const ingRef = doc(db, 'artifacts', appId, 'public', 'data', 'ingredients', ing.id);
            const newQuantity = ing.quantity - recipeItem.amount;
            batch.update(ingRef, { quantity: newQuantity });
          }
        });
      }

      const cost = calculateCost(item.recipe);
      const profit = finalPrice - cost; // 利益計算も最終価格ベースで

      const salesRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'sales'));
      batch.set(salesRef, {
        date: new Date().toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' }),
        location: '現在地(公園B)',
        weather: '晴れ',
        temp: 22,
        sales: finalPrice, // 割引適用後の価格
        cost: cost,
        profit: profit,
        customers: 1,
        itemName: item.name,
        isDiscounted: isDiscountMode && !!item.discountPrice, // 割引フラグ
        attributeGender: currentAttribute.gender,
        attributeAge: currentAttribute.age,
        timestamp: serverTimestamp()
      });

      await batch.commit();

      setNotification({ type: 'success', message: `${item.name} を追加しました` });
      setSelectedMenuForInput(null);
      setCurrentAttribute({ gender: null, age: null });
      // isDiscountMode は利便性のため維持しても良いが、リクエストに基づきリセットする場合はここに追加
      // setIsDiscountMode(false); 

    } catch (e) {
      console.error("Error recording sale:", e);
      setNotification({ type: 'error', message: "記録エラー" });
    }
  };

  const handleAddIngredient = async () => {
    if (!newIngredient.name) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'ingredients'), {
        name: newIngredient.name,
        quantity: Number(newIngredient.quantity) || 0,
        unit: newIngredient.unit || '個',
        threshold: Number(newIngredient.threshold) || 0,
        costPerUnit: Number(newIngredient.costPerUnit) || 0
      });
      setNewIngredient({ name: '', quantity: '', unit: '', threshold: '', costPerUnit: '' });
      setIsAddingIngredient(false);
      setNotification({ type: 'success', message: "原材料を追加しました" });
    } catch (e) {
      setNotification({ type: 'error', message: "追加エラー" });
    }
  };

  const handleDeleteIngredient = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'ingredients', id));
      setDeletingId(null);
      setNotification({ type: 'success', message: "削除しました" });
    } catch (e) {
      setNotification({ type: 'error', message: "削除エラー" });
    }
  };

  const handleLoadInitialIngredients = async () => {
    setIsInitializing(true);
    try {
      const batch = writeBatch(db);
      const ingRef = collection(db, 'artifacts', appId, 'public', 'data', 'ingredients');
      INITIAL_INGREDIENTS.forEach(item => {
        const docRef = doc(ingRef);
        batch.set(docRef, item);
      });
      await batch.commit();
      setNotification({ type: 'success', message: "データを読み込みました" });
    } catch (e) {
      setNotification({ type: 'error', message: "読み込み失敗" });
    }
    setIsInitializing(false);
  };

  const handleStartEditStock = () => {
    const currentValues = {};
    ingredients.forEach(item => {
      currentValues[item.id] = item.quantity;
    });
    setEditedStock(currentValues);
    setIsEditingStock(true);
  };

  const handleSaveStock = async () => {
    try {
      const batch = writeBatch(db);
      ingredients.forEach(item => {
        const newVal = parseFloat(editedStock[item.id]);
        if (!isNaN(newVal)) {
          const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'ingredients', item.id);
          batch.update(itemRef, { quantity: newVal });
        }
      });
      await batch.commit();
      setIsEditingStock(false);
      setNotification({ type: 'success', message: "数量を更新しました" });
    } catch (e) {
      setNotification({ type: 'error', message: "更新エラー" });
    }
  };

  // 【変更】メニュー追加時に割引価格も保存
  const handleAddMenu = async () => {
    if (!newMenu.name) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'menu'), {
        name: newMenu.name,
        price: Number(newMenu.price) || 0,
        discountPrice: Number(newMenu.discountPrice) || 0, // 追加
        recipe: []
      });
      setNewMenu({ name: '', price: '', discountPrice: '' });
      setIsAddingMenu(false);
      setNotification({ type: 'success', message: "メニューを追加しました" });
    } catch (e) {
      setNotification({ type: 'error', message: "メニュー追加エラー" });
    }
  };

  const handleDeleteMenu = async (id) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'menu', id));
      setDeletingMenuId(null);
      setNotification({ type: 'success', message: "メニューを削除しました" });
    } catch (e) {
      setNotification({ type: 'error', message: "削除エラー" });
    }
  };

  // 【変更】メニュー編集フォーム初期化時に割引価格もセット
  const handleStartEditMenuInfo = (menu) => {
    setEditingInfoId(menu.id);
    setEditInfoForm({ name: menu.name, price: menu.price, discountPrice: menu.discountPrice || '' });
  };

  // 【変更】メニュー編集保存時に割引価格も更新
  const handleSaveMenuInfo = async (id) => {
    try {
      const menuRef = doc(db, 'artifacts', appId, 'public', 'data', 'menu', id);
      await updateDoc(menuRef, {
        name: editInfoForm.name,
        price: Number(editInfoForm.price),
        discountPrice: Number(editInfoForm.discountPrice) || 0
      });
      setEditingInfoId(null);
      setNotification({ type: 'success', message: "メニュー情報を更新しました" });
    } catch (e) {
      setNotification({ type: 'error', message: "更新エラー" });
    }
  };

  const handleOpenRecipeEditor = (menuItem) => {
    setEditingRecipeId(menuItem.id);
    setTempRecipe(menuItem.recipe || []);
  };

  const handleAddIngredientToRecipe = () => {
    if (!selectedIngredientId || !recipeAmount) return;
    const amount = Number(recipeAmount);
    if (isNaN(amount) || amount <= 0) return;

    const existingIndex = tempRecipe.findIndex(r => r.ingredientId === selectedIngredientId);
    let newRecipe = [...tempRecipe];
    if (existingIndex >= 0) {
      newRecipe[existingIndex].amount = amount;
    } else {
      newRecipe.push({ ingredientId: selectedIngredientId, amount: amount });
    }
    setTempRecipe(newRecipe);
    setSelectedIngredientId('');
    setRecipeAmount('');
  };

  const handleRemoveIngredientFromRecipe = (ingId) => {
    setTempRecipe(tempRecipe.filter(r => r.ingredientId !== ingId));
  };

  const handleSaveRecipe = async () => {
    if (!editingRecipeId) return;
    try {
      const menuRef = doc(db, 'artifacts', appId, 'public', 'data', 'menu', editingRecipeId);
      await updateDoc(menuRef, { recipe: tempRecipe });
      setEditingRecipeId(null);
      setNotification({ type: 'success', message: "レシピを保存しました" });
    } catch (e) {
      setNotification({ type: 'error', message: "保存エラー" });
    }
  };

  const handleDeleteFeedback = async (id) => {
    try {
      await deleteDoc(doc(db, 'feedback', id));
      setDeletingFeedbackId(null);
      setNotification({ type: 'success', message: "削除しました" });
    } catch (e) {
      setNotification({ type: 'error', message: "削除エラー" });
    }
  };

  const handleDemandForecast = async () => {
    setIsForecasting(true);
    const ingredientNames = ingredients.map(i => i.name).join(', ');
    const prompt = `
      キッチンカーの「原材料」の明日の必要量を予測。
      条件: 明日は「曇り」、気温「15℃」。
      リスト: ${ingredientNames}
      出力: JSON形式 {"原材料名": "約XX (理由)"}
    `;
    try {
      const resultText = await callGemini(prompt);
      const jsonString = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      const resultJson = JSON.parse(jsonString);
      setDemandForecast(resultJson);
    } catch (e) {
      setDemandForecast({ error: "予測失敗" });
    }
    setIsForecasting(false);
  };

  const handleGeminiAnalysis = async () => {
    setIsAnalyzing(true);
    const feedbackList = feedbacks.map(f => `${f.comment} (${f.rating}点)`).join('\n');
    const prompt = `キッチンカーの顧客アンケート分析。改善点を3つ提案。${feedbackList}`;
    const result = await callGemini(prompt);
    setAiAnalysis(result);
    setIsAnalyzing(false);
  };

  const handleGenerateLineMessage = async () => {
    setIsAiLoading(true);
    const prompt = `キッチンカーのLINEメッセージ作成。ターゲット:オフィスワーカー。寒くなる予報。作成した本文のみを返して`;
    const result = await callGemini(prompt);
    setGeneratedLineMsg(result);
    setIsAiLoading(false);
  };

  const chartData = useMemo(() => {
    if (salesData.length === 0) return [];
    const grouped = salesData.reduce((acc, curr) => {
      const date = curr.date;
      if (!acc[date]) acc[date] = { date, sales: 0, profit: 0 };
      acc[date].sales += curr.sales;
      acc[date].profit += (curr.profit || 0);
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => a.date.localeCompare(b.date));
  }, [salesData]);

  const attributeData = useMemo(() => {
    const counts = salesData.reduce((acc, curr) => {
      const key = `${curr.attributeAge || '不明'}${curr.attributeGender || ''}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(counts).map(key => ({ name: key, value: counts[key] }));
  }, [salesData]);

  return (
    <div className="flex h-screen bg-gray-50 font-sans text-slate-800">
      <NotificationBanner notification={notification} onClose={() => setNotification(null)} />

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center space-x-2 text-amber-600">
            <ShoppingBag size={28} />
            <h1 className="text-xl font-bold tracking-tight">Cafe Wagtail</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">販売意思決定支援システム</p>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <TabButton id="dashboard" icon={LayoutDashboard} label="ダッシュボード" activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton id="input" icon={TrendingUp} label="売上入力 (現場)" activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton id="ai-analysis" icon={Sparkles} label="AI 戦略分析" activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton id="menu-recipe" icon={Utensils} label="メニュー・レシピ" activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton id="inventory" icon={Box} label="原材料管理" activeTab={activeTab} setActiveTab={setActiveTab} />
          <TabButton id="line-marketing" icon={MessageSquare} label="LINE 連携" activeTab={activeTab} setActiveTab={setActiveTab} />
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center space-x-3 text-sm text-gray-500">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span>DB接続中</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="md:hidden bg-white p-4 border-b flex justify-between items-center sticky top-0 z-10">
          <span className="font-bold text-amber-600">Cafe Wagtail</span>
          <button onClick={() => setActiveTab('dashboard')} className="p-2"><LayoutDashboard size={20} /></button>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {/* --- DASHBOARD VIEW --- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <header className="flex justify-between items-end">
                <div><h2 className="text-2xl font-bold text-gray-800">本日のサマリー</h2></div>
                <div className="text-right hidden sm:block"><p className="text-xs text-gray-400">データ最終更新: たった今</p></div>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div><p className="text-sm text-gray-500">本日の売上</p><h3 className="text-3xl font-bold text-amber-600">¥{salesData.filter(d => d.date === new Date().toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })).reduce((acc, curr) => acc + (curr.sales || 0), 0).toLocaleString()}</h3></div>
                    <TrendingUp className="text-amber-200" size={24} />
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div><p className="text-sm text-gray-500">本日の粗利</p><h3 className="text-3xl font-bold text-blue-600">¥{salesData.filter(d => d.date === new Date().toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })).reduce((acc, curr) => acc + (curr.profit || 0), 0).toLocaleString()}</h3></div>
                    <Wallet className="text-blue-200" size={24} />
                  </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start">
                    <div><p className="text-sm text-gray-500">原材料アラート</p><h3 className="text-xl font-bold text-gray-800">{ingredients.filter(i => i.quantity <= i.threshold).length} 品目</h3></div>
                    <AlertCircle className="text-red-200" size={24} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
                  <h3 className="font-bold text-gray-700 mb-4">売上・利益推移</h3>
                  <ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="sales" stroke="#d97706" /><Line type="monotone" dataKey="profit" stroke="#3b82f6" /></LineChart></ResponsiveContainer>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-80">
                  <h3 className="font-bold text-gray-700 mb-4">顧客属性</h3>
                  <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={attributeData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label>{attributeData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* --- MENU & RECIPE VIEW --- */}
          {activeTab === 'menu-recipe' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <header className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">メニュー・レシピ管理</h2>
                  <p className="text-gray-500">商品と使用する原材料の紐付けを行います。</p>
                </div>
                <button onClick={() => setIsAddingMenu(true)} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-blue-600"><Plus size={16} className="mr-2" /> メニュー追加</button>
              </header>

              {isAddingMenu && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-4">
                  <h3 className="font-bold text-blue-800 mb-3 text-sm">新規メニュー追加</h3>
                  <div className="flex gap-3 mb-3">
                    <input placeholder="商品名" className="p-2 border rounded text-sm flex-1" value={newMenu.name} onChange={e => setNewMenu({ ...newMenu, name: e.target.value })} />
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">定価</span>
                      <input type="number" placeholder="円" className="p-2 border rounded text-sm w-24" value={newMenu.price} onChange={e => setNewMenu({ ...newMenu, price: e.target.value })} />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">割引</span>
                      <input type="number" placeholder="円" className="p-2 border rounded text-sm w-24" value={newMenu.discountPrice} onChange={e => setNewMenu({ ...newMenu, discountPrice: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsAddingMenu(false)} className="text-gray-500 text-sm">キャンセル</button>
                    <button onClick={handleAddMenu} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-bold">追加</button>
                  </div>
                </div>
              )}

              <div className="grid gap-4">
                {menuItems.map(menu => (
                  <div key={menu.id} className={`bg-white rounded-xl border shadow-sm transition-all ${editingRecipeId === menu.id ? 'border-amber-400 ring-2 ring-amber-100' : 'border-gray-200'}`}>
                    <div className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-50">
                      <div className="flex-1">
                        {/* Info Edit Mode */}
                        {editingInfoId === menu.id ? (
                          <div className="flex items-center space-x-2">
                            <input className="border rounded p-1 text-lg font-bold w-1/3" value={editInfoForm.name} onChange={e => setEditInfoForm({ ...editInfoForm, name: e.target.value })} />
                            <div className="flex items-center"><span className="text-gray-500 mr-1 text-xs">定</span><input type="number" className="border rounded p-1 w-20" value={editInfoForm.price} onChange={e => setEditInfoForm({ ...editInfoForm, price: e.target.value })} /></div>
                            <div className="flex items-center"><span className="text-gray-500 mr-1 text-xs">割</span><input type="number" className="border rounded p-1 w-20" value={editInfoForm.discountPrice} onChange={e => setEditInfoForm({ ...editInfoForm, discountPrice: e.target.value })} /></div>
                            <button onClick={() => handleSaveMenuInfo(menu.id)} className="bg-green-500 text-white p-1.5 rounded hover:bg-green-600"><Check size={16} /></button>
                            <button onClick={() => setEditingInfoId(null)} className="bg-gray-200 text-gray-600 p-1.5 rounded hover:bg-gray-300"><X size={16} /></button>
                          </div>
                        ) : (
                          <div>
                            <h3 className="font-bold text-lg text-gray-800 flex items-center">
                              {menu.name}
                              <span className="ml-2 text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">¥{menu.price}</span>
                              {menu.discountPrice > 0 && <span className="ml-2 text-sm font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100"><Tag size={12} className="inline mr-1" />¥{menu.discountPrice}</span>}
                            </h3>
                            <div className="flex items-center mt-1 text-xs text-gray-500">
                              <span className="mr-3">原価: <span className="font-bold text-gray-700">¥{calculateCost(menu.recipe).toLocaleString()}</span></span>
                              <span className="mr-3">粗利: <span className="font-bold text-green-600">¥{(menu.price - calculateCost(menu.recipe)).toLocaleString()}</span></span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 md:mt-0 flex space-x-2">
                        {editingRecipeId === menu.id ? (
                          <button onClick={handleSaveRecipe} className="bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center"><Save size={14} className="mr-1" /> 完了</button>
                        ) : (
                          <>
                            {!editingInfoId && <button onClick={() => handleStartEditMenuInfo(menu)} className="text-gray-400 hover:text-blue-500 p-1.5" title="名前・価格を編集"><Edit3 size={16} /></button>}
                            <button onClick={() => handleOpenRecipeEditor(menu)} className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded text-xs font-bold flex items-center hover:bg-amber-100"><LinkIcon size={14} className="mr-1" /> レシピ編集</button>
                            {deletingMenuId === menu.id ? (
                              <div className="flex items-center space-x-2">
                                <button onClick={() => handleDeleteMenu(menu.id)} className="bg-red-500 text-white text-xs px-2 py-1.5 rounded hover:bg-red-600 font-bold">削除</button>
                                <button onClick={() => setDeletingMenuId(null)} className="bg-gray-200 text-gray-600 text-xs px-2 py-1.5 rounded hover:bg-gray-300"><X size={14} /></button>
                              </div>
                            ) : (
                              <button onClick={() => setDeletingMenuId(menu.id)} className="text-gray-400 hover:text-red-500 p-1.5"><Trash2 size={16} /></button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-b-xl">
                      {editingRecipeId === menu.id ? (
                        <div className="space-y-3">
                          <p className="text-xs text-gray-500 font-bold">原材料を追加:</p>
                          <div className="flex gap-2">
                            <select className="flex-1 p-2 border rounded text-sm" value={selectedIngredientId} onChange={e => setSelectedIngredientId(e.target.value)}>
                              <option value="">原材料を選択...</option>
                              {ingredients.map(ing => <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit}) - ¥{ing.costPerUnit}/{ing.unit}</option>)}
                            </select>
                            <input type="number" placeholder="量" className="w-20 p-2 border rounded text-sm" value={recipeAmount} onChange={e => setRecipeAmount(e.target.value)} />
                            <button onClick={handleAddIngredientToRecipe} className="bg-blue-500 text-white px-3 py-2 rounded text-sm font-bold">追加</button>
                          </div>
                          <div className="mt-3 space-y-1">
                            {tempRecipe.map((r, idx) => {
                              const ing = ingredients.find(i => i.id === r.ingredientId);
                              return (
                                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border border-gray-200 text-sm">
                                  <span>{ing ? ing.name : '不明な原材料'}</span>
                                  <div className="flex items-center"><span className="mr-3 font-bold">{r.amount}{ing?.unit}</span><button onClick={() => handleRemoveIngredientFromRecipe(r.ingredientId)} className="text-red-400 hover:text-red-600"><X size={14} /></button></div>
                                </div>
                              );
                            })}
                            {tempRecipe.length === 0 && <p className="text-xs text-gray-400 text-center py-2">レシピが設定されていません</p>}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">
                          {menu.recipe && menu.recipe.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {menu.recipe.map((r, idx) => {
                                const ing = ingredients.find(i => i.id === r.ingredientId);
                                return (
                                  <span key={idx} className="bg-white border border-gray-200 px-2 py-1 rounded text-xs flex items-center">
                                    <Box size={10} className="mr-1 text-gray-400" />
                                    {ing ? ing.name : '???'} {r.amount}{ing?.unit}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 italic">レシピ未設定 (在庫連動なし)</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* --- INPUT VIEW (Improved Selection Flow) --- */}
          {activeTab === 'input' && (
            <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-500 pb-24">
              <header className="mb-6 text-center">
                <h2 className="text-2xl font-bold text-gray-800">売上入力</h2>
                <div className="mt-2 flex justify-center">
                  <button
                    onClick={() => {
                      setIsDiscountMode(!isDiscountMode);
                      setSelectedMenuForInput(null); // モード切替時に選択解除
                    }}
                    className={`flex items-center px-4 py-2 rounded-full text-sm font-bold transition-all ${isDiscountMode ? 'bg-red-500 text-white shadow-lg ring-2 ring-red-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                  >
                    <Tag size={16} className="mr-2" />
                    {isDiscountMode ? '割引モード ON' : '割引モード OFF'}
                  </button>
                </div>
              </header>

              <div className="space-y-6">
                {/* 1. 属性選択 */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center"><User size={16} className="mr-1" /> 顧客属性</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">性別</label>
                      <div className="flex space-x-2">
                        {['男性', '女性'].map(g => (
                          <button
                            key={g}
                            onClick={() => setCurrentAttribute(prev => ({ ...prev, gender: g }))}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all border ${currentAttribute.gender === g ? 'bg-blue-500 text-white border-blue-500 shadow-md transform scale-105' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">年代</label>
                      <div className="grid grid-cols-4 gap-2">
                        {['10代', '20代', '30代', '40代~'].map(a => (
                          <button
                            key={a}
                            onClick={() => setCurrentAttribute(prev => ({ ...prev, age: a }))}
                            className={`py-2 rounded-lg text-xs font-bold transition-all border ${currentAttribute.age === a ? 'bg-green-500 text-white border-green-500 shadow-md transform scale-105' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. メニュー選択 */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-500 mb-3 flex items-center"><ShoppingBag size={16} className="mr-1" /> 商品選択</h3>
                  {menuItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
                      <p>メニューがありません</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {menuItems.map((item) => {
                        const hasStock = checkStockAvailability(item.recipe);
                        const isSelected = selectedMenuForInput?.id === item.id;
                        // 割引価格の表示ロジック
                        const displayPrice = (isDiscountMode && item.discountPrice) ? item.discountPrice : item.price;
                        const isDiscountApplied = isDiscountMode && !!item.discountPrice;

                        return (
                          <button
                            key={item.id}
                            disabled={!hasStock}
                            className={`
                                                relative flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all 
                                                ${!hasStock ? 'bg-gray-100 border-gray-200 opacity-60 cursor-not-allowed' :
                                isSelected ? 'border-amber-500 bg-amber-50 shadow-md ring-2 ring-amber-200' : 'border-gray-100 hover:border-amber-300 hover:bg-amber-50 bg-white'}
                                            `}
                            onClick={() => setSelectedMenuForInput(item)}
                          >
                            <span className="font-bold text-gray-800">{item.name}</span>
                            <div className="flex items-center mt-1">
                              {isDiscountApplied ? (
                                <>
                                  <span className="text-xs text-gray-400 line-through mr-2">¥{item.price}</span>
                                  <span className="text-sm font-bold text-red-500">¥{displayPrice}</span>
                                </>
                              ) : (
                                <span className="text-sm text-gray-500">¥{displayPrice}</span>
                              )}
                            </div>
                            {isSelected && <div className="absolute top-2 right-2 text-amber-500"><Check size={16} strokeWidth={3} /></div>}
                            {!hasStock && <span className="absolute inset-0 flex items-center justify-center bg-gray-100/80 font-bold text-red-500 rotate-12 text-sm border-2 border-red-500 rounded-lg m-4">材料不足</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. 確定ボタン (Floating Footer) */}
              <div className="fixed bottom-4 left-0 right-0 px-4 md:pl-72 md:pr-8">
                <button
                  onClick={handleConfirmSale}
                  disabled={!selectedMenuForInput || !currentAttribute.gender || !currentAttribute.age}
                  className={`
                           w-full py-4 rounded-xl shadow-xl flex items-center justify-center text-lg font-bold transition-all
                           ${(!selectedMenuForInput || !currentAttribute.gender || !currentAttribute.age)
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-orange-600 text-white hover:shadow-2xl hover:scale-[1.02]'}
                       `}
                >
                  <ShoppingCart className="mr-2" />
                  売上を追加する
                </button>
              </div>
            </div>
          )}

          {/* --- INGREDIENTS VIEW (Updated with Cost) --- */}
          {activeTab === 'inventory' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <header className="flex flex-col md:flex-row justify-between items-center">
                <div className="mb-4 md:mb-0">
                  <h2 className="text-2xl font-bold text-gray-800">原材料管理</h2>
                  <p className="text-gray-500">棚卸し結果と仕入れ価格の管理。</p>
                </div>
                <div className="flex space-x-2">
                  {!isAddingIngredient && !isEditingStock && (
                    <button onClick={() => setIsAddingIngredient(true)} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-600 flex items-center shadow-sm"><Plus size={16} className="mr-2" /> 追加</button>
                  )}
                  {isEditingStock ? (
                    <>
                      <button onClick={() => setIsEditingStock(false)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 flex items-center"><X size={16} className="mr-2" /> キャンセル</button>
                      <button onClick={handleSaveStock} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-600 flex items-center"><Save size={16} className="mr-2" /> 保存</button>
                    </>
                  ) : !isAddingIngredient && (
                    <button onClick={handleStartEditStock} className="bg-white border text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 flex items-center"><RefreshCw size={16} className="mr-2" /> 編集</button>
                  )}
                  <button onClick={handleDemandForecast} disabled={isForecasting} className="bg-amber-100 text-amber-800 px-4 py-2 rounded-lg text-sm font-bold flex items-center hover:bg-amber-200"><CloudSun className="mr-2" size={16} /> 予測</button>
                </div>
              </header>

              {isAddingIngredient && (
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-4 animate-in fade-in slide-in-from-top-2">
                  <h3 className="font-bold text-blue-800 mb-3 text-sm">新規原材料の追加</h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-3">
                    <input placeholder="原材料名" className="p-2 border rounded text-sm md:col-span-2" value={newIngredient.name} onChange={e => setNewIngredient({ ...newIngredient, name: e.target.value })} />
                    <input type="number" placeholder="数量" className="p-2 border rounded text-sm" value={newIngredient.quantity} onChange={e => setNewIngredient({ ...newIngredient, quantity: e.target.value })} />
                    <input placeholder="単位" className="p-2 border rounded text-sm" value={newIngredient.unit} onChange={e => setNewIngredient({ ...newIngredient, unit: e.target.value })} />
                    <input type="number" placeholder="単価(円)" className="p-2 border rounded text-sm" value={newIngredient.costPerUnit} onChange={e => setNewIngredient({ ...newIngredient, costPerUnit: e.target.value })} />
                    <input type="number" placeholder="閾値" className="p-2 border rounded text-sm" value={newIngredient.threshold} onChange={e => setNewIngredient({ ...newIngredient, threshold: e.target.value })} />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setIsAddingIngredient(false)} className="text-gray-500 text-sm hover:text-gray-700 px-3">キャンセル</button>
                    <button onClick={handleAddIngredient} className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-blue-700">追加する</button>
                  </div>
                </div>
              )}

              {ingredients.length === 0 && !isAddingIngredient && (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl mb-6">
                  <Database size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 mb-4">原材料データがありません</p>
                  <button onClick={() => { if (window.confirm("サンプルデータを入れますか？")) handleLoadInitialIngredients() }} disabled={isInitializing} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-gray-200 inline-flex items-center">
                    {isInitializing ? <Loader2 className="animate-spin mr-2" size={16} /> : <RefreshCw className="mr-2" size={16} />}
                    サンプルデータを読み込む
                  </button>
                </div>
              )}

              {ingredients.length > 0 && (
                <div className="bg-white overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">原材料名</th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-32">現在量</th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">単位 / 単価</th>
                        <th className="px-3 py-3.5 text-left text-sm font-semibold text-indigo-700 bg-indigo-50">AI 消費予測 (明日)</th>
                        <th className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {ingredients.map((item) => (
                        <tr key={item.id}>
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">{item.name}</td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {isEditingStock ? (
                              <input type="number" className="w-24 p-1 border rounded text-right" value={editedStock[item.id] || 0} onChange={(e) => setEditedStock({ ...editedStock, [item.id]: e.target.value })} />
                            ) : (
                              <span className={`font-bold ${item.quantity <= item.threshold ? 'text-red-600' : 'text-gray-700'}`}>{item.quantity}</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {item.unit} <span className="text-gray-400 ml-1">(@¥{item.costPerUnit})</span>
                          </td>
                          <td className="px-3 py-4 text-sm text-gray-600 bg-indigo-50/30">{demandForecast[item.name] ? <span className="font-bold text-indigo-700">{demandForecast[item.name]}</span> : <span className="text-gray-400 text-xs">-</span>}</td>
                          <td className="px-3 py-4 text-right text-sm">
                            {deletingId === item.id ? (
                              <div className="flex items-center justify-end space-x-2">
                                <button onClick={() => handleDeleteIngredient(item.id)} className="bg-red-500 text-white text-xs px-2 py-1 rounded hover:bg-red-600">削除</button>
                                <button onClick={() => setDeletingId(null)} className="bg-gray-200 text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-300"><X size={12} /></button>
                              </div>
                            ) : (
                              <button onClick={() => setDeletingId(item.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* --- AI ANALYSIS VIEW --- */}
          {activeTab === 'ai-analysis' && (
            <div className="max-w-4xl mx-auto animate-in fade-in duration-500">
              <header className="mb-6"><h2 className="text-2xl font-bold text-gray-800 flex items-center"><Sparkles className="text-purple-500 mr-2" /> 顧客評価と改善提案</h2></header>
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-xl border border-indigo-100 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-indigo-900">AI コンサルタント</h3>
                  <button onClick={handleGeminiAnalysis} disabled={isAnalyzing} className="bg-indigo-600 text-white px-4 py-2 rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50 flex items-center">{isAnalyzing ? <Loader2 className="animate-spin mr-2" /> : <ClipboardList className="mr-2" />} 分析</button>
                </div>
                {aiAnalysis ? <div className="prose bg-white p-6 rounded-lg">{aiAnalysis}</div> : <div className="text-center text-gray-400">分析ボタンを押してください</div>}
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h4 className="font-bold text-gray-700 mb-3 flex items-center"><User size={18} className="mr-2" /> 最新の顧客フィードバック</h4>
                <ul className="space-y-3 text-sm">
                  {feedbacks.map(f => (
                    <li key={f.id} className="flex items-start justify-between space-x-2 p-2 bg-gray-50 rounded hover:bg-gray-100 transition-colors group">
                      <div className="flex items-start space-x-2">
                        <span className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${f.rating >= 4 ? 'bg-green-500' : f.rating <= 2 ? 'bg-red-500' : 'bg-yellow-500'}`}></span>
                        <div>
                          <p className="font-medium">{f.comment}</p>
                          <p className="text-xs text-gray-400">{f.user} / ★{f.rating} / {f.date}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                  {feedbacks.length === 0 && <p className="text-gray-400 italic text-center">まだフィードバックがありません。</p>}
                </ul>
              </div>
            </div>
          )}

          {/* --- LINE MARKETING VIEW --- */}
          {activeTab === 'line-marketing' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in duration-500">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4">メッセージ作成 & 配信</h3>

                <div className="flex space-x-3 mb-4">
                  <button onClick={handleGenerateLineMessage} disabled={isAiLoading} className="bg-gray-100 text-gray-700 px-4 py-2 rounded flex items-center hover:bg-gray-200">
                    {isAiLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : <Sparkles className="mr-2" size={16} />}
                    AIで作成
                  </button>

                  <button
                    onClick={handleInsertSurvey}
                    className="bg-blue-500 text-white px-4 py-2 rounded flex items-center hover:bg-blue-600 font-bold shadow-sm"
                  >
                    <ClipboardList className="mr-2" size={16} />
                    アンケート挿入
                  </button>

                  <button
                    onClick={handleSendLineMessage}
                    disabled={!generatedLineMsg || isSendingLoading}
                    className={`
                        bg-green-600 text-white px-4 py-2 rounded flex items-center hover:bg-green-700 font-bold shadow-sm 
                        disabled:opacity-50 disabled:cursor-not-allowed
                      `}
                  >
                    <Send className="mr-2" size={16} />
                    {isSendingLoading ? "送信中..." : "一斉配信 (GAS)"}
                  </button>
                </div>

                <textarea
                  className="w-full h-32 p-3 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none resize-none"
                  value={generatedLineMsg}
                  onChange={(e) => setGeneratedLineMsg(e.target.value)}
                  placeholder="ここにメッセージを入力..."
                />
                <p className="text-xs text-gray-400 mt-2 text-right">※「一斉配信」はLINE公式アカウントの友だち全員に届きます。</p>
              </div>

              {/* 右側：スマホプレビュー */}
              <div className="flex justify-center items-center">
                <div className="border-4 border-gray-800 rounded-3xl overflow-hidden bg-white h-[600px] w-[320px] shadow-2xl relative flex flex-col">
                  <div className="absolute top-0 left-0 w-full h-6 bg-gray-800 z-20 flex justify-center"><div className="w-20 h-4 bg-black rounded-b-xl"></div></div>
                  <div className="bg-[#2a3745] text-white pt-8 pb-3 px-4 shadow-sm z-10"><div className="flex items-center text-sm font-bold"><span className="mr-3 text-lg">＜</span><span>Cafe Wagtail 公式</span></div></div>
                  <div className="flex-1 bg-[#7294c2] p-4 overflow-y-auto">
                    {generatedLineMsg && (
                      <div className="flex items-start mb-4">
                        <div className="w-10 h-10 rounded-full bg-white mr-2 flex-shrink-0 border border-gray-300 flex items-center justify-center overflow-hidden"><img src="https://placehold.co/40x40/orange/white?text=CW" alt="icon" className="w-full h-full object-cover" /></div>
                        <div className="bg-white p-3 rounded-2xl rounded-tl-none text-sm text-gray-800 shadow-sm max-w-[75%] whitespace-pre-wrap leading-relaxed">{generatedLineMsg}</div>
                      </div>
                    )}
                    {!generatedLineMsg && <div className="text-center text-white/50 text-xs mt-10">ここにプレビューが表示されます</div>}
                  </div>
                  <div className="bg-white border-t border-gray-200 p-2 flex items-center justify-around text-gray-400 text-xs">
                    <div className="flex flex-col items-center"><div className="w-6 h-6 bg-gray-200 rounded mb-1"></div>ホーム</div>
                    <div className="flex flex-col items-center text-gray-800"><div className="w-6 h-6 bg-gray-800 rounded mb-1"></div>トーク</div>
                    <div className="flex flex-col items-center"><div className="w-6 h-6 bg-gray-200 rounded mb-1"></div>VOOM</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}