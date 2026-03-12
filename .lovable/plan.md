# Plan: 3D Pac-Man Maze Test Page

## Overview

Create a new `/battlefield` route with a 3D Pac-Man-style maze using React Three Fiber. This is a standalone test page — the existing arena is untouched.

## Dependencies to Install

- `three@>=0.133` 
- `@react-three/fiber@^8.18` (must be v8 for React 18)
- `@react-three/drei@^9.122.0`

## Files to Create/Edit

### 1. `src/lib/mazeData.ts`

- Define a 2D grid array representing the maze layout (1 = wall, 0 = path)
- Classic Pac-Man-style maze (~20x20 grid)
- Export helper to get valid path cells and neighbor cells for AI walking

### 2. `src/components/MazeEnvironment.tsx`

- **Floor**: Dark gray flat plane spanning the maze
- **Walls**: Map over the grid, render a `<mesh>` box (extruded cube) for each wall cell with blue neon emissive material
- **Lighting**: `<ambientLight intensity={0.3} />` + `<pointLight>` above the maze for depth/neon glow

### 3. `src/components/PacManPlayer.tsx`

- Yellow sphere (`<mesh><sphereGeometry /><meshStandardMaterial color="yellow" emissive="yellow" /></mesh>`)
- `useFrame` hook to move along path cells at a constant speed
- Simple AI: pick a random valid neighbor at each intersection, avoid reversing direction
- Smooth interpolation between grid cells

### 4. `src/pages/Battlefield.tsx`

- Full-screen `<Canvas>` from R3F
- `<OrthographicCamera>` positioned above, looking down (`makeDefault`, fixed zoom)
- Render `<MazeEnvironment />` and `<PacManPlayer />`
- Small "Back" link to `/`

### 5. `src/App.tsx`

- Add route: `<Route path="/battlefield" element={<Battlefield />} />`

## Technical Details

- Orthographic camera at `position={[0, 20, 0]}` looking at `[0,0,0]`, zoom ~20
- Wall cubes: 1×1×1 unit, blue emissive material (`#0088ff`)
- Player sphere: radius ~0.35, yellow emissive
- AI movement: ~3 cells/second, lerp between positions in `useFrame`
- Maze centered at origin by offsetting grid by half its dimensions

It is not neccessary to use those color inside 3d pac-man.  
Create a buttom in / to let me get into the battlefield directly  
later on, we are going to implement a lobby(which should be replacing the arena now, will act as a wait room for the players to get roles assigned and get into the battle field), and the battlefield would be the real game that our clients are playing.