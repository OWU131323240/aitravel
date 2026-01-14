import express from "express";
import fs from "fs";
import path from "path";
import fetch, { FetchError } from "node-fetch";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 8080;
const MAX_RETRIES = 3; // 最大リトライ回数
// LLM設定
const PROVIDER = "openai";  // 'gemini' or 'openai'
// const MODEL = "gemini-1.5-flash";  // Geminiモデル
// const API_KEY = process.env.GEMINI_API_KEY;  // .env にセット

// OpenAI設定例
const MODEL = "gpt-4o"; // OpenAIモデル
const API_KEY = process.env.OPENAI_API_KEY; // .env にセット

app.use(express.static("public"));
app.use(bodyParser.json());

// 指定された時間待機するヘルパー関数
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


// 汎用WebAPIエンドポイント
app.post("/api/", async (req, res) => {
  try {
    const promptTemplate = fs.readFileSync(path.join("./prompt.md"), "utf8");
    // 変数置換
    let prompt = promptTemplate;
    for (const key in req.body) {
      const re = new RegExp(`\\$\\{${key}\\}`, "g");
      prompt = prompt.replace(re, req.body[key]);
    }

    let response;
    for (let i = 0; i < MAX_RETRIES; i++) {
      if (PROVIDER === 'gemini') {
        // Gemini API呼び出し (generateContentエンドポイントを使用)
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              response_mime_type: "application/json",
            }
          })
        });
      } else if (PROVIDER === 'openai') {
        // OpenAI API呼び出し
        const url = 'https://api.openai.com/v1/chat/completions';
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [{ role: 'user', content: prompt }],
                // OpenAIでJSON出力を強制する場合
                response_format: { type: "json_object" }
            })
        });
      } else {
        return res.status(500).json({ error: `Invalid PROVIDER: ${PROVIDER}` });
      }

      if (response.ok) {
        break; // 成功したらループを抜ける
      }

      if (response.status === 429 && i < MAX_RETRIES - 1) {
        const waitTime = Math.pow(2, i) * 1000 + Math.random() * 1000; // 指数関数的バックオフ + ジッター
        console.log(`Rate limit hit. Retrying in ${waitTime.toFixed(2)}ms... (Attempt ${i + 1}/${MAX_RETRIES})`);
        await delay(waitTime);
      } else {
        // 429でも最後のリトライだった場合、または他のエラーの場合はループを抜ける
        break;
      }
    }

    if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `API Error (${PROVIDER}): ${response.statusText}`;

        // リトライを使い果たしても429エラーだった場合、専用のメッセージを返す
        if (response.status === 429) {
            errorMessage = `API rate limit exceeded. Please wait a moment and try again. (All ${MAX_RETRIES} retries failed)`;
        }
        
        return res.status(response.status).json({ error: errorMessage, details: errorText });
        }

    const apiResponse = await response.json();
    let outputText;

    if (PROVIDER === 'gemini') {
      outputText = apiResponse.candidates[0].content.parts[0].text;
    } else if (PROVIDER === 'openai') {
      outputText = apiResponse.choices[0].message.content;
    }
    res.json({ output_text: outputText });    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Config: ${PROVIDER} - ${MODEL}`);
});
