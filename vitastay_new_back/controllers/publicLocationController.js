const { success, error, paginated } = require('../utils/response');
const publicLocations = require('../services/publicLocations');

exports.listCities = async (req, res, next) => {
  try {
    const data = await publicLocations.listCities();
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    return success(res, data);
  } catch (err) {
    next(err);
  }
};

exports.listAreas = async (req, res, next) => {
  try {
    const data = await publicLocations.listAreas(req.params.citySlug);
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=300');
    return success(res, data);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

exports.landing = async (req, res, next) => {
  try {
    const data = await publicLocations.searchLanding(
      req.params.citySlug,
      req.params.areaSlug,
      req.query
    );
    res.set('Cache-Control', data.seo.indexable
      ? 'public, max-age=60, stale-while-revalidate=120'
      : 'public, max-age=30');
    if (!data.seo.indexable) res.set('X-Robots-Tag', 'noindex');
    return paginated(res, {
      city: data.city,
      city_slug: data.city_slug,
      area: data.area,
      area_slug: data.area_slug,
      path: data.path,
      seo: data.seo,
      items: data.items,
    }, data.pagination);
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};
