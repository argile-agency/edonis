import edge from 'edge.js'
import { isSafeImageSrc } from '../inertia/lib/safe_url.js'

// Favicon partial uses the same image rule as the React side (SETTINGS-06).
edge.global('isSafeImageSrc', isSafeImageSrc)
