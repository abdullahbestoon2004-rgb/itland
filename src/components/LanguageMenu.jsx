import { useEffect, useRef, useState } from 'react';
import { Check, Languages } from 'lucide-react';
import { useLocale } from '../context/LocaleContext';

const languages = [
  { code: 'en', label: 'English', tag: 'EN' },
  { code: 'ku', label: 'کوردی', tag: 'KU' },
  { code: 'ar', label: 'العربية', tag: 'AR' },
];

export default function LanguageMenu() {
  const { language, setLanguage } = useLocale();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const initialFocus = useRef(0);
  const title = { en: 'Language', ku: 'زمان', ar: 'اللغة' }[language];

  useEffect(() => {
    if (!open) return;
    const items = root.current.querySelectorAll('[role="menuitemradio"]');
    items[initialFocus.current]?.focus();
    const outside = event => {
      if (!root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  const handleKeys = event => {
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); }
      close();
      return;
    }
    const items = [...root.current.querySelectorAll('[role="menuitemradio"]')];
    const index = items.indexOf(document.activeElement);
    const next = { ArrowDown: (index + 1) % items.length, ArrowUp: (index - 1 + items.length) % items.length, Home: 0, End: items.length - 1 }[event.key];
    if (next !== undefined) { event.preventDefault(); items[next]?.focus(); }
  };

  return <div className="language-control" ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className={`action-btn ${open ? 'language-trigger-active' : ''}`}
      aria-label="Language / زمان / اللغة" title={title} aria-haspopup="menu"
      aria-expanded={open} aria-controls={open ? 'language-menu' : undefined}
      onClick={() => {
        initialFocus.current = Math.max(0, languages.findIndex(item => item.code === language));
        setOpen(value => !value);
      }}
      onKeyDown={event => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
          event.preventDefault(); initialFocus.current = event.key === 'ArrowUp' ? languages.length - 1 : 0; setOpen(true);
        }
      }}><Languages size={20} aria-hidden="true" /></button>
    {open && <div className="language-popup" id="language-menu" role="menu" aria-label={title} onKeyDown={handleKeys}>
      <p className="language-popup-title" aria-hidden="true">{title}</p>
      {languages.map(item => <button key={item.code} type="button" role="menuitemradio" tabIndex={-1}
        aria-checked={language === item.code} className="language-option"
        onClick={() => { setLanguage(item.code); close(); }}>
        <bdi className="language-name" lang={item.code === 'ku' ? 'ckb' : item.code}>{item.label}</bdi>
        <span className="language-option-trailing" aria-hidden="true">
          {language === item.code ? <Check size={17} /> : <span>{item.tag}</span>}
        </span>
      </button>)}
    </div>}
  </div>;
}
