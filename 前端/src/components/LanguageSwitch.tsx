// 语言切换按钮（展示组件）：在中文 / 英文 / 朝鲜语之间切换
// 切换后：界面框架文案跟着变，模型的回答语言也跟着变（请求里带 language）
import { Languages } from 'lucide-react';
import { LANGUAGES, useI18n } from '../i18n';

interface LanguageSwitchProps {
  /** 切换完成后的回调，交给上层决定要不要用新语言重答 */
  onChanged?: (next: 'zh' | 'en' | 'ko') => void;
}

export default function LanguageSwitch({ onChanged }: LanguageSwitchProps) {
  const { lang, setLang, t } = useI18n();

  const next = () => {
    const index = LANGUAGES.findIndex((item) => item.value === lang);
    const nextLang = LANGUAGES[(index + 1) % LANGUAGES.length].value;
    setLang(nextLang);
    onChanged?.(nextLang);
  };

  const current = LANGUAGES.find((item) => item.value === lang) ?? LANGUAGES[0];

  return (
    <button
      type="button"
      onClick={next}
      title={`${t('lang.switch')}（${LANGUAGES.map((item) => item.label).join(' / ')}）`}
      aria-label={t('lang.switch')}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11.5px] text-text-faint transition-colors duration-150 hover:border-border-strong hover:text-text-primary"
    >
      <Languages size={13} aria-hidden="true" />
      {current.short}
    </button>
  );
}
