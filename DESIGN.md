---
name: "Scrubcast"
direction:
  name: "Modern Intelligence Workbench"
  thesis: "A calm, precision workspace for exploring long-form podcast knowledge, combining deep slate surfaces with instant magnetic audio scrub citations."
  signature: "Scrub Lock: Clicking citation chips or transcript timecodes triggers a swift, sub-100ms seek with an iris pulse, snapping playback and transcript to the exact second."
colors:
  background: "#0d0f15"
  surface: "#141722"
  surface-hover: "#1a1f2e"
  surface-active: "#21273b"
  border: "#202538"
  border-subtle: "#171b28"
  ink: "#f1f4f9"
  ink-muted: "#8c96ab"
  ink-faint: "#556075"
  accent: "#6366f1"
  accent-hover: "#818cf8"
  accent-ink: "#ffffff"
  secondary: "#38bdf8"
  success: "#10b981"
  danger: "#ef4444"
typography:
  display: { family: "Geist, system-ui, sans-serif", weight: 600, tracking: "-0.02em" }
  body: { family: "Geist, system-ui, sans-serif", weight: 400, size: "16px", leading: 1.6 }
  mono: { family: "Geist Mono, monospace" }
  scale: ["12px", "14px", "16px", "20px", "26px", "36px", "48px"]
rounded: { sm: "6px", md: "10px", lg: "14px", full: "999px" }
spacing: { unit: "4px", section: "28px", gutter: "20px" }
motion:
  intensity: crisp
  personality: "Instant and fluid: clicks lock immediately (<100ms), active markers ease smoothly, zero sluggish fades"
  durations: { instant: "80ms", fast: "140ms", base: "220ms", slow: "340ms" }
  easing:
    out: "cubic-bezier(0.16, 1, 0.3, 1)"
    in-out: "cubic-bezier(0.65, 0, 0.35, 1)"
  spring: { stiffness: 420, damping: 28 }
  reduced: "fade or instant; feedback stays"
components:
  searchBar: "Minimalist command bar with keyboard shortcut badge (⌘K) and subtle iris focus halo"
  citationChip: "Electric iris timestamp badge [MM:SS] with magnetic seek click and speaker attribution"
  playerDeck: "High-definition video deck with integrated scrub track and playback telemetry"
  transcriptFeed: "Clean scrollable transcript rail with active playhead indicator and quick-scrub timecodes"
  synthesisCard: "Executive grounded summary with direct quote evidence and semantic similarity scores"
  sourceRow: "Step one above the search bar: names the video being searched and takes a YouTube link to index a new one. Rejected links shake the field once (280ms) and show the reason inline"
---

# Scrubcast

## Direction
Scrubcast is a precision audio-intelligence workbench for researchers, engineers, and curious thinkers digging through deep technical podcast conversations. It departs entirely from vintage studio tropes (pitch-black obsidian and neon VU meters) to deliver a modern, calm, distraction-free environment inspired by tools like Linear and Cursor.

## Colour
- **Canvas Background (`#0d0f15`)**: Soft, deep obsidian-violet slate that reduces eyestrain without harsh pitch-black contrast.
- **Surface Elevation (`#141722`)**: Neutral elevated card panels for search, video playback, transcript, and synthesis.
- **Electric Iris (`#6366f1` / `#818cf8`)**: Primary brand and signal color, denoting citation chips, active playhead scrub position, and primary action triggers.
- **Sky Blue (`#38bdf8`)**: Secondary semantic indicator for vector chunk match scores, token ranges, and query telemetry.
- **Mint Emerald (`#10b981`)**: System health, active sync state, and completed operations.
- **Ink (`#f1f4f9` / `#8c96ab` / `#556075`)**: High-contrast, WCAG AA compliant text hierarchy.

## Typography
- **Geist Sans (Display & Body)**: Geometric grotesque optimized for legibility, with a generous 16px body size and 1.6 line height for long-form reading.
- **Geist Mono (Mono)**: Applied to all timecodes (`[04:25]`), latency metrics, speaker role tags, and vector similarity ratings. Tabular figures ensure layout stability during live playback.

## Layout
- Clean sticky top bar with global search, keyboard trigger (`⌘K`), and episode selector.
- Source row above the search bar: the video being searched on the left, a paste-a-YouTube-link field on the right. It reads as step one (pick a video), with the search bar as step two (ask).
- Ergonomic 50/50 dual-column workspace:
  - **Left (Grounded Synthesis Stream)**: Executive AI synthesis, structured insights, and cited evidence quote cards.
  - **Right (Playback Deck & Live Seeker)**: Pinned video player directly over a synchronized, auto-scrolling transcript feed.

## Motion
- **Scrub Lock**: Instant (<100ms) magnetic programmatic seek when clicking citation badges or timestamps, accompanied by a subtle iris ping on the active transcript chunk.
- Responsive, crisp micro-interactions with hardware-accelerated transforms (`transform`, `opacity`). No slow or disorienting decorative fades.
