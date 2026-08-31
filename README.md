<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# The Aleph: Infinite Borges

A literary text-adventure inspired by Jorge Luis Borges' **The Aleph**. The game mixes a branching narrative with free-form actions: the player can choose one of the offered paths or write what they want to do next while the story keeps track of its fictional state.

The current application includes narrative choices, a free-action text field, objectives, audio/voice controls, generated imagery and soundtrack, and language controls. Its interaction model is deliberately game-like rather than a dashboard: global numeric shortcuts select choices, while the focused free-action field owns text entry.

## How it works

The client is a React 19 application built with Vite. Local UI state and controls handle the immediate interaction; Gemini is used by the application to generate new narrative material and related media from the current game state. Framer Motion provides motion used by the experience, and the browser Web Speech API is used when voice input is available.

The repository does not publish a standalone release or claim an offline AI mode. Running the generative path requires a Gemini API key.

## Run locally

**Prerequisites:** Node.js and a Gemini API key.

1. Install dependencies:
   `npm install`
2. Set `GEMINI_API_KEY` in `.env.local`.
3. Start the development server:
   `npm run dev`

For a production build:

```bash
npm run build
npm run preview
```

The project can also be opened from its existing [AI Studio app](https://ai.studio/apps/drive/1JXiDQeCTanzoiO1rs5hJVisB5neAytxW).
