// 服务信息：读取后端 /health 暴露的模型名，用于顶栏状态角标
// 拿不到就返回 null，界面退化为只显示延迟，不阻塞任何流程

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

/** 拉取后端当前使用的模型名；失败返回 null */
export async function fetchModelName(): Promise<string | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (typeof data === 'object' && data !== null && 'model' in data) {
      const model = (data as { model: unknown }).model;
      return typeof model === 'string' && model.trim() ? model : null;
    }
    return null;
  } catch {
    // 后端未启动 / 网络异常时静默降级
    return null;
  }
}
