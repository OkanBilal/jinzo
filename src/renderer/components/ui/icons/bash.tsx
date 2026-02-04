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
    <path stroke="currentColor" strokeLinecap="round" strokeWidth={2} d="M13 15h3" />
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="m8 15 2.5-2.5v0a.707.707 0 0 0 0-1v0L8 9"
    />
    <path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M3 8c0-1.886 0-2.828.586-3.414C4.172 4 5.114 4 7 4h10c1.886 0 2.828 0 3.414.586C21 5.172 21 6.114 21 8v8c0 1.886 0 2.828-.586 3.414C19.828 20 18.886 20 17 20H7c-1.886 0-2.828 0-3.414-.586C3 18.828 3 17.886 3 16V8Z"
    />
  </svg>
)
export default SvgComponent
