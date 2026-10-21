import { helpContent } from '../data/help';
import { useLocale } from '../context/LocaleContext';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '../utils/storefront';
import usePageMeta from '../hooks/usePageMeta';
import './ShoppingHelp.css';
export default function ShoppingHelp() {
  const {
    t
  } = useLocale();
  const {
    topic
  } = useParams();
  const page = helpContent[topic];
  usePageMeta({
    title: page?.title ?? 'Shopping help',
    description: page?.intro,
    path: page ? `/help/${topic}` : undefined,
    noindex: !page
  });
  if (!page) return <div className="shopping-help section-container"><h1>{t("Page not found")}</h1><Link to="/help/delivery">{t("Delivery & ordering information")}</Link></div>;
  return <article className="shopping-help section-container">
        <nav className="help-nav" aria-label="Shopping help">
            {Object.entries(helpContent).map(([key, entry]) => <Link key={key} to={`/help/${key}`} aria-current={topic === key ? 'page' : undefined}>{t(entry.title)}</Link>)}
        </nav>
        <p className="help-eyebrow">IT LAND SUPPORT</p>
        <h1>{t(page.title)}</h1>
        <p className="help-intro">{t(page.intro)}</p>
        <div className="help-sections">{page.sections.map(([title, text]) => <section key={t(title)}><h2>{t(title)}</h2><p>{t(text)}</p></section>)}</div>
        <a className="btn btn-primary" href={whatsappLink(`Hello IT Land! I have a question about ${page.title.toLowerCase()}.`)} target="_blank" rel="noreferrer"><MessageCircle size={20} />{t("Ask on WhatsApp")}</a>
        <p className="help-contact">WhatsApp: <bdi>07504888570</bdi></p>
    </article>;
}
