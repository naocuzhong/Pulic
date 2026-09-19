# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, render_template, Response
import re
import os
import json
import logging
from openai import OpenAI, APIError, APITimeoutError, APIConnectionError
import httpx

# ===== 讯飞语音听写（流式版）WebAPI 转写 新增 import =====
import base64
import hashlib
import hmac
import ssl
import threading
import time
from datetime import datetime
from urllib.parse import urlencode

import websocket  # pip install websocket-client

app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG)

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY")
if not DASHSCOPE_API_KEY:
    app.logger.warning("未设置环境变量 DASHSCOPE_API_KEY")

DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MODEL_NAME = "qwen3.5-27b-558634c99d67"  # 或 "qwen-plus"

# ===== 讯飞语音听写配置（在 Render 面板设置同名环境变量）=====
XFYUN_APP_ID = os.environ.get("XFYUN_APP_ID", "")
XFYUN_API_KEY = os.environ.get("XFYUN_API_KEY", "")
XFYUN_API_SECRET = os.environ.get("XFYUN_API_SECRET", "")
if not (XFYUN_APP_ID and XFYUN_API_KEY and XFYUN_API_SECRET):
    app.logger.warning("未设置讯飞环境变量 XFYUN_APP_ID / XFYUN_API_KEY / XFYUN_API_SECRET，语音转写不可用")

XFYUN_HOST = 'iat-api.xfyun.cn'
XFYUN_PATH = '/v2/iat'
XFYUN_WS_URL = 'wss://iat-api.xfyun.cn/v2/iat'


http_client = httpx.Client(
    timeout=httpx.Timeout(120.0, connect=30.0, read=120.0, write=30.0)
)

if DASHSCOPE_API_KEY:
    client = OpenAI(
        api_key=DASHSCOPE_API_KEY,
        base_url=DASHSCOPE_BASE_URL,
        http_client=http_client
    )
else:
    client = None

@app.after_request
def add_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Cache-Control'] = 'no-cache'
    return response

def generate_stream(question):
    # 非紧急症状过滤（一次性返回）
    mild_pattern = re.compile(
        r'(头(?:有?点)?痛|头(?:有?点)?晕|眼花|疲劳|乏力|失眠|焦虑|消化不良|颈部不适|有点不舒服)',
        re.IGNORECASE
    )
    if mild_pattern.search(question):
        fixed = ("头痛的原因很多，比如疲劳、紧张或血压波动。请先坐下休息，喝点温水，观察一下。"
                 "如果疼痛持续不缓解或加重，再咨询医生。注意：本内容仅供参考，如有需要请及时就医。")
        yield fixed
        return

    system_prompt = (
        "你是一个脑卒中健康科普助手，专为老年人及家属提供温和、可信的健康知识。\n\n"
        "【回答风格】\n"
        "1. 直接回答用户的问题，不要以“您说得对”、“好的”、“是的”等肯定性词语开头。保持语气温和、简洁，直接给出建议或信息。\n"
        "2. 对于有明确证据支持的建议，请用数字序号列出（如“①”、“②”），每条建议后附上证据等级和来源，格式为“（A级证据，来源：《...》）”。\n"
        "   证据等级分为：A级（多中心RCT/指南推荐）、B级（单中心研究/专家共识）、C级（经验性建议）。\n"
        "3. 如果有多条建议，逐条列出。末尾统一附上温馨提示：“（本内容仅供参考，如有不适请及时就医）”。\n"
        "4. 所有来源必须真实可靠，根据您参考的知识提供，不得编造。\n\n"
        "【重要限制】\n"
        "1. 对于以下症状，绝对不要提及“脑卒中”、“中风”、“紧急就医”、“拨打120”等词汇，只需给予休息观察建议：\n"
        "   - 轻微头痛、头晕、眼花、疲劳、乏力、颈部不适、失眠、焦虑、消化不良等\n"
        "   - 回答示例：\n"
        "     “头痛的原因很多，比如疲劳、紧张或血压波动。请先坐下休息，喝点温水，观察一下。如果疼痛持续不缓解或加重，再咨询医生。”\n\n"
        "2. 只有当用户明确描述以下至少一项脑卒中典型征兆时，才明确建议立即就医：\n"
        "   - 一侧肢体突然无力或麻木\n"
        "   - 口角歪斜、说话不清\n"
        "   - 突发剧烈头痛（“像被雷劈一样”）\n"
        "   - 单侧视力突然模糊或失明\n"
        "   - 突然行走不稳、失去平衡\n\n"
        "3. 对于所有其他健康问题，回答应通俗易懂，引用权威知识，但始终强调“本内容仅供参考，如有不适请及时就医”。\n\n"
        "4. 绝不提供急救指导、药物剂量或替代医生诊断的建议。\n\n"
        "5. 如果用户描述的症状不在上述列表中，请先询问是否有其他症状，并建议先休息观察，切勿自行套用脑卒中标准。"
    )

    if not client:
        app.logger.error("OpenAI 客户端未初始化，请检查 DASHSCOPE_API_KEY")
        yield "系统配置错误，请联系管理员。"
        return

    try:
        app.logger.info(f"正在调用 DashScope API，问题：{question[:50]}...")
        stream = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question}
            ],
            extra_body={"enable_thinking": True},
            temperature=0.3,
            top_p=0.85,
            max_tokens=1024,
            stream=True
        )
    except APITimeoutError as e:
        app.logger.error(f"API 超时: {e}")
        yield "网络超时，请稍后再试。"
        return
    except APIConnectionError as e:
        app.logger.error(f"API 连接错误: {e}")
        yield "无法连接到服务，请检查网络或稍后重试。"
        return
    except APIError as e:
        app.logger.error(f"API 错误: {e}")
        yield "服务返回错误，请稍后重试。"
        return
    except Exception as e:
        app.logger.error(f"未知 API 错误: {e}", exc_info=True)
        yield "系统出错，请稍后重试。"
        return

    full_answer = ""
    try:
        for chunk in stream:
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if hasattr(delta, "content") and delta.content:
                    txt = delta.content.replace('**', '')
                    full_answer += txt
                    yield txt
    except (APITimeoutError, APIConnectionError, APIError) as e:
        app.logger.error(f"流式迭代 API 错误: {e}")
        if full_answer:
            yield "\n\n（回答未完整，网络可能中断，请重试）"
        else:
            yield "网络中断，请重试。"
        return
    except Exception as e:
        app.logger.error(f"流式迭代未知错误: {e}", exc_info=True)
        if full_answer:
            yield "\n\n（回答未完整，请重试）"
        else:
            yield "服务暂时不可用。"
        return

    # 如果模型没有添加温馨提示，自动补一个（但模型已按提示词会自带）
    if "本内容仅供参考" not in full_answer:
        yield "\n\n（本内容仅供参考，如有不适请及时就医）"

@app.route('/api/stream', methods=['POST'])
def stream():
    data = request.get_json() or {}
    q = data.get("question", "")
    if not q:
        return jsonify({"error": "问题为空"}), 400

    def gen():
        try:
            for ch in generate_stream(q):
                yield f"data: {json.dumps({'chunk': ch})}\n\n"
        except Exception as e:
            app.logger.error(f"Stream 生成器异常: {e}", exc_info=True)
            yield f"data: {json.dumps({'chunk': '服务暂时不可用，请稍后重试。'})}\n\n"
        yield "data: {\"done\": true}\n\n"

    return Response(gen(), mimetype="text/event-stream")

# ============================================================
# 讯飞语音听写（流式版）WebAPI —— 前端「录音识别模式」POST 16kHz WAV 到 /api/stt
# ============================================================
def xfyun_get_auth_url():
    """按讯飞规则生成鉴权 URL（HMAC-SHA256 签名）"""
    date = datetime.utcnow().strftime('%a, %d %b %Y %H:%M:%S GMT')
    signature_origin = 'host: %s\ndate: %s\nGET %s HTTP/1.1' % (XFYUN_HOST, date, XFYUN_PATH)
    signature_sha = hmac.new(XFYUN_API_SECRET.encode('utf-8'),
                             signature_origin.encode('utf-8'),
                             hashlib.sha256).digest()
    signature = base64.b64encode(signature_sha).decode('utf-8')
    authorization_origin = ('api_key="%s", algorithm="hmac-sha256", '
                            'headers="host date request-line", signature="%s"') % (XFYUN_API_KEY, signature)
    authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode('utf-8')
    return '%s?%s' % (XFYUN_WS_URL, urlencode({'authorization': authorization, 'date': date, 'host': XFYUN_HOST}))


def wav_to_pcm(wav: bytes) -> bytes:
    """前端 blobToWav 产出标准 PCM16 WAV，解析 data chunk 取裸 PCM；非 WAV 则原样返回"""
    if len(wav) < 44 or wav[:4] != b'RIFF':
        return wav
    i = 12
    while i + 8 <= len(wav):
        cid = wav[i:i + 4]
        csz = int.from_bytes(wav[i + 4:i + 8], 'little')
        if cid == b'data':
            return wav[i + 8:i + 8 + csz]
        i += 8 + csz + (csz & 1)
    return wav[44:]


def iflytek_iat(pcm: bytes, timeout=20) -> str:
    """调用讯飞语音听写 WebSocket 接口，返回识别文本"""
    pcm = pcm[:16000 * 2 * 60]  # 最长 60 秒
    state = {'final_parts': [], 'r1_texts': {}, 'err': None}

    def on_message(ws, message):
        try:
            data = json.loads(message)
        except Exception:
            return
        code = data.get('code')
        if code != 0:
            state['err'] = '讯飞错误 %s: %s' % (code, data.get('message'))
            ws.close()
            return
        d = data.get('data') or {}
        # ★修复：最后一帧(status=2)上通常带着最终识别结果，必须先解析再关连接
        result = d.get('result')
        if result:
            pgs = result.get('pgs', 'r2')
            text = ''.join(''.join(cw.get('w', '') for cw in w.get('cw', []))
                           for w in result.get('ws', []))
            if pgs == 'r1':
                state['r1_texts'][result.get('sn')] = text  # 动态修正的中间结果按 sn 覆盖
            else:
                state['final_parts'].append(text)
            app.logger.info('[stt] 收到结果 status=%s pgs=%s text=%s', d.get('status'), pgs, text[:30])
        if d.get('status') == 2:  # 最后一帧处理完后关闭
            ws.close()

    def on_open(ws):
        def run():
            # ★讯飞 iat WebAPI 采用 JSON 文本帧协议：每帧发送一段 JSON 字符串，
            #   data.audio 放 base64 编码的音频块；status: 1=首帧/中间帧，2=最后一帧
            chunk_size = 1280  # 每帧音频 ≤ 1280 字节
            pos, n = 0, len(pcm)
            frame_count = 0
            while True:
                chunk = pcm[pos:pos + chunk_size]
                is_last = (pos + chunk_size >= n)
                data = {
                    'status': 2 if is_last else 1,
                    'format': 'audio/L16;rate=16000',
                    'encoding': 'raw',
                    'audio': base64.b64encode(chunk).decode('utf-8')
                }
                if pos == 0:
                    frame = {
                        'common': {'app_id': XFYUN_APP_ID},
                        'business': {
                            'language': 'zh_cn',
                            'domain': 'iat',
                            'accent': 'mandarin',
                            'vad_eos': 3000,   # 静音 3 秒自动断句
                            'dwa': 'wpgs'      # 开启动态修正
                        },
                        'data': data
                    }
                else:
                    frame = {'data': data}
                try:
                    ws.send(json.dumps(frame))  # 文本帧（默认 opcode），服务器按 JSON 解析
                except Exception:
                    break
                frame_count += 1
                if is_last:
                    break
                pos += chunk_size
                time.sleep(0.01)
            app.logger.info('[stt] 音频发送完成：%d 帧, pcm=%d 字节', frame_count, len(pcm))
        threading.Thread(target=run, daemon=True).start()

    def on_error(ws, error):
        state['err'] = '讯飞连接错误: %s' % error

    def on_close(ws, code, msg):
        pass

    ws = websocket.WebSocketApp(xfyun_get_auth_url(),
                                on_open=on_open,
                                on_message=on_message,
                                on_error=on_error,
                                on_close=on_close)
    watchdog = threading.Timer(timeout, lambda: ws.close())
    watchdog.start()
    ws.run_forever(sslopt={'cert_reqs': ssl.CERT_NONE})
    watchdog.cancel()

    if state['err']:
        raise RuntimeError(state['err'])
    if state['final_parts']:
        return ''.join(state['final_parts'])
    if state['r1_texts']:
        return ''.join(state['r1_texts'][k] for k in sorted(state['r1_texts']))
    app.logger.warning('[stt] 讯飞返回空文本（pcm=%d 字节），疑似录音无声音或音频异常', len(pcm))
    return ''


@app.route('/api/stt', methods=['POST'])
def stt():
    if not (XFYUN_APP_ID and XFYUN_API_KEY and XFYUN_API_SECRET):
        return jsonify({'text': '', 'error': '服务端未配置讯飞密钥'}), 500
    wav_bytes = request.get_data()
    if not wav_bytes or len(wav_bytes) < 1000:
        return jsonify({'text': '', 'error': 'audio too short'}), 400
    try:
        text = iflytek_iat(wav_to_pcm(wav_bytes))
        return jsonify({'text': text})
    except Exception as e:
        app.logger.error('[stt] iflytek failed: %s', e)
        return jsonify({'text': '', 'error': str(e)}), 500


@app.route('/api/switch_lang', methods=['POST', 'OPTIONS'])
def switch_lang():
    if request.method == 'OPTIONS':
        return '', 200
    return jsonify({"status": "success"})

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
