const STORE_KEY = 'aoba-x-operator-v06';
const APP_RELEASE = '2026-08-17 08:05 JST';
const LOCAL_OPERATOR_ORIGIN = 'http://127.0.0.1:3001';
const isLocalOperator = location.protocol === 'http:' && location.port === '3001';
const links = {
  canon: 'https://drive.google.com/file/d/1s9tM9W060GzpbriIaAxPwdsIa6Yh6VVE/view',
  drive: 'https://drive.google.com/drive/folders/1KDJOfjR0wxte2op2ZJVxKa7JX5JFOPKL',
  sheet: 'https://docs.google.com/spreadsheets/d/1d3vwBxZP5ng8ni-4m7HjZmUHv-8anG-vhfzFbI1kk1o/edit',
  operator: isLocalOperator ? `${location.origin}/` : `${LOCAL_OPERATOR_ORIGIN}/`
};
let apiStatus = isLocalOperator ? {loading:true} : null;

const categories = [
  {id:'reach', name:'PV入口型', role:'まず止まってもらう', metric:'表示回数・プロフィール遷移', color:'sky'},
  {id:'fan', name:'親近感・ファン化型', role:'人柄を好きになってもらう', metric:'返信率・再訪', color:'rose'},
  {id:'knowledge', name:'超やさしい不動産知識型', role:'フォローする理由を作る', metric:'保存的反応・フォロー転換', color:'mint'},
  {id:'work', name:'仕事のリアル型', role:'職業と世界観を伝える', metric:'プロフィール遷移・返信', color:'amber'}
];

const drafts = [
  {id:'01',category:'reach',pillar:'休日',title:'パン屋さんの前で振り返る',image:'./assets/aoba/weekend-bakery-aoba-v01-20260817.png',objective:'タイムライン停止率とプロフィール遷移',hypothesis:'歩いている途中に撮影者へ振り返る動きと柔らかな笑顔は、正面セルフィーより自然な初見停止を作りやすい',variable:'撮影方式を腕を伸ばすセルフィーから撮影者を意識した非セルフィーへ変更',text:'パン屋さんの前で、もう一回呼ばれた。\n振り向いた瞬間、ちゃんと撮れてた？🌿',alt:'休日の街歩き中、パン屋で買った紙袋を抱えて振り返り、撮影者へ柔らかく微笑む23歳のあおば。淡いブルーのミディワンピースと小さなブラウンのショルダーバッグを身につけています。AI生成の架空キャラクターです。'},
  {id:'02',category:'fan',pillar:'自宅',title:'部屋着で洗濯物と格闘中',image:'./assets/aoba/home-laundry-aoba-v01-20260817.png',objective:'返信率と再訪につながる親近感',hypothesis:'飾らない部屋着と家事の途中に見せる明るい表情は、作り込んだポーズより日常への親近感を作りやすい',variable:'自宅写真を固定鏡から床座りの手持ちセルフィーへ変更',text:'たたみ始めたら、白い服ばっかりでした。\n部屋着のまま、あと少しだけやります。',alt:'自宅でソファを背に床へ座り、白い洗濯物をたたみながら手持ちインカメで撮影する23歳のあおば。セージグリーンのTシャツとアイボリーのルームパンツを着て、カメラへ柔らかく微笑んでいます。AI生成の架空キャラクターです。'},
  {id:'03',category:'knowledge',pillar:'仕事',title:'入社1年目に知った、管理費と修繕積立金',image:'./assets/aoba/work-fees-aoba-v01-20260817.png',objective:'保存的反応とフォロー理由の形成',hypothesis:'新人本人の発見から専門用語を生活語へ翻訳すると、初見でも役立つアカウントだと理解されやすい',variable:'冒頭を定義ではなく入社1年目の本人の発見から始める',source:'国土交通省「住まリテ｜住まいにはどんな費用がかかる？」',text:'入社1年目。\nこれ、働きはじめて初めて知ったんだけど。\n\nマンションの「管理費」は、廊下やエレベーターを毎日ちゃんと使えるようにするお金。\n「修繕積立金」は、将来の大きな修理のために、みんなで少しずつ貯めるお金です。\n\n似ているけど、役目は別なんです。',alt:'不動産会社のデスクで物件の募集資料を開き、ペンを持って撮影者へ柔らかく微笑む23歳のあおば。ダスティブルーのアシンメトリーブラウスを着ています。AI生成の架空キャラクターです。'},
  {id:'04',category:'work',pillar:'仕事',title:'鍵を3回確認した朝',image:'./assets/aoba/work-first-viewing-aoba-v01-20260817.png',objective:'新卒入社1年目の職業設定の理解とプロフィール遷移',hypothesis:'仕事ができすぎる姿より、忘れ物を気にする新人の小さな緊張を見せる方が、職業設定と人柄を同時に伝えやすい',variable:'仕事の成果ではなく出発前の新人らしい一動作を主題にする',text:'入社1年目。\n今日は初めて、一人で内見へ。\n心配で鍵をもう3回見ました。行ってきます。',alt:'初めて一人で内見へ向かう前、不動産会社の入口で鍵、物件ファイル、メジャーを持ち、撮影者へ少し緊張した柔らかな笑顔を向ける23歳のあおば。アイボリーのブラウスとくすんだブルーのミディスカートを着ています。AI生成の架空キャラクターです。'}
];

// ぶら下がりは投稿ごとに判断する。不要な投稿は意図的に空欄のまま表示する。
for (const draft of drafts) draft.replyText = draft.id === '03'
  ? 'お部屋を探したとき、この2つの違いを知っていましたか？\n私は入社するまで、どちらも同じようなお金だと思っていました。'
  : '';

const defaultAssets = {
  face:'./assets/aoba/face-master-contact-triptych-v01.png',
  work:'./assets/aoba/work-fees-aoba-v01-20260817.png',
  home:'./assets/aoba/home-laundry-aoba-v01-20260817.png',
  weekend:'./assets/aoba/weekend-bakery-aoba-v01-20260817.png'
};
const defaultState = () => ({tab:'home',selected:'03',metrics:[],assets:{...defaultAssets},notice:''});
const storedState = JSON.parse(localStorage.getItem(STORE_KEY) || 'null') || {};
const state = Object.assign(defaultState(), storedState);
state.assets = {...defaultAssets};
const save = () => localStorage.setItem(STORE_KEY, JSON.stringify(state));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const category = draft => categories.find(item => item.id === draft.category);
const selectedDraft = () => drafts.find(item => item.id === state.selected) || drafts[2];
const previewUrl = draft => `${links.operator.replace(/\/$/,'')}/preview?post_id=${encodeURIComponent(draft.id)}`;

function apiStatusCard() {
  if (!isLocalOperator) return `<section class="card api-card"><div class="api-head"><div><p class="eyebrow">X API</p><h2>スマホで投稿予約</h2></div><span class="api-badge standby">Mac連携</span></div><p>Macと同じWi-Fiなら、本文・ALT・ぶら下がり・日時を編集して予約できます。Macの「AOBA投稿」画面に表示されるスマホ用URLをChromeで開き、初回だけ6桁コードを入力してください。</p><p class="approval-note">Mac名やXの秘密情報は公開版へ保存しません。</p></section>`;
  if (apiStatus?.loading) return `<section class="card api-card"><p class="eyebrow">X API</p><h2>接続を確認中…</h2></section>`;
  if (!apiStatus?.connected) return `<section class="card api-card"><div class="api-head"><div><p class="eyebrow">X API</p><h2>接続を確認できません</h2></div><span class="api-badge danger">要確認</span></div><p>${esc(apiStatus?.error || 'ローカル投稿機能を確認してください。')}</p><button class="secondary" data-refresh-api>再確認する</button></section>`;
  const badge = apiStatus.expired ? '<span class="api-badge danger">権限更新</span>' : '<span class="api-badge ready">接続済み</span>';
  return `<section class="card api-card"><div class="api-head"><div><p class="eyebrow">X API</p><h2>${esc(apiStatus.account)} に接続</h2></div>${badge}</div><dl><dt>投稿権限</dt><dd>${apiStatus.expired?'更新が必要':'利用可能'}</dd><dt>予約中</dt><dd>${esc(apiStatus.scheduled || 0)}件</dd><dt>Sheets反映待ち</dt><dd>${esc(apiStatus.pendingSheets)}件</dd><dt>投稿処理</dt><dd>${esc(apiStatus.operation || (apiStatus.publishing?'処理中':'未処理なし'))}</dd></dl>${apiStatus.expired?`<a class="primary link" href="${links.operator}">投稿権限を更新する</a>`:'<button class="secondary" data-refresh-api>状態を再確認</button>'}</section>`;
}

function shell(title, subtitle, body) {
  return `<header class="top"><div><p class="eyebrow">AOBA X OPERATOR · v07</p><h1>${esc(title)}</h1><p class="sub">${esc(subtitle)}</p><p class="release">最終更新 ${esc(APP_RELEASE)}</p></div><span class="status-dot" title="公開は必ず本人承認"></span></header>${body}${nav()}`;
}

function home() {
  const draft = selectedDraft(), cat = category(draft);
  return shell('今日やること','キャラクターは固定。マーケティングは毎回ひとつだけ変えます。',`
    <section class="hero"><p class="eyebrow">TODAY</p><h2>投稿案を1本確認する</h2><p>画像・本文・根拠・テスト変数を確認してから、Macの投稿画面へ進みます。</p><button class="primary light" data-go="draft">本命案を見る</button></section>
    ${apiStatusCard()}
    <section class="steps"><article><b>1</b><div><strong>Research</strong><span>直近傾向と自分の実績を分けて見る</span></div></article><article><b>2</b><div><strong>Test</strong><span>一度に変えるのは1要素だけ</span></div></article><article><b>3</b><div><strong>Measure</strong><span>24時間・7日後にKeep / Kill / Modify</span></div></article></section>
    <section class="card featured ${cat.color}"><div class="card-head"><span class="pill">${esc(cat.name)}</span><small>${esc(draft.pillar)}</small></div><img src="${draft.image}" alt="${esc(draft.alt)}"><h2>${esc(draft.title)}</h2><p class="post-copy">${esc(draft.text)}</p><button class="primary" data-go="draft">根拠とALTを確認</button></section>
    <section class="card"><p class="eyebrow">4つの役割</p><div class="category-grid">${categories.map(item=>`<button class="category ${item.color}" data-category="${item.id}"><b>${esc(item.name)}</b><span>${esc(item.role)}</span><small>${esc(item.metric)}</small></button>`).join('')}</div></section>`);
}

function draftPage() {
  const draft = selectedDraft(), cat = category(draft);
  return shell('投稿前の確認','公開ではありません。ここで内容と検証条件を揃えます。',`
    <section class="draft-tabs">${drafts.map(item=>`<button class="${item.id===draft.id?'active':''}" data-draft="${item.id}">${item.id}<small>${esc(category(item).name)}</small></button>`).join('')}</section>
    <article class="card preview ${cat.color}"><img src="${draft.image}" alt="${esc(draft.alt)}"><div class="card-head"><span class="pill">${esc(cat.name)}</span><small>${esc(draft.pillar)}</small></div><h2>${esc(draft.title)}</h2><p class="post-copy">${esc(draft.text)}</p><details><summary>画像のALT</summary><p>${esc(draft.alt)}</p></details></article>
    <section class="card thread-card"><p class="eyebrow">THREAD</p><h2>ぶら下がり投稿</h2><div class="thread-field ${draft.replyText?'':'empty-field'}">${draft.replyText?esc(draft.replyText):'　'}</div><p class="approval-note">PVと返信率の仮説から必要な投稿だけ使います。空欄の場合は投稿しません。</p></section>
    <section class="card experiment"><h2>この投稿で確かめること</h2><dl><dt>目的</dt><dd>${esc(draft.objective)}</dd><dt>仮説</dt><dd>${esc(draft.hypothesis)}</dd><dt>変えるのは1つ</dt><dd>${esc(draft.variable)}</dd>${draft.source?`<dt>事実確認</dt><dd>${esc(draft.source)}</dd>`:''}</dl><p class="safe">AI生成画像：API投稿時は <code>made_with_ai: true</code></p><button class="secondary" data-copy="text">本文をコピー</button><button class="secondary" data-copy="alt">ALTをコピー</button><a class="primary link" href="${previewUrl(draft)}">編集して投稿予約へ</a><p class="approval-note">Macと同じWi-Fiのスマホでは、次の画面で本文・ALT・ぶら下がり・日時を編集して予約できます。</p></section>`);
}

function measure() {
  const rows = state.metrics.length ? state.metrics.map(item=>`<article class="metric-row"><b>${esc(item.postId)}</b><span>${esc(item.label)}</span><small>表示 ${esc(item.impressions || '—')}／プロフィール ${esc(item.profile || '—')}</small></article>`).join('') : '<div class="empty">まだ実測値はありません。投稿後に入力します。</div>';
  return shell('計測する','推測値は入れず、24時間後と7日後の実測だけを残します。',`
    ${isLocalOperator?`<section class="card api-card"><div class="api-head"><div><p class="eyebrow">X API</p><h2>実測値を自動取得</h2></div><span class="api-badge ready">Mac</span></div><form method="post" action="/metrics"><label>Post ID<input name="post_id" inputmode="numeric" pattern="[0-9]+" required></label><label>記録時点<select name="label"><option value="24h">24時間後</option><option value="7d">7日後</option><option value="manual">手動確認</option></select></label><button class="primary">Xから数値を取得</button></form></section>`:''}
    <section class="card"><h2>${isLocalOperator?'補助：手入力で端末に記録':'実測値を端末に記録'}</h2><form id="metric-form"><label>Post ID<input name="postId" inputmode="numeric" required></label><label>記録時点<select name="label"><option>24時間後</option><option>7日後</option></select></label><div class="two"><label>表示回数<input name="impressions" inputmode="numeric"></label><label>プロフィール遷移<input name="profile" inputmode="numeric"></label></div><button class="primary">端末内に記録</button></form></section>
    <section class="card"><h2>判断ルール</h2><ul><li>直近投稿群の中央値と比較</li><li>強い型は派生を増やす（Keep）</li><li>弱い型は止める（Kill）</li><li>中間は1要素だけ変える（Modify）</li></ul></section>${rows}
    <a class="resource" href="${links.sheet}" target="_blank" rel="noopener">分析スプレッドシートを開く ↗</a>`);
}

function assets() {
  const labels={face:'00 顔マスター',work:'仕事',home:'自宅',weekend:'休日'};
  return shell('基準画像','Drive正本を反映した全端末共通の画像です。',`
    <p class="notice">基準画像は全端末共通です。Drive正本を確認してGitHub Pagesへ反映した最新版を表示しています。</p><section class="asset-grid">${Object.entries(labels).map(([key,label])=>`<article class="asset"><div class="asset-image">${state.assets[key]?`<img src="${state.assets[key]}" alt="${esc(label)}">`:'<span>未選択</span>'}</div><b>${esc(label)}</b><span class="canonical-badge">共通の正本</span></article>`).join('')}</section>
    <section class="card"><p class="eyebrow">正本</p><a class="resource" href="${links.canon}" target="_blank" rel="noopener">運用・収益化設計 v04 ↗</a><a class="resource" href="${links.drive}" target="_blank" rel="noopener">hieroglyph Drive ↗</a></section>`);
}

function nav(){return `<nav><button class="${state.tab==='home'?'active':''}" data-go="home">⌂<small>ホーム</small></button><button class="${state.tab==='draft'?'active':''}" data-go="draft">▣<small>投稿案</small></button><button class="${state.tab==='measure'?'active':''}" data-go="measure">↗<small>分析</small></button><button class="${state.tab==='assets'?'active':''}" data-go="assets">◎<small>基準画像</small></button></nav>`;}

function imageFileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>{const image=new Image();image.onerror=reject;image.onload=()=>{const scale=Math.min(1,1000/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.round(image.width*scale);canvas.height=Math.round(image.height*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.8));};image.src=reader.result;};reader.readAsDataURL(file);});}
async function copyText(value){await navigator.clipboard.writeText(value);state.notice='コピーしました。';render();}

function bind(){
  document.querySelectorAll('[data-go]').forEach(button=>button.onclick=()=>{state.tab=button.dataset.go;render();});
  document.querySelectorAll('[data-draft]').forEach(button=>button.onclick=()=>{state.selected=button.dataset.draft;render();});
  document.querySelectorAll('[data-category]').forEach(button=>button.onclick=()=>{const found=drafts.find(item=>item.category===button.dataset.category);if(found){state.selected=found.id;state.tab='draft';render();}});
  document.querySelectorAll('[data-copy]').forEach(button=>button.onclick=()=>copyText(selectedDraft()[button.dataset.copy]));
  document.querySelector('#metric-form')?.addEventListener('submit',event=>{event.preventDefault();const values=Object.fromEntries(new FormData(event.currentTarget));state.metrics.unshift({...values,createdAt:new Date().toISOString()});state.notice='実測値を端末内に記録しました。';render();});
  document.querySelectorAll('[data-asset]').forEach(input=>input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{state.assets[input.dataset.asset]=await imageFileToDataUrl(file);state.notice=`${file.name} を端末内に保存しました。`;}catch{state.notice='画像を読み込めませんでした。';}render();});
  document.querySelectorAll('[data-clear]').forEach(button=>button.onclick=()=>{state.assets[button.dataset.clear]='';state.notice='画像を外しました。';render();});
  document.querySelectorAll('[data-refresh-api]').forEach(button=>button.onclick=refreshApiStatus);
}

function render(){const pages={home,draft:draftPage,measure,assets};document.querySelector('#app').innerHTML=pages[state.tab]?.()||home();bind();save();}
render();
async function refreshApiStatus(){if(!isLocalOperator)return;apiStatus={loading:true};render();try{const response=await fetch('/api/status',{cache:'no-store'});apiStatus=await response.json();}catch{apiStatus={connected:false,error:'X APIの状態を取得できませんでした。'};}render();}
if(isLocalOperator)refreshApiStatus();
if('serviceWorker' in navigator && !isLocalOperator){
  let reloadingForUpdate=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(reloadingForUpdate)return;
    reloadingForUpdate=true;
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then(registration=>registration.update()).catch(()=>{});
}
