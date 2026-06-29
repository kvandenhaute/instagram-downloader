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

| Bestand | Context | Doel |
|---|---|---|
| `src/content.ts` | Isolated content script | Scant DOM, injecteert downloadknoppen, stuurt berichten naar background |
| `src/content.css` | Content script CSS | Stijlen voor de downloadknop — automatisch geïnjecteerd via manifest |
| `src/background.ts` | Service worker | Onderschept auth-headers, roept Instagram API aan, voert downloads uit |

### Communicatiekanaal

```
content.ts  →─ chrome.runtime.sendMessage ──→  background.ts
```

Twee berichttypen:
- `get_media_info` — vraagt media-URL's en gebruikersnaam op via de Instagram API
- `download` — triggert `chrome.downloads.download()`

### Hoe video- en foto-URL's worden opgehaald (API-aanpak)

In plaats van MSE-patching gebruikt de extensie **Instagram's private API**:

1. **Header-interceptie** — `background.ts` luistert via `chrome.webRequest.onBeforeSendHeaders` op alle XHR-verzoeken van Instagram en slaat auth-headers op in `chrome.storage.local`:
   - `x-ig-app-id`, `x-ig-www-claim`, `x-asbd-id`, `x-instagram-ajax`

2. **Authenticatie** — bij een API-aanroep worden die opgeslagen headers gecombineerd met de `csrftoken` cookie (opgehaald via `chrome.cookies.get`) en meegestuurd met `credentials: 'include'`

3. **Media-info** — endpoint: `GET /api/v1/media/{postId}/info/`  
   Retourneert `user.username`, `taken_at`, `video_url`/`video_versions`, `image_versions2.candidates`, en `carousel_media` voor carrousels

4. **Shortcode → postId** — Instagram shortcodes worden gedecodeerd naar een numeriek postId via een eigen base64-variant met alfabet `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_` (in `mapShortcodeToPostId`)

### Shortcode vinden in de DOM

`findShortcode()` in `content.ts` werkt in twee stappen:
1. Kijkt of de shortcode al in `window.location.pathname` staat (`/p/…` of `/reel/…`)
2. Anders: zoekt een `<a href>` die `/p/` of `/reel/` bevat in de dichtstbijzijnde `article` of `[role="dialog"]`

### Carrousel-index

Om te weten welk item in een carrousel de gebruiker bekijkt, zoekt `content.ts` naar `button[aria-current="step"]` — de actieve paginatiestip. De index van die knop binnen zijn parent geeft de 0-gebaseerde slide-index, die vervolgens gebruikt wordt om het juiste item uit `carousel_media` te kiezen.

### Bestandsnaamgeving bij download

`<username>__<datetime>.<ext>` — `taken_at` uit de API (Unix-timestamp) of het `datetime`-attribuut van het dichtstbijzijnde `<time>`-element. Dit is de uploadtijd naar Instagram; de originele opnamedatum is niet beschikbaar via de API.

### Permissies (manifest.json)

| Permissie | Reden |
|---|---|
| `downloads` | `chrome.downloads.download()` |
| `webRequest` + `extraHeaders` | Auth-headers uit Instagram-verzoeken lezen |
| `cookies` | `csrftoken` ophalen voor API-authenticatie |
| `storage` | Opgeslagen auth-headers bewaren tussen verzoeken |

## ESLint

Geconfigureerd in `eslint.config.js` met `typescript-eslint` (type-aware) en `@stylistic/eslint-plugin`. Stijlregels: tabs, puntkomma's, `1tbs` brace style.
