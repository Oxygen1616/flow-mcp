import { RemoteCore } from "./dist/remote.js";

const core = new RemoteCore();

const scenes = [
  {
    prompt: "Cinematic vertical 9:16 comedy shot of a tropical deserted island with turquoise ocean water. Three shipwrecked survivors on a sandy beach: a nervous husband with glasses, his exhausted wife in torn resort clothes, and a charming handsome bachelor standing beside a tall rustic palm tree lookout tower. Vibrant sunny daylight, 8k cinematic comedy film.",
    type: "video",
    model: "Omni",
    aspect_ratio: "9:16",
    duration: 8,
    resolution: "720p",
    max_credits: 25
  },
  {
    prompt: "Medium vertical 9:16 comedy shot looking up at the handsome bachelor perched at the very top of the palm tree lookout tower, cupping both hands around his mouth and shouting down toward the beach with an exaggerated angry, accusatory face, tropical island background.",
    type: "video",
    model: "Omni",
    aspect_ratio: "9:16",
    duration: 8,
    resolution: "720p",
    max_credits: 25
  },
  {
    prompt: "Vertical 9:16 comedy shot at sunset on the tropical island beach. In the background atop the palm tree lookout tower, the bachelor points down with a shocked face. In the foreground on the beach, the bewildered husband throws his hands up in confusion while holding half a coconut.",
    type: "video",
    model: "Omni",
    aspect_ratio: "9:16",
    duration: 8,
    resolution: "720p",
    max_credits: 25
  },
  {
    prompt: "Close-up vertical 9:16 comedy reaction shot of the middle-aged husband at the top of the lookout tower looking down at the beach below. His jaw drops in stunned realization, scratching his chin with a hilarious bewildered grin, tropical sky background.",
    type: "video",
    model: "Omni",
    aspect_ratio: "9:16",
    duration: 8,
    resolution: "720p",
    max_credits: 25
  }
];

async function main() {
  console.log("Submitting 4 scenes to Flow Studio queue...");
  const res = await core.generate({
    project: "DesertIslandJoke",
    scenes
  });
  console.log("Queue response:", JSON.stringify(res, null, 2));
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
