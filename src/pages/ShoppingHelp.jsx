import { useLocale } from '../context/LocaleContext';
import { Link, useParams } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';
import { whatsappLink } from '../utils/storefront';
import usePageMeta from '../hooks/usePageMeta';
import './ShoppingHelp.css';
const content = {
  delivery: {
    title: 'Delivery & WhatsApp orders',
    intro: 'We deliver across all Iraq and Kurdistan. All orders are arranged and confirmed on WhatsApp.',
    sections: [['1. Choose your products', 'Add available products to your cart, then choose “Send order on WhatsApp”. You can also ask about a single product from its product page.'], ['2. Confirm the details', 'Send your city and area in the chat. Our team will confirm stock, delivery availability, delivery fee, estimated arrival time and payment method for your address.'], ['3. Receive your confirmation', 'Opening WhatsApp or sending a message does not place a confirmed order. Your order is confirmed when our team agrees the items and final total with you in the chat. Keep that conversation for reference.'], ['Prices & payment', 'Product prices are displayed in Iraqi dinars using the IQWealth Baghdad market rate and exclude delivery. Prices are indicative; our team will confirm the final IQD total before you order. Delivery times and fees depend on your address; confirm them on WhatsApp.']]
  },
  warranty: {
    title: 'Warranty support',
    intro: 'Ask our team about the warranty for your exact product before confirming your WhatsApp order.',
    sections: [['Check coverage before ordering', 'Warranty duration, coverage and service arrangements depend on the product. Contact us with the product name or link so we can confirm the applicable terms in writing on WhatsApp.'], ['Get help with a product', 'Share your order conversation or receipt, product model and a description of the issue. Photos or a short video can help our team understand the problem.'], ['Next steps', 'Our team will explain the applicable support options and any delivery arrangements. Confirm these details before sending a product back.']]
  },
  returns: {
    title: 'Returns & exchanges',
    intro: 'Contact IT Land on WhatsApp to confirm the return or exchange terms for your item.',
    sections: [['Before you order', 'Ask about return eligibility, time limits, packaging requirements and any delivery charges before confirming your purchase. These details are confirmed by our team for your item.'], ['Request a return or exchange', 'Send your order conversation or receipt, product name, reason for the request and photos if relevant. Our team will review your request and explain the available options.'], ['Before sending an item back', 'Agree the return destination, shipping arrangements and any refund or replacement details with our team on WhatsApp first.']]
  }
};
export default function ShoppingHelp() {
  const {
    t
  } = useLocale();
  const {
    topic
  } = useParams();
  const page = content[topic];
  usePageMeta({
    title: page?.title ?? 'Shopping help',
    description: page?.intro,
    path: page ? `/help/${topic}` : undefined
  });
  if (!page) return <div className="shopping-help section-container"><h1>{t("Page not found")}</h1><Link to="/help/delivery">{t("Delivery & ordering information")}</Link></div>;
  return <article className="shopping-help section-container">
        <nav className="help-nav" aria-label="Shopping help">
            {Object.entries(content).map(([key, entry]) => <Link key={key} to={`/help/${key}`} aria-current={topic === key ? 'page' : undefined}>{t(entry.title)}</Link>)}
        </nav>
        <p className="help-eyebrow">IT LAND SUPPORT</p>
        <h1>{t(page.title)}</h1>
        <p className="help-intro">{t(page.intro)}</p>
        <div className="help-sections">{page.sections.map(([title, text]) => <section key={t(title)}><h2>{t(title)}</h2><p>{t(text)}</p></section>)}</div>
        <a className="btn btn-primary" href={whatsappLink(`Hello IT Land! I have a question about ${page.title.toLowerCase()}.`)} target="_blank" rel="noreferrer"><MessageCircle size={20} />{t("Ask on WhatsApp")}</a>
        <p className="help-contact">WhatsApp: <bdi>07504888570</bdi></p>
    </article>;
}
