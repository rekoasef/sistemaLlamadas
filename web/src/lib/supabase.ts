import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

/**
 * Este cliente es para "Client Components".
 * Se encarga de gestionar las cookies de sesión automáticamente para que 
 * el Middleware y los Server Components puedan leer el estado del usuario.
 */
export const supabase = createClientComponentClient();