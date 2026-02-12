import * as React from "react"
import { SVGProps } from "react"
const SvgComponent = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={800}
    height={800}
    fill="none"
    viewBox="0 0 16 16"
    {...props}
  >
    <path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 6.905A3.001 3.001 0 0 0 4.25 1a3 3 0 0 0-.75 5.905V14A.75.75 0 0 0 5 14V6.905zM2.75 4a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zm9.75 1.25v3.595a3.001 3.001 0 0 1-.75 5.905A3 3 0 0 1 11 8.845V5.25a.75.75 0 0 0-.75-.75H9A.75.75 0 0 1 9 3h1.25a2.25 2.25 0 0 1 2.25 2.25zm-2.25 6.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z"
      clipRule="evenodd"
    />
  </svg>
)
export default SvgComponent
