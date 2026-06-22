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
    <g fill="currentColor" fillRule="evenodd" clipRule="evenodd">
      <path d="M6.25 5.25c0-2.747 2.187-5 4.917-5h6.666c2.73 0 4.917 2.253 4.917 5v8.5c0 2.747-2.187 5-4.917 5a.75.75 0 0 1 0-1.5c1.873 0 3.417-1.553 3.417-3.5v-8.5c0-1.947-1.544-3.5-3.417-3.5h-6.666c-1.873 0-3.417 1.553-3.417 3.5a.75.75 0 0 1-1.5 0Z" />
      <path d="M1.25 10.25c0-2.747 2.187-5 4.917-5h6.666c2.73 0 4.917 2.253 4.917 5v8.5c0 2.747-2.187 5-4.917 5H6.167c-2.73 0-4.917-2.253-4.917-5v-8.5Zm4.917-3.5c-1.873 0-3.417 1.553-3.417 3.5v8.5c0 1.947 1.544 3.5 3.417 3.5h6.666c1.873 0 3.417-1.553 3.417-3.5v-8.5c0-1.947-1.544-3.5-3.417-3.5H6.167Z" />
    </g>
  </svg>
)
export default SvgComponent
