import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { zip_code, makes = [] } = await req.json();

    if (!zip_code) {
      return Response.json({ error: 'zip_code is required' }, { status: 400 });
    }

    const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

    // Step 1: geocode the zip code to lat/lng
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(zip_code)}&key=${apiKey}`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) {
      return Response.json({ error: 'Could not geocode zip code' }, { status: 400 });
    }
    const { lat, lng } = geoData.results[0].geometry.location;

    // Step 2: search for car dealerships nearby
    const keyword = makes.length > 0 ? `${makes[0]} car dealership` : 'car dealership';
    const placesRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=25000&type=car_dealer&keyword=${encodeURIComponent(keyword)}&key=${apiKey}`
    );
    const placesData = await placesRes.json();

    const dealers = (placesData.results || []).slice(0, 10).map(p => ({
      place_id: p.place_id,
      name: p.name,
      address: p.vicinity,
      rating: p.rating,
      user_ratings_total: p.user_ratings_total,
      open_now: p.opening_hours?.open_now ?? null,
      lat: p.geometry?.location?.lat,
      lng: p.geometry?.location?.lng,
      maps_url: `https://www.google.com/maps/place/?q=place_id:${p.place_id}`,
    }));

    return Response.json({ dealers, center: { lat, lng } });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});