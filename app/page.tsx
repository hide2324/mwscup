"use client";

import { useState, useEffect, useRef } from 'react';

const TOTAL_LETTERS = 8;

const FALLBACK: Record<string, any[]> = {
  easy: [
    {
      sender_name: "内閣国民生活支援課",
      sender_email: "support@gov-life-jp.net",
      subject: "【緊急】給付金受給資格の確認について",
      body: "この度、あなたは特別給付金の対象者に選ばれました。\n本日18時までに下記より個人情報（氏名・生年月日・口座番号・暗証番号）をご登録ください。\n期限を過ぎると受給資格を失いますのでご注意ください。\nhttp://gov-life-jp.net/entry",
      attachment: null,
      is_phishing: true,
      choices: [
        {id:"a", label:"送信元ドメインが公的機関のものではない（.net）"},
        {id:"b", label:"本文の言葉遣いが丁寧すぎる"},
        {id:"c", label:"件名に【緊急】と書かれている"},
        {id:"d", label:"特に問題は見当たらない（通過）"}
      ],
      correct_choice_id:"a",
      correct_action:"reject",
      explanation:"公的機関を名乗りながらドメインが「.net」の民間アドレスであり、暗証番号という本来聞かれるはずのない情報を、時間制限で急がせて要求しています。典型的なフィッシングの手口です。"
    },
    {
      sender_name: "市役所 住民課",
      sender_email: "jyuumin@city-sample.lg.jp",
      subject: "住民票発行手数料改定のお知らせ",
      body: "平素より市政にご協力いただきありがとうございます。\n来月1日より住民票発行手数料が300円から350円に改定されます。\nご不明な点は窓口までお問い合わせください。",
      attachment: null,
      is_phishing: false,
      choices: [
        {id:"a", label:"送信元ドメインが不自然"},
        {id:"b", label:"個人情報を要求している"},
        {id:"c", label:"不自然に急かしている"},
        {id:"d", label:"特に問題は見当たらない（通過）"}
      ],
      correct_choice_id:"d",
      correct_action:"pass",
      explanation:"公式ドメイン（.lg.jp）からの通知で、個人情報の要求や不自然な緊急性もない、通常の行政連絡です。"
    }
  ],
  hard: [
    {
      sender_name: "外国人在留支援センター",
      sender_email: "info@zairyu-support-center.jp",
      subject: "在留カード情報更新のご案内",
      body: "在留カードの記載事項に変更があった方は、下記フォームより氏名・生年月日・住所・職業・電話番号・家族構成をご登録ください。\n手続きは平文のメール返信で構いません。本日18時までにご対応いただけますと幸いです。\nご協力よろしくお願いいたします。",
      attachment: "申請書.pdf.exe",
      is_phishing: true,
      choices: [
        {id:"a", label:"ドメインが本物の行政機関か確認できない上、正規の手続き（窓口・郵送）を避け暗号化せず平文で家族構成まで求めている"},
        {id:"b", label:"文章が丁寧である"},
        {id:"c", label:"件名が事務的すぎる"},
        {id:"d", label:"特に問題は見当たらない（通過）"}
      ],
      correct_choice_id:"a",
      correct_action:"reject",
      explanation:"添付ファイルの拡張子が「.pdf.exe」という偽装ファイルであり、本来窓口や書面で行うべき手続きを平文メールで済ませようとし、家族構成まで聞き出そうとしています。要求内容と目的が釣り合っていません。"
    },
    {
      sender_name: "取引先 経理部 田中",
      sender_email: "tanaka@partner-corp.co.jp",
      subject: "Re: 請求書送付の件（訂正版）",
      body: "先ほどの請求書に金額の誤りがございました。訂正版を添付いたします。\nお手数ですが、旧版は破棄いただき、こちらのファイルでお手続きください。\nよろしくお願いいたします。",
      attachment: "invoice_corrected.pdf",
      is_phishing: false,
      choices: [
        {id:"a", label:"添付ファイルの拡張子が偽装されている"},
        {id:"b", label:"送信元ドメインが取引先と一致せず不自然"},
        {id:"c", label:"個人の認証情報を要求している"},
        {id:"d", label:"特に問題は見当たらない（通過）"}
      ],
      correct_choice_id:"d",
      correct_action:"pass",
      explanation:"取引先の正規ドメインからの返信で、添付は通常のPDF、認証情報や個人情報の要求もありません。業務上ごく自然なやり取りです。"
    }
  ]
};

export default function Game() {
  const [gameState, setGameState] = useState<'start' | 'game' | 'result'>('start');
  const [level, setLevel] = useState('easy');
  const [timed, setTimed] = useState(false);
  const [round, setRound] = useState(0);
  const [stats, setStats] = useState({ total: 0, rejected: 0, falseReject: 0, missed: 0, caught: 0 });
  const [currentLetter, setCurrentLetter] = useState<any>(null);
  const [recentSubjects, setRecentSubjects] = useState<string[]>([]);
  const [pickedChoiceId, setPickedChoiceId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [locked, setLocked] = useState(false);
  const [sourceTag, setSourceTag] = useState("");
  const [actionMark, setActionMark] = useState<'pass' | 'reject' | null>(null);
  const [feedback, setFeedback] = useState<{ show: boolean, tag: string, tagClass: string, explain: string } | null>(null);
  
  const fallbackIdx = useRef({ easy: 0, hard: 0 });

  useEffect(() => {
    let timerId: NodeJS.Timeout;
    if (gameState === 'game' && timed && !locked && currentLetter) {
      timerId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerId);
            if (!locked) handleJudge('pass', true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [gameState, timed, locked, currentLetter]);

  const fetchLetter = async (targetLevel: string, currentSubjects: string[]) => {
    setCurrentLetter(null);
    setSourceTag("");
    
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: targetLevel, recentSubjects: currentSubjects })
      });
      if (!res.ok) throw new Error("API call failed");
      const letter = await res.json();
      
      setRecentSubjects(prev => {
        const newArr = [...prev, letter.subject];
        return newArr.length > 5 ? newArr.slice(1) : newArr;
      });
      setSourceTag("(API生成)");
      setCurrentLetter(letter);
      if (timed) setTimeLeft(60);
    } catch (error) {
      console.error("[検閲官の机] API生成に失敗、予備案件を使用します:", error);
      const list = FALLBACK[targetLevel];
      const idx = fallbackIdx.current[targetLevel as keyof typeof fallbackIdx.current];
      const letter = JSON.parse(JSON.stringify(list[idx % list.length]));
      fallbackIdx.current[targetLevel as keyof typeof fallbackIdx.current]++;
      setSourceTag("(予備案件)");
      setCurrentLetter(letter);
      if (timed) setTimeLeft(60);
    }
  };

  const handleStart = (selectedLevel: string, isTimed: boolean) => {
    setLevel(selectedLevel);
    setTimed(isTimed);
    setRound(1);
    setStats({ total: 0, rejected: 0, falseReject: 0, missed: 0, caught: 0 });
    setGameState('game');
    setLocked(false);
    setPickedChoiceId(null);
    setActionMark(null);
    setFeedback(null);
    fetchLetter(selectedLevel, []);
  };

  const handleHome = () => {
    if (!window.confirm("審査を中断してホームへ戻りますか？現在の進行状況は失われます。")) return;
    setGameState('start');
  };

  const handleJudge = (action: 'pass' | 'reject', isTimeout: boolean = false) => {
    if (locked) return;
    setLocked(true);

    const correctAction = currentLetter.correct_action;
    setStats(prev => {
      const newStats = { ...prev, total: prev.total + 1 };
      if (action === 'reject') newStats.rejected++;
      
      if (correctAction === 'reject' && action === 'reject') {
        newStats.caught++;
      } else if (correctAction === 'reject' && action === 'pass') {
        newStats.missed++;
      } else if (correctAction === 'pass' && action === 'reject') {
        newStats.falseReject++;
      }
      return newStats;
    });

    let tag, tagClass;
    if (correctAction === 'reject' && action === 'reject') {
      tag = "摘発"; tagClass = "correct";
    } else if (correctAction === 'reject' && action === 'pass') {
      tag = "見逃し"; tagClass = "bad";
    } else if (correctAction === 'pass' && action === 'reject') {
      tag = "誤却下"; tagClass = "bad";
    } else {
      tag = "適正通過"; tagClass = "correct";
    }

    setActionMark(action);

    setTimeout(() => {
      let explain = currentLetter.explanation;
      if (isTimeout) {
        explain = "審査時間が終了したため、自動的に通過となりました。" + explain;
      }
      setFeedback({ show: true, tag, tagClass, explain });
    }, 420);
  };

  const handleNext = () => {
    setFeedback(null);
    setActionMark(null);
    setPickedChoiceId(null);
    setLocked(false);

    if (round >= TOTAL_LETTERS) {
      setGameState('result');
    } else {
      setRound(prev => prev + 1);
      fetchLetter(level, recentSubjects);
    }
  };

  const handleSubmitBtnClick = () => {
    const noIssueId = currentLetter.choices[currentLetter.choices.length - 1].id;
    const action = pickedChoiceId === noIssueId ? "pass" : "reject";
    handleJudge(action, false);
  };

  const calculateAccuracy = () => {
    if (stats.total === 0) return 0;
    return Math.round(((stats.caught + (stats.total - stats.rejected - stats.missed)) / stats.total) * 100);
  };

  const getRank = (accuracy: number) => {
    if (accuracy >= 90) return "特級検閲官";
    if (accuracy >= 70) return "上級検閲官";
    if (accuracy >= 50) return "中級検閲官";
    return "見習い検閲官";
  };

  return (
    <>
      <a className="nav-link" href="https://mail-security-c8hqez1xf-team3-c3f4.vercel.app/newmail.html">教材ツールへ →</a>
      
      <div className="desk">
        {gameState === 'start' && (
          <div id="screen-start">
            <h1 className="headline">検閲官の机</h1>
            <p className="headline sub" style={{ color: '#cfc6ac', fontFamily: '"Zen Kaku Gothic New"' }}>
              国境検閲局へようこそ。届く手紙を審査し、通過させるか却下するかを判断せよ。誤った判断は記録に残る。
            </p>
            <div className="paper" style={{ padding: '22px' }}>
              <p className="sub" style={{ marginBottom: '16px' }}>案件の難易度を選択してください</p>
              <div className="file-tabs">
                <button className="file-tab" onClick={() => handleStart('easy', false)}>
                  <span className="lv">イージー</span>
                  <span className="desc">分かりやすい不審点が中心。制限時間なし。</span>
                </button>
                <button className="file-tab" onClick={() => handleStart('easy', true)}>
                  <span className="lv">イージー</span>
                  <span className="desc">分かりやすい不審点が中心。</span>
                  <span className="timer-mark">制限時間 1分</span>
                </button>
                <button className="file-tab" onClick={() => handleStart('hard', false)}>
                  <span className="lv">ハード</span>
                  <span className="desc">巧妙で見抜きにくい案件。制限時間なし。</span>
                </button>
                <button className="file-tab" onClick={() => handleStart('hard', true)}>
                  <span className="lv">ハード</span>
                  <span className="desc">巧妙で見抜きにくい案件。</span>
                  <span className="timer-mark">制限時間 1分</span>
                </button>
              </div>
            </div>
            <p className="api-note">Gemini API で案件を生成します。生成に失敗した場合は予備の案件で続行します。</p>
          </div>
        )}

        {gameState === 'game' && (
          <div id="screen-game" style={{ display: 'block' }}>
            <div className="status-bar">
              <button className="home-link" onClick={handleHome}>← ホームへ戻る</button>
              <span className="count">検閲 <span>{round}</span> / <span>{TOTAL_LETTERS}</span></span>
              <span style={{ fontSize: '11px', opacity: 0.7 }}>{sourceTag}</span>
              <span id="timer-wrap" className={timeLeft <= 10 && timed ? 'low' : ''}>
                {timed ? `残り時間 ${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, '0')}` : "残り時間 --"}
              </span>
            </div>
            
            <div className="paper letter-card">
              {!currentLetter ? (
                <div className="loading">案件を作成しています…</div>
              ) : (
                <>
                  <div className="letter-head">
                    <div className="row"><span className="label">差出人</span><span className="val">{currentLetter.sender_name}</span></div>
                    <div className="row"><span className="label">アドレス</span><span className="val">{currentLetter.sender_email}</span></div>
                    <div className="subject">{currentLetter.subject}</div>
                  </div>
                  <div className="letter-body">{currentLetter.body}</div>
                  
                  {currentLetter.attachment && (
                    <div style={{ padding: '0 22px 12px' }}>
                      <div className="attachment">{currentLetter.attachment}</div>
                    </div>
                  )}

                  <div className="choice-zone">
                    <p className="prompt">この手紙について、あなたが感じた点を一つ選んでください。</p>
                    <div className="choices">
                      {currentLetter.choices.map((c: any) => (
                        <button
                          key={c.id}
                          className={`choice-btn ${pickedChoiceId === c.id ? 'picked' : ''}`}
                          onClick={() => {
                            if (!locked) setPickedChoiceId(c.id);
                          }}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={`verdict-zone ${pickedChoiceId ? 'show' : ''}`} style={{ display: pickedChoiceId ? 'flex' : 'none' }}>
                    <button className="stamp-btn submit" onClick={handleSubmitBtnClick}>提 出</button>
                  </div>
                  
                  <div className={`stamp-mark ${actionMark ? 'show ' + actionMark : ''}`}>
                    {actionMark === 'reject' ? '却下' : (actionMark === 'pass' ? '通過' : '')}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {gameState === 'result' && (
          <div id="screen-result" style={{ display: 'block' }}>
            <div className="paper">
              <h2>本日の検閲結果</h2>
              <p className="rank">正答率 {calculateAccuracy()}% ／ 認定：{getRank(calculateAccuracy())}</p>
              <div className="stat-grid">
                <div className="stat-cell"><span className="n">{stats.total}</span><span className="l">検閲総数</span></div>
                <div className="stat-cell"><span className="n">{stats.rejected}</span><span className="l">却下総数</span></div>
                <div className="stat-cell"><span className="n">{stats.falseReject}</span><span className="l">誤却下数</span></div>
                <div className="stat-cell"><span className="n">{stats.missed}</span><span className="l">見逃し数</span></div>
                <div className="stat-cell wide"><span className="n">{stats.caught}</span><span className="l">摘発数（正しく危険な手紙を却下）</span></div>
              </div>
              <button className="retry-btn" onClick={() => setGameState('start')}>別の案件に取り組む</button>
            </div>
          </div>
        )}
      </div>

      {feedback && feedback.show && (
        <div id="screen-feedback" className="show">
          <div className="paper fb-card">
            <span className={`fb-tag ${feedback.tagClass}`}>{feedback.tag}</span>
            <div className="fb-reason">
              <b>正しい判断の根拠</b>
              <span>{feedback.explain}</span>
            </div>
            <button className="next-btn" onClick={handleNext}>次の手紙へ</button>
          </div>
        </div>
      )}
    </>
  );
}