/*
 * Vorschau-Lader für die Karten und das UI-Kit.
 * Lädt die .jsx-Komponenten, übersetzt sie mit Babel im Browser und legt sie auf window.BB ab.
 * Braucht einen Webserver (fetch) sowie React, ReactDOM und @babel/standalone davor.
 * In einem Design-System-Projekt ersetzt das erzeugte Bündel diesen Lader.
 */
(function () {
  var BB = (window.BB = window.BB || {})
  var root = document.currentScript.src.replace(/components\/_preview\/[^/]*$/, '')
  var ORDER = ["_lib/format.js","brew/MethodIcon.jsx","actions/Button.jsx","actions/GearButton.jsx","actions/LogButton.jsx","actions/Chip.jsx","actions/FilterRow.jsx","actions/SegmentedControl.jsx","layout/Screen.jsx","layout/Header.jsx","layout/Section.jsx","layout/Card.jsx","overlay/Sheet.jsx","overlay/InfoDot.jsx","inputs/Field.jsx","inputs/TextInput.jsx","inputs/Select.jsx","inputs/Stepper.jsx","inputs/Toggle.jsx","display/Stat.jsx","display/Triad.jsx","display/MetaRow.jsx","display/Empty.jsx","display/FreshnessRing.jsx","feedback/Notice.jsx","feedback/UndoBar.jsx","feedback/UpdateToast.jsx","feedback/StorageErrorBar.jsx","brew/BrewButton.jsx","brew/TabBar.jsx","brew/SwipeReveal.jsx"]
  function rewrite(src) {
    var names = []
    src = src.replace(/^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm, function (m, spec, mod) {
      var obj = mod === 'react' ? 'React' : mod === 'react-dom' ? 'ReactDOM' : 'BB'
      var named = (spec.match(/\{([^}]*)\}/) || [])[1]
      if (!named) return ''
      return 'var {' + named.replace(/\s+as\s+/g, ': ') + '} = ' + obj + ';'
    })
    src = src.replace(/^export\s+(function|const)\s+([A-Za-z_$][\w$]*)/gm, function (m, kw, name) { names.push(name); return kw + ' ' + name })
    return src + '\nObject.assign(BB, {' + names.join(', ') + '});'
  }
  function run(path, text) {
    var code = Babel.transform(rewrite(text), { presets: ['react'], filename: path }).code
    new Function('React', 'ReactDOM', 'BB', code)(window.React, window.ReactDOM, BB)
  }
  async function loadAll(list) {
    var texts = await Promise.all(list.map(function (p) { return fetch(root + (p.indexOf('/') > -1 && list === ORDER ? 'components/' : '') + p).then(function (r) { return r.text() }) }))
    list.forEach(function (p, i) { run(p, texts[i]) })
  }
  /** Weitere Dateien relativ zum Design-System-Stamm nachladen (z. B. UI-Kit-Bildschirme). */
  function zeige(e) {
    var d = document.createElement('pre')
    d.style.cssText = 'font:12px monospace;white-space:pre-wrap;color:#a6402f;padding:12px'
    d.textContent = 'Vorschau-Fehler: ' + e.message
    document.body.prepend(d)
    throw e
  }
  window.BB_LOAD = function (extra) { return loadAll(extra).catch(zeige) }
  window.BB_READY = (async function () {
    await loadAll(ORDER).catch(zeige)
    var h = React.createElement
    BB.Themes = function (p) {
      var list = [['theme-milchkaffee', 'Milchkaffee'], ['theme-espresso', 'Espresso'], ['theme-organic', 'Organic']]
      return h('div', { style: { display: 'grid', gridTemplateColumns: p.col ? '1fr' : 'repeat(3, minmax(0, 1fr))', gap: 10 } }, list.map(function (t) {
        return h('div', { key: t[0], className: t[0], style: { background: 'var(--color-paper)', color: 'var(--color-ink)', fontFamily: 'var(--font-sans)', borderRadius: 14, padding: p.pad == null ? 14 : p.pad, position: 'relative', overflow: 'hidden', minWidth: 0 } },
          h('div', { style: { fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-faint)', marginBottom: 10 } }, t[1]),
          p.render ? p.render(t[0]) : p.children)
      }))
    }
    return BB
  })()
})()
