import { useLocation } from 'react-router-dom';
import { useContext, useEffect } from 'react';
import { MetadataContext } from '../context/PageDataContext';
import { useLocale } from '../context/LocaleContext';
import { pageMetadata, renderHead } from '../utils/seo';

export { SITE_NAME, SITE_URL } from '../utils/seo';
export default function usePageMeta(options = {}) {
    const collector = useContext(MetadataContext);
    const { pathname } = useLocation();
    // Store pages exist in English, Arabic and Kurdish; the rest only in English.
    const { language, localized, t } = useLocale();
    const locale = localized ? language : null;
    const { title, description, image, path, jsonLd, noindex, type } = options;
    const meta = pageMetadata({ ...options, path: path ?? pathname, locale, t });
    if (collector) collector(meta);
    useEffect(() => {
        const next = pageMetadata({ title, description, image, path: path ?? pathname, jsonLd, noindex, type, locale, t });
        document.title = next.title;
        // Replace the full route metadata together, so product images and noindex never leak across navigation.
        document.head.querySelectorAll('meta[name="description"], meta[name="robots"], meta[name^="twitter:"], meta[property^="og:"], link[rel="canonical"], link[rel="alternate"][hreflang], script[data-page-meta]').forEach(el => el.remove());
        const template = document.createElement('template');
        template.innerHTML = renderHead(next).replace(/<title>[\s\S]*?<\/title>\n?/, '');
        document.head.append(template.content);
    }, [title, description, image, path, pathname, jsonLd, noindex, type, locale, t]);
}
