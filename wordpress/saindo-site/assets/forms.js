/* Formulaires du site vitrine → API de l'application Saindo (cross-origin).
 * SAINDO.appUrl est injecté par le plugin (Réglages → Saindo). */
(function () {
  var APP = (window.SAINDO && window.SAINDO.appUrl) || '';

  function post(path, payload) {
    return fetch(APP + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /* ---- Newsletter ---------------------------------------------------- */
  document.querySelectorAll('[data-saindo-newsletter]').forEach(function (form) {
    var msg = form.parentElement.querySelector('.saindo-newsletter-msg');
    var btn = form.querySelector('button');
    var label = btn.textContent;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input[type="email"]').value;
      btn.disabled = true;
      btn.textContent = '…';
      post('/api/newsletter', { email: email })
        .then(function (res) {
          if (!res.ok) throw new Error();
          msg.textContent = 'Inscription confirmée, merci !';
          msg.style.color = '#166534';
          form.reset();
        })
        .catch(function () {
          msg.textContent = 'Une erreur est survenue, réessayez.';
          msg.style.color = '#B91C1C';
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = label;
        });
    });
  });

  /* ---- Questionnaire porteur·se de projet ---------------------------- */
  var root = document.querySelector('.saindo-questionnaire');
  if (!root) return;

  var steps = Array.prototype.slice.call(root.querySelectorAll('.step'));
  var total = steps.length;
  var current = 0;

  var progressFill = root.querySelector('#sq-progress-fill');
  var progressLabel = root.querySelector('#sq-progress-label');
  var prevBtn = root.querySelector('#sq-prev-btn');
  var nextBtn = root.querySelector('#sq-next-btn');
  var submitBtn = root.querySelector('#sq-submit-btn');
  var form = root.querySelector('#sq-questionnaire-form');
  var formWrapper = root.querySelector('#sq-form-wrapper');
  var thankYou = root.querySelector('#sq-thank-you');
  var emailInput = root.querySelector('#sq-email');
  var emailError = root.querySelector('#sq-email-error');
  var submitError = root.querySelector('#sq-submit-error');

  function showStep(i, scroll) {
    steps.forEach(function (s, idx) { s.classList.toggle('active', idx === i); });
    progressFill.style.width = ((i + 1) / total) * 100 + '%';
    progressLabel.textContent = 'Page ' + (i + 1) + '/' + total;
    prevBtn.style.visibility = i === 0 ? 'hidden' : 'visible';
    nextBtn.hidden = i === total - 1;
    submitBtn.hidden = i !== total - 1;
    if (scroll) formWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  nextBtn.addEventListener('click', function () {
    if (current < total - 1) { current++; showStep(current, true); }
  });
  prevBtn.addEventListener('click', function () {
    if (current > 0) { current--; showStep(current, true); }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var email = emailInput.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      current = 0;
      showStep(0, true);
      emailError.hidden = false;
      emailInput.focus();
      return;
    }
    emailError.hidden = true;

    var fd = new FormData(form);
    var get = function (name) { return String(fd.get(name) || '').trim(); };
    var getAll = function (name) { return fd.getAll(name).map(String); };

    var payload = {
      website: get('website'),
      email: email,
      nom: get('nom'),
      prenom: get('prenom'),
      telephone: get('telephone'),
      intitule_projet: get('intitule_projet'),
      vous_et_votre_projet: {
        autres_membres: get('autres_membres'),
        porteurs_bio: get('porteurs_bio'),
        description: get('description'),
        statut: get('statut'),
        statut_precision: get('statut_precision'),
        nb_emplois: get('nb_emplois'),
        type_porteurs: get('type_porteurs'),
        stade_avancement: get('stade_avancement'),
        partenaires: get('partenaires'),
        aides: get('aides'),
      },
      besoins_espaces: {
        typologie: getAll('typologie'),
        typologie_autre: get('typologie_autre'),
        besoins_techniques: get('besoins_techniques'),
        surface: get('surface'),
        surface_precisions: get('surface_precisions'),
        frequence: get('frequence'),
        horaires: get('horaires'),
        budget: get('budget'),
      },
      mutualisation: {
        contribution: getAll('contribution'),
        contribution_autre: get('contribution_autre'),
        mutualisation_types: getAll('mutualisation_types'),
        mutualisation_autre: get('mutualisation_autre'),
        cooperation: getAll('cooperation'),
        cooperation_autre: get('cooperation_autre'),
      },
      projection: {
        integration_phase: get('integration_phase'),
        duree: get('duree'),
        freins: getAll('freins'),
        freins_autre: get('freins_autre'),
      },
      envies: {
        inspirations: get('inspirations'),
        remarques: get('remarques'),
      },
    };

    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi…';
    submitError.hidden = true;

    post('/api/candidature-projet', payload)
      .then(function (res) {
        if (!res.ok) throw new Error();
        formWrapper.hidden = true;
        thankYou.hidden = false;
        thankYou.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function () {
        submitError.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer';
      });
  });

  showStep(0, false);
})();
