# -*- coding: utf-8 -*-
"""
流式生成模块：封装大模型调用和流式输出逻辑。
"""

import logging
from openai import OpenAI
from config import (
    DASHSCOPE_API_KEY, DASHSCOPE_BASE_URL, MODEL_NAME,
    TEMPERATURE, TOP_P, MAX_TOKENS, STREAM,
    SYSTEM_PROMPT, FIXED_ADVICE
)
from utils import (
    is_mild_symptom, get_fixed_response, remove_markdown_bold,
    chunk_text_by_char, sleep_ms, contains_source, append_fallback_source
)

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 初始化 OpenAI 客户端（兼容阿里云 DashScope）
client = OpenAI(
    api_key=DASHSCOPE_API_KEY,
    base_url=DASHSCOPE_BASE_URL
) if DASHSCOPE_API_KEY else None

def generate_stream(question):
    """
    流式生成回答的主函数。
    参数：
        question (str): 用户输入的问题
    生成器：
        逐字符输出回答内容
    """
    # ----- 步骤1：非紧急症状快速拦截 -----
    if is_mild_symptom(question):
        fixed = get_fixed_response()
        for ch in fixed:
            yield ch
            sleep_ms(30)  # 模拟打字速度
        return

    # ----- 步骤2：检查 API 客户端是否可用 -----
    if client is None:
        error_msg = "抱歉，系统配置错误，请联系管理员。"
        for ch in error_msg:
            yield ch
            sleep_ms(30)
        return

    # ----- 步骤3：调用大模型流式接口 -----
    try:
        stream = client.chat.completions.create(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": question}
            ],
            extra_body={"enable_thinking": True},
            temperature=TEMPERATURE,
            top_p=TOP_P,
            max_tokens=MAX_TOKENS,
            stream=STREAM
        )
    except Exception as e:
        logger.error(f"API调用失败: {e}")
        error_msg = "抱歉，系统繁忙，请稍后再试。"
        for ch in error_msg:
            yield ch
            sleep_ms(30)
        return

    # ----- 步骤4：处理流式响应并逐字符输出 -----
    full_answer = ""
    for chunk in stream:
        if chunk.choices and len(chunk.choices) > 0:
            delta = chunk.choices[0].delta
            if hasattr(delta, "content") and delta.content:
                # 移除 Markdown 加粗标记
                clean_text = remove_markdown_bold(delta.content)
                full_answer += clean_text
                # 逐字符发送
                for ch in clean_text:
                    yield ch
                    sleep_ms(20)  # 20ms/字符，可调节

    # ----- 步骤5：补充来源信息（如果缺失） -----
    if not contains_source(full_answer):
        source_text = append_fallback_source("")
        for ch in source_text:
            yield ch
            sleep_ms(20)

    logger.info(f"回答生成完毕，总字符数: {len(full_answer)}")