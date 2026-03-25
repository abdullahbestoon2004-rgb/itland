import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { addReview, getReviews } from '../data/reviews';
import './CustomerReviews.css';

export default function CustomerReviews() {
    const [reviews, setReviews] = useState(() => getReviews());
    const [currentIndex, setCurrentIndex] = useState(0);
    const [feedback, setFeedback] = useState({ name: '', text: '', rating: 5 });

    useEffect(() => {
        if (reviews.length === 0) return undefined;

        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % reviews.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [reviews]);

    const handleSubmitFeedback = (event) => {
        event.preventDefault();
        const updated = addReview(feedback);
        setReviews(updated);
        setFeedback({ name: '', text: '', rating: 5 });
        setCurrentIndex(0);
        alert('Thank you for your feedback!');
    };

    return (
        <section className="customer-reviews">
            <div className="section-container">
                <h2 className="section-title reviews-title">What Our Users Say</h2>

                <div className="reviews-slider-container">
                    <div className="reviews-slider-track" style={{ transform: `translateX(-${currentIndex * 100}%)` }}>
                        {reviews.map((review) => (
                            <div key={review.id || review.name} className="review-slide">
                                <div className="review-card">
                                    <div className="review-stars">
                                        {[...Array(review.rating)].map((_, index) => (
                                            <Star key={index} size={24} fill="var(--logi-cyan)" color="var(--logi-cyan)" />
                                        ))}
                                    </div>
                                    <p className="review-text">"{review.text}"</p>
                                    <h4 className="review-author">- {review.name}</h4>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="slider-dots">
                        {reviews.map((_, index) => (
                            <span
                                key={index}
                                className={`dot ${index === currentIndex ? 'active' : ''}`}
                                onClick={() => setCurrentIndex(index)}
                            />
                        ))}
                    </div>
                </div>

                <div className="feedback-form-container">
                    <h3>Leave Your Feedback</h3>
                    <p className="feedback-intro">Share your experience and help others choose the right setup.</p>

                    <form onSubmit={handleSubmitFeedback} className="feedback-form">
                        <div className="form-group feedback-row align-center">
                            <input
                                type="text"
                                placeholder="Your Name"
                                value={feedback.name}
                                onChange={(event) => setFeedback({ ...feedback, name: event.target.value })}
                                required
                                className="feedback-name-input"
                            />
                            <select
                                value={feedback.rating}
                                onChange={(event) => setFeedback({ ...feedback, rating: parseInt(event.target.value, 10) })}
                                className="rating-select"
                            >
                                <option value="5">5 Stars</option>
                                <option value="4">4 Stars</option>
                                <option value="3">3 Stars</option>
                                <option value="2">2 Stars</option>
                                <option value="1">1 Star</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <textarea
                                placeholder="Write your review here..."
                                rows="4"
                                value={feedback.text}
                                onChange={(event) => setFeedback({ ...feedback, text: event.target.value })}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary feedback-submit-btn">Submit Review</button>
                    </form>
                </div>
            </div>
        </section>
    );
}
