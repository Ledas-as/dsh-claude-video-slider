# References and attribution

This unofficial plugin imitates Claude UI appearance and motion shown in a
reference video. It is an independent DeepSeek Harness plugin, not an official
Anthropic / Claude or DeepSeek product. The reference recording is not included.

The bundled src/pixel-motion.js contains numeric cell-color curves sampled from
the user-supplied 5-7 second reference excerpt. It contains no recording frames,
pointer imagery, conversation text, or external file paths. Curves are lightly
smoothed and blended at the loop boundary to support continuous playback.

DSH registration and model-directory integration follow published patterns in:

- https://github.com/MEMZ-JZY/DSH-Claude-Style-Reasoning-Slider
  - MIT License; Copyright (c) 2026 MEMZ-鱼子酱.
  - Reference revision: f1aa4b4728725076f70d3dc21c9d95ca281b30d7.
- https://github.com/deepseek-ai/deepseek-harness
  - MIT License; the DSH runtime is supplied by the host and is not redistributed.

The reference repository's character portraits, fish sprite, optional settings,
visual component and built bundle are not included in this package.

The visual component in src/slider.js was written for this delivery from the
user-supplied video. Demo model names describe a visual preview, not bundled
model providers. No model credentials are included or needed for the preview.
