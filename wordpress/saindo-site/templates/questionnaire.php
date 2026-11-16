<?php if (!defined('ABSPATH')) exit; ?>
<div class="saindo-questionnaire">
<div id="sq-form-wrapper">

  <header class="page-header">
    <p class="section-label">Porteur·se de projet</p>
    <h1>Dites-nous en plus sur votre projet</h1>
    <p class="intro">Les données transmises dans ce questionnaire sont strictement confidentielles.</p>
    <p class="intro">En répondant à ce questionnaire, vous ne prenez aucun engagement auprès du Saint-Domingue. Vos réponses nous permettent dans un premier temps de recenser les projets potentiels. Nous les affinerons ensuite collectivement avec vous, une fois le bâtiment acheté.</p>
    <p class="intro">Selon l'avancement de votre projet, vous n'êtes pas obligé·e de répondre à toutes les questions.</p>
    <p class="intro">La sélection des projets hébergés se fera sur la base d'une charte et de critères transparents, qui sont en cours de rédaction.</p>
  </header>

  <div class="progress">
    <div class="progress-bar"><div class="progress-bar-fill" id="sq-progress-fill"></div></div>
    <p class="progress-label" id="sq-progress-label">Page 1/5</p>
  </div>

  <form id="sq-questionnaire-form">
    <input type="text" name="website" id="sq-website" class="honeypot" tabindex="-1" autocomplete="off" aria-hidden="true" />

    <!-- PAGE 1 — Vous et votre projet -->
    <fieldset class="step active">
      <h2>Vous et votre projet</h2>

      <div class="field">
        <label class="field-label" for="intitule_projet">Intitulé du projet</label>
        <input type="text" id="intitule_projet" name="intitule_projet" />
      </div>

      <div class="field">
        <p class="field-label">Contact référent porteur·se de projet</p>
        <div class="field-row">
          <input type="text" name="prenom" placeholder="Prénom" />
          <input type="text" name="nom" placeholder="Nom" />
        </div>
        <div class="field-row">
          <input type="email" name="email" id="sq-email" placeholder="Email *" required />
          <input type="tel" name="telephone" placeholder="Téléphone" />
        </div>
        <p class="error-msg" id="sq-email-error" hidden>Merci de renseigner un email valide : c'est la seule question obligatoire, elle nous permet de vous envoyer la confirmation de votre réponse.</p>
      </div>

      <div class="field">
        <label class="field-label" for="autres_membres">Autres membres impliqué·es (Nom/Prénom)</label>
        <textarea id="autres_membres" name="autres_membres"></textarea>
      </div>

      <div class="field">
        <label class="field-label" for="porteurs_bio">Les porteur·se·s de projet : situation actuelle, biographie rapide des porteur·se·s</label>
        <textarea id="porteurs_bio" name="porteurs_bio"></textarea>
      </div>

      <div class="field">
        <label class="field-label" for="description">Description du projet</label>
        <textarea id="description" name="description"></textarea>
      </div>

      <div class="field">
        <p class="field-label">Statuts</p>
        <div class="choice-group">
          <label class="choice-option"><input type="radio" name="statut" value="association" /> Association</label>
          <label class="choice-option"><input type="radio" name="statut" value="entreprise_individuelle" /> Entreprise individuelle</label>
          <label class="choice-option"><input type="radio" name="statut" value="societe" /> Société</label>
        </div>
        <input type="text" name="statut_precision" placeholder="Précisez le type de société le cas échéant" class="autre-input" />
      </div>

      <div class="field">
        <p class="field-label">Objectif économique</p>
        <label class="field-label field-label--sub" for="nb_emplois">Nombre d'emplois créés souhaités</label>
        <input type="text" id="nb_emplois" name="nb_emplois" />
        <div class="choice-group">
          <label class="choice-option"><input type="radio" name="type_porteurs" value="benevoles" /> Projet porté uniquement par des bénévoles</label>
          <label class="choice-option"><input type="radio" name="type_porteurs" value="mixte" /> Projet mixte</label>
        </div>
      </div>

      <div class="field">
        <p class="field-label">Stade d'avancement</p>
        <div class="choice-group">
          <label class="choice-option"><input type="radio" name="stade_avancement" value="reflexion" /> Projet en réflexion</label>
          <label class="choice-option"><input type="radio" name="stade_avancement" value="statuts_deposes" /> Statuts déposés</label>
          <label class="choice-option"><input type="radio" name="stade_avancement" value="existant" /> Projet existant qui cherche un nouveau local</label>
        </div>
      </div>

      <div class="field">
        <label class="field-label" for="partenaires">Partenaires potentiels</label>
        <textarea id="partenaires" name="partenaires"></textarea>
      </div>

      <div class="field">
        <label class="field-label" for="aides">Aides accordées ou dossiers en cours d'instruction</label>
        <textarea id="aides" name="aides"></textarea>
      </div>
    </fieldset>

    <!-- PAGE 2 — Besoins en espaces de travail et conditions économiques -->
    <fieldset class="step">
      <h2>Besoins en espaces de travail et conditions économiques</h2>

      <div class="field">
        <p class="field-label">Typologie d'espaces recherchés</p>
        <div class="choice-group">
          <label class="choice-option"><input type="checkbox" name="typologie" value="cuisines" /> Cuisines</label>
          <label class="choice-option"><input type="checkbox" name="typologie" value="hebergement" /> Hébergement</label>
          <label class="choice-option"><input type="checkbox" name="typologie" value="salles_restauration" /> Salles de restauration</label>
          <label class="choice-option"><input type="checkbox" name="typologie" value="salles_activites" /> Salles d'activités</label>
        </div>
        <input type="text" name="typologie_autre" placeholder="Autres (précisez)" class="autre-input" />
      </div>

      <div class="field">
        <label class="field-label" for="besoins_techniques">Besoins techniques particuliers</label>
        <textarea id="besoins_techniques" name="besoins_techniques"></textarea>
      </div>

      <div class="field">
        <p class="field-label">Surface du local nécessaire à minima pour réaliser le projet</p>
        <div class="choice-group">
          <label class="choice-option"><input type="radio" name="surface" value="10-20" /> 10–20 m²</label>
          <label class="choice-option"><input type="radio" name="surface" value="20-30" /> 20–30 m²</label>
          <label class="choice-option"><input type="radio" name="surface" value="30-50" /> 30–50 m²</label>
          <label class="choice-option"><input type="radio" name="surface" value="plus-50" /> Plus de 50 m²</label>
        </div>
        <label class="field-label field-label--sub" for="surface_precisions">Précisions complémentaires</label>
        <textarea id="surface_precisions" name="surface_precisions"></textarea>
      </div>

      <div class="field">
        <p class="field-label">Fréquence d'occupation</p>
        <div class="choice-group">
          <label class="choice-option"><input type="radio" name="frequence" value="quotidienne" /> Quotidienne</label>
          <label class="choice-option"><input type="radio" name="frequence" value="plusieurs_jours" /> Plusieurs jours / semaine</label>
          <label class="choice-option"><input type="radio" name="frequence" value="occasionnelle" /> Occasionnelle</label>
          <label class="choice-option"><input type="radio" name="frequence" value="saisonniere" /> Saisonnière</label>
        </div>
      </div>

      <div class="field">
        <p class="field-label">Horaires principaux d'utilisation, plutôt</p>
        <div class="choice-group">
          <label class="choice-option"><input type="radio" name="horaires" value="journee" /> Journée (9h-18h)</label>
          <label class="choice-option"><input type="radio" name="horaires" value="soiree" /> Soirée</label>
          <label class="choice-option"><input type="radio" name="horaires" value="weekend" /> Week-end</label>
          <label class="choice-option"><input type="radio" name="horaires" value="variables" /> Variables</label>
        </div>
      </div>

      <div class="field">
        <p class="field-label">Budget mensuel maximum envisageable pour les locaux, charges comprises</p>
        <div class="choice-group">
          <label class="choice-option"><input type="radio" name="budget" value="100-200" /> 100–200 €</label>
          <label class="choice-option"><input type="radio" name="budget" value="200-300" /> 200–300 €</label>
          <label class="choice-option"><input type="radio" name="budget" value="300-500" /> 300–500 €</label>
          <label class="choice-option"><input type="radio" name="budget" value="plus-500" /> Plus de 500 €</label>
          <label class="choice-option"><input type="radio" name="budget" value="difficile" /> Difficile à estimer à ce stade</label>
          <label class="choice-option"><input type="radio" name="budget" value="occasionnelle" /> Concerné·e seulement par une mise à disposition occasionnelle</label>
        </div>
      </div>
    </fieldset>

    <!-- PAGE 3 — Mutualisation et contribution à la vie du lieu -->
    <fieldset class="step">
      <h2>Mutualisation et contribution à la vie du lieu</h2>

      <div class="field">
        <p class="field-label">De manière générale, comment imaginez-vous contribuer à la vie du lieu ?</p>
        <div class="choice-group">
          <label class="choice-option"><input type="checkbox" name="contribution" value="temps" /> En temps (chantiers, animation, gouvernance)</label>
          <label class="choice-option"><input type="checkbox" name="contribution" value="competences" /> En compétences (selon besoins ponctuels)</label>
          <label class="choice-option"><input type="checkbox" name="contribution" value="contribution_financiere" /> En revalorisant ma contribution financière en fonction de mes excédents</label>
          <label class="choice-option"><input type="checkbox" name="contribution" value="pas_possible" /> Pas possible de contribuer en plus de mon activité</label>
        </div>
        <input type="text" name="contribution_autre" placeholder="D'une autre manière (précisez)" class="autre-input" />
      </div>

      <div class="field">
        <p class="field-label">Quels types de mutualisation vous sembleraient utiles ?</p>
        <div class="choice-group">
          <label class="choice-option"><input type="checkbox" name="mutualisation_types" value="cuisine_partagee" /> Cuisine partagée</label>
          <label class="choice-option"><input type="checkbox" name="mutualisation_types" value="salle_reunion" /> Salle de réunion</label>
          <label class="choice-option"><input type="checkbox" name="mutualisation_types" value="terrasse_cour" /> Terrasse / cour intérieure</label>
          <label class="choice-option"><input type="checkbox" name="mutualisation_types" value="stockage" /> Stockage commun</label>
          <label class="choice-option"><input type="checkbox" name="mutualisation_types" value="materiel" /> Matériel (imprimante, outils, équipements…)</label>
          <label class="choice-option"><input type="checkbox" name="mutualisation_types" value="communication" /> Outils de communication (site web, réseaux sociaux, newsletter…)</label>
          <label class="choice-option"><input type="checkbox" name="mutualisation_types" value="gestion" /> Outils de gestion</label>
          <label class="choice-option"><input type="checkbox" name="mutualisation_types" value="aucun" /> Aucun</label>
        </div>
        <input type="text" name="mutualisation_autre" placeholder="Autres (précisez)" class="autre-input" />
      </div>

      <div class="field">
        <p class="field-label">Quels types de coopération envisageriez-vous avec les autres structures résidentes ?</p>
        <div class="choice-group">
          <label class="choice-option"><input type="checkbox" name="cooperation" value="projets_communs" /> Construction des projets communs</label>
          <label class="choice-option"><input type="checkbox" name="cooperation" value="partage_competences" /> Partage de compétences</label>
          <label class="choice-option"><input type="checkbox" name="cooperation" value="accueil_public" /> Accueil du public régulier (permanence partagée)</label>
          <label class="choice-option"><input type="checkbox" name="cooperation" value="evenements" /> Organisation d'événements (portes ouvertes, festivals…)</label>
          <label class="choice-option"><input type="checkbox" name="cooperation" value="ateliers" /> Organisation d'ateliers, initiations…</label>
          <label class="choice-option"><input type="checkbox" name="cooperation" value="aucun" /> Aucun</label>
        </div>
        <input type="text" name="cooperation_autre" placeholder="Autres (précisez)" class="autre-input" />
      </div>
    </fieldset>

    <!-- PAGE 4 — Projection dans le projet -->
    <fieldset class="step">
      <h2>Projection dans le projet</h2>

      <p class="section-intro">Le calendrier prévu pour le Saint-Domingue repose sur 2 phases : la première, dès l'acquisition, est une phase temporaire ou expérimentale d'une durée de 2 ans — dans l'état actuel du bâtiment (avec un minimum de mise en sécurité), des activités démarrent et utilisent les espaces disponibles, avec des travaux légers envisageables (nettoyage, petits aménagements, décoration). La seconde, pérenne, sera mise en œuvre après une campagne globale de travaux sur le bâtiment, pensés avec les futur·e·s utilisateur·rice·s et dimensionnés au plus juste.</p>

      <div class="field">
        <p class="field-label">Si le projet Saint-Domingue ouvre pour une phase d'expérimentation dès l'automne 2026, votre structure pourrait-elle intégrer le projet ?</p>
        <div class="choice-group">
          <label class="choice-option"><input type="radio" name="integration_phase" value="des_ouverture" /> Oui, dès l'ouverture</label>
          <label class="choice-option"><input type="radio" name="integration_phase" value="annee_suivante" /> Oui, dans l'année suivante (2027)</label>
          <label class="choice-option"><input type="radio" name="integration_phase" value="phase_perenne" /> Non, seulement dans la phase pérenne</label>
        </div>
      </div>

      <div class="field">
        <p class="field-label">Si vous intégrez le projet Saint-Domingue, sur quelle durée vous projetez-vous ?</p>
        <div class="choice-group">
          <label class="choice-option"><input type="radio" name="duree" value="quelques_mois" /> Quelques mois</label>
          <label class="choice-option"><input type="radio" name="duree" value="1_an" /> 1 an</label>
          <label class="choice-option"><input type="radio" name="duree" value="2_ans" /> 2 ans</label>
          <label class="choice-option"><input type="radio" name="duree" value="3_ans_plus" /> 3 ans et plus</label>
        </div>
      </div>

      <div class="field">
        <p class="field-label">Quels seraient pour vous les principaux freins à l'intégration du lieu ?</p>
        <div class="choice-group">
          <label class="choice-option"><input type="checkbox" name="freins" value="budget" /> Budget insuffisant</label>
          <label class="choice-option"><input type="checkbox" name="freins" value="distance" /> Distance géographique</label>
          <label class="choice-option"><input type="checkbox" name="freins" value="espaces" /> Inadéquation des espaces disponibles</label>
          <label class="choice-option"><input type="checkbox" name="freins" value="gouvernance" /> Réticence à la gouvernance collective</label>
          <label class="choice-option"><input type="checkbox" name="freins" value="timing" /> Timing</label>
          <label class="choice-option"><input type="checkbox" name="freins" value="manque_info" /> Manque d'information sur le projet</label>
          <label class="choice-option"><input type="checkbox" name="freins" value="aucun" /> Aucun frein identifié</label>
        </div>
        <input type="text" name="freins_autre" placeholder="Autres (précisez)" class="autre-input" />
      </div>
    </fieldset>

    <!-- PAGE 5 — Des envies, des attentes, des idées sur la vie du lieu ? -->
    <fieldset class="step">
      <h2>Des envies, des attentes, des idées sur la vie du lieu ?</h2>

      <div class="field">
        <label class="field-label" for="inspirations">Avez-vous un ou des exemples de projets qui vous inspirent ?</label>
        <textarea id="inspirations" name="inspirations"></textarea>
      </div>

      <div class="field">
        <label class="field-label" for="remarques">Remarques libres</label>
        <textarea id="remarques" name="remarques"></textarea>
      </div>
    </fieldset>

    <p class="error-msg" id="sq-submit-error" hidden>Une erreur est survenue lors de l'envoi, merci de réessayer.</p>

    <div class="step-nav">
      <button type="button" id="sq-prev-btn" class="btn btn-outline">Précédent</button>
      <button type="button" id="sq-next-btn" class="btn">Suivant</button>
      <button type="submit" id="sq-submit-btn" class="btn" hidden>Envoyer</button>
    </div>
  </form>
</div>

<div id="sq-thank-you" hidden>
  <p class="section-label">Merci !</p>
  <h1>Votre projet est bien enregistré</h1>
  <p class="intro">Nous vous remercions de l'intérêt que vous portez à ce projet. Vous allez recevoir un mail de confirmation avec un récapitulatif de vos réponses.</p>
  <p class="intro">À ce jour, comme vous le savez, toute notre énergie est dédiée à la levée de fonds citoyenne pour acheter le bâtiment et rendre ce projet possible. C'est pourquoi nous reprendrons contact avec vous seulement après avoir sécurisé l'achat, mais rassurez-vous, nous ne vous oublions pas !</p>
  <p class="intro">D'ici là, la meilleure manière de nous soutenir c'est d'en parler autour de vous, on compte sur vous !</p>
  <p class="intro">PS : n'oubliez pas d'<a href="/je-contribue">adhérer à l'association</a> si ce n'est pas déjà fait, ou de vous <a href="/#saindo-newsletter">inscrire à la newsletter</a>.</p>
  <a href="/" class="btn">Retour à l'accueil</a>
</div>
</div>
