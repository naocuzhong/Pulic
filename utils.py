# -*- coding: utf-8 -*-
"""
工具函数模块：提供正则匹配、文本清理、时间控制等辅助功能。
"""

import re
import time
from config import MILD_SYMPTOMS_PATTERN, FIXED_ADVICE

def is_mild_symptom(question):
    """
    判断用户输入是否属于非紧急症状。
    参数：
        question (str): 用户问题文本
    返回：
        bool: 如果匹配非紧急症状返回 True，否则返回 False
    """
    pattern = re.compile(MILD_SYMPTOMS_PATTERN, re.IGNORECASE)
    return bool(pattern.search(question))

def get_fixed_response():
    """
    获取非紧急症状的固定回答。
    返回：
        str: 固定建议文本
    """
    return FIXED_ADVICE

def remove_markdown_bold(text):
    """
    移除文本中的 Markdown 加粗标记（**）。
    参数：
        text (str): 原始文本
    返回：
        str: 清理后的文本
    """
    return text.replace('**', '')

def chunk_text_by_char(text, chunk_size=1):
    """
    将文本按字符切分，用于流式输出。
    参数：
        text (str): 待切分文本
        chunk_size (int): 每次切分的字符数（默认1）
    生成器：
        逐个字符或按块输出
    """
    for i in range(0, len(text), chunk_size):
        yield text[i:i+chunk_size]

def sleep_ms(ms):
    """
    毫秒级睡眠，用于控制流式输出速度。
    参数：
        ms (float): 毫秒数
    """
    time.sleep(ms / 1000.0)

def contains_source(text):
    """
    检查回答是否已包含来源信息。
    参数：
        text (str): 回答文本
    返回：
        bool: 包含“来源”或“参考”关键字返回 True
    """
    return "来源" in text or "参考" in text

def append_fallback_source(answer):
    """
    若回答没有来源，添加一个通用提示。
    参数：
        answer (str): 原始回答
    返回：
        str: 添加提示后的回答
    """
    from config import FALLBACK_SOURCE
    return answer + FALLBACK_SOURCE

def escape_newline(text):
    """
    将换行符替换为 HTML 换行标签，用于前端显示。
    参数：
        text (str): 原始文本
    返回：
        str: 替换后的文本
    """
    return text.replace('\n', '<br>')