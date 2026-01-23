# Responsive Design Patterns

## Breakpoints (Mobile-First)

```tsx
// Tailwind breakpoints
// sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px

// Mobile-first approach
<div className="
  w-full           // Mobile: full width
  sm:w-1/2         // ≥640px: half width
  lg:w-1/3         // ≥1024px: third width
">
```

## Common Patterns

### Stack to Row

```tsx
// Vertical on mobile, horizontal on desktop
<div className="flex flex-col md:flex-row gap-4">
  <div className="w-full md:w-1/2">Left</div>
  <div className="w-full md:w-1/2">Right</div>
</div>
```

### Hide/Show Elements

```tsx
// Mobile menu icon, desktop nav
<button className="md:hidden">☰</button>
<nav className="hidden md:flex gap-4">
  <a>Link 1</a>
  <a>Link 2</a>
</nav>
```

### Responsive Typography

```tsx
<h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">Responsive Heading</h1>
```

### Responsive Spacing

```tsx
<section className="px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
  <div className="max-w-7xl mx-auto">Content</div>
</section>
```

### Responsive Grid

```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {items.map((item) => (
    <Card key={item.id} {...item} />
  ))}
</div>
```

## Container Pattern

```tsx
// Centered container with responsive padding
<div className="container mx-auto px-4 sm:px-6 lg:px-8">Content</div>
```

## Aspect Ratio

```tsx
// Responsive image container
<div className="aspect-video sm:aspect-square lg:aspect-[4/3]">
  <img className="w-full h-full object-cover" />
</div>
```

## Dark Mode Integration

```tsx
<div
  className="
  bg-white dark:bg-gray-900
  text-gray-900 dark:text-gray-100
  border-gray-200 dark:border-gray-700
"
>
  Supports dark mode
</div>
```
