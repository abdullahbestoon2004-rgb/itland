import { isOutOfStock } from './storefront.js';
import { colourOf } from './colours.js';

// Which catalog products belong on the video conferencing page, and in which
// part of it. Everything is matched on the product's own name, so a new item
// added in Zoho ("Logitech Rally Bar Mini ...") shows up without a code change.
const textOf = (product) => `${product?.name ?? ''} ${product?.description ?? ''}`.toLowerCase();

// Other brands' stands and webcams, studio microphones and unrelated items that
// share a word ("camera", "group") with meeting-room equipment.
const NOT_MEETING_ROOM = /heckler|tripod|rapoo|elgato|yeti|snowball|owl labs|anker|powerconf|panasonic|surface|onten|lention|open box|gaming|headset|headphone|keyboard|mouse\b/;
const ROOM_SYSTEM_WORDS = /meetup|rally|\bgroup\b|\btap\b|video bars?|scribe/;

export const VC_GROUPS = [
    { id: 'rooms', title: 'Meeting room systems', intro: 'Camera, microphones and speaker designed to work together, from a four-seat huddle room to a boardroom.' },
    { id: 'cameras', title: 'Conference cameras and business webcams', intro: 'PTZ cameras for larger rooms and sharp webcams for a desk or a small office.' },
    { id: 'audio', title: 'Speakerphones and microphones', intro: 'Clear sound for calls: USB and Bluetooth speakerphones, plus extra microphones and speakers for longer tables.' },
    { id: 'control', title: 'Room controllers and docks', intro: 'Start a meeting with one touch and keep the desk tidy.' },
    { id: 'accessories', title: 'Mounts, cables and add-ons', intro: 'Wall and TV mounts and extension cables for a clean installation.' },
];

export function videoConferencingGroup(product) {
    const text = textOf(product);
    // Listings named with only a marketplace code have no name to show.
    if (NOT_MEETING_ROOM.test(text) || /^[a-z0-9]{10}$/i.test(String(product?.name ?? '').trim())) return null;
    if (ROOM_SYSTEM_WORDS.test(text) && /mount|cable|coupler|\bkit\b/.test(text)) return 'accessories';
    if (/\btap\b|logi dock/.test(text)) return 'control';
    if (/expansion mic|mic pod|rally speaker/.test(text)) return 'audio';
    if (/\bptz\b|logitech sight|rally camera/.test(text)) return 'cameras';
    if (/meetup|rally (bar|plus|video)|\bgroup\b.*(conferenc|cc3500e)|conferencecam|conference cam|bcc950|cc2000e/.test(text)) return 'rooms';
    if (/speakerphone|speak2|poly sync|p710e|jabra.*(speak|\b[4578]10\b|\b750\b)/.test(text)) return 'audio';
    if (/mx brio|brio (4k|ultra|uhd|500|505)|c930|c925e|c920e|c1000e/.test(text)) return 'cameras';
    return null;
}

// In stock first, then by price (the complete systems before their add-ons).
const byAvailabilityThenPrice = (a, b) => Number(isOutOfStock(a)) - Number(isOutOfStock(b)) || (Number(b.price) || 0) - (Number(a.price) || 0);

// Zoho often holds one model under several barcodes ("Brio 4K Pro", "BRIO ULTRA
// HD PRO BUSINESS", "C1000e ... BRIO 4K"). These name the model each listing is,
// so the page can show it once. First match wins, so the longer names come first.
const MODELS = [
    [/mx brio/, 'mx-brio'], [/brio 505/, 'brio-505'], [/brio 500/, 'brio-500'], [/brio|c1000e/, 'brio-4k'],
    [/\bc9\d0[a-z]?\b/, (match) => match[0]],
    [/meetup 2/, 'meetup-2'], [/meetup.*expansion|expansion mic.*meetup/, 'meetup-mic'], [/meetup/, 'meetup'],
    [/rally bar mini/, 'rally-bar-mini'], [/rally bar huddle/, 'rally-bar-huddle'], [/rally bar/, 'rally-bar'], [/rally plus/, 'rally-plus'],
    [/rally mic pod/, 'rally-mic-pod'], [/rally speaker/, 'rally-speaker'], [/rally (4k )?ptz|rally camera/, 'rally-camera'], [/rally/, 'rally'],
    [/expansion mic/, 'group-mic'], [/\bgroup\b|cc3500e/, 'group'], [/bcc950/, 'bcc950'], [/cc2000e|conferencecam connect/, 'connect'],
    [/ptz pro 2/, 'ptz-pro-2'], [/ptz pro/, 'ptz-pro'], [/logitech sight/, 'sight'],
    [/speak2 ?(\d\d)/, (match) => `speak2-${match[1]}`], [/jabra.*\b([4578]10|750)\b/, (match) => `speak-${match[1]}`],
    [/poly sync ?(\d\d)/, (match) => `poly-sync-${match[1]}`],
    [/logi dock/, 'logi-dock'], [/tap ip/, 'tap-ip'], [/tap scheduler/, 'tap-scheduler'], [/\btap\b/, 'tap'],
];

// Mounts and cables are told apart by length or fitting, not by a model name,
// so those are only matched on their photo.
function modelOf(product, group) {
    if (group === 'accessories') return null;
    const name = String(product?.name ?? '').toLowerCase();
    for (const [pattern, key] of MODELS) {
        const match = name.match(pattern);
        if (match) return `${group}:${typeof key === 'function' ? key(match) : key}`;
    }
    return null;
}

// One card per model: listings that are the same model, or that show the very
// same photo, count as one. The one in stock is kept; if several are, the one
// with the shop's own short name, then the first in the list.
function oneListingPerModel(items) {
    const models = items.map(({ product, group }) => modelOf(product, group));
    const colours = items.map(({ product }) => colourOf(product.name)?.label ?? '');
    // A model sold in two colours keeps a card for each; a listing that names
    // no colour joins the first of them.
    const coloursOf = new Map();
    models.forEach((model, index) => {
        if (!model || !colours[index]) return;
        if (!coloursOf.has(model)) coloursOf.set(model, []);
        if (!coloursOf.get(model).includes(colours[index])) coloursOf.get(model).push(colours[index]);
    });
    const modelKey = (index) => {
        const known = coloursOf.get(models[index]) ?? [];
        return models[index] && `${models[index]}:${known.length > 1 ? colours[index] || known[0] : ''}`;
    };

    const parent = items.map((_, index) => index);
    const find = (index) => (parent[index] === index ? index : (parent[index] = find(parent[index])));
    const firstWithKey = new Map();
    items.forEach(({ product }, index) => {
        // Two different known models never merge, even if they were given the same picture.
        for (const key of [modelKey(index), product.images?.[0] ? `photo:${models[index] ?? ''}:${product.images[0]}` : null]) {
            if (!key) continue;
            if (firstWithKey.has(key)) parent[find(index)] = find(firstWithKey.get(key));
            else firstWithKey.set(key, index);
        }
    });
    const rank = ({ product }) => Number(isOutOfStock(product)) * 2 + Number(!product.tagline);
    const best = new Map();
    items.forEach((item, index) => {
        const root = find(index);
        if (!best.has(root) || rank(item) < rank(items[best.get(root)])) best.set(root, index);
    });
    const kept = new Set(best.values());
    return items.filter((_, index) => kept.has(index));
}

/** Every video conferencing model in the catalog, once each, with its group id. */
export function videoConferencingProducts(catalog = []) {
    return oneListingPerModel(catalog
        .map((product) => ({ product, group: videoConferencingGroup(product) }))
        .filter(({ group }) => group)
        .sort((a, b) => byAvailabilityThenPrice(a.product, b.product)));
}

// What to suggest for each room size. Each pattern is tried in order, so the
// first ones are the best fit; a product is suggested once per name.
export const ROOM_SIZES = [
    {
        id: 'desk', title: 'Desk and home office', people: '1 person',
        text: 'A business webcam with a wide, sharp picture and a speakerphone or headset is all one person needs to look and sound professional on every call.',
        picks: [/mx brio/, /brio (4k|ultra|uhd)/, /c930|c925e|c920e/, /speak2 40|speak 410|poly sync 20|p710e/, /logi dock/],
    },
    {
        id: 'small', title: 'Huddle and small rooms', people: '2 to 6 people',
        text: 'An all-in-one conference camera above or below the TV shows everyone at the table with a wide lens and picks up every voice. One USB cable to the laptop and the meeting starts.',
        picks: [/meetup(?!.*(mount|cable|expansion|mic))/, /rally bar (mini|huddle)/, /cc2000e|conferencecam connect/, /bcc950/, /speak2 (55|75)|speak 7[15]0|poly sync 40/],
    },
    {
        id: 'medium', title: 'Medium meeting rooms', people: '6 to 10 people',
        text: 'A video bar with a motorised zoom lens frames the people who are in the room, and its speakers fill the space. Add a touch controller on the table and extra microphones for a longer table.',
        picks: [/rally bar(?! (mini|huddle))(?!.*mount)/, /\bgroup\b.*(conferenc|cc3500e)/, /meetup expansion mic|expansion microphone/, /\btap\b(?!.*mount)/, /rally mic pod(?!.*(mount|cable|coupler|extension))/],
    },
    {
        id: 'large', title: 'Large rooms and boardrooms', people: '10 to 20 people and more',
        text: 'Separate parts cover a big room: a PTZ camera that zooms to the far end of the table, speakers at the display and microphone pods along the table so every seat is heard.',
        picks: [/rally plus/, /rally video conferencing system/, /\bgroup\b.*(conferenc|cc3500e)/, /rally (4k )?ptz|rally camera(?!.*(mount|kit))/, /ptz pro/, /rally mic pod(?!.*(mount|cable|coupler|extension))|group expansion mic/, /rally speaker|speak 810/],
    },
];

export function roomSizePicks(catalog, size, count = 4) {
    const candidates = catalog.filter((product) => !['accessories', null].includes(videoConferencingGroup(product))).sort(byAvailabilityThenPrice);
    const picked = [];
    const seen = new Set();
    // What the shop can deliver now first; sold-out models only fill the gaps.
    for (const wantInStock of [true, false]) {
        for (const pattern of size.picks) {
            if (picked.length === count) return picked;
            const match = candidates.find((product) => isOutOfStock(product) !== wantInStock && !seen.has(product.name.toLowerCase()) && pattern.test(textOf(product)));
            if (!match) continue;
            seen.add(match.name.toLowerCase());
            picked.push(match);
        }
    }
    return picked;
}
