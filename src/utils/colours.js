import { isOutOfStock } from './storefront.js';

// Colour words found in product names, longest first so "pale grey" wins over
// "grey". The hex is only for the small dot shown on cards and product pages.
const COLOURS = [
    ['off-white', '#f1eee7'], ['off white', '#f1eee7'], ['pale grey', '#d8d8d4'], ['pale gray', '#d8d8d4'],
    ['space grey', '#6e7074'], ['space gray', '#6e7074'], ['graphite', '#3a3c40'], ['charcoal', '#3b3d42'],
    ['carbon', '#2b2d30'], ['black', '#1b1b1b'], ['white', '#ffffff'], ['silver', '#c9ccd1'], ['grey', '#8d9096'],
    ['gray', '#8d9096'], ['rose', '#e8b7c0'], ['pink', '#f3a6c0'], ['magenta', '#d6247f'], ['red', '#c8102e'],
    ['blue', '#2f6bd8'], ['mint', '#9fe3c7'], ['green', '#3d8b5f'], ['lilac', '#c9b6ec'], ['lavender', '#b9a7e6'],
    ['purple', '#7a4fd0'], ['yellow', '#f2d13d'], ['sand', '#d9c7a8'], ['gold', '#cfae5b'],
];
// "Blue" is also a microphone brand (Blue Yeti, Blue Snowball), not a colour there.
const COLOUR_WORD = new RegExp(`\\b(${COLOURS.map(([name]) => name.replace(/[- ]/, '[- ]')).join('|')})\\b(?! (?:yeti|snowball|voice|vo!ce))`, 'gi');
const PART_NUMBER = /\b\d{3}-\d{6}\b/g;
const normalise = (word) => word.toLowerCase().replace(/[- ]/, ' ').replace('gray', 'grey');
const HEX = new Map(COLOURS.map(([name, hex]) => [normalise(name), hex]));

/** The colour a product's name ends on ("… Wireless Mouse - Pale Grey"), or null. */
export function colourOf(name) {
    const words = String(name ?? '').match(COLOUR_WORD);
    if (!words) return null;
    const key = normalise(words.at(-1));
    return { key, label: key.replace(/\b\w/g, (letter) => letter.toUpperCase()), hex: HEX.get(key) };
}

// What is left of a name once the colour and the part number are taken out:
// listings that match on this are the same model in different colours.
const modelKey = (product) => `${(product.brand ?? '').toLowerCase()}|${String(product.name ?? '').toLowerCase()
    .replace(COLOUR_WORD, ' ').replace(PART_NUMBER, ' ').replace(/[^a-z0-9]+/g, ' ').trim()}`;

/**
 * Adds `variants` (the colours a model comes in) to products that are listed
 * once per colour, so a card can show a dot for each. One listing per colour,
 * preferring one that is in stock.
 */
export function withColourVariants(catalog = []) {
    const groups = new Map();
    for (const product of catalog) {
        const colour = colourOf(product.name);
        if (!colour) continue;
        const key = modelKey(product);
        if (key.split('|')[1].length < 12) continue;
        if (!groups.has(key)) groups.set(key, new Map());
        const colours = groups.get(key);
        const current = colours.get(colour.key);
        if (!current || (isOutOfStock(current.product) && !isOutOfStock(product))) colours.set(colour.key, { product, colour });
    }
    const variantsById = new Map();
    for (const colours of groups.values()) {
        if (colours.size < 2 || colours.size > 6) continue;
        const variants = [...colours.values()].map(({ product, colour }) => ({ id: product.id, name: product.name, colour: colour.label, hex: colour.hex }));
        for (const variant of variants) variantsById.set(variant.id, variants);
    }
    return variantsById.size === 0 ? catalog : catalog.map((product) => (variantsById.has(product.id) ? { ...product, variants: variantsById.get(product.id) } : product));
}
