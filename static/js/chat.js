/**
 * ============================================================================
 *  福医卒中通 · 脑卒中智能问答助手
 *  文件名称：chat.js
 *  文件功能：聊天主逻辑：消息渲染、流式收发、悬浮装饰、事件绑定
 *  依赖文件：core.js, i18n.js, tts.js, avatar.js, stt.js, pdf.js
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

/* ================= 🎈 背景悬浮祝福语 / 表情包 ================= */
	const DECOR_EMOJI = ['😊','🌸','💪','💙','🌈','✨','🍀','🎈','☀️','🧡','🕊️','🌷','👍','😄'];
	const DECOR_WORDS = {
	    zh: ['早日康复','健康常伴','笑口常开','平安喜乐','活力满满','加油','万事顺意','每天好心情','心想事成','好梦'],
	    en: ['Get Well Soon','Stay Strong','Be Happy','Good Vibes','Best Wishes','Keep Going','Sweet Dreams','All the Best','Smile Every Day','Full of Energy']
	};
	/**
	 * 构
	 *
	 * 建
	 */
	function buildFloatDecor(){
	    const old = getEl('floatDecor'); if (old) old.remove();
	    const wrap = document.createElement('div');
	    wrap.id = 'floatDecor'; wrap.className = 'float-decor';
	    const words = DECOR_WORDS[lang] || DECOR_WORDS.zh;
	    const isMobile = window.innerWidth <= 768;
	    const emojiCount = isMobile ? 6 : 8;
	    const wordCount  = isMobile ? 4 : 6;
	    const items = [];
	    for (let i = 0; i < emojiCount; i++) items.push({ t: DECOR_EMOJI[(Math.random() * DECOR_EMOJI.length) | 0], isEmoji: true });
	    for (let i = 0; i < wordCount;  i++) items.push({ t: words[(Math.random() * words.length) | 0],        isEmoji: false });
	    items.forEach(it => {
	        const el = document.createElement('div');
	        el.className = 'fd-item' + (it.isEmoji ? '' : ' fd-word');
	        el.textContent = it.t;
	        const size = it.isEmoji ? 18 + Math.random() * 22 : 13 + Math.random() * 9;
	        el.style.left = (Math.random() * 92 + 2) + '%';
	        el.style.fontSize = size.toFixed(1) + 'px';
	        el.style.setProperty('--fd-op', (0.14 + Math.random() * 0.14).toFixed(2));
	        el.style.setProperty('--fd-sway', (Math.random() * 60 - 30).toFixed(0) + 'px');
	        el.style.animationDuration = (16 + Math.random() * 22).toFixed(1) + 's';
	        el.style.animationDelay = (-Math.random() * 30).toFixed(1) + 's';
	        wrap.appendChild(el);
	    });
	    document.body.appendChild(wrap);
	}

/* ===== 消息 ===== */
	/**
	 * 生成一条 AI 消息的完整 HTML（头像 + 气泡 + 语音播放按钮）。
	 *
	 * @param {string} text 消息文本
	 * @returns {string} HTML 字符串
	 */
	function assistantMsgHTML(text){
	    const cleaned = String(text).replace(/\*\*/g, '');
	    return `<div class="msg-avatar" title="${tr('avClickChange')}">${getAvatarHTML('doctor')}</div>` +
	           `<div class="msg-content"><div class="msg-bubble">${cleaned.replace(/\n/g, '<br>')}</div>` +
	           `<button class="speak-btn" title="${tr('speakBtnTitle')}">🔊 ${tr('speakBtnLabel')}</button></div>`;
	}
	/**
	 * 向聊天区追加一条消息并滚动到底部。
	 *
	 * @param {string} role user/assistant
	 * @param {string} text 消息内容
	 */
	function addMsg(role, text){
	    const body = getEl('chatBody'); if (!body) return;
	    const div = document.createElement('div'); div.className = 'message ' + role;
	    if (role === 'user') {
	        const cleaned = String(text).replace(/\*\*/g, '');
	        div.innerHTML = `<div class="msg-avatar" title="${tr('avClickChange')}">${getAvatarHTML('patient')}</div><div class="msg-bubble">${cleaned.replace(/\n/g, '<br>')}</div>`;
	    } else {
	        div.innerHTML = assistantMsgHTML(text);
	    }
	    body.appendChild(div); body.scrollTop = body.scrollHeight;
	}
	/**
	 * 清
	 *
	 * 空
	 */
	function clearChat(){
	    const body = getEl('chatBody'); if (!body) return;
	    stopSpeaking();
	    body.innerHTML = `<div class="message">${assistantMsgHTML(tr('welcome'))}</div>`;
	}
	/**
	 * 发
	 *
	 * 送
	 */
	async function send(){
	    if (isSending) return;
	    const inp = getEl('input'); if (!inp) return;
	    const text = inp.value.trim(); if (!text) return;
	    isSending = true;
	    const sb = getEl('sendBtn'); if (sb) sb.disabled = true;
	    addMsg('user', text); inp.value = '';
	    const chatBody = getEl('chatBody');
	    const loading = document.createElement('div');
	    loading.className = 'message assistant loading-message';
	    loading.innerHTML = `<div class="msg-avatar" title="${tr('avClickChange')}">${getAvatarHTML('doctor')}</div><div class="msg-bubble">${tr('thinking')}</div>`;
	    if (chatBody) { chatBody.appendChild(loading); chatBody.scrollTop = chatBody.scrollHeight; }
	    let full = '', assistantBubble = null;
	    const pushChunk = chunk => {
	        full += chunk;
	        if (assistantBubble) {
	            assistantBubble.innerHTML = full.replace(/\n/g, '<br>');
	            if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
	        }
	    };
	    try {
	        const response = await fetch('/api/stream', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ question: text }) });
	        if (loading && loading.parentNode) loading.remove();
	        if (!response.ok || !response.body) throw new Error('HTTP ' + response.status);
	        const div = document.createElement('div'); div.className = 'message assistant';
	        div.innerHTML = assistantMsgHTML('');
	        if (chatBody) { chatBody.appendChild(div); chatBody.scrollTop = chatBody.scrollHeight; }
	        assistantBubble = div.querySelector('.msg-bubble');
	        const handleLine = line => {
	            if (!line.startsWith('data: ')) return;
	            try { const data = JSON.parse(line.slice(6)); if (data && typeof data.chunk === 'string') pushChunk(data.chunk); } catch(e) {}
	        };
	        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
	        while (true) {
	            const { done, value } = await reader.read(); if (done) break;
	            buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
	            const parts = buffer.split('\n\n'); buffer = parts.pop();
	            parts.forEach(handleLine);
	        }
	        if (buffer) handleLine(buffer);
	        if (voiceEnabled && full) speakText(full, div);
	    } catch(err) {
	        if (loading && loading.parentNode) loading.remove();
	        if (!full) addMsg('assistant', tr('netErr'));
	        console.error(err);
	    } finally {
	        isSending = false; if (sb) sb.disabled = false;
	    }
	}
	/**
	 * 快速问题按钮：填入问题并直接发送。
	 *
	 * @param {string} q 问题文本
	 */
	function quickAsk(q){ const inp = getEl('input'); if (inp) inp.value = q; send(); }

document.addEventListener('DOMContentLoaded', function(){
	    applyLang();
	    getEl('sendBtn')?.addEventListener('click', send);
	    getEl('clearBtn')?.addEventListener('click', clearChat);
	    getEl('micBtn')?.addEventListener('click', toggleRec);
	    getEl('input')?.addEventListener('keydown', e => {
	        if (e.isComposing || e.keyCode === 229) return;
	        if (e.key === 'Enter') { e.preventDefault(); send(); }
	    });
	    /* ★移动端修复12：聚焦输入框时滚动聊天区到底部，避免最新回复被键盘遮挡 */
	    getEl('input')?.addEventListener('focus', function(){
	        setTimeout(function(){ var b = getEl('chatBody'); if (b) b.scrollTop = b.scrollHeight; }, 350);
	    });
	    // ===== 绑定快速问答按钮点击事件 =====
	    for (let i = 1; i <= 10; i++) {
	        const btn = getEl('quick' + i);
	        if (btn) {
	            btn.addEventListener('click', function(e) {
	                e.stopPropagation();
	                const text = this.textContent.trim();
	                if (text) quickAsk(text);
	            });
	        }
	    }
	    getEl('setBtn')?.addEventListener('click', openSettings);
	    getEl('settingsClose')?.addEventListener('click', closeSettings);
	    getEl('settingsModalMask')?.addEventListener('click', e => { if (e.target === getEl('settingsModalMask')) closeSettings(); });
	    getEl('langSwitchBtn')?.addEventListener('click', switchLang);
	    getEl('fontSlider')?.addEventListener('input', e => applyFontScale(parseFloat(e.target.value)));
	    getEl('fontPlusBtn')?.addEventListener('click', () => applyFontScale(fontScale + 0.25));
	    getEl('fontMinusBtn')?.addEventListener('click', () => applyFontScale(fontScale - 0.25));
	    document.querySelectorAll('.preset-btn[data-scale]').forEach(b => {
	        b.addEventListener('click', () => applyFontScale(parseFloat(b.dataset.scale)));
	    });
	    getEl('fontApplyBtn')?.addEventListener('click', () => {
	        const num = getEl('fontNumInput'); if (!num) return;
	        let v = parseFloat(num.value); if (isNaN(v) || v <= 0) v = 1;
	        applyFontScale(v);
	    });
	    getEl('fontResetBtn')?.addEventListener('click', () => applyFontScale(1));
	    getEl('fontNumInput')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); getEl('fontApplyBtn')?.click(); } });
	    getEl('voiceToggle')?.addEventListener('click', toggleVoice);
	    document.querySelectorAll('.preset-btn[data-rate]').forEach(b => {
	        b.addEventListener('click', () => setVoiceRate(parseFloat(b.dataset.rate)));
	    });
	    document.querySelectorAll('.preset-btn[data-gender]').forEach(b => {
	        b.addEventListener('click', () => setVoiceGender(b.dataset.gender));
	    });
	    getEl('voicePreviewBtn')?.addEventListener('click', previewVoice);
	    getEl('exportPdfBtn')?.addEventListener('click', exportChatPDF);
	    getEl('saveAudioBtn')?.addEventListener('click', saveVoiceAudio);
	    bindAvatarControls('doctor'); bindAvatarControls('patient');
	    getEl('doctorAvatarClick')?.addEventListener('click', openAvatarModal);
	    getEl('patientAvatarClick')?.addEventListener('click', openAvatarModal);
	    getEl('avatarModalClose')?.addEventListener('click', closeAvatarModal);
	    getEl('avatarModalMask')?.addEventListener('click', e => { if (e.target === getEl('avatarModalMask')) closeAvatarModal(); });
	    getEl('chatBody')?.addEventListener('click', e => {
	        if (e.target.closest('.msg-avatar')) { openAvatarModal(); return; }
	        const spk = e.target.closest('.speak-btn');
	        if (spk) {
	            const msgEl = spk.closest('.message');
	            const bubble = msgEl ? msgEl.querySelector('.msg-bubble') : null;
	            toggleSpeakMessage(spk, bubble ? bubble.innerText.trim() : '');
	        }
	    });
	    document.addEventListener('keydown', e => {
	        if (e.key === 'Escape') {
	            closeSettings(); closeAvatarModal();
	            const cm = getEl('confirmMask');
	            if (cm && cm.classList.contains('show')) getEl('confirmCancelBtn')?.click();
	        }
	    });
	    document.addEventListener('click', unlockTTS, { once: true });
	    applyFontScale(fontScale);
	    setVoiceRate(voiceRate);
	    setVoiceGender(voiceGender);
	    updateVoiceUI();
	    refreshAvatars();
	    buildFloatDecor();
	    clearChat();
	    /* ============================================================
	       ★移动端修复13：软键盘弹起时抬起底部输入栏（iOS等浏览器）
	       原理：visualViewport 高度 < 窗口内高 = 键盘遮挡量，
	       用 transform 把固定输入栏抬到键盘上方；键盘收起自动复位。
	       （Chrome/Android 已由 interactive-widget=resizes-content 处理，
	       此处 overlap≈0 不会重复偏移）
	       ============================================================ */
	    if (window.visualViewport) {
	        const vv = window.visualViewport;
	        const footerEl = document.querySelector('.chat-footer');
	        let vvRaf = null;
	        const vvUpdate = () => {
	            if (vvRaf) return;
	            vvRaf = requestAnimationFrame(() => {
	                vvRaf = null;
	                if (!footerEl) return;
	                const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
	                footerEl.style.transform = overlap > 2 ? 'translateY(' + (-overlap) + 'px)' : '';
	            });
	        };
	        vv.addEventListener('resize', vvUpdate);
	        vv.addEventListener('scroll', vvUpdate);
	    }
	    /* ★移动端修复14：横竖屏切换（宽度明显变化）后重建悬浮装饰，避免错位 */
	    (function(){
	        let lastW = window.innerWidth, rzTimer = null;
	        window.addEventListener('resize', () => {
	            clearTimeout(rzTimer);
	            rzTimer = setTimeout(() => {
	                if (Math.abs(window.innerWidth - lastW) > 60) { lastW = window.innerWidth; buildFloatDecor(); }
	            }, 250);
	        });
	    })();
	    /* ★移动端修复15：手机端禁用"保存为音频"按钮（该功能依赖桌面端屏幕共享） */
	    if (isMobileDevice()) {
	        const mAudioBtn = getEl('saveAudioBtn');
	        if (mAudioBtn) { mAudioBtn.disabled = true; mAudioBtn.title = tr('audioUnsupported'); }
	        /* ★手机端默认直接进录音识别模式：本机浏览器语音识别依赖谷歌服务（国内手机基本不可用），
	           跳过注定失败的尝试与长提示，点麦克风即录音（"🎙️ 录音中…"提示自带操作引导） */
	        recMode = 'record';
	    }
	});
