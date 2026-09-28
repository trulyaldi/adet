# Ilmek — Adet mascot spec (v2)

Source: Claude Design, "Adet Mascot v2". One SVG per state, viewBox 200×200, flat colors, no gradients, filters, or CSS (react-native-svg compatible).

## Files
| File | State | Where it's used |
|---|---|---|
| ilmek-idle.svg | Idle | Today screen |
| ilmek-focused.svg | Focused (holds a book) | Timer running |
| ilmek-sleepy.svg | Sleepy (sleep bubble) | Timer paused, rest day |
| ilmek-cheering.svg | Cheering | Session done, target reached |
| ilmek-celebrating.svg | Celebrating (confetti) | Day complete, milestones |
| ilmek-relaxed.svg | Relaxed (sunglasses) | Week complete, all goals met, empty states |
| ilmek-waving.svg | Waving | Onboarding, welcome |
| ilmek-small.svg | Small (body, curl, eyes only) | Any size below 40px |

## Construction (viewBox 200×200)
- Body: round mass 128×126 centered at (100,113); darker crescent lower right; gloss mark upper left; belly patch.
- Head curl (#tuft): the Adet logo mark at 0.7×; loop r14 around (104,32) flicking up into the check; stroke 9, round caps/joins. Always visible.
- Eyes: white ovals 34×38 at (78,96) and (122,96); pupils r9.5 with catchlights r3.6 and r1.7.
- Arms: single strokes, width 18, shade color, from shoulders (44,124) and (156,124).
- Feet: 34×18 ovals at (80,176) and (120,176).
- Pivots: #rig rotates around (100,180) and breathes (scaleY) from the feet line; each arm rotates at its shoulder; curl at (100,52).

## Colors
- #0A7AFF body, curl
- #0062D1 shade, arms, feet
- #4D9EFF gloss
- #CFE4FF belly
- #1C1C1E pupils, brows, mouth
- #FF8FB1 cheeks
- #FF6B8A tongue

Project tints: swap all four body tones (body, shade, gloss, belly).

## Layer order and group names
shadow → feet → (arms behind, relaxed only) → tuft → body → face (cheeks, eyes [eye-left, eye-right], brows, mouth, [sunglasses]) → arms (arm-left, arm-right) → props ([book], accessories [confetti | sleep-bubble]).

## Motion
- Idle: rig scaleY 1→1.03 from feet over 3.2s ease-in-out. Blink every 4–6s at random (eyes scaleY→0.1 for 120ms). Arms sway ±3° out of phase. Curl bobs 2° per breath.
- Focused: slower breathing (4s, 1.5%). Gaze toward the timer, drifts 1 unit every 8s. Blink about every 8s. Book tilts 1°, page flips every 20s.
- Sleepy: deep breath over 5s (3%). Rig nods −4°↔−7°. Sleep bubble grows 0.6→1.1 and pops every 6s. Eyes closed and content, never sad.
- Cheering: arms spring up into a V (damping 12), then pump twice ±8°. Brows lift 3 units. Body squash 0.96→1.04. Loops over 1.6s with 1s rest.
- Celebrating: hops, rig up 10 units, squash on landing (scaleY 0.9, scaleX 1.08). Shadow shrinks to 0.7 in the air. Arms shake ±12°, curl whips 15°, confetti bursts and fades in 60ms steps. Plays 3× over 1.2s, then settles into Cheering.
- Relaxed: leans back −7°↔−4° over 5s with slow breaths. Hands behind head; sunglasses glint (white bar sweep) every 6s. Smile never changes.
- Waving: right arm swings −18°↔+10° around the shoulder (154,116), 3 swings in 1.1s, then 1.5s rest. Motion arcs fade in on each swing; body bobs 1 unit.

## Rules
- Never frown, cry, droop, grey out, or turn away. Brows only soft, raised, or level.
- Head curl always visible (the link to the logo).
- Each prop belongs to exactly one state.
- No text, letters, or speech bubbles.
- Below 40px use ilmek-small.svg.
