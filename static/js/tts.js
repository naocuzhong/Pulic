/**
 * ============================================================================
 *  福医卒中通 · 脑卒中智能问答助手
 *  文件名称：tts.js
 *  文件功能：语音播报核心：音色选择、多音字修正、分片朗读
 *  依赖文件：core.js, i18n.js
 * ----------------------------------------------------------------------------
 *  项目简介：面向脑卒中患者及家属的健康科普问答系统，提供文字/语音
 *            咨询、语音播报（TTS）、录音识别（ASR）、健康问答流式输出、
 *            聊天记录导出、头像个性化等功能。
 *  前端技术：HTML5 + CSS3 + 原生 JavaScript（ES2017+）
 *  后端技术：Python 3 + Flask + 阿里云 DashScope（大模型）+ 讯飞语音听写
 *  部署方式：GitHub + Render 云服务平台
 *  兼容环境：Chrome / Edge / Safari，适配移动端与桌面端
 * ============================================================================
 */

/* ================================================================
	   🔊 语音播报核心
	   ================================================================ */
	let allVoices = [], voicesReady = false;
	/**
	 * 加
	 *
	 * 载
	 */
	function loadVoices(){
	    if (!synth) return;
	    const v = synth.getVoices() || [];
	    if (v.length) { allVoices = v; voicesReady = true; }
	}
	if (synth) {
	    loadVoices();
	    if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = loadVoices;
	    synth.addEventListener?.('voiceschanged', loadVoices);
	    let tries = 0;
	    const retryTimer = setInterval(() => {
	        if (voicesReady || tries++ > 12) { clearInterval(retryTimer); return; }
	        loadVoices();
	    }, 250);
	}
	const MALE_HINTS = [
	    'kangkang','康康','yunyang','云扬','yunxi','云希','yunjian','云健','yunye','云野','yunxia','云夏',
	    'zhiwei','志威','danny','limu','力牧','li-mu',
	    'david','mark','guy','james','alex','daniel','richard','sean','ravi','george','arthur',
	    'male','男'
	];
	const FEMALE_HINTS = [
	    'huihui','慧慧','yaoyao','瑶瑶','xiaoxiao','晓晓','xiaoyi','晓伊','xiaohan','晓涵','xiaoxuan','晓萱','xiaochen','晓澄',
	    'yating','雅婷','hanhan','涵涵','hoda','heera','kalpana',
	    'tingting','婷婷','ting-ting','meijia','美佳','mei-jia','sinji','善怡','sin-ji','wanlung',
	    'tracy','zira','susan','jenny','aria','michelle','samantha','victoria','catherine','hazel','linda','kate','serena','tessa','fiona','monica','ava','allison','nicky',
	    'female','女'
	];
	/**
	 * 按性别与语言从系统音色池中挑选最合适的朗读音色。
	 *
	 * @param {string} gender auto/female/male
	 * @param {string} langCode 语言代码如 zh-CN
	 * @returns {?SpeechSynthesisVoice} 选中的音色
	 */
	function pickVoice(gender, langCode){
	    if (!allVoices.length) return null;
	    const prefix = (langCode || 'zh-CN').slice(0, 2).toLowerCase();
	    let pool = allVoices.filter(v => v.lang && String(v.lang).toLowerCase().replace('_','-').startsWith(prefix));
	    if (!pool.length) pool = allVoices.filter(v => /^zh/i.test(String(v.lang || '')));
	    if (!pool.length) pool = allVoices;
	    if (gender === 'male' || gender === 'female') {
	        const hints = gender === 'male' ? MALE_HINTS : FEMALE_HINTS;
	        let hit = pool.find(v => { const n = String(v.name || '').toLowerCase(); return hints.some(h => n.includes(h)); });
	        if (hit) return hit;
	        hit = pool.find(v => { const u = String(v.voiceURI || v.voice_id || '').toLowerCase(); return hints.some(h => u.includes(h)); });
	        if (hit) return hit;
	        return null;
	    }
	    return pool.find(v => v.default) || pool.find(v => v.localService) || pool[0] || null;
	}
	const PRON_DICT = {
	    '脑卒中': '脑促众',
	    '卒中':   '促众',
	    '供血':   '功血',
	    '供氧':   '功氧',
	    '冠心病':   '官心病',
	    '冠状动脉': '官状动脉',
	    '荨麻疹': '寻麻疹',
	    '脂肪':   '知房'
	};
	/**
	 * 多音字发音修正：按内置词典替换易读错词（如"卒中"->"促众"）。
	 *
	 * @param {string} text 原始文本
	 * @returns {string} 修正后文本
	 */
	function applyPronunciation(text){
	    let t = String(text || '');
	    const keys = Object.keys(PRON_DICT).sort((a, b) => b.length - a.length);
	    for (const k of keys) { if (t.includes(k)) t = t.split(k).join(PRON_DICT[k]); }
	    return t;
	}
	const VOICE_RATES = [0.5, 0.75, 1, 1.5, 2];
	const GENDERS = ['auto', 'female', 'male'];
	let voiceEnabled = safeGet('fyyzt_voice_enabled', '1') !== '0';
	let voiceRate = 1;
	(function(){ const r = parseFloat(safeGet('fyyzt_voice_rate', '1')); voiceRate = VOICE_RATES.includes(r) ? r : 1; })();
	let voiceGender = safeGet('fyyzt_voice_gender', 'auto');
	if (!GENDERS.includes(voiceGender)) voiceGender = 'auto';
	/**
	 * 同
	 *
	 * 步
	 */
	function updateVoiceUI(){
	    const t = getEl('voiceToggle');
	    if (t) { t.classList.toggle('on', voiceEnabled); t.setAttribute('aria-checked', voiceEnabled ? 'true' : 'false'); }
	    const st = getEl('voiceStateTxt');
	    if (st) st.textContent = voiceEnabled ? tr('voiceOnState') : tr('voiceOffState');
	    document.querySelectorAll('.preset-btn[data-rate]').forEach(b => {
	        b.classList.toggle('active', Math.abs(parseFloat(b.dataset.rate) - voiceRate) < 0.001);
	    });
	    document.querySelectorAll('.preset-btn[data-gender]').forEach(b => {
	        b.classList.toggle('active', b.dataset.gender === voiceGender);
	    });
	}
	/**
	 * 设置语音播报开关并持久化。
	 *
	 * @param {boolean} v 开关状态
	 */
	function setVoiceEnabled(v){ voiceEnabled = v; safeSet('fyyzt_voice_enabled', v ? '1' : '0'); updateVoiceUI(); }
	/**
	 * 切
	 *
	 * 换
	 */
	function toggleVoice(){
	    if (!synth) { toast(tr('voiceUnsupported')); return; }
	    setVoiceEnabled(!voiceEnabled);
	    if (!voiceEnabled) stopSpeaking();
	}
	/**
	 * 设置播报速度并持久化。
	 *
	 * @param {number} r 速度倍率（0.5/0.75/1/1.5/2）
	 */
	function setVoiceRate(r){
	    if (!VOICE_RATES.includes(r)) r = 1;
	    voiceRate = r; safeSet('fyyzt_voice_rate', String(r)); updateVoiceUI();
	}
	/**
	 * 设置播报音色性别偏好并持久化。
	 *
	 * @param {string} g auto/female/male
	 */
	function setVoiceGender(g){
	    if (!GENDERS.includes(g)) g = 'auto';
	    voiceGender = g; safeSet('fyyzt_voice_gender', g); updateVoiceUI();
	}
	let ttsUnlocked = false;
	/**
	 * 解
	 *
	 * 锁
	 */
	function unlockTTS(){
	    if (ttsUnlocked || !synth) return; ttsUnlocked = true;
	    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch(e){}
	}
	let speakSession = 0, speakingMsg = null;
	/**
	 * 将长文本按句读与最大长度切分为适合朗读的分片队列。
	 *
	 * @param {string} text 原文
	 * @param {number} [maxLen] 单片最大长度，默认 110
	 * @returns {string[]} 分片数组
	 */
	function splitChunks(text, maxLen){
	    maxLen = maxLen || 110; const out = []; let buf = '';
	    for (const ch of String(text)) {
	        buf += ch;
	        if (buf.length >= maxLen || '。！？!?；;\n'.indexOf(ch) >= 0) { if (buf.trim()) out.push(buf.trim()); buf = ''; }
	    }
	    if (buf.trim()) out.push(buf.trim());
	    return out.length ? out : [String(text)];
	}
	/**
	 * 切换某条消息的"播放中"样式。
	 *
	 * @param {?HTMLElement} msgEl 消息元素
	 * @param {boolean} on 是否播放中
	 */
	function markSpeaking(msgEl, on){
	    if (!msgEl) return;
	    const b = msgEl.querySelector('.speak-btn'); if (b) b.classList.toggle('speaking', !!on);
	}
	/**
	 * 复
	 *
	 * 位
	 */
	function resetSpeakIcons(){ if (speakingMsg) { markSpeaking(speakingMsg, false); speakingMsg = null; } }
	/**
	 * 停
	 *
	 * 止
	 */
	function stopSpeaking(){
	    speakSession++;
	    try { synth && synth.cancel(); } catch(e){}
	    resetSpeakIcons();
	}
	/**
	 * 朗读指定文本：多音字修正 -> 分片 -> 依序合成播放，可标记来源消息。
	 *
	 * @param {string} text 待朗读文本
	 * @param {?HTMLElement} [msgEl] 来源消息元素
	 */
	function speakText(text, msgEl){
	    if (!synth || !text) return;
	    stopSpeaking();
	    const session = speakSession;
	    const langCode = lang === 'zh' ? 'zh-CN' : 'en-US';
	    const voice = pickVoice(voiceGender, langCode);
	    const chunks = splitChunks(applyPronunciation(text));
	    let i = 0;
	    const next = () => {
	        if (session !== speakSession) return;
	        if (i >= chunks.length) { resetSpeakIcons(); return; }
	        let u;
	        try { u = new SpeechSynthesisUtterance(chunks[i++]); } catch(e) { resetSpeakIcons(); return; }
	        if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = langCode; }
	        u.rate = voiceRate;
	        u.onend = () => { if (session === speakSession) next(); };
	        u.onerror = () => { if (session === speakSession) resetSpeakIcons(); };
	        try { synth.speak(u); } catch(e) { resetSpeakIcons(); }
	    };
	    if (msgEl) { speakingMsg = msgEl; markSpeaking(msgEl, true); }
	    setTimeout(next, 90);
	}
	/**
	 * 点击消息下方喇叭：未播则播放并开启自动播报；播放中点击则停止并关闭自动播报。
	 *
	 * @param {HTMLElement} btn 喇叭按钮
	 * @param {string} text 消息文本
	 */
	function toggleSpeakMessage(btn, text){
	    if (!synth) { toast(tr('voiceUnsupported')); return; }
	    if (audioBusy) { toast(tr('audioRecordingNow')); return; }
	    if (speakingMsg) { stopSpeaking(); setVoiceEnabled(false); toast(tr('voiceStopped')); return; }
	    if (!text) return;
	    setVoiceEnabled(true);
	    speakText(text, btn.closest('.message'));
	    toast(tr('voicePlaying'));
	}
	/**
	 * 按
	 *
	 * 当
	 */
	function previewVoice(){
	    if (!synth) { toast(tr('voiceUnsupported')); return; }
	    stopSpeaking();
	    const langCode = lang === 'zh' ? 'zh-CN' : 'en-US';
	    const voice = pickVoice(voiceGender, langCode);
	    const u = new SpeechSynthesisUtterance(applyPronunciation(tr('voicePreviewText')));
	    if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = langCode; }
	    u.rate = voiceRate;
	    try { synth.speak(u); } catch(e) { console.error(e); }
	}
