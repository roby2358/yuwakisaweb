// En Garde! — The Season in Paris
// names.js — name pools for characters, rivals, and ladies. MIT License.

const MALE_FIRST_NAMES = ['Armand', 'Gaston', 'Henri', 'Philippe', 'Lucien',
  'Étienne', 'Théodore', 'Raoul', 'Charles', 'Antoine', 'Blaise', 'Cyrille',
  'Damien', 'Edmond', 'Fabrice', 'Gérard', 'Hugo', 'Isaac', 'Jules',
  'Léandre', 'Marcel', 'Nicolas', 'Olivier', 'Pascal', 'Quentin', 'Rémy',
  'Sébastien', 'Tristan', 'Urbain', 'Victor',
  'Adrien', 'Alexandre', 'Amaury', 'Anselme', 'Aubin', 'Auguste',
  'Balthazar', 'Barthélemy', 'Bastien', 'Baudouin', 'Benoît', 'Bertrand',
  'Brice', 'César', 'Clément', 'Corentin', 'Denis', 'Didier', 'Émile',
  'Enguerrand', 'Eustache', 'Évariste', 'Fernand', 'Firmin', 'Florent',
  'François', 'Gaspard', 'Gauthier', 'Geoffroy', 'Ghislain', 'Gilles',
  'Godefroy', 'Grégoire', 'Guillaume', 'Honoré', 'Hyacinthe', 'Ignace',
  'Jacques', 'Jean', 'Jérôme', 'Joachim', 'Laurent', 'Lazare', 'Léon',
  'Louis', 'Marius', 'Mathieu', 'Maximilien', 'Melchior', 'Michel',
  'Narcisse', 'Octave', 'Pierre', 'Prosper', 'Renaud', 'Roland', 'Séverin',
  'Sylvain', 'Thibault', 'Timothée'];

const SURNAMES = ['Brissac', 'Rochefort', 'Valcourt', 'Aubigny', 'Marsay',
  'Corbin', 'Baudin', 'Chantelle', 'Foix', 'Grammont', 'Herblay', 'Ivry',
  'Joyeuse', 'Kermadec', 'Lavalle', 'Montclair', 'Nevers', 'Orsigny',
  'Puget', 'Quercy', 'Rossignol', 'Savigny', 'Tréville', 'Uzès', 'Vidal',
  'Ambleville', 'Argenson', 'Barbezieux', 'Beaufort', 'Bellegarde',
  'Boisrenard', 'Brantôme', 'Bussy', 'Cadignan', 'Castellane', 'Chabot',
  'Chavigny', 'Clérambault', 'Comminges', 'Coulanges', 'Créquy', 'Duras',
  'Entragues', 'Épernon', 'Fontanges', 'Fronsac', 'Gondrin', 'Guiche',
  'Harcourt', 'Hautefort', 'Jarnac', 'Lauzun', 'Lesparre', 'Liancourt',
  'Longueval', 'Malicorne', 'Matignon', 'Mirepoix', 'Montbazon',
  'Montespan', 'Noirmont', 'Palluau', 'Périgny', 'Pontcarré',
  'Rambouillet', 'Roquelaure', 'Sancerre', 'Soyecourt', 'Tavannes',
  'Thémines', 'Tourville', 'Vardes', 'Vaubécourt', 'Vendranges',
  'Villequier'];

const COMMON_SURNAME_CHANCE = 0.5; // commoners get plain surnames, no particle

const LADY_FIRST_NAMES = ['Céleste', 'Aurélie', 'Babette', 'Delphine',
  'Élodie', 'Fantine', 'Gabrielle', 'Héloïse', 'Isabeau', 'Joséphine',
  'Katarina', 'Lisette', 'Madeleine', 'Ninon', 'Odette', 'Perrette',
  'Roxane', 'Sylvie', 'Thérèse', 'Violette',
  'Adélaïde', 'Agnès', 'Amarante', 'Angélique', 'Antoinette', 'Apolline',
  'Armande', 'Athénaïs', 'Bérengère', 'Blanche', 'Camille', 'Charlotte',
  'Clémence', 'Colombe', 'Constance', 'Diane', 'Dorothée', 'Eugénie',
  'Euphrasie', 'Fleurette', 'Françoise', 'Geneviève', 'Henriette',
  'Hortense', 'Jacinthe', 'Louise', 'Lucrèce', 'Marguerite', 'Marianne',
  'Mathilde', 'Mélisande', 'Mirabelle', 'Pélagie', 'Rosalie', 'Salomé',
  'Séraphine', 'Solange', 'Suzanne', 'Victoire', 'Yolande'];

const LADY_HOUSES = ['Montreuil', 'Vermandois', 'Fleury', 'Nemours',
  'Rousseau', 'Dupin', 'Clairmont', 'Estrées', 'Boisguilbert', 'Charolais',
  'Dammartin', 'Louvois', 'Pompignan', 'Sablé', 'Tencin',
  'Aiguillon', 'Amboise', 'Beauvilliers', 'Bragelonne', 'Chevreuse',
  'Choisy', 'Coëtquen', 'Courtenay', 'Duplessis', 'Elbeuf', 'Fontrailles',
  'Gournay', 'Guéméné', 'Lafayette', 'Lambesc', 'Lésigny', 'Maintenon',
  'Marivaux', 'Mortemart', 'Motteville', 'Navailles', 'Olonne',
  'Polignac', 'Rohan', 'Scudéry', 'Sévigné', 'Soubise', 'Ventadour',
  'Verneuil', 'Villedieu'];

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
