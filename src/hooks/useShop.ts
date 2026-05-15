import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { keys } from '@/lib/query-keys'
import type { DbBarberShop } from '@/types/supabase'
import type { FormatPriceOptions } from '@/lib/time'

const SHOP_FALLBACK: DbBarberShop = {
  id: '',
  name: 'Turnoalcorte',
  currency: 'ARS',
  locale: 'es-AR',
  timezone: 'America/Argentina/Buenos_Aires',
  created_at: '',
}

export function useShop() {
  const { data } = useQuery({
    queryKey: keys.shop.config,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('barber_shops')
        .select('*')
        .limit(1)
        .single()
      if (error) return SHOP_FALLBACK
      return data
    },
    staleTime: 1000 * 60 * 10, // 10 min — shop config changes rarely
  })

  const shop = data ?? SHOP_FALLBACK

  const priceOptions: FormatPriceOptions = {
    currency: shop.currency,
    locale: shop.locale,
  }

  return { shop, priceOptions }
}
