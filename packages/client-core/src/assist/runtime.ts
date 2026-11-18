export const ASSIST_RUNTIME = String.raw`
(function (config) {
  if (window.__cpAssist) {
    window.__cpAssist.scan();
    return;
  }
  var CV_STATE = { None: 'none', Attached: 'attached', Pick: 'pick' };
  var TEXT_TYPES = ['', 'text', 'email', 'tel', 'url', 'search', 'number'];
  var CAPTCHA_WORDS = /captcha|turnstile|g-recaptcha|h-captcha|cf-challenge/i;
  var state = { password: null, cv: null, filled: new Set(), cvState: CV_STATE.None, timer: null };

  function normalise(text) {
    return String(text || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function escapeRegex(text) {
    return text.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
  }
  function hasTerm(text, term) {
    var wanted = normalise(term);
    return wanted !== '' && new RegExp('\\b' + escapeRegex(wanted) + '\\b').test(normalise(text));
  }
  function hasAny(text, terms) {
    return terms.some(function (term) { return hasTerm(text, term); });
  }
  function underscored(text) {
    return normalise(text).replace(/ /g, '_');
  }
  function matchesCaptcha(el) {
    var selectors = config.captchaSelectors || [];
    for (var i = 0; i < selectors.length; i += 1) {
      try {
        if (el.matches(selectors[i]) || (el.closest && el.closest(selectors[i]))) { return true; }
      } catch (error) {}
    }
    return CAPTCHA_WORDS.test((el.id || '') + ' ' + (el.className && el.className.baseVal === undefined ? el.className : '') + ' ' + (el.name || ''));
  }
  function collectDocuments(root, found) {
    found.push(root);
    var frames = root.querySelectorAll('iframe');
    for (var i = 0; i < frames.length; i += 1) {
      if (matchesCaptcha(frames[i])) { continue; }
      try {
        var inner = frames[i].contentDocument;
        if (inner && inner.body) { collectDocuments(inner, found); }
      } catch (error) {}
    }
    return found;
  }
  function isVisible(el) {
    var win = el.ownerDocument.defaultView;
    var style = win.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.getClientRects().length > 0;
  }
  function labelOf(el) {
    var doc = el.ownerDocument;
    var parts = [];
    if (el.id) {
      var forLabel = doc.querySelector('label[for="' + el.id.replace(/"/g, '') + '"]');
      if (forLabel) { parts.push(forLabel.textContent); }
    }
    var wrapping = el.closest('label');
    if (wrapping) { parts.push(wrapping.textContent); }
    var labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      labelledBy.split(' ').forEach(function (id) {
        var node = doc.getElementById(id);
        if (node) { parts.push(node.textContent); }
      });
    }
    parts.push(el.getAttribute('aria-label') || '');
    parts.push(el.getAttribute('placeholder') || '');
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }
  function isEditableText(el) {
    if (el.tagName === 'TEXTAREA') { return true; }
    return el.tagName === 'INPUT' && TEXT_TYPES.indexOf((el.getAttribute('type') || '').toLowerCase()) !== -1;
  }
  function setValue(el, value) {
    var win = el.ownerDocument.defaultView;
    var proto = el.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new win.Event('input', { bubbles: true }));
    el.dispatchEvent(new win.Event('change', { bubbles: true }));
  }
  function hasPasswordSibling(el) {
    var scope = el.form || el.ownerDocument;
    return scope.querySelector('input[type="password"]') !== null;
  }
  function factValue(el, label) {
    var tokens = (el.getAttribute('autocomplete') || '').toLowerCase().split(/\s+/);
    var name = underscored(el.getAttribute('name') || '');
    var normalisedLabel = normalise(label);
    for (var i = 0; i < config.facts.length; i += 1) {
      var fact = config.facts[i];
      var byToken = tokens.some(function (token) { return fact.autocomplete.indexOf(token) !== -1; });
      var byName = name !== '' && fact.names.some(function (n) { return underscored(n) === name; });
      var byLabel = fact.labels.some(function (l) { return normalise(l) === normalisedLabel; });
      if (byToken || byName || byLabel) {
        return fact.fact === 'email' && config.accountEmail && hasPasswordSibling(el) ? config.accountEmail : fact.value;
      }
    }
    return null;
  }
  function answerValue(label) {
    var wanted = normalise(label);
    for (var i = 0; i < config.answers.length; i += 1) {
      if (normalise(config.answers[i].label) === wanted) { return config.answers[i].answer; }
    }
    return null;
  }
  function valueFor(el, label) {
    if (el.tagName === 'TEXTAREA' && config.coverLetter && hasAny(label, config.coverLetterLabels)) { return config.coverLetter; }
    var fact = factValue(el, label);
    return fact !== null ? fact : answerValue(label);
  }
  function describeLeft(left, label, kind) {
    var text = label || 'Field';
    if (!left.some(function (item) { return item.label === text; })) { left.push({ label: text, kind: kind }); }
  }
  function fileInputs(doc) {
    return Array.prototype.slice.call(doc.querySelectorAll('input[type="file"]')).filter(function (el) { return !matchesCaptcha(el); });
  }
  function attachCv(el) {
    if (!state.cv) { return false; }
    try {
      var bytes = Uint8Array.from(atob(state.cv.data), function (c) { return c.charCodeAt(0); });
      var win = el.ownerDocument.defaultView;
      var file = new win.File([bytes], state.cv.name, { type: state.cv.type });
      var transfer = new win.DataTransfer();
      transfer.items.add(file);
      el.files = transfer.files;
      el.dispatchEvent(new win.Event('input', { bubbles: true }));
      el.dispatchEvent(new win.Event('change', { bubbles: true }));
      return el.files && el.files.length === 1;
    } catch (error) {
      return false;
    }
  }
  function handleFiles(doc) {
    var inputs = fileInputs(doc).filter(function (el) {
      var label = labelOf(el) + ' ' + (el.getAttribute('name') || '');
      return hasAny(label, config.resumeLabels) || fileInputs(doc).length === 1;
    });
    inputs.forEach(function (el) {
      if (el.files && el.files.length > 0) { state.cvState = CV_STATE.Attached; return; }
      state.cvState = attachCv(el) ? CV_STATE.Attached : CV_STATE.Pick;
    });
  }
  function fillPasswords(doc) {
    if (state.password === null) { return; }
    var inputs = doc.querySelectorAll('input[type="password"]');
    for (var i = 0; i < inputs.length; i += 1) {
      var el = inputs[i];
      if (matchesCaptcha(el) || !isVisible(el) || el.disabled || el.readOnly || el.value !== '') { continue; }
      setValue(el, state.password);
      state.filled.add(el);
    }
  }
  function fillText(doc, left) {
    var controls = doc.querySelectorAll('input, textarea, select');
    for (var i = 0; i < controls.length; i += 1) {
      var el = controls[i];
      var type = (el.getAttribute('type') || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'image', 'reset', 'file', 'password'].indexOf(type) !== -1) { continue; }
      if (matchesCaptcha(el) || el.disabled || el.readOnly || !isVisible(el)) { continue; }
      var label = labelOf(el);
      var protectedField = hasAny(label, config.skipTerms);
      if (el.tagName === 'SELECT' || type === 'checkbox' || type === 'radio' || !isEditableText(el)) {
        var done = el.value !== '';
        if (type === 'checkbox') { done = el.checked; }
        if (type === 'radio') { done = el.name ? doc.querySelector('input[type="radio"][name="' + el.name.replace(/"/g, '') + '"]:checked') !== null : el.checked; }
        if (!done) { describeLeft(left, label, protectedField ? 'protected' : 'other'); }
        continue;
      }
      if (el.value !== '') { continue; }
      if (protectedField) { describeLeft(left, label, 'protected'); continue; }
      var value = valueFor(el, label);
      if (value === null || value === '') { describeLeft(left, label, 'other'); continue; }
      setValue(el, value);
      state.filled.add(el);
    }
  }
  function confirmationText() {
    var body = document.body;
    var text = body ? (body.innerText !== undefined ? body.innerText : body.textContent) || '' : '';
    var flat = text.replace(/\s+/g, ' ');
    var lower = flat.toLowerCase();
    for (var i = 0; i < config.confirmationPhrases.length; i += 1) {
      var at = lower.indexOf(config.confirmationPhrases[i].toLowerCase());
      if (at !== -1) { return flat.substr(Math.max(0, at - 20), config.excerptChars); }
    }
    return '';
  }
  function report(left) {
    var alive = 0;
    state.filled.forEach(function (el) { if (el.isConnected) { alive += 1; } });
    var payload = {
      type: 'status',
      filled: alive,
      left: left,
      cv: state.cvState,
      confirmation: confirmationText(),
      url: location.href
    };
    window.ReactNativeWebView.postMessage(JSON.stringify(payload));
  }
  function scan() {
    var left = [];
    collectDocuments(document, []).forEach(function (doc) {
      fillPasswords(doc);
      fillText(doc, left);
      handleFiles(doc);
    });
    report(left);
  }
  window.__cpAssist = {
    scan: scan,
    setPassword: function (value) { state.password = value; scan(); },
    setCv: function (name, type, data) { state.cv = { name: name, type: type, data: data }; scan(); }
  };
  var observer = new MutationObserver(function () {
    if (state.timer) { clearTimeout(state.timer); }
    state.timer = setTimeout(scan, config.scanIntervalMs);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scan();
})
`;
