import { useLocale } from '../context/LocaleContext';
import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { getApprovedReviews, submitReview } from '../data/reviews';
import './CustomerReviews.css';
export default function CustomerReviews() {
  const {
    t
  } = useLocale();
  const [reviews, setReviews] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedback, setFeedback] = useState({
    name: '',
    text: '',
    rating: 5
  });
  const [status, setStatus] = useState({
    state: 'idle',
    message: ''
  });
  useEffect(() => {
    let ignore = false;
    getApprovedReviews().then(data => {
      if (!ignore) setReviews(data);
    });
    return () => {
      ignore = true;
    };
  }, []);
  useEffect(() => {
    if (reviews.length < 2) return undefined;
    const interval = setInterval(() => {
      setCurrentIndex(prevIndex => (prevIndex + 1) % reviews.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [reviews]);
  const handleSubmitFeedback = async event => {
    event.preventDefault();
    setStatus({
      state: 'sending',
      message: ''
    });
    try {
      await submitReview(feedback);
      setFeedback({
        name: '',
        text: '',
        rating: 5
      });
      setStatus({
        state: 'success',
        message: 'Thank you! Your review will appear here once our team reviews it.'
      });
    } catch (error) {
      setStatus({
        state: 'error',
        message: error.message
      });
    }
  };
  return <section className="customer-reviews">
            <div className="section-container">
                <h2 className="section-title reviews-title">{t("What Our Customers Say")}</h2>

                {reviews.length > 0 ? <div className="reviews-slider-container">
                        <div className="reviews-slider-track" style={{
          transform: `translateX(-${currentIndex * 100}%)`
        }}>
                            {reviews.map(review => <div key={review.id} className="review-slide">
                                    <div className="review-card">
                                        <div className="review-stars">
                                            {[...Array(review.rating)].map((_, index) => <Star key={index} size={24} fill="var(--logi-cyan)" color="var(--logi-cyan)" />)}
                                        </div>
                                        <p className="review-text">&ldquo;{review.text}&rdquo;</p>
                                        <h4 className="review-author">- {review.name}</h4>
                                    </div>
                                </div>)}
                        </div>

                        {reviews.length > 1 && <div className="slider-dots">
                                {reviews.map((review, index) => <button type="button" key={review.id} className={`dot ${index === currentIndex ? 'active' : ''}`} onClick={() => setCurrentIndex(index)} aria-label={`Review ${index + 1} of ${reviews.length}`} aria-current={index === currentIndex ? 'true' : undefined} />)}
                            </div>}
                    </div> : <p className="reviews-empty">{t("No reviews yet \u2014 be the first to tell others about your experience.")}

        </p>}

                <div className="feedback-form-container">
                    <h3>{t("Leave Your Feedback")}</h3>
                    <p className="feedback-intro">{t("Share your experience and help others choose the right setup.")}</p>

                    <form onSubmit={handleSubmitFeedback} className="feedback-form">
                        <div className="form-group feedback-row align-center">
                            <input type="text" aria-label={t("Your Name")} placeholder={t("Your Name")} value={feedback.name} onChange={event => setFeedback({
              ...feedback,
              name: event.target.value
            })} required maxLength={80} className="feedback-name-input" />

                            <select value={feedback.rating} onChange={event => setFeedback({
              ...feedback,
              rating: parseInt(event.target.value, 10)
            })} aria-label={t("Review rating")} className="rating-select">

                                <option value="5">{t("5 Stars")}</option>
                                <option value="4">{t("4 Stars")}</option>
                                <option value="3">{t("3 Stars")}</option>
                                <option value="2">{t("2 Stars")}</option>
                                <option value="1">{t("1 Star")}</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <textarea aria-label={t("Write your review here...")} placeholder={t("Write your review here...")} rows="4" value={feedback.text} onChange={event => setFeedback({
              ...feedback,
              text: event.target.value
            })} required maxLength={1000} />

                        </div>

                        {status.message && <p className={`feedback-status ${status.state}`} role={status.state === 'error' ? 'alert' : 'status'}>

                                {status.message}
                            </p>}

                        <button type="submit" className="btn btn-primary feedback-submit-btn" disabled={status.state === 'sending'}>
                            {status.state === 'sending' ? t("Submitting\u2026") : t("Submit Review")}
                        </button>
                    </form>
                </div>
            </div>
        </section>;
}
