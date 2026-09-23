/**
 * Die Getränkekarte — was aus dem Shot wird, den man gerade gezogen hat.
 *
 * Eine Zusatzfunktion, und deshalb auf der Ergebnisseite auch nur eine
 * Zeile. Wer seinen Espresso pur trinkt, soll nach jedem Durchgang nicht
 * durch dreiundzwanzig Rezepturen scrollen müssen, um zu „Fertig" zu
 * kommen; wer Milch will, ist zwei Berührungen von der Menge entfernt.
 *
 * Zwei Blätter übereinander: die Karte, dann das einzelne Rezept. Das
 * ist eine Ebene mehr als nötig wäre, wenn man alles untereinander
 * zeigte — aber die Rezepturen tragen Gießreihenfolge, Schaumhöhe,
 * Glasgröße und Notizen, und das sind je Getränk zehn Zeilen.
 */
import { useState } from 'react'
import { Card, Section, Sheet, num } from '@/components/ui'
import { karte, rezept, GRUPPENNAME, ZUTATNAME, SCHAUM } from '@/engine/getraenke'
import type { Rezept, Shot } from '@/engine/getraenke'
import type { Getraenk } from '@/kb'

/** Espresso ist keine Zutat, steht aber in der Gießreihenfolge. */
const GIESSNAME: Record<string, string> = { espresso: 'Espresso', ...ZUTATNAME }

/**
 * Gramm so schreiben, wie die Rechnung sie rundet.
 *
 * „60,0 g Milch" behauptet eine Genauigkeit, die es nicht gibt — die
 * Menge ist auf ganze Gramm gerundet, und die Null hinter dem Komma ist
 * nur Beiwerk. Unter zehn Gramm rundet die Rechnung feiner, dort gehört
 * die Stelle hin.
 */
function gramm(v: number): string {
  return num(v, v >= 10 ? 0 : 1)
}

export function Getraenkekarte({ shot }: { shot: Shot }) {
  const [offen, setOffen] = useState(false)
  const [gewaehlt, setGewaehlt] = useState<Getraenk | null>(null)
  const alle = karte(shot)
  if (alle.length === 0) return null

  // Die Vorschau nimmt die ersten Milchgetränke der Karte — dieselbe
  // Reihenfolge wie im Blatt. Welche das sind, entscheidet die Datei
  // und nicht diese Datei hier.
  const vorschau = alle
    .filter((r) => r.getraenk.category === 'milk')
    .slice(0, 3)
    .map((r) => r.getraenk.name)
    .join(', ')

  return (
    <>
      <Section>
        <Card onClick={() => setOffen(true)}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xl font-semibold tracking-tight">Was wird daraus?</p>
              {vorschau && <p className="mt-0.5 truncate text-sm text-mute">{vorschau} …</p>}
            </div>
            <span className="shrink-0 text-sm text-faint">{alle.length}</span>
            <span className="shrink-0 text-faint">›</span>
          </div>
        </Card>
      </Section>

      {offen && (
        <Sheet title="Was wird daraus?" onClose={() => setOffen(false)}>
          {/* Der Shot steht oben, weil jede Menge im Blatt auf ihn
              gerechnet ist. Ohne diese Zeile stünden dort Zahlen, von
              denen man nicht weiß, woher sie kommen. */}
          <p className="text-sm text-mute">
            Gerechnet auf deinen Shot: {gramm(shot.doseG)} g → {gramm(shot.yieldG)} g
          </p>
          <div className="mt-4 space-y-5">
            {gruppiere(alle).map(([gruppe, zeilen]) => (
              <div key={gruppe}>
                <h4 className="text-2xs font-semibold tracking-wide text-faint uppercase">
                  {GRUPPENNAME[gruppe]}
                </h4>
                <div className="mt-1.5 space-y-1.5">
                  {zeilen.map((r) => (
                    <Card key={r.getraenk.id} onClick={() => setGewaehlt(r.getraenk)}>
                      <div className="flex items-baseline gap-3">
                        <p className="min-w-0 flex-1 truncate text-lg">{r.getraenk.name}</p>
                        <span className="shrink-0 text-sm text-mute">{num(r.gesamtG, 0)} g</span>
                        <span className="shrink-0 text-faint">›</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Sheet>
      )}

      {gewaehlt && (
        <Sheet title={gewaehlt.name} onClose={() => setGewaehlt(null)}>
          <Rezeptblatt r={rezept(gewaehlt, shot)} />
        </Sheet>
      )}
    </>
  )
}

function gruppiere(alle: Rezept[]): [Getraenk['category'], Rezept[]][] {
  const out: [Getraenk['category'], Rezept[]][] = []
  for (const r of alle) {
    const letzte = out[out.length - 1]
    if (letzte && letzte[0] === r.getraenk.category) letzte[1].push(r)
    else out.push([r.getraenk.category, [r]])
  }
  return out
}

/**
 * Ein Rezept, so wie man es abarbeitet.
 *
 * Erst was hineinkommt, dann in welcher Reihenfolge, dann was dabei zu
 * beachten ist. Die Mengen stehen groß, weil man sie beim Abwiegen aus
 * einem Meter Entfernung liest.
 */
function Rezeptblatt({ r }: { r: Rezept }) {
  const d = r.getraenk
  return (
    <div className="space-y-4">
      <div>
        <Zeile name="Espresso" menge={`${gramm(r.kaffeeG)} g`} />
        {r.zutaten.map((z, i) => (
          <Zeile
            key={i}
            name={ZUTATNAME[z.kind]}
            menge={`${gramm(z.massG)} g`}
            unten={[
              z.kind === 'milk' && r.milchEingiessenG !== undefined
                ? `${gramm(r.milchEingiessenG)} g eingießen`
                : null,
              z.tempC !== undefined ? `${z.tempC} °C` : null,
              z.foamClass ? SCHAUM[z.foamClass] : null,
              d.overrunPct !== undefined && z.kind === 'milk' ? `${d.overrunPct} % Overrun` : null,
              d.foamHeightCm !== undefined && z.kind === 'milk'
                ? `${num(d.foamHeightCm)} cm Schaum`
                : null,
              z.note ?? null,
            ]
              .filter(Boolean)
              .join(' · ')}
          />
        ))}
        <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
          <span className="text-lg font-semibold">Im Glas</span>
          <span className="text-lg font-semibold">{num(r.gesamtG, 0)} g</span>
        </div>
        <p className="mt-1 text-sm text-faint">
          Glas {d.glassMl[0]}–{d.glassMl[1]} ml
          {r.intensitaetPct !== undefined && ` · Stärke ${num(r.intensitaetPct, 2)} %`}
          {r.faktor !== 1 && ` · auf deinen Shot gerechnet`}
          {d.scalable === false && ` · feste Rezeptur`}
        </p>
      </div>

      {d.pourOrder && (
        <div className="border-t border-line pt-3">
          <p className="text-base">
            {d.pourOrder.map((t, i) => (
              <span key={t}>
                {i > 0 && <span className="text-faint"> → </span>}
                {GIESSNAME[t] ?? t}
              </span>
            ))}
          </p>
        </div>
      )}

      {(d.notes || d.technique || d.garnish) && (
        <div className="space-y-1.5 border-t border-line pt-3">
          {d.technique && <p className="text-base leading-snug">{d.technique}</p>}
          {d.notes && <p className="text-base leading-snug text-mute">{d.notes}</p>}
          {d.garnish && <p className="text-base leading-snug text-mute">Garnitur: {d.garnish}</p>}
        </div>
      )}

      {/* Die Hinweise stehen zuletzt und in Warnfarbe: Sie gelten nicht
          für das Getränk, sondern für diesen einen Shot. */}
      {r.hinweise.length > 0 && (
        <ul className="space-y-1.5 border-t border-line pt-3">
          {r.hinweise.map((h, i) => (
            <li key={i} className="text-base leading-snug text-warn">
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Zeile({ name, menge, unten }: { name: string; menge: string; unten?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <div className="min-w-0">
        <span className="text-lg">{name}</span>
        {unten && <span className="block text-sm leading-snug text-faint">{unten}</span>}
      </div>
      <span className="shrink-0 text-xl tabular-nums">{menge}</span>
    </div>
  )
}
