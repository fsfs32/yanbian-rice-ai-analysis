/* eslint-disable react-refresh/only-export-components --
   这个文件同时导出 Provider、useI18n 与语言常量。
   拆成三个文件能消掉这条告警，但会让「找翻译去哪改」多跳两次，
   在只有二十来条文案的规模下，集中放一处更好维护。 */
// 轻量国际化：中文 / 英文 / 朝鲜语
// 没引 i18next —— 需要翻译的文案就这些，一个 Context 加一张字典足够，
// 少一个依赖也少一处理解成本。
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'zh' | 'en' | 'ko';

/** 语言选项，顺序即切换顺序 */
export const LANGUAGES: { value: Lang; label: string; short: string }[] = [
  { value: 'zh', label: '中文', short: '中' },
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'ko', label: '조선어', short: '한' },
];

/** 界面文案字典。翻译覆盖面是「框架性文字」，示例问题仍为中文，见文档说明。 */
const MESSAGES = {
  zh: {
    'app.name': '延边大米 · 长势与产量',
    'app.tagline': 'AI 分析',
    'app.newChat': '新对话',
    'empty.greeting': '你好，我是延边大米长势与产量分析助手',
    'empty.subtitle': '用自然语言提问，即刻生成延边州水稻产量的趋势图表与关键指标。也可以上传 CSV，我帮你解读数据。',
    'empty.groupData': '查数据',
    'empty.groupKnowledge': '问知识',
    'input.placeholder': '问一个关于产量的问题，或上传 CSV 让我分析…',
    'input.categories': '问题类别',
    'input.send': '发送问题',
    'input.stop': '停止生成',
    'input.hint': '按 Enter 发送 · 试试问「产量趋势」',
    'menu.title': '不知道问什么？看看这些',
    'ai.note': 'AI 生成内容仅供参考',
    'ai.followup': '继续追问',
    'lang.switch': '切换语言',
    'history.title': '最近提问',
    'history.clear': '开始新对话',
    'ai.disclaimer': 'AI 生成内容仅供参考',
  },
  en: {
    'app.name': 'Yanbian Rice · Yield Insights',
    'app.tagline': 'AI analysis',
    'app.newChat': 'New chat',
    'empty.greeting': "Hi, I'm your Yanbian rice yield analyst",
    'empty.subtitle':
      'Ask in plain language and get a trend chart with key figures right away. You can also upload a CSV and I will read it for you.',
    'empty.groupData': 'Data',
    'empty.groupKnowledge': 'Knowledge',
    'input.placeholder': 'Ask about rice yield, or upload a CSV for analysis…',
    'input.categories': 'Question types',
    'input.send': 'Send',
    'input.stop': 'Stop',
    'input.hint': 'Press Enter to send · try "yield trend"',
    'menu.title': 'Not sure what to ask? Try these',
    'ai.note': 'AI-generated content for reference only',
    'ai.followup': 'Follow up',
    'lang.switch': 'Switch language',
    'history.title': 'Recent questions',
    'history.clear': 'New conversation',
    'ai.disclaimer': 'AI-generated content for reference only',
  },
  ko: {
    'app.name': '연변 쌀 · 생육과 생산량',
    'app.tagline': 'AI 분석',
    'app.newChat': '새 대화',
    'empty.greeting': '안녕하십니까, 연변 쌀 생육과 생산량 분석 도우미입니다',
    'empty.subtitle':
      '일상어로 물어보면 연변주 벼 생산량의 추세 도표와 핵심 지표를 바로 만들어 드립니다. CSV를 올리시면 데이터를 함께 분석해 드립니다.',
    'empty.groupData': '데이터',
    'empty.groupKnowledge': '지식',
    'input.placeholder': '생산량에 대해 물어보시거나 CSV를 올려 주십시오…',
    'input.categories': '질문 분류',
    'input.send': '보내기',
    'input.stop': '중지',
    'input.hint': 'Enter로 보내기 · 「생산량 추세」를 물어보세요',
    'menu.title': '무엇을 물을지 모르시겠습니까? 이것을 보십시오',
    'ai.note': 'AI 생성 내용은 참고용입니다',
    'ai.followup': '이어서 묻기',
    'lang.switch': '언어 전환',
    'history.title': '최근 질문',
    'history.clear': '새 대화 시작',
    'ai.disclaimer': 'AI 생성 내용은 참고용입니다',
  },
} as const;

export type MessageKey = keyof (typeof MESSAGES)['zh'];

interface I18nValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = 'yanbian-rice-lang';

function readInitialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'zh' || saved === 'en' || saved === 'ko') return saved;
  } catch {
    // 隐私模式下 localStorage 可能不可用，忽略即可
  }
  return 'zh';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  const value = useMemo<I18nValue>(() => {
    const setLang = (next: Lang) => {
      setLangState(next);
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // 存不进去也不影响本次会话
      }
    };
    return {
      lang,
      setLang,
      t: (key: MessageKey) => MESSAGES[lang][key] ?? MESSAGES.zh[key],
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n 必须在 I18nProvider 内使用');
  return value;
}
