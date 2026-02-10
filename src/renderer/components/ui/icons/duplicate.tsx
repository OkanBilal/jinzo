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
      d="M18 3H4a1 1 0 0 0-1 1v14a1 1 0 1 1-2 0V4a3 3 0 0 1 3-3h14a1 1 0 1 1 0 2ZM13 11a1 1 0 1 1 2 0v2h2a1 1 0 1 1 0 2h-2v2a1 1 0 1 1-2 0v-2h-2a1 1 0 1 1 0-2h2v-2Z"
    />
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M20 5a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3h12Zm0 2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h12Z"
      clipRule="evenodd"
    />
  </svg>
)
export default SvgComponent
