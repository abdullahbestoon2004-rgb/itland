import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Camera, ChevronDown, MapPin, MessageCircle, Mic, MonitorPlay, PackageCheck, ShieldCheck, Truck, Users } from 'lucide-react';
import usePageMeta from '../hooks/usePageMeta';
import { usePageData } from '../context/PageDataContext';
import { useLocale } from '../context/LocaleContext';
import { getAllProducts } from '../data/products';
import { absoluteUrl, shortProductTitle, SITE_URL, toProductSlug } from '../utils/seo';
import { isOutOfStock, whatsappLink } from '../utils/storefront';
import { ROOM_SIZES, VC_GROUPS, roomSizePicks, videoConferencingProducts } from '../utils/videoConferencing';
import ProductCard from '../components/ProductCard';
import ProductDetailsModal from '../components/ProductDetailsModal';
import StoreInfo from '../components/StoreInfo';
import './VideoConferencing.css';

export const VIDEO_CONFERENCING_PATH = '/video-conferencing';

// Logitech's own photos of these products in use, served from Logitech's image CDN.
const logitechPhoto = (path, width = 1600) => `https://resource.logitech.com/w_${width},c_limit,q_auto,f_auto,dpr_1.0/content/dam/logitech/en/${path}`;
const HERO_PHOTO = 'video-collaboration/campaign/meetup/2026/meetup-highlight-1.jpg';
const ROOM_PHOTOS = {
  desk: { path: 'products/webcams/mx-brio/buy/mx-brio-background-noise-suppression.jpg', alt: 'A person on a video call at a desk with a Logitech MX Brio webcam on the monitor' },
  small: { path: 'products/video-conferencing/meetup-2/2026/meetup2-conferencecam-ensure-continuity-plan-feature.jpg', alt: 'Colleagues in a small meeting room on a video call with a Logitech MeetUp 2 conference camera under the screen' },
  medium: { path: 'products/video-conferencing/rally-bar/buy/rally-bar-feature-seen-and-heard.png', alt: 'A video meeting on a large display with a Logitech Rally Bar video bar below it' },
  large: { path: 'products/video-conferencing/group-conferencecam/2026/group-speakerphone-with-bluetooth-addition-feature-1.jpg', alt: 'A team around a boardroom table on a video conference using the Logitech GROUP camera and speakerphone' },
};
const PLATFORM_PHOTO = { path: 'video-collaboration/campaign/meetup/2026/meetup-room-solutions.jpg', alt: 'A Logitech MeetUp conference camera under a wall display showing a video meeting, with a Logitech Tap controller on the table' };

const BENEFITS = [
  { icon: <ShieldCheck size={28} aria-hidden="true" />, title: 'Original products', text: 'Genuine Logitech, Jabra and Poly equipment, new in the box.' },
  { icon: <MapPin size={28} aria-hidden="true" />, title: 'A real store in Erbil', text: 'Find us on Muzaffariya Street, six days a week.' },
  { icon: <Truck size={28} aria-hidden="true" />, title: 'Delivery across Iraq', text: 'Erbil, Baghdad, Basra, Sulaymaniyah, Duhok, Mosul, Kirkuk and every other city.' },
  { icon: <MessageCircle size={28} aria-hidden="true" />, title: 'Advice before you buy', text: 'Send us your room size on WhatsApp and we suggest what fits.' },
];

const STEPS = [
  { icon: <Users size={22} aria-hidden="true" />, title: 'Count the seats', text: 'The number of people and the length of the table decide how wide the camera must see and how far the microphones must reach.' },
  { icon: <Camera size={22} aria-hidden="true" />, title: 'Choose the camera', text: 'A wide fixed lens suits a small room. A longer room needs a camera that can zoom in on the far seats.' },
  { icon: <Mic size={22} aria-hidden="true" />, title: 'Cover every voice', text: 'Built-in microphones are enough for a short table. Add expansion microphones or mic pods when people sit further away.' },
  { icon: <MonitorPlay size={22} aria-hidden="true" />, title: 'Connect and meet', text: 'Plug the system into a laptop or room computer by USB and it works as the camera, microphone and speaker in your meeting app.' },
];

// Published specifications of the systems, shown only for the ones in the catalog.
const COMPARISON = [
  { match: /bcc950/, name: 'Logitech BCC950', room: 'Desk or small office', people: '1 to 4', camera: 'Full HD 1080p, 78° view, motorised pan and tilt', audio: 'Built-in speakerphone' },
  { match: /cc2000e|conferencecam connect/, name: 'Logitech Connect', room: 'Small room, portable', people: '1 to 6', camera: 'Full HD 1080p, 90° view', audio: 'Built-in speakerphone and rechargeable battery' },
  { match: /meetup(?!.*(mount|cable|expansion|mic\b))/, name: 'Logitech MeetUp', room: 'Huddle and small rooms', people: '2 to 6', camera: '4K sensor, extra-wide 120° view', audio: 'Three microphones and a speaker built in' },
  { match: /rally bar(?! (mini|huddle))(?!.*mount)/, name: 'Logitech Rally Bar', room: 'Medium rooms', people: '6 to 10', camera: '4K, motorised pan, tilt and zoom', audio: 'Built-in speakers and microphones, expandable with mic pods' },
  { match: /\bgroup\b.*(conferenc|cc3500e)/, name: 'Logitech GROUP', room: 'Medium and large rooms', people: 'Up to 14, or 20 with expansion microphones', camera: 'Full HD 1080p, 10x zoom', audio: 'Full-duplex speakerphone' },
  { match: /rally plus/, name: 'Logitech Rally Plus', room: 'Large rooms and boardrooms', people: '10 and more', camera: '4K PTZ camera with 15x HD zoom', audio: 'Two speakers and two mic pods, expandable' },
];

const FAQS = [
  ['What equipment do I need for video conferencing in a meeting room?', 'A camera, microphones and a speaker that connect to the computer running your meeting. All-in-one systems such as Logitech MeetUp and Rally Bar combine the three in one device. Larger rooms use separate parts, such as the Logitech Rally Plus with its PTZ camera, speakers and table microphones.'],
  ['Which video conferencing system fits my room?', 'Go by the number of seats. One person needs a business webcam and a speakerphone or headset. Up to six people are covered by an all-in-one camera such as MeetUp, Connect or BCC950. Six to ten people need a video bar such as Rally Bar. Bigger rooms need Logitech GROUP or Rally Plus. Send us your room size on WhatsApp and we will suggest a setup.'],
  ['Does it work with Zoom, Microsoft Teams and Google Meet?', 'Yes. The systems on this page connect by USB and work as the camera, microphone and speaker in Zoom, Microsoft Teams, Google Meet and other calling apps on your computer.'],
  ['Do you deliver video conferencing equipment outside Erbil?', 'Yes. IT Land delivers across Iraq and the Kurdistan Region, including Baghdad, Basra, Sulaymaniyah, Duhok, Mosul and Kirkuk. Our team confirms the delivery fee and time for your address on WhatsApp.'],
  ['Can I add microphones for a longer table?', 'Yes. MeetUp takes an expansion microphone, Logitech GROUP takes a pair of expansion microphones, and the Rally systems take additional mic pods. You will find them under speakerphones and microphones on this page.'],
  ['How do I order?', 'Add the products to your cart and send the order on WhatsApp, or message us directly. Our team confirms stock, the final price in Iraqi dinars, the delivery fee and the delivery time before the order is confirmed.'],
];

export default function VideoConferencing() {
  const { t } = useLocale();
  const { handleAddToCart } = useOutletContext();
  const initial = usePageData();
  const [catalog, setCatalog] = useState(initial.products ?? []);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    let ignore = false;
    getAllProducts().then(products => { if (!ignore) setCatalog(products); }).catch(error => console.error(error));
    return () => { ignore = true; };
  }, []);

  const items = useMemo(() => videoConferencingProducts(catalog), [catalog]);
  // Zoho files most of these under a generic category, and the shop's guess from the name
  // is often wrong here (a room "controller" reads as Gaming), so the cards carry this page's label.
  const groups = VC_GROUPS.map(group => ({ ...group, products: items.filter(item => item.group === group.id).map(item => ({ ...item.product, category: 'Video Conferencing' })) })).filter(group => group.products.length > 0);
  const rooms = ROOM_SIZES.map(size => ({ ...size, products: roomSizePicks(catalog, size), photo: ROOM_PHOTOS[size.id] }));
  const comparison = COMPARISON.map(row => ({ ...row, product: items.map(item => item.product).find(product => row.match.test(product.name.toLowerCase())) })).filter(row => row.product);
  const inStockCount = items.filter(item => !isOutOfStock(item.product)).length;
  const quoteLink = (room) => whatsappLink(room
    ? `Hello IT Land! I need video conferencing equipment for: ${room.title} (${room.people}). Please suggest a setup and send me the price.`
    : 'Hello IT Land! I need video conferencing equipment for my meeting room. Please suggest a setup and send me the price.');

  const pageUrl = `${SITE_URL}${VIDEO_CONFERENCING_PATH}`;
  usePageMeta({
    title: t('Video Conferencing Equipment in Erbil, Iraq'),
    description: t('Video conference cameras, speakerphones and complete meeting room systems from Logitech, Jabra and Poly at IT Land, Erbil. Works with Zoom and Teams. Delivery across Iraq.'),
    path: VIDEO_CONFERENCING_PATH,
    image: logitechPhoto(HERO_PHOTO, 1200),
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${pageUrl}#page`, url: pageUrl,
        name: 'Video Conferencing Equipment in Erbil, Iraq',
        description: 'Video conference cameras, speakerphones and complete meeting room systems from Logitech, Jabra and Poly, sold by IT Land in Erbil with delivery across Iraq and Kurdistan.',
        about: ['Video conferencing', 'Meeting room equipment', 'Conference cameras', 'Speakerphones'],
        provider: { '@id': `${SITE_URL}/#store` },
        mainEntity: {
          '@type': 'ItemList', numberOfItems: items.length,
          itemListElement: items.slice(0, 40).map(({ product }, index) => ({ '@type': 'ListItem', position: index + 1, name: product.name, url: absoluteUrl(`/product/${toProductSlug(product)}`), ...(product.images?.[0] ? { image: absoluteUrl(product.images[0]) } : {}) })),
        },
      },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` }, { '@type': 'ListItem', position: 2, name: 'Video Conferencing', item: pageUrl }] },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQS.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) },
    ],
  });

  return <div className="vc-page">
      <section className="vc-hero">
        <img className="vc-hero-photo" src={logitechPhoto(HERO_PHOTO)} alt={t('A team in a meeting room on a video call with remote colleagues, using a Logitech MeetUp conference camera')} fetchPriority="high" />
        <div className="vc-hero-shade" aria-hidden="true" />
        <div className="vc-hero-content">
          <nav className="vc-breadcrumb" aria-label="Breadcrumb"><Link to="/">{t('Home')}</Link><span aria-hidden="true">/</span><span>{t('Video Conferencing')}</span></nav>
          <h1>{t('Video Conferencing Equipment in Erbil, Iraq')}</h1>
          <p className="vc-hero-lead">{t('Conference cameras, speakerphones and complete meeting room systems from Logitech, Jabra and Poly. For a home desk, a huddle room or a full boardroom, with delivery across Iraq and Kurdistan.')}</p>
          <div className="vc-hero-actions">
            <a href={quoteLink()} className="btn btn-primary btn-large" target="_blank" rel="noreferrer"><MessageCircle size={20} aria-hidden="true" />{t('Get a setup for your room')}</a>
            <a href="#vc-products" className="btn btn-secondary btn-large">{t('See all products')}</a>
          </div>
          <ul className="vc-hero-facts">
            {inStockCount > 0 && <li><PackageCheck size={18} aria-hidden="true" /><span><strong>{inStockCount}</strong> {t('products in stock now')}</span></li>}
            <li><MonitorPlay size={18} aria-hidden="true" /><span>{t('Works with Zoom, Microsoft Teams and Google Meet')}</span></li>
            <li><Truck size={18} aria-hidden="true" /><span>{t('Delivery across Iraq and Kurdistan')}</span></li>
          </ul>
        </div>
      </section>

      <section className="vc-section vc-rooms" aria-labelledby="vc-rooms-title">
        <div className="section-container">
          <header className="vc-section-head">
            <h2 id="vc-rooms-title">{t('Find the right setup for your room')}</h2>
            <p>{t('Start with the size of the room. Each setup below is built from products we sell.')}</p>
            <nav className="vc-room-nav" aria-label={t('Room sizes')}>
              {rooms.map(room => <a key={room.id} href={`#vc-room-${room.id}`}><strong>{t(room.title)}</strong><span>{t(room.people)}</span></a>)}
            </nav>
          </header>

          {rooms.map((room, index) => <article key={room.id} id={`vc-room-${room.id}`} className={`vc-room ${index % 2 ? 'vc-room--reverse' : ''}`}>
              <figure className="vc-room-photo">
                <img src={logitechPhoto(room.photo.path, 1400)} alt={t(room.photo.alt)} loading="lazy" decoding="async" />
              </figure>
              <div className="vc-room-body">
                <p className="vc-room-people"><Users size={16} aria-hidden="true" />{t(room.people)}</p>
                <h3>{t(room.title)}</h3>
                <p className="vc-room-text">{t(room.text)}</p>
                {room.products.length > 0 && <>
                    <h4>{t('What we suggest')}</h4>
                    <ul className="vc-room-picks">
                      {room.products.map(product => <li key={product.id}>
                          <Link to={`/product/${toProductSlug(product)}`}>
                            {product.images?.[0] && <img src={product.images[0]} alt="" loading="lazy" decoding="async" />}
                            <span>{shortProductTitle(product.name)}</span>
                            {isOutOfStock(product) && <em>{t('Out of stock')}</em>}
                          </Link>
                        </li>)}
                    </ul>
                  </>}
                <a href={quoteLink(room)} className="btn btn-primary" target="_blank" rel="noreferrer"><MessageCircle size={18} aria-hidden="true" />{t('Ask for this setup on WhatsApp')}</a>
              </div>
            </article>)}
        </div>
      </section>

      <section className="vc-section vc-benefits" aria-labelledby="vc-benefits-title">
        <div className="section-container">
          <h2 id="vc-benefits-title" className="vc-center-title">{t('Why buy video conferencing equipment from IT Land')}</h2>
          <ul className="vc-benefit-grid">
            {BENEFITS.map(({ icon, title, text }) => <li key={title}>{icon}<h3>{t(title)}</h3><p>{t(text)}</p></li>)}
          </ul>
        </div>
      </section>

      <section id="vc-products" className="vc-section vc-products" aria-labelledby="vc-products-title">
        <div className="section-container">
          <header className="vc-section-head">
            <h2 id="vc-products-title">{t('All video conferencing products')}</h2>
            <p>{t('Everything for meetings in one place. Products in stock are listed first.')}</p>
          </header>
          {groups.length === 0 && <p className="vc-empty">{t('Loading products…')}</p>}
          {groups.map(group => <section key={group.id} className="vc-group" aria-labelledby={`vc-group-${group.id}`}>
              <div className="vc-group-head">
                <h3 id={`vc-group-${group.id}`}>{t(group.title)}</h3>
                <p>{t(group.intro)}</p>
              </div>
              <div className="products-grid vc-grid">
                {group.products.map(product => <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} onImageClick={setPreview} />)}
              </div>
            </section>)}
        </div>
      </section>

      <section className="vc-section vc-platforms" aria-labelledby="vc-platforms-title">
        <div className="section-container vc-platforms-grid">
          <figure className="vc-platforms-photo">
            <img src={logitechPhoto(PLATFORM_PHOTO.path, 1400)} alt={t(PLATFORM_PHOTO.alt)} loading="lazy" decoding="async" />
          </figure>
          <div>
            <h2 id="vc-platforms-title">{t('How to choose a video conferencing system')}</h2>
            <ol className="vc-steps">
              {STEPS.map(({ icon, title, text }) => <li key={title}>{icon}<div><h3>{t(title)}</h3><p>{t(text)}</p></div></li>)}
            </ol>
          </div>
        </div>
      </section>

      {comparison.length > 1 && <section className="vc-section vc-compare" aria-labelledby="vc-compare-title">
          <div className="section-container">
            <h2 id="vc-compare-title" className="vc-center-title">{t('Compare meeting room systems')}</h2>
            <div className="vc-table-wrap">
              <table className="vc-table">
                <thead><tr><th scope="col">{t('System')}</th><th scope="col">{t('Best for')}</th><th scope="col">{t('People')}</th><th scope="col">{t('Camera')}</th><th scope="col">{t('Sound')}</th></tr></thead>
                <tbody>
                  {comparison.map(row => <tr key={row.name}>
                      <th scope="row"><Link to={`/product/${toProductSlug(row.product)}`}>{row.name}</Link></th>
                      <td>{t(row.room)}</td><td>{t(row.people)}</td><td>{t(row.camera)}</td><td>{t(row.audio)}</td>
                    </tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </section>}

      <section className="vc-section vc-faq" aria-labelledby="vc-faq-title">
        <div className="section-container vc-faq-inner">
          <h2 id="vc-faq-title" className="vc-center-title">{t('Video conferencing questions')}</h2>
          {FAQS.map(([question, answer]) => <details key={question} className="vc-faq-item">
              <summary><span>{t(question)}</span><ChevronDown size={20} aria-hidden="true" /></summary>
              <p>{t(answer)}</p>
            </details>)}
        </div>
      </section>

      <section className="vc-section vc-cta">
        <div className="section-container vc-cta-inner">
          <h2>{t('Tell us about your meeting room')}</h2>
          <p>{t('Send the room size and the number of seats. We reply with a setup and a price in Iraqi dinars.')}</p>
          <a href={quoteLink()} className="btn vc-wa-btn btn-large" target="_blank" rel="noreferrer"><MessageCircle size={20} aria-hidden="true" />{t('Chat on WhatsApp')}</a>
        </div>
      </section>

      <StoreInfo />

      <ProductDetailsModal key={preview?.id ?? 'no-product'} product={preview} onClose={() => setPreview(null)} onAddToCart={handleAddToCart} />
    </div>;
}
