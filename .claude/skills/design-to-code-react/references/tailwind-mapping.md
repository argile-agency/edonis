# Design Token to Tailwind Mapping

## Colors

| Design Token    | Tailwind Class            |
| --------------- | ------------------------- |
| #FFFFFF         | `bg-white` / `text-white` |
| #000000         | `bg-black` / `text-black` |
| rgba(0,0,0,0.5) | `bg-black/50`             |
| Brand Primary   | `bg-primary` (custom)     |

## Typography

| Property        | Figma    | Tailwind        |
| --------------- | -------- | --------------- |
| Font Size 12px  | 12       | `text-xs`       |
| Font Size 14px  | 14       | `text-sm`       |
| Font Size 16px  | 16       | `text-base`     |
| Font Size 18px  | 18       | `text-lg`       |
| Font Size 20px  | 20       | `text-xl`       |
| Font Size 24px  | 24       | `text-2xl`      |
| Font Weight 400 | Regular  | `font-normal`   |
| Font Weight 500 | Medium   | `font-medium`   |
| Font Weight 600 | SemiBold | `font-semibold` |
| Font Weight 700 | Bold     | `font-bold`     |

## Spacing

| Pixels | Tailwind                |
| ------ | ----------------------- |
| 4px    | `p-1` / `m-1` / `gap-1` |
| 8px    | `p-2` / `m-2` / `gap-2` |
| 12px   | `p-3` / `m-3` / `gap-3` |
| 16px   | `p-4` / `m-4` / `gap-4` |
| 20px   | `p-5` / `m-5` / `gap-5` |
| 24px   | `p-6` / `m-6` / `gap-6` |
| 32px   | `p-8` / `m-8` / `gap-8` |

## Border Radius

| Figma  | Tailwind       |
| ------ | -------------- |
| 2px    | `rounded-sm`   |
| 4px    | `rounded`      |
| 6px    | `rounded-md`   |
| 8px    | `rounded-lg`   |
| 12px   | `rounded-xl`   |
| 16px   | `rounded-2xl`  |
| 9999px | `rounded-full` |

## Shadows

| Figma Effect                | Tailwind    |
| --------------------------- | ----------- |
| 0 1px 2px rgba(0,0,0,0.05)  | `shadow-sm` |
| 0 4px 6px rgba(0,0,0,0.1)   | `shadow-md` |
| 0 10px 15px rgba(0,0,0,0.1) | `shadow-lg` |
| 0 20px 25px rgba(0,0,0,0.1) | `shadow-xl` |

## Layout Patterns

```tsx
// Figma Auto Layout → Flexbox
// Direction: Horizontal, Gap: 8, Padding: 16
<div className="flex gap-2 p-4">

// Direction: Vertical, Gap: 12, Align: Center
<div className="flex flex-col gap-3 items-center">

// Grid 3 columns, Gap: 16
<div className="grid grid-cols-3 gap-4">
```
