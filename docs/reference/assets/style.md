# Design System Guide

## Color Palette & CSS Variables

```css
:root {
    --background-dark-blue: #0A192F;  /* Main dark background */
    --accent-cyan: #64FFDA;            /* Primary accent color */
    --glow-color: rgba(100, 255, 218, 0.75);  /* Glow effects */
    --text-primary: #e0e0e0;           /* Main text color */
    --text-secondary: #8892b0;         /* Secondary text */
    --glass-bg: rgba(10, 25, 47, 0.85);      /* Glass morphism background */
    --border-color: rgba(100, 255, 218, 0.2); /* Subtle borders */
    --background-light: #fefefe;      /* Light mode background */
    --text-dark: #1a1a1a;             /* Dark text for light mode */
}
```

## Core Design Principles

- **Glass Morphism**: `backdrop-filter: blur(10px)` with semi-transparent backgrounds
- **Border Radius**: 16px for cards/containers, 8px for smaller elements, 6px for inputs
- **Border Style**: 1px solid with `var(--border-color)` for subtle cyan accents
- **Typography**: Inter font family, various weights (400-600)
- **Spacing**: Uses rem units, consistent padding (0.5rem, 0.75rem, 1rem, 1.5rem, 2rem)

## Component Patterns

### Glass UI Containers

```css
.glass-ui {
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    border: 1px solid var(--border-color);
    border-radius: 16px;
}
```

### Buttons

```css
button {
    padding: 12px 24px;
    border-radius: 12px;
    border: 1px solid var(--accent-cyan);
    background-color: transparent;
    color: var(--accent-cyan);
    transition: all 0.2s ease;
    cursor: pointer;
}

button:hover:not(:disabled) {
    background-color: rgba(100, 255, 218, 0.1);
}
```

### Form Elements

```css
input, select, textarea {
    background: rgba(10, 25, 47, 0.6);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    color: var(--text-primary);
    transition: all 0.2s ease;
}

input:focus, select:focus, textarea:focus {
    border-color: var(--accent-cyan);
    box-shadow: 0 0 0 2px rgba(100, 255, 218, 0.2);
}
```

### Cards & Stats

```css
.stat-card {
    background: var(--glass-bg);
    backdrop-filter: blur(10px);
    border-radius: 16px;
    padding: 1.5rem;
    border: 1px solid var(--border-color);
    transition: all 0.3s ease;
}

.stat-card:hover {
    border-color: var(--accent-cyan);
    box-shadow: 0 0 30px rgba(100, 255, 218, 0.1);
}
```

## Common Hover Effects

- Background color changes to `rgba(100, 255, 218, 0.1)` or `rgba(100, 255, 218, 0.2)`
- Border color changes to `var(--accent-cyan)`
- Subtle transforms like `translateY(-1px)` for 3D effects
- Box shadows with cyan glow: `0 0 30px rgba(100, 255, 218, 0.1)`

## Layout Patterns

- **Grid**: `display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))`
- **Flexbox**: Common for centering, spacing, and responsive layouts
- **Sticky headers**: `position: sticky; top: 0; z-index: 10`
- **Responsive**: Mobile-first with `@media (min-width: 640px)` breakpoints

## Special Effects

- **Background gradients**: `linear-gradient(to-br, var(--background-dark-blue), rgba(10, 25, 47, 0.8), var(--background-dark-blue))`
- **Animations**: `spin` keyframe for loaders, `background-pan` for dynamic backgrounds
- **Box shadows**: Multiple layers for depth and glow effects

## Status Colors (for logs/notifications)

- Info: `rgba(6, 182, 212, 0.1)` with `#06b6d4` text
- Success: `rgba(34, 197, 94, 0.1)` with `#22c55e` text
- Error: `rgba(239, 68, 68, 0.1)` with `#ef4444` text

## Usage Guidelines

This design system creates a modern, dark-themed interface with cyan accents, glass morphism effects, and smooth transitions. All components should use these CSS variables and patterns for consistency.

### Key Classes to Use

- `.glass-ui` - For glass morphism containers
- `.stat-card` - For statistics and info cards
- `.action-btn` - For primary action buttons
- `.details-btn` - For secondary/detail buttons

### Always Import

Make sure to import the main CSS files in this order:

```css
@import 'base.css';      /* Variables and base styles */
@import 'components.css'; /* Component patterns */
@import 'pages.css';     /* Page-specific styles */
@import 'dashboard.css'; /* Dashboard-specific styles */
```
