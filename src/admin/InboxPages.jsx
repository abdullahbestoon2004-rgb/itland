import React, { useState } from 'react';
import { Check, Mail, MessageSquare, Star, Trash2 } from 'lucide-react';
import { useInbox } from './context';
import { EmptyState, Notice, Segmented, Spinner } from './ui';

const when = (iso) => (iso ? new Date(iso).toLocaleString() : '');

export function MessagesPage() {
    const { messages, messagesState, unhandled, toggleHandled, loadMessages } = useInbox();
    const [show, setShow] = useState('new');
    const list = show === 'new' ? messages.filter((m) => !m.handled) : messages;
    return (
        <div className="adm-page">
            <div className="adm-page__head">
                <div>
                    <h1 className="adm-h1">Messages</h1>
                    <p className="adm-muted">Contact form messages from the website.</p>
                </div>
                <Segmented label="Messages filter" value={show} onChange={setShow}
                    options={[{ value: 'new', label: 'New', count: unhandled }, { value: 'all', label: 'All', count: messages.length }]} />
            </div>
            {messagesState.status === 'loading' && <div className="adm-loading"><Spinner label="Loading messages…" /></div>}
            {messagesState.error && (
                <Notice tone="error" action={<button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={loadMessages}>Retry</button>}>
                    {messagesState.error}
                </Notice>
            )}
            {messagesState.status === 'ready' && list.length === 0 && (
                <EmptyState icon={Mail} title={messages.length === 0 ? 'No messages yet' : 'All caught up'} />
            )}
            <div className="adm-cards">
                {list.map((m) => (
                    <article key={m.id} className={`adm-card adm-msg ${m.handled ? 'is-done' : ''}`}>
                        <header className="adm-msg__head">
                            <div>
                                <strong>{m.name}</strong>
                                <a className="adm-link" href={`mailto:${m.email}`}>{m.email}</a>
                            </div>
                            <time className="adm-muted adm-small" dateTime={m.created_at}>{when(m.created_at)}</time>
                        </header>
                        <p className="adm-msg__body">{m.message}</p>
                        <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => toggleHandled(m)}>
                            <Check size={14} /> {m.handled ? 'Mark as new' : 'Mark as handled'}
                        </button>
                    </article>
                ))}
            </div>
        </div>
    );
}

export function ReviewsPage() {
    const { reviews, reviewsState, pendingReviews, toggleApproval, removeReview, loadReviews } = useInbox();
    const [show, setShow] = useState('pending');
    const list = show === 'pending' ? reviews.filter((r) => !r.approved) : reviews;
    const handleDelete = (review) => {
        if (window.confirm(`Delete the review from ${review.name}? This cannot be undone.`)) removeReview(review);
    };
    return (
        <div className="adm-page">
            <div className="adm-page__head">
                <div>
                    <h1 className="adm-h1">Reviews</h1>
                    <p className="adm-muted">Website reviews stay hidden until you approve them.</p>
                </div>
                <Segmented label="Reviews filter" value={show} onChange={setShow}
                    options={[{ value: 'pending', label: 'Waiting', count: pendingReviews }, { value: 'all', label: 'All', count: reviews.length }]} />
            </div>
            {reviewsState.status === 'loading' && <div className="adm-loading"><Spinner label="Loading reviews…" /></div>}
            {reviewsState.error && (
                <Notice tone="error" action={<button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={loadReviews}>Retry</button>}>
                    {reviewsState.error}
                </Notice>
            )}
            {reviewsState.status === 'ready' && list.length === 0 && (
                <EmptyState icon={MessageSquare} title={reviews.length === 0 ? 'No reviews submitted yet' : 'Nothing waiting for approval'} />
            )}
            <div className="adm-cards">
                {list.map((r) => (
                    <article key={r.id} className={`adm-card adm-msg ${r.approved ? 'is-done' : ''}`}>
                        <header className="adm-msg__head">
                            <div>
                                <strong>{r.name}</strong>
                                <span className="adm-stars" aria-label={`${r.rating} out of 5`}>
                                    {Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} className={i < r.rating ? 'is-on' : ''} aria-hidden="true" />)}
                                </span>
                            </div>
                            <time className="adm-muted adm-small" dateTime={r.created_at}>{when(r.created_at)}</time>
                        </header>
                        <p className="adm-msg__body">{r.text}</p>
                        <div className="adm-row">
                            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm" onClick={() => toggleApproval(r)}>
                                <Check size={14} /> {r.approved ? 'Unpublish' : 'Approve'}
                            </button>
                            <button type="button" className="adm-btn adm-btn--ghost adm-btn--sm adm-btn--danger-text" onClick={() => handleDelete(r)}>
                                <Trash2 size={14} /> Delete
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}
