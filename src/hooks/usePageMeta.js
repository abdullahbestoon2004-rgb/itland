import { useEffect } from 'react';

const SITE_NAME = 'IT Land';
const SITE_URL = 'https://itlandforcomputer.com';

const setTag = (selector, attrs) => {
    let el = document.head.querySelector(selector);

    if (!el) {
        el = document.createElement(attrs.tag ?? 'meta');
        Object.entries(attrs).forEach(([key, value]) => {
            if (key !== 'tag' && key !== 'content' && key !== 'href') el.setAttribute(key, value);
        });
        document.head.appendChild(el);
    }

    if (attrs.content != null) el.setAttribute('content', attrs.content);
    if (attrs.href != null) el.setAttribute('href', attrs.href);
};

/**
 * Keeps <title>, description, canonical, Open Graph and an optional JSON-LD
 * block in sync with the current route. The app is a SPA, so this is what
 * crawlers read after they render the page.
 */
export default function usePageMeta({ title, description, image, path, jsonLd } = {}) {
    useEffect(() => {
        const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Computer Accessories, Gaming Gear & Electronics`;
        const url = `${SITE_URL}${path ?? window.location.pathname}`;

        document.title = fullTitle;

        if (description) {
            setTag('meta[name="description"]', { tag: 'meta', name: 'description', content: description });
            setTag('meta[property="og:description"]', { tag: 'meta', property: 'og:description', content: description });
        }

        setTag('link[rel="canonical"]', { tag: 'link', rel: 'canonical', href: url });
        setTag('meta[property="og:title"]', { tag: 'meta', property: 'og:title', content: fullTitle });
        setTag('meta[property="og:url"]', { tag: 'meta', property: 'og:url', content: url });

        if (image) {
            setTag('meta[property="og:image"]', { tag: 'meta', property: 'og:image', content: image });
        }

        if (!jsonLd) return undefined;

        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.dataset.pageMeta = 'true';
        script.textContent = JSON.stringify(jsonLd);
        document.head.appendChild(script);

        return () => script.remove();
    }, [title, description, image, path, jsonLd]);
}

export { SITE_NAME, SITE_URL };
