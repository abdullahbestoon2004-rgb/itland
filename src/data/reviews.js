import { isSupabaseConfigured, supabase } from '../lib/supabase';

const REVIEWS_TABLE = 'reviews';

// The storefront no longer shows or collects reviews; what is left here is the
// admin's view of the ones already submitted.
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
