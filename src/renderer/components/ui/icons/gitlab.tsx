import * as React from "react"
import { SVGProps } from "react"
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={800}
    height={800}
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M5.453 3.34a1.358 1.358 0 0 1 1.82.018c.162.153.286.345.356.56l1.534 4.553a1 1 0 0 0 .947.68h3.745a1 1 0 0 0 .948-.681l1.536-4.573a1.332 1.332 0 0 1 .38-.56 1.358 1.358 0 0 1 1.815.021c.163.153.287.345.357.561l1.99 5.924 1.036 2.966a1.644 1.644 0 0 1-.027 1.106c-.127.33-.355.607-.645.797l-7.537 5.298a3 3 0 0 1-3.45 0L2.705 14.7l-.005-.003a1.665 1.665 0 0 1-.617-.834 1.643 1.643 0 0 1 .004-1.043l.997-2.987 1.994-5.936a1.332 1.332 0 0 1 .38-.56l-.005.003Z"
      clipRule="evenodd"
    />
  </svg>
)
export default SvgComponent
