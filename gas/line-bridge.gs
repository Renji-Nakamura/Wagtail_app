// 【設定】LINEチャネルアクセストークン（長期）
// GASエディタの「プロジェクトの設定」>「スクリプト プロパティ」で
// LINE_ACCESS_TOKEN という名前で実際のトークンを設定してください。
const LINE_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty("LINE_ACCESS_TOKEN");

// ブラウザでアクセスした時に動く関数（これを追加！）
function doGet(e) {
  return ContentService.createTextOutput("GASサーバーは正常に稼働しています。");
}

// Reactアプリからデータが送られてきた時に動く関数
function doPost(e) {
  try {
    const jsonString = e.postData.contents;
    const data = JSON.parse(jsonString);
    const messageText = data.text;

    const url = "https://api.line.me/v2/bot/message/broadcast";
    
    UrlFetchApp.fetch(url, {
      "method": "post",
      "headers": {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + LINE_ACCESS_TOKEN
      },
      "payload": JSON.stringify({
        "messages": [{ "type": "text", "text": messageText }]
      })
    });

    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    console.error("Error:", error);
    return ContentService.createTextOutput("Error: " + error.toString()).setMimeType(ContentService.MimeType.TEXT);
  }
}