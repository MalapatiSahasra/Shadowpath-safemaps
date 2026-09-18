# Shadow Path: A Safety-Aware Route Recommendation System for Night-Time Pedestrian Navigation Using OpenStreetMap, Streetlight Data, and Urban Activity Signals

---

**Malapati Sahasra¹ and Pradeeba V²**

¹˒² *Department of AI and Emerging Technologies*  
*Chinmaya Vishwavidyapeeth Deemed-to-be University*  
*Ernakulam, India*  
malapati.cvv241195@cvv.ac.in (corresponding author)

---

> *Submitted to: 3rd International Conference on Innovation in Science, Engineering & Technology (ISET-2026)*  
> *Organized by: Department of Electrical Engineering, Geetanjali Institute of Technical Studies (GITS), Udaipur*  
> *Conference Dates: 23–24 October 2026 | Mode: Hybrid*

---

## ABSTRACT

Urban navigation applications typically optimize routes for distance, travel time, and traffic conditions without regard to the pedestrian safety context of those routes — particularly at night. This gap disproportionately affects night-shift workers, women, students, and other late-night pedestrians who may rationally prefer a slightly longer route if it avoids poorly illuminated or socially isolated street segments. This paper presents **Shadow Path**, a safety-aware route recommendation system that integrates OpenStreetMap (OSM) road-network data with municipal streetlight records, point-of-interest (POI) business-activity signals, civic infrastructure data, time-of-day context, and community-sourced user reports. A weighted, segment-level safety scoring model is proposed, and a React/Vite prototype interface demonstrates how scored route overlays, dark-segment warnings, and transparency indicators can be surfaced to end users. The system's design philosophy rejects the notion of a "safe" label in favor of quantified route transparency: showing dark-segment distance, business-corridor exposure, data freshness, and confidence indicators so that pedestrians can make genuinely informed route choices. Evaluation methodology using route comparison, dark-distance reduction, business-corridor coverage, and user-perception surveys is outlined. The contribution is a practical, open-data-driven framework that can inform smart-city safety infrastructure and expand access to safety-aware navigation for underserved pedestrian populations.

**Keywords:** safe routing, women safety, night-shift workers, OpenStreetMap, street lighting, GIS, smart city, urban mobility, route recommendation, pedestrian navigation, public safety, civic data

___

## INTRODUCTION

Digital maps have become an indispensable tool for urban commuters, gig workers, students, and pedestrians. Mainstream navigation platforms such as Google Maps, Apple Maps, and HERE Maps prioritize shortest distance, fastest arrival time, real-time traffic, and turn-by-turn accuracy. These are valuable optimizations for most use cases, but they are systematically incomplete for late-night pedestrian movement.

A shortest-path route may traverse isolated lanes, poorly maintained footpaths, dark residential alleys, closed market corridors, or areas with minimal pedestrian presence at night. For a nurse returning from a hospital on a night shift, a student leaving a library after midnight, or a woman traveling home from work, these route characteristics are not incidental — they materially shape perceived safety, anxiety, and willingness to commute independently.

**Shadow Path** addresses this gap by reconceptualizing a route as a sequence of street segments, each carrying safety-relevant urban signals alongside navigational geometry. Every segment is evaluated using: the density and condition of streetlights; the density of nearby active businesses and services; road classification and pedestrian infrastructure; proximity to public-access nodes such as bus stops, police stations, hospitals, and CCTV zones; community-sourced reports of broken lights or unsafe conditions; and the freshness of the underlying data. The system then presents route candidates ranked by a combined cost that balances travel distance against segment-level safety scores, with a transparent, per-segment explanation of each route's characteristics.

Critically, Shadow Path makes no claim to guarantee safety. Its contribution is informational transparency: providing pedestrians with the data they need to make an informed choice, rather than blind trust in the shortest path.

The system is designed around open and civic data ecosystems. OpenStreetMap (OSM) provides a flexible, globally available road network and map base. Municipal corporations and government open-data portals can supply streetlight inventories, CCTV zone boundaries, public transport schedules, and road maintenance records. POI and business-activity layers are derivable from OSM amenity tags or approved third-party datasets. Together, these sources form a practical foundation for a safety-aware navigation system that does not depend on proprietary or commercially sensitive data.

---

## PROBLEM STATEMENT

Standard navigation applications answer the question: *"Which route is shortest or fastest?"* Shadow Path answers an additional question: *"Which route is more appropriate for traveling at night?"*

The problem is structural: safety-relevant urban data exists across multiple disconnected systems. Streetlight inventories reside with municipal engineering departments. Business-activity and POI data reside in map platforms. Road-network geometry resides in OSM or government GIS portals. Accident and crime records reside with police and traffic authorities. Standard route planners do not integrate these layers into route scoring or recommendations.

As a consequence, pedestrians planning a nighttime commute must manually cross-reference mental maps of well-lit roads, recall which streets feel active, and make decisions based on experience or intuition rather than data. This burden falls unequally on populations with higher safety concerns, including women, night-shift workers, and residents unfamiliar with a new city.

The core research problem is: *How can a system integrate geospatial route data with street-lighting and urban-activity signals, compute a principled segment-level safety score, and present safer route alternatives responsibly — without overstating certainty or introducing data bias?*

---

## OBJECTIVES

The specific objectives of Shadow Path are:

1. Identify road and pedestrian segments that are poorly lit or have low nighttime activity levels.
2. Recommend routes that minimize exposure to dark or isolated segments, even if such routes are marginally longer.
3. Leverage OpenStreetMap, municipal lighting records, and government open-data sources as primary inputs, minimizing reliance on proprietary datasets.
4. Provide route transparency through segment-level explanations, data-confidence indicators, and freshness timestamps.
5. Enable community participation via anonymized user reports of broken streetlights, unsafe road conditions, or positive route experiences.
6. Design an architecture that can scale from a single-city prototype to a generalizable smart-city safety-navigation framework.
7. Maintain strict privacy-by-design principles: avoid storing individual travel history and ensure that reporting mechanisms cannot be weaponized for surveillance or targeted harm.

---

## LITERATURE REVIEW

### OpenStreetMap and Geospatial Routing

OpenStreetMap is the primary free, openly licensed global street-map dataset [1]. OSM represents geographic features through nodes (points), ways (ordered lists of nodes), relations (grouped features), and tags (key-value metadata). Tags relevant to Shadow Path include `highway=*` for road classification, `lit=yes/no/limited` for reported lighting, `highway=street_lamp` for mapped lamp positions, `foot=yes/no` and `sidewalk=*` for pedestrian access, and `amenity=*` and `shop=*` for business and service presence.

Routing engines built on OSM data include OSRM [2], Valhalla [3], and GraphHopper. Of these, Valhalla is particularly relevant because it supports dynamic costing — the ability to introduce custom cost functions that penalize road segments based on configurable criteria [3]. OSMnx [4] provides a Python-based framework for downloading, building, analyzing, and visualizing OSM street networks as directed graphs, enabling network-level analysis of pedestrian infrastructure. Haklay and Weber [9] provide foundational analysis of OSM's collaborative model and coverage characteristics.

### Street Lighting and Urban Safety

Street lighting is among the most empirically studied environmental determinants of pedestrian safety. Welsh and Farrington's systematic review of controlled trials reports that improved public lighting is associated with significant reductions in nighttime crime in public spaces [5]. Mechanisms include improved natural surveillance, reduced opportunities for criminal concealment, and increased community confidence in public spaces. Chalfin et al. provide quasi-experimental evidence from New York City public housing developments showing reductions in nighttime outdoor crime index after temporary lighting augmentation [6]. Kim et al. examine criteria for advanced streetlight design that balances energy efficiency with uniform illumination and pedestrian comfort [7].

These findings establish a clear empirical basis for incorporating streetlight density and quality as a primary safety signal in route scoring.

### Women's Safety and Participatory GIS

Research on gender and urban mobility documents that perceived safety — not only measured crime — significantly determines women's use of public space, route choices, and willingness to travel alone at night. Gargiulo et al. demonstrate that qualitative GIS methods can integrate women's subjective safety perceptions with physical environmental factors to produce composite safety maps, enabling more socially responsive urban planning [8]. This supports Shadow Path's inclusion of both objective physical signals (streetlights, road type) and subjective community reporting (user-submitted safety assessments) in its scoring model. Iqbal et al. [10] further demonstrate the applicability of smart-technology approaches to women's personal safety, establishing the feasibility of IoT and machine-learning integration in safety applications.

### Gap in Existing Navigation Systems

Despite the technical maturity of OSM-based routing and the established evidence base for environmental safety correlates, no mainstream navigation application currently integrates streetlight data, business-activity density, or civic infrastructure proximity into pedestrian route recommendations at the segment level. The closest equivalents are crime-map overlays and women's safety apps, but these do not integrate with routing engines to suggest alternative paths. Shadow Path's contribution is to bridge this gap: operationalizing known safety correlates into a live, route-level scoring and recommendation system.

---

## PROPOSED SYSTEM OVERVIEW

Shadow Path is a safety-aware route recommendation application targeting pedestrians during low-light hours. The interaction model is straightforward: the user enters a source and destination. The system retrieves one or more candidate routes from an OSM-based routing engine, evaluates each route at the segment level using safety data layers, computes a weighted safety score, and presents the safest practical option alongside the shortest option — with per-segment explanations.

The system explicitly avoids binary safety labels. Route feedback is framed comparatively and factually: *"This route has 18% better lighting coverage,"* *"This route avoids 340 meters of unlit segments,"* or *"72% of this route passes active business corridors."* This responsible framing is essential because real-world safety is a complex, multifactorial phenomenon that no map system can fully capture.

---

## SYSTEM ARCHITECTURE

The Shadow Path architecture comprises five primary layers, as illustrated in Fig. 1.

**Fig.1** Shadow Path System Architecture

**Client Application:** A web interface (React/Vite prototype) where users search routes, view color-coded safety overlays, toggle preferences (e.g., "avoid unlit streets"), compare route alternatives, and submit anonymized reports.

**Routing Service:** An OSM-based routing engine (OSRM or Valhalla) generates candidate paths. Valhalla's dynamic costing interface allows safety penalties to be incorporated natively into path generation rather than applied as a post-processing filter.

**Geospatial Database:** A PostGIS instance stores OSM way geometries, streetlight points, POI and business records, civic-infrastructure nodes (bus stops, police stations, hospitals), user report entries, and computed segment scores.

**ETL Pipeline:** Scheduled ingestion jobs download OSM data extracts (e.g., via Overpass API or Geofabrik), import municipal lighting GeoJSON/CSV exports, ingest government open-data feeds, and refresh segment scores on a configurable schedule.

**Safety Scoring API:** A backend service accepts route geometry, queries the geospatial database for safety signals along each segment, computes scores, and returns route metadata including per-segment scores, dark-segment flags, data freshness, and confidence levels.

---

## DATA SOURCES

Table 1 summarizes the data sources and their contributions to the Shadow Path scoring model.

**Table 1. Data Sources for Shadow Path**

| Data Source | Type | Contribution to Scoring |
|---|---|---|
| OpenStreetMap | Road network, POI, lighting tags | Route geometry, road classification, amenity density, `lit` tag |
| Municipal streetlight inventory | Point dataset (GeoJSON / CSV) | Light positions, maintenance status, lamp type, inspection date |
| Government open data (civic) | Point / polygon / line datasets | Police stations, CCTV zones, bus stops, hospitals, public toilets, accident zones |
| Business / POI data | Point dataset | Shops, pharmacies, restaurants, fuel stations, 24-hour services |
| User reports | Structured form submissions | Broken lights, unsafe segments, positive route feedback |

Priority is given to verified official datasets (municipal and government) as ground truth. OSM tags are used as supplementary or fallback data with appropriate confidence discounting. User reports require moderation before influencing segment scores.

---

## METHODOLOGY

The Shadow Path methodology proceeds through six stages:

**Stage 1 — Data Collection:** Download OSM road-network and POI data for the target city using the Overpass API or Geofabrik regional extracts. Acquire municipal streetlight records and government open-data exports (CCTV, police stations, bus stops, public-access facilities).

**Stage 2 — Preprocessing:** Deduplicate records across datasets. Reproject all geometries to a common coordinate reference system (WGS 84 / EPSG:4326 for storage; a local UTM projection for distance calculations). Validate and repair invalid geometries. Standardize attribute schemas for each data type.

**Stage 3 — Spatial Matching:** Snap streetlight points and POI records to the nearest OSM road segments using distance-threshold nearest-neighbor spatial joins. A typical threshold for streetlight snapping is 20–30 meters; for POI influence, a buffer radius (e.g., 50 meters for businesses, 100 meters for public services) is used.

**Stage 4 — Feature Extraction:** For each route segment, compute:
- **Light density:** number of streetlights per 100 meters.
- **Maximum dark gap:** longest continuous stretch (meters) with no streetlight within snapping threshold.
- **Business density:** number of active businesses within 50-meter buffer.
- **Road type category:** classified by OSM `highway=*` tag into tiers.
- **Public access proximity:** distance-weighted presence of civic nodes within 100 meters.
- **Report score:** aggregated count of verified positive and negative community reports.
- **Data freshness:** recency of most recent official data update, expressed as a decay factor.

**Stage 5 — Safety Scoring:** Apply the weighted scoring model (Section IX) to compute a normalized segment safety score (0–100).

**Stage 6 — Route Recommendation:** For a given source-destination pair, retrieve *N* candidate routes. Compute the average segment safety score for each route. Rank routes using the combined cost function (Section IX). Present the top two or three routes with comparative metrics.

---

## SAFETY SCORING MODEL

### Segment Safety Score

Each road segment *s* receives a composite safety score *S(s)* computed as:

**Equation (1):**

> *S*(*s*) = 0.35 · *L*(*s*) + 0.20 · *B*(*s*) + 0.15 · *R*(*s*) + 0.10 · *P*(*s*) + 0.10 · *U*(*s*) + 0.10 · *F*(*s*)

**Table 2. Scoring Components**

| Symbol | Component | Description |
|---|---|---|
| *L(s)* | Lighting Score | Normalized light density and dark-gap measure (0–100) |
| *B(s)* | Business Activity Score | Normalized business density near segment, time-of-day weighted |
| *R(s)* | Road Type Score | Score based on OSM highway classification tier |
| *P(s)* | Public Access Score | Proximity to bus stops, police stations, hospitals, CCTV nodes |
| *U(s)* | User Report Score | Aggregated verified community feedback (positive raises, negative lowers) |
| *F(s)* | Data Freshness Score | Exponential decay from date of last verified data update |

**Lighting Score:** *L(s)* = 100 − (dark_gap_meters / segment_length_meters) × 100, further adjusted by lights-per-100m density. A segment with no dark gaps and high light density scores 100; a completely unlit segment scores 0.

**Business Activity Score:** *B(s)* uses a time-of-day multiplier. Business density carries higher weight between 20:00 and 23:00 (evening activity) and lower weight after 00:00 (most businesses closed). The score is discounted for businesses with unconfirmed nighttime operating hours.

**Road Type Score:** OSM `highway=*` values are mapped to score tiers. Primary and secondary roads with footpaths score highest (~80–100); residential roads with confirmed lighting score moderately (~50–70); service roads, alleys, and unmapped paths score lowest (~10–30).

**Data Freshness Score:**

**Equation (2):**

> *F*(*s*) = 100 × *e*^(−*λ* × *d*_update)

where *λ* is a decay constant (e.g., *λ* = 0.005, giving a half-life of approximately 139 days) and *d*_update is the number of days since the last verified data update. This ensures that outdated or unverified data is not treated with the same confidence as recently inspected records.

### Route Cost and Ranking

For a route *r* composed of segments {s₁, s₂, …, sₙ}:

**Equation (3):**

> *S̄*(*r*) = (1/*n*) × Σᵢ₌₁ⁿ *S*(*sᵢ*)

**Equation (4):**

> *C*(*r*) = *D*(*r*) + *P*_safety(*r*)

**Equation (5):**

> *P*_safety(*r*) = (100 − *S̄*(*r*)) × *w*_safety

where *w*_safety is a user-adjustable weight (default = 1.5). This allows a user to accept a route that is, for example, 8% longer in distance if it improves the average safety score by 30 points — a tradeoff that many late-night pedestrians would accept.

---

## PROTOTYPE IMPLEMENTATION

The current Shadow Path repository is a React/Vite web application scaffold. The planned interface extension replaces the starter screen with the following components:

- **Route search panel:** Text input fields for source and destination, with geocoding via Nominatim or a compatible OSM service.
- **Map view:** MapLibre GL-based interactive map with OpenStreetMap base tiles.
- **Route overlays:** Polylines color-coded by safety score — green (score ≥ 70), amber (40–69), and red (< 40) — enabling at-a-glance identification of dark zones.
- **Route comparison panel:** Side-by-side metrics for the shortest route and the Shadow Path recommended route: distance, estimated walk time, average safety score, dark-segment distance, business-corridor coverage, and data confidence.
- **User preference toggles:** "Avoid unlit streets," "Prefer business corridors," "Maximize public-access proximity."
- **Segment detail card:** On-click panel showing per-segment light density, business density, public-access score, confidence level, and last data-update timestamp.
- **Report module:** Anonymous, rate-limited form for submitting reports of broken streetlights, blocked footpaths, or unsafe conditions, with a moderation workflow before score integration.

The development stack uses React 18, Vite 5, and MapLibre GL JS for the client, with a planned Node.js/Express backend, PostGIS geospatial database, and OSRM or Valhalla routing engine.

---

## EVALUATION PLAN

Shadow Path will be evaluated along three dimensions: technical route metrics, data-quality assessment, and user-perception research.

### Route Comparison Metrics

For a set of test source-destination pairs in a target city:

**Table 3. Proposed Evaluation Metrics**

| Metric | Definition |
|---|---|
| Average Route Safety Score | Mean *S(s)* across all segments of recommended route |
| Dark-Segment Distance Reduction | Meters of unlit segment in shortest route minus meters in Shadow Path route |
| Business-Corridor Coverage | Percentage of route within 50 m of active business or service POI |
| Route-Length Tradeoff | Percentage distance increase of Shadow Path route over shortest route |
| Report Accuracy Rate | Percentage of community reports confirmed by official inspection or moderation |
| Data Freshness Coverage | Percentage of route covered by data updated within 180 days |

A positive evaluation outcome would demonstrate meaningful dark-segment reduction (e.g., ≥30%) with a modest distance penalty (e.g., ≤10%).

### User-Perception Research

A structured survey administered to night-shift workers, women commuters, and students will assess:
- Perceived usefulness of safety-score overlays.
- Trust in route safety explanations and confidence indicators.
- Willingness to adopt a longer route given quantified safety improvements.
- Suggestions for additional data sources or interface features.

---

## ETHICAL AND PRIVACY CONSIDERATIONS

Shadow Path handles movement and safety data for vulnerable populations, imposing strict design obligations:

1. **No persistent travel history:** Individual route queries are not stored beyond the immediate session. Aggregate, anonymized route-demand statistics may be retained for urban planning purposes only under explicit institutional oversight.
2. **Anonymized reporting:** User reports capture only segment identifiers and coarse timestamps. No device identifiers, IP addresses, or user accounts are required for basic reporting.
3. **Responsible safety framing:** The interface language avoids absolute safety claims. Comparative, evidence-grounded statements (e.g., "this route reduces dark-segment exposure by 40%") replace qualitative labels such as "safe" or "unsafe."
4. **Bias avoidance in data selection:** Crime incident data is explicitly excluded from the initial scoring model because police-report datasets reflect enforcement patterns and reporting behavior rather than uniform risk. The initial model restricts inputs to physical infrastructure signals (lighting, road type, civic access) and community-moderated reports.
5. **Report moderation:** Community reports are reviewed before influencing segment scores to prevent targeted sabotage, spam, or false reporting.
6. **Open-data transparency:** All primary data sources are publicly available or officially provided. Users can request information about the data underlying any route recommendation.

---

## LIMITATIONS

1. **Municipal data availability:** Streetlight inventories, maintenance records, and CCTV zone data may be incomplete, proprietary, or unavailable in many Indian cities. OSM `lit` tags provide a fallback but with lower reliability.
2. **OSM coverage heterogeneity:** OSM data quality varies significantly between cities. Well-mapped urban centers will yield better segment-level accuracy than smaller cities with sparse mapping activity.
3. **Business-hours uncertainty:** POI data does not reliably capture actual nighttime operating hours, introducing uncertainty that must be reflected in confidence scores.
4. **GPS drift:** Pedestrian GPS accuracy on commodity smartphones can deviate 5–15 meters, which may affect segment-level safety-score attribution in dense urban areas with narrow lanes.
5. **Score ceiling:** A high safety score cannot substitute for real-world safety. The system provides informational transparency, not physical protection.
6. **City-specific weight calibration:** The scoring weights are initial estimates derived from literature; they require empirical validation for each deployment city.
7. **Report moderation overhead:** Scaling user-report moderation across multiple cities and high report volumes requires automated pre-filtering and community-moderator infrastructure.

---

## FUTURE SCOPE

Near-term extensions include:
- Native Android and iOS mobile applications using React Native.
- Real-time push alerts for route conditions on saved commute routes.
- Offline route caching for last-mile navigation in low-connectivity areas.
- Integration with city public-transport APIs for full door-to-door journey planning incorporating last-mile walking safety.

Medium-term extensions include:
- Emergency-contact integration with location-sharing and consent-controlled check-in alerts.
- A municipal operations dashboard surfacing streetlight repair priorities derived from aggregated dark-segment data and community reports.
- Machine-learning models that learn city-specific scoring weight calibrations from validated user feedback and historical incident data.

Long-term research directions include:
- Longitudinal evaluation of whether Shadow Path route adoption correlates with measurable improvements in pedestrian safety outcomes.
- Integration of ambient environmental sensing (pedestrian density estimation from mobile sensor fusion) as supplementary safety signals.
- Generalization of the safety-scoring framework as a standardized open API that third-party navigation applications can consume.

---

## CONCLUSION

Urban navigation applications have reached a high level of efficiency in optimizing for distance and travel time, but they remain largely silent on the safety-relevant characteristics of routes for nighttime pedestrian travelers. This silence disproportionately affects women, night-shift workers, students, and residents unfamiliar with a city's street-level environment after dark.

Shadow Path proposes a practical, open-data-driven remedy. By integrating OpenStreetMap road-network data with municipal streetlight records, POI business-activity signals, civic infrastructure proximity, and community-sourced reports into a weighted segment-level safety scoring model, the system enables route comparison that goes beyond shortest distance. Its value proposition is informational transparency: helping users understand *why* one route may be more appropriate than another for late-night walking, and empowering them to make genuinely informed choices.

The system's architecture is modular, relying on established open-source components (OSM, PostGIS, OSRM/Valhalla, MapLibre GL, React/Vite) and civic data sources, which lowers adoption barriers for civic technologists and municipal bodies. The privacy-by-design approach and responsible safety framing position Shadow Path as an ethically grounded contribution to the growing field of smart-city urban mobility tools.

Future work will focus on validating the scoring model against real city data, conducting user-perception research with target populations, and developing the municipal-dashboard module to create a feedback loop between community reports and city infrastructure maintenance. Shadow Path represents a step toward an urban mobility ecosystem in which safety transparency is treated as a first-class navigation attribute alongside speed and distance.

---

## ACKNOWLEDGEMENTS

The authors gratefully acknowledge the support of the Department of AI and Emerging Technologies, Chinmaya Vishwavidyapeeth Deemed-to-be University, Ernakulam, for providing the resources and guidance necessary for this research.

---

## REFERENCES

[1] OpenStreetMap Wiki, Map features, OpenStreetMap Foundation. [Online]. Available: https://wiki.openstreetmap.org/wiki/Map_features

[2] Project OSRM, Open Source Routing Machine, GitHub. [Online]. Available: https://github.com/Project-OSRM/osrm-backend

[3] Valhalla, Valhalla Docs: Introduction for Users, Valhalla Project. [Online]. Available: https://valhalla.github.io/valhalla/valhalla-intro/

[4] G Boeing, OSMnx: New methods for acquiring, constructing, analyzing, and visualizing complex street networks, *Computers, Environment and Urban Systems*, **2017**, 65, 126–139.

[5] BC Welsh and DP Farrington, Effects of Improved Street Lighting on Crime, *Campbell Systematic Reviews*, **2008**, 4(1), 1–51.

[6] A Chalfin, B Hansen, J Lerner, and L Parker, Reducing Crime Through Environmental Design: Evidence from a Randomized Experiment of Street Lighting in New York City, *Journal of Quantitative Criminology*, **2022**, 38, 127–157.

[7] KH Kim, T Hwang, and G Kim, The Role and Criteria of Advanced Street Lighting to Enhance Urban Safety in South Korea, *Buildings*, **2024**, 14(8), 2305.

[8] I Gargiulo, X Garcia, M Benages Albert, J Martinez, K Pfeffer, and P Vall-Casas, Women's safety perception assessment in an urban stream corridor: Developing a safety map based on qualitative GIS, *Landscape and Urban Planning*, **2020**, 198, 103779.

[9] M Haklay and P Weber, OpenStreetMap: User-Generated Street Maps, *IEEE Pervasive Computing*, **2008**, 7(4), 12–18.

[10] ST Iqbal, SMS Kaiser, N Hoque, and MZ Islam, Smart women safety application using machine learning and IoT, *Journal of Ambient Intelligence and Humanized Computing*, **2023**, 14, 7729–7745.

---

*Submitted for peer review at ISET-2026, 3rd International Conference on Innovation in Science, Engineering & Technology, Geetanjali Institute of Technical Studies (GITS), Udaipur, 23–24 October 2026.*
