Umschalter für 2–5 Optionen; mit Symbolen ab vier Segmenten.

```jsx
<SegmentedControl value={m} onChange={setM} options={[
  { value: 'espresso', label: 'Espresso', icon: <MethodIcon icon="espresso" size={22} /> },
  { value: 'v60', label: 'V60', icon: <MethodIcon icon="v60" size={22} /> },
]} />
```

Ohne Symbol 44 px hoch, mit Symbol 52 px (Symbol über 11-px-Beschriftung).
