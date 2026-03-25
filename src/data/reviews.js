const REVIEWS_KEY = 'logi_store_reviews';

const defaultReviews = [
    {
        id: 1,
        name: "Ahmed K.",
        text: "Incredible quality and fast delivery to Baghdad. The G502 is absolutely genuine!",
        rating: 5
    },
    {
        id: 2,
        name: "Layla M.",
        text: "Setup my entire home office with their gear. The MX Master 3S changed my workflow completely.",
        rating: 5
    },
    {
        id: 3,
        name: "Omar T.",
        text: "Finally a reliable place to get original Logitech gear in Iraq. Highly recommended.",
        rating: 5
    }
];

export const getReviews = () => {
    const data = localStorage.getItem(REVIEWS_KEY);
    if (!data) {
        saveReviews(defaultReviews);
        return defaultReviews;
    }
    try {
        return JSON.parse(data);
    } catch {
        return defaultReviews;
    }
};

export const saveReviews = (reviews) => {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
};

export const addReview = (newReview) => {
    const current = getReviews();
    const reviewWithId = {
        ...newReview,
        id: Date.now()
    };
    const updated = [reviewWithId, ...current];
    saveReviews(updated);
    return updated;
};
