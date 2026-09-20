/**
 * ============================================================================
 *  福医卒中通：脑卒中智能问答平台（简称：福医卒中通助手）
 *  文件名称：stt.js
 *  文件功能：语音输入：麦克风预热、浏览器识别、录音识别模式
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

/* ===== 语音输入（★二次修复：设置中已"允许"仍报"权限被拒绝"） ===== */
	let micAutoRetried = false, micBusy = false;
	/* ★录音识别模式：'auto'=先尝试浏览器语音识别；'record'=录音上传后端转写（识别服务不可用设备自动切换） */
	let recMode = 'auto';
	let recordActive = false, recordStream = null, mediaRecorder = null, recordChunks = [];
	/* 麦克风预热——本次修复的核心：
	   Chrome/Android 缺陷：在「设置→网站设置→麦克风」中手动设为"允许"后，
	   webkitSpeechRecognition 依然报 not-allowed（它只认页面内弹窗授权）。
	   解法：先用 getUserMedia 真正激活一次麦克风——
	   ① 权限已是"允许" → 不弹窗、瞬间完成（即你截图2的当前状态）
	   ② 权限是"询问"   → 弹出浏览器原生授权框（比语音识别自带的更可靠）
	   ③ 权限是"禁止"   → 立即失败，给出准确引导
	   完成后马上释放采流，不产生任何录音。 */
	/**
	 * 麦克风预热：先以 getUserMedia 真正激活权限并立即释放，规避 Chrome 语音识别误报 not-allowed。
	 *
	 * @returns {Promise<string>} ok/denied/nodevice/unsupported/fail
	 */
	async function warmUpMic(){
	    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return 'unsupported';
	    /* ★语音修复1：读取浏览器层权限真实状态（prompt / granted / denied），便于对照系统层 */
	    try {
	        const st = await navigator.permissions.query({ name: 'microphone' });
	        console.log('[mic] permission state =', st.state);
	    } catch(e){}
	    try {
	        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	        stream.getTracks().forEach(t => t.stop());
	        return 'ok';
	    } catch(err){
	        const n = err && err.name;
	        console.error('[mic] getUserMedia failed:', n, err && err.message);
	        /* ★语音修复2：诊断 toast，把真实错误名暴露给用户截图反馈 */
	        toast('🩺 语音诊断：' + (n || '未知') + (err && err.message ? ' / ' + err.message : ''), 4500);
	        if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'denied';
	        if (n === 'NotFoundError') return 'nodevice';
	        /* ★语音修复3：NotReadableError = 麦克风被其他App占用，单独提示 */
	        if (n === 'NotReadableError' || n === 'AbortError') { toast(tr('micBusy'), 5000); return 'fail'; }
	        return 'fail';
	    }
	}
	/**
	 * 弹
	 *
	 * 出
	 */
	function micDeniedToast(){
	    toast(tr(isMobileDevice() ? 'micPermissionMobile' : 'micPermission'), 9000);
	}
	/* 置为录音状态并启动识别 */
	/**
	 * 进
	 *
	 * 入
	 */
	function startRecUI(){
	    recGotResult = false;
	    isRecording = true;
	    getEl('micBtn')?.classList.add('recording');
	    try { recognition.start(); }
	    catch(e){ stopRec(); toast(tr('micFail')); }
	}
	/**
	 * 初始化 webkitSpeechRecognition：结果回填输入框，错误分类兜底，自动切换录音识别模式。
	 *
	 * @returns {boolean} 是否支持识别
	 */
	function initRecognition(){
	    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
	    if (!Rec) { toast(tr('micUnsupported')); return false; }
	    recognition = new Rec();
	    recognition.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
	    recognition.interimResults = true; recognition.continuous = false; recognition.maxAlternatives = 1;
	    recognition.onresult = e => {
	        recGotResult = true;
	        let txt = '';
	        for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript;
	        const inp = getEl('input'); if (inp) inp.value = txt;
	    };
	    recognition.onerror = e => {
	        const c = e && e.error;
	        stopRec();
	        /* ★误报兜底：权限其实已允许却报 not-allowed → 预热后自动重试一次 */
	        if ((c === 'not-allowed' || c === 'service-not-allowed') && !micAutoRetried) {
	            micAutoRetried = true;
	            warmUpMic().then(w => {
	                if (w === 'ok') {
	                    /* ★诊断结论：getUserMedia 成功 = 各层麦克风权限均正常（截图2已证实），
	                       但识别层仍拒绝 → 本机缺少谷歌语音识别服务（国内无谷歌服务手机必现），
	                       自动切换为「录音识别」模式（MediaRecorder 录音 → 上传 /api/stt 转写） */
	                    recMode = 'record';
	                    toast(tr('micSysDenied'), 9000);
	                }
	                else if (w === 'nodevice') toast(tr('micNoDevice'));
	                else micDeniedToast();
	            });
	            return;
	        }
	        if (c === 'service-not-allowed') { recMode = 'record'; toast(tr('micServiceBlocked'), 7000); }
	        else if (c === 'not-allowed') micDeniedToast();
	        else if (c === 'network') toast(tr(isMobileDevice() ? 'micNetworkMobile' : 'micNetwork'), 6000);
	        else if (c === 'no-speech') toast(tr('micNoSpeech'));
	        else if (c === 'audio-capture') toast(tr('micNoDevice'));
	        else toast(tr('micFail'));
	    };
	    recognition.onend = () => {
	        const had = recGotResult; recGotResult = false;
	        stopRec();
	        if (had) { const inp = getEl('input'); if (inp && inp.value.trim()) send(); }
	    };
	    return true;
	}
	/**
	 * 麦
	 *
	 * 克
	 */
	async function toggleRec(){
	    if (/MicroMessenger|QQ\//i.test(navigator.userAgent)) { toast(tr('micInApp'), 6000); return; }
	    if (micBusy) return;                       /* 预热/识别进行中，忽略重复点击 */
	    /* ★★ 录音识别模式分支：识别服务不可用的设备自动进入；无 SpeechRecognition 的浏览器直接用 */
	    const hasSR = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
	    if (recMode === 'record' || !hasSR) {
	        if (recordActive) { await stopAndRecognize(); return; }
	        await startRecordMode();
	        return;
	    }
	    if (isRecording) { stopRec(); return; }    /* 录音中再次点击 = 主动停止 */
	    if (!recognition && !initRecognition()) return;
	    micBusy = true;
	    try {
	        /* ★关键：先激活麦克风权限，再启动语音识别 */
	        const w = await warmUpMic();
	        if (w === 'denied')   { micDeniedToast(); return; }          /* 权限确实是"禁止" */
	        if (w === 'nodevice') { toast(tr('micNoDevice')); return; }  /* 无麦克风设备 */
	        /* ok / unsupported / fail → 继续尝试识别，由识别自身报错兜底 */
	        micAutoRetried = false;
	        setTimeout(startRecUI, 120);   /* 留出麦克风释放时间 */
	    } finally {
	        micBusy = false;
	    }
	}
	/**
	 * 停
	 *
	 * 止
	 */
	function stopRec(){
	    isRecording = false;
	    getEl('micBtn')?.classList.remove('recording');
	    if (recognition) { try { recognition.stop(); } catch(e){} }
	}

/* ================================================================
	   ★★ 录音识别模式（国内无谷歌服务手机的兜底方案）
	   原理：getUserMedia + MediaRecorder 录音（不依赖谷歌服务，已验证可用），
	   停止后在前端转成 16kHz 单声道 WAV（复用 blobToWav，免服务端 ffmpeg），
	   POST 到后端 /api/stt 转写成文字，自动填入输入框并发送。
	   ================================================================ */
	/**
	 * 清
	 *
	 * 理
	 */
	function cleanupRecord(){
	    recordActive = false;
	    try { mediaRecorder && mediaRecorder.state !== 'inactive' && mediaRecorder.stop(); } catch(e){}
	    if (recordStream) { recordStream.getTracks().forEach(t => t.stop()); recordStream = null; }
	    mediaRecorder = null; recordChunks = [];
	    getEl('micBtn')?.classList.remove('recording');
	}
	/**
	 * 录
	 *
	 * 音
	 */
	async function startRecordMode(){
	    micBusy = true;
	    try {
	        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
	        recordStream = stream; recordChunks = [];
	        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
	                   : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
	        try { mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined); }
	        catch(e) { mediaRecorder = new MediaRecorder(stream); }
	        mediaRecorder.ondataavailable = e => { if (e.data && e.data.size) recordChunks.push(e.data); };
	        mediaRecorder.onerror = () => { cleanupRecord(); toast(tr('micRecFail')); };
	        mediaRecorder.start(250);
	        recordActive = true;
	        getEl('micBtn')?.classList.add('recording');
	        toast(tr('micRecStart'), 2500);
	    } catch(err) {
	        console.error('[mic] record start failed:', err);
	        toast(tr('micFail'));
	    } finally {
	        micBusy = false;
	    }
	}
	/**
	 * 录
	 *
	 * 音
	 */
	async function stopAndRecognize(){
	    if (!mediaRecorder || !recordActive) { cleanupRecord(); return; }
	    micBusy = true;
	    recordActive = false;
	    getEl('micBtn')?.classList.remove('recording');
	    let blob = null;
	    try {
	        const stopped = new Promise(res => {
	            mediaRecorder.ondataavailable = e => { if (e.data && e.data.size) recordChunks.push(e.data); };
	            mediaRecorder.onstop = res;
	        });
	        try { mediaRecorder.stop(); } catch(e){}
	        await Promise.race([stopped, new Promise(r => setTimeout(r, 3000))]);
	        blob = new Blob(recordChunks, { type: (mediaRecorder && mediaRecorder.mimeType) || 'audio/webm' });
	    } catch(e){}
	    if (recordStream) { recordStream.getTracks().forEach(t => t.stop()); recordStream = null; }
	    mediaRecorder = null; recordChunks = [];
	    if (!blob || blob.size < 600) { micBusy = false; toast(tr('micSttEmpty')); return; }
	    /* ★录音质量前置检查：无声/音量过低直接提示，不浪费识别额度也更快反馈 */
	    if (!(await checkAudioHasSound(blob))) { micBusy = false; toast(tr('micSttEmpty')); return; }
	    const t = toast(tr('micRecognizing'), 20000);
	    try {
	        const wav = await blobToWav(blob);
	        const resp = await fetch('/api/stt', { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav });
	        const data = await resp.json().catch(() => ({}));
	        dismissToast(t);   /* ★识别完成立即移除提示，不再滞留 */
	        micBusy = false;
	        if (resp.ok && data.text && String(data.text).trim()) {
	            const inp = getEl('input');
	            if (inp) inp.value = String(data.text).trim();
	            send();
	        } else {
	            toast((data && data.error) ? tr('micSttFail') : tr('micSttEmpty'));
	        }
	    } catch(err) {
	        console.error('[mic] stt failed:', err);
	        dismissToast(t);
	        micBusy = false;
	        toast(tr('micSttFail'));
	    }
	}
	/**
	 * 收集聊天区内全部 AI 回答文本（供音频保存列表使用）。
	 *
	 * @returns {string[]} 回答文本数组
	 */
	function getAssistantMessages(){
	    return Array.from(document.querySelectorAll('.chat-body .message.assistant:not(.loading-message) .msg-bubble'))
	        .map(el => el.innerText.trim()).filter(t => t);
	}
