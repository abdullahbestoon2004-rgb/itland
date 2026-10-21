import { useLocation } from 'react-router-dom';
import { useContext, useEffect } from 'react';
import { MetadataContext } from '../context/PageDataContext';
import { pageMetadata, renderHead } from '../utils/seo';

export { SITE_NAME, SITE_URL } from '../utils/seo';
export default function usePageMeta(options = {}) {
    const collector = useContext(MetadataContext);
    const { pathname } = useLocation();
    const { title, description, image, path, jsonLd, noindex, type } = options;
    const meta = pageMetadata({ ...options, path: path ?? pathname });
    if (collector) collector(meta);
    useEffect(() => {
        const next = pageMetadata({ title, description, image, path: path ?? pathname, jsonLd, noindex, type });
        document.title = next.title;
        // Replace the full route metadata together, so product images and noindex never leak across navigation.
        document.head.querySelectorAll('meta[name="description"], meta[name="robots"], meta[name^="twitter:"], meta[property^="og:"], link[rel="canonical"], script[data-page-meta]').forEach(el => el.remove());
        const template = document.createElement('template');
        template.innerHTML = renderHead(next).replace(/<title>[\s\S]*?<\/title>\n?/, '');
        document.head.append(template.content);
    }, [title, description, image, path, pathname, jsonLd, noindex, type]);
}
