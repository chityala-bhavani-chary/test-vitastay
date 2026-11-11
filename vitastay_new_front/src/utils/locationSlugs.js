/** BIC-032 — match backend locationSlugs.slugify for /pg/{city}/{area}. */
export const slugify = (value) => String(value || '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-{2,}/g, '-');

export const pgPath = (city, area) => {
  const citySlug = slugify(city);
  if (!citySlug) return '/search';
  const areaSlug = slugify(area);
  return areaSlug ? `/pg/${citySlug}/${areaSlug}` : `/pg/${citySlug}`;
};
