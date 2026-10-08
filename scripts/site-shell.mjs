/** Use the landing page as the single source for shared site chrome. */
export function renderDriverShell(template, landing) {
  function fragment(start, end) {
    const from = landing.indexOf(start);
    const to = landing.indexOf(end, from);
    if (from < 0 || to < 0) throw new Error(`Missing shared site fragment: ${start}`);
    return landing.slice(from, to + end.length);
  }
  function siteLinks(markup) {
    return markup.replace(/href="#([^"]*)"/g, (match, anchor) => {
      if (anchor === 'footer-info') return match;
      return `href="/${anchor ? `#${anchor}` : ''}"`;
    });
  }
  const header = fragment('<div class="trust-bar">', '</header>');
  const footer = fragment('<footer class="reference-footer">', '</footer>');
  const footerDialog = fragment('<dialog id="footer-info"', '</dialog>');
  return template
    .replace('<!-- SITE_HEADER -->', siteLinks(header))
    .replace('<!-- SITE_FOOTER -->', siteLinks(footer))
    .replace('<!-- SITE_FOOTER_DIALOG -->', footerDialog);
}
