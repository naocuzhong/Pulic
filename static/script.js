// ============================================================
// 全局状态
// ============================================================
let lang = "zh";                // 当前语言：zh / en
let voiceEnabled = true;        // 语音播报开关
let fontOpt = "enlarge";        // 字体调节模式
let isRecording = false;        // 是否正在录音
let recognition = null;         // 语音识别实例
const synth = window.speechSynthesis;

// 头像 SVG（简写，实际使用完整字符串）
const doctorAvatar = `<svg viewBox="0 0 44 44" width="26" height="26">...</svg>`;
const patientAvatar = `<svg viewBox="0 0 44 44" width="26" height="26">...</svg>`;

// DOM 工具函数
function getEl(id) { return document.getElementById(id); }

// ============================================================
// 字体调节功能
// ============================================================
/**
 * 切换放大/缩小模式
 * @param {string} opt - 'enlarge' 或 'narrow'
 */
function selectOpt(opt) {
    fontOpt = opt;
    let enlargeBtn = getEl('enlargeBtn');
    let narrowBtn = getEl('narrowBtn');
    if (enlargeBtn) enlargeBtn.className = opt === 'enlarge' ? 'opt-btn active' : 'opt-btn';
    if (narrowBtn) narrowBtn.className = opt === 'narrow' ? 'opt-btn active' : 'opt-btn';
    let si = getEl('scaleInput');
    if (si) {
        if (opt === 'enlarge') {
            si.min = 1;
            si.max = 4;
            si.step = 0.5;
            si.placeholder = "1-4";
        } else {
            si.min = 0.3;
            si.max = 1;
            si.step = 0.1;
            si.placeholder = "0.3-1";
        }
        si.value = "";
        si.focus();
    }
}

/**
 * 应用字体缩放
 */
function adjustFont() {
    let si = getEl('scaleInput');
    if (!si) return;
    let v = parseFloat(si.value.trim());
    if (isNaN(v) || v <= 0) v = 1;
    if (fontOpt === 'enlarge') {
        v = Math.min(4, Math.max(1, v));
    } else {
        v = Math.min(1, Math.max(0.3, v));
    }
    document.documentElement.style.setProperty('--font-scale', v);
    si.value = v;
    closeFontModal();
}

/**
 * 打开字体调节弹窗
 */
function openFontModal() {
    let modal = getEl('fontModal');
    let mask = getEl('modalMask');
    if (modal) modal.classList.add('show');
    if (mask) mask.classList.add('show');
    let si = getEl('scaleInput');
    if (si) si.focus();
}

/**
 * 关闭字体调节弹窗
 */
function closeFontModal() {
    let modal = getEl('fontModal');
    let mask = getEl('modalMask');
    if (modal) modal.classList.remove('show');
    if (mask) mask.classList.remove('show');
    selectOpt('enlarge');
}

// ============================================================
// 语音识别功能
// ============================================================
/**
 * 初始化语音识别
 * @returns {boolean} 是否支持
 */
function initRecognition() {
    if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        alert("浏览器不支持语音输入");
        return false;
    }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new Rec();
    recognition.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e) => {
        let txt = e.results[0][0].transcript;
        let inp = getEl('input');
        if (inp) inp.value = txt;
        stopRec();
    };
    recognition.onerror = stopRec;
    recognition.onend = stopRec;
    return true;
}

/**
 * 切换录音状态
 */
function toggleRec() {
    if (!recognition && !initRecognition()) return;
    isRecording = !isRecording;
    let btn = getEl('micBtn');
    if (btn) btn.classList.toggle('recording');
    if (isRecording) {
        try {
            recognition.start();
        } catch(e) {
            stopRec();
            alert("麦克风启动失败");
        }
    } else {
        recognition.stop();
    }
}

/**
 * 停止录音
 */
function stopRec() {
    isRecording = false;
    let btn = getEl('micBtn');
    if (btn) btn.classList.remove('recording');
    if (recognition) recognition.stop();
}

// ============================================================
// 语音播报功能
// ============================================================
/**
 * 切换语音播报开关
 */
function toggleVoice() {
    voiceEnabled = !voiceEnabled;
    let btn = getEl('voiceBtn');
    if (btn) btn.innerText = "语音播报：" + (voiceEnabled ? "开" : "关");
    if (!voiceEnabled) {
        synth.cancel();
    } else {
        let last = getLastAssistantMessage();
        if (last) speak(last);
    }
}

/**
 * 获取最后一条助手消息
 * @returns {string|null}
 */
function getLastAssistantMessage() {
    let msgs = document.querySelectorAll('.message.assistant .msg-bubble');
    if (msgs.length) return msgs[msgs.length - 1].innerText.trim();
    return null;
}

/**
 * 语音播报文本
 * @param {string} text
 */
function speak(text) {
    if (!voiceEnabled || !text) return;
    synth.cancel();
    let u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    synth.speak(u);
}

// ============================================================
// 中英文切换
// ============================================================
/**
 * 切换语言
 */
async function switchLang() {
    lang = lang === 'zh' ? 'en' : 'zh';
    await fetch("/api/switch_lang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang })
    }).catch(e => console.log);
    let btn = getEl('langBtn');
    if (btn) btn.innerText = lang === 'zh' ? "切换英文" : "切换中文";
    clearChat();
}

// ============================================================
// 消息处理
// ============================================================
/**
 * 添加消息到聊天界面
 * @param {string} role - 'user' 或 'assistant'
 * @param {string} text - 消息内容
 */
function addMsg(role, text) {
    let body = getEl('chatBody');
    if (!body) return;
    let div = document.createElement('div');
    div.className = 'message ' + role;
    let avatar = role === 'user' ? patientAvatar : doctorAvatar;
    let cleaned = text.replace(/\*\*/g, '');
    div.innerHTML = `<div class="msg-avatar">${avatar}</div><div class="msg-bubble">${cleaned.replace(/\n/g, '<br>')}</div>`;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

/**
 * 清空聊天记录
 */
function clearChat() {
    let body = getEl('chatBody');
    if (body) {
        body.innerHTML = `<div class="message"><div class="msg-avatar">${doctorAvatar}</div><div class="msg-bubble">${lang === 'zh' ? '你好！我是脑卒中智能助手~' : 'Hello! I\'m stroke assistant~'}</div></div>`;
    }
}

// ============================================================
// 发送消息（流式请求）
// ============================================================
/**
 * 发送用户问题并接收流式回答
 */
async function send() {
    let inp = getEl('input');
    if (!inp) return;
    let text = inp.value.trim();
    if (!text) return;

    // 显示用户消息
    addMsg('user', text);
    inp.value = '';

    // 显示加载提示
    let loading = document.createElement('div');
    loading.className = 'message assistant loading-message';
    loading.innerHTML = `<div class="msg-avatar">${doctorAvatar}</div><div class="msg-bubble">🤔 思考中...</div>`;
    let chatBody = getEl('chatBody');
    if (chatBody) chatBody.appendChild(loading);
    if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;

    try {
        const response = await fetch('/api/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text })
        });

        if (loading) loading.remove();

        // 创建助手消息容器
        const assistantDiv = document.createElement('div');
        assistantDiv.className = 'message assistant';
        assistantDiv.innerHTML = `<div class="msg-avatar">${doctorAvatar}</div><div class="msg-bubble"></div>`;
        if (chatBody) chatBody.appendChild(assistantDiv);
        const bubble = assistantDiv.querySelector('.msg-bubble');

        // 读取 SSE 流
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let full = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const jsonStr = line.slice(6);
                    try {
                        const data = JSON.parse(jsonStr);
                        if (data.chunk !== undefined) {
                            full += data.chunk;
                            bubble.innerHTML = full.replace(/\n/g, '<br>');
                            if (chatBody) chatBody.scrollTop = chatBody.scrollHeight;
                        }
                    } catch(e) {
                        console.error(e);
                    }
                }
            }
        }

        // 回答完成后播报
        if (voiceEnabled && full) speak(full);

    } catch (err) {
        if (loading) loading.remove();
        addMsg('assistant', '抱歉，网络错误，请稍后再试。');
        console.error(err);
    }
}

/**
 * 快捷提问
 * @param {string} q
 */
function quickAsk(q) {
    let inp = getEl('input');
    if (inp) inp.value = q;
    send();
}

// ============================================================
// 移动端适配（独立注入样式）
// ============================================================
(function() {
    if (window.innerWidth <= 768) {
        function apply() {
            let sidebar = document.querySelector('.sidebar');
            let chatMain = document.querySelector('.chat-main');
            let chatContent = document.querySelector('.chat-content');
            if (sidebar) sidebar.style.display = 'none';
            if (chatMain) {
                chatMain.style.width = '100%';
                chatMain.style.flex = '1';
            }
            if (chatContent) {
                chatContent.style.display = 'flex';
                chatContent.style.flexDirection = 'row';
            }
            let style = document.createElement('style');
            style.textContent = `
                body header { margin-bottom: 8px !important; }
                body header h1 { font-size: 24px !important; margin-bottom: 2px !important; }
                body header p { font-size: 12px !important; display: none !important; }
                body .chat-header-bar { padding: 8px 12px !important; }
                body .chat-header-bar h2 { font-size: 18px !important; }
                body .header-btn { font-size: 12px !important; padding: 4px 8px !important; }
                body .chat-body { padding: 12px !important; }
                body .msg-bubble { font-size: 14px !important; padding: 8px 12px !important; }
                body .quick-questions button { font-size: 13px !important; padding: 6px 12px !important; }
                body .chat-footer { padding: 8px 12px !important; }
                body .chat-input { font-size: 14px !important; padding: 8px 12px !important; }
                body .send-btn, body .clear-btn { font-size: 14px !important; padding: 6px 12px !important; }
                body .mic-btn { width: 32px !important; height: 32px !important; font-size: 16px !important; }
                body .message { max-width: 90% !important; }
            `;
            document.head.appendChild(style);
        }
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', apply);
        } else {
            apply();
        }
    }
})();

// ============================================================
// DOM 加载完成后绑定事件
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    // 按钮事件
    getEl('sendBtn')?.addEventListener('click', send);
    getEl('clearBtn')?.addEventListener('click', clearChat);
    getEl('langBtn')?.addEventListener('click', switchLang);
    getEl('micBtn')?.addEventListener('click', toggleRec);
    getEl('voiceBtn')?.addEventListener('click', toggleVoice);
    getEl('fontBtn')?.addEventListener('click', openFontModal);
    getEl('confirmFontBtn')?.addEventListener('click', adjustFont);
    getEl('enlargeBtn')?.addEventListener('click', () => selectOpt('enlarge'));
    getEl('narrowBtn')?.addEventListener('click', () => selectOpt('narrow'));

    // 输入框回车
    getEl('input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            send();
        }
    });

    // 弹窗关闭
    getEl('modalMask')?.addEventListener('click', closeFontModal);
    getEl('fontModal')?.addEventListener('click', e => e.stopPropagation());
    getEl('scaleInput')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') adjustFont();
    });

    // 快捷问题按钮
    let questions = [
        "高血压怎么预防中风？",
        "中风后吃什么好？",
        "家人中风后怎么照顾？",
        "怎么判断是不是中风？",
        "中风后手脚没力气怎么办？",
        "中风后情绪低落怎么办？",
        "中风康复训练有哪些？",
        "颈动脉斑块需要治疗吗？",
        "中风后可以运动吗？",
        "怎么帮家人做心理疏导？"
    ];
    for (let i = 1; i <= 10; i++) {
        let btn = getEl(`quick${i}`);
        if (btn) {
            btn.addEventListener('click', () => quickAsk(questions[i - 1]));
        }
    }

    // 确保输入框可编辑
    let inp = getEl('input');
    if (inp) {
        inp.removeAttribute('readonly');
        inp.removeAttribute('disabled');
    }

    console.log("福医卒中通已加载完成");
});