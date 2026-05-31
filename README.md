# Shadow Path

Shadow Path is a prototype for a safety-aware route recommendation app for night-shift workers, women, students, and pedestrians who travel during low-light hours. The project idea is to combine OpenStreetMap route data with streetlight records, business activity, civic infrastructure, and user reports so routes can be compared by safety-related context, not only by distance or travel time.

## Research Documents

- [Research Paper Draft](./docs/shadow-path-research-paper.md)
- [Presentation Outline](./docs/shadow-path-presentation-outline.md)

## Current App

This repository currently contains a React + Vite starter app. The next implementation step is to replace the starter screen with a Shadow Path map interface that can display route overlays, safety scores, dark-segment warnings, and reporting controls.

## Development

Install dependencies:

```bash
npm install
```

Run the app locally:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

## Planned Features

- Search source and destination.
- Display route options on a map.
- Highlight road segments by safety score.
- Prefer well-lit roads and active business corridors.
- Show data freshness and confidence indicators.
- Allow users to report broken lights or unsafe areas.
