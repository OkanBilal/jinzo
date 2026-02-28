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
      d="M6 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM18 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
      opacity={0.1}
    />
    <path
      stroke="currentColor"
      strokeWidth={2}
      d="M6 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM18 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6ZM12 15a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M6.012 9c.101 2.45.864 3 3.64 3h4.696c2.776 0 3.539-.55 3.64-3"
    />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 15v-3"
    />
  </svg>
)
export default SvgComponent
