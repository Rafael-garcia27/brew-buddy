/**
 * Systemnahe Hinweise: Installation, Datensicherung, Erststart.
 *
 * Briefing F3: iOS kennt kein `beforeinstallprompt` — die Installation muss
 * erklärt werden, sie lässt sich nicht auslösen.
 * Briefing C5: Ohne Sicherung ist die Historie einen Safari-Aufräumlauf
 * entfernt. Die Erinnerung gehört dorthin, wo der Nutzer täglich hinsieht.
 */
import { useEffect, useState } from 'react'
import { Card, Button } from './ui'
import { useStore, selectSnapshot } from '@/store'
import { shareBackup } from '@/store/persist'
import { BACKUP_REMINDER_DAYS, APP_NAME } from '@/config'

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/** Anleitung zum Ablegen auf dem Home-Bildschirm */
export function InstallGuide() {
  if (isStandalone()) {
    return (
      <Card>
        <p className="text-lg">
          <span className="text-ok">✓</span> Als App installiert.
        </p>
        <p className="mt-1 text-sm text-mute">
          Läuft im Vollbild und funktioniert ohne Netz.
        </p>
      </Card>
    )
  }

  return (
    <Card tone="accent">
      <p className="font-medium">Auf dem Home-Bildschirm ablegen</p>
      {isIOS() ? (
        <ol className="mt-3 space-y-2 text-base leading-snug">
          <li className="flex gap-2">
            <span className="text-crema">1.</span>
            <span>
              In Safari unten auf <strong>Teilen</strong> tippen (Quadrat mit Pfeil nach oben)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-crema">2.</span>
            <span>
              Nach unten wischen zu <strong>Zum Home-Bildschirm</strong>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-crema">3.</span>
            <span>
              Oben rechts <strong>Hinzufügen</strong>
            </span>
          </li>
        </ol>
      ) : (
        <p className="mt-2 text-base leading-snug text-mute">
          Im Browsermenü „Zum Startbildschirm hinzufügen" oder „App installieren" wählen.
        </p>
      )}
      <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-mute">
        Danach startet {APP_NAME} im Vollbild, ohne Adressleiste, und funktioniert vollständig
        ohne Internet. Das ist nicht nur Kosmetik: Nur als installierte App bleiben die
        Daten zuverlässig erhalten.
      </p>
    </Card>
  )
}

/**
 * Erinnerung an die Sicherung. Erscheint erst, wenn es etwas zu verlieren gibt —
 * eine Warnung ohne Daten wäre nur Lärm.
 */
export function BackupBanner() {
  const brews = useStore((s) => s.brews)
  const lastBackupAt = useStore((s) => s.settings.lastBackupAt)
  const setSettings = useStore((s) => s.setSettings)
  const [dismissed, setDismissed] = useState(false)
  const [busy, setBusy] = useState(false)

  const days = lastBackupAt
    ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000)
    : null
  const overdue = brews.length >= 5 && (days === null || days > BACKUP_REMINDER_DAYS)

  if (!overdue || dismissed) return null

  return (
    <div className="px-4 pt-4">
      <Card tone="warn">
        <p className="text-lg leading-snug">
          {brews.length} Brews ungesichert. iOS löscht die Daten einer PWA nach
          längerer Nichtnutzung — dann ist alles Gelernte weg.
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await shareBackup(selectSnapshot(useStore.getState()))
              setSettings({ lastBackupAt: new Date().toISOString() })
              setBusy(false)
            }}
          >
            Jetzt sichern
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Später
          </Button>
        </div>
      </Card>
    </div>
  )
}

/** Erststart: was fehlt noch, damit die App gut arbeiten kann? */
export function SetupNudge({ onGrinder }: { onGrinder: () => void }) {
  const grinders = useStore((s) => s.grinders)
  const brews = useStore((s) => s.brews)
  const [dismissed, setDismissed] = useState(false)

  if (grinders.length > 0 || dismissed || brews.length > 2) return null

  return (
    <div className="px-4 pt-4">
      <Card tone="accent">
        <p className="text-lg leading-snug">
          <strong>Noch keine Mühle eingerichtet.</strong> Mit ihr werden aus Empfehlungen
          konkrete Klickzahlen statt Prozentangaben.
        </p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={onGrinder}>
            Mühle wählen
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            Später
          </Button>
        </div>
      </Card>
    </div>
  )
}

/**
 * Rückgängig-Leiste nach einer Löschung.
 *
 * Statt einer Rückfrage VOR dem Löschen: Die Wischgeste soll sich
 * flüssig anfühlen, und ein Dialog mitten in der Bewegung nimmt ihr
 * genau das. Der Weg zurück kommt deshalb danach — acht Sekunden lang,
 * dann ist es endgültig.
 */
export function UndoBar({
  text,
  detail,
  onUndo,
}: {
  text: string
  detail?: string
  onUndo: () => void
}) {
  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-40 px-4 pb-3">
      {/* Kein Schließkreuz: Auf 375 px kostet es die 44 px, die der Text
          zum Lesen braucht — „Hausmischung gelöscht" wurde damit zu
          „Hausmischung gelös…". Die Leiste geht von selbst. */}
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-3 shadow-lg">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base">{text}</p>
          {detail && <p className="truncate text-sm text-mute">{detail}</p>}
        </div>
        <Button size="sm" onClick={onUndo}>
          Rückgängig
        </Button>
      </div>
    </div>
  )
}

/**
 * Der Speicher hat nicht funktioniert — und das darf nicht untergehen.
 *
 * Anders als die Rückgängig-Leiste verschwindet diese hier NICHT von
 * selbst. Sie steht oben statt unten, weil sie keine Handlung anbietet,
 * die man gerade eben noch machen könnte, sondern eine Lage beschreibt,
 * die den Rest der Sitzung betrifft: Alles, was ab jetzt eingetragen
 * wird, ist womöglich beim nächsten Start weg.
 *
 * Der Knopf führt ins Setup zur Sicherung — das ist in dieser Lage das
 * einzig Sinnvolle, was man tun kann.
 */
export function StorageErrorBar({
  text,
  onBackup,
  onDismiss,
}: {
  text: string
  onBackup: () => void
  onDismiss: () => void
}) {
  return (
    <div className="pt-safe sticky top-0 z-50 px-4 pt-2 pb-2">
      <div className="rounded-2xl border border-bad/50 bg-bad/15 px-4 py-3 shadow-lg">
        <p className="text-base leading-snug">{text}</p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" onClick={onBackup}>
            Jetzt sichern
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Später
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Eine neue Version liegt bereit — sichtbar machen, statt still zu tauschen.
 *
 * Befund F-07: Diese Leiste war fertig gebaut und wurde nirgends
 * gerendert. Mit `registerType: 'autoUpdate'` übernimmt der neue Service
 * Worker von selbst; die laufende Seite behält aber ihren alten Code, bis
 * sie neu geladen wird. Wer die App als Lesezeichen offen lässt, läuft
 * sonst wochenlang auf einem Stand, den es nicht mehr gibt.
 *
 * Deshalb sagt sie nicht „geladen", sondern bietet das Neuladen an — das
 * ist die Handlung, um die es geht.
 */
export function UpdateToast() {
  const [bereit, setBereit] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    /**
     * Beim allerersten Besuch gibt es noch keinen Controller; wenn dann
     * der erste Service Worker übernimmt, feuert `controllerchange`
     * ebenfalls. Das ist keine Aktualisierung, sondern die Installation —
     * und ein „neue Version" beim ersten Öffnen wäre schlicht falsch.
     */
    if (!navigator.serviceWorker.controller) return
    const onUpdate = () => setBereit(true)
    navigator.serviceWorker.addEventListener('controllerchange', onUpdate)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onUpdate)
  }, [])

  if (!bereit) return null
  return (
    <div className="pb-safe fixed inset-x-4 bottom-24 z-40 flex items-center gap-3 rounded-2xl border border-line bg-raised px-4 py-3 shadow-lg">
      <p className="min-w-0 flex-1 text-base leading-snug">
        Eine neue Version steht bereit.
      </p>
      <Button size="sm" onClick={() => window.location.reload()}>
        Neu laden
      </Button>
    </div>
  )
}
