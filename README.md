# Knock-Knock Joke Maker (QVAC)

Pick a theme (animals, food, school, space...) or type a name, like a friend's or your pet's, and an **on-device AI** invents new, family-friendly **knock-knock jokes**. Then use **Act it out** mode to perform them one line at a time ("Knock knock!" / "Who's there?"...), with a little drum sound after the punchline. Save your favorites.

It runs **on your own computer** using [QVAC](https://github.com/tetherto/qvac), Tether's open-source AI SDK.
No API key, no cloud service, and what you type never leaves your machine.

![screenshot](screenshot.png)

## SDK version

`@qvac/sdk` **0.19.0** (declared in `package.json`)

Functions used: `loadModel` and `completion` (with structured output via `responseFormat`), with the `LLAMA_3_2_1B_INST_Q4_0` model.

## Install

You need [Node.js](https://nodejs.org) 22 or newer and some free disk space for the model.

```bash
git clone https://github.com/misaki-codex/qvac-knock-knock-jokes.git
cd qvac-knock-knock-jokes
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3094** (the address, not the HTML file). The first start downloads the model.
While it loads, 12 classic knock-knock jokes are used instead.

## How it works

- `server.js` calls `completion` with a JSON schema (the word at the door and the punchline). Jokes whose punchline doesn't actually play on the word at the door are thrown away, so every joke works.
- The app remembers which words were used, so new jokes don't repeat them.
- The drum sound is made with the browser's Web Audio API, so no sound files are needed.
- The server listens on `127.0.0.1`, so only your own computer can reach it.

## Troubleshooting

If you see `RPC_INIT_TIMEOUT`, the QVAC worker was slow to start. `server.js` already waits 3 minutes.
Set `QVAC_RPC_INIT_TIMEOUT_MS` (milliseconds) before `npm start` to wait longer, and make sure no other
QVAC app is running at the same time. If you see `ERR_MODULE_NOT_FOUND`, delete the `node_modules` folder
and run `npm install` again (this usually means an install was interrupted, for example by a full disk).

## License

MIT
