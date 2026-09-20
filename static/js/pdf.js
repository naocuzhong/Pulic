/**
 * ============================================================================
 *  福医卒中通：脑卒中智能问答平台（简称：福医卒中通助手）
 *  文件名称：pdf.js
 *  文件功能：记录保存：聊天记录 PDF 导出、音频转码与保存
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

/* ================= 📁 记录保存 ================= */
	/**
	 * 生成 yyyyMMdd_HHmm 格式时间戳字符串（用于导出文件名）。
	 *
	 * @returns {string} 时间戳
	 */
	function dateStr(){
	    const d = new Date(), p = n => String(n).padStart(2, '0');
	    return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
	}
	/**
	 * 触发浏览器下载指定 Blob 文件。
	 *
	 * @param {Blob} blob 文件内容
	 * @param {string} filename 文件名
	 */
	function downloadBlob(blob, filename){
	    const url = URL.createObjectURL(blob);
	    const a = document.createElement('a');
	    a.href = url; a.download = filename;
	    document.body.appendChild(a); a.click(); a.remove();
	    setTimeout(() => URL.revokeObjectURL(url), 10000);
	}
	/**
	 * HTML 特殊字符转义（防注入）。
	 *
	 * @param {string} s 原文
	 * @returns {string} 转义后文本
	 */
	function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
	/**
	 * 按顺序收集聊天区全部问答消息（含角色标记，供导出）。
	 *
	 * @returns {Array<{role:string,text:string}>} 消息数组
	 */
	function collectChatMessages(){
	    return Array.from(document.querySelectorAll('.chat-body .message.user, .chat-body .message.assistant:not(.loading-message)'))
	        .map(el => ({
	            role: el.classList.contains('user') ? 'user' : 'assistant',
	            text: (el.querySelector('.msg-bubble')?.innerText || '').trim()
	        })).filter(m => m.text);
	}
	/**
	 * 按候选 CDN 顺序依次尝试加载外部脚本（任一成功即 resolve）。
	 *
	 * @param {string[]} urls CDN 地址列表
	 * @returns {Promise<void>}
	 */
	function loadScript(urls){
	    return new Promise((resolve, reject) => {
	        const tryNext = i => {
	            if (i >= urls.length) { reject(new Error('all cdn failed')); return; }
	            const s = document.createElement('script');
	            s.src = urls[i];
	            s.onload = () => resolve();
	            s.onerror = () => { s.remove(); tryNext(i + 1); };
	            document.head.appendChild(s);
	        };
	        tryNext(0);
	    });
	}
	/**
	 * 加载 html2canvas 与 jsPDF 库（多 CDN 容错）。
	 *
	 * @returns {Promise<boolean>} 是否加载成功
	 */
	async function loadPdfLibs(){
	    if (window.html2canvas && window.jspdf) return true;
	    try {
	        await loadScript([
	            'https://cdn.bootcdn.net/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
	            'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',
	            'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
	            'https://unpkg.com/html2canvas@1.4.1/dist/html2canvas.min.js'
	        ]);
	        await loadScript([
	            'https://cdn.bootcdn.net/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
	            'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
	            'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
	            'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js'
	        ]);
	        return !!(window.html2canvas && window.jspdf);
	    } catch(e) { return false; }
	}
	/**
	 * 离屏构建导出用的聊天记录 DOM 节点（渲染为图片后入 PDF）。
	 *
	 * @param {Array} msgs 消息数组
	 * @returns {HTMLElement} 离屏节点
	 */
	function buildExportNode(msgs){
	    const wrap = document.createElement('div');
	    wrap.style.cssText = 'position:absolute;left:-10000px;top:0;width:760px;background:#fff;font-family:"PingFang SC","Microsoft YaHei",sans-serif;padding:30px;';
	    let html = `<div style="text-align:center;margin-bottom:16px">
	        <div style="font-size:26px;font-weight:700;color:#0077cc">${escapeHtml(tr('mainTitle'))} · ${lang==='zh'?'聊天记录':'Chat Log'}</div>
	        <div style="font-size:13px;color:#888;margin-top:6px">${lang==='zh'?'导出时间：':'Exported at: '}${new Date().toLocaleString()}</div>
	        <div style="border:none;border-top:2px solid #0077cc;margin-top:12px"></div>
	    </div>`;
	    msgs.forEach(m => {
	        const isUser = m.role === 'user';
	        html += `<div style="display:flex;flex-direction:${isUser?'row-reverse':'row'};margin-bottom:14px;gap:10px">
	            <div style="max-width:80%">
	                <div style="font-size:11px;color:#999;margin-bottom:2px;text-align:${isUser?'right':'left'}">${escapeHtml(isUser?tr('sidePatient'):tr('sideDoctor'))}</div>
	                <div style="display:inline-block;max-width:100%;padding:10px 14px;border-radius:10px;line-height:1.7;font-size:14px;word-break:break-word;white-space:pre-wrap;${isUser?'background:#0077cc;color:#fff;':'background:#f2f7fb;color:#222;border:1px solid #e3edf5;'}">${escapeHtml(m.text)}</div>
	            </div>
	        </div>`;
	    });
	    html += `<div style="text-align:center;color:#aaa;font-size:12px;margin-top:20px">${lang==='zh'?'本记录由福医卒中通·脑卒中智能问答平台生成，仅供健康参考，不构成医疗诊断':'Generated by Fuyi Stroke Platform. For health reference only, not medical diagnosis.'}</div>`;
	    wrap.innerHTML = html;
	    document.body.appendChild(wrap);
	    return wrap;
	}
	/**
	 * 方案一导出：DOM -> 画布 -> 分页图片写入 PDF 并下载。
	 *
	 * @param {Array} msgs 消息数组
	 */
	async function exportWithJsPDF(msgs){
	    const wrap = buildExportNode(msgs);
	    const canvas = await window.html2canvas(wrap, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true });
	    wrap.remove();
	    const imgData = canvas.toDataURL('image/jpeg', 0.92);
	    const { jsPDF } = window.jspdf;
	    const pdf = new jsPDF('p', 'mm', 'a4');
	    const pageW = 210, pageH = 297, margin = 10;
	    const imgW = pageW - margin * 2;
	    const imgH = canvas.height * imgW / canvas.width;
	    let heightLeft = imgH, position = margin;
	    pdf.addImage(imgData, 'JPEG', margin, position, imgW, imgH);
	    heightLeft -= (pageH - margin * 2);
	    while (heightLeft > 0) {
	        pdf.addPage();
	        position = margin - (imgH - heightLeft);
	        pdf.addImage(imgData, 'JPEG', margin, position, imgW, imgH);
	        heightLeft -= (pageH - margin * 2);
	    }
	    pdf.save(`卒中通聊天记录_${dateStr()}.pdf`);
	}
	/**
	 * 方案二兜底导出：构建打印页并用 iframe 调起打印（另存为 PDF）。
	 *
	 * @param {Array} msgs 消息数组
	 */
	function exportWithPrint(msgs){
	    const rows = msgs.map(m => {
	        const isUser = m.role === 'user';
	        return `<div class="msg ${isUser?'user':'assistant'}"><div>
	            <div class="who">${escapeHtml(isUser?tr('sidePatient'):tr('sideDoctor'))}</div>
	            <div class="bubble">${escapeHtml(m.text)}</div>
	        </div></div>`;
	    }).join('');
	    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${lang==='zh'?'卒中通聊天记录':'Chat Log'}</title><style>
	        body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;color:#222;padding:28px;max-width:760px;margin:0 auto}
	        h1{text-align:center;color:#0077cc;font-size:22px;margin:0 0 4px}
	        .meta{text-align:center;color:#888;font-size:12px;margin-bottom:8px}
	        hr{border:none;border-top:2px solid #0077cc;margin:0 0 18px}
	        .msg{display:flex;margin-bottom:12px}
	        .msg.user{justify-content:flex-end}
	        .msg>div{max-width:82%}
	        .who{font-size:11px;color:#999;margin-bottom:2px}
	        .msg.user .who{text-align:right}
	        .bubble{padding:10px 14px;border-radius:10px;font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word}
	        .msg.user .bubble{background:#0077cc;color:#fff}
	        .msg.assistant .bubble{background:#f2f7fb;border:1px solid #e3edf5}
	        .foot{text-align:center;color:#aaa;font-size:11px;margin-top:24px}
	    </style></head><body>
	    <h1>${escapeHtml(tr('mainTitle'))} · ${lang==='zh'?'聊天记录':'Chat Log'}</h1>
	    <div class="meta">${lang==='zh'?'导出时间：':'Exported at: '}${new Date().toLocaleString()}</div><hr>
	    ${rows}
	    <div class="foot">${lang==='zh'?'本记录由福医卒中通·脑卒中智能问答平台生成，仅供健康参考，不构成医疗诊断':'For health reference only, not medical diagnosis.'}</div>
	    </body></html>`;
	    const iframe = document.createElement('iframe');
	    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
	    document.body.appendChild(iframe);
	    const doc = iframe.contentDocument || iframe.contentWindow?.document;
	    if (!doc) { iframe.remove(); toast(tr('pdfFail')); return; }
	    doc.open(); doc.write(html); doc.close();
	    const win = iframe.contentWindow;
	    const cleanup = () => setTimeout(() => iframe.remove(), 800);
	    if (win) {
	        win.addEventListener('afterprint', cleanup);
	        setTimeout(() => { try { win.focus(); win.print(); } catch(e){} }, 300);
	    }
	}
	let pdfBusy = false;
	/**
	 * 导
	 *
	 * 出
	 */
	async function exportChatPDF(){
	    if (pdfBusy) return;
	    const msgs = collectChatMessages();
	    if (!msgs.length) { toast(tr('noChatToExport')); return; }
	    const btn = getEl('exportPdfBtn'); if (!btn) return;
	    pdfBusy = true; btn.disabled = true; btn.textContent = tr('pdfGenerating');
	    try {
	        const libsOk = await loadPdfLibs();
	        if (libsOk) await exportWithJsPDF(msgs);
	        else { toast(tr('printFallbackTip'), 6000); exportWithPrint(msgs); }
	    } catch(err) {
	        console.error(err);
	        try { exportWithPrint(msgs); } catch(e2) { toast(tr('pdfFail')); }
	    } finally {
	        pdfBusy = false; btn.disabled = false; btn.textContent = tr('exportPdf');
	    }
	}
	/**
	 * 刷
	 *
	 * 新
	 */
	function refreshAudioMsgList(){
	    const sel = getEl('audioMsgSelect'); if (!sel) return;
	    const msgs = getAssistantMessages();
	    sel.innerHTML = '';
	    if (!msgs.length) {
	        const o = document.createElement('option');
	        o.textContent = tr('noMsgOption'); o.value = '';
	        sel.appendChild(o); return;
	    }
	    msgs.forEach((m, i) => {
	        const o = document.createElement('option');
	        const preview = m.replace(/\s+/g, ' ');
	        o.textContent = `#${i + 1} ${preview.slice(0, 24)}${preview.length > 24 ? '…' : ''}`;
	        o.value = i;
	        sel.appendChild(o);
	    });
	    sel.value = String(msgs.length - 1);
	}
	/**
	 * 设置保存音频按钮的文案与禁用态。
	 *
	 * @param {string} label 文案
	 * @param {boolean} disabled 是否禁用
	 */
	function setAudioBtn(label, disabled){
	    const b = getEl('saveAudioBtn'); if (!b) return;
	    b.textContent = label; b.disabled = !!disabled;
	}
	/**
	 * 检测音频 Blob 是否包含有声信号（RMS 阈值判断）。
	 *
	 * @param {Blob} blob 音频数据
	 * @returns {Promise<boolean>} 是否有声
	 */
	async function checkAudioHasSound(blob){
	    try {
	        const ab = await blob.arrayBuffer();
	        const ctx = new (window.AudioContext || window.webkitAudioContext)();
	        const buf = await ctx.decodeAudioData(ab);
	        try { ctx.close(); } catch(e){}
	        const data = buf.getChannelData(0);
	        let sum = 0, n = 0;
	        for (let i = 0; i < data.length; i += 16) { sum += data[i] * data[i]; n++; }
	        return Math.sqrt(sum / Math.max(1, n)) > 0.001;
	    } catch(e) { return true; }
	}
	/**
	 * 将 Float32 采样数据编码为标准 PCM16 WAV Blob。
	 *
	 * @param {Float32Array} samples 采样数据
	 * @param {number} sampleRate 采样率
	 * @returns {Blob} WAV Blob
	 */
	function encodeWav(samples, sampleRate){
	    const buffer = new ArrayBuffer(44 + samples.length * 2);
	    const view = new DataView(buffer);
	    const writeStr = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)); };
	    writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples.length * 2, true); writeStr(8, 'WAVE');
	    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
	    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
	    writeStr(36, 'data'); view.setUint32(40, samples.length * 2, true);
	    let off = 44;
	    for (let i = 0; i < samples.length; i++, off += 2) {
	        const s = Math.max(-1, Math.min(1, samples[i]));
	        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
	    }
	    return new Blob([view], { type: 'audio/wav' });
	}
	/**
	 * 任意音频 Blob 解码并重采样为 16kHz 单声道 WAV（供后端转写/音频保存复用）。
	 *
	 * @param {Blob} blob 原音频
	 * @returns {Promise<Blob>} 16kHz WAV Blob
	 */
	async function blobToWav(blob){
	    const ab = await blob.arrayBuffer();
	    const ctx = new (window.AudioContext || window.webkitAudioContext)();
	    const decoded = await ctx.decodeAudioData(ab);
	    try { ctx.close(); } catch(e){}
	    const targetRate = 16000;
	    const offline = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, Math.max(1, Math.ceil(decoded.duration * targetRate)), targetRate);
	    const src = offline.createBufferSource();
	    src.buffer = decoded; src.connect(offline.destination); src.start();
	    const rendered = await offline.startRendering();
	    return encodeWav(rendered.getChannelData(0), targetRate);
	}
	let audioBusy = false, currentRecorder = null, currentStream = null, currentChunks = [];
	/**
	 * 桌
	 *
	 * 面
	 */
	async function saveVoiceAudio(){
	    if (audioBusy && currentRecorder && currentRecorder.state === 'recording') {
	        try { synth && synth.cancel(); } catch(e){}
	        setAudioBtn(tr('audioProcessing'), true);
	        setTimeout(() => { try { currentRecorder && currentRecorder.stop(); } catch(e){} }, 250);
	        return;
	    }
	    if (audioBusy) return;
	    /* ★移动端修复11：手机端不支持屏幕共享录制，直接给出明确提示 */
	    if (isMobileDevice()) { toast(tr('audioUnsupported'), 5000); return; }
	    const msgs = getAssistantMessages();
	    if (!msgs.length) { toast(tr('noMsgToSave')); return; }
	    const sel = getEl('audioMsgSelect');
	    let idx = (sel && sel.value !== '') ? parseInt(sel.value, 10) : msgs.length - 1;
	    if (isNaN(idx) || idx < 0 || idx >= msgs.length) idx = msgs.length - 1;
	    const text = msgs[idx];
	    if (!synth) { toast(tr('voiceUnsupported')); return; }
	    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia || !window.MediaRecorder) { toast(tr('audioUnsupported'), 5000); return; }
	    const ok = await customConfirm(tr('audioHint'));
	    if (!ok) return;
	    audioBusy = true; currentChunks = [];
	    let stream;
	    try {
	        stream = await navigator.mediaDevices.getDisplayMedia({
	            video: true,
	            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
	            preferCurrentTab: true, selfBrowserSurface: 'include'
	        });
	    } catch(err) {
	        audioBusy = false; currentChunks = [];
	        if (err && err.name !== 'NotAllowedError') toast(tr('audioRecordFail'));
	        return;
	    }
	    const audioTracks = stream.getAudioTracks();
	    if (!audioTracks.length) {
	        stream.getTracks().forEach(t => t.stop());
	        audioBusy = false; toast(tr('audioNoTrack'), 5000); return;
	    }
	    currentStream = stream;
	    stream.getVideoTracks().forEach(t => t.stop());
	    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
	                   : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
	    try { currentRecorder = new MediaRecorder(new MediaStream(audioTracks), mimeType ? { mimeType } : undefined); }
	    catch(err) {
	        stream.getTracks().forEach(t => t.stop());
	        currentStream = null; audioBusy = false; toast(tr('audioRecordFail')); return;
	    }
	    currentRecorder.ondataavailable = e => { if (e.data && e.data.size) currentChunks.push(e.data); };
	    currentRecorder.onerror = () => {
	        toast(tr('audioRecordFail'));
	        try { currentRecorder && currentRecorder.state !== 'inactive' && currentRecorder.stop(); } catch(e){}
	    };
	    currentRecorder.onstop = async () => {
	        currentStream && currentStream.getTracks().forEach(t => t.stop());
	        setAudioBtn(tr('audioProcessing'), true);
	        const blob = new Blob(currentChunks, { type: mimeType || 'audio/webm' });
	        currentRecorder = null; currentStream = null; currentChunks = [];
	        try {
	            if (blob.size > 1000) {
	                if (await checkAudioHasSound(blob)) {
	                    let out = blob, ext = 'webm';
	                    try { out = await blobToWav(blob); ext = 'wav'; } catch(e) {}
	                    downloadBlob(out, `卒中通播报_${dateStr()}.${ext}`);
	                } else toast(tr('audioSilent'), 6000);
	            } else toast(tr('audioRecordFail'));
	        } catch(err) { console.error(err); toast(tr('audioRecordFail')); }
	        audioBusy = false;
	        setAudioBtn(tr('saveAudio'), false);
	    };
	    currentRecorder.start(250);
	    setAudioBtn(tr('stopAudioSave'), false);
	    let started = false, finished = false;
	    const finish = () => {
	        if (finished) return; finished = true;
	        setTimeout(() => { try { currentRecorder && currentRecorder.state !== 'inactive' && currentRecorder.stop(); } catch(e){} }, 500);
	    };
	    try {
	        synth.cancel();
	        const langCode = lang === 'zh' ? 'zh-CN' : 'en-US';
	        const voice = pickVoice(voiceGender, langCode);
	        const u = new SpeechSynthesisUtterance(applyPronunciation(text));
	        if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = langCode; }
	        u.rate = voiceRate;
	        u.onstart = () => { started = true; };
	        u.onend = finish; u.onerror = finish;
	        setTimeout(() => { try { synth.speak(u); } catch(e) { finish(); } }, 300);
	        audioTracks[0].addEventListener('ended', finish);
	        setTimeout(() => { if (!started) finish(); }, 6000);
	        setTimeout(() => { if (!finished) { try { synth.cancel(); } catch(e){} finish(); } }, 10 * 60 * 1000);
	    } catch(err) { finish(); }
	}
