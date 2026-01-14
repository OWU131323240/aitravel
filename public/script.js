const form = document.getElementById("travelForm");
const resultDiv = document.getElementById("result");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  resultDiv.textContent = "あなたにぴったりの旅行プランを考え中…✈️";

  const formData = new FormData(form);
  // フォームの全データを取得し、どのエリアが選択されたか明示的に追加します。
  // これにより、バックエンドがユーザーの選択を確実に認識できるようになります。
  const data = Object.fromEntries(formData.entries()); 
  // 'area' はHTMLの <select> や <input> の name属性に合わせてください。
  data.area = formData.get('area'); 

  try {
    const res = await fetch("/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
      throw new Error(`APIエラー: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();

    // APIからの応答がネストされたJSON文字列か、直接のオブジェクトかを判断して処理
    let content;
    if (typeof json.output_text === 'string') {
      try {
        content = JSON.parse(json.output_text);
      } catch (parseError) {
        throw new Error("APIからの応答データの解析に失敗しました。");
      }
    } else {
      content = json;
    }

    // 診断結果の表示
    const style = content.style || "不明";
    const description = content.description || "詳細情報はありません。";
    const mainRecommendation = content.main_recommendation || {};
    const otherRecommendations = content.other_recommendations || [];

    let recommendationsHTML = "";
    if (mainRecommendation.place) {
      recommendationsHTML += `<h3>一番のおすすめ：${mainRecommendation.place}</h3>
<p>${mainRecommendation.plan || ""}</p>`;
    }
    if (otherRecommendations.length > 0) {
      recommendationsHTML += `<h4>その他のおすすめ</h4>
<ul>${otherRecommendations.map(r => `<li>${r}</li>`).join("")}</ul>`;
    }

    resultDiv.innerHTML = `<h2>診断結果: ${style}</h2>
<p>${description}</p>
${recommendationsHTML}`;
  } catch (err) {
    console.error(err);
    let errorMessage = "エラーが発生しました。";

    if (err instanceof Error) {
      if (err.message.startsWith("APIエラー:") || err.message === "APIからの応答データの解析に失敗しました。") {
        errorMessage = err.message; // APIからの特定のエラーメッセージを表示
      } else if (err.name === "TypeError" && err.message === "Failed to fetch") {
        errorMessage = "サーバーに接続できませんでした。サーバーが起動しているか、ネットワーク接続を確認してください。";
      }
    }
    resultDiv.textContent = errorMessage;
  }
});
