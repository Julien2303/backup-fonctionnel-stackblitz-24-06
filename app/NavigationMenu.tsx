'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

function NavItem({ title, links }: { title: string, links: { href: string, label: string }[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  return (
    <div className="relative" ref={menuRef}>
      <button 
        className={`px-4 py-2 rounded-md transition-colors duration-200 focus:outline-none font-medium ${isOpen ? 'bg-blue-700' : 'hover:bg-blue-700'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {title}
      </button>
      
      {isOpen && (
        <div className="absolute left-0 mt-1 w-52 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100">
          {links.map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              className="block px-4 py-2 text-blue-900 hover:bg-blue-50 transition-colors duration-150"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NavigationMenu() {
  const [user, setUser] = useState<any>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsUserMenuOpen(false);
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <NavItem title="Visualisation" links={[
            { href: "/visualisation/planning", label: "Planning" },
            { href: "/visualisation/parmedecin", label: "Planning par Médecin" },
            { href: "/visualisation/gardes", label: "Gardes" },
            { href: "/visualisation/conges", label: "Congés" },
          ]} />
          
          <NavItem title="Décompte" links={[
            { href: "/donnees/fermetures", label: "Fermetures" },
            { href: "/donnees/gardes", label: "Gardes" },
            { href: "/donnees/heures", label: "Heures" },
          ]} />
          
          <NavItem title="Modification" links={[
            { href: "/modification/planning", label: "Planning" },
            { href: "/modification/conges", label: "Congés" },
            { href: "/modification/gardes", label: "Gardes" },
            { href: "/modification/maintenances", label: "Maintenances/Cellules Grisées" },
            { href: "/modification/exceptions", label: "Exceptions Horaires" },
          ]} />
          
          <NavItem title="Gestion" links={[
            { href: "/gestion/medecins", label: "Médecins" },
            { href: "/gestion/machines", label: "Machines" },
            { href: "/gestion/utilisateurs", label: "Utilisateurs" },
          ]} />
        </div>

        <div className="relative" ref={userMenuRef}>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-md transition-colors duration-200 hover:bg-blue-700 bg-blue-100/30 backdrop-blur-sm border border-blue-200/50 shadow-sm"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{user ? 'Connecté' : 'Non connecté'}</span>
          </button>

          {isUserMenuOpen && user && (
            <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100">
              <Link
                href="/password"
                className="block px-4 py-2 text-blue-900 hover:bg-blue-50 transition-colors duration-150"
                onClick={() => setIsUserMenuOpen(false)}
              >
                Changer de mot de passe
              </Link>
              <button
                className="block w-full text-left px-4 py-2 text-blue-900 hover:bg-blue-50 transition-colors duration-150"
                onClick={handleLogout}
              >
                Se déconnecter
              </button>
            </div>
          )}
        </div>
    </div>
  );
}