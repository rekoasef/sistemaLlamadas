import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const supabase = createClientComponentClient({
  options: {
    realtime: {
      params: {
        eventsPerSecond: 20, // Aumentamos la frecuencia
      },
    },
    db: {
      schema: 'public',
    },
  },
});