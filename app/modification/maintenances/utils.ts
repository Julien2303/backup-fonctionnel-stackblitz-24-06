/**
 * Fonctions utilitaires pour la gestion des dates et données
 */

 export interface Doctor {
  id: string;
  initials: string;
  type: string;
  first_name?: string;
  last_name?: string;
  color?: string;
}

export interface DoctorAssignment {
  doctorId: string | null;
  share: number;
  teleradiologie?: boolean;
  differe?: boolean;
  plusDiffere?: boolean;
  pct_mutualisation?: number;
  maintenance?: boolean;
  noDoctor?: boolean;
}

/**
 * Obtient le numéro de semaine ISO 8601 d'une date
 * La semaine 1 est la première semaine de l'année contenant un jeudi
 */
export const getWeekNumber = (date: Date): { week: number, year: number } => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided to getWeekNumber');
  }

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  
  // Ajuster au jeudi de la semaine courante
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  
  let year = d.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  const firstMonday = new Date(firstThursday);
  firstMonday.setDate(firstThursday.getDate() - (firstThursday.getDay() || 7) + 1);
  
  // Calculer le numéro de semaine
  let weekNumber = Math.round((d.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  // Gérer les cas où la date appartient à l'année précédente
  if (weekNumber < 1) {
    year -= 1;
    const prevYearFirstThursday = new Date(year, 0, 4);
    const prevYearFirstMonday = new Date(prevYearFirstThursday);
    prevYearFirstMonday.setDate(prevYearFirstThursday.getDate() - (prevYearFirstThursday.getDay() || 7) + 1);
    weekNumber = Math.round((d.getTime() - prevYearFirstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return { week: weekNumber, year };
  }

  // Gérer les cas où la date appartient à l'année suivante
  if (weekNumber > 52) {
    const lastDayOfYear = new Date(year, 11, 31);
    const lastDayThursday = new Date(lastDayOfYear);
    lastDayThursday.setDate(lastDayOfYear.getDate() + 4 - (lastDayOfYear.getDay() || 7));
    if (lastDayThursday.getFullYear() > year) {
      year += 1;
      return { week: 1, year };
    }
  }

  return { week: weekNumber, year };
};

/**
 * Obtient le nombre de semaines ISO dans une année
 */
export const getWeeksInYear = (year: number): number => {
  if (isNaN(year) || year < 1970 || year > 9999) {
    throw new Error('Invalid year provided to getWeeksInYear');
  }

  const lastDay = new Date(year, 11, 31);
  const { week, year: calculatedYear } = getWeekNumber(lastDay);
  
  if (week === 1 && calculatedYear === year + 1) {
    return 52;
  }
  
  const dec28 = new Date(year, 11, 28);
  return getWeekNumber(dec28).week === 53 ? 53 : 52;
};

/**
 * Obtient la date du lundi d'une semaine ISO donnée
 */
export const getDateOfWeek = (week: number, year: number): Date => {
  if (isNaN(week) || isNaN(year) || week < 1 || week > getWeeksInYear(year)) {
    throw new Error(`Invalid week (${week}) or year (${year}) provided to getDateOfWeek`);
  }

  const firstThursday = new Date(year, 0, 4);
  const firstMonday = new Date(firstThursday);
  firstMonday.setDate(firstThursday.getDate() - (firstThursday.getDay() || 7) + 1);
  const date = new Date(firstMonday);
  date.setDate(firstMonday.getDate() + (week - 1) * 7);

  if (isNaN(date.getTime())) {
    throw new Error('Generated date is invalid in getDateOfWeek');
  }

  return date;
};

/**
 * Génère les jours d'une semaine (du lundi au samedi)
 */
export const getWeekDays = (startDate: Date): Date[] => {
  if (!(startDate instanceof Date) || isNaN(startDate.getTime())) {
    throw new Error('Invalid startDate provided to getWeekDays');
  }

  const start = new Date(startDate);
  start.setDate(start.getDate() - (start.getDay() || 7) + 1); // Lundi
  return Array.from({ length: 6 }).map((_, i) => {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    if (isNaN(day.getTime())) {
      throw new Error(`Generated day ${i} is invalid in getWeekDays`);
    }
    return day;
  });
};

/**
 * Obtient le nom du jour de la semaine en français
 */
export const getDayName = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided to getDayName');
  }
  const days = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1; // Dimanche (0) -> 6, Lundi (1) -> 0, etc.
  return days[dayIndex] || '';
};

/**
 * Formate une date en français (jj/mm/aaaa) dans le fuseau horaire local
 */
export const formatFrenchDate = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided to formatFrenchDate');
  }
  return date.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
};

/**
 * Formate une date pour générer une clé de jour (YYYY-MM-DD) dans le fuseau horaire local
 */
export const formatDateKey = (date: Date): string => {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided to formatDateKey');
  }
  const year = date.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric' });
  const month = date.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', month: '2-digit' });
  const day = date.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit' });
  return `${year}-${month}-${day}`;
};

/**
 * Groupe les médecins par type
 */
export const groupDoctorsByType = (doctors: Doctor[]) => {
  return doctors.reduce((acc, doctor) => {
    if (!acc[doctor.type]) {
      acc[doctor.type] = [];
    }
    acc[doctor.type].push(doctor);
    return acc;
  }, {} as Record<string, Doctor[]>);
};

/**
 * Calcule le total des parts dans une assignation
 */
export const calculateTotalShares = (doctors: DoctorAssignment[]): number => {
  return doctors.reduce((sum, d) => sum + d.share, 0);
};