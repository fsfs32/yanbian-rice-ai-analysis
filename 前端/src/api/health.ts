// 服务信息：读取后端 /health 暴露的模型名与运行模式，用于顶栏状态角标
// 拿不到就返回 null，界面退化为只显示延迟，不阻塞任何流程

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

export interface ServiceInfo {
  /** 后端当前配置的模型名；未知时为 null */
  model: string | null;
  /** 是否处于演示模式（未配置 LLM_API_KEY） */
  demo: boolean;
}

/** 拉取后端运行信息；失败返回空信息 */
export async function fetchServiceInfo(): Promise<ServiceInfo> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET' });
    if (!response.ok) return { model: null, demo: false };
    const data: unknown = await response.json();
    if (typeof data !== 'object' || data === null) return { model: null, demo: false };
    const model = (data as { model?: unknown }).model;
    const demo = (data as { demo?: unknown }).demo;
    return {
      model: typeof model === 'string' && model.trim() ? model : null,
      demo: demo === true,
    };
  } catch {
    // 后端未启动 / 网络异常时静默降级
    return { model: null, demo: false };
  }
}
