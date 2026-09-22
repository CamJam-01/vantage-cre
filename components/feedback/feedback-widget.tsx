import Script from 'next/script';

/** Loader for the hosted feedback widget (README §5). It configures itself from
 * `document.currentScript.dataset`, so the site key and position have to ride on
 * the script element itself rather than a call after load — and if the dataset
 * is missing the loader returns silently, with no badge and no error. */
export function FeedbackWidget() {
  return (
    <Script
      src="https://cams-command-center.vercel.app/widget/v1/loader.js"
      strategy="afterInteractive"
      data-site-key="site_2494d06ba898a622c5f57bf1b36f68e778a638e8a1034bb0"
      data-position="bottom-right"
    />
  );
}
