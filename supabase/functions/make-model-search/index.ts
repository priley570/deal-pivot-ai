// supabase/functions/make-model-search/index.ts
// Make/Model/Year-based vehicle market search using MarketCheck (no VIN required)
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MARKETCHECK_API_KEY = Deno.env.get('MARKETCHECK_API_KEY') || 'mc_live_1vR64qqHMOpQrk0j7DtJ5udberXX6fFr'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { year, make, model, zip_code, radius = 100, dealer_asking_price } = await req.json()

    if (!make || !model) {
      return Response.json({ error: 'make and model are required' }, { status: 400, headers: corsHeaders })
    }
    if (!zip_code) {
      return Response.json({ error: 'zip_code is required' }, { status: 400, headers: corsHeaders })
    }

    const effectiveRadius = Math.min(radius, 100)

    const params = new URLSearchParams({
      api_key: MARKETCHECK_API_KEY,
      zip: zip_code,
      radius: effectiveRadius.toString(),
      rows: '20',
      start: '0',
      fields: 'id,vin,year,make,model,trim,price,miles,dealer.name,dealer.city,dealer.state,dealer.zip,dom,exterior_color'
    })

    params.append('make', make)
    params.append('model', model)
    if (year) params.append('year', year.toString())

    const mcRes = await fetch(`https://mc-api.marketcheck.com/v2/search/car/active?${params.toString()}`)

    if (!mcRes.ok) {
      const errorText = await mcRes.text()
      console.error('MarketCheck API error:', errorText)
      return Response.json({ error: `MarketCheck API error: ${mcRes.status}` }, { status: mcRes.status, headers: corsHeaders })
    }

    const mcData = await mcRes.json()

    const similar_listings = (mcData.listings || []).map((listing: any) => ({
      id: listing.id || listing.vin,
      vin: listing.vin,
      year: listing.year,
      make: listing.make,
      model: listing.model,
      trim: listing.trim,
      price: listing.price,
      miles: listing.miles,
      exterior_color: listing.exterior_color,
      days_on_market: listing.dom,
      dealer: {
        name: listing.dealer?.name || 'Unknown Dealer',
        city: listing.dealer?.city || '',
        state: listing.dealer?.state || '',
        zip: listing.dealer?.zip || '',
      },
    }))

    const prices = similar_listings
      .filter((l: any) => typeof l.price === 'number')
      .map((l: any) => l.price)

    const stats = {
      avg_price: prices.length > 0 ? Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length) : null,
      min_price: prices.length > 0 ? Math.min(...prices) : null,
      max_price: prices.length > 0 ? Math.max(...prices) : null,
      count: similar_listings.length
    }

    let market_summary = ''
    const yearStr = year ? ` ${year}` : ''
    const vehicleLabel = `${make} ${model}`

    if (similar_listings.length > 0) {
      market_summary = `Found ${similar_listings.length} similar${yearStr} ${vehicleLabel} listings within ${effectiveRadius} miles. `
      if (stats.min_price && stats.max_price && stats.avg_price) {
        market_summary += `Prices range from $${stats.min_price.toLocaleString()} to $${stats.max_price.toLocaleString()} (avg $${stats.avg_price.toLocaleString()}). `
      }
      if (dealer_asking_price && stats.avg_price) {
        const diff = dealer_asking_price - stats.avg_price
        if (diff > 500) {
          market_summary += `Dealer quote of $${dealer_asking_price.toLocaleString()} is $${Math.abs(diff).toLocaleString()} above market.`
        } else if (diff < -500) {
          market_summary += `Dealer quote of $${dealer_asking_price.toLocaleString()} is $${Math.abs(diff).toLocaleString()} below market.`
        } else {
          market_summary += `Dealer quote of $${dealer_asking_price.toLocaleString()} is at market average.`
        }
      }
    } else {
      market_summary = `No listings found for${yearStr} ${vehicleLabel} within ${effectiveRadius} miles. Try a different zip code.`
    }

    return Response.json({ vehicle: { year, make, model }, similar_listings, stats, market_summary }, { headers: corsHeaders })

  } catch (error) {
    console.error('Error in make-model-search:', error)
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders })
  }
})
