// Stable world generation and combat rolls for the WebSocket smoke test.
let state = 0x6e616d;
Math.random = () => {
  state = (1664525 * state + 1013904223) >>> 0;
  return state / 0x100000000;
};
