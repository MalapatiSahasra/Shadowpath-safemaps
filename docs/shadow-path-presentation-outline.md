# Shadow Path Presentation Outline

## Slide 1: Title

**Title:** Shadow Path: A Safety-Aware Route Recommendation System  
**Subtitle:** Using OpenStreetMap, streetlight data, and urban activity signals for safer night travel

**Speaker notes:** Introduce Shadow Path as a route planning project focused on night-shift workers, women, students, and other pedestrians who need better information than only the shortest path.

## Slide 2: Problem

**Main points:**

- Existing map apps focus on shortest or fastest routes.
- They usually do not show whether a road has working streetlights.
- They do not clearly show whether a road has active businesses or public presence at night.
- A shortest route may pass through dark, isolated, or low-activity areas.

**Speaker notes:** Explain that route safety is not only about distance. A user may prefer a longer route if it has better lighting, more open businesses, and stronger public visibility.

## Slide 3: Motivation

**Main points:**

- Night-shift workers often travel during low-traffic hours.
- Women and students may face higher anxiety when routes pass through isolated streets.
- City lighting and open-data records already exist but are not used in common route planning.
- Shadow Path turns available civic data into useful route guidance.

**Speaker notes:** Connect the motivation to real life: people leaving offices, hospitals, call centers, factories, hostels, libraries, or transit stations late at night.

## Slide 4: Existing System Limitations

**Main points:**

- Google Maps and similar systems prioritize time, distance, and traffic.
- Safety context is mostly absent or indirect.
- Streetlight coverage and maintenance status are not shown at route level.
- Users cannot easily compare “shortest” versus “better lit” routes.

**Speaker notes:** Be careful not to claim existing apps are wrong. The gap is that they solve a different problem: navigation efficiency, not safety-aware transparency.

## Slide 5: Proposed System

**Main points:**

- Shadow Path computes a safety score for each road segment.
- It combines OSM road data, municipal streetlights, business density, road type, and reports.
- It recommends routes with fewer dark and isolated segments.
- It explains route risk using map colors and segment details.

**Speaker notes:** Emphasize that the app does not guarantee safety. It gives more information so users can make better decisions.

## Slide 6: System Architecture

**Diagram content to show:**

```text
User App -> Route Request -> Routing Engine
                         -> Safety Scoring API
                         -> Geospatial Database
                         -> OSM + Streetlight + POI + Report Data
```

**Speaker notes:** Explain each block simply: the app asks for a route, the routing engine gives candidate paths, and the safety API enriches each route with lighting and activity data.

## Slide 7: Data Flow

**Main points:**

- Collect OSM roads and pedestrian paths.
- Import municipal streetlight locations and repair status.
- Import business/POI records and public-service locations.
- Snap lights and POIs to nearby route segments.
- Calculate scores and expose them through an API.

**Speaker notes:** Use “snap” to mean connecting a streetlight point to the nearest road segment. This is a common GIS step.

## Slide 8: Safety Score Formula

**Formula:**

```text
Safety Score =
  35% Lighting
+ 20% Business Activity
+ 15% Road Type
+ 10% Public Access
+ 10% User Reports
+ 10% Data Freshness
```

**Speaker notes:** Explain that these weights are a starting point. They can be adjusted after testing with real users and city data.

## Slide 9: Prototype UI

**Main points:**

- Map screen with source and destination.
- Route lines colored by safety score.
- Toggle: avoid unlit streets.
- Toggle: prefer business roads.
- Segment card showing lights, business activity, confidence, and last update.

**Speaker notes:** Mention that the current repository is a React/Vite prototype base. The next UI step is replacing the starter screen with the Shadow Path map interface.

## Slide 10: Evaluation Plan

**Main points:**

- Compare shortest route with Shadow Path route.
- Measure reduction in dark-segment distance.
- Measure increase in business-corridor coverage.
- Measure extra distance or time required.
- Collect user feedback about trust and usefulness.

**Speaker notes:** Give an example: if the safer route is 6% longer but reduces dark street exposure by 50%, many users may prefer it at night.

## Slide 11: Ethics and Privacy

**Main points:**

- Avoid storing exact travel history unless users opt in.
- Anonymize user reports.
- Show confidence and last updated date.
- Avoid false claims like “100% safe route.”
- Handle incident/crime data carefully to avoid bias.

**Speaker notes:** Safety apps must be responsible. The app should say “better lit” or “lower dark-segment exposure,” not promise that no incident can happen.

## Slide 12: Future Scope and Conclusion

**Main points:**

- Mobile app for Android and iOS.
- Emergency contact sharing with consent.
- Real-time alerts for saved commute routes.
- Offline route cache.
- Municipal dashboard for streetlight repair planning.

**Speaker notes:** Conclude that Shadow Path improves route awareness by combining open maps, civic data, and responsible user feedback.
