# Rentique website

Open `index.html` in a browser, or upload this whole folder to any static host (Netlify Drop, Vercel, GitHub Pages, Hostinger).

## Quick edits

- **WhatsApp booking:** in `assets/js/main.js`, set `whatsappNumber: '91XXXXXXXXXX'` at the top. After a trial request, visitors get a "Continue on WhatsApp" button with their details filled in.
- **Booking form backend:** search `TODO(production)` in `assets/js/main.js` to send requests to your CRM, Google Form or email service.
- **Products:** each product card in `index.html` has `data-name`, `data-price`, `data-desc` and `data-img` (an Unsplash photo ID). Replace the `<img>` with your own photo, e.g. `assets/img/my-lehenga.jpg`.
- **Colours and fonts:** the tokens at the top of `assets/css/style.css`.

## Media

Photos are linked from Unsplash and videos from Pexels and Mixkit (all free licences). For production, download the ones you keep into `assets/` and update the links. That makes the site faster and stops it depending on those sites.

## Libraries (bundled in `assets/js/vendor`)

GSAP 3.15 (ScrollTrigger, SplitText, Flip, DrawSVG, CustomEase) and Lenis 1.3. Fonts: Bodoni Moda and Manrope (SIL Open Font Licence).
