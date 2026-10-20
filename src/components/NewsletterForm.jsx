import { useLocale } from '../context/LocaleContext';
import { useState } from 'react';
import { Send } from 'lucide-react';
import { subscribeToNewsletter } from '../data/newsletter';
export default function NewsletterForm({
  className = 'newsletter-form'
}) {
  const {
    t
  } = useLocale();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({
    state: 'idle',
    message: ''
  });
  const handleSubscribe = async event => {
    event.preventDefault();
    if (status.state === 'sending') return;
    setStatus({
      state: 'sending',
      message: ''
    });
    try {
      await subscribeToNewsletter(email);
      setStatus({
        state: 'success',
        message: "You're subscribed. Thank you!"
      });
      setEmail('');
    } catch (error) {
      setStatus({
        state: 'error',
        message: error.message
      });
    }
  };
  return <div className="newsletter-signup">
        <form onSubmit={handleSubscribe} className={className}>
            <input type="email" name="email" autoComplete="email" aria-label={t("Email address")} placeholder={t("Enter your email")} value={email} maxLength={200} onChange={event => setEmail(event.target.value)} required disabled={status.state === 'sending'} />
            <button type="submit" className="btn btn-primary" aria-label={t("Subscribe")} disabled={status.state === 'sending'}>
                <Send size={18} />
            </button>
        </form>
        {status.message && <p className={`newsletter-status ${status.state}`} role={status.state === 'error' ? 'alert' : 'status'}>{t(status.message)}</p>}
    </div>;
}
