const STORE_KEY = 'aoba-x-operator-v3';
const links = {
  drive: 'https://drive.google.com/drive/folders/1FFFKjettBFXrjDI9NbUJFpeJoWa_Wvtw',
  sheet: 'https://docs.google.com/spreadsheets/d/1d3vwBxZP5ng8ni-4m7HjZmUHv-8anG-vhfzFbI1kk1o/edit'
};
const phases = [
  { id:'foundation', number:'01', name:'土台をつくる', description:'あおばが誰で、何を投稿するアカウントかを決めます。', goal:'プロフィールと最初の投稿方針を揃える', tasks:[['あおばの基本情報を確認','33歳・不動産会社勤務・帰宅後の記録'],['画像の基準を確認','整いが少し崩れる、生活感のある日常'],['Xプロフィールを設定','名前・紹介文・AI/架空表記'],['最初の画像案を確認','初投稿に使う画像プロンプトを選ぶ']] },
  { id:'launch', number:'02', name:'最初の投稿を整える', description:'見つけてもらった人が、あおばを理解できる状態にします。', goal:'固定投稿と最初の3投稿を用意する', tasks:[['固定投稿をつくる','なぜ始めたかを短く書く'],['初投稿を下書きに保存','画像と短文をセットにする'],['2本目の投稿を用意','仕事帰りの小さな出来事'],['3本目の投稿を用意','部屋で少し気が抜ける瞬間']] },
  { id:'growth', number:'03', name:'認知を育てる', description:'反応を見ながら、あおばらしさを繰り返し届けます。', goal:'投稿後の実績を記録して、画像の勝ち筋を見つける', tasks:[['投稿結果を入力','表示回数・いいね・プロフィール遷移'],['画像要素を記録','場面・構図・髪・光・本文の短さ'],['次の画像案を確認','分析から日本語プロンプトを受け取る'],['1つだけ変えて投稿','一度に全部は変えない']] },
  { id:'fan', number:'04', name:'ファン化と販売準備', description:'実際の反応が積み上がってから、役立つ形へ育てます。', goal:'質問や継続閲覧の兆しを確認する', tasks:[['繰り返し来る反応を記録','質問・返信・継続的な閲覧'],['需要の言葉を集める','実際に届いた言葉だけを残す'],['note候補を1つ作る','実績を捏造せず、役立つ内容にする'],['販売開始を判断','反応が足りなければ販売しない']] }
];
const defaultState = () => ({ tab:'start', phase:0, done:{}, resetConfirm:false, visualVariant:0, posts:[] });
const state = Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {});
const save = () => localStorage.setItem(STORE_KEY, JSON.stringify(state));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const completedCount = i => phases[i].tasks.filter((_, t) => state.done[`${i}-${t}`]).length;
const progress = i => Math.round(completedCount(i) / phases[i].tasks.length * 100);
const unlocked = i => i === 0 || progress(i - 1) >= 80;
const currentPhase = () => phases[state.phase];
const baseVisualPrompts = [
  { title:'最初の1枚｜帰宅後の鎧がほどける瞬間', reason:'あおばの「仕事では整えている／家では少し力が抜ける」を、一枚で伝えるための基準画像です。', text:'33歳の不動産会社勤務の日本人女性「あおば」。駅から帰宅直後の1Kマンション。濃紺の仕事用ジャケットを脱ぎかけ、低い位置でゆるく結んだダークブラウンの髪、前髪が少し割れている。白・グレー・薄い木目の生活感、室内の暖色の光。営業用ではない、少し疲れて緊張がほどけた自然な表情。過度な演出や性的強調なし、自然なスマホ写真の質感、縦長9:16。', caption:'はじめました。たぶんすぐ消すかも。' },
  { title:'2枚目の候補｜仕事帰りの余白', reason:'仕事の顔だけではない、あおばの生活の続きが見える案です。', text:'33歳の日本人女性「あおば」。夜の1K、黒いパンプスを脱いだ直後、グレーのTシャツに着替え、仕事用バッグを床に置く瞬間。少し乱れたダークブラウンの髪、静かな疲れを残した表情。白・グレー・薄い木目、暖色の室内光、生活感のある自然な縦長写真、9:16、過度な演出や性的強調なし。', caption:'やっと帰宅。今日は思ったより長かった。' }
];
const visualPrompts = [...baseVisualPrompts];
async function loadLatestRecommendation(){
  try {
    const response = await fetch('./data/latest-state.json', {cache:'no-store'});
    const latest = await response.json();
    if (Array.isArray(latest.visualPrompts) && latest.visualPrompts.length) {
      // 日次分析の本命を先頭に置きつつ、別案ボタンが1件で止まらないよう基準案も残す。
      const seen = new Set();
      const merged = [...latest.visualPrompts, ...baseVisualPrompts].filter(prompt => {
        const key = `${prompt.title}|${prompt.text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      visualPrompts.splice(0, visualPrompts.length, ...merged);
      state.visualVariant %= visualPrompts.length;
    }
  } catch (_) { /* オフライン時は内蔵案を使う */ }
}
function copyText(text){ if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(()=>fallbackCopy(text)); else fallbackCopy(text); }
function fallbackCopy(text){ const area=document.createElement('textarea'); area.value=text; area.style.position='fixed'; area.style.opacity='0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }
function header(title, desc=''){ return `<header class="top"><div class="brand">AOBA / X OPERATOR</div><button class="resource-button" data-go="resources">資料</button></header><h1 class="title">${title}</h1>${desc?`<p class="sub">${desc}</p>`:''}`; }
function phaseCard(i, compact=false){ const p=phases[i], pct=progress(i), can=unlocked(i), active=i===state.phase; return `<section class="phase-card ${active?'active':''} ${can?'':'locked'}"><div class="phase-top"><span class="phase-number">PHASE ${p.number}</span><span class="phase-percent">${can?pct+'%':'前フェーズ80%で解放'}</span></div><b>${p.name}</b><p>${p.description}</p><div class="meter"><i style="width:${can?pct:0}%"></i></div>${compact?'':`<button class="secondary" data-phase="${i}" ${can?'':'disabled'}>${active?'このフェーズを進める':can?'内容を見る':'まだ進めません'}</button>`}</section>`; }
function start(){ const p=currentPhase(), pct=progress(state.phase), ready=pct>=80; return header('まずここから','迷ったら、画面中央の「次の一手」だけを進めてください。')+`<section class="start-card"><p class="eyebrow">NOW · PHASE ${p.number}</p><h2>${p.name}</h2><p>${p.goal}</p><div class="big-progress"><b>${pct}%</b><span>80%で次へ進めます</span></div><div class="meter"><i style="width:${pct}%"></i></div><button class="primary" data-go="phase">次の一手を見る</button>${ready&&state.phase<phases.length-1?'<button class="secondary" data-action="advance">次のフェーズへ進む</button>':''}</section><section class="card"><p class="eyebrow">4つのステップ</p>${phases.map((_,i)=>phaseCard(i,true)).join('')}<button class="text-button" data-go="progress">全ステップを見る</button></section><section class="card"><p class="eyebrow">すぐ開ける資料</p><div class="quick-links"><button data-go="character">あおばの基本情報</button><a href="${links.drive}" target="_blank" rel="noopener">画像・保存フォルダ</a><a href="${links.sheet}" target="_blank" rel="noopener">分析データ</a></div></section>`; }
function phase(){ const p=currentPhase(), pct=progress(state.phase); return header(`PHASE ${p.number}｜${p.name}`,p.goal)+`<section class="card"><p class="eyebrow">進捗 ${pct}% · 80%で次へ</p><div class="meter"><i style="width:${pct}%"></i></div>${p.tasks.map((task,i)=>`<div class="step-task ${state.done[`${state.phase}-${i}`]?'done':''}"><button class="check" data-task="${state.phase}-${i}">${state.done[`${state.phase}-${i}`]?'✓':''}</button><div><b>${i+1}. ${task[0]}</b><small>${task[1]}</small></div>${i===0?'<button class="go-small" data-go="character">見る</button>':''}${i===3&&state.phase===0?'<button class="go-small" data-go="create">開く</button>':''}${i===0&&state.phase===2?`<a class="go-small" href="${links.sheet}" target="_blank" rel="noopener">入力</a>`:''}</div>`).join('')}</section>${pct>=80&&state.phase<3?'<section class="notice"><b>次のフェーズに進めます。</b><br>残りの項目は後から戻って進められます。<button class="primary" data-action="advance">PHASE '+phases[state.phase+1].number+'へ進む</button></section>':''}<button class="text-button" data-go="start">ホームへ戻る</button>`; }
function progressPage(){ return header('全体の進め方','各フェーズを80%まで進めると、次のフェーズが開きます。')+phases.map((_,i)=>phaseCard(i)).join('')+`<section class="card"><p class="eyebrow">進め方のルール</p><p class="sub">一度に全部を完璧にしません。完了にした項目は、あとで戻って修正できます。販売は、実際の反応が育つまで開きません。</p></section>`; }
function character(){ return header('あおばの基本情報','投稿・画像・返信で迷った時の基準です。')+`<section class="profile-card"><div class="avatar">あ</div><div><b>あおば｜33歳</b><p>不動産会社勤務。163cm前後、華奢。仕事中は背筋を伸ばし、帰宅すると肩が内側に落ちる。</p></div></section><section class="card"><p class="eyebrow">CORE</p><p class="callout">「ちゃんとしていれば問題は起きない」と思い、整えることで自分を守っている。</p></section><section class="card"><p class="eyebrow">見た目の基準</p><p class="sub">ダークブラウンのミディアムヘア。華やかで知的だが、夕方には疲れが出る。完成されたポートレートより、髪を直す・パンプスを脱ぐなど動作の途中を選ぶ。</p></section><section class="card"><p class="eyebrow">リンク</p><a class="link-row" href="${links.drive}" target="_blank" rel="noopener">画像・設定資料の保存先　↗</a><button class="secondary" data-go="create">この設定で最初の画像案を見る</button></section>`; }
function create(){ const v=visualPrompts[state.visualVariant%visualPrompts.length]; return header('最初の画像を決める','画像生成の前に、あおばらしさと物語が合っているかを確認します。')+`<section class="card"><p class="eyebrow">${esc(v.title)}</p><p class="callout">${esc(v.reason)}</p><div class="prompt-head"><b>日本語プロンプト</b><button class="tiny-button" data-action="copy-prompt">コピー</button></div><div class="prompt-box">${esc(v.text)}</div><button class="secondary" data-action="next-visual">別案を見る</button></section><section class="card"><p class="eyebrow">投稿文</p><textarea id="post-text">${esc(v.caption||'')}</textarea><button class="primary" data-action="save-post">下書きとして保存</button></section>`; }
function posts(){ return header('投稿キュー','公開はここからXの下書きを開き、あなたが最終確認します。')+`<button class="primary" data-go="create">＋ 新しい投稿を作る</button>${state.posts.length?state.posts.map((p,i)=>`<article class="card post"><p>${esc(p.text)}</p><small>${esc(p.time)} · 下書き</small><button class="secondary" data-share="${i}">Xで下書きを開く</button></article>`).join(''):`<section class="empty"><b>まだ下書きがありません。</b><p>PHASE 01の「最初の画像案を確認」から始めましょう。</p></section>`}`; }
function resources(){ return header('資料とデータ','必要な情報を、いつでもここから開けます。')+`<section class="card"><p class="eyebrow">AOBA</p><button class="list-link" data-go="character"><span><b>あおばの基本情報</b><small>外見・内面・投稿の基準</small></span><span>›</span></button><a class="list-link" href="${links.drive}" target="_blank" rel="noopener"><span><b>画像・保存フォルダ</b><small>生成画像・資料・最新状態</small></span><span>↗</span></a><a class="list-link" href="${links.sheet}" target="_blank" rel="noopener"><span><b>分析データ</b><small>日次入力・投稿ログ・改善提案</small></span><span>↗</span></a></section><section class="card"><p class="eyebrow">アプリを最初から始める</p><p class="sub">進捗と、この端末に保存した下書きを初期状態に戻します。Drive・スプレッドシート・Xの内容は変更しません。</p><button class="danger" data-action="ask-reset">初期化する</button></section>${state.resetConfirm?`<div class="modal-backdrop"><section class="modal"><p class="eyebrow">最終確認</p><h2>本当に初期化しますか？</h2><p>この端末の進捗と下書きだけを消し、PHASE 01から始めます。外部データは消えません。</p><button class="danger" data-action="confirm-reset">初期化を実行する</button><button class="secondary" data-action="cancel-reset">やめる</button></section></div>`:''}`; }
function nav(){ return `<nav class="nav"><button class="${state.tab==='start'?'active':''}" data-go="start"><span>⌂</span><small>開始</small></button><button class="${state.tab==='phase'?'active':''}" data-go="phase"><span>✓</span><small>次の一手</small></button><button class="${state.tab==='create'?'active':''}" data-go="create"><span>＋</span><small>画像案</small></button><button class="${state.tab==='posts'?'active':''}" data-go="posts"><span>▤</span><small>投稿</small></button><button class="${state.tab==='resources'?'active':''}" data-go="resources"><span>⋯</span><small>資料</small></button></nav>`; }
function render(){ const pages={start,phase,progress:progressPage,character,create,posts,resources}; document.querySelector('#app').innerHTML=(pages[state.tab]||start)()+nav(); bind(); save(); }
function bind(){
  document.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>{state.tab=el.dataset.go; render();});
  document.querySelectorAll('[data-task]').forEach(el=>el.onclick=()=>{const key=el.dataset.task; state.done[key]=!state.done[key]; render();});
  document.querySelectorAll('[data-phase]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.phase); if(unlocked(i)){state.phase=i;state.tab='phase';render();}});
  document.querySelector('[data-action="advance"]')?.addEventListener('click',()=>{if(state.phase<3&&progress(state.phase)>=80){state.phase++;state.tab='phase';render();}});
  document.querySelector('[data-action="next-visual"]')?.addEventListener('click',()=>{state.visualVariant=(state.visualVariant+1)%visualPrompts.length;render();});
  document.querySelector('[data-action="copy-prompt"]')?.addEventListener('click',()=>copyText(visualPrompts[state.visualVariant%visualPrompts.length].text));
  document.querySelector('[data-action="save-post"]')?.addEventListener('click',()=>{const text=document.querySelector('#post-text').value.trim();if(text) state.posts.unshift({text,time:'承認待ち'}); state.tab='posts';render();});
  document.querySelectorAll('[data-share]').forEach(el=>el.onclick=()=>window.open('https://x.com/intent/post?text='+encodeURIComponent(state.posts[Number(el.dataset.share)].text),'_blank','noopener'));
  document.querySelector('[data-action="ask-reset"]')?.addEventListener('click',()=>{state.resetConfirm=true;render();});
  document.querySelector('[data-action="cancel-reset"]')?.addEventListener('click',()=>{state.resetConfirm=false;render();});
  document.querySelector('[data-action="confirm-reset"]')?.addEventListener('click',()=>{Object.assign(state,defaultState()); localStorage.removeItem(STORE_KEY); render();});
}
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
render(); loadLatestRecommendation().then(render);
