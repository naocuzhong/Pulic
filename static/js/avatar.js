/**
 * ============================================================================
 *  福医卒中通：脑卒中智能问答平台（简称：福医卒中通助手）
 *  文件名称：avatar.js
 *  文件功能：头像系统：预设表情、自定义上传、本地持久化
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

/* ================= 头像系统 ================= */
	const DEFAULT_AV = {
	    doctor:  { emoji:'⛑️', bg:'linear-gradient(135deg,#E6F7FF 0%,#B7E2FF 100%)' },
	    patient: { emoji:'♿',  bg:'linear-gradient(135deg,#EAFBF1 0%,#C2EDD4 100%)' }
	};
	const PRESETS = {
	    doctor:  [['🩺','#E3F2FD'],['🧑‍⚕️','#E0F7FA'],['🏥','#E8F5E9'],['💉','#FCE4EC'],['💊','#FFF8E1'],['🚑','#FFEBEE'],['📋','#EDE7F6'],['🔬','#E0F2F1']],
	    patient: [['🧑‍🦽','#E8F5E9'],['🛏️','#FFF8E1'],['💊','#FCE4EC'],['🩹','#E3F2FD'],['🙂','#E0F7FA'],['🌿','#E8F5E9'],['💪','#FFFDE7'],['🧓','#F3E5F5']]
	};
	/**
	 * 校验头像存储值合法性（预设编号 p:N 或 data:image base64）。
	 *
	 * @param {string} v 存储值
	 * @returns {string} 合法值或空串
	 */
	function normalizeAvatar(v){
	    if (!v) return '';
	    if (/^p:\d+$/.test(v)) return v;
	    if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)) return v;
	    return '';
	}
	const avatarStore = {
	    doctor:  normalizeAvatar(safeGet('fyyzt_avatar_doctor', '')),
	    patient: normalizeAvatar(safeGet('fyyzt_avatar_patient', ''))
	};
	/**
	 * 生成头像 HTML：自定义图 > 预设表情 > 默认表情。
	 *
	 * @param {string} role doctor/patient
	 * @returns {string} HTML 字符串
	 */
	function getAvatarHTML(role){
	    const v = avatarStore[role] || '';
	    if (v.startsWith('data:')) return `<img src="${v}" alt="${role === 'patient' ? 'patient' : 'doctor'} avatar">`;
	    if (v.startsWith('p:')) {
	        const list = PRESETS[role];
	        const i = Math.min(list.length - 1, parseInt(v.slice(2), 10) || 0);
	        return `<div class="emoji-avatar" style="background:${list[i][1]}">${list[i][0]}</div>`;
	    }
	    const d = DEFAULT_AV[role];
	    return `<div class="emoji-avatar" style="background:${d.bg}">${d.emoji}</div>`;
	}
	/**
	 * 刷
	 *
	 * 新
	 */
	function refreshAvatars(){
	    const d = getEl('doctorAvatarBox'), p = getEl('patientAvatarBox');
	    if (d) d.innerHTML = getAvatarHTML('doctor');
	    if (p) p.innerHTML = getAvatarHTML('patient');
	    document.querySelectorAll('.message.assistant .msg-avatar').forEach(el => el.innerHTML = getAvatarHTML('doctor'));
	    document.querySelectorAll('.message.user .msg-avatar').forEach(el => el.innerHTML = getAvatarHTML('patient'));
	}
	/**
	 * 打
	 *
	 * 开
	 */
	function openAvatarModal(){ renderAvatarModal(); getEl('avatarModalMask')?.classList.add('show'); }
	/**
	 * 关
	 *
	 * 闭
	 */
	function closeAvatarModal(){ getEl('avatarModalMask')?.classList.remove('show'); }
	/**
	 * 渲
	 *
	 * 染
	 */
	function renderAvatarModal(){
	    ['doctor','patient'].forEach(role => {
	        const preview = getEl(role + 'PreviewBox');
	        if (preview) preview.innerHTML = getAvatarHTML(role);
	        const row = getEl(role + 'PresetRow'); if (!row) return;
	        row.innerHTML = '';
	        PRESETS[role].forEach(([emoji, bg], idx) => {
	            const val = 'p:' + idx;
	            const item = document.createElement('div');
	            item.className = 'preset-item' + (avatarStore[role] === val ? ' selected' : '');
	            item.style.background = bg; item.textContent = emoji; item.title = tr('avUse');
	            item.addEventListener('click', () => {
	                avatarStore[role] = val; safeSet('fyyzt_avatar_' + role, val);
	                refreshAvatars(); renderAvatarModal();
	            });
	            row.appendChild(item);
	        });
	    });
	}
	/**
	 * 上传图片头像：类型/大小校验 -> 居中裁剪 -> 240px 压缩 -> 存 localStorage。
	 *
	 * @param {File} file 图片文件
	 * @param {string} role doctor/patient
	 */
	function processAndStoreImage(file, role){
	    if (!file.type || !file.type.startsWith('image/')) { toast(tr('imgInvalid')); return; }
	    if (file.size > 15 * 1024 * 1024) { toast(tr('imgTooLarge')); return; }
	    const reader = new FileReader();
	    reader.onload = e => {
	        const img = new Image();
	        img.onload = () => {
	            try {
	                const size = 240, canvas = document.createElement('canvas');
	                canvas.width = size; canvas.height = size;
	                const ctx = canvas.getContext('2d');
	                if (!ctx) throw new Error('canvas unsupported');
	                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
	                const min = Math.min(img.width, img.height);
	                ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, size, size);
	                const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
	                avatarStore[role] = dataUrl;
	                safeSet('fyyzt_avatar_' + role, dataUrl);
	                refreshAvatars(); renderAvatarModal();
	            } catch(err) { toast(tr('imgFail')); console.error(err); }
	        };
	        img.onerror = () => toast(tr('imgFail'));
	        img.src = e.target.result;
	    };
	    reader.onerror = () => toast(tr('imgFail'));
	    reader.readAsDataURL(file);
	}
	/**
	 * 绑定某角色头像的上传/恢复默认按钮与文件选择事件。
	 *
	 * @param {string} role doctor/patient
	 */
	function bindAvatarControls(role){
	    const input = getEl(role + 'FileInput');
	    input?.addEventListener('change', () => {
	        const f = input.files && input.files[0];
	        if (f) processAndStoreImage(f, role);
	        input.value = '';
	    });
	    getEl(role + 'UploadBtn')?.addEventListener('click', () => input && input.click());
	    getEl(role + 'ResetBtn')?.addEventListener('click', () => {
	        avatarStore[role] = ''; safeDel('fyyzt_avatar_' + role);
	        refreshAvatars(); renderAvatarModal();
	    });
	}
