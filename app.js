const STORE_KEY = 'aoba-x-operator-v3';
const links = {
  drive: 'https://drive.google.com/drive/folders/1FFFKjettBFXrjDI9NbUJFpeJoWa_Wvtw',
  canon: 'https://drive.google.com/drive/folders/1ZQR9A4inIijmCMtGZ1jHxjtdlxIEbdez',
  homeImages: 'https://drive.google.com/drive/folders/14JTxAZyvoVTqn-710ytlpjdEZrD4fw2o',
  workImages: 'https://drive.google.com/drive/folders/1JbkvN_Iet6Of7Vg5u4GtoURx15axAnlx',
  weekendImages: 'https://drive.google.com/drive/folders/1jhPHKZ1wd-U62UUhGaTrGu8BEFS9Lli8',
  sheet: 'https://docs.google.com/spreadsheets/d/1d3vwBxZP5ng8ni-4m7HjZmUHv-8anG-vhfzFbI1kk1o/edit'
};
const phases = [
  { id:'foundation', number:'01', name:'土台をつくる', description:'あおばが誰で、何を投稿するアカウントかを決めます。', goal:'プロフィールと最初の投稿方針を揃える', tasks:[['あおばの基本情報を確認','33歳・不動産会社勤務・帰宅後の記録'],['画像の基準を確認','整いが少し崩れる、生活感のある日常'],['Xプロフィールを設定','名前・紹介文・AI/架空表記'],['最初の画像案を確認','初投稿に使う画像プロンプトを選ぶ']] },
  { id:'launch', number:'02', name:'最初の投稿を整える', description:'見つけてもらった人が、あおばを理解できる状態にします。', goal:'固定投稿と最初の3投稿を用意する', tasks:[['固定投稿をつくる','なぜ始めたかを短く書く'],['初投稿を下書きに保存','画像と短文をセットにする'],['2本目の投稿を用意','仕事帰りの小さな出来事'],['3本目の投稿を用意','部屋で少し気が抜ける瞬間']] },
  { id:'growth', number:'03', name:'認知を育てる', description:'反応を見ながら、あおばらしさを繰り返し届けます。', goal:'投稿後の実績を記録して、画像の勝ち筋を見つける', tasks:[['投稿結果を入力','表示回数・いいね・プロフィール遷移'],['画像要素を記録','場面・構図・髪・光・本文の短さ'],['次の画像案を確認','分析から日本語プロンプトを受け取る'],['1つだけ変えて投稿','一度に全部は変えない']] },
  { id:'fan', number:'04', name:'ファン化と販売準備', description:'実際の反応が積み上がってから、役立つ形へ育てます。', goal:'質問や継続閲覧の兆しを確認する', tasks:[['繰り返し来る反応を記録','質問・返信・継続的な閲覧'],['需要の言葉を集める','実際に届いた言葉だけを残す'],['note候補を1つ作る','実績を捏造せず、役立つ内容にする'],['販売開始を判断','反応が足りなければ販売しない']] }
];
const canonicalProfile = {
  name:'あおば', ageJob:'33歳／不動産会社勤務', bodyPosture:'163cm前後・華奢。仕事中は背筋を伸ばし、自宅では肩が内側に落ちる。', workLook:'濃紺ジャケット、白または淡いブルーのブラウス、タイトスカート、黒パンプス、社員証。', home:'駅から徒歩10分ほどの1K。白・グレー・薄い木目を中心にした、効率のための部屋。', core:'「ちゃんとしていれば問題は起きない」。整えることで自分を守っている。', basePrompt:'実写的で自然な日本人女性「あおば」、33歳、不動産会社勤務、身長163cm前後の華奢な体型。華やかで知的、清潔感のある現実的な美人。愛嬌のある狸顔、細すぎずわずかに丸みのある顎。中程度の太さのダークブラウンの眉、横幅がありやや切れ長の二重、わずかに下がった目尻、薄い目の下のくま。自然ですっきりした鼻筋、上唇は薄めで下唇に少し厚み。肌は自然な白さ。黒に近いダークブラウンの鎖骨丈ミディアムヘア、細めの髪質、長めで薄い前髪、右耳に髪をかける癖。整えすぎたモデル写真ではなく、生活の途中にある自然な表情。過度な加工、性的強調、顔立ちの誇張、若年化なし。'
};
const defaultState = () => ({ tab:'start', phase:0, done:{}, resetConfirm:false, drawerOpen:false, editingCharacter:false, visualVariant:0, dailyVariant:0, dailyTheme:'auto', posts:[], characterAssets:{ face:'', work:'', home:'', weekend:'' }, characterProfile:{...canonicalProfile} });
const state = Object.assign(defaultState(), JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {});
if (!['auto','life','realestate','room','tired','question','support'].includes(state.dailyTheme)) state.dailyTheme='auto';
const pageHistory = [];
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
let remoteDailyPlan = null;
const writingResearch = [
  '写真に写る一点を先に置き、感情は一つだけ添える。',
  '説明しすぎず、言い切らない余白を残す。',
  '仕事の固有情報・現在地・実在人物の話は書かない。',
  '疑問形・応援を求める言葉は、ときどきだけ使う。返事を強く求めない。',
  '画像を付ける日は、画像そのものを短く説明するALTも用意する。'
];
const contentThemes = [
  { id:'life', name:'生活', hint:'帰宅後・休日の小さなこと', time:'20:47', label:'帰宅後', scene:'玄関でバッグを下ろして、やっと息をつく夜', image:'夜の1Kマンションの玄関。革製の仕事用トートを床に下ろし、低い位置で髪をまとめたあおば。白・グレー・薄い木目、暖色の室内灯。', lines:['ただいま。バッグを置いたら、今日が終わる気がした。','靴を脱いだだけで、ちょっとだけ自分に戻れる。','夕飯はちゃんと食べたいのに、冷蔵庫を開けて閉めただけ。','洗顔までたどり着いたので、今日は合格にしたい。','帰ってきた部屋が静かだと、今日は長かったなって思う。'] },
  { id:'realestate', name:'不動産の小話', hint:'仕事の途中で気づいたこと', time:'12:18', label:'昼休み', scene:'資料を閉じる前に、今日の内見を思い返す昼休み', image:'不動産会社のデスクの端に置いた物件資料、メジャー、紙カップのスープ。窓から昼の光、あおばの手元だけが入る自然な写真。', lines:['内見って、最初の30秒でなんとなく決まることありませんか。','南向きでも、午後の明るさは隣の建物との距離でけっこう変わる。','収納は広さより、扉を開けたときに何をしまうか想像できるかのほうが大事な気がする。','キッチンは広いほうがいい、で本当に合ってるのかな。','資料を閉じたあとも部屋のことを考えてるの、職業病かな。'] },
  { id:'room', name:'部屋を案内', hint:'暮らしが浮かぶ、部屋の一場面', time:'18:36', label:'内見のあと', scene:'内見を終えて、印象に残った部屋の一角を振り返る', image:'やわらかい午後の光が入る1Kの室内。玄関からキッチンが直接見えない間取り、白い壁、淡い木目の床、窓辺に立つあおばの後ろ姿。生活を想像できる自然な縦長写真。', lines:['今日見た部屋、玄関からキッチンが見えなかった。それだけで帰宅後の気分が少し違いそうだった。','午後の光がきれいな部屋だった。写真より、実際のほうがちゃんとよかった。','帰ってすぐ座れる場所があるだけで、部屋って好きになれるのかな。','洗面台の横に少し置ける場所があると、朝がちょっと楽になる気がする。','窓を開けた瞬間に決まる部屋って、たまにある。'] },
  { id:'tired', name:'少し疲れた日', hint:'重くしすぎない、生活の弱音', time:'22:36', label:'夜', scene:'ベッド脇でパンプスを脱いだあとの夜', image:'ベッド脇に黒いパンプスを揃え、グレーのTシャツで座るあおば。少し乱れたダークブラウンの髪、暖色の小さな照明。', lines:['パンプスを脱いだところで、今日の体力が終わった。','帰ってから何もできなかった。歯だけ磨けたから、今日はもういいことにする。','今日はちょっとだけ長かった。おつかれさまって言ってもらえたら、たぶん回復する。','資料はできた。あとは行くだけ。少しだけ背中を押してほしい。','なんだか自信がない日。大丈夫って言ってもらえたら嬉しいです。'] },
  { id:'question', name:'ふと聞きたい', hint:'独り言のような疑問', time:'21:14', label:'夜のひとこと', scene:'ソファ代わりのベッド端で、スマホを見ながら考える夜', image:'白とグレーの1K、ベッドの端に座り、スマホを手にしたあおば。低い位置でまとめた髪、暖色の間接照明、静かな夜の生活感。', lines:['部屋を選ぶとき、みんな何を最後まで迷うんだろう。','疲れてる日は、夕飯を決めるだけでもちゃんとしてることになりませんか。','帰ってすぐ座れる場所があるだけで、部屋って好きになれるのかな。','内見のとき、窓を開けた瞬間に決まることってありませんか。','忙しい日の自分を助けるもの、みんな何を置いてますか。'] },
  { id:'support', name:'少し応援してほしい', hint:'控えめに声をかけてもらう', time:'07:24', label:'出勤前', scene:'洗面台の前で前髪を直し、出勤の準備をする朝', image:'朝の洗面台の鏡の前。長めの前髪を右耳にかけ、濃紺のジャケットを羽織る直前のあおば。白い洗面台と静かな朝の光。', lines:['明日も内見があるので、ちゃんと起きられるように応援してください。','前髪が言うことを聞かない朝。今日もなんとかいけるかな。','今日は少し緊張する日。静かに応援してもらえたら嬉しいです。','ちゃんと準備したのに、出る前だけ少し不安になる。','おつかれさまって言い合えるだけで、明日も少し楽になる気がする。'] }
];
const dailyMoments = {
  weekday: [
    { time:'07:24', label:'出勤前', scene:'洗面台の前で前髪を直したあと', image:'朝の洗面台の鏡の前。長めの前髪を右耳にかけ、濃紺のジャケットを羽織る直前のあおば。白い洗面台と静かな朝の光。', lines:['前髪が言うことを聞かない朝。\nでも電車に乗る頃には、たぶんいつもの顔になる。','朝の鏡は、昨日の疲れを少しだけ残している。\nコンシーラー、今日もがんばって。','あと五分だけ早く起きればよかった、を毎朝やってる。'] },
    { time:'12:18', label:'昼休み', scene:'コンビニのスープを机の端で飲む昼休み', image:'不動産会社のデスクの端に置いた紙カップのスープと、閉じたタブレット。窓から昼の光。あおばの手元だけが入る自然な写真。', lines:['あたたかいものを飲むと、午後もなんとかなる気がする。','お昼を急いで食べるの、そろそろやめたい。\nでも今日はスープがあったから少しだけまし。','資料を閉じる時間が、昼休みの終わりより早い。'] },
    { time:'20:47', label:'帰宅後', scene:'玄関で仕事用バッグを下ろす帰宅直後', image:'夜の1Kマンションの玄関。革製の仕事用トートを床に下ろし、低い位置で髪をまとめたあおば。白、グレー、薄い木目、暖色の室内灯。', lines:['ただいま。\nバッグを置いたら、今日が終わる気がした。','靴を脱いだだけで、ちょっとだけ自分に戻れる。','帰ってきた部屋が静かだと、今日は長かったなって思う。'] },
    { time:'22:36', label:'夜', scene:'ベッド脇でパンプスを脱いだあとの夜', image:'ベッド脇に黒いパンプスを揃え、グレーのTシャツで座るあおば。少し乱れたダークブラウンの髪、暖色の小さな照明。', lines:['金曜日じゃなくても、靴を脱ぐ音は少し安心する。','今日はもう、ちゃんとしてなくていい時間にする。','洗顔までたどり着いたので、今日は合格にしたい。'] }
  ],
  weekend: [
    { time:'10:42', label:'休日の朝', scene:'ゆっくり髪を整える休日の朝', image:'休日の朝の1K、ゆるく毛先を整えたダークブラウンの髪を片側だけ耳にかけるあおば。窓辺の淡い自然光。', lines:['休日の朝は、急がなくていいだけで少し機嫌がいい。','コーヒーが冷めるまで座っていられた。今日はそれで十分。','髪を巻くほどではないけど、少しだけ整えた。'] },
    { time:'15:18', label:'休日の午後', scene:'洗濯物をたたみながら窓の外を見る午後', image:'白とグレーの1Kで洗濯物をたたむあおば。窓から午後の自然光、セミダブルベッドの端、生活感のある静かな写真。', lines:['洗濯物をたたんだだけで、休日を使えた気がする。','外に出ない休日も、たまには必要。','干したものが乾いていると、少しだけ達成感がある。'] },
    { time:'20:44', label:'休日の夜', scene:'翌日の準備をゆっくり始める夜', image:'翌日の濃紺ジャケットを椅子に掛け、ベッド脇で小さな腕時計を外すあおば。夜の1K、暖色の光。', lines:['明日の準備をすると、休日が終わる。\nでも少し安心もする。','バッグの中のレシートを捨てた。今日はそれだけでえらい。','月曜のことは、まだ考えないことにする。'] }
  ]
};
function jstNow(){
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
  return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
}
function daySeed(parts){ return Math.floor(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day))/86400000); }
function planForToday(){
  const parts=jstNow(), seed=daySeed(parts), weekend=['Sat','Sun'].includes(parts.weekday), moments=weekend?dailyMoments.weekend:dailyMoments.weekday;
  const selectedTheme=contentThemes.find(theme=>theme.id===state.dailyTheme);
  const moment=moments[seed%moments.length], line=moment.lines[(seed+state.dailyVariant)%moment.lines.length];
  const dateLabel=`${Number(parts.month)}月${Number(parts.day)}日（${{Mon:'月',Tue:'火',Wed:'水',Thu:'木',Fri:'金',Sat:'土',Sun:'日'}[parts.weekday]}）`;
  if (remoteDailyPlan?.dateLabel===dateLabel && state.dailyVariant===0 && state.dailyTheme==='auto') return remoteDailyPlan;
  if(selectedTheme){
    const line=selectedTheme.lines[(seed+state.dailyVariant)%selectedTheme.lines.length];
    return { dateLabel, time:selectedTheme.time, label:selectedTheme.label, scene:selectedTheme.scene, text:line, alt:`${selectedTheme.image}（AI生成・架空キャラクターの表現）`, research:writingResearch[(seed+state.dailyVariant)%writingResearch.length], theme:selectedTheme.id };
  }
  return { dateLabel, time:moment.time, label:moment.label, scene:moment.scene, text:line, alt:`${moment.image}（AI生成・架空キャラクターの表現）`, research:writingResearch[state.dailyVariant%writingResearch.length] };
}
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
    if (latest.dailyPost && typeof latest.dailyPost === 'object') remoteDailyPlan = latest.dailyPost;
  } catch (_) { /* オフライン時は内蔵案を使う */ }
}
function copyText(text){ if(navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(()=>fallbackCopy(text)); else fallbackCopy(text); }
function fallbackCopy(text){ const area=document.createElement('textarea'); area.value=text; area.style.position='fixed'; area.style.opacity='0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }
const characterProfile = () => ({...canonicalProfile,...(state.characterProfile||{})});
const profileItems = profile => [
  ['年齢・仕事',profile.ageJob,'ageJob'], ['体型・姿勢',profile.bodyPosture,'bodyPosture'], ['仕事の装い',profile.workLook,'workLook'], ['生活の舞台',profile.home,'home'], ['内面の核',profile.core,'core']
];
function assetCard(key, title, description){ const url=state.characterAssets?.[key]||''; return `<article class="asset-card"><div class="asset-image ${url?'has-image':''}">${url?`<img src="${esc(url)}" alt="${esc(title)}のあおば基準画像">`:`<div><span>＋</span><b>画像を追加予定</b><small>${esc(title)}</small></div>`}</div><div class="asset-body"><b>${esc(title)}</b><p>${esc(description)}</p><button class="tiny-button" data-action="set-asset" data-asset="${key}">${url?'画像URLを変更':'画像URLを入れる'}</button>${url?'<button class="text-inline" data-action="clear-asset" data-asset="'+key+'">外す</button>':''}</div></article>`; }
function go(tab, remember=true){
  if(tab===state.tab) return;
  if(remember) pageHistory.push(state.tab);
  state.tab=tab; state.drawerOpen=false; render();
}
function back(){ const previous=pageHistory.pop()||'start'; state.tab=previous; state.drawerOpen=false; render(); }
function header(title, desc=''){
  const canBack=state.tab!=='start';
  return `<header class="top"><div class="top-left">${canBack?'<button class="back-button" data-action="back">‹ <span>戻る</span></button>':'<button class="menu-button" data-action="drawer">☰</button>'}<div class="brand">AOBA / X OPERATOR</div></div><button class="resource-button" data-action="drawer">メニュー</button></header><h1 class="title">${title}</h1>${desc?`<p class="sub">${desc}</p>`:''}`;
}
function drawer(){
  if(!state.drawerOpen) return '';
  const items=[['start','ホーム','今日の最優先タスク'],['phase','進め方','フェーズと具体的なタスク'],['character','キャラクター','あおばの基準書'],['create','投稿を作る','画像・本文・理由を作成'],['posts','今日の運用','日時に合う投稿下書き'],['resources','資料と分析','Drive・スプレッドシート・初期化']];
  return `<div class="drawer-backdrop" data-action="close-drawer"><aside class="drawer" aria-label="メニュー"><div class="drawer-head"><b>運用メニュー</b><button data-action="close-drawer">×</button></div><p class="drawer-label">いまは上から順に進めれば大丈夫です。</p>${items.map(([tab,name,desc],i)=>`<button class="drawer-item ${state.tab===tab?'active':''}" data-go="${tab}"><span>${String(i+1).padStart(2,'0')}</span><div><b>${name}</b><small>${desc}</small></div><i>›</i></button>`).join('')}<div class="drawer-foot">AI GENERATED / FICTIONAL CHARACTER<br>投稿・返信の公開は必ず最終確認後に行います。</div></aside></div>`;
}
function phaseCard(i, compact=false){ const p=phases[i], pct=progress(i), can=unlocked(i), active=i===state.phase; return `<section class="phase-card ${active?'active':''} ${can?'':'locked'}"><div class="phase-top"><span class="phase-number">PHASE ${p.number}</span><span class="phase-percent">${can?pct+'%':'前フェーズ80%で解放'}</span></div><b>${p.name}</b><p>${p.description}</p><div class="meter"><i style="width:${can?pct:0}%"></i></div>${compact?'':`<button class="secondary" data-phase="${i}" ${can?'':'disabled'}>${active?'このフェーズを進める':can?'内容を見る':'まだ進めません'}</button>`}</section>`; }
function start(){ const p=currentPhase(), pct=progress(state.phase), tasks=p.tasks; const nextIndex=tasks.findIndex((_,i)=>!state.done[`${state.phase}-${i}`]); const next=Math.max(0,nextIndex); return header('今日の運用','最初は、下の「今やること」だけを上から順に進めてください。')+`<section class="mission-hero"><p>DAY 0 · ACCOUNT DESIGN</p><h2>${p.name}</h2><div class="mission-progress"><b>${pct}%</b><span>このフェーズが80%になると<br>次の段階へ進めます</span></div><div class="meter"><i style="width:${pct}%"></i></div></section><section class="now-card"><p class="eyebrow">いまやること · ${next+1}/${tasks.length}</p><h2>${esc(tasks[next][0])}</h2><p>${esc(tasks[next][1])}</p><button class="primary" data-go="${next===0?'character':next===3?'create':'phase'}">${next===0?'あおばの基準書を開く':next===3?'最初の投稿を作る':'タスクを確認する'}　→</button></section><section class="card"><div class="section-head"><div><p class="eyebrow">このフェーズの流れ</p><b>終わったらチェックするだけ</b></div><button class="plain-link" data-go="phase">すべて見る</button></div><div class="home-task-list">${tasks.map((task,i)=>`<button data-task="${state.phase}-${i}" class="home-task ${state.done[`${state.phase}-${i}`]?'done':''}"><span>${state.done[`${state.phase}-${i}`]?'✓':i+1}</span><div><b>${esc(task[0])}</b><small>${esc(task[1])}</small></div><i>${i===next?'今ここ':''}</i></button>`).join('')}</div></section><section class="card phase-preview"><p class="eyebrow">次に開く段階</p><b>PHASE ${phases[Math.min(state.phase+1,3)].number}｜${phases[Math.min(state.phase+1,3)].name}</b><p class="sub">${pct>=80?'準備ができました。次のフェーズへ進めます。':'いまのフェーズを80%まで進めると自動で開きます。'}</p>${pct>=80&&state.phase<3?'<button class="secondary" data-action="advance">次のフェーズへ進む</button>':''}</section>`; }
function phase(){ const p=currentPhase(), pct=progress(state.phase); return header(`PHASE ${p.number}｜${p.name}`,p.goal)+`<section class="card"><p class="eyebrow">進捗 ${pct}% · 80%で次へ</p><div class="meter"><i style="width:${pct}%"></i></div>${p.tasks.map((task,i)=>`<div class="step-task ${state.done[`${state.phase}-${i}`]?'done':''}"><button class="check" data-task="${state.phase}-${i}">${state.done[`${state.phase}-${i}`]?'✓':''}</button><div><b>${i+1}. ${task[0]}</b><small>${task[1]}</small></div>${i===0?'<button class="go-small" data-go="character">見る</button>':''}${i===3&&state.phase===0?'<button class="go-small" data-go="create">開く</button>':''}${i===0&&state.phase===2?`<a class="go-small" href="${links.sheet}" target="_blank" rel="noopener">入力</a>`:''}</div>`).join('')}</section>${pct>=80&&state.phase<3?'<section class="notice"><b>次のフェーズに進めます。</b><br>残りの項目は後から戻って進められます。<button class="primary" data-action="advance">PHASE '+phases[state.phase+1].number+'へ進む</button></section>':''}<button class="text-button" data-go="start">ホームへ戻る</button>`; }
function progressPage(){ return header('全体の進め方','各フェーズを80%まで進めると、次のフェーズが開きます。')+phases.map((_,i)=>phaseCard(i)).join('')+`<section class="card"><p class="eyebrow">進め方のルール</p><p class="sub">一度に全部を完璧にしません。完了にした項目は、あとで戻って修正できます。販売は、実際の反応が育つまで開きません。</p></section>`; }
function character(){ const profile=characterProfile(), editing=state.editingCharacter; const field=(label,key,multi=false)=>`<label class="editor-field"><span>${label}</span>${multi?`<textarea data-character-field="${key}">${esc(profile[key])}</textarea>`:`<input data-character-field="${key}" value="${esc(profile[key])}">`}</label>`; return header(`${profile.name}｜キャラクター基準書`,'画像・容姿・文章の基準を、投稿前にここで揃えます。')+`<section class="character-hero"><div><p class="eyebrow">CANONICAL CHARACTER</p>${editing?field('表示名','name'):`<h2>${esc(profile.name)}</h2>`}<p>整えていることで自分を保つ、33歳の不動産会社勤務。</p></div><span>AI GENERATED<br>FICTIONAL</span></section>${editing?`<section class="edit-notice"><b>編集中</b><span>保存すると、この端末の基準書・投稿案に反映されます。</span><button class="tiny-button" data-action="save-character">保存する</button><button class="text-inline" data-action="cancel-character">やめる</button></section>`:`<button class="edit-profile-button" data-action="edit-character">✎ プロフィールとプロンプトを編集</button>`}<section class="card"><p class="eyebrow">01 · 基準顔</p><p class="sub">生成時に必ず最初に参照する顔です。ここへ確定画像のURLを入れると、以後いつでも確認できます。</p>${assetCard('face','基準顔（正面・自然光）','顔立ち、髪色、肌、年齢感を固定するための1枚')}</section><section class="card"><p class="eyebrow">02 · 顔・容姿のベースプロンプト</p><div class="prompt-head"><b>コピーして画像生成へ使う</b><button class="tiny-button" data-action="copy-base-prompt">コピー</button></div>${editing?field('ベースプロンプト','basePrompt',true):`<div class="prompt-box">${esc(profile.basePrompt)}</div>`}<p class="hint">場面・服装・光は、この下に追加します。基準顔と矛盾する指定は加えません。</p></section><section class="card"><p class="eyebrow">03 · 容姿の基準画像</p><p class="sub">同じ人物に見えるかを確認するための補助画像です。顔だけでなく、姿勢・服・生活感を固定します。</p><div class="asset-grid">${assetCard('work','仕事中','濃紺ジャケット・姿勢・清潔感')}${assetCard('home','帰宅後','髪・肩・部屋でほどける表情')}${assetCard('weekend','休日','自然光・ゆるい髪・余裕のある表情')}</div></section><section class="card"><p class="eyebrow">04 · プロフィール</p>${editing?`<div class="profile-editor">${field('年齢・仕事','ageJob')}${field('体型・姿勢','bodyPosture',true)}${field('仕事の装い','workLook',true)}${field('生活の舞台','home',true)}${field('内面の核','core',true)}</div>`:`<dl class="profile-list">${profileItems(profile).map(([term,detail])=>`<div><dt>${esc(term)}</dt><dd>${esc(detail)}</dd></div>`).join('')}</dl>`}</section><section class="card"><p class="eyebrow">05 · 使うときの判断</p><p class="callout">完成されたポートレートより、髪を直す・バッグを下ろす・パンプスを脱ぐなど、生活の途中を選びます。</p><a class="link-row" href="${links.canon}" target="_blank" rel="noopener">00_基準・正典を開く　↗</a><a class="link-row" href="${links.drive}" target="_blank" rel="noopener">AOBA_X_運用を開く　↗</a><button class="secondary" data-go="create">この設定で画像案を作る</button></section>`; }
function create(){ const v=visualPrompts[state.visualVariant%visualPrompts.length]; return header('最初の画像を決める','画像生成の前に、あおばらしさと物語が合っているかを確認します。')+`<section class="card"><p class="eyebrow">${esc(v.title)}</p><p class="callout">${esc(v.reason)}</p><div class="prompt-head"><b>日本語プロンプト</b><button class="tiny-button" data-action="copy-prompt">コピー</button></div><div class="prompt-box">${esc(v.text)}</div><button class="secondary" data-action="next-visual">別案を見る</button></section><section class="card"><p class="eyebrow">投稿文</p><textarea id="post-text">${esc(v.caption||'')}</textarea><button class="primary" data-action="save-post">下書きとして保存</button></section>`; }
function posts(){ const plan=planForToday(); return header('今日の投稿設計','投稿の種類を選ぶと、あおばの話し方に合わせた下書きと画像案に切り替わります。公開はあなたの最終確認後です。')+`<section class="card theme-picker"><p class="eyebrow">今日は何を話す？</p><div class="theme-chips"><button class="theme-chip ${state.dailyTheme==='auto'?'selected':''}" data-theme="auto">おまかせ</button>${contentThemes.map(theme=>`<button class="theme-chip ${state.dailyTheme===theme.id?'selected':''}" data-theme="${theme.id}">${esc(theme.name)}</button>`).join('')}</div><p class="hint">${state.dailyTheme==='auto'?'曜日と時間に合わせた案です。':'「'+esc(contentThemes.find(theme=>theme.id===state.dailyTheme)?.hint||'')+'」'}</p></section><section class="card daily-plan"><p class="eyebrow">${plan.dateLabel} · ${plan.time}ごろ · ${plan.label}</p><p class="callout">${esc(plan.scene)}</p><p class="daily-draft">${esc(plan.text)}</p><p class="research-note">文章の基準：${esc(plan.research)}</p><details><summary>画像のALT案を見る</summary><p class="sub">${esc(plan.alt)}</p></details><button class="secondary" data-action="next-daily">別の言い方を見る</button><button class="primary" data-action="save-daily">今日の下書きに保存</button></section><section class="card"><p class="eyebrow">自然に見せるための収集基準</p><ul class="research-list">${writingResearch.map(item=>`<li>${esc(item)}</li>`).join('')}</ul><p class="sub">実在アカウントの文章は転載・模倣せず、観察・長さ・余白の設計だけを抽出しています。あおばはAI生成の架空キャラクターであることを、プロフィールと必要な表示で明示します。</p></section><section class="card"><p class="eyebrow">手動で作る</p><button class="primary" data-go="create">＋ 画像から投稿を作る</button></section>${state.posts.length?state.posts.map((p,i)=>`<article class="card post"><p>${esc(p.text)}</p><small>${esc(p.time)} · 下書き</small><button class="secondary" data-share="${i}">Xで下書きを開く</button></article>`).join(''):`<section class="empty"><b>まだ保存した下書きはありません。</b><p>まずは今日の案を確認してから保存しましょう。</p></section>`}`; }
function resources(){ return header('資料とデータ','画像・正典・分析を、AOBA_X_運用の構成に合わせて開けます。')+`<section class="card"><p class="eyebrow">AOBA_X_運用</p><button class="list-link" data-go="character"><span><b>あおばの基本情報</b><small>外見・内面・投稿の基準</small></span><span>›</span></button><a class="list-link" href="${links.canon}" target="_blank" rel="noopener"><span><b>00_基準・正典</b><small>別チャットで作成中の基準画像・正典データベース</small></span><span>↗</span></a><a class="list-link" href="${links.homeImages}" target="_blank" rel="noopener"><span><b>01_自宅</b><small>帰宅後・生活シーンの画像</small></span><span>↗</span></a><a class="list-link" href="${links.workImages}" target="_blank" rel="noopener"><span><b>02_仕事</b><small>勤務・内見・不動産投稿用の画像</small></span><span>↗</span></a><a class="list-link" href="${links.weekendImages}" target="_blank" rel="noopener"><span><b>03_休日</b><small>休日・余白のある生活シーンの画像</small></span><span>↗</span></a><a class="list-link" href="${links.drive}" target="_blank" rel="noopener"><span><b>フォルダ全体を開く</b><small>AOBA_X_運用</small></span><span>↗</span></a><a class="list-link" href="${links.sheet}" target="_blank" rel="noopener"><span><b>分析データ</b><small>日次入力・投稿ログ・改善提案</small></span><span>↗</span></a></section><section class="card"><p class="eyebrow">アプリを最初から始める</p><p class="sub">進捗と、この端末に保存した下書きを初期状態に戻します。Drive・スプレッドシート・Xの内容は変更しません。</p><button class="danger" data-action="ask-reset">初期化する</button></section>${state.resetConfirm?`<div class="modal-backdrop"><section class="modal"><p class="eyebrow">最終確認</p><h2>本当に初期化しますか？</h2><p>この端末の進捗と下書きだけを消し、PHASE 01から始めます。外部データは消えません。</p><button class="danger" data-action="confirm-reset">初期化を実行する</button><button class="secondary" data-action="cancel-reset">やめる</button></section></div>`:''}`; }
function nav(){ return `<nav class="nav"><button class="${state.tab==='start'?'active':''}" data-go="start"><span>⌂</span><small>ホーム</small></button><button class="${state.tab==='phase'?'active':''}" data-go="phase"><span>✓</span><small>進め方</small></button><button class="${state.tab==='create'?'active':''}" data-go="create"><span>＋</span><small>投稿作成</small></button><button class="${state.tab==='posts'?'active':''}" data-go="posts"><span>▤</span><small>今日の運用</small></button><button data-action="drawer"><span>☰</span><small>メニュー</small></button></nav>`; }
function render(){ const pages={start,phase,progress:progressPage,character,create,posts,resources}; document.querySelector('#app').innerHTML=(pages[state.tab]||start)()+nav()+drawer(); bind(); save(); }
function bind(){
  document.querySelectorAll('[data-go]').forEach(el=>el.onclick=()=>go(el.dataset.go));
  document.querySelectorAll('[data-task]').forEach(el=>el.onclick=()=>{const key=el.dataset.task; state.done[key]=!state.done[key]; render();});
  document.querySelectorAll('[data-phase]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.phase); if(unlocked(i)){state.phase=i;state.tab='phase';render();}});
  document.querySelector('[data-action="advance"]')?.addEventListener('click',()=>{if(state.phase<3&&progress(state.phase)>=80){state.phase++;state.tab='phase';render();}});
  document.querySelector('[data-action="back"]')?.addEventListener('click',back);
  document.querySelectorAll('[data-action="drawer"]').forEach(el=>el.onclick=()=>{state.drawerOpen=true;render();});
  document.querySelectorAll('[data-action="close-drawer"]').forEach(el=>el.onclick=()=>{state.drawerOpen=false;render();});
  document.querySelector('[data-action="next-visual"]')?.addEventListener('click',()=>{state.visualVariant=(state.visualVariant+1)%visualPrompts.length;render();});
  document.querySelector('[data-action="copy-prompt"]')?.addEventListener('click',()=>copyText(visualPrompts[state.visualVariant%visualPrompts.length].text));
  document.querySelector('[data-action="copy-base-prompt"]')?.addEventListener('click',()=>copyText(characterProfile().basePrompt));
  document.querySelector('[data-action="edit-character"]')?.addEventListener('click',()=>{state.editingCharacter=true;render();});
  document.querySelector('[data-action="cancel-character"]')?.addEventListener('click',()=>{state.editingCharacter=false;render();});
  document.querySelector('[data-action="save-character"]')?.addEventListener('click',()=>{const next={...characterProfile()}; document.querySelectorAll('[data-character-field]').forEach(el=>next[el.dataset.characterField]=el.value.trim()); state.characterProfile=next; state.editingCharacter=false; render();});
  document.querySelectorAll('[data-action="set-asset"]').forEach(el=>el.onclick=()=>{const key=el.dataset.asset; const url=window.prompt('画像の直接URLを貼り付けてください。Driveの共有ページURLではなく、画像そのものを開いたURLを使います。',state.characterAssets?.[key]||''); if(url===null) return; state.characterAssets={...state.characterAssets,[key]:url.trim()}; render();});
  document.querySelectorAll('[data-action="clear-asset"]').forEach(el=>el.onclick=()=>{const key=el.dataset.asset; state.characterAssets={...state.characterAssets,[key]:''}; render();});
  document.querySelector('[data-action="save-post"]')?.addEventListener('click',()=>{const text=document.querySelector('#post-text').value.trim();if(text) state.posts.unshift({text,time:'承認待ち'}); state.tab='posts';render();});
  document.querySelector('[data-action="next-daily"]')?.addEventListener('click',()=>{const selected=contentThemes.find(theme=>theme.id===state.dailyTheme); const count=selected?.lines.length||3; state.dailyVariant=(state.dailyVariant+1)%count;render();});
  document.querySelectorAll('[data-theme]').forEach(el=>el.onclick=()=>{state.dailyTheme=el.dataset.theme;state.dailyVariant=0;render();});
  document.querySelector('[data-action="save-daily"]')?.addEventListener('click',()=>{const plan=planForToday(); const exists=state.posts.some(post=>post.dailyKey===`${plan.dateLabel}-${plan.time}`); if(!exists) state.posts.unshift({text:plan.text,time:`${plan.dateLabel} ${plan.time} · 承認待ち`,dailyKey:`${plan.dateLabel}-${plan.time}`}); render();});
  document.querySelectorAll('[data-share]').forEach(el=>el.onclick=()=>window.open('https://x.com/intent/post?text='+encodeURIComponent(state.posts[Number(el.dataset.share)].text),'_blank','noopener'));
  document.querySelector('[data-action="ask-reset"]')?.addEventListener('click',()=>{state.resetConfirm=true;render();});
  document.querySelector('[data-action="cancel-reset"]')?.addEventListener('click',()=>{state.resetConfirm=false;render();});
  document.querySelector('[data-action="confirm-reset"]')?.addEventListener('click',()=>{Object.assign(state,defaultState()); localStorage.removeItem(STORE_KEY); render();});
}
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
render(); loadLatestRecommendation().then(render);
