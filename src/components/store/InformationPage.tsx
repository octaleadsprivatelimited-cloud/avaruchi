import { Link } from "@/lib/navigation";
import type { ReactNode } from "react";
import { StorePage } from "./StoreHeader";
import { useStorefrontConfig } from "@/lib/storefront-config";
import { openAnalyticsPreferences } from "@/lib/analytics";
import { deliveryAnnouncement, deliveryEstimate } from "@/lib/delivery-policy";
import { BRAND } from "@/lib/brand";

export type InformationPageKind = "privacy" | "terms" | "shipping" | "contact";
type PolicyPage = { eyebrow: string; title: string; sections: ReadonlyArray<readonly [string, ReactNode]> };

export function InformationPage({ kind }: { kind: InformationPageKind }) {
  const store = useStorefrontConfig();
  const businessName = store.legalName || BRAND.legalName;
  const businessAddress = store.businessAddress || BRAND.address;
  const supportLink = <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>;
  const pages = {
    privacy: {
      eyebrow: "Your information",
      title: "Privacy policy",
      sections: [
        ["Who handles your information", <>{businessName} operates Aavaruchi at aavaruchi.in from {businessAddress}. This policy explains how we handle information when you browse, sign in, place an order or contact us. For privacy requests, contact {supportLink}.</>],
        ["Information we collect", "Google sign-in through Firebase provides your name, email address and account identifier. We also collect information you provide, including your phone number, delivery address, order details and support messages. We keep payment references and statuses, account activity and technical logs that can include your IP address and browser information. Do not include sensitive payment credentials in support messages."],
        ["How we use it", "We use information to authenticate your account, manage your basket and orders, arrange delivery, send order and account updates, answer support requests, resolve payment or product issues, prevent misuse and maintain business records. Browsing and shopping activity also helps us show product recommendations and offers."],
        ["Service providers and payments", "Google/Firebase supports authentication. Hostinger hosts the storefront, backend and MySQL database. When enabled, Razorpay receives the information needed to process payments, couriers receive delivery details, and Resend receives the information needed to deliver transactional messages for Aavaruchi and LAKSHMI'S TAPASI TREATS. Payment providers handle full card and bank credentials; the store keeps transaction references and status information. Providers may process data in other countries under their own terms. Information may also be disclosed where legally required."],
        ["Cookies and browser storage", "We use a sign-in cookie and browser storage for sessions, your basket, wishlist, recently viewed products and first-party recommendations or offers. You can clear or restrict cookies and site storage in your browser, but this can sign you out or reset saved preferences and your basket. Clearing browser data does not delete your account or order records."],
        ["Optional analytics and advertising", <>When configured and you opt in, Google Analytics 4 measures visits and shopping events; Microsoft Clarity provides masked recordings and heatmaps of public storefront interactions. Advertising consent separately enables Meta Pixel to measure visits and shopping conversions. These providers can receive device and browser information, IP addresses and cookie identifiers. Our ecommerce event payloads exclude your name, email, phone number, delivery address and payment credentials. Private account, login and admin pages are excluded, and Clarity does not record checkout. You can reject optional tracking or change your choice at any time using <button type="button" className="inline-policy-button" onClick={openAnalyticsPreferences}>Cookie preferences</button>. Withdrawing consent stops future optional collection; it does not erase information already received by providers. See the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google</a>, <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer">Meta</a> and <a href="https://privacy.microsoft.com/privacystatement" target="_blank" rel="noreferrer">Microsoft</a> privacy policies for their practices.</>],
        ["Communications", <>Order, account and support messages relate to your use of the store. If you have requested promotional messages, you can contact {supportLink} to withdraw that request. Withdrawing marketing permission does not stop messages needed to service an existing order.</>],
        ["Retention and account deletion", "We retain information for account services, orders, support, security and applicable record-keeping obligations. You can request account deletion from your account profile after verifying your Google sign-in, or contact us for help. Deletion removes or redacts store account information, while transaction records and some security, audit, provider or backup records may remain where needed. It does not delete your Google account or automatically erase records held by Firebase or other providers."],
        ["Your requests and policy changes", <>Contact {supportLink} to request access, correction or deletion, or to raise a privacy concern. We may verify your identity before handling a request. We will publish policy changes here with an updated date.</>],
      ],
    },
    terms: {
      eyebrow: "Shopping with us",
      title: "Terms and conditions",
      sections: [
        ["The store and your account", <>{businessName} operates Aavaruchi at aavaruchi.in from {businessAddress}. Use your own Google account and provide accurate contact and delivery information. You are responsible for keeping your Google account secure and notifying us about unauthorised activity. Do not misuse the store, submit fraudulent orders or interfere with another customer’s account.</>],
        ["Products and food information", "Check the product description, quantity, pack size, ingredients and allergen information before ordering, and follow the storage and best-before instructions on the packaging. Natural ingredients may vary slightly in appearance between batches; this does not limit your rights if a product is unsafe, defective or materially different from its description."],
        ["Prices and payment", `Prices are displayed in ${store.currency}. Review the item prices, discounts, applicable taxes, delivery charges and final total at checkout before placing an order. Available payment methods are shown at checkout. Online payments are subject to confirmation by the payment provider; cash-on-delivery orders, when offered, remain payable on delivery.`],
        ["Orders and delivery", "Orders are subject to stock availability, delivery coverage and applicable payment checks. Review your address and phone number carefully before confirming. Delivery information and available tracking updates can be checked through your account. Contact us if an order is delayed, missing or shows an incorrect status."],
        ["Cancellation, refunds and exchanges", <>Our food is freshly prepared in small batches. Once an order is confirmed and processed, we do not accept cancellations, change-of-mind refunds or exchanges. Please review your order carefully before confirming. Sale items and gift cards are also non-refundable and non-exchangeable for a change of mind. If we cannot fulfil an order, amounts paid for the unfulfilled part will be refunded. Wrong, damaged or other genuine order issues are reviewed under our <Link to="/shipping-returns">cancellation, refund and exchange policy</Link>; applicable consumer remedies remain available.</>],
        ["Support and consumer rights", <>Contact {supportLink} or use <Link to="/account" search={{ tab: "Support" }}>order support</Link> with your order number and a description of the issue. These terms are subject to applicable Indian law and do not exclude statutory consumer rights or your right to approach the appropriate consumer authority.</>],
        ["Privacy and updates", <>Our <Link to="/privacy">privacy policy</Link> explains how we use your information. Updated shopping terms apply to orders placed after publication; they do not remove rights relating to an existing order.</>],
      ],
    },
    shipping: {
      eyebrow: "Care in every order",
      title: "Shipping, cancellation & refunds",
      sections: [
        ["Shipping policy", "At Aavaruchi, we believe homemade food should reach you with the same freshness, care, and love with which it is prepared. Every order is carefully packed to preserve its authentic taste and quality before it reaches your home."],
        ["Free delivery across India", <>{deliveryAnnouncement(store)} across India. All products are shipped from Hyderabad, Telangana. We generally take around 3 days to dispatch an order. Delivery typically takes {deliveryEstimate(store)}{store.deliveryEstimateBasis !== "ORDER" ? " after dispatch" : ""}. Timelines may vary with courier availability, destination and product freshness. Available services and the final total are shown before you place your order.</>],
        ["Packed with care", "Each package that leaves our kitchen carries not just pickles and podis, but a piece of tradition, warmth, and the comforting flavours of home. We are based in Ramanthapur, Hyderabad – 500013."],
        ["Cancellation, refund & exchange policy", "Every product is freshly prepared in small batches with great care, using authentic homemade methods and quality ingredients. Because these are food products, we do not offer cancellations, change-of-mind refunds or exchanges once an order has been confirmed and processed. Please review the products, pack sizes, quantities and delivery address carefully before confirming your purchase."],
        ["Important notes", "No cancellations are accepted once an order is confirmed. Food items are not eligible for change-of-mind refunds or exchanges. Sale items and gift cards are non-refundable and non-exchangeable for a change of mind. These restrictions do not remove remedies for a genuine product, fulfilment or payment problem, or your statutory consumer rights."],
        ["Wrong items, damaged packages or other issues", <>Customer satisfaction means a lot to us. If you receive the wrong item, a damaged package, or have any other order issue, please contact {supportLink} immediately. Include your order number, a description, and photographs of the product and packaging where available. We carefully review genuine concerns case by case and work with you on an appropriate resolution. Do not consume a product you believe is unsafe.</>],
        ["Payment problems and orders we cannot fulfil", "Cancelling an unpaid online payment does not create a paid, confirmed purchase; the saved order can be retried subject to current stock. Duplicate payments, payments received for failed orders, and amounts paid for orders we cannot fulfil are reviewed and reconciled. Any refund due will be initiated through the original payment method where possible, with available processing details shared with you. Never share your PIN, CVV or OTP."],
        ["Order help and tracking", <>Check <Link to="/track">Track order</Link> or <Link to="/account" search={{ tab: "My orders" }}>your orders</Link> for available shipment updates. For a delayed, missing, incorrect or damaged order, email {supportLink} or use <Link to="/account" search={{ tab: "Support" }}>order support</Link>. Contact us before sending food items back; we will explain any return or collection instructions and the appropriate remedy. Applicable consumer rights remain available.</>],
        ["Thank you for supporting homemade food", "We appreciate your understanding and support for homemade, freshly prepared products made with love and care."],
      ],
    },
    contact: {
      eyebrow: "Customer care",
      title: "We’re here to help.",
      sections: [
        ["Customer care", supportLink],
        ["Business", <>{businessName}<br />{businessAddress}</>],
        ["Order help", <>Use <Link to="/account" search={{ tab: "Support" }}>order support</Link> or email us. Include your order number but never send passwords, OTPs or complete payment credentials.</>],
      ],
    },
  } as const satisfies Record<InformationPageKind, PolicyPage>;
  const page = pages[kind];
  return (
    <StorePage>
      <main id="main" className="information-page">
        <header>
          <p className="eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p>Last updated <time dateTime="2026-10-16">16 October 2026</time> · {businessName}</p>
        </header>
        <nav className="information-nav" aria-label="Store policies">
          <Link to="/privacy" aria-current={kind === "privacy" ? "page" : undefined}>Privacy policy</Link>
          <Link to="/terms" aria-current={kind === "terms" ? "page" : undefined}>Terms and conditions</Link>
          <Link to="/shipping-returns" aria-current={kind === "shipping" ? "page" : undefined}>Shipping, cancellation &amp; refunds</Link>
          <Link to="/contact" aria-current={kind === "contact" ? "page" : undefined}>Contact us</Link>
        </nav>
        <div>
          {page.sections.map(([title, copy]) => (
            <section key={title}><h2>{title}</h2><p>{copy}</p></section>
          ))}
          {(businessAddress || store.businessGstin) && <section>
            <h2>Business details</h2>
            <p>{businessName}<br />{businessAddress}{store.businessGstin && <><br />GSTIN: {store.businessGstin}</>}</p>
          </section>}
        </div>
      </main>
    </StorePage>
  );
}
