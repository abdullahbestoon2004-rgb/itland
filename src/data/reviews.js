import { isSupabaseConfigured, supabase } from '../lib/supabase';

const REVIEWS_TABLE = 'reviews';

/**
 * Only reviews a real customer left and an admin approved are ever shown.
 * There is no seeded/demo content here on purpose.
 */
export const getApprovedReviews = async () => {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
        .from(REVIEWS_TABLE)
        .select('id, name, text, rating, created_at')
        .eq('approved', true)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Review fetch failed:', error);
        return [];
    }

    return data ?? [];
};

export const submitReview = async ({ name, text, rating }) => {
    const payload = {
        name: String(name ?? '').trim(),
        text: String(text ?? '').trim(),
        rating: Number(rating) || 5,
        approved: false,
    };

    if (!payload.name || !payload.text) {
        throw new Error('Please add your name and a short review.');
    }

    if (payload.rating < 1 || payload.rating > 5) {
        throw new Error('Please choose a rating between 1 and 5.');
    }

    if (!isSupabaseConfigured || !supabase) {
        throw new Error('Reviews are unavailable right now.');
    }

    const { error } = await supabase.from(REVIEWS_TABLE).insert([payload]);

    if (error) {
        console.error('Review submission failed:', error);
        throw new Error('We could not save your review. Please try again.');
    }
};

// ── Admin moderation ─────────────────────────────────────────────────────────
export const getAllReviews = async () => {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
        .from(REVIEWS_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) throw error;
    return data ?? [];
};

export const setReviewApproval = async (id, approved) => {
    const { error } = await supabase.from(REVIEWS_TABLE).update({ approved }).eq('id', id);
    if (error) throw error;
};

export const deleteReview = async (id) => {
    const { error } = await supabase.from(REVIEWS_TABLE).delete().eq('id', id);
    if (error) throw error;
};
