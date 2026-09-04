# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify, render_template, Response
import re
import os
import json
import logging
from openai import OpenAI, APIError, APITimeoutError, APIConnectionError
import httpx

app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG)

DASHSCOPE_API_KEY = os.environ.get("DASHSCOPE_API_KEY")
if not DASHSCOPE_API_KEY:
    app.logger.warning("未设置环境变量 DASHSCOPE_API_KEY")

DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1"
MODEL_NAME = "qwen3.5-27b-558634c99d67"  # 或 "qwen-plus"

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
