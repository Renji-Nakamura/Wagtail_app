function onFormSubmit(e) {
  var itemResponses = e.response.getItemResponses();
  var formData = {};
  
  for (var i = 0; i < itemResponses.length; i++) {
    var question = itemResponses[i].getItem().getTitle();
    var answer = itemResponses[i].getResponse();
    
    // 【改良点】回答が複数選択(配列)だった場合、カンマ区切りの文字列に変換する
    // 例: ["SNS", "友人"] → "SNS, 友人"
    if (Array.isArray(answer)) {
      answer = answer.join(", ");
    }
    
    // キーワード判定
    if (question.indexOf("性別") > -1) formData.gender = answer;
    if (question.indexOf("年代") > -1) formData.age = answer;
    if (question.indexOf("満足度") > -1) formData.rating = parseInt(answer);
    // 「改善」という言葉が含まれていたらコメントとして扱う
    if (question.indexOf("改善") > -1) formData.comment = answer;
  }

  // 必須項目が空の場合のデフォルト値設定
  var today = new Date();
  var dateStr = Utilities.formatDate(today, "Asia/Tokyo", "yyyy/MM/dd");
  
  var docData = {
    // ユーザー名は「30代女性」のように結合して作る
    user: (formData.age || "不明") + (formData.gender || "不明"),
    rating: formData.rating || 3,
    comment: formData.comment || "（特になし）",
    date: dateStr,
    timestamp: new Date()
  };

  saveToFirestore(docData);
}

function saveToFirestore(data) {
  // スクリプトプロパティから設定値を読み込む
  var email = PropertiesService.getScriptProperties().getProperty("FIREBASE_EMAIL");
  // 鍵の改行コード(\n)を正しく変換して読み込む
  var key = PropertiesService.getScriptProperties().getProperty("FIREBASE_KEY").replace(/\\n/g, '\n');
  var projectId = PropertiesService.getScriptProperties().getProperty("FIREBASE_PROJECT_ID");

  var firestore = FirestoreApp.getFirestore(email, key, projectId);
  
  // 'feedback' コレクションに保存
  firestore.createDocument("feedback", data);
}
