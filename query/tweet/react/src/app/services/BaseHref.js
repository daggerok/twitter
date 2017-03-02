const baseElem = document.querySelector('base');
const hrefAttr = baseElem.getAttribute('href');

export const baseHref = !hrefAttr || hrefAttr.length === 0 ? '/' : hrefAttr;
