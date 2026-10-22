import { RemoteCore } from "./dist/remote.js";

const core = new RemoteCore();
const project = "FrankFeldmanComedyShort";
const lines = [
  ["driver-01", "Perfect timing. You're just like Frank Feldman.", "Microsoft David Desktop"],
  ["passenger-01", "Who?", "Microsoft Zira Desktop"],
  ["driver-02", "The perfect man! Champion athlete, pro golfer, opera singer, Broadway dancer, brilliant pianist. A computer memory. Wine expert. Could fix anything. Never got stuck in traffic, never argued with his wife, never made a single mistake.", "Microsoft David Desktop"],
  ["passenger-02", "Wow. How did you meet him?", "Microsoft Zira Desktop"],
  ["driver-03", "I never did. Frank died... and I married his wife.", "Microsoft David Desktop"],
];

const outputs = [];
for (const [label, text, voice] of lines) {
  const result = await core.narrate({ project, engine: "mac", text, voice });
  outputs.push({ label, text, voice, ...result });
}
console.log(JSON.stringify(outputs, null, 2));
