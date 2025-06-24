'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth';

// Définir les types manuellement
interface Doctor {
  id: string;
  initials: string;
  color: string | null;
  first_name: string;
  last_name: string | null;
  is_active: boolean;
}

interface Garde {
  id: string;
  date: string;
  jour: string;
  jour_ferie?: boolean;
  noel?: boolean;
  nouvel_an?: boolean;
  medecin_cds_id?: string;
  medecin_st_ex_id?: string;
  medecin_cds: Doctor | null;
  medecin_st_ex: Doctor | null;
}

interface DoctorGardeCount {
  doctorId: string;
  initials: string;
  color: string | null;
  days: { [key: string]: number };
  holidays: number;
  total: number;
}

export default function GardeSummaryPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [gardes, setGardes] = useState<Garde[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [noelDoctor, setNoelDoctor] = useState<string | null>(null);
  const [nouvelAnDoctor, setNouvelAnDoctor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion', 'user']);
  // Fonction pour récupérer les données
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Récupérer les gardes de l'année
        const { data: gardesData, error: gardesError } = await supabase
          .from('gardes')
          .select(`
            *,
            medecin_cds:medecin_cds_id(id, initials, color, first_name, last_name),
            medecin_st_ex:medecin_st_ex_id(id, initials, color, first_name, last_name)
          `)
          .gte('date', `${year}-01-01`)
          .lte('date', `${year}-12-31`)
          .order('date');

        if (gardesError) throw gardesError;

        // Récupérer tous les médecins actifs
        const { data: doctorsData, error: doctorsError } = await supabase
          .from('doctors')
          .select('*')
          .eq('is_active', true);

        if (doctorsError) throw doctorsError;

        setGardes(gardesData || []);
        setDoctors(doctorsData || []);

        // Trouver les médecins pour Noël et Nouvel An
        const noelGarde = gardesData?.find((g) => g.noel);
        const nouvelAnGarde = gardesData?.find((g) => g.nouvel_an);
        setNoelDoctor(
          noelGarde
            ? noelGarde.medecin_cds?.initials || noelGarde.medecin_st_ex?.initials || 'Aucun'
            : 'Aucun'
        );
        setNouvelAnDoctor(
          nouvelAnGarde
            ? nouvelAnGarde.medecin_cds?.initials || nouvelAnGarde.medecin_st_ex?.initials || 'Aucun'
            : 'Aucun'
        );
      } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && !authError) {
      fetchData();
    }
  }, [year, authLoading, authError]);

  // Les retours conditionnels doivent venir APRÈS tous les hooks
  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }
  
  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  // Fonction pour calculer les décomptes des gardes
  const calculateGardeCounts = (type: 'total' | 'CDS' | 'ST EX') => {
    const counts: DoctorGardeCount[] = doctors.map((doctor) => ({
      doctorId: doctor.id,
      initials: doctor.initials || `${doctor.first_name[0]}${doctor.last_name?.[0] || ''}`,
      color: doctor.color,
      days: {
        Lundi: 0,
        Mardi: 0,
        Mercredi: 0,
        Jeudi: 0,
        Vendredi: 0,
        Samedi: 0,
        Dimanche: 0,
      },
      holidays: 0,
      total: 0,
    }));

    gardes.forEach((garde) => {
      // Normaliser le jour pour correspondre aux clés du tableau days
      const day = garde.jour.charAt(0).toUpperCase() + garde.jour.slice(1).toLowerCase();
      const isHoliday = garde.jour_ferie;

      counts.forEach((count) => {
        const isCDSDoctor = garde.medecin_cds_id === count.doctorId;
        const isSTEXDoctor = garde.medecin_st_ex_id === count.doctorId;

        if (type === 'total' && (isCDSDoctor || isSTEXDoctor)) {
          if (isHoliday) {
            count.holidays += 1;
          } else if (day in count.days) {
            count.days[day] += 1;
          }
          count.total += 1;
        } else if (type === 'CDS' && isCDSDoctor) {
          if (isHoliday) {
            count.holidays += 1;
          } else if (day in count.days) {
            count.days[day] += 1;
          }
          count.total += 1;
        } else if (type === 'ST EX' && isSTEXDoctor) {
          if (isHoliday) {
            count.holidays += 1;
          } else if (day in count.days) {
            count.days[day] += 1;
          }
          count.total += 1;
        }
      });
    });

    return counts.filter((count) => count.total > 0); // Ne montrer que les médecins avec des gardes
  };

  // Générer un tableau
  const renderTable = (title: string, type: 'total' | 'CDS' | 'ST EX') => {
    const counts = calculateGardeCounts(type);
    if (counts.length === 0) return null;

    return (
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">{title}</h2>
        <table className="min-w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-4 py-2">Médecin</th>
              <th className="border border-gray-300 px-4 py-2">Lundi</th>
              <th className="border border-gray-300 px-4 py-2">Mardi</th>
              <th className="border border-gray-300 px-4 py-2">Mercredi</th>
              <th className="border border-gray-300 px-4 py-2">Jeudi</th>
              <th className="border border-gray-300 px-4 py-2">Vendredi</th>
              <th className="border border-gray-300 px-4 py-2">Samedi</th>
              <th className="border border-gray-300 px-4 py-2">Dimanche</th>
              <th className="border border-gray-300 px-4 py-2">Férié</th>
              <th className="border border-gray-300 px-4 py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {counts.map((count) => (
              <tr key={count.doctorId} style={{ backgroundColor: count.color || '#FFFFFF' }}>
                <td className="border border-gray-300 px-4 py-2">{count.initials}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{count.days.Lundi}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{count.days.Mardi}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{count.days.Mercredi}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{count.days.Jeudi}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{count.days.Vendredi}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{count.days.Samedi}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{count.days.Dimanche}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{count.holidays}</td>
                <td className="border border-gray-300 px-4 py-2 text-center">{count.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Liste manuelle des années
  const years = [2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Résumé des gardes {year}</h1>

      {/* Sélecteur d'année */}
      <div className="mb-4">
        <label htmlFor="year" className="mr-2">
          Année :
        </label>
        <select
          id="year"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-300 rounded p-2"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p>Chargement des données...</p>
      ) : (
        <>
          {renderTable('Gardes Total', 'total')}
          {renderTable('Gardes CDS', 'CDS')}
          {renderTable('Gardes ST EX', 'ST EX')}

          {/* Informations Noël et Nouvel An */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-2">Jours spéciaux</h2>
            <p>
              <strong>Nouvel An (01/01) :</strong> {nouvelAnDoctor}
            </p>
            <p>
              <strong>Noël (25/12) :</strong> {noelDoctor}
            </p>
          </div>
        </>
      )}
    </div>
  );
}