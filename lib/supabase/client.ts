// client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase URL or Anon Key');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Fonction pour mettre à jour le mot de passe de l'utilisateur connecté
export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
}

// Interface pour les maintenances
export interface Maintenance {
  id: string;
  shift_id: string;
  date: string;
  slot: string;
  machineId: string;
  maintenance: boolean;
}

// Interface pour les assignations groupées
interface GroupedAssignments {
  [key: string]: any[];
}

// --- Gestion des semaines ---

// Fonction pour récupérer l'état de validation d'une semaine
export async function getWeekValidation(year: number, weekNumber: number) {
  // Vérifier que le numéro de semaine est valide
  if (weekNumber < 1 || weekNumber > 53) {
    console.warn(`Numéro de semaine invalide: ${weekNumber}. Doit être entre 1 et 53.`);
    return false;
  }

  const { data, error } = await supabase
    .from('weeks')
    .select('is_validated')
    .eq('year', year)
    .eq('week_number', weekNumber)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Erreur lors de la récupération de la semaine: ${error.message}`);
  }

  return data ? data.is_validated : false;
}

// Fonction pour créer ou mettre à jour l'état de validation d'une semaine
export async function upsertWeekValidation(year: number, weekNumber: number, isValidated: boolean) {
  // Vérifier que le numéro de semaine est valide
  if (weekNumber < 1 || weekNumber > 53) {
    throw new Error(`Numéro de semaine invalide: ${weekNumber}. Doit être entre 1 et 53.`);
  }

  const { data, error } = await supabase
    .from('weeks')
    .upsert(
      { year, week_number: weekNumber, is_validated: isValidated },
      { onConflict: 'year,week_number' }
    )
    .select();

  if (error) {
    throw new Error(`Erreur lors de la mise à jour de la semaine: ${error.message}`);
  }

  return data;
}

// Fonction pour récupérer ou créer un ID de semaine
export async function getOrCreateWeekId(year: number, weekNumber: number): Promise<string> {
  // Vérifier que le numéro de semaine est valide
  if (weekNumber < 1 || weekNumber > 53) {
    throw new Error(`Numéro de semaine invalide: ${weekNumber}. Doit être entre 1 et 53.`);
  }

  const { data, error } = await supabase
    .from('weeks')
    .select('id')
    .eq('year', year)
    .eq('week_number', weekNumber)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Erreur lors de la récupération de l'ID de la semaine: ${error.message}`);
  }

  if (data) {
    return data.id;
  }

  const { data: newWeek, error: insertError } = await supabase
    .from('weeks')
    .insert({ year, week_number: weekNumber, is_validated: false })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`Erreur lors de la création de la semaine: ${insertError.message}`);
  }

  return newWeek.id;
}

// Fonction pour récupérer toutes les semaines validées d'une année
export async function getValidatedWeeks(year: number) {
  const { data, error } = await supabase
    .from('weeks')
    .select('week_number')
    .eq('year', year)
    .eq('is_validated', true)
    .order('week_number');

  if (error) {
    throw new Error(`Erreur lors de la récupération des semaines validées: ${error.message}`);
  }

  return data.map((week: any) => week.week_number);
}

// --- Gestion des shifts ---

// Fonction pour créer un shift dans la table shifts
export async function createShift(date: string, shiftType: string, machineId: string, weekId: string) {
  const { data, error } = await supabase
    .from('shifts')
    .upsert(
      {
        date,
        shift_type: shiftType.toLowerCase(),
        machine_id: machineId,
        week_id: weekId,
      },
      { onConflict: 'date,shift_type,machine_id' }
    )
    .select('id')
    .single();

  if (error) {
    throw new Error(`Erreur lors de la création du shift: ${error.message}`);
  }

  return data.id;
}

// Fonction pour récupérer toutes les semaines d'une semaine donnée
export async function getShiftsForWeek(year: number, weekNumber: number) {
  // Vérifier que le numéro de semaine est valide
  if (weekNumber < 1 || weekNumber > 53) {
    throw new Error(`Numéro de semaine invalide: ${weekNumber}. Doit être entre 1 et 53.`);
  }

  const weekId = await getOrCreateWeekId(year, weekNumber);
  const { data, error } = await supabase
    .from('shifts')
    .select('id, date, shift_type, machine_id, week_id')
    .eq('week_id', weekId);

  if (error) {
    throw new Error(`Erreur lors de la récupération des shifts: ${error.message}`);
  }

  return data;
}

// --- Gestion des assignations ---

export async function upsertDoctorAssignment(
  shiftId: string,
  doctorId: string | null,
  parts: number,
  teleradiologie: boolean,
  en_differe: boolean,
  lecture_differee: boolean,
  maintenance: boolean,
  noDoctor: boolean
) {
  // Récupérer les assignations existantes pour ce shift
  const { data: existingAssignments, error: fetchError } = await supabase
    .from('shift_assignments')
    .select('id, doctor_id, parts, maintenance, no_doctor, teleradiologie, en_differe, lecture_differee')
    .eq('shift_id', shiftId);

  if (fetchError) {
    throw new Error(`Erreur lors de la récupération des assignations existantes: ${fetchError.message}`);
  }

  console.log('Existing assignments for upsert:', existingAssignments);

  // Vérifier les doublons pour la combinaison shift_id, doctor_id, maintenance, no_doctor
  const matchingAssignments = existingAssignments?.filter(
    (a: any) =>
      (a.doctor_id === doctorId || (doctorId === null && a.doctor_id === null)) &&
      a.maintenance === maintenance &&
      a.no_doctor === noDoctor
  ) || [];

  if (matchingAssignments.length > 0) {
    // Supprimer toutes les assignations correspondantes sauf une
    const keepAssignment = matchingAssignments.reduce((max: any, a: any) => (a.parts > max.parts ? a : max), matchingAssignments[0]);
    const assignmentsToDelete = matchingAssignments.filter((a: any) => a.id !== keepAssignment.id);

    if (assignmentsToDelete.length > 0) {
      console.warn('Doublons détectés, suppression:', assignmentsToDelete);
      const { error: deleteError } = await supabase
        .from('shift_assignments')
        .delete()
        .in('id', assignmentsToDelete.map((a: any) => a.id));

      if (deleteError) {
        throw new Error(`Erreur lors de la suppression des doublons: ${deleteError.message}`);
      }
    }

    // Mettre à jour l'assignation existante
    const { error: updateError } = await supabase
      .from('shift_assignments')
      .update({
        parts,
        teleradiologie,
        en_differe,
        lecture_differee,
        maintenance,
        no_doctor: noDoctor,
        pct_mutualisation: 0,
        mutualise: (existingAssignments?.length || 0) > 1,
      })
      .eq('id', keepAssignment.id);

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour de l'assignation: ${updateError.message}`);
    }

    console.log('Assignation mise à jour:', { shiftId, doctorId, parts, maintenance, noDoctor });
  } else {
    // Créer une nouvelle assignation
    const { error: insertError } = await supabase
      .from('shift_assignments')
      .insert({
        shift_id: shiftId,
        doctor_id: doctorId,
        parts,
        teleradiologie,
        en_differe,
        lecture_differee,
        maintenance,
        no_doctor: noDoctor,
        pct_mutualisation: 0,
        mutualise: (existingAssignments?.length || 0) > 0,
      });

    if (insertError) {
      throw new Error(`Erreur lors de la création de l'assignation: ${insertError.message}`);
    }

    console.log('Nouvelle assignation créée:', { shiftId, doctorId, parts, maintenance, noDoctor });
  }

  // Récupérer les assignations mises à jour pour recalculer les pourcentages
  const { data: updatedAssignments, error: fetchUpdatedError } = await supabase
    .from('shift_assignments')
    .select('id, doctor_id, parts, maintenance, no_doctor, teleradiologie, en_differe, lecture_differee')
    .eq('shift_id', shiftId);

  if (fetchUpdatedError) {
    throw new Error(`Erreur lors de la récupération des assignations mises à jour: ${fetchUpdatedError.message}`);
  }

  // Recalculer les pourcentages
  const totalParts = updatedAssignments?.reduce((sum: number, a: any) => sum + a.parts, 0) || 0;
  const updates = updatedAssignments?.map((a: any) => ({
    id: a.id,
    shift_id: shiftId,
    doctor_id: a.doctor_id,
    parts: a.parts,
    pct_mutualisation: totalParts > 0 ? (a.parts / totalParts) * 100 : 0,
    mutualise: (updatedAssignments?.length || 0) > 1,
    teleradiologie: a.teleradiologie,
    en_differe: a.en_differe,
    lecture_differee: a.lecture_differee,
    maintenance: a.maintenance,
    no_doctor: a.no_doctor,
  })) || [];

  const { error: finalUpdateError } = await supabase
    .from('shift_assignments')
    .upsert(updates, { onConflict: 'id' });

  if (finalUpdateError) {
    throw new Error(`Erreur lors de la mise à jour des pourcentages: ${finalUpdateError.message}`);
  }

  console.log('Assignations finales mises à jour:', updates);
}

// Fonction pour supprimer une assignation
export async function deleteDoctorAssignment(shiftId: string, doctorId: string | null, maintenance: boolean, noDoctor: boolean) {
  console.log('deleteDoctorAssignment called with:', { shiftId, doctorId, maintenance, noDoctor });

  // Supprimer l'assignation spécifiée
  let query = supabase
    .from('shift_assignments')
    .delete()
    .eq('shift_id', shiftId)
    .eq('maintenance', maintenance)
    .eq('no_doctor', noDoctor);

  if (doctorId === null) {
    query = query.is('doctor_id', null);
  } else {
    query = query.eq('doctor_id', doctorId);
  }

  const { error: deleteError } = await query;

  if (deleteError) {
    throw new Error(`Erreur lors de la suppression de l'assignation: ${deleteError.message}`);
  }

  console.log('Assignation supprimée:', { shiftId, doctorId, maintenance, noDoctor });

  // Récupérer les assignations restantes
  const { data: remainingAssignments, error: fetchError } = await supabase
    .from('shift_assignments')
    .select('id, doctor_id, parts, maintenance, no_doctor, teleradiologie, en_differe, lecture_differee')
    .eq('shift_id', shiftId);

  if (fetchError) {
    throw new Error(`Erreur lors de la récupération des assignations restantes: ${fetchError.message}`);
  }

  console.log('Remaining assignments after deletion:', remainingAssignments);

  // Vérifier les doublons pour Maintenance ou No Doctor
  const groupedAssignments: GroupedAssignments = (remainingAssignments || []).reduce((acc: GroupedAssignments, a: any) => {
    const key = `${a.shift_id}_${a.doctor_id ?? 'null'}_${a.maintenance}_${a.no_doctor}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const cleanedAssignments: any[] = [];
  for (const key in groupedAssignments) {
    const group = groupedAssignments[key];
    if (group.length > 1) {
      // Garder la ligne avec le plus de parts
      const keepAssignment = group.reduce((max: any, a: any) => (a.parts > max.parts ? a : max), group[0]);
      const assignmentsToDelete = group.filter((a: any) => a.id !== keepAssignment.id);
      console.warn('Doublons détectés, suppression:', assignmentsToDelete);
      const { error: deleteDuplicatesError } = await supabase
        .from('shift_assignments')
        .delete()
        .in('id', assignmentsToDelete.map((a: any) => a.id));

      if (deleteDuplicatesError) {
        throw new Error(`Erreur lors de la suppression des doublons: ${deleteDuplicatesError.message}`);
      }
      cleanedAssignments.push(keepAssignment);
    } else {
      cleanedAssignments.push(group[0]);
    }
  }

  // Recalculer les pourcentages pour les assignations restantes
  const totalParts = cleanedAssignments.reduce((sum: number, a: any) => sum + a.parts, 0);
  const updates = cleanedAssignments.map((a: any) => ({
    id: a.id,
    shift_id: shiftId,
    doctor_id: a.doctor_id,
    parts: a.parts,
    pct_mutualisation: totalParts > 0 ? (a.parts / totalParts) * 100 : 0,
    mutualise: cleanedAssignments.length > 1,
    teleradiologie: a.teleradiologie,
    en_differe: a.en_differe,
    lecture_differee: a.lecture_differee,
    maintenance: a.maintenance,
    no_doctor: a.no_doctor,
  }));

  console.log('Updating assignments with:', updates);

  if (updates.length > 0) {
    const { error: updateError } = await supabase
      .from('shift_assignments')
      .upsert(updates, { onConflict: 'id' });

    if (updateError) {
      throw new Error(`Erreur lors de la mise à jour des pourcentages: ${updateError.message}`);
    }
  }

  console.log('Assignations mises à jour après suppression:', updates);
}

// Fonction pour récupérer les assignations d'une semaine
export async function getAssignmentsForWeek(year: number, weekNumber: number) {
  // Vérifier que le numéro de semaine est valide
  if (weekNumber < 1 || weekNumber > 53) {
    console.warn(`Numéro de semaine invalide: ${weekNumber}. Doit être entre 1 et 53.`);
    return [];
  }

  const weekId = await getOrCreateWeekId(year, weekNumber);
  console.log('Fetching assignments for week:', { year, weekNumber, weekId });

  // Calculer le lundi de la semaine ISO
  const firstThursday = new Date(year, 0, 4);
  const dayOfWeek = firstThursday.getDay();
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const firstMonday = new Date(firstThursday);
  firstMonday.setDate(firstThursday.getDate() - offset);
  const startDate = new Date(firstMonday);
  startDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 6);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  console.log(`Fetching assignments for date range: ${startDateStr} to ${endDateStr}`);

  const { data, error } = await supabase
    .from('shift_assignments')
    .select(`
      id,
      doctor_id,
      parts,
      pct_mutualisation,
      teleradiologie,
      en_differe,
      lecture_differee,
      maintenance,
      no_doctor,
      shifts (
        id,
        date,
        shift_type,
        machine_id,
        week_id
      )
    `)
    .eq('shifts.week_id', weekId)
    .gte('shifts.date', startDateStr)
    .lte('shifts.date', endDateStr);

  if (error) {
    console.error('Error fetching assignments:', error);
    throw new Error(`Erreur lors de la récupération des assignations: ${error.message}`);
  }

  console.log('Raw assignments data from Supabase:', data);

  if (!data || data.length === 0) {
    console.warn(`No assignments found for week ${weekNumber}, year ${year}`);
    return [];
  }

  const formattedData = data.reduce((acc: any[], assignment: any) => {
    const shift = assignment.shifts;
    if (!shift) {
      console.warn('Assignment without associated shift:', assignment);
      return acc;
    }

    let slot: string;
    switch (shift.shift_type.toLowerCase()) {
      case 'matin':
        slot = 'Matin';
        break;
      case 'apres-midi':
        slot = 'Après-midi';
        break;
      case 'soir':
        slot = 'Soir';
        break;
      default:
        slot = shift.shift_type;
    }

    console.log('Processing assignment:', {
      shiftId: shift.id,
      date: shift.date,
      shiftType: shift.shift_type,
      formattedSlot: slot,
      doctorId: assignment.doctor_id,
      maintenance: assignment.maintenance,
      noDoctor: assignment.no_doctor,
    });

    let existingEntry = acc.find(
      (entry) => entry.id === shift.id && entry.day === shift.date && entry.slot === slot && entry.machineId === shift.machine_id
    );

    if (!existingEntry) {
      existingEntry = {
        id: shift.id,
        day: shift.date,  
        slot,
        machineId: shift.machine_id,
        doctors: [],
      };
      acc.push(existingEntry);
    }

    existingEntry.doctors.push({
      doctorId: assignment.doctor_id,
      share: assignment.parts,
      teleradiologie: assignment.teleradiologie,
      differe: assignment.en_differe,
      plusDiffere: assignment.lecture_differee,
      pct_mutualisation: assignment.pct_mutualisation,
      maintenance: assignment.maintenance,
      noDoctor: assignment.no_doctor,
    });

    return acc;
  }, []);

  console.log('Formatted assignments:', formattedData);
  return formattedData;
}

// Fonction pour récupérer les assignations des shifts du soir pour une année
export async function getEveningAssignmentsForYear(year: number) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  console.log(`Fetching evening assignments for year ${year} from ${startDate} to ${endDate}`);

  const { data, error } = await supabase
    .from('shift_assignments')
    .select(`
      shift_id,
      doctor_id,
      en_differe,
      maintenance,
      no_doctor,
      shifts (
        id,
        date,
        shift_type
      )
    `)
    .eq('shifts.shift_type', 'soir')
    .gte('shifts.date', startDate)
    .lte('shifts.date', endDate);

  if (error) {
    console.error('Error fetching evening assignments:', error);
    throw new Error(`Erreur lors de la récupération des assignations du soir: ${error.message}`);
  }

  console.log('Raw assignments data for year:', data);

  if (!data || data.length === 0) {
    console.warn(`No evening assignments found for year ${year}`);
    return [];
  }

  const formattedData = data.map((assignment: any) => {
    console.log('Processing assignment:', {
      shiftId: assignment.shift_id,
      doctorId: assignment.doctor_id,
      en_differe: assignment.en_differe,
      date: assignment.shifts?.date,
      maintenance: assignment.maintenance,
      noDoctor: assignment.no_doctor,
    });

    return {
      shiftId: assignment.shift_id,
      doctorId: assignment.doctor_id,
      differe: assignment.en_differe,
      date: assignment.shifts?.date,
      slot: 'Soir',
      maintenance: assignment.maintenance,
      noDoctor: assignment.no_doctor,
    };
  });

  console.log('Formatted evening assignments:', formattedData);
  return formattedData;
}

// Fonction pour récupérer les maintenances d'une année
export async function getMaintenancesForYear(year: number): Promise<Maintenance[]> {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data, error } = await supabase
    .from('shift_assignments')
    .select(`
      id,
      shift_id,
      maintenance,
      shifts (
        id,
        date,
        shift_type,
        machine_id
      )
    `)
    .eq('maintenance', true)
    .gte('shifts.date', startDate)
    .lte('shifts.date', endDate);

  if (error) {
    throw new Error(`Erreur lors de la récupération des maintenances: ${error.message}`);
  }

  const validMaintenances = (data || [])
    .filter((assignment: any) => {
      if (!assignment.shifts || !assignment.shifts.date || !assignment.shifts.shift_type || !assignment.shifts.machine_id) {
        console.warn('Enregistrement de maintenance invalide détecté:', assignment);
        return false;
      }
      return true;
    })
    .map((assignment: any) => ({
      id: assignment.id,
      shift_id: assignment.shift_id,
      date: assignment.shifts.date,
      slot: assignment.shifts.shift_type === 'apres-midi' ? 'Après-midi' : assignment.shifts.shift_type.charAt(0).toUpperCase() + assignment.shifts.shift_type.slice(1),
      machineId: assignment.shifts.machine_id,
      maintenance: true,
    }));

  if ((data || []).length !== validMaintenances.length) {
    console.warn(
      `Certains enregistrements de maintenance ont été ignorés en raison de données manquantes. Total récupéré: ${(data || []).length}, Total valide: ${validMaintenances.length}`
    );
  }

  return validMaintenances;
}

// --- Gestion des semaines types ---

// Créer ou mettre à jour une assignation de semaine type
export async function upsertTypicalWeekAssignment(
  year: number,
  weekType: 'even' | 'odd',
  day: string,
  slot: string,
  machineId: string
) {
  try {
    const normalizedSlot = slot.toLowerCase().replace('après-midi', 'apres-midi');
    const { data, error } = await supabase
      .from('typical_week_assignments')
      .upsert(
        {
          year,
          week_type: weekType,
          day,
          slot: normalizedSlot,
          machine_id: machineId,
          no_doctor: true,
        },
        {
          onConflict: 'year,week_type,day,slot,machine_id',
        }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error: any) {
    throw new Error(`Erreur lors de la création/mise à jour de l'assignation de semaine type: ${error.message}`);
  }
}

// Supprimer une assignation de semaine type
export async function deleteTypicalWeekAssignment(
  year: number,
  weekType: 'even' | 'odd',
  day: string,
  slot: string,
  machineId: string
) {
  try {
    const normalizedSlot = slot.toLowerCase().replace('après-midi', 'apres-midi');
    const { error } = await supabase
      .from('typical_week_assignments')
      .delete()
      .eq('year', year)
      .eq('week_type', weekType)
      .eq('day', day)
      .eq('slot', normalizedSlot)
      .eq('machine_id', machineId);

    if (error) throw error;
  } catch (error: any) {
    throw new Error(`Erreur lors de la suppression de l'assignation de semaine type: ${error.message}`);
  }
}

// Charger les assignations pour une semaine type
export async function getTypicalWeekAssignments(year: number, weekType: 'even' | 'odd') {
  try {
    const { data, error } = await supabase
      .from('typical_week_assignments')
      .select('*')
      .eq('year', year)
      .eq('week_type', weekType);

    if (error) throw error;
    return (data || []).map((assignment: any) => ({
      ...assignment,
      slot: assignment.slot === 'apres-midi' ? 'Après-midi' : assignment.slot.charAt(0).toUpperCase() + assignment.slot.slice(1),
    }));
  } catch (error: any) {
    throw new Error(`Erreur lors du chargement des assignations de semaine type: ${error.message}`);
  }
}

// Supprimer toutes les assignations pour une semaine type
export async function deleteAllTypicalWeekAssignments(year: number, weekType: 'even' | 'odd') {
  try {
    const { error } = await supabase
      .from('typical_week_assignments')
      .delete()
      .eq('year', year)
      .eq('week_type', weekType);

    if (error) throw error;
  } catch (error: any) {
    throw new Error(`Erreur lors de la suppression des assignations de semaine type: ${error.message}`);
  }
}

// --- Gestion des gardes ---

// Fonction pour récupérer toutes les gardes d'une année
export async function getGardesForYear(year: number) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const { data, error } = await supabase
    .from('gardes')
    .select(`
      *,
      medecin_cds:medecin_cds_id(id, initials, color, first_name, last_name),
      medecin_st_ex:medecin_st_ex_id(id, initials, color, first_name, last_name)
    `)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');

  if (error) {
    throw new Error(`Erreur lors de la récupération des gardes: ${error.message}`);
  }

  return data || [];
}

// Fonction pour créer ou mettre à jour une garde
export async function upsertGarde(garde: {
  date: string;
  jour: string;
  jour_ferie?: boolean;
  medecin_cds_id?: string;
  medecin_st_ex_id?: string;
  noel?: boolean;  
  nouvel_an?: boolean;
}) {
  const { data, error } = await supabase
    .from('gardes')
    .upsert(garde, { onConflict: 'date' })
    .select(`
      *,
      medecin_cds:medecin_cds_id(id, initials, color),
      medecin_st_ex:medecin_st_ex_id(id, initials, color)
    `)
    .single();

  if (error) {
    throw new Error(`Erreur lors de la mise à jour de la garde: ${error.message}`);
  }

  return data;
}
// Fonction pour supprimer l'affectation d'un médecin
export async function removeGardeAssignment(date: string, clinic: 'CDS' | 'ST EX') {
  const field = clinic === 'CDS' ? 'medecin_cds_id' : 'medecin_st_ex_id';

  const { data: existingGarde, error: fetchError } = await supabase
    .from('gardes')
    .select('medecin_cds_id, medecin_st_ex_id, jour_ferie, noel, nouvel_an')
    .eq('date', date)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw new Error(`Erreur lors de la récupération de la garde: ${fetchError.message}`);
  }

  if (!existingGarde) {
    return null;
  }

  const updateData = { [field]: null };

  const { data: updatedGarde, error: updateError } = await supabase
    .from('gardes')
    .update(updateData)
    .eq('date', date)
    .select(`
      *,
      data:medecin_cds_id(id, initials, color),
      medecin_st_ex:medecin_st_ex_id(id, initials, color)
    `)
    .single();

  if (updateError) {
    throw new Error(`Erreur lors de la suppression de l'affectation: ${updateError.message}`);
  }

  if (
    !updatedGarde.medecin_cds_id &&
    !updatedGarde.medecin_st_ex_id &&
    !updatedGarde.jour_ferie &&
    !updatedGarde.noel &&
    !updatedGarde.nouvel_an
  ) {
    const { error: deleteError } = await supabase
      .from('gardes')
      .delete()
      .eq('date', date);

    if (deleteError) {
      throw new Error(`Erreur lors de la suppression de la garde vide: ${deleteError.message}`);
    }
    return null;
  }

  return updatedGarde;
}

// --- Gestion des congés ---

// Fonction pour récupérer les congés d'une semaine donnée
export async function getCongesForWeek(year: number, weekNumber: number) {
  // Vérifier que le numéro de semaine est valide
  if (weekNumber < 1 || weekNumber > 53) {
    console.warn(`Numéro de semaine invalide: ${weekNumber}. Doit être entre 1 et 53.`);
    return {};
  }

  // Types pour clarifier la structure des données
  interface CongeData {
    date: string;
    doctor_id: string;
    doctors: { initials: string } | { initials: string }[] | null;
  }

  const startDate = new Date(year, 0, 1);
  startDate.setDate(startDate.getDate() + (weekNumber - 1) * 7 - startDate.getDay() + 1);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 5);

  const { data, error } = await supabase
    .from('conges')
    .select(`
      date,
      doctor_id,
      doctors (
        initials
      )
    `)
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])
    .eq('is_conge', true)
    .order('date');

  if (error) {
    throw new Error(`Erreur lors de la récupération des congés: ${error.message}`);
  }

  const congesByDate = (data as CongeData[]).reduce((acc, conge) => {
    const date = conge.date;
    if (!acc[date]) {
      acc[date] = [];
    }
    
    // Extraction des initiales selon le format retourné
    let doctorInitials: string | undefined;
    
    if (Array.isArray(conge.doctors)) {
      doctorInitials = conge.doctors[0]?.initials;
    } else if (conge.doctors && typeof conge.doctors === 'object') {
      doctorInitials = conge.doctors.initials;
    }
    
    if (doctorInitials) {
      acc[date].push(doctorInitials);
    }
    return acc;
  }, {} as Record<string, string[]>);

  return congesByDate;
}