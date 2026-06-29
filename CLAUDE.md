# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # eenmalige build naar dist/
npm run dev         # watch-mode build (herbouwt bij bestandswijzigingen)
npm run evergreen   # interactieve dependency-upgrade (max 3 dagen oud)
```

Er zijn geen tests of een linter geconfigureerd.

## Architectuur

Dit is een Chrome-extensie (Manifest V3) gebouwd met Vite + `@crxjs/vite-plugin`. De plugin verwerkt `manifest.json` en bundelt de drie entry points naar `dist/`.

### Drie scripts en hun rollen

| Bestand | Context | Doel |
|---|---|---|
| `src/injected.ts` | `MAIN` world | Patcht browser-API's om video-chunk-URL's te onderscheppen |
| `src/content.ts` | Isolated content script | Scant DOM, injecteert downloadknoppen, stuurt downloadverzoeken |
| `src/background.ts` | Service worker | Voert `chrome.downloads.download()` uit |

### Waarom twee content scripts?

Video-URL-interceptie vereist directe toegang tot de pagina-API's (`fetch`, `XHR`, `MediaSource`, `SourceBuffer`, `URL.createObjectURL`), wat alleen mogelijk is in de `MAIN` world. Chrome-extensie-API's zoals `chrome.runtime.sendMessage` zijn echter uitsluitend beschikbaar in het geïsoleerde content script. Daarom zijn twee scripts nodig.

### Communicatiekanalen

```
injected.ts (MAIN)  →─ CustomEvent 'ig-dl-chunk' ──→  content.ts (isolated)
content.ts          →─ chrome.runtime.sendMessage ──→  background.ts
```

### Video-URL-resolutie

Instagram levert video's via MSE (Media Source Extensions). `injected.ts` volgt de volledige keten:

1. `fetch`/`XHR` onderschept `.mp4`-chunk-URL's en tagt de resulterende `ArrayBuffer` met `__igDlUrl`
2. `SourceBuffer.appendBuffer` koppelt de chunk-URL via de `SourceBuffer → MediaSource → blob URL`-keten
3. Een `ig-dl-chunk` CustomEvent stuurt `{ blobUrl, chunkUrl }` naar het content script
4. `content.ts` slaat per blob-URL de chunk-URL met de hoogste bitrate op (via de `efg`-parameter in de URL)
5. Bij klikken op de downloadknop wordt die chunk-URL naar de background service worker gestuurd

### Bestandsnaamgeving bij download

`<profielnaam>__<datetime>.ext` — datetime wordt geëxtraheerd uit het `<time datetime="...">` element dat het dichtst bij het artikel staat.