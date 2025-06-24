'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'react-toastify';
import { useAuth } from '@/lib/auth';

interface RecurringException {
  id: string;
  day_of_week: number;
  shift_type: string;
  machine_id: string | null;
  machine_name?: string;
  start_date: string | null;
  end_date: string | null;
  exception_hours: number;
}

interface PunctualException {
  id: string;
  shift_id: string;
  doctor_id: string | null;
  doctor_initials: string | null;
  date: string;
  shift_type: string;
  machine_id: string;
  machine_name: string;
  exception_horaire: number;
}

interface RecurringExceptionResponse {
  id: string;
  day_of_week: number;
  shift_type: string;
  machine_id: string | null;
  machines: { name: string } | null; // Correspond à la colonne `name` de la table `machines`
  start_date: string | null;
  end_date: string | null;
  exception_hours: number;
}

interface Machine {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  initials: string;
}

interface PunctualExceptionResponse {
  id: string;
  shift_id: string;
  doctor_id: string | null;
  doctors: { initials: string } | null; // Relation avec la table doctors
  exception_horaire: number;
  shifts: {
    date: string;
    shift_type: string;
    machine_id: string;
    machines: { name: string } | null; // Sous-relation avec la table machines
  } | null; // Relation avec la table shifts
}

interface ShiftAssignmentResponse {
  doctor_id: string | null;
  doctors: { initials: string } | null; // Relation avec la table doctors
  no_doctor: boolean;
}

export default function ExceptionsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [recurringExceptions, setRecurringExceptions] = useState<RecurringException[]>([]);
  const [punctualExceptions, setPunctualExceptions] = useState<PunctualException[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [newRecurring, setNewRecurring] = useState({
    day_of_week: 1,
    shift_type: 'matin',
    machine_id: '',
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    exception_hours: 4,
  });
  const [newPunctual, setNewPunctual] = useState({
    date: '',
    shift_type: 'matin',
    machine_id: '',
    doctor_id: '',
    exception_horaire: 4,
  });
  const [availableDoctors, setAvailableDoctors] = useState<Doctor[]>([]);
  const [noDoctorMessage, setNoDoctorMessage] = useState('');

  const { loading: authLoading, error: authError, role } = useAuth(['admin', 'gestion']);

  // Fonction pour obtenir le jour de la semaine à partir d'une date
  const getDayOfWeek = (date: string) => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[new Date(date).getDay()];
  };

  // Récupérer les machines
  useEffect(() => {
    const fetchMachines = async () => {
      if (authLoading || authError) return;
      
      const { data, error } = await supabase.from('machines').select('id, name');
      if (error) {
        toast.error('Erreur lors de la récupération des machines');
        console.error('Erreur machines:', error);
        return;
      }
      console.log('Machines récupérées:', data);
      setMachines(data || []);
      if (data && data.length > 0) {
        setNewRecurring((prev) => ({ ...prev, machine_id: data[0].id }));
        setNewPunctual((prev) => ({ ...prev, machine_id: data[0].id }));
      }
    };
    fetchMachines();
  }, [authLoading, authError]);

  // Récupérer les médecins
  useEffect(() => {
    const fetchDoctors = async () => {
      if (authLoading || authError) return;
      
      const { data, error } = await supabase.from('doctors').select('id, initials').eq('is_active', true);
      if (error) {
        toast.error('Erreur lors de la récupération des médecins');
        console.error('Erreur médecins:', error);
        return;
      }
      console.log('Médecins récupérés:', data);
      setDoctors(data || []);
    };
    fetchDoctors();
  }, [authLoading, authError]);

  // Récupérer les exceptions récurrentes pour l'année sélectionnée
useEffect(() => {
  const fetchRecurringExceptions = async () => {
    if (authLoading || authError) return;

    const { data, error } = await supabase
      .from('recurring_hour_exceptions')
      .select(`
        id,
        day_of_week,
        shift_type,
        machine_id,
        machines(name),
        start_date,
        end_date,
        exception_hours
      `)
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`) as { data: RecurringExceptionResponse[] | null; error: any };

    if (error) {
      toast.error('Erreur lors de la récupération des exceptions récurrentes');
      console.error('Erreur exceptions récurrentes:', error);
      return;
    }

    console.log('Exceptions récurrentes récupérées:', data);
    setRecurringExceptions(
      (data || []).map((item: RecurringExceptionResponse) => ({
        id: item.id,
        day_of_week: item.day_of_week,
        shift_type: item.shift_type,
        machine_id: item.machine_id,
        machine_name: item.machines?.name || 'Toutes', // Accès correct à `name`
        start_date: item.start_date,
        end_date: item.end_date,
        exception_hours: item.exception_hours,
      }))
    );
  };
  fetchRecurringExceptions();
}, [year, authLoading, authError]);


 // Récupérer les exceptions ponctuelles pour l'année sélectionnée
useEffect(() => {
  const fetchPunctualExceptions = async () => {
    if (authLoading || authError) return;

    const { data, error } = await supabase
      .from('shift_assignments')
      .select(`
        id,
        shift_id,
        doctor_id,
        doctors(initials),
        exception_horaire,
        shifts(date, shift_type, machine_id, machines(name))
      `)
      .not('exception_horaire', 'is', null)
      .gte('shifts.date', `${year}-01-01`)
      .lte('shifts.date', `${year}-12-31`) as { data: PunctualExceptionResponse[] | null; error: any };

    if (error) {
      toast.error('Erreur lors de la récupération des exceptions ponctuelles');
      console.error('Erreur exceptions ponctuelles:', error);
      return;
    }

    console.log('Exceptions ponctuelles récupérées:', JSON.stringify(data, null, 2));
    setPunctualExceptions(
      (data || []).map((item: PunctualExceptionResponse) => ({
        id: item.id,
        shift_id: item.shift_id,
        doctor_id: item.doctor_id,
        doctor_initials: item.doctors?.initials || null,
        date: item.shifts?.date || '', // Gestion des cas où shifts est null
        shift_type: item.shifts?.shift_type || '',
        machine_id: item.shifts?.machine_id || '',
        machine_name: item.shifts?.machines?.name || '', // Gestion des cas où machines est null
        exception_horaire: item.exception_horaire,
      }))
    );
  };
  fetchPunctualExceptions();
}, [year, authLoading, authError]);

// Récupérer les médecins disponibles pour une vacation spécifique
useEffect(() => {
  const fetchAvailableDoctors = async () => {
    if (authLoading || authError) return;
    if (!newPunctual.date || !newPunctual.shift_type || !newPunctual.machine_id) {
      setAvailableDoctors([]);
      setNoDoctorMessage('');
      return;
    }
    // Récupérer le shift correspondant
    const { data: shiftData, error: shiftError } = await supabase
      .from('shifts')
      .select('id')
      .eq('date', newPunctual.date)
      .eq('shift_type', newPunctual.shift_type)
      .eq('machine_id', newPunctual.machine_id)
      .single();
    if (shiftError || !shiftData) {
      setAvailableDoctors([]);
      setNoDoctorMessage('Aucun shift trouvé pour cette date, vacation et machine');
      console.error('Erreur shift:', shiftError);
      return;
    }
    const { data, error } = await supabase
      .from('shift_assignments')
      .select(`
        doctor_id,
        doctors(initials),
        no_doctor
      `)
      .eq('shift_id', shiftData.id) as { data: ShiftAssignmentResponse[] | null; error: any };
    if (error) {
      toast.error('Erreur lors de la récupération des médecins pour la vacation');
      console.error('Erreur médecins disponibles:', error);
      return;
    }
    console.log('Assignations récupérées:', JSON.stringify(data, null, 2));
    // Vérifier si data est null
    if (!data || data.length === 0 || data.some((item) => item.no_doctor)) {
      setAvailableDoctors([]);
      setNoDoctorMessage('Pas de médecin posté sur cette vacation');
      return;
    }
    const validDoctors = data
      .filter((item: ShiftAssignmentResponse) => item.doctor_id && !item.no_doctor)
      .map((item: ShiftAssignmentResponse) => ({
        id: item.doctor_id!,
        initials: item.doctors?.initials || '',
      }));
    setAvailableDoctors(validDoctors);
    setNoDoctorMessage(validDoctors.length === 0 ? 'Pas de médecin posté sur cette vacation' : '');
    if (validDoctors.length > 0) {
      setNewPunctual((prev) => ({ ...prev, doctor_id: validDoctors[0].id }));
    }
  };
  fetchAvailableDoctors();
}, [newPunctual.date, newPunctual.shift_type, newPunctual.machine_id, authLoading, authError]);


  // Ajouter une exception récurrente
  const addRecurringException = async () => {
    const { data, error } = await supabase
      .from('recurring_hour_exceptions')
      .insert({
        day_of_week: newRecurring.day_of_week,
        shift_type: newRecurring.shift_type,
        machine_id: newRecurring.machine_id || null,
        start_date: newRecurring.start_date,
        end_date: newRecurring.end_date,
        exception_hours: newRecurring.exception_hours,
      })
      .select()
      .single();
    if (error) {
      toast.error('Erreur lors de l’ajout de l’exception récurrente');
      console.error('Erreur ajout exception récurrente:', error);
      return;
    }
    toast.success('Exception récurrente ajoutée');
    setRecurringExceptions([...recurringExceptions, {
      id: data.id,
      ...newRecurring,
      machine_name: machines.find((m) => m.id === newRecurring.machine_id)?.name || 'Toutes',
    }]);
  };

  // Supprimer une exception récurrente
  const deleteRecurringException = async (id: string) => {
    const { error } = await supabase
      .from('recurring_hour_exceptions')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Erreur lors de la suppression de l’exception récurrente');
      console.error('Erreur suppression exception récurrente:', error, { id });
      return;
    }
    toast.success('Exception récurrente supprimée');
    setRecurringExceptions(recurringExceptions.filter((ex) => ex.id !== id));
  };

  // Vérifier les exceptions récurrentes pour une vacation
  const checkRecurringException = async (date: string, shift_type: string, machine_id: string) => {
    const dayOfWeek = new Date(date).getDay() + 1; // Lundi = 1, ..., Dimanche = 7
    const { data, error } = await supabase
      .from('recurring_hour_exceptions')
      .select('exception_hours')
      .eq('day_of_week', dayOfWeek)
      .eq('shift_type', shift_type)
      .or(`machine_id.eq.${machine_id},machine_id.is.null`)
      .lte('start_date', date)
      .gte('end_date', date)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Erreur vérification exception récurrente:', error);
      return null;
    }
    return data?.exception_hours || null;
  };

  // Ajouter une exception ponctuelle
  const addPunctualException = async () => {
    if (!newPunctual.doctor_id && !noDoctorMessage) {
      toast.error('Veuillez sélectionner un médecin ou vérifier la vacation');
      return;
    }
    const { data: shift, error: shiftError } = await supabase
      .from('shifts')
      .select('id')
      .eq('date', newPunctual.date)
      .eq('shift_type', newPunctual.shift_type)
      .eq('machine_id', newPunctual.machine_id)
      .single();
    if (shiftError || !shift) {
      toast.error('Shift introuvable pour cette date, vacation et machine');
      console.error('Erreur shift:', shiftError);
      return;
    }
    // Vérifier s'il y a une exception récurrente
    const recurringHours = await checkRecurringException(
      newPunctual.date,
      newPunctual.shift_type,
      newPunctual.machine_id
    );
    const exceptionHours = newPunctual.exception_horaire || recurringHours;
    if (!exceptionHours) {
      toast.error('Aucune durée d’exception définie (ni ponctuelle, ni récurrente)');
      return;
    }
    const { error } = await supabase
      .from('shift_assignments')
      .update({ exception_horaire: exceptionHours })
      .eq('shift_id', shift.id)
      .eq('doctor_id', newPunctual.doctor_id);
    if (error) {
      toast.error('Erreur lors de l’ajout de l’exception ponctuelle');
      console.error('Erreur ajout exception ponctuelle:', error);
      return;
    }
    toast.success('Exception ponctuelle ajoutée');
    setPunctualExceptions([...punctualExceptions, {
      id: '',
      shift_id: shift.id,
      doctor_id: newPunctual.doctor_id,
      doctor_initials: doctors.find((d) => d.id === newPunctual.doctor_id)?.initials || null,
      date: newPunctual.date,
      shift_type: newPunctual.shift_type,
      machine_id: newPunctual.machine_id,
      machine_name: machines.find((m) => m.id === newPunctual.machine_id)?.name || '',
      exception_horaire: exceptionHours,
    }]);
  };

  // Supprimer une exception ponctuelle
  const deletePunctualException = async (id: string) => {
    const { error } = await supabase
      .from('shift_assignments')
      .update({ exception_horaire: null })
      .eq('id', id);
    if (error) {
      toast.error('Erreur lors de la suppression de l’exception ponctuelle');
      console.error('Erreur suppression exception ponctuelle:', error, { id });
      return;
    }
    toast.success('Exception ponctuelle supprimée');
    setPunctualExceptions(punctualExceptions.filter((ex) => ex.id !== id));
  };

  // Les retours conditionnels doivent venir APRÈS tous les hooks
  if (authLoading) {
    return <div className="p-5">Chargement...</div>;
  }

  if (authError) {
    return <div className="p-5 text-red-500">Erreur: {authError}</div>;
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Gestion des exceptions horaires</h1>

      {/* Sélecteur d'année */}
      <div className="mb-4">
        <label className="mr-2">Année :</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border p-2 rounded"
        >
          {[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Exceptions récurrentes */}
      <h2 className="text-xl font-semibold mb-2">Exceptions horaires récurrentes</h2>
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <select
            value={newRecurring.day_of_week}
            onChange={(e) => setNewRecurring({ ...newRecurring, day_of_week: Number(e.target.value) })}
            className="border p-2 rounded"
          >
            {['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'].map((day, index) => (
              <option key={index} value={index + 1}>{day}</option>
            ))}
          </select>
          <select
            value={newRecurring.shift_type}
            onChange={(e) => setNewRecurring({ ...newRecurring, shift_type: e.target.value })}
            className="border p-2 rounded"
          >
            <option value="matin">Matin</option>
            <option value="apres-midi">Après-midi</option>
            <option value="soir">Soir</option>
          </select>
          <select
            value={newRecurring.machine_id}
            onChange={(e) => setNewRecurring({ ...newRecurring, machine_id: e.target.value })}
            className="border p-2 rounded"
          >
            <option value="">Toutes</option>
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>{machine.name}</option>
            ))}
          </select>
          <input
            type="number"
            value={newRecurring.exception_hours}
            onChange={(e) => setNewRecurring({ ...newRecurring, exception_hours: Number(e.target.value) })}
            placeholder="Heures"
            className="border p-2 rounded w-24"
            min="0"
          />
          <button
            onClick={addRecurringException}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Ajouter
          </button>
        </div>
      </div>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Jour</th>
            <th className="border p-2">Vacation</th>
            <th className="border p-2">Machine</th>
            <th className="border p-2">Début</th>
            <th className="border p-2">Fin</th>
            <th className="border p-2">Heures</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {recurringExceptions.map((ex) => (
            <tr key={ex.id}>
              <td className="border p-2">{['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][ex.day_of_week - 1]}</td>
              <td className="border p-2">{ex.shift_type === 'apres-midi' ? 'Après-midi' : ex.shift_type.charAt(0).toUpperCase() + ex.shift_type.slice(1)}</td>
              <td className="border p-2">{ex.machine_name}</td>
              <td className="border p-2">{ex.start_date || 'N/A'}</td>
              <td className="border p-2">{ex.end_date || 'N/A'}</td>
              <td className="border p-2">{ex.exception_hours}</td>
              <td className="border p-2">
                <button
                  onClick={() => deleteRecurringException(ex.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Exceptions ponctuelles */}
      <h2 className="text-xl font-semibold mt-6 mb-2">Exceptions horaires ponctuelles</h2>
      <div className="mb-4">
        <div className="flex gap-2 mb-2">
          <input
            type="date"
            value={newPunctual.date}
            onChange={(e) => setNewPunctual({ ...newPunctual, date: e.target.value })}
            className="border p-2 rounded"
            min={`${year}-01-01`}
            max={`${year}-12-31`}
          />
          <select
            value={newPunctual.shift_type}
            onChange={(e) => setNewPunctual({ ...newPunctual, shift_type: e.target.value })}
            className="border p-2 rounded"
          >
            <option value="matin">Matin</option>
            <option value="apres-midi">Après-midi</option>
            <option value="soir">Soir</option>
          </select>
          <select
            value={newPunctual.machine_id}
            onChange={(e) => setNewPunctual({ ...newPunctual, machine_id: e.target.value })}
            className="border p-2 rounded"
          >
            {machines.map((machine) => (
              <option key={machine.id} value={machine.id}>{machine.name}</option>
            ))}
          </select>
          <select
            value={newPunctual.doctor_id}
            onChange={(e) => setNewPunctual({ ...newPunctual, doctor_id: e.target.value })}
            className="border p-2 rounded"
            disabled={!!noDoctorMessage}
          >
            <option value="">Sélectionner un médecin</option>
            {availableDoctors.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>{doctor.initials}</option>
            ))}
          </select>
          <input
            type="number"
            value={newPunctual.exception_horaire}
            onChange={(e) => setNewPunctual({ ...newPunctual, exception_horaire: Number(e.target.value) })}
            placeholder="Heures"
            className="border p-2 rounded w-24"
            min="0"
          />
          <button
            onClick={addPunctualException}
            className="bg-blue-500 text-white px-4 py-2 rounded"
            disabled={!!noDoctorMessage}
          >
            Ajouter
          </button>
        </div>
        {noDoctorMessage && <p className="text-red-500">{noDoctorMessage}</p>}
      </div>
      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Date</th>
            <th className="border p-2">Jour</th>
            <th className="border p-2">Vacation</th>
            <th className="border p-2">Machine</th>
            <th className="border p-2">Médecin</th>
            <th className="border p-2">Heures</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {punctualExceptions.map((ex) => (
            <tr key={ex.id}>
              <td className="border p-2">{ex.date}</td>
              <td className="border p-2">{getDayOfWeek(ex.date)}</td>
              <td className="border p-2">{ex.shift_type === 'apres-midi' ? 'Après-midi' : ex.shift_type.charAt(0).toUpperCase() + ex.shift_type.slice(1)}</td>
              <td className="border p-2">{ex.machine_name}</td>
              <td className="border p-2">{ex.doctor_initials || 'Aucun'}</td>
              <td className="border p-2">{ex.exception_horaire}</td>
              <td className="border p-2">
                <button
                  onClick={() => deletePunctualException(ex.id)}
                  className="bg-red-500 text-white px-2 py-1 rounded"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}