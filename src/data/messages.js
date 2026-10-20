import { isSupabaseConfigured, supabase } from '../lib/supabase';

const CONTACT_TABLE = 'contact_messages';

export const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());

/**
 * Stores a contact request. Throws on failure so the form can tell the visitor
 * the truth instead of showing a success message for a message nobody received.
 */
export const submitContactMessage = async ({ name, email, message }) => {
    const payload = {
        name: String(name ?? '').trim(),
        email: String(email ?? '').trim(),
        message: String(message ?? '').trim(),
    };

    if (!payload.name || !payload.email || !payload.message) {
        throw new Error('Please fill in your name, email, and message.');
    }

    if (!isValidEmail(payload.email)) {
        throw new Error('Please enter a valid email address.');
    }

    if (!isSupabaseConfigured || !supabase) {
        throw new Error('Messaging is unavailable right now. Please reach us on WhatsApp.');
    }

    const { error } = await supabase.from(CONTACT_TABLE).insert([payload]);

    if (error) {
        console.error('Contact message failed:', error);
        throw new Error('We could not send your message. Please try WhatsApp or call us.');
    }
};

export const getContactMessages = async () => {
    if (!isSupabaseConfigured || !supabase) return [];

    const { data, error } = await supabase
        .from(CONTACT_TABLE)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

    if (error) throw error;
    return data ?? [];
};

export const setMessageHandled = async (id, handled) => {
    const { error } = await supabase.from(CONTACT_TABLE).update({ handled }).eq('id', id);
    if (error) throw error;
};
