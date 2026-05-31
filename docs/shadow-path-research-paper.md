# Shadow Path: A Safety-Aware Route Recommendation System Using OpenStreetMap, Streetlight Data, and Urban Activity Signals

## Abstract

Urban navigation applications usually optimize for distance, travel time, and traffic conditions, but they rarely explain whether a walking route is well lit, socially active, or suitable for people travelling late at night. This limitation is important for night-shift workers, women, students, and other pedestrians who may prefer a slightly longer route if it avoids isolated or poorly illuminated streets. **Shadow Path** proposes a safety-aware route recommendation system that combines OpenStreetMap road-network data, municipal streetlight records, business and point-of-interest activity, time-of-day context, and user feedback. The system assigns a segment-level safety score to each road or pedestrian path and uses that score to compare shortest routes with safer alternatives. The proposed architecture includes a client map interface, geospatial backend, routing engine, data ingestion pipeline, and reporting module. The expected contribution is not to claim guaranteed safety, but to increase route transparency by showing dark stretches, inactive corridors, and low-confidence data before a user begins travel. Evaluation can compare baseline shortest routes with Shadow Path routes using metrics such as average lighting coverage, dark-segment distance, business-density exposure, and route-length tradeoff.

## Keywords

Safe routing, women safety, night-shift workers, OpenStreetMap, street lighting, GIS, smart city, urban mobility, route recommendation, public safety.

## I. Introduction

Digital maps have become a daily tool for commuters, delivery workers, students, and pedestrians. Most popular navigation systems focus on shortest distance, fastest arrival time, traffic congestion, and turn-by-turn accuracy. These criteria are useful, but they are incomplete for late-night pedestrian movement. A shortest route can pass through isolated lanes, poorly lit roads, closed market areas, or streets with low pedestrian presence. For night-shift workers and women returning from work, these missing route characteristics can create uncertainty and fear.

Shadow Path addresses this gap by treating a route as more than a line between source and destination. Each road segment is evaluated using safety-related urban signals: presence of streetlights, density of nearby businesses, type of road, freshness of data, time of day, and optional community reports. The application then presents a safer route recommendation and explains why a route is safer or riskier. This helps the user make an informed choice instead of blindly trusting the shortest path.

The project is designed around open and civic data. OpenStreetMap provides a flexible base map and road network. Municipal corporations and government open-data portals can provide streetlight points, asset maintenance status, CCTV zones, public transport stops, and road infrastructure information. Business activity can be estimated from mapped points of interest, commercial land-use tags, or approved third-party datasets. Together, these data sources create a practical foundation for a safety-aware navigation system.

## II. Problem Statement

Existing navigation applications usually answer the question: “Which route is shortest or fastest?” Shadow Path answers an additional question: “Which route is more suitable for travelling at night?” The problem is that safety-related route information is fragmented across multiple systems. Streetlight records may exist with municipal bodies, business activity may exist in map or POI datasets, and road networks may exist in OSM, but standard route planners do not combine these layers into route recommendations.

The core research problem is to design a system that can integrate geospatial route data with lighting and urban activity signals, compute a safety score for each route segment, and present safer alternatives in a clear and responsible way.

## III. Objectives

- Identify road and pedestrian segments that are poorly lit or have low nighttime activity.
- Recommend routes that reduce exposure to dark or isolated segments, even if they are slightly longer.
- Use OpenStreetMap, municipal lighting data, and government/open-data sources wherever possible.
- Provide route transparency through segment-level explanations, confidence indicators, and data freshness.
- Support user reports such as “streetlight not working” or “area feels unsafe” without exposing personal travel history.
- Create an architecture that can be expanded from a city-level prototype into a scalable smart-city system.

## IV. Literature Review

OpenStreetMap is widely used for geospatial research because it represents roads, paths, buildings, and amenities through nodes, ways, relations, and tags. OSM tags such as `highway=*`, `lit=yes/no`, and `highway=street_lamp` can support analysis of pedestrian infrastructure and lighting conditions [1]. However, OSM coverage varies by city, so municipal and official datasets are still needed for more reliable streetlight inventories.

Routing engines such as OSRM and Valhalla use OSM road-network data to compute routes efficiently [2], [3]. Valhalla also supports dynamic costing, which is relevant for Shadow Path because safety can be introduced as an additional route cost rather than only as a visual overlay [3]. OSMnx is another important tool for downloading, constructing, analyzing, and visualizing street networks from OSM data [4]. These systems show that OSM-based routing is technically feasible, but they do not directly solve the social question of nighttime safety.

Street lighting has been studied as part of urban safety and Crime Prevention Through Environmental Design. Welsh and Farrington’s systematic review reports that improved lighting can reduce crime in public spaces, while also noting that mechanisms may include increased community pride and informal social control, not only better visibility [5]. Chalfin et al. provide experimental evidence from New York City public housing developments showing reductions in nighttime outdoor index crimes after temporary lighting was introduced [6]. Other research emphasizes that lighting quality, uniformity, and perceived safety are important for pedestrian comfort [7].

Women’s safety studies show that perceived safety affects the use of public spaces. Research using qualitative GIS has demonstrated that safety maps can combine physical and social environmental factors with women’s perception data [8]. This supports Shadow Path’s design choice to combine objective data, such as lights and road types, with subjective reporting, such as user feedback and confidence levels.

## V. Proposed System

Shadow Path is proposed as a safety-aware route recommendation application. The user enters a source and destination. The system retrieves one or more route candidates from a routing engine, evaluates each route segment using safety layers, computes a score, and presents the safest practical option with explanations.

The system does not label a route as completely safe. Instead, it provides a relative route comparison, such as “better lighting coverage,” “fewer dark segments,” or “higher business activity.” This responsible framing is important because safety depends on many real-world factors that cannot be fully captured by a map.

## VI. System Architecture

The architecture contains five main layers:

- **Client application:** A web or mobile map interface where users search routes, view overlays, compare alternatives, and submit reports.
- **Routing service:** OSRM, Valhalla, GraphHopper, or another routing engine that generates candidate paths from OSM data.
- **Geospatial database:** PostGIS or another spatial database stores OSM ways, streetlight points, business/POI layers, user reports, and segment scores.
- **ETL pipeline:** Scheduled ingestion jobs download or import OSM extracts, municipal lighting data, government open datasets, and approved POI feeds.
- **Safety scoring API:** Backend service returns route geometry, segment metadata, safety scores, data freshness, and warnings for dark or low-confidence segments.

## VII. Data Sources

The system can use the following datasets:

- **OpenStreetMap:** Road and footpath geometry, road classification, sidewalks, pedestrian areas, amenities, shops, and optional `lit` tags.
- **Municipal streetlight data:** Streetlight pole locations, maintenance status, lamp type, and last inspection date.
- **Government open data:** Public transport stops, police stations, CCTV zones, public toilets, accident-prone areas, and civic infrastructure.
- **Business and POI data:** Shops, hospitals, pharmacies, restaurants, fuel stations, and late-night services.
- **User reports:** Community feedback about broken lights, unsafe stretches, blocked roads, and route experience.

## VIII. Methodology

The methodology has six stages:

1. **Data collection:** Gather OSM road-network data and lighting/POI datasets for the selected city.
2. **Preprocessing:** Clean duplicate records, convert datasets into a common coordinate system, and remove invalid geometries.
3. **Spatial matching:** Snap streetlights and POIs to nearby road segments using distance thresholds and nearest-neighbor spatial joins.
4. **Feature extraction:** Calculate light density, maximum dark gap, business density, road category, report count, and data freshness for each segment.
5. **Safety scoring:** Convert extracted features into a normalized score from 0 to 100.
6. **Route recommendation:** Compare candidate routes and rank them using a combined cost that balances route length and safety score.

## IX. Safety Scoring Model

A simple first version of the scoring model can be:

```text
Segment Safety Score =
  0.35 * Lighting Score
+ 0.20 * Business Activity Score
+ 0.15 * Road Type Score
+ 0.10 * Public Access Score
+ 0.10 * User Report Score
+ 0.10 * Data Freshness Score
```

Each component is normalized between 0 and 100:

- **Lighting Score:** Based on lights per 100 meters, average spacing between lights, and presence of dark gaps.
- **Business Activity Score:** Based on number of active shops or services near the segment, with higher weight at night.
- **Road Type Score:** Main roads, pedestrian commercial streets, and transit corridors may score higher than isolated alleys.
- **Public Access Score:** Segments near bus stops, metro stations, hospitals, police stations, or 24-hour services score higher.
- **User Report Score:** Verified negative reports reduce score; positive verified reports can improve confidence.
- **Data Freshness Score:** Recently verified data scores higher than outdated records.

For route ranking, the system can compute:

```text
Route Cost = Distance Cost + Safety Penalty
Safety Penalty = (100 - Average Segment Safety Score) * Safety Weight
```

This allows the user to choose between a shortest route and a safer route. For example, a user may accept a route that is 8% longer if it reduces dark-segment exposure by 60%.

## X. Prototype Description

The current repository is a React/Vite prototype scaffold. It can be extended into the Shadow Path interface by replacing the starter screen with:

- A route search panel for source and destination.
- A map view using MapLibre GL or another compatible map library.
- Route overlays colored by safety score.
- Toggles such as “avoid unlit streets” and “prefer business roads.”
- Segment cards showing light coverage, business density, confidence, and last updated date.
- A report button for broken streetlights or unsafe road segments.

The prototype should first use sample GeoJSON route segments and then move to live geospatial APIs once municipal data is available.

## XI. Evaluation Plan

The system can be evaluated using both technical and user-centered methods:

- **Route comparison:** Compare shortest route and safer route for the same source-destination pairs.
- **Dark-distance reduction:** Measure meters of route with low lighting score before and after Shadow Path ranking.
- **Business exposure:** Measure route distance near active commercial or public-service locations.
- **Route-length tradeoff:** Calculate additional distance or time required for a safer route.
- **Data confidence:** Measure how much of the route uses fresh official data versus inferred or missing data.
- **User feedback:** Conduct surveys with night-shift workers and women to assess perceived usefulness, clarity, and trust.

Example evaluation metrics:

| Metric | Description |
| --- | --- |
| Average Route Safety Score | Mean safety score across all route segments |
| Dark Segment Distance | Total meters with lighting score below threshold |
| Safer Route Distance Increase | Percentage increase compared with shortest route |
| Business Corridor Coverage | Percentage of route near active POIs |
| Report Accuracy | Percentage of user reports confirmed by moderation or official data |

## XII. Ethical and Privacy Considerations

Shadow Path deals with sensitive movement and safety information. The system should minimize collection of personally identifiable data. Precise route history should not be stored unless the user explicitly opts in. User reports should be anonymized, moderated, and protected from misuse. The interface must avoid false guarantees such as “this route is safe.” Better wording is “this route has better lighting coverage” or “this route avoids known dark segments.”

The system should also avoid reinforcing bias. Crime data, if used, must be handled carefully because police reports may reflect reporting patterns and enforcement bias rather than actual risk. The recommended first version should focus on physical infrastructure signals such as lighting, open businesses, transit access, and verified reports.

## XIII. Limitations

- Municipal lighting datasets may be incomplete, outdated, or unavailable.
- OSM data quality varies by city and depends on local mapping activity.
- Business activity may not reflect actual nighttime opening hours.
- GPS inaccuracies can affect the user’s exact route position.
- A high safety score cannot guarantee real-world safety.
- User reports require moderation to prevent spam, false reports, or targeted misuse.
- Different cities may require different scoring weights because urban design and data availability vary.

## XIV. Future Scope

Future versions of Shadow Path can include:

- Mobile applications for Android and iOS.
- Real-time alerts for saved commute routes.
- Emergency contact sharing with privacy controls.
- Offline route caching for low-network areas.
- Integration with public transport schedules and last-mile walking routes.
- Municipal dashboard for identifying streetlight repair priorities.
- CCTV/public-help-point overlays where legally available.
- Machine-learning models that learn city-specific scoring weights from validated feedback.

## XV. Conclusion

Shadow Path proposes a practical approach to safety-aware navigation by combining OSM road networks with streetlight data, business activity, civic infrastructure, and user feedback. The project shifts route planning from shortest-path optimization toward informed route selection. Its main value is route transparency: users can see why one path may be more suitable for late-night travel than another. With reliable municipal data, careful privacy design, and responsible communication, Shadow Path can support safer urban mobility for night-shift workers, women, and other pedestrians.

## References

[1] OpenStreetMap Wiki, “Map features.” https://wiki.openstreetmap.org/wiki/Map_features

[2] Project OSRM, “Open Source Routing Machine: The OpenStreetMap Data Routing Engine.” https://github.com/Project-OSRM

[3] Valhalla, “Valhalla Docs: Introduction for Users.” https://valhalla.github.io/valhalla/valhalla-intro/

[4] G. Boeing, “OSMnx: New methods for acquiring, constructing, analyzing, and visualizing complex street networks,” *Computers, Environment and Urban Systems*, vol. 65, pp. 126-139, 2017, doi: 10.1016/j.compenvurbsys.2017.05.004.

[5] B. C. Welsh and D. P. Farrington, “Effects of Improved Street Lighting on Crime,” *Campbell Systematic Reviews*, vol. 4, no. 1, pp. 1-51, 2008.

[6] A. Chalfin, B. Hansen, J. Lerner, and L. Parker, “Reducing Crime Through Environmental Design: Evidence from a Randomized Experiment of Street Lighting in New York City,” *Journal of Quantitative Criminology*, vol. 38, pp. 127-157, 2022.

[7] K. H. Kim, T. Hwang, and G. Kim, “The Role and Criteria of Advanced Street Lighting to Enhance Urban Safety in South Korea,” *Buildings*, vol. 14, no. 8, 2305, 2024.

[8] I. Gargiulo, X. Garcia, M. Benages Albert, J. Martinez, K. Pfeffer, and P. Vall-Casas, “Women's safety perception assessment in an urban stream corridor: Developing a safety map based on qualitative GIS,” *Landscape and Urban Planning*, vol. 198, 103779, 2020, doi: 10.1016/j.landurbplan.2020.103779.
