// lib/auth.ts
import { supabase } from './supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

interface AuthResult {
  loading: boolean;
  error: string | null;
  role: string | null;
}

export function useAuth(allowedRoles: string[]) {
  const router = useRouter();
  const [authResult, setAuthResult] = useState<AuthResult>({
    loading: true,
    error: null,
    role: null,
  });
  const checkingRef = useRef(false); // Pour éviter les vérifications concurrentes

  useEffect(() => {
    async function checkAuth() {
      // Éviter les vérifications multiples
      if (checkingRef.current) return;
      checkingRef.current = true;

      try {
        // Vérifier la session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          console.log('Aucune session, redirection vers /login');
          router.push('/login');
          return;
        }

        // Vérifier le profil
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        if (profileError || !profile) {
          console.error('Erreur profil:', profileError);
          router.push('/unauthorized');
          return;
        }

        // Vérifier si le rôle est autorisé
        if (!allowedRoles.includes(profile.role)) {
          console.log('Rôle non autorisé:', profile.role);
          router.push('/unauthorized');
          return;
        }

        // Mettre à jour l'état seulement si nécessaire
        setAuthResult(prev => {
          if (prev.loading || prev.role !== profile.role || prev.error !== null) {
            return { loading: false, error: null, role: profile.role };
          }
          return prev;
        });
      } catch (err) {
        console.error('Erreur dans useAuth:', err);
        router.push('/unauthorized');
      } finally {
        checkingRef.current = false;
      }
    }

    checkAuth();
  }, [router, allowedRoles.join()]); // Utiliser joined array comme dépendance

  return authResult;
}