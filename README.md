# Wagtail_app
Gemini CanvasネイティブなAI搭載・販売意思決定支援ダッシュボード

## コンセプト: Canvas-Native App
本プロジェクトは、**Gemini Canvas（Artifacts）環境内で動作することを前提に設計された、AIネイティブなWebアプリケーション**です。
従来のローカルホストやVPSへのデプロイをあえて捨て、Googleのサービススコープ内で完結させることで、以下のメリットを実現しています。

- **Zero-Deployment (ゼロ・デプロイメント):** サーバー構築や環境構築の手間が一切不要。ソースコードをGeminiに渡すだけで、即座にダッシュボードが起動します。
- **Secure AI Integration (セキュアなAI統合):** LLMへの特権的アクセスをCanvas内部のコンテキストに依存しているため、ソースコード上にAPIキー等の秘匿情報を記述する必要がなく、漏洩リスクを根本から排除しています。
- **Frontend-Aggregated Optimization (フロントエンド集約型の最適化):** 通常はバックエンドに隠蔽すべきロジックも、Canvasというセキュアなサンドボックス内で動く特性を活かし、あえてフロントエンドに集約して高速なプロトタイピングを実現しています。

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

    subgraph Canvas ["Gemini Chat (canvas) / Geminiアプリ内 (Googleサービス内)"]
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
                API_AI["Gemini API Fetcher"]
                API_LINE["LINE GAS Fetcher"]
            end

            %% UIと状態の連携
            UI1 & UI2 & UI3 <--> State
            State <--> DB_Sync

            %% UIからAPI呼び出し (ワンショット)
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

    subgraph Gemini ["Google AI (Gemini API)"]
        Model["Gemini Model\n(2.5-Flash-preview等)"]
    end
    class Gemini orangeBox

    subgraph CustomerTouch ["顧客タッチポイント (外部連携)"]
        direction LR
        GAS_LINE["GAS\n(LINE Messaging API)"]
        LINEApp["LINEアプリ"]
        User(("顧客"))
        GForm["Googleフォーム\n(アンケート)"]
        GAS_Form["GAS\n(form-to-firestore.gs)"]
        
        GAS_LINE -->|"プッシュ配信"| LINEApp
        LINEApp -->|"閲覧・来店"| User
        User -->|"回答入力"| GForm
        GForm -->|"Webhook"| GAS_Form
    end
    class CustomerTouch greenBox

    %% コンポーネント間の結線
    Logic -.->|"匿名ログイン"| Auth
    DB_Sync <-->|"WebSocket\n(onSnapshot)"| DB
    GAS_Form -->|"データ格納\n(自動整形)"| DB

    API_AI <-->|"HTTP POST\n(プロンプト ↔ JSON/テキスト)"| Model
    API_LINE -->|"HTTP POST (no-cors)"| GAS_LINE

    %% 特権アクセスの注釈
    Note["Geminiチャット内(Canvas)で動作するため、\nAPIキーレスでGeminiに特権的アクセス"]:::noteStyle
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
