import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { level, recentSubjects } = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "API key is not configured" }, { status: 500 });
    }

    const difficultyNote = level === "easy"
      ? "初心者向け。危険な要素（不審なドメイン、個人情報や認証情報の要求、緊急性を煽る表現など）を比較的分かりやすく含める。ただし約4割は正常な手紙にする。"
      : "上級者向け。一見自然に見えるが、よく読むと不自然な点（ドメインの微妙な違い、正規手続きを避けている、要求内容と目的の不釣り合いなど）が隠れている、見抜きにくい案件にする。ただし約4割は正常な手紙にする。";

    const avoidNote = recentSubjects && recentSubjects.length > 0
      ? `\n- 直近に出題した以下の件名・題材とは、業種・シチュエーション・差出人の種類を必ず変えること（重複禁止）: ${recentSubjects.join(" / ")}`
      : "";

    const seed = Math.random().toString(36).slice(2, 8);

    const prompt = `あなたは日本語のフィッシングメール判定教育ゲームの問題作成者です。(seed:${seed})
以下の条件で、1通の「手紙（メール）」の案件をJSON形式のみで出力してください。前置きや説明、コードブロックの記号は一切不要です。

条件:
- ${difficultyNote}
- 差出人名、差出人メールアドレス、件名、本文（改行を含む自然な日本語の文章、150〜300文字程度）を作成する。
- 添付ファイル名がある場合は attachment に文字列で、ない場合は null を入れる。
- 選択肢 choices は4つ作成する。最初の3つはフィッシングの場合は「不審だと思う点」の説明、正常な手紙の場合はもっともらしいが誤りの不審点（ダミー）にする。4つ目（最後）は必ず固定で label を「特に問題は見当たらない（通過）」、id を "none" とすること。
- correct_choice_id は正しい選択肢のid（フィッシングなら1〜3番目のいずれか、正常なら "none"）。
- correct_action は "reject"（却下すべき＝フィッシング）または "pass"（通過させるべき＝正常）。
- explanation は正しい判断の根拠を100〜160文字程度の日本語で説明する。
- 差出人の業種・組織（役所/銀行/宅配/通販/勤務先/学校/SNS/税務など）や状況は毎回ランダムに変えること。${avoidNote}
- 不審なドメインに関する問題は、差出人メールアドレスとドメインが微妙に異なるように作ること（例: 差出人はクロネコだがドメインはsironeko など）。
出力するJSONのスキーマ:
{
  "sender_name": string,
  "sender_email": string,
  "subject": string,
  "body": string,
  "attachment": string または null,
  "is_phishing": boolean,
  "choices": [{"id": string, "label": string}, ... 4件],
  "correct_choice_id": string,
  "correct_action": "reject" または "pass",
  "explanation": string
}`;

    // 注: gemini-3.6-flashは存在しないため、現在安定して使える gemini-1.5-flash を指定しています
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, responseMimeType: "application/json" }
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`API request failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("") || "";
    const cleaned = text.replace(/```json|```/g, "").trim();

    if (!cleaned) throw new Error("empty response from API");
    const letter = JSON.parse(cleaned);

    return NextResponse.json(letter);
  } catch (error) {
    console.error("Generate API Error:", error);
    return NextResponse.json({ error: "Failed to generate letter" }, { status: 500 });
  }
}