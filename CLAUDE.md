# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # eenmalige build naar dist/
npm run dev         # watch-mode build (herbouwt bij bestandswijzigingen)
npm run lint        # ESLint over src/
npm run typecheck   # volledige typecheck met tsc (Vite en ESLint doen die niet)
npm run evergreen   # interactieve dependency-upgrade (max 3 dagen oud)
```

## Architectuur

Chrome-extensie (Manifest V3) gebouwd met Vite + `@crxjs/vite-plugin`. De plugin verwerkt `manifest.json` en bundelt de entry points naar `dist/`.

### Bestanden en rollen

| Pad | Context | Doel |
|---|---|---|
| `src/content.ts` | Content script (entry) | Bepaalt het paginatype, scant de DOM en injecteert downloadknoppen |
| `src/content/` | Content script | Eén module per paginatype (`posts`, `reels`, `home-feed`, `stories`, `highlights`, `user-feed`, `user-clips`, `user-tags-feed`, `profile`) plus `api.ts` (`fetchApi`, `fetchPost`, `findFbDtsg`), `download.ts` (bestandsnaam + `download`-bericht), `media.ts` (media-info per shortcode, gecachet) en `reels-media.ts` (GraphQL-fetch voor stories/highlights) |
| `src/content.css` | Content script CSS | Stijlen voor de downloadknoppen — automatisch geïnjecteerd via manifest |
| `src/background.ts` | Service worker | Vangt de parameters van de Tagged-query op, voert downloads uit en beheert het offscreen-document |
| `src/offscreen.html` + `src/offscreen.ts` | Offscreen-document | Voegt DASH-video en -audio samen tot één MP4 (Mediabunny) en maakt er een blob-URL van |
| `src/lib/` | Gedeeld | Types, logger, constanten en Instagram-types/-helpers (`lib/instagram/`) |

### Communicatiekanaal

```
content script  →─ chrome.runtime.sendMessage ──→  background.ts
```

Berichten (zie `src/messages.ts`):
- `download` — triggert `chrome.downloads.download()`
- `download_merged` — de background opent zo nodig het offscreen-document, laat het video en audio samenvoegen (`mux`), downloadt de blob-URL en ruimt die na de download op (`revoke`)

Alle API-verzoeken draaien in de content script.

### Hoe media-URL's worden opgehaald

Alles via `fetchApi` in `content/api.ts`: same-origin met de cookies van de pagina, `x-csrftoken` uit `document.cookie` en `x-ig-app-id` (`INSTAGRAM_WEB_APP_ID`). De REST-endpoints van `/api/v1/` zijn grotendeels onbruikbaar (404, HTML, 500, of media tot 1080px), dus bijna alles gaat via `POST /graphql/query` met dezelfde queries als de webapp. Die vereisen `fb_dtsg` in de body (uit de `<script type="application/json">`-tags van de pagina, `findFbDtsg`) en de header `x-fb-friendly-name`. De `doc_id`'s staan als constanten in de code; Instagram roteert ze af en toe, dan stopt de betreffende knop met werken.

- **Post** (`fetchPost` in `content/api.ts`) — `PolarisPostRootQuery` met `shortcode`. Geeft consequent de volle resolutie (bv. 3072×4096); `/api/v1/media/{postId}/info/` gaf soms alleen 1080px. `doc_id` en relay-variabelen komen uit de pagina, anders `DEFAULT_POST_DOC_ID` / `DEFAULT_POST_VARIABLES`. Carrousel-items hebben hier geen `taken_at`, daarom valt `makeMediaItem` terug op dat van de post.
- **Feed** (`content/user-feed.ts`) — `PolarisProfilePostsTabContentQuery_connection` (`FEED_DOC_ID`) op `username`; `after` voor de volgende pagina. Het antwoord bevat meestal een `field_exception` op `location.profile_pic_url` (ook bij Instagram zelf), dus `errors` tellen alleen als er geen data is.
- **Clips** (`content/user-clips.ts`) — `PolarisProfileReelsTabContentQuery_connection` (`CLIPS_DOC_ID`) op user-id; `after` voor de volgende pagina.
- **Tagged** (`content/user-tags-feed.ts`) — `PolarisProfileTaggedTabContentQuery`. `doc_id`, `fb_dtsg` en `lsd` vangt `background.ts` via `chrome.webRequest.onBeforeRequest` op uit Instagrams eigen verzoek en bewaart ze in `chrome.storage.local`, dus de gebruiker moet eerst het Tagged-tabblad openen.
- Feed, Clips en Tagged leveren alleen shortcodes; per post wordt daarna `getMediaInfo` (= `fetchPost`) aangeroepen.
- **Stories en highlights** (`content/reels-media.ts`) — `PolarisStoriesV3ReelPageStandaloneQuery` met `reel_ids_arr: [ "<userId>" ]` of `[ "highlight:<id>" ]`. `doc_id` uit de pagina, anders `DEFAULT_STORIES_DOC_ID`.
- **User-id** (`content/profile.ts`) — `/api/v1/users/web_profile_info/` is stuk; het id wordt uit de HTML van de profielpagina geschraapt (`"profilePage_<id>"`).

**PostId → shortcode** — pk's worden omgezet via een base64-variant met alfabet `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_` (`mapPostIdToShortcode` in `content/media.ts`; nodig voor Tagged). `findShortcodeInUrl()` haalt de shortcode uit een URL met `/p/`, `/reel/` of `/reels/`.

### Knoppen per paginatype

- **Posts, reels, home-feed** — een knop per zichtbare `img`/`video` van minstens 300×300 (`isValidMedia`)
- **Stories en highlights** — één knop bovenaan de story-viewer (`section:has([aria-label="Instagram"])`), onafhankelijk van media: achter het "View as …?"-scherm staat nog geen `img`/`video`
- **Profiel** — een knoppenstapel (Feed, Clips, Tagged, Highlights) bij de header

### Carrousel- en slide-index

- **Carrousel** (`home-feed.ts`) — de index van `button[aria-current="step"]` binnen zijn parent
- **Highlight** (`findActiveHighlightIndex` in `highlights.ts`) — de voortgangsbalk (hoogte < 5px); het segment met de meeste children is de actieve slide
- **Story** — het media-pk uit de URL (`/stories/<username>/<pk>/`), opgezocht in `reels_by_pk`; zonder pk de eerste story

### Bestandsnaamgeving bij download

`instagram__<username>__<datetime>[__<suffix>][__<nnn>][__poster].<ext>` (`makeFilename` in `content/download.ts`). `<datetime>` komt uit `taken_at` van de API — de uploadtijd naar Instagram; de originele opnamedatum is niet beschikbaar. Bij video's wordt ook de poster gedownload (`downloadOne`, `downloadReel`).

**Videoresolutie** — `video_versions` gaat maximaal tot 720px breed. `getDashVideo` in `lib/instagram/helpers.ts` haalt de grootste video (bv. 1080×1920, VP9) en de beste audio uit `video_dash_manifest` als die video groter is (`MediaItem.dash`). `downloadVideo` in `content/media.ts` laat die twee samenvoegen; mislukt dat, dan wordt de gewone video met geluid gedownload. Samenvoegen is remuxen zonder hercoderen: de pakketten worden met Mediabunny naar een nieuwe MP4 gekopieerd. De service worker kan geen blob-URL's maken, daarom gebeurt het in een offscreen-document. Geldt ook voor stories en highlights (`downloadReel`). In de stories-query hebben `video_versions` geen `width`; dan wordt met 720 vergeleken (`VIDEO_VERSIONS_MAX_WIDTH`).

### Permissies (manifest.json)

| Permissie | Reden |
|---|---|
| `downloads` | `chrome.downloads.download()` |
| `offscreen` | Offscreen-document voor het samenvoegen van video en audio |
| `webRequest` | Parameters van de Tagged-query uit Instagrams eigen verzoek lezen |
| `storage` | Die parameters bewaren tot de Tagged-knop gebruikt wordt |

Host-permissies: `www.instagram.com` voor de content script, `*.cdninstagram.com` en `*.fbcdn.net` zodat het offscreen-document de mediabestanden kan ophalen zonder CORS-beperking.

## ESLint

Geconfigureerd in `eslint.config.js` met `typescript-eslint` (type-aware) en `@stylistic/eslint-plugin`. Stijlregels: tabs, puntkomma's, `1tbs` brace style.

## Codestijl

- Weinig commentaar; als het er staat, in het Engels en afgebroken rond 80 tekens (zie `content/profile.ts`)
- Foutmeldingen en logregels in het Engels
- Secties in een bestand worden gescheiden met kopregels als `// DOWNLOAD \\\\…` tot 123 tekens

## Testen

Na een rebuild de extensie herladen in `chrome://extensions` **en** de Instagram-tabs hard verversen: een al geïnjecteerde content script raakt losgekoppeld van de herladen extensie en doet dan stilletjes niets. Fouten verschijnen in de console met prefix `[ig-dl]`.
