# Wagtail_app
Gemini CanvasネイティブなAI搭載・販売意思決定支援ダッシュボード

## コンセプト: Canvas-Native App
本プロジェクトは、**Gemini Canvas（Artifacts）環境内で動作することを前提に設計された、AIネイティブなWebアプリケーション**です。
従来のローカルホストやVPSへのデプロイをあえて捨て、Googleのサービススコープ内で完結させることで、以下のメリットを実現しています。

- **Cross-Device & Zero-Cost (クロスデバイスと運用コストゼロ):**
  フロントエンド（UI）をCanvas内に留めることで、アプリストアへの申請やサーバーのホスティング費用を完全にゼロに抑えています。Geminiアプリにログインできる環境さえあれば、PC・スマホ・タブレットのデバイスの壁を越えて、いつでもどこでも同じアプリ環境にアクセス可能です。
- **Persistent State (揮発性サンドボックスの克服):**
  Canvas環境特有の「セッション終了時にデータがリセットされる」というサンドボックスの課題を、外部のFirebase（BaaS）にデータをリアルタイムで永続化・同期することで解決しました。これにより、Canvasを「使い捨てのプレビュー画面」ではなく「実運用可能なフロントエンド」として昇華させています。
- **Secure AI Integration (セキュアなAI統合):** 通常のWebアプリでAIを組み込む場合、フロントエンドやバックエンドにAPIキーを持たせる必要があります。しかし本アプリは、Gemini Canvas環境自体が持つ「親セッションとのコンテキスト共有機能」をハックして利用しています。これにより、ソースコード内のAPIキーを空欄にしたままでも、Canvas環境を介して直接AI処理（データに基づく顧客分析など）を実行できます。秘匿情報を一切記述する必要がないため、APIキー漏洩のリスクが根本から存在しません。
- **Frontend-Aggregated Optimization (フロントエンド集約型の最適化):** 通常はバックエンドに隠蔽すべきロジックも、Canvasというセキュアなサンドボックス内で動く特性を活かし、あえてフロントエンドに集約して高速なプロトタイピングを実現しています。

---

## 開発背景とAIの役割（AI-Assisted Development）
本プロジェクトのソースコードおよびアーキテクチャの具体化にあたっては、**生成AI（LLM）を全面的に活用したコーディングおよび設計支援**を受けています。

- **協調的アーキテクチャ設計:** インフラコストや手軽さを考慮し、バックエンドに「Google Apps Script (GAS)」と「Firebase」を組み合わせるという大枠の技術選定は人間側のアイデアに基づいています。一方で、それらをCanvas環境下で破綻なくリアルタイムに紐づけるための具体的なデータフロー、認証仕様、および通信ロジックの設計にはAIの提案が深く反映されています。
- **AI主導のコーディング:** フロントエンド（React）からバックエンド（GAS）に至る具体的な実装コードは、生成AIとの対話を通じて出力・最適化されたものです。

---

## 実行方法 (Gemini Canvas推奨)
このアプリの真価はGemini環境で発揮されます。以下の手順で、どなたでも一瞬で環境を構築・実行できます。

1. Gemini（Advanced等）を開き、Proモードや思考モードを有効化し、ツールからCanvasを選択します。
2. 本リポジトリの `src/Wagtail_app_v2.jsx` のコードをコピーします。（※コードをペーストする際、一度に1000行分送るとフリーズする可能性があるため、約500行ずつ2回に分割してペーストするとスムーズに送信できます。）
3. 以下のプロンプトと一緒にGeminiに送信してください。

#### 実行プロンプト

````text
【以下プロンプト】
- 以下のReactコードをCanvas（プレビュー）で実行して表示してください。

【実行環境の条件】
- Tailwind CSS を使用
- アイコンに 'lucide-react' を使用
- グラフ描画に 'recharts' を使用
- Firebase ('firebase/app', 'firebase/auth', 'firebase/firestore') を使用
- 単一のAppコンポーネントとして描画すること

【コード】
// ここに Wagtail_app_v2.jsx のコードをすべて貼り付ける

````
---
## 初期セットアップ (環境変数・外部連携)
本リポジトリのコードはセキュリティを考慮し、各種APIキーやトークンをプレースホルダー化、またはGASの機能で秘匿化しています。実環境で動作させる場合は、以下の設定を行ってください。

### 1. フロントエンド (src/Wagtail_app_v2.jsx)
Firebaseの接続情報および外部APIのURLを、コード内のプレースホルダー（`YOUR_FIREBASE_API_KEY` 等）にご自身のプロジェクトの値を設定してください。

### 2. バックエンド：LINE中継用GAS (gas/line-bridge.gs)
`LINE_ACCESS_TOKEN` の変数に、ご自身のLINE Developersコンソールから発行した長期チャネルアクセストークンを設定してください。
*(※実運用ではソースコードへの直書きを避け、後述のスクリプトプロパティ等を利用してセキュアに管理することを推奨します)*

### 3. バックエンド：Googleフォーム連携用GAS (gas/form-to-firestore.gs)
このスクリプトはセキュリティのため、認証情報をコード内に記述しない設計になっています。
GASの「設定（歯車マーク）」>「スクリプトプロパティ」に、以下の3つのプロパティ名（Key）と値を登録してください。

| プロパティ名 (Key) | 設定する値 (Value) |
| :--- | :--- |
| `FIREBASE_EMAIL` | Firebaseのサービスアカウントのクライアントメールアドレス |
| `FIREBASE_KEY` | Firebaseのプライベートキー（`-----BEGIN PRIVATE KEY-----\n...`） |
| `FIREBASE_PROJECT_ID` | FirebaseのプロジェクトID |

また、Googleフォーム側の設定で「フォーム送信時」をトリガーとしたイベント駆動設定（`onFormSubmit` 関数の実行設定）を有効にしてください。

---
## System Architecture
システム全体のデータ循環と、Canvasを中心としたアーキテクチャ設計です。

```mermaid
flowchart LR
    %% スタイル定義
    classDef pinkBox fill:#fff0f5,stroke:#ff00ff,stroke-width:2px
    classDef blueBox fill:#f0f8ff,stroke:#0066cc,stroke-width:2px
    classDef orangeBox fill:#fff5e6,stroke:#ff8c00,stroke-width:2px
    classDef greenBox fill:#f0fff0,stroke:#00cc00,stroke-width:2px
    classDef noteStyle fill:#ffffff,stroke:#ff00ff,stroke-width:2px,stroke-dasharray: 5 5,color:#ff00ff

    subgraph Canvas ["Gemini Chat (canvas) / 実行環境"]
        subgraph Logic ["アプリロジック (React)"]
            direction TB
            subgraph StateGroup ["状態管理・UIコンポーネント"]
                State["Local State\n(Zustand / useState)"]
                UI1["売上入力 / AI分析"]
                UI2["メニュー / 原材料管理"]
                UI3["LINEメッセージ作成"]
            end

            subgraph NetworkGroup ["通信レイヤー"]
                DB_Sync["Firestoreリスナー\n(リアルタイム同期)"]
                API_AI["Gemini API Fetcher\n(Canvasコンテキスト利用)"]
                API_LINE["LINE GAS Fetcher"]
            end

            UI1 & UI2 & UI3 <--> State
            State <--> DB_Sync

            UI1 -->|"分析指示"| API_AI
            UI2 -->|"需要予測指示"| API_AI
            UI3 -->|"文面生成指示"| API_AI
            UI3 -->|"送信実行"| API_LINE
        end
    end
    class Canvas pinkBox
    class Logic blueBox

    subgraph Firebase ["データベース Firebase (BaaS)"]
        direction TB
        DB[("Firestore (Database)\n- sales\n- ingredients\n- menu\n- feedback")]
        Auth["Auth\n(Anonymous 認証)"]
    end
    class Firebase blueBox

    subgraph BackendGAS ["バックエンド中継層 (GAS)"]
        direction TB
        GAS_LINE["LINE中継GAS\n(line-bridge.gs)"]
        GAS_Form["フォーム連携GAS\n(form-to-firestore.gs)"]
    end
    class BackendGAS blueBox

    subgraph Gemini ["Google AI (Gemini)"]
        Model["Gemini Model\n(Canvasネイティブ接続)"]
    end
    class Gemini orangeBox

    subgraph CustomerTouch ["外部連携・顧客タッチポイント"]
        direction LR
        LINEApp["LINEアプリ"]
        User(("顧客"))
        GForm["Googleフォーム\n(アンケート)"]
        
        LINEApp -->|"閲覧・来店"| User
        User -->|"回答入力"| GForm
    end
    class CustomerTouch greenBox

    %% コンポーネント間の結線
    Logic -.->|"匿名ログイン"| Auth
    DB_Sync <-->|"WebSocket (onSnapshot)"| DB
    
    %% GAS経由のデータ・API処理
    API_LINE -->|"HTTP POST (サーバーレス呼出)"| GAS_LINE
    GAS_LINE -->|"プッシュ配信"| LINEApp
    GForm -->|"Webhook"| GAS_Form
    GAS_Form -->|"データ永続化"| DB

    %% Canvasを介したAI連携
    API_AI <-->|"セッションコンテキスト通信"| Model

    %% 特権アクセスの注釈
    Note["Canvas内で動作するため、\nソースコードにAPIキーを記述せず\n安全にAI機能と連携"]:::noteStyle
    Canvas -.- Note
    Note -.- Gemini
```
## ディレクトリ構成
本リポジトリは「関心の分離」に基づき、フロントエンド（UI/状態管理）とバックエンド（外部サービス中継）を分割しています。
````text
Cafe-Wagtail/
├── README.md                  # 本ドキュメント
├── src/                       
│   └── Wagtail_app_v2.jsx     # メインロジック (React / Tailwind / Firebase)
└── gas/                       
    ├── line-bridge.gs         # LINE Messaging API 中継用サーバーレス関数
    └── form-to-firestore.gs   # Googleフォーム回答のFirestore格納ロジック
````
## 技術スタック
````text
Frontend: React (Vite / Canvas Environment), Tailwind CSS, Lucide React, Recharts
Backend / BaaS: Firebase (Firestore, Auth), Google Apps Script (GAS)
AI / LLM: Google Gemini API (Prompt Engineering, JSON Parsing)
External API: LINE Messaging API
````
## 今後の展望
- **トランザクション処理の強化:** 現在の在庫減少ロジックにおける競合状態 (Race Condition) を防ぐため、Firestore の increment 関数を用いたアトミックな更新処理への移行。
- **セキュリティルールの厳格化:** 公開環境での堅牢性を高めるため、Firestore の firestore.rules の実装。
## License
This project is licensed under the MIT License.
