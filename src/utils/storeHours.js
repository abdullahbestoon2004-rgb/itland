// The shop is open every day except Friday, from 10:00 until the Maghrib call
// to prayer in Erbil. Maghrib is at sunset, so the closing time moves by about
// a minute a day; it is worked out here for any date, with no outside service.
export const STORE_GEO = { latitude: 36.1899364, longitude: 44.0033506 };
export const STORE_OPENS = '10:00';
export const STORE_OPEN_DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
export const STORE_CLOSED_DAYS = ['Friday'];

const ERBIL_UTC_OFFSET_HOURS = 3; // Iraq keeps the same clock all year.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const radians = (degrees) => degrees * Math.PI / 180;

// A Date whose UTC fields read as Erbil's local date and time.
const erbilClock = (now) => new Date(Number(now) + ERBIL_UTC_OFFSET_HOURS * 3600_000);

/** The weekday in Erbil at that moment: "Saturday", "Friday", ... */
export const erbilWeekday = (now = Date.now()) => DAY_NAMES[erbilClock(now).getUTCDay()];

/**
 * Maghrib (sunset) in Erbil on the day of `now`, as minutes after local midnight.
 * Standard solar position formulas (NOAA), with the sun's upper edge on the
 * horizon and normal refraction; within about a minute of published timetables.
 */
export function maghribMinutes(now = Date.now()) {
    const local = erbilClock(now);
    const dayOfYear = Math.floor((Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - Date.UTC(local.getUTCFullYear(), 0, 0)) / 86_400_000);
    const year = 2 * Math.PI / 365 * (dayOfYear - 1 + 6 / 24); // the sun's position around sunset
    const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(year) - 0.032077 * Math.sin(year) - 0.014615 * Math.cos(2 * year) - 0.040849 * Math.sin(2 * year));
    const declination = 0.006918 - 0.399912 * Math.cos(year) + 0.070257 * Math.sin(year) - 0.006758 * Math.cos(2 * year) + 0.000907 * Math.sin(2 * year) - 0.002697 * Math.cos(3 * year) + 0.00148 * Math.sin(3 * year);
    const latitude = radians(STORE_GEO.latitude);
    const hourAngle = Math.acos(Math.cos(radians(90.833)) / (Math.cos(latitude) * Math.cos(declination)) - Math.tan(latitude) * Math.tan(declination)) * 180 / Math.PI;
    const sunsetUtc = 720 - 4 * (STORE_GEO.longitude - hourAngle) - equationOfTime;
    return Math.round(sunsetUtc + ERBIL_UTC_OFFSET_HOURS * 60);
}

/** A clock time as people read it: "16:58" becomes { time: "4:58", period: "PM" }. */
export function twelveHour(clock) {
    const [hours, minutes] = String(clock).split(':').map(Number);
    return { time: `${hours % 12 || 12}:${String(minutes).padStart(2, '0')}`, period: hours < 12 ? 'AM' : 'PM' };
}

/** Today's closing time in Erbil, "HH:MM" on the 24-hour clock (the form search engines read). */
export function maghribTime(now = Date.now()) {
    const minutes = maghribMinutes(now);
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
