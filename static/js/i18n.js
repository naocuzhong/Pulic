/**
 * ============================================================================
 *  福医卒中通 · 脑卒中智能问答助手
 *  文件名称：i18n.js
 *  文件功能：中英文国际化文案与界面语言切换
 *  依赖文件：core.js
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

/* ================= 中英文文案 ================= */
	const I18N = {
	zh:{
	    mainTitle:'福医卒中通·脑卒中智能问答助手',
	    setBtn:'设置', setTitle:'⚙️ 设置',
	    langLabel:'🌐 界面语言', langNow:'当前：中文', langTo:'切换到 English',
	    fontLabel:'🔤 字体大小', fontCur:'当前倍数：', fontApply:'应用', fontReset:'恢复默认',
	    fontPS:'小', fontPM:'标准', fontPL:'大', fontPX:'特大', fontPXX:'超大',
	    fontRangeTip:'拖动滑块 / 点 A＋A− / 输入数值，范围 0.3 - 4.0，立即生效',
	    voiceLabel:'🔊 语音播报', voiceOnState:'已开启', voiceOffState:'已关闭',
	    voiceSub:'开启后自动朗读助手的回复',
	    voiceGenderLabel:'播报声音', voiceGenderAuto:'跟随系统', voiceGenderFemale:'女声', voiceGenderMale:'男声',
	    voiceSpeedLabel:'播报速度',
	    voicePreview:'🔊 试听效果', voicePreviewText:'您好，我是脑卒中智能问答助手，卒中又称中风，需要注意血压、供血与康复训练。',
	    voiceTip:'声音与速度点击即生效并自动保存，试听可体验当前效果（已内置卒中等多音字发音修正）',
	    recordLabel:'📁 记录保存', exportPdf:'📄 导出聊天记录PDF', saveAudio:'💾 保存为音频',
	    stopAudioSave:'🔴 录制中，点击停止', audioProcessing:'⏳ 正在转换音频...',
	    audioMsgLabel:'选择要保存的AI回答', noMsgOption:'（暂无可保存的回答）',
	    recordTip:'PDF包含全部问答记录；录制音频请选"整个屏幕"并勾选"共享系统音频"（电脑版 Chrome / Edge）',
	    noChatToExport:'暂无可导出的聊天记录', noMsgToSave:'暂无可保存的AI回答',
	    pdfGenerating:'⏳ 正在生成PDF...', pdfFail:'PDF生成失败，请重试',
	    printFallbackTip:'组件加载失败，将打开打印窗口：请在"目标打印机"中选择"另存为PDF"即可保存文件',
	    audioUnsupported:'当前浏览器不支持录制音频，请使用电脑版 Chrome / Edge',
	    audioHint:'即将录制所选AI回答的语音播报：\n\n① 在弹出的共享窗口中，选择「整个屏幕」，并务必勾选「同时共享系统音频」（重要：朗读声音走系统音频，选"标签页"会录到静音）\n\n② 点「分享」后自动朗读并录制，结束后自动下载 WAV 音频文件\n\n③ 想提前结束：再次点击「保存为音频」按钮即可\n\n现在开始吗？',
	    audioNoTrack:'未共享到音频，已取消。请在共享窗口勾选「共享系统音频」后重试',
	    audioRecordFail:'录制失败，请重试',
	    audioSilent:'录制的音频没有声音。\n请重试：共享时选择「整个屏幕」，并勾选「共享系统音频」（Windows）',
	    confirmTitle:'请确认', confirmOk:'开 始', confirmCancel:'取 消',
	    speakBtnLabel:'播放', speakBtnTitle:'点击播放本条回答；播放中点击=停止并关闭自动播报',
	    voicePlaying:'🔊 正在播放本条回答，再次点击喇叭可停止',
	    voiceStopped:'⏹ 已停止播报，自动播报已关闭',
	    audioRecordingNow:'音频录制中，请稍后再试',
	    micPermission:'麦克风权限被拒绝：请点击地址栏左侧图标，允许"麦克风"后重试',
	    /* ★移动端修复8：手机端专属权限提示 + 内嵌浏览器引导 */
	    micPermissionMobile:'麦克风权限被拒绝，请检查两层权限：\n① 浏览器「设置 → 网站设置 → 麦克风」设为允许\n② 手机系统「设置 → 应用 → Chrome → 权限 → 麦克风」设为允许\n然后刷新页面重试',
		micNetworkMobile:'语音识别连接失败：手机浏览器的语音识别依赖谷歌在线服务，部分手机或网络环境无法使用，请改用打字输入',
	    micServiceBlocked:'语音服务被限制：手机端语音识别依赖谷歌在线服务，无谷歌服务的手机或部分网络环境无法使用，请改用打字输入',
	    micInApp:'微信/QQ内嵌浏览器无法使用麦克风：请点右上角「…」→「在浏览器打开」，用系统浏览器访问后再试',
	    micNetwork:'语音识别服务连接失败，请检查网络后重试（需联网）',
	    micNoSpeech:'没有检测到语音，请靠近麦克风再试一次',
	    micNoDevice:'未检测到麦克风设备，请检查设备连接',
	    micBusy:'麦克风可能被其他应用占用（通话/录音/语音助手等），请关闭后重试',
	    micRecStart:'🎙️ 录音中…说完再点一次麦克风',
	    micRecognizing:'⏳ 正在识别，请稍候…',
	    micRecFail:'录音失败，请重试',
	    micSttFail:'识别失败，请检查网络或稍后重试',
	    micSttEmpty:'没有听清，请靠近麦克风再试一次',
	    micSysDenied:'语音识别不可用，已改用录音模式：点麦克风说话，再点一次即可发送',
	    micUnsupported:'当前浏览器不支持语音输入，请使用 Chrome / Edge',
	    micFail:'麦克风启动失败，请重试',
	    voiceUnsupported:'当前浏览器不支持语音播报功能',
	    imgInvalid:'请选择图片文件（jpg / png / webp 等）',
	    imgTooLarge:'图片过大，请选择 15MB 以内的图片',
	    imgFail:'图片处理失败，请更换图片重试',
	    placeholder:'问脑卒中相关问题：预防、康复、养护、心理支持...',
	    send:'发送', clear:'清空', micTitle:'语音输入（说完自动发送）', closeTip:'关闭',
	    welcome:'你好！我是脑卒中智能问答助手，可咨询预防、康复、养护、心理支持等问题~\n💡 点击回答下方的 🔊 可播放语音；点击任意头像可更换头像。',
	    thinking:'🤔 思考中...', netErr:'抱歉，网络错误，请稍后再试。',
	    sideDoctor:'福医卒中通', sidePatient:'咨询患者',
	    avTitle:'🎨 头像设置',
	    avTip:'点击侧边栏或聊天中的头像均可打开此窗口<br>自定义头像仅保存在本机浏览器，支持 jpg / png / webp 等格式',
	    avDoctor:'⛑️ 助手头像（医生）', avPatient:'♿ 患者头像（我）',
	    avUpload:'📤 上传自定义', avReset:'↺ 恢复默认', avDone:'完 成',
	    avChange:'📷 更换头像', avClickChange:'点击更换头像', avUse:'使用该头像',
	    questions:['高血压怎么预防中风？','中风后吃什么好？','家人中风后怎么照顾？','怎么判断是不是中风？','中风后手脚没力气怎么办？','中风后情绪低落怎么办？','中风康复训练有哪些？','颈动脉斑块需要治疗吗？','中风后可以运动吗？','怎么帮家人做心理疏导？']
	},
	en:{
	    mainTitle:'Fuyi Stroke Assistant · Intelligent Stroke Q&A',
	    setBtn:'Settings', setTitle:'⚙️ Settings',
	    langLabel:'🌐 Language', langNow:'Current: English', langTo:'切换到中文',
	    fontLabel:'🔤 Font Size', fontCur:'Current scale: ', fontApply:'Apply', fontReset:'Reset',
	    fontPS:'S', fontPM:'Normal', fontPL:'Large', fontPX:'XL', fontPXX:'XXL',
	    fontRangeTip:'Drag slider / tap A＋A− / type a value (0.3 - 4.0), applies instantly',
	    voiceLabel:'🔊 Voice Broadcast', voiceOnState:'Enabled', voiceOffState:'Disabled',
	    voiceSub:'Reads assistant replies aloud automatically',
	    voiceGenderLabel:'Voice Type', voiceGenderAuto:'System Default', voiceGenderFemale:'Female', voiceGenderMale:'Male',
	    voiceSpeedLabel:'Speech Rate',
	    voicePreview:'🔊 Preview', voicePreviewText:'Hello, I am the stroke Q&A assistant. A stroke is also called a brain attack; watch your blood pressure and rehabilitation.',
	    voiceTip:'Voice & rate apply and save instantly. Built-in medical pronunciation fixes included',
	    recordLabel:'📁 Save Records', exportPdf:'📄 Export Chat PDF', saveAudio:'💾 Save as Audio',
	    stopAudioSave:'🔴 Recording... tap to stop', audioProcessing:'⏳ Converting...',
	    audioMsgLabel:'Choose the AI reply to save', noMsgOption:'(No reply to save yet)',
	    recordTip:'PDF includes the full Q&A; for audio recording pick "Entire Screen" + "Share system audio" (desktop Chrome / Edge)',
	    noChatToExport:'No chat history to export', noMsgToSave:'No AI reply to save yet',
	    pdfGenerating:'⏳ Generating PDF...', pdfFail:'PDF generation failed, please retry',
	    printFallbackTip:'Libraries failed to load. A print window will open: choose "Save as PDF" as destination',
	    audioUnsupported:'Audio recording not supported. Please use desktop Chrome / Edge',
	    audioHint:'About to record the AI reply broadcast:\n\n1. In the share dialog pick "Entire Screen" and ENABLE "Share system audio" (important: TTS audio is system audio; tab sharing records silence)\n\n2. After sharing, the reply is read & recorded, then a WAV file downloads automatically\n\n3. To stop early, tap "Save as Audio" again\n\nStart now?',
	    audioNoTrack:'No audio shared. Please enable "Share system audio" and retry',
	    audioRecordFail:'Recording failed, please retry',
	    audioSilent:'The recorded audio is silent.\nPlease retry: pick "Entire Screen" and enable "Share system audio" (Windows)',
	    confirmTitle:'Please Confirm', confirmOk:'Start', confirmCancel:'Cancel',
	    speakBtnLabel:'Play', speakBtnTitle:'Play this reply; click again while playing = stop & turn off auto-broadcast',
	    voicePlaying:'🔊 Playing this reply. Tap the speaker again to stop',
	    voiceStopped:'⏹ Stopped. Auto-broadcast is now off',
	    audioRecordingNow:'Recording in progress, please wait',
	    micPermission:'Microphone permission denied. Allow mic access in the address bar and retry',
	    /* ★移动端修复8：手机端专属权限提示 + 内嵌浏览器引导 */
	    micPermissionMobile:'Microphone blocked. Please check BOTH levels:\n1. Browser: Settings → Site settings → Microphone → Allow\n2. Android system: Settings → Apps → Chrome → Permissions → Microphone → Allow\nThen reload this page',
		micNetworkMobile:'Speech service unreachable: mobile speech recognition relies on Google online services, which may be unavailable on some devices/networks. Please type instead',
	    micServiceBlocked:'Speech service blocked: mobile recognition relies on Google services. Unavailable on devices without them. Please type instead',
	    micInApp:'Voice input is unavailable inside WeChat/QQ. Tap "…" (top-right) → "Open in browser" and retry',
	    micNetwork:'Speech service unreachable. Check your network and retry',
	    micNoSpeech:'No speech detected. Please move closer to the mic and try again',
	    micNoDevice:'No microphone found. Please check your device',
	    micBusy:'Microphone may be occupied by another app (call/recorder/assistant). Close it and retry',
	    micRecStart:'🎙️ Recording… tap the mic again when finished',
	    micRecognizing:'⏳ Recognizing, please wait…',
	    micRecFail:'Recording failed, please retry',
	    micSttFail:'Recognition failed, check your network and retry',
	    micSttEmpty:"Didn't catch that. Please speak closer to the mic and retry",
	    micSysDenied:'Speech recognition unavailable. Record mode on: tap the mic to speak, tap again to send',
	    micUnsupported:'Voice input not supported. Please use Chrome / Edge',
	    micFail:'Failed to start microphone, please retry',
	    voiceUnsupported:'Speech synthesis is not supported in this browser',
	    imgInvalid:'Please choose an image file (jpg / png / webp)',
	    imgTooLarge:'Image too large (max 15MB)',
	    imgFail:'Failed to process image, please try another one',
	    placeholder:'Ask stroke-related questions: prevention, rehab, care, emotional support...',
	    send:'Send', clear:'Clear', micTitle:'Voice input (auto-sends when done)', closeTip:'Close',
	    welcome:"Hello! I'm your stroke assistant. Ask about prevention, rehab, daily care or emotional support~\n💡 Tap the 🔊 under a reply to hear it; click any avatar to change it.",
	    thinking:'🤔 Thinking...', netErr:'Sorry, network error. Please try again later.',
	    sideDoctor:'Fuyi Stroke', sidePatient:'Patient (Me)',
	    avTitle:'🎨 Avatar Settings',
	    avTip:'Click any avatar (sidebar or in chat) to open this panel<br>Custom avatars are saved in this browser only · jpg / png / webp',
	    avDoctor:'⛑️ Assistant Avatar (Doctor)', avPatient:'♿ My Avatar (Patient)',
	    avUpload:'📤 Upload', avReset:'↺ Reset', avDone:'Done',
	    avChange:'📷 Change', avClickChange:'Click to change avatar', avUse:'Use this avatar',
	    questions:['How to prevent stroke with hypertension?','What to eat after a stroke?','How to care for a family member after stroke?','How to tell if it is a stroke?','What to do about limb weakness after stroke?','How to deal with low mood after stroke?','What rehabilitation training is available?','Does carotid plaque need treatment?','Can I exercise after a stroke?','How to support my family member emotionally?']
	}};
	/**
	 * 按当前语言取文案，缺失时回退中文。
	 *
	 * @param {string} key 文案键名
	 * @returns {string} 文案内容
	 */
	function tr(key){ return (I18N[lang] && I18N[lang][key]) || I18N.zh[key] || ''; }
	/**
	 * 将
	 *
	 * 当
	 */
	function applyLang(){
	    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
	    document.title = lang === 'zh' ? '福医卒中通 · 脑卒中智能问答助手' : 'Fuyi Stroke Assistant · Intelligent Stroke Q&A';
	    document.querySelectorAll('[data-i18n]').forEach(el => { const v = tr(el.getAttribute('data-i18n')); if (v) el.innerHTML = v; });
	    const sb = getEl('setBtn');   if (sb) sb.title = tr('setTitle').replace('⚙️ ','');
	    const sc = getEl('settingsClose'); if (sc) sc.title = tr('closeTip');
	    const inp = getEl('input');   if (inp) inp.placeholder = tr('placeholder');
	    const mic = getEl('micBtn');  if (mic) mic.title = tr('micTitle');
	    const sdb = getEl('sendBtn'); if (sdb) sdb.textContent = tr('send');
	    const cb = getEl('clearBtn'); if (cb) cb.textContent = tr('clear');
	    const lc = getEl('langCurrent');    if (lc) lc.textContent = tr('langNow');
	    const lsb = getEl('langSwitchBtn'); if (lsb) lsb.textContent = tr('langTo');
	    document.querySelectorAll('.speak-btn').forEach(b => { b.innerHTML = '🔊 ' + tr('speakBtnLabel'); b.title = tr('speakBtnTitle'); });
	    updateVoiceUI();
	    const modal = getEl('settingsModalMask');
	    if (modal && modal.classList.contains('show')) refreshAudioMsgList();
	    const qs = tr('questions');
	    for (let i = 1; i <= 10; i++) { const b = getEl('quick' + i); if (b && qs[i-1]) b.textContent = qs[i-1]; }
	}

/* ===== 语言切换 ===== */
	let switchingLang = false;
	/**
	 * 切
	 *
	 * 换
	 */
	async function switchLang(){
	    if (switchingLang) return; switchingLang = true;
	    lang = lang === 'zh' ? 'en' : 'zh';
	    await fetch('/api/switch_lang', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ lang }) }).catch(e => console.log(e));
	    if (recognition) recognition.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
	    stopSpeaking();
	    applyLang(); buildFloatDecor(); clearChat(); switchingLang = false;
	}
