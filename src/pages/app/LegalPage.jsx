import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import usePageMeta from '../../hooks/usePageMeta';
import { LEGAL_CONTACT, LEGAL_DOCS, LEGAL_LANGUAGES, legalHref, legalLanguage, legalText } from './legalDocs';
import './LegalPage.css';

const EMAIL_LINK = <a className="lgl-ltr" dir="ltr" href={`mailto:${LEGAL_CONTACT.email}`}>{LEGAL_CONTACT.email}</a>;

// "{email}" in a string becomes the store's email link.
function withEmail(text) {
    return text.split('{email}').flatMap((part, i) => (i === 0 ? [part] : [<React.Fragment key={i}>{EMAIL_LINK}</React.Fragment>, part]));
}

// "Your account: your name…" shows the part before the colon in bold.
function Labelled({ text }) {
    const colon = text.indexOf(':');
    if (colon < 1 || colon > 40) return text;
    return <><strong>{text.slice(0, colon + 1)}</strong>{text.slice(colon + 1)}</>;
}

export default function LegalPage({ doc }) {
    const [params] = useSearchParams();
    const language = legalLanguage(params.get('lang'));
    const page = LEGAL_DOCS[doc];
    const t = key => legalText(language.code, key);

    usePageMeta({
        title: t(`${page.prefix}.title`),
        description: t(`${page.prefix}.meta`),
        path: legalHref(doc, language.code),
    });

    // These pages sit outside the store layout, so they set the document's language themselves.
    useEffect(() => {
        const root = document.documentElement;
        const previous = { lang: root.lang, dir: root.dir };
        root.lang = language.lang;
        root.dir = language.dir;
        return () => {
            root.lang = previous.lang;
            root.dir = previous.dir;
        };
    }, [language]);

    return (
        <div className="lgl-page" lang={language.lang} dir={language.dir}>
            <header className="lgl-header">
                <div className="lgl-bar">
                    <Link to="/" className="lgl-wordmark" lang="en" aria-label={t('ui.homeLink')}>ITland</Link>
                    <nav className="lgl-langs" aria-label={t('ui.language')}>
                        {LEGAL_LANGUAGES.map(item => (
                            <Link
                                key={item.code}
                                to={legalHref(doc, item.code)}
                                replace
                                className="lgl-lang"
                                lang={item.lang}
                                hrefLang={item.lang}
                                aria-current={item.code === language.code ? 'true' : undefined}
                            >
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                </div>
            </header>

            <main className="lgl-main">
                <article className="lgl-doc">
                    <p className="lgl-eyebrow">{t('ui.eyebrow')}</p>
                    <h1 className="lgl-title">{t(`${page.prefix}.title`)}</h1>
                    <p className="lgl-updated">{t('ui.lastUpdated')}</p>
                    <p className="lgl-intro">{t(`${page.prefix}.intro`)}</p>

                    {page.sections.map((section, index) => (
                        <section key={section.h} className="lgl-section" aria-labelledby={`lgl-s${index}`}>
                            <h2 id={`lgl-s${index}`}>{t(section.h)}</h2>
                            {section.p?.map(key => <p key={key}>{withEmail(t(key))}</p>)}
                            {section.labelled && (
                                <ul className="lgl-list">
                                    {section.labelled.map(key => <li key={key}><Labelled text={t(key)} /></li>)}
                                </ul>
                            )}
                            {section.list && (
                                <ul className="lgl-list">
                                    {section.list.map(key => <li key={key}>{t(key)}</li>)}
                                </ul>
                            )}
                            {section.steps && (
                                <ol className="lgl-steps">
                                    {section.steps.map(key => <li key={key}>{t(key)}</li>)}
                                </ol>
                            )}
                            {section.after?.map(key => <p key={key} className="lgl-note">{t(key)}</p>)}
                            {section.link && (
                                <p>
                                    <Link className="lgl-link" to={legalHref(section.link.doc, language.code)}>{t(section.link.text)}</Link>
                                </p>
                            )}
                        </section>
                    ))}

                    <section className="lgl-contact" aria-labelledby="lgl-contact-title">
                        <h2 id="lgl-contact-title">{t('ui.contactTitle')}</h2>
                        <p>{t('ui.contactText')}</p>
                        <dl className="lgl-contact-list">
                            <div>
                                <dt>{t('ui.whatsapp')}</dt>
                                <dd>
                                    <a className="lgl-ltr" dir="ltr" href={`tel:${LEGAL_CONTACT.tel}`}>{LEGAL_CONTACT.phone}</a>
                                    <a className="lgl-chip" href={LEGAL_CONTACT.whatsapp} target="_blank" rel="noreferrer" lang="en">WhatsApp</a>
                                </dd>
                            </div>
                            <div>
                                <dt>{t('ui.email')}</dt>
                                <dd>{EMAIL_LINK}</dd>
                            </div>
                            <div>
                                <dt>{t('ui.store')}</dt>
                                <dd>{t('ui.storeAddress')}</dd>
                            </div>
                        </dl>
                    </section>
                </article>
            </main>

            <footer className="lgl-footer">
                <nav className="lgl-footer-nav" aria-label={t('ui.otherPages')}>
                    {Object.keys(LEGAL_DOCS).map(key => (
                        <Link key={key} to={legalHref(key, language.code)} aria-current={key === doc ? 'page' : undefined}>
                            {t(`${LEGAL_DOCS[key].prefix}.title`)}
                        </Link>
                    ))}
                </nav>
                <p className="lgl-copy" lang="en" dir="ltr">ITland · itlandforcomputer.com</p>
            </footer>
        </div>
    );
}
