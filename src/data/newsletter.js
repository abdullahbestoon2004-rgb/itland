import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { isValidEmail } from './messages';

const NEWSLETTER_TABLE = 'newsletter_subscribers';
const DUPLICATE_KEY = '23505';

export const subscribeToNewsletter = async (email) => {
    const address = String(email ?? '').trim().toLowerCase();

    if (!isValidEmail(address)) {
        throw new Error('Please enter a valid email address.');
    }

    if (!isSupabaseConfigured || !supabase) {
        throw new Error('Subscriptions are unavailable right now.');
    }

    const { error } = await supabase.from(NEWSLETTER_TABLE).insert([{ email: address }]);

    // Already on the list is a success from the subscriber's point of view.
    if (error && error.code !== DUPLICATE_KEY) {
        console.error('Newsletter signup failed:', error);
        throw new Error('We could not add you to the list. Please try again.');
    }
};

export const getSubscribers = async () => {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
        .from(NEWSLETTER_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

    if (error) throw error;
    return data ?? [];
};
