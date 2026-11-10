import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
// In the main stylesheet (all lgl- classes), so the server-rendered page is styled before any script runs.
import './LegalPage.css';

// The legal pages load in their own chunk, so the store bundle does not grow.
const LegalPage = lazy(() => import('./LegalPage'));

// On a first visit the server already sent the finished page. The app replaces the server HTML
// when it starts, so keep showing that HTML until the chunk has loaded instead of a blank screen.
const first = typeof document === 'undefined' ? null : {
    url: window.location.pathname + window.location.search,
    html: document.querySelector('#root > .lgl-page')?.outerHTML ?? '',
};

function Fallback() {
    const { pathname, search } = useLocation();
    if (first?.html && first.url === pathname + search) {
        return <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: first.html }} />;
    }
    return <div style={{ minHeight: '100vh' }} aria-busy="true" />;
}

export default function LazyLegalPage(props) {
    return (
        <Suspense fallback={<Fallback />}>
            <LegalPage {...props} />
        </Suspense>
    );
}
