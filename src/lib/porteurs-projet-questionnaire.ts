// Structure du questionnaire "J'ai un projet" : partagée entre la fiche
// candidature (/admin/porteurs-projet/[id]) et l'export CSV.

export type Field = { key: string; label: string; options?: Record<string, string> };
export type Section = { key: string; title: string; fields: Field[] };

const STATUT: Record<string, string> = { association: 'Association', entreprise_individuelle: 'Entreprise individuelle', societe: 'Société' };
const TYPE_PORTEURS: Record<string, string> = { benevoles: 'Projet porté uniquement par des bénévoles', mixte: 'Projet mixte' };
const STADE: Record<string, string> = { reflexion: 'Projet en réflexion', statuts_deposes: 'Statuts déposés', existant: 'Projet existant qui cherche un nouveau local' };
const TYPOLOGIE: Record<string, string> = { cuisines: 'Cuisines', hebergement: 'Hébergement', salles_restauration: 'Salles de restauration', salles_activites: "Salles d'activités" };
const SURFACE: Record<string, string> = { '10-20': '10–20 m²', '20-30': '20–30 m²', '30-50': '30–50 m²', 'plus-50': 'Plus de 50 m²' };
const FREQUENCE: Record<string, string> = { quotidienne: 'Quotidienne', plusieurs_jours: 'Plusieurs jours / semaine', occasionnelle: 'Occasionnelle', saisonniere: 'Saisonnière' };
const HORAIRES: Record<string, string> = { journee: 'Journée (9h-18h)', soiree: 'Soirée', weekend: 'Week-end', variables: 'Variables' };
const BUDGET: Record<string, string> = { '100-200': '100–200 €', '200-300': '200–300 €', '300-500': '300–500 €', 'plus-500': 'Plus de 500 €', difficile: 'Difficile à estimer à ce stade', occasionnelle: 'Concerné·e seulement par une mise à disposition occasionnelle' };
const CONTRIBUTION: Record<string, string> = { temps: 'En temps (chantiers, animation, gouvernance)', competences: 'En compétences (selon besoins ponctuels)', contribution_financiere: 'En revalorisant ma contribution financière en fonction de mes excédents', pas_possible: 'Pas possible de contribuer en plus de mon activité' };
const MUTUALISATION: Record<string, string> = { cuisine_partagee: 'Cuisine partagée', salle_reunion: 'Salle de réunion', terrasse_cour: 'Terrasse / cour intérieure', stockage: 'Stockage commun', materiel: 'Matériel (imprimante, outils, équipements…)', communication: 'Outils de communication', gestion: 'Outils de gestion', aucun: 'Aucun' };
const COOPERATION: Record<string, string> = { projets_communs: 'Construction des projets communs', partage_competences: 'Partage de compétences', accueil_public: 'Accueil du public régulier (permanence partagée)', evenements: "Organisation d'événements", ateliers: "Organisation d'ateliers, initiations…", aucun: 'Aucun' };
const INTEGRATION: Record<string, string> = { des_ouverture: "Oui, dès l'ouverture", annee_suivante: "Oui, dans l'année suivante (2027)", phase_perenne: 'Non, seulement dans la phase pérenne' };
const DUREE: Record<string, string> = { quelques_mois: 'Quelques mois', '1_an': '1 an', '2_ans': '2 ans', '3_ans_plus': '3 ans et plus' };
const FREINS: Record<string, string> = { budget: 'Budget insuffisant', distance: 'Distance géographique', espaces: 'Inadéquation des espaces disponibles', gouvernance: 'Réticence à la gouvernance collective', timing: 'Timing', manque_info: "Manque d'information sur le projet", aucun: 'Aucun frein identifié' };

export const STADE_LABELS = STADE;

export const sections: Section[] = [
  {
    key: 'vous_et_votre_projet', title: 'Vous et votre projet', fields: [
      { key: 'autres_membres', label: 'Autres membres impliqué·es' },
      { key: 'porteurs_bio', label: 'Les porteur·se·s de projet' },
      { key: 'description', label: 'Description du projet' },
      { key: 'statut', label: 'Statut', options: STATUT },
      { key: 'statut_precision', label: 'Précision sur le statut' },
      { key: 'nb_emplois', label: "Nombre d'emplois créés souhaités" },
      { key: 'type_porteurs', label: 'Type de portage', options: TYPE_PORTEURS },
      { key: 'stade_avancement', label: "Stade d'avancement", options: STADE },
      { key: 'partenaires', label: 'Partenaires potentiels' },
      { key: 'aides', label: "Aides accordées ou dossiers en cours d'instruction" },
    ],
  },
  {
    key: 'besoins_espaces', title: 'Besoins en espaces de travail et conditions économiques', fields: [
      { key: 'typologie', label: "Typologie d'espaces recherchés", options: TYPOLOGIE },
      { key: 'typologie_autre', label: 'Autres typologies' },
      { key: 'besoins_techniques', label: 'Besoins techniques particuliers' },
      { key: 'surface', label: 'Surface nécessaire à minima', options: SURFACE },
      { key: 'surface_precisions', label: 'Précisions complémentaires' },
      { key: 'frequence', label: "Fréquence d'occupation", options: FREQUENCE },
      { key: 'horaires', label: "Horaires principaux d'utilisation", options: HORAIRES },
      { key: 'budget', label: 'Budget mensuel maximum envisageable', options: BUDGET },
    ],
  },
  {
    key: 'mutualisation', title: 'Mutualisation et contribution à la vie du lieu', fields: [
      { key: 'contribution', label: 'Contribution à la vie du lieu', options: CONTRIBUTION },
      { key: 'contribution_autre', label: 'Autre contribution' },
      { key: 'mutualisation_types', label: 'Types de mutualisation utiles', options: MUTUALISATION },
      { key: 'mutualisation_autre', label: 'Autre mutualisation' },
      { key: 'cooperation', label: 'Types de coopération envisagés', options: COOPERATION },
      { key: 'cooperation_autre', label: 'Autre coopération' },
    ],
  },
  {
    key: 'projection', title: 'Projection dans le projet', fields: [
      { key: 'integration_phase', label: "Intégration dès la phase d'expérimentation (automne 2026)", options: INTEGRATION },
      { key: 'duree', label: 'Durée de projection', options: DUREE },
      { key: 'freins', label: "Freins à l'intégration du lieu", options: FREINS },
      { key: 'freins_autre', label: 'Autre frein' },
    ],
  },
  {
    key: 'envies', title: 'Des envies, des attentes, des idées sur la vie du lieu ?', fields: [
      { key: 'inspirations', label: 'Exemples de projets qui inspirent' },
      { key: 'remarques', label: 'Remarques libres' },
    ],
  },
];

// Renvoie une chaîne vide quand la réponse est absente : à l'appelant de choisir
// son propre marqueur d'affichage.
export function formatValue(value: unknown, options?: Record<string, string>): string {
  if (Array.isArray(value)) return value.map(v => options?.[v] ?? v).join(', ');
  if (value === null || value === undefined || value === '') return '';
  return options?.[value as string] ?? String(value);
}
