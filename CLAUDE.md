# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # eenmalige build naar dist/
npm run dev         # watch-mode build (herbouwt bij bestandswijzigingen)
npm run lint        # ESLint over src/
npm run evergreen   # interactieve dependency-upgrade (max 3 dagen oud)
```

## Architectuur

Chrome-extensie (Manifest V3) gebouwd met Vite + `@crxjs/vite-plugin`. De plugin verwerkt `manifest.json` en bundelt de entry points naar `dist/`.

### Bestanden en rollen

| Pad | Context | Doel |
|---|---|---|
| `src/content.ts` | Content script (entry) | Bepaalt het paginatype, scant de DOM en injecteert downloadknoppen |
| `src/content/` | Content script | Eén module per paginatype (`posts`, `reels`, `home-feed`, `stories`, `highlights`, `user-feed`, `user-clips`, `user-tags-feed`, `profile`) plus `download.ts` (bestandsnaam + `download`-bericht) en `reels-media.ts` (GraphQL-fetch voor stories/highlights) |
| `src/content.css` | Content script CSS | Stijlen voor de downloadknoppen — automatisch geïnjecteerd via manifest |
| `src/background.ts` | Service worker | Onderschept auth-headers en GraphQL-parameters, beantwoordt berichten, voert downloads uit |
| `src/server/` | Service worker | API-aanroepen via `fetchApi` (`server/instagram/api.ts`) |
| `src/lib/` | Gedeeld | Types, logger, constanten en Instagram-types/-helpers (`lib/instagram/`) |

`src/content/` importeert niets uit `src/server/`; gedeelde code staat in `src/lib/`.

### Communicatiekanaal

```
content script  →─ chrome.runtime.sendMessage ──→  background.ts
```

Berichttypen (zie `src/messages.ts`):
- `get_media_info` — media-URL's en gebruikersnaam van één post
- `get_user_feed`, `get_user_clips`, `get_user_tags_feed` — gepagineerde feeds van een profiel
- `download` — triggert `chrome.downloads.download()`

Antwoorden zijn een `Result` (`{ success, data }` of `{ success: false, error }`). `Error`-objecten overleven messaging niet, dus `serializeResult()` in `background.ts` stuurt alleen `{ message }` mee en `sendMessage()` in `content/utils` maakt er weer een `Error` van.

### Hoe media-URL's worden opgehaald

**Via de background (REST + auth-headers)** — posts, profielfeed, clips:

1. **Header-interceptie** — `background.ts` luistert via `chrome.webRequest.onBeforeSendHeaders` op XHR-verzoeken van Instagram en slaat auth-headers op in `chrome.storage.local`: `x-ig-app-id`, `x-ig-www-claim`, `x-asbd-id`, `x-instagram-ajax`
2. **Authenticatie** — `fetchApi` combineert die headers met de `csrftoken` cookie (via `chrome.cookies.get`) en `credentials: 'include'`
3. **Endpoints** — `GET /api/v1/media/{postId}/info/`, `GET /api/v1/feed/user/{userId}`, `POST /api/v1/clips/user/`
4. **Tagged feed** — GraphQL (`PolarisProfileTaggedTabContentQuery`); `doc_id`, `fb_dtsg` en `lsd` worden via `onBeforeRequest` uit Instagrams eigen verzoeken gehaald, dus de gebruiker moet eerst het Tagged-tabblad openen

**Via de content script (same-origin)** — stories, highlights en user-id:

- **Stories en highlights** (`content/reels-media.ts`) — `/api/v1/feed/reels_media/` geeft server-side altijd een 500. In plaats daarvan: `POST /graphql/query` met de query `PolarisStoriesV3ReelPageStandaloneQuery` en `reel_ids_arr: [ "<userId>" ]` of `[ "highlight:<id>" ]`. Vereist `fb_dtsg` in de body en de header `x-fb-friendly-name`. `fb_dtsg` en de `doc_id` komen uit de `<script type="application/json">`-tags van de pagina; ontbreekt de `doc_id` (bv. na SPA-navigatie), dan wordt `DEFAULT_STORIES_DOC_ID` gebruikt — Instagram roteert die af en toe. Vanuit de service worker geeft deze query HTML terug in plaats van JSON, daarom draait hij in de content script.
- **User-id** (`content/profile.ts`) — `/api/v1/users/web_profile_info/` is ook stuk; het id wordt uit de HTML van de profielpagina geschraapt (`"profilePage_<id>"`).

**Shortcode → postId** — shortcodes worden gedecodeerd via een base64-variant met alfabet `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_` (`mapShortcodeToPostId` in `content/media.ts`). `findShortcodeInUrl()` haalt de shortcode uit een URL met `/p/`, `/reel/` of `/reels/`.

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

### Permissies (manifest.json)

| Permissie | Reden |
|---|---|
| `downloads` | `chrome.downloads.download()` |
| `webRequest` + `extraHeaders` | Auth-headers en GraphQL-parameters uit Instagram-verzoeken lezen |
| `cookies` | `csrftoken` ophalen voor API-authenticatie |
| `storage` | Opgeslagen auth-headers en GraphQL-parameters bewaren tussen verzoeken |

## ESLint

Geconfigureerd in `eslint.config.js` met `typescript-eslint` (type-aware) en `@stylistic/eslint-plugin`. Stijlregels: tabs, puntkomma's, `1tbs` brace style.

## Codestijl

- Weinig commentaar; als het er staat, in het Engels en afgebroken rond 80 tekens (zie `content/profile.ts`)
- Foutmeldingen en logregels in het Engels
- Secties in een bestand worden gescheiden met kopregels als `// DOWNLOAD \\\\…` tot 123 tekens

## Testen

Na een rebuild de extensie herladen in `chrome://extensions` **en** de Instagram-tabs hard verversen: een al geïnjecteerde content script raakt losgekoppeld van de herladen extensie en doet dan stilletjes niets. Fouten verschijnen in de console met prefix `[ig-dl]`.
