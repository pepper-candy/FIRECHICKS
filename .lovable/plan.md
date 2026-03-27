# Immersive Exhibition Mode — "The Power of Interfaces"

A toggleable cinematic mode that transforms the game into a world-class exhibition piece. When activated, every screen gains atmospheric depth, dramatic transitions, and environmental storytelling.

---

## 1. Immersive Mode Toggle (Arrival Screen)

Add a toggle button on GameIndex — a glowing "GO IMMERSIVE" switch at the top. Store the mode in React context (`ImmersiveContext`) so every component can read it. When off, game behaves exactly as now.

**Files**: New `src/context/ImmersiveContext.tsx`, edit `src/pages/GameIndex.tsx`, `src/App.tsx`

---

## 2. Cinematic Arrival Screen

When immersive mode is ON, the GameIndex transforms:

- **Full black background** with slow-drifting particle field (tiny floating dots using CSS animations — no canvas overhead)
- **Title reveal**: "EAGLE VS CHICK" types in letter-by-letter with green glow pulse on each character, then subtitle fades in
- **Buttons**: fade-in staggered, with subtle border-glow breathing animation
- **Ambient scanline overlay**: thin horizontal lines scrolling slowly (CSS pseudo-element), evoking CRT/cyber aesthetic
- **"The Power of Interfaces"** — subtle watermark text at bottom, barely visible, rotating slowly

**Files**: Edit `src/pages/GameIndex.tsx`, add CSS in `src/index.css`

---

## 3. Enhanced 3D Map Atmosphere

Transform the gameplay map when immersive mode is active:

- **Volumetric fog**: Three.js `FogExp2` with low density, color-matched to theme hue
- **Floating particles**: Small glowing orbs drifting upward across the map (instanced mesh, ~50 particles, very performant)
- **Building edge glow**: Add emissive wireframe outlines on buildings using `<Edges>` from drei
- **Floor reflection**: Subtle reflective plane under the grid using `MeshReflectorMaterial` (drei)
- **Enhanced sky sphere**: Gradient sky dome instead of flat color, with slow rotation
- **Ambient light rays**: Directional light with subtle volumetric cone visible near buildings

**Files**: Edit `src/components/GameplayMap.tsx`

---

## 4. Cinematic Phase Transitions

### Countdown

- Full-screen numbers with **zoom + fade** (scale from 3x to 1x per beat)
- Screen edges pulse with team colors
- Background darkens with vignette

### Stage Transitions

- Full-width banner slides across screen with stage name
- Brief screen flash on stage change
- Stage info card gets frosted glass treatment

### Reveal Phase

- Camera dramatically pulls back from black
- Character appears from light burst (white flash → character)

**Files**: Edit `src/pages/Host.tsx` (countdown, reveal sections), `src/components/StageTransition.tsx`

---

## 5. Immersive Game-Over Ceremony

Three-phase ceremony with cinematic upgrades:

### MVP Phase

- Screen starts black, spotlight fades in on character
- Particle burst explosion behind the MVP (golden particles)
- Camera slowly orbits the character
- Name + score fly in with typewriter effect

### Team Phase

- Characters march in from sides (staggered entrance)
- Victory confetti particles (team-colored)
- Dramatic team name banner with glow

### Transcript Phase

- Rows reveal one at a time with slight delay (staggered fade-in)
- Grade letters animate in with scale bounce
- WIN/LOSE stamps with impact animation
- Background slowly scrolling grid pattern

**Files**: Edit `src/pages/Host.tsx` (GameOverCeremony)

---

## 6. Environmental Storytelling Details

Subtle world-building touches when immersive:

- **Glitch frame on damage**: Brief CSS glitch (chromatic aberration + offset) when a player takes damage, visible on host screen
- **Footprint trails**: Fading marks on the map floor where characters walk (simple decals)
- **Building windows**: Small emissive rectangles on building faces that flicker occasionally
- **Mystery box aura**: Swirling particle ring around mystery boxes instead of just rotation
- **Map edge haze**: Soft gradient fade at map boundaries suggesting the world extends beyond

**Files**: Edit `src/components/GameplayMap.tsx`, `src/pages/Host.tsx`

---

## Technical Approach

- **ImmersiveContext**: boolean context, `useImmersive()` hook. Every component checks `isImmersive` before applying cinematic variants.
- **Performance**: All particle systems use instanced meshes. CSS animations handle 2D effects. No post-processing passes (too heavy for exhibition devices).
- **Three.js additions**: `@react-three/drei` Edges, fog built-in to Three.js — no new dependencies.
- **CSS animations**: Scanlines, typewriter, staggered fade-ins — all pure CSS keyframes added to `index.css`.

---

## Implementation Order

1. ImmersiveContext + toggle button
2. Cinematic arrival screen
3. Enhanced map atmosphere (fog, particles, edges)
4. Phase transitions (countdown, stage, reveal)
5. Game-over ceremony upgrades
6. Environmental details (polish pass)