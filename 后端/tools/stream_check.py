#!/usr/bin/env python
"""流式输出实测脚本：验证「真流式」并给出可复现的数字。

技术文档里写了「一次数据类回答下发约 300 个文本片段、首末跨度约 1.3 秒」，
这个数字应该能被任何人复跑出来，而不是只存在于文档里。
注意：该数字需要后端配置了真实 LLM_API_KEY；演示模式（无密钥）下回答由本地
生成、片段会一次性到达，脚本会明确标注，不会被误判成「假流式」。

用法（先启动后端，再在后端目录下运行）：
    .venv\\Scripts\\python.exe tools/stream_check.py
    .venv\\Scripts\\python.exe tools/stream_check.py "稻瘟病怎么防治"
"""

from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.request

ENDPOINT = "http://127.0.0.1:8000/api/ask"


def measure(question: str) -> tuple[int, float, int, float, bool, bool]:
    """返回 (片段数, 首末跨度秒, 正文字数, 总耗时秒, 是否收到完整结果, 是否演示模式)."""
    body = json.dumps({"question": question}, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(
        ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
        method="POST",
    )

    started = time.time()
    times: list[float] = []
    text = ""
    got_result = False
    demo = False

    with urllib.request.urlopen(request, timeout=180) as response:
        for raw in response:
            line = raw.decode("utf-8", "ignore").strip()
            if not line.startswith("data:"):
                continue
            payload = line[5:].strip()
            if payload == "[DONE]":
                break
            try:
                data = json.loads(payload)
            except json.JSONDecodeError:
                continue

            if "delta" in data and "chart_config" not in data:
                times.append(time.time() - started)
                text += data["delta"]
            elif "chart_config" in data:
                got_result = True
                demo = data.get("demo") is True

    span = times[-1] - times[0] if len(times) >= 2 else 0.0
    return len(times), span, len(text), time.time() - started, got_result, demo


def main() -> int:
    questions = sys.argv[1:] or ["2016到2025年产量趋势", "你好"]

    print(f"目标：{ENDPOINT}")
    print("-" * 74)

    for question in questions:
        try:
            count, span, chars, total, ok, demo = measure(question)
        except urllib.error.URLError as exc:
            print(f"[{question}] 连接失败：{exc}")
            print("提示：先启动后端（双击「一键启动.bat」或手动跑 uvicorn）")
            return 1

        print(f"[{question}]")
        print(f"  片段 {count} 个 | 首末跨度 {span:.2f} 秒 | 正文 {chars} 字 | 总耗时 {total:.2f} 秒")
        print(f"  完整结果：{'已收到' if ok else '未收到（可能触发了兜底）'}")

        if demo:
            # 演示模式的片段是本地一次性生成的，跨度必然接近 0，不能据此判定「假流式」
            print("  判定：演示模式（未配置 LLM_API_KEY），片段由本地一次性下发；")
            print("        要测真实流式，请在 后端/.env 填入 LLM_API_KEY 后重跑。")
        elif count >= 2 and span > 0.5:
            print("  判定：真流式——文字在生成过程中持续到达")
        elif count >= 2:
            print("  判定：片段到达但跨度很短，可能是一次性缓冲后转发")
        else:
            print("  判定：未观察到增量输出")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
