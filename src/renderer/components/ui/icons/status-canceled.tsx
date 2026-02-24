import * as React from "react"
import { SVGProps } from "react"
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={800}
    height={800}
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    aria-labelledby="cancelIconTitle"
    color="currentColor"
    viewBox="0 0 24 24"
    {...props}
  >
    <title>{"Cancel"}</title>
    <path d="M15.536 15.536 8.464 8.464m7.072 0-7.072 7.072M4.929 19.071c-3.905-3.905-3.905-10.237 0-14.142 3.905-3.905 10.237-3.905 14.142 0 3.905 3.905 3.905 10.237 0 14.142-3.905 3.905-10.237 3.905-14.142 0Z" />
  </svg>
)
export default SvgComponent
