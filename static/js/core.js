/**
 * ============================================================================
 *  福医卒中通：脑卒中智能问答平台（简称：福医卒中通助手）
 *  文件名称：core.js
 *  文件功能：全局状态变量、设备/存储/弹窗/字体缩放等核心基础模块
 *  依赖文件：无（最先加载）
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

	let lang = "zh", isRecording = false, isSending = false, recognition = null, recGotResult = false;
	const synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
	/* ★移动端修复7：统一的移动设备判断 */
	/**
	 * 判断当前是否为移动设备（手机/平板）。
	 *
	 * @returns {boolean} 是移动设备返回 true，否则 false
	 */
	function isMobileDevice(){
	    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
	        || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
	}

/* ================= 页内 Toast / 确认弹窗 ================= */
	/**
	 * 在页面顶部弹出轻提示（Toast），指定时长后自动消失。
	 *
	 * @param {string} msg 提示文本
	 * @param {number} [dur] 显示时长（毫秒），默认 3200
	 * @returns {?HTMLElement} toast 元素句柄，失败返回 null
	 */
	function toast(msg, dur){
	    const wrap = getEl('toastWrap'); if (!wrap || !msg) return null;
	    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
	    wrap.appendChild(t);
	    t._timer = setTimeout(() => { t.style.transition = 'opacity .3s'; t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, dur || 3200);
	    return t;
	}
	/* ★手动移除某个 toast（识别结束立即清除提示用） */
	/**
	 * 手动移除指定 toast（用于识别结束立即清除提示，避免滞留）。
	 *
	 * @param {?HTMLElement} t toast 元素句柄
	 */
	function dismissToast(t){
	    if (!t || !t.parentNode) return;
	    clearTimeout(t._timer);
	    t.style.transition = 'opacity .2s'; t.style.opacity = '0';
	    setTimeout(() => t.remove(), 220);
	}
	/**
	 * 页内自定义确认弹窗（替代原生 confirm，风格与页面统一）。
	 *
	 * @param {string} text 确认文本
	 * @returns {Promise<boolean>} 确定 resolve(true)，取消 resolve(false)
	 */
	function customConfirm(text){
	    return new Promise(resolve => {
	        const mask = getEl('confirmMask');
	        if (!mask) { resolve(window.confirm(text)); return; }
	        getEl('confirmText').textContent = text;
	        getEl('confirmOkBtn').textContent = tr('confirmOk');
	        getEl('confirmCancelBtn').textContent = tr('confirmCancel');
	        mask.classList.add('show');
	        let done = false;
	        const finish = v => { if (done) return; done = true; mask.classList.remove('show'); resolve(v); };
	        getEl('confirmOkBtn').onclick = () => finish(true);
	        getEl('confirmCancelBtn').onclick = () => finish(false);
	        mask.onclick = e => { if (e.target === mask) finish(false); };
	    });
	}

/* ================= 安全存储 ================= */
	/**
	 * 安全读取 localStorage，异常时返回默认值，不抛错。
	 *
	 * @param {string} k 键名
	 * @param {*} d 默认值
	 * @returns {*} 读取结果
	 */
	function safeGet(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } }
	/**
	 * 安全写入 localStorage，失败（如空间满）返回 false。
	 *
	 * @param {string} k 键名
	 * @param {string} v 值
	 * @returns {boolean} 是否成功
	 */
	function safeSet(k, v){ try { localStorage.setItem(k, v); return true; } catch(e){ return false; } }
	/**
	 * 安全删除 localStorage 指定键，忽略异常。
	 *
	 * @param {string} k 键名
	 */
	function safeDel(k){ try { localStorage.removeItem(k); } catch(e){} }
	/**
	 * getElementById 简写。
	 *
	 * @param {string} id 元素 id
	 * @returns {?HTMLElement} 元素或 null
	 */
	function getEl(id){ return document.getElementById(id); }

/* ================= ⚙ 设置弹窗 ================= */
	/**
	 * 打
	 *
	 * 开
	 */
	function openSettings(){ getEl('settingsModalMask')?.classList.add('show'); applyFontScale(fontScale); updateVoiceUI(); refreshAudioMsgList(); }
	/**
	 * 关
	 *
	 * 闭
	 */
	function closeSettings(){ getEl('settingsModalMask')?.classList.remove('show'); }
	/* ===== 字体大小 ===== */
	const FONT_MIN = 0.3, FONT_MAX = 4;
	let fontScale = Math.min(FONT_MAX, Math.max(FONT_MIN, parseFloat(safeGet('fyyzt_font_scale', '1')) || 1));
	/**
	 * 应用全局字体缩放系数（0.3-4.0），同步滑块/输入框/预设按钮 UI 并持久化。
	 *
	 * @param {number} v 缩放倍数
	 */
	function applyFontScale(v){
	    fontScale = Math.min(FONT_MAX, Math.max(FONT_MIN, v));
	    document.documentElement.style.setProperty('--font-scale', fontScale);
	    const slider = getEl('fontSlider'), num = getEl('fontNumInput'), disp = getEl('fontScaleDisp');
	    if (slider) slider.value = fontScale;
	    if (num) num.value = Math.round(fontScale * 10) / 10;
	    if (disp) disp.textContent = fontScale.toFixed(1) + 'x';
	    document.querySelectorAll('.preset-btn[data-scale]').forEach(b => {
	        b.classList.toggle('active', Math.abs(parseFloat(b.dataset.scale) - fontScale) < 0.001);
	    });
	    safeSet('fyyzt_font_scale', String(fontScale));
	}
