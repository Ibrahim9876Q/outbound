# Globe lessons

- Count app–IP destinations and label them as such. The server measures sockets and retains closed endpoints for about ten minutes. Directional animations illustrate a connection.
- GeoIP may return a country without a city, or no coordinates at all. Keep unplaced records in the country summary and avoid coercing missing coordinates to zero.
- The installed globe library accepts alpha in numeric `rgba(...)` strings. Eight-digit hex produces invalid color warnings in Three.js.
- Test Windows flag rendering in Chrome. Regional indicator emoji can display as letters there. The Globe bundles a flag sprite in its stylesheet so the browser can render flags offline.
- The sandbox blocks the server from spawning the Windows readers. Use the approved local server command for live data.
- Test shared work without changing lane ownership by serving a read-only snapshot of shared files as browser overrides. Count actual SSE requests to catch a duplicate connection.
- Compare the displayed fields of a pinned detail card before rebuilding it. A change to socket counts should preserve keyboard focus in an otherwise identical card.
