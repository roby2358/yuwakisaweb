// En Garde! — The Season in Paris
// names.js — name pools for characters, rivals, and ladies. MIT License.

const MALE_FIRST_NAMES = ['Armand', 'Gaston', 'Henri', 'Philippe', 'Lucien',
  'Étienne', 'Théodore', 'Raoul', 'Charles', 'Antoine', 'Blaise', 'Cyrille',
  'Damien', 'Edmond', 'Fabrice', 'Gérard', 'Hugo', 'Isaac', 'Jules',
  'Léandre', 'Marcel', 'Nicolas', 'Olivier', 'Pascal', 'Quentin', 'Rémy',
  'Sébastien', 'Tristan', 'Urbain', 'Victor'];

const SURNAMES = ['Brissac', 'Rochefort', 'Valcourt', 'Aubigny', 'Marsay',
  'Corbin', 'Baudin', 'Chantelle', 'Foix', 'Grammont', 'Herblay', 'Ivry',
  'Joyeuse', 'Kermadec', 'Lavalle', 'Montclair', 'Nevers', 'Orsigny',
  'Puget', 'Quercy', 'Rossignol', 'Savigny', 'Tréville', 'Uzès', 'Vidal'];

const COMMON_SURNAME_CHANCE = 0.5; // commoners get plain surnames, no particle

const LADY_FIRST_NAMES = ['Céleste', 'Aurélie', 'Babette', 'Delphine',
  'Élodie', 'Fantine', 'Gabrielle', 'Héloïse', 'Isabeau', 'Joséphine',
  'Katarina', 'Lisette', 'Madeleine', 'Ninon', 'Odette', 'Perrette',
  'Roxane', 'Sylvie', 'Thérèse', 'Violette'];

const LADY_HOUSES = ['Montreuil', 'Vermandois', 'Fleury', 'Nemours',
  'Rousseau', 'Dupin', 'Clairmont', 'Estrées', 'Boisguilbert', 'Charolais',
  'Dammartin', 'Louvois', 'Pompignan', 'Sablé', 'Tencin'];

function randomMaleName(noble) {
  const first = pick(MALE_FIRST_NAMES);
  const surname = pick(SURNAMES);
  if (noble || Math.random() >= COMMON_SURNAME_CHANCE) return first + ' de ' + surname;
  return first + ' ' + surname;
}

function ladyStyle(sl) {
  if (sl >= 13) return 'Comtesse';
  if (sl >= 10) return 'Madame';
  return 'Mademoiselle';
}

function randomLadyName(sl) {
  const style = ladyStyle(sl);
  if (style === 'Mademoiselle') return 'Mlle ' + pick(LADY_FIRST_NAMES) + ' ' + pick(LADY_HOUSES);
  if (style === 'Madame') return 'Mme de ' + pick(LADY_HOUSES);
  return 'Comtesse de ' + pick(LADY_HOUSES);
}
