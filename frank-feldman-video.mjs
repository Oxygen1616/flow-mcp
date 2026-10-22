import { RemoteCore } from "./dist/remote.js";

const core = new RemoteCore();

const shared = `Polished cinematic live-action comedy, vertical 9:16. Keep the same two characters throughout: DRIVER is a warm expressive man in his late 50s with a salt-and-pepper moustache, cream shirt and dark vest; PASSENGER is a clean-shaven man in his late 30s wearing a navy blazer and light blue shirt. Classic yellow city taxi, warm late-afternoon light, believable faces and hands, natural comic timing. No captions, no on-screen text, no logos, no music, no spoken dialogue; only subtle city and taxi ambience.`;

const scenes = [
  {
    prompt: `${shared} One continuous opening shot: on a lively city sidewalk the passenger raises his hand and the yellow taxi arrives with uncanny perfect timing. The camera tracks him as he opens the rear door and gets in, ending on a clear interior two-shot with the driver glancing back cheerfully and the passenger curious. Smooth handheld-to-dolly movement, upbeat setup.`,
    type: "video",
    model: "Omni 1.1 Flash",
    aspect_ratio: "9:16",
    duration: 10,
    resolution: "360p",
    max_credits: 7,
    download_quality: "upscaled",
  },
  {
    prompt: `${shared} Continue seamlessly inside the moving taxi. One continuous medium two-shot from the front passenger side as the driver animatedly praises an impossibly perfect man, counting achievements on his fingers and gesturing with delighted confidence while keeping control of the car. The passenger shifts from skeptical to genuinely amazed. Slow subtle push-in, city lights sliding past the windows, energetic visual rhythm without cuts.`,
    type: "video",
    model: "Omni 1.1 Flash",
    aspect_ratio: "9:16",
    duration: 10,
    resolution: "360p",
    max_credits: 7,
    download_quality: "upscaled",
    chain_previous: true,
  },
  {
    prompt: `${shared} Continue seamlessly inside the taxi now stopped at a red light. One continuous shot: the impressed passenger leans forward to ask a final question; the driver pauses, meets his eyes in the rear-view mirror, then gives a perfectly dry deadpan answer. Hold a full two-second reaction beat as the passenger's delighted smile collapses into stunned realization and the driver faces forward innocently. Very slow push toward the mirror, restrained performance, strong punchline timing.`,
    type: "video",
    model: "Omni 1.1 Flash",
    aspect_ratio: "9:16",
    duration: 10,
    resolution: "360p",
    max_credits: 7,
    download_quality: "upscaled",
    chain_previous: true,
  },
];

const result = await core.generate({ project: "FrankFeldmanComedyShort", scenes });
console.log(JSON.stringify(result, null, 2));
