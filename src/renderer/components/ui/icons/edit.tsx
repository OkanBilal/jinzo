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
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M20.15 7.94 8.28 19.81c-1.06 1.07-4.23 1.56-5 .85-.77-.71-.21-3.88.85-4.95L16 3.84a2.9 2.9 0 0 1 4.1 4.1h.05ZM21 21h-9"
    />
  </svg>
)
export default SvgComponent
