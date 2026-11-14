import React from 'react';
import { Link } from 'react-router-dom';
import { useLocale } from '../context/LocaleContext';
import './HomeStories.css';

// Logitech's own photos of products the shop sells, from Logitech's image CDN.
const photo = path => `https://resource.logitech.com/w_1200,c_limit,q_auto,f_auto,dpr_1.0/content/dam/logitech/en/${path}`;
const STORIES = [{
  title: 'Meeting rooms that just work',
  text: 'Conference cameras, speakerphones and complete room systems for every room size.',
  link: 'Explore video conferencing',
  to: '/video-conferencing',
  image: photo('video-collaboration/campaign/meetup/2026/meetup-room-solutions.jpg'),
  alt: 'A Logitech MeetUp conference camera under a wall display showing a video meeting, with a Logitech Tap controller on the table'
}, {
  title: 'Keyboards and mice made to work together',
  text: 'Quiet keys, precise tracking and one receiver for the whole desk.',
  link: 'Shop keyboards',
  to: '/products?category=Keyboards',
  image: photo('homepage/banners/cards/mx-keys-s-graphite-save-10.jpg'),
  alt: 'Hands typing on a Logitech MX Keys S keyboard at a dark desk, with a Logitech mouse beside it'
}, {
  title: 'Headsets for calls and focus',
  text: 'Light, wireless and clear on every call.',
  link: 'Shop headsets',
  to: '/products?category=Headsets',
  image: photo('homepage/banners/cards/girl-listening-zone300-rose-headset.jpg'),
  alt: 'A person at a desk wearing a rose Logitech Zone 300 wireless headset'
}];

// Three picture cards between the product rows: a large photo, a headline and
// a text link, in the order a visitor reads them.
export default function HomeStories() {
  const { t } = useLocale();
  return <section className="home-stories" aria-label={t('Ideas for your desk')}>
      <div className="section-container home-stories-grid">
        {STORIES.map(story => <article key={story.to} className="home-story">
            <Link to={story.to} className="home-story-photo" tabIndex={-1} aria-hidden="true">
              <img src={story.image} alt={t(story.alt)} loading="lazy" decoding="async" />
            </Link>
            <h2>{t(story.title)}</h2>
            <p>{t(story.text)}</p>
            <Link to={story.to} className="view-all-link">{t(story.link)}</Link>
          </article>)}
      </div>
    </section>;
}
