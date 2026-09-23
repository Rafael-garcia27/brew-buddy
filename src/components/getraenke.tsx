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
import { fuer, rezept, bruehrezept, GRUPPENNAME, ZUTATNAME, SCHAUM } from '@/engine/getraenke'
import type { Grundlage, Rezept } from '@/engine/getraenke'
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

export function Getraenkekarte({ basis }: { basis: Grundlage }) {
  const [offen, setOffen] = useState(false)
  const [gewaehlt, setGewaehlt] = useState<Getraenk | null>(null)
  const { titel, rezepte: alle } = fuer(basis)
  if (alle.length === 0) return null

  const ausShot = basis.method === 'espresso'

  // Die Vorschau nimmt die ersten Einträge in der Ordnung der Karte —
  // bei Espresso die Milchgetränke, sonst schlicht die ersten drei.
  // Welche das sind, entscheidet die Datei und nicht diese hier.
  const vorschau = (ausShot ? alle.filter((r) => r.getraenk.category === 'milk') : alle)
    .slice(0, 3)
    .map((r) => r.getraenk.name)
    .join(', ')

  return (
    <>
      <Section>
        <Card onClick={() => setOffen(true)}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xl font-semibold tracking-tight">{titel}</p>
              {vorschau && <p className="mt-0.5 truncate text-sm text-mute">{vorschau} …</p>}
            </div>
            <span className="shrink-0 text-sm text-faint">{alle.length}</span>
            <span className="shrink-0 text-faint">›</span>
          </div>
        </Card>
      </Section>

      {offen && (
        <Sheet title={titel} onClose={() => setOffen(false)}>
          {/* Woher die Zahlen kommen, steht oben. Bei Espresso sind sie
              auf den Durchgang gerechnet, sonst stehen sie so da, wie
              die Wissensbasis sie führt — ohne diese Zeile müsste man
              raten, welches von beidem gilt. */}
          <p className="text-sm text-mute">
            {ausShot
              ? `Gerechnet auf deinen Shot: ${gramm(basis.doseG)} g → ${gramm(basis.yieldG)} g`
              : 'Eigene Rezepturen — die Mengen stehen für sich, nicht für deinen letzten Durchgang.'}
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
          <Rezeptblatt
            r={ausShot ? rezept(gewaehlt, basis) : bruehrezept(gewaehlt, basis.roastLevel)}
          />
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
      {r.sorte === 'eigene-bruehung' ? <Bruehteil r={r} /> : <Glasteil r={r} />}

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

/**
 * Was ins Glas kommt — bei allem, was aus einem fertigen Shot entsteht.
 */
function Glasteil({ r }: { r: Rezept }) {
  const d = r.getraenk
  return (
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
  )
}

/**
 * Was in die Kanne kommt — bei einer eigenen Brühung.
 *
 * Andere Zahlen, andere Reihenfolge: Hier steht nicht, was man
 * zusammenschüttet, sondern was man einwiegt, wie fein, wie heiß und wie
 * lange. Die Wissensbasis führt das als Abweichung vom Normalfall
 * („1 Schritt feiner"), und genau so steht es auch hier — eine absolute
 * Mikrometerzahl wäre für die eigene Mühle ohnehin falsch.
 */
function Bruehteil({ r }: { r: Rezept }) {
  const d = r.getraenk
  const stunden = d.steepHours ? `${d.steepHours[0]}–${d.steepHours[1]} h` : null
  return (
    <div>
      {r.einwaageG !== undefined && (
        <Zeile
          name="Einwaage"
          menge={`${gramm(r.einwaageG)} g`}
          unten={`1:${num(d.baseRatio, Number.isInteger(d.baseRatio) ? 0 : 1)}`}
        />
      )}
      {r.wasserG !== undefined && (
        <Zeile
          name="Wasser"
          menge={`${gramm(r.wasserG)} g`}
          {...(r.eisG !== undefined && r.heissWasserG !== undefined
            ? { unten: `${gramm(r.heissWasserG)} g heiß aufgießen · ${gramm(r.eisG)} g Eis in die Kanne` }
            : {})}
        />
      )}
      {d.grindOffset !== undefined && d.grindOffset !== 0 && (
        <Zeile name="Mahlgrad" menge={mahlgrad(d.grindOffset)} />
      )}
      {d.tempOffset !== undefined && d.tempOffset !== 0 && (
        <Zeile
          name="Temperatur"
          menge={`${d.tempOffset > 0 ? '+' : ''}${d.tempOffset} °C`}
          unten={d.tempOffset > 0 ? 'heißer als sonst' : 'kühler als sonst'}
        />
      )}
      {stunden && (
        <Zeile
          name="Ziehzeit"
          menge={stunden}
          {...(d.steepTempC !== undefined ? { unten: `bei ${d.steepTempC} °C` } : {})}
        />
      )}

      <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2">
        <span className="text-lg font-semibold">Ergebnis</span>
        <span className="text-lg font-semibold">{num(r.gesamtG, 0)} g</span>
      </div>
      {/* Zusammengesetzt statt aneinandergehängt: Cold Brew hat weder
          Glas noch Stärkeangabe, und drei einzeln bedingte Fragmente
          hätten dort einen führenden Trenner stehen lassen. */}
      <p className="mt-1 text-sm text-faint">
        {[
          d.glassMl ? `Glas ${d.glassMl[0]}–${d.glassMl[1]} ml` : null,
          r.intensitaetPct !== undefined ? `Stärke ${num(r.intensitaetPct, 2)} %` : null,
          d.expectedTdsPct !== undefined ? `Konzentrat, TDS ≈ ${num(d.expectedTdsPct)} %` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {(d.dilutionRatio !== undefined || d.shelfLifeDays !== undefined) && (
        <p className="mt-2 border-t border-line pt-2 text-base leading-snug text-mute">
          {d.dilutionRatio !== undefined &&
            `Verdünnen: 1 Teil auf ${num(d.dilutionRatio)} Teile Wasser oder Milch. `}
          {d.shelfLifeDays !== undefined && `Hält ${d.shelfLifeDays} Tage gekühlt.`}
        </p>
      )}
    </div>
  )
}

/** „1 Schritt feiner" statt einer Mikrometerzahl, die nur für fremde Mühlen gilt. */
function mahlgrad(offset: number): string {
  const n = Math.abs(offset)
  return `${n} ${n === 1 ? 'Schritt' : 'Schritte'} ${offset < 0 ? 'feiner' : 'gröber'}`
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
